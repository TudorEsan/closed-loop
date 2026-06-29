import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { ChargeChipStateDto } from './charge.dto';

export class CashTopupDto {
  @ApiProperty({ description: 'UID of the wristband to credit' })
  @IsString()
  wristbandUid: string;

  @ApiProperty({
    description: 'Amount to credit, in minor units (e.g. cents for EUR)',
    minimum: 1,
    maximum: 100000,
  })
  @IsInt()
  @Min(1)
  @Max(100000, { message: 'Maximum cash topup is 1000.00' })
  amount: number;

  @ApiProperty({ description: 'Client-generated idempotency key' })
  @IsUUID()
  idempotencyKey: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiProperty({ type: ChargeChipStateDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => ChargeChipStateDto)
  chipState: ChargeChipStateDto;
}
