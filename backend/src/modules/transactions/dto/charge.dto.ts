import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ChargeChipStateDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  balance: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  debit_counter: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  credit_counter_seen: number;
}

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

  @ApiProperty({ type: ChargeChipStateDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => ChargeChipStateDto)
  chipState: ChargeChipStateDto;
}
