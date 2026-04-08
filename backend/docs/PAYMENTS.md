# Payments

How wallet top-ups work in the closed-loop system. The short version: the
mobile app asks our backend for a payment intent, our backend asks the
provider (Stripe today) to create one, the provider hands back a client
secret, the mobile SDK collects the card and confirms with the provider
directly, and finally the provider tells us via webhook that the payment
went through, at which point we credit the wallet.

We never see card data. Cards never touch our server.

## The big picture

```
+--------+   1. POST /topup/intent    +---------+   2. createPaymentIntent   +--------+
|        | -------------------------> |         | -------------------------> |        |
| Mobile |                            | Backend |                            | Stripe |
|        | <------------------------- |         | <------------------------- |        |
+--------+   3. clientSecret + key    +---------+    intent + clientSecret   +--------+
    |                                                                            ^
    |                                  4. PaymentSheet (card data, never us)     |
    +----------------------------------------------------------------------------+
                                                                                 |
+---------+   6. credit wallet         +---------+   5. webhook payment_intent.succeeded
|         | <------------------------- |         | <-------------------------------+
|   DB    |                            | Backend |
|         |                            |         |
+---------+                            +---------+
```

1. User picks an amount in the mobile app and hits "Confirm".
2. Mobile calls `POST /api/v1/wallets/me/topup/intent` with
   `{ amount: 2000 }` (cents). The wallet is user-level, usable across any
   event, so no eventId in the path.
3. Backend creates a `payment_intents` row, asks the provider to create
   their own intent, and returns `{ clientSecret, publishableKey, ... }`.
4. Mobile uses `@stripe/stripe-react-native` `PaymentSheet` to collect the
   card. Card data goes straight from the device to the provider, our
   server never touches it.
5. Provider fires `payment_intent.succeeded` webhook to
   `POST /api/v1/payments/webhook`. We verify the signature, look up our
   internal row by `provider_intent_id`, and credit the wallet inside a
   single DB transaction (also creating a wallet `transactions` row of
   type `topup_online`).
6. Mobile invalidates the wallet React Query cache, refetches, sees the
   new balance.

The credit step (5) is idempotent. Stripe retries webhooks aggressively, so
if we get `payment_intent.succeeded` twice for the same intent we only
credit once.

## Provider abstraction

The whole point is that nothing in the app talks to Stripe directly except
one file. Adding paypal/adyen/whatever later is "implement the interface +
flip a binding".

```
backend/src/modules/payments/
├── payments.module.ts            <-- binds StripePaymentProvider to PAYMENT_PROVIDER
├── payments.service.ts           <-- pure business logic, only uses PaymentProvider
├── payments.controller.ts        <-- HTTP routes
├── providers/
│   ├── payment-provider.interface.ts   <-- the interface + Symbol token
│   └── stripe.provider.ts              <-- the only file that imports `stripe`
└── dto/
    ├── create-topup-intent.dto.ts
    └── topup-intent-response.dto.ts
```

The interface lives in `providers/payment-provider.interface.ts`:

```ts
export interface PaymentProvider {
  readonly name: string;          // 'stripe', 'paypal', ...
  readonly publishableKey: string; // safe to expose to the client
  createIntent(params: CreateIntentParams): Promise<CreateIntentResult>;
  parseWebhook(rawBody: Buffer, signature: string): NormalizedEvent;
}
```

`NormalizedEvent` is a discriminated union with three real cases
(`succeeded`, `failed`, `canceled`) plus `ignored` for events the service
doesn't care about. Each adapter is responsible for mapping its own
provider's event shape to one of these. The service `switch`es on
`event.type` and never knows which provider produced it.

### Adding a new provider

1. Create `providers/myprovider.provider.ts` and implement
   `PaymentProvider`. Make sure `parseWebhook` throws on signature
   mismatch.
2. In `payments.module.ts` change the binding:
   ```ts
   { provide: PAYMENT_PROVIDER, useClass: MyProviderPaymentProvider }
   ```
3. Add the new env vars to `payments.config.ts`,
   `validation/payments.schema.ts`, and `.env.example`.
4. Update the webhook URL in your provider dashboard. The route stays
   `POST /api/v1/payments/webhook`, but the signature header name might
   change — adjust `payments.controller.ts` if needed.

That's it. `payments.service.ts` does not change.

## Database

One new table: `payment_intents`. Tracks every topup attempt, regardless of
provider.

| column              | notes                                                |
| ------------------- | ---------------------------------------------------- |
| id                  | our internal uuid                                    |
| user_id             | who is paying                                        |
| wallet_id           | which wallet to credit                               |
| provider            | `'stripe'` (or whatever you bind)                    |
| provider_intent_id  | the provider's id, unique. Webhook lookup uses this. |
| amount              | minor units (cents)                                  |
| currency            | lowercase ISO 4217                                   |
| status              | `pending` → `succeeded` / `failed` / `canceled`      |
| transaction_id      | FK to wallet `transactions` row, set on success      |
| metadata            | provider-specific extras                             |
| failure_reason      | only on failed                                       |
| created_at, updated_at |                                                  |

The wallet credit itself is a single DB transaction:
1. `UPDATE wallets SET balance = balance + amount`
2. `INSERT INTO transactions ... type='topup_online' status='completed'`
3. `UPDATE payment_intents SET status='succeeded', transaction_id=...`

So either everything happens or nothing does. No half-credited wallets.

## Environment variables

In `.env`:

```
PAYMENTS_PROVIDER=stripe
PAYMENTS_CURRENCY=eur

STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Get test keys from <https://dashboard.stripe.com/test/apikeys>.

For the mobile side, in `softpos/.env.local`:

```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Same key, different file. The mobile only ever sees the publishable half.

## Testing locally

You need the Stripe CLI to forward webhooks to your dev machine. Install
from <https://docs.stripe.com/stripe-cli>, then:

```bash
# Log in once
stripe login

# Start the forwarder. This prints a whsec_... value.
# Copy it into STRIPE_WEBHOOK_SECRET in backend/.env.local and restart the
# backend.
stripe listen --forward-to localhost:3000/api/v1/payments/webhook
```

Now in the mobile app: open the topup screen, type an amount, hit Confirm.
The PaymentSheet pops up. Use one of Stripe's test cards:

| card                | result          |
| ------------------- | --------------- |
| 4242 4242 4242 4242 | succeeds        |
| 4000 0000 0000 9995 | declined        |
| 4000 0025 0000 3155 | requires 3DS    |

Any future date for expiry, any CVC. Hit Pay. The PaymentSheet closes,
the backend gets the webhook, the wallet balance jumps. Pull to refresh
on the home screen if it doesn't update on its own.

## Webhook signature verification

This is the part that matters for security. If you skip it, anyone with
your webhook URL can credit any wallet by POSTing a fake event.

We use Stripe's `constructEvent(rawBody, signature, secret)` which:
- recomputes the HMAC over the raw body bytes
- compares against the `Stripe-Signature` header
- throws if the body was modified or the secret is wrong

`rawBody` is the exact bytes Stripe sent us, not the parsed JSON. NestJS
strips the body by default (parses JSON eagerly), so `main.ts` is set up
with `NestFactory.create(AppModule, { rawBody: true })` which adds
`req.rawBody: Buffer` to every request. The webhook controller pulls it
out via `@Req() req: RawBodyRequest<Request>`.

The webhook route is also marked `@Public()` so the auth guard doesn't
reject it. Only the signature stands between us and a forged event, so it
must never be skipped.

## Failure modes

- **Mobile loses network mid-payment**: not our problem, Stripe's
  PaymentSheet retries / shows an error. The intent stays `pending` until
  Stripe times it out and sends `payment_intent.canceled`, at which point
  we mark our row `canceled`. No wallet movement.
- **Webhook arrives before we finish saving the intent**: shouldn't happen
  because the intent is created in the provider only AFTER we hold a row
  reservation, but if it does we log a warning and skip. Stripe retries
  with backoff, by the time the second delivery comes in our row exists.
- **Webhook is replayed by an attacker**: signature check fails (the
  attacker doesn't know `STRIPE_WEBHOOK_SECRET`).
- **Same `payment_intent.succeeded` delivered twice**: idempotent. We
  check `intent.status === 'succeeded'` and bail if so.
- **Stripe down**: `createIntent` throws, mobile shows the error, no row
  is written, no money moves.
- **Backend crashes between provider intent create and DB insert**: the
  intent exists at Stripe but we have no row. Webhook arrives → `Received
  succeeded event for unknown intent` warning, no credit. The user's
  money is at Stripe but not credited. This is the only edge case worth
  worrying about. Mitigation options for the future:
  - reserve our id first, pass it as metadata, look up by either id
  - reconciliation job that pulls Stripe intents and matches against ours

For now, this window is small (one HTTP call wide) and we accept it.

## Files to look at

- `backend/src/modules/payments/payments.service.ts` — the credit logic
- `backend/src/modules/payments/providers/stripe.provider.ts` — the only
  Stripe-aware code
- `backend/src/common/database/schemas/payment-intents.ts` — schema
- `softpos/app/topup.tsx` — the mobile flow
- `softpos/lib/api/payments.ts` — the mobile API client

## Currency

Everything is minor units (cents) end to end. The `payments.currency`
config is the single source of truth — change it once and the whole stack
follows. Don't mix currencies in one event, the wallet balance is also a
plain integer with no currency tag.

# To test with dummy data

Open the app, log in, hit "Add funds", type something like
20, hit Confirm. The Stripe PaymentSheet pops up. Use one of
these cards:

┌───────────────┬────────────────────────────────────────┐
│     card      │              what happens              │
├───────────────┼────────────────────────────────────────┤
│ 4242 4242     │ succeeds                               │
│ 4242 4242     │                                        │
├───────────────┼────────────────────────────────────────┤
│ 4000 0000     │ declined                               │
│ 0000 9995     │                                        │
├───────────────┼────────────────────────────────────────┤
│ 4000 0025     │ needs 3DS verification (good for       │
│ 0000 3155     │ testing the auth flow)                 │
└───────────────┴────────────────────────────────────────┘