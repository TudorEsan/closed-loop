import { Module } from '@nestjs/common';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripePaymentProvider } from './providers/stripe.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER,
      useClass: StripePaymentProvider,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
