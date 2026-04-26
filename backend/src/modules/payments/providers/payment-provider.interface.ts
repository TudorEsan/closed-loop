
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export type CreateIntentParams = {
  amount: number; // minor units (cents)
  currency: string; // lowercase ISO 4217, e.g. 'eur'
  metadata: Record<string, string>;
  description?: string;
};

export type CreateIntentResult = {
  providerIntentId: string;
  clientSecret: string;
};

export type NormalizedEvent =
  | {
      type: 'succeeded';
      providerIntentId: string;
      amount: number;
      currency: string;
      metadata: Record<string, string>;
      raw?: unknown;
    }
  | {
      type: 'failed';
      providerIntentId: string;
      reason: string;
      raw?: unknown;
    }
  | {
      type: 'canceled';
      providerIntentId: string;
      raw?: unknown;
    }
  | {
      // Events we don't care about (e.g. charge.updated, payout.*). The
      // webhook handler just returns 200 for these.
      type: 'ignored';
    };

export interface PaymentProvider {
  readonly name: string;

  readonly publishableKey: string;

  createIntent(params: CreateIntentParams): Promise<CreateIntentResult>;

  parseWebhook(rawBody: Buffer, signature: string): NormalizedEvent;
}
