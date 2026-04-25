import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, IsUUID } from 'class-validator';

export class LinkBraceletDto {
  @ApiProperty({ description: 'User the bracelet should be assigned to' })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description:
      'Wristband UID as read from the chip. Hex pairs separated by colons or plain hex.',
    example: '04:A1:B2:C3:D4:E5:F6',
  })
  @IsString()
  @Length(4, 64)
  @Matches(/^[A-Za-z0-9:_-]+$/, {
    message:
      'wristbandUid may only contain alphanumerics, colon, underscore or hyphen',
  })
  wristbandUid!: string;
}
