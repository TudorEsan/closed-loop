import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const VALID_STATUSES = [
  'draft',
  'setup',
  'active',
  'settlement',
  'closed',
] as const;

export class EventQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by event status',
    enum: VALID_STATUSES,
  })
  @IsOptional()
  @IsIn(VALID_STATUSES)
  status?: (typeof VALID_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Search by event name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Number of results to return',
    default: 20,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (event ID)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
