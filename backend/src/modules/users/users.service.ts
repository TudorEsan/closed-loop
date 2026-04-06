import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import { users } from '@common/database/schemas';
import { eq, ilike, or, desc, and, lt, type SQL } from 'drizzle-orm';
import { UserQueryDto } from './dto/user-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async findAll(query: UserQueryDto) {
    const { role, search, limit = 20, cursor } = query;

    const conditions: SQL<unknown>[] = [];

    if (role) {
      conditions.push(eq(users.role, role));
    }

    if (search) {
      const searchCondition = or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`));
      if (searchCondition) conditions.push(searchCondition);
    }

    if (cursor) {
      const cursorUser = await this.db
        .select({ createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, cursor))
        .limit(1);

      if (cursorUser.length > 0) {
        conditions.push(lt(users.createdAt, cursorUser[0].createdAt));
      }
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const results = await this.db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    if (hasMore) results.pop();

    return {
      users: results,
      nextCursor: hasMore ? results[results.length - 1].id : null,
    };
  }

  async findById(id: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return result[0];
  }

  async update(id: string, dto: UpdateUserDto) {
    // Make sure user exists
    await this.findById(id);

    const result = await this.db
      .update(users)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return result[0];
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    await this.findById(id);

    const result = await this.db
      .update(users)
      .set({ role: dto.role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return result[0];
  }

  async deactivate(id: string) {
    await this.findById(id);

    const result = await this.db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return result[0];
  }
}
