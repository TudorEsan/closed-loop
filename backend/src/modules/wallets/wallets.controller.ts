import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';

import { WalletsService } from './wallets.service';

// Wallet is user-level now: one wallet per user, used across any event.
// Topups go through the payments module (POST /wallets/me/topup/intent),
// spending happens via POS sync (not here).
@ApiTags('Wallets')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user wallet' })
  async getMyWallet(@CurrentUser() user: { id: string }) {
    return this.walletsService.getMyWallet(user.id);
  }

  @Get('me/transactions')
  @ApiOperation({ summary: 'List transactions for the current user wallet' })
  async listMyTransactions(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.walletsService.listMyTransactions(user.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }
}
