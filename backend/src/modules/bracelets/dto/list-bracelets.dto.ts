import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export type BraceletAssignmentStatus = 'active' | 'revoked' | 'replaced';

export class ListBraceletsDto {
  @ApiPropertyOptional({ enum: ['active', 'revoked', 'replaced'] })
  @IsOptional()
  @IsIn(['active', 'revoked', 'replaced'])
  status?: BraceletAssignmentStatus;

  @ApiPropertyOptional({
    description: 'Search by wristband UID or user name/email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}
