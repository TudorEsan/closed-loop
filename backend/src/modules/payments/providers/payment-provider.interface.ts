// Provider abstraction so the rest of the app never talks to Stripe (or any
// other gateway) directly. To add a new provider: implement this interface
// and bind it to PAYMENT_PROVIDER in payments.module.ts.

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

// Normalized webhook event that the service layer understands. Each provider
// adapter maps its own event shape to one of these.
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
  // Short identifier stored in the DB (e.g. 'stripe')
  readonly name: string;

  // Key that the client (mobile app) uses to talk to the provider SDK.
  // Safe to return in an API response, not a secret.
  readonly publishableKey: string;

  // Create a new payment intent with the provider and return the handle
  // the client needs to complete the payment.
  createIntent(params: CreateIntentParams): Promise<CreateIntentResult>;

  // Verify webhook signature + parse the payload. MUST throw if the
  // signature check fails so we never act on a forged event.
  parseWebhook(rawBody: Buffer, signature: string): NormalizedEvent;
}
