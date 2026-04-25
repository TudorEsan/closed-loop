import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class ReplaceBraceletDto {
  @ApiProperty({
    description:
      'New wristband UID to bind to the same user for the same event',
    example: '04:A1:B2:C3:D4:E5:F7',
  })
  @IsString()
  @Length(4, 64)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  wristbandUid!: string;

  @ApiPropertyOptional({
    description: 'Reason for replacement, e.g. lost or damaged',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
