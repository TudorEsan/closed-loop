import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EventResponseDto {
  @ApiProperty({ description: 'Event ID' })
  id: string;

  @ApiProperty({ description: 'Event name' })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug' })
  slug: string;

  @ApiPropertyOptional({ description: 'Event description' })
  description: string | null;

  @ApiProperty({ description: 'Organizer user ID' })
  organizerId: string;

  @ApiProperty({
    description: 'Event lifecycle status',
    enum: ['draft', 'setup', 'active', 'settlement', 'closed'],
  })
  status: string;

  @ApiProperty({ description: 'Currency code' })
  currency: string;

  @ApiProperty({ description: 'Token to currency exchange rate' })
  tokenCurrencyRate: string;

  @ApiPropertyOptional({ description: 'Maximum transaction amount' })
  maxTransactionAmount: number | null;

  @ApiPropertyOptional({ description: 'Maximum offline spending limit' })
  maxOfflineSpend: number | null;

  @ApiProperty({ description: 'Default commission rate for vendors' })
  defaultCommissionRate: string;

  @ApiProperty({ description: 'Event start date' })
  startDate: string;

  @ApiProperty({ description: 'Event end date' })
  endDate: string;

  @ApiProperty({ description: 'Timezone identifier' })
  timezone: string;

  @ApiPropertyOptional({ description: 'Event location' })
  location: string | null;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt: Date;
}
