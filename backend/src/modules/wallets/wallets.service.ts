import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';

import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import { transactions, wallets } from '@common/database/schemas';

// Thin wrapper around the wallets table. The only writes to balance come
// from the payments module (on topup webhook) and from the POS sync flow
// (on spending), so this module is mostly reads: current balance + the
// user's transaction feed.
@Injectable()
export class WalletsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  // Returns the user's wallet, lazy-creating it if it doesn't exist yet.
  // Makes the mobile flow simpler, no "join" step before you can see a
  // balance.
  async getOrCreateMyWallet(userId: string) {
    const existing = await this.db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (existing.length > 0) return existing[0];

    // Two parallel requests (e.g. balance + transactions on the home
    // screen) can both reach this point and try to insert. The unique
    // constraint on user_id would make the second one throw, so we let
    // the DB resolve the race with onConflictDoNothing and re-select.
    const inserted = await this.db
      .insert(wallets)
      .values({ userId })
      .onConflictDoNothing({ target: wallets.userId })
      .returning();

    if (inserted.length > 0) return inserted[0];

    const row = await this.db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);
    return row[0];
  }

  // Cursor-paginated list of the user's transactions, newest first. Cursor
  // is the id of the last row returned, simple and good enough for a feed
  // that rarely changes order.
  async listMyTransactions(
    userId: string,
    params: { limit?: number; cursor?: string } = {},
  ) {
    const wallet = await this.getOrCreateMyWallet(userId);
    const limit = Math.min(params.limit ?? 20, 100);

    const conditions = [eq(transactions.walletId, wallet.id)];
    if (params.cursor) {
      // Fetch the cursor row to know where to continue from
      const cursorRow = await this.db
        .select({ createdAt: transactions.createdAt })
        .from(transactions)
        .where(eq(transactions.id, params.cursor))
        .limit(1);
      if (cursorRow.length > 0) {
        conditions.push(lt(transactions.createdAt, cursorRow[0].createdAt));
      }
    }

    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { transactions: items, nextCursor };
  }

  async getMyWallet(userId: string) {
    const wallet = await this.getOrCreateMyWallet(userId);
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }
}
