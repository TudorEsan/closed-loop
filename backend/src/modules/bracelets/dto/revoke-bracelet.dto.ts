import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeBraceletDto {
  @ApiPropertyOptional({
    description: 'Reason for revocation, surfaced in audit log',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
