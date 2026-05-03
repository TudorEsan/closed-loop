import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

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
  @ApiProperty({ type: [PendingDebitDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PendingDebitDto)
  pendingDebits: PendingDebitDto[];
}
