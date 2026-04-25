import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const VALID_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'suspended',
] as const;

export class VendorQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by vendor status',
    enum: VALID_STATUSES,
  })
  @IsOptional()
  @IsIn(VALID_STATUSES)
  status?: (typeof VALID_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Search by business name',
  })
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
    description: 'Cursor for pagination (vendor ID)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
