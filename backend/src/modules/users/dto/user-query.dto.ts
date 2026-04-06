import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const VALID_ROLES = [
  'super_admin',
  'admin',
  'operator',
  'vendor',
  'attendee',
] as const;

export class UserQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by role',
    enum: VALID_ROLES,
  })
  @IsOptional()
  @IsIn(VALID_ROLES)
  role?: (typeof VALID_ROLES)[number];

  @ApiPropertyOptional({
    description: 'Search by name or email',
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
    description: 'Cursor for pagination (user ID)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
