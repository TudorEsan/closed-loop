import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class DeviceQueryDto {
  @ApiPropertyOptional({ description: 'Filter by device status' })
  @IsOptional()
  @IsString()
  status?: 'pending_approval' | 'active' | 'blocked' | 'decommissioned';

  @ApiPropertyOptional({ description: 'Search by device name or model' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Cursor for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
