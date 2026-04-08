import { ApiProperty } from '@nestjs/swagger';

export class TopupIntentResponseDto {
  @ApiProperty({ description: 'Our internal payment intent id' })
  paymentIntentId: string;

  @ApiProperty({ description: 'Provider client secret used by the mobile SDK' })
  clientSecret: string;

  @ApiProperty({ description: 'Provider publishable key (safe to expose)' })
  publishableKey: string;

  @ApiProperty({ description: 'Name of the payment provider, e.g. stripe' })
  provider: string;

  @ApiProperty({ description: 'Currency code, lowercase ISO 4217' })
  currency: string;

  @ApiProperty({ description: 'Amount, minor units' })
  amount: number;
}
