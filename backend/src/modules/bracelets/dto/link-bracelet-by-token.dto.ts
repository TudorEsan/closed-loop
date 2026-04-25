import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class LinkBraceletByTokenDto {
  @ApiProperty({
    description:
      'Short-lived signed link token shown by the attendee as a QR code',
  })
  @IsString()
  @Length(10, 4096)
  linkToken!: string;

  @ApiProperty({
    description: 'Wristband UID read from the NFC chip',
    example: '04:A1:B2:C3:D4:E5:F6',
  })
  @IsString()
  @Length(4, 64)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  wristbandUid!: string;
}
