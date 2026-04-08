import { registerAs } from '@nestjs/config';
import { PaymentsConfig } from '@app/common/types/payments.types';

// Payment provider settings. We only ship Stripe today but everything flows
// through an abstraction, so swapping to a different provider later is only
// a matter of adding another adapter and flipping PAYMENTS_PROVIDER.
export default registerAs(
  'payments',
  (): PaymentsConfig => ({
    provider: (process.env.PAYMENTS_PROVIDER as 'stripe') || 'stripe',
    currency: process.env.PAYMENTS_CURRENCY || 'eur',
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
  }),
);
