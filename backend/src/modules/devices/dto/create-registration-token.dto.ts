import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateRegistrationTokenDto {
  @ApiPropertyOptional({
    description: 'Max number of devices that can use this token',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxUses?: number;

  @ApiPropertyOptional({
    description: 'Expiry time in hours (default 24)',
    default: 24,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168) // max 7 days
  expiresInHours?: number;
}
