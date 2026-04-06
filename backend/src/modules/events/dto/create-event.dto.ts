import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsDateString,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ description: 'Event name', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Currency code',
    default: 'EUR',
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string = 'EUR';

  @ApiProperty({ description: 'Token to currency exchange rate, must be > 0' })
  @IsNumber()
  @Min(0.0001)
  tokenCurrencyRate: number;

  @ApiPropertyOptional({
    description: 'Maximum transaction amount in tokens',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTransactionAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum offline spending limit in tokens',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxOfflineSpend?: number;

  @ApiPropertyOptional({
    description: 'Default commission rate for vendors (0-100)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultCommissionRate?: number;

  @ApiProperty({ description: 'Event start date (ISO 8601)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Event end date (ISO 8601)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Timezone identifier',
    default: 'Europe/Bucharest',
  })
  @IsOptional()
  @IsString()
  timezone?: string = 'Europe/Bucharest';

  @ApiPropertyOptional({ description: 'Event location' })
  @IsOptional()
  @IsString()
  location?: string;
}
