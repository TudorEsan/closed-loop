import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, Max } from 'class-validator';

export class CreateTopupIntentDto {
  @ApiProperty({
    description: 'Amount to top up, in minor units (e.g. cents for EUR)',
    minimum: 100,
    maximum: 100000,
    example: 2000,
  })
  @IsInt()
  @Min(100, { message: 'Minimum topup is 1.00' })
  @Max(100000, { message: 'Maximum topup is 1000.00' })
  amount: number;

  @ApiProperty({
    description: 'ID of the event_bracelet to credit on success',
  })
  @IsString()
  eventBraceletId: string;
}
