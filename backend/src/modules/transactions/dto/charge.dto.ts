import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ChargeDto {
  @ApiProperty({ description: 'UID of the wristband to debit' })
  @IsString()
  wristbandUid: string;

  @ApiProperty({ description: 'Amount to debit, in minor units' })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Client-generated idempotency key' })
  @IsUUID()
  idempotencyKey: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  deviceId?: string;
}
