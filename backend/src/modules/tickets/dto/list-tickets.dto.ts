import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const TICKET_STATUSES = ['pending', 'redeemed', 'revoked', 'expired'] as const;
export type TicketStatusFilter = (typeof TICKET_STATUSES)[number];

export class ListTicketsDto {
  @ApiPropertyOptional({ enum: TICKET_STATUSES })
  @IsOptional()
  @IsIn(TICKET_STATUSES as unknown as string[])
  status?: TicketStatusFilter;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
