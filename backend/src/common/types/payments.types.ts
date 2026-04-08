export type PaymentsConfig = {
  provider: 'stripe';
  currency: string;
  stripe: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
  };
};
