import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ChipStateDto {
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

export class PendingDebitDto {
  @ApiProperty()
  @IsUUID()
  idempotencyKey: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty()
  @IsString()
  vendorId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  counterValue: number;

  @ApiProperty()
  @IsString()
  deviceId: string;

  @ApiProperty()
  @IsDateString()
  clientTimestamp: string;
}

export class SyncRequestDto {
  @ApiProperty({ type: ChipStateDto })
  @ValidateNested()
  @Type(() => ChipStateDto)
  chipState: ChipStateDto;

  @ApiProperty({ type: [PendingDebitDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PendingDebitDto)
  @IsOptional()
  pendingDebits: PendingDebitDto[];
}
