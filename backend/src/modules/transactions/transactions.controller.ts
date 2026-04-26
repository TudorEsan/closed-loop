import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { TransactionsService } from './transactions.service';
import { ChargeDto } from './dto/charge.dto';
import { ListVendorTransactionsDto } from './dto/list-transactions.dto';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('events/:eventId/vendors/:vendorId/transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Post('charge')
  @ApiOperation({
    summary: 'Online debit: charge a bracelet at a vendor terminal',
  })
  async charge(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @Body() dto: ChargeDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.transactions.charge(eventId, vendorId, user.id, user.role, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List recent transactions for a vendor' })
  async list(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @Query() query: ListVendorTransactionsDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.transactions.listForVendor(
      eventId,
      vendorId,
      user.id,
      user.role,
      query,
    );
  }
}
