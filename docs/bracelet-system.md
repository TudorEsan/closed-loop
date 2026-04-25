# Bracelet System: NFC, Trust, and Balance Consolidation

This is the operational doc for the bracelet payment flow. It covers what
goes over the air between the wristband and the SoftPOS, why we sign tokens
on the server, how money settles when a phone has been offline for a while,
and how the same flow tightens up if we move from generic NFC tags to
DESFire EV3 chips.

## 1. How the wristband talks to the SoftPOS today

The wristbands we use right now are plain ISO/IEC 14443-A tags. The
exchange between phone and chip is the standard low-level handshake any
contactless reader does:

1. The reader broadcasts a `REQA` request.
2. Tags in range answer with an `ATQA` (anti-collision response).
3. Anti-collision narrows it down to one tag.
4. The reader sends `SELECT` and the tag confirms with its UID.

That UID is a 4 or 7 byte number printed into the chip at manufacture.
There is no challenge, no key, no encryption. Anyone with an NFC reader can
get the same UID by tapping the same tag. That is the security ceiling of
the hardware.

So the chip alone does not prove that the bracelet belongs to a specific
attendee or even that this is a real festival bracelet versus a cloned
sticker. The trust has to come from somewhere else.

## 2. What `BRACELET_SIGNING_KEY` does

It is a 32 byte symmetric secret stored as an env var on the backend, also
embedded into each provisioned SoftPOS device. The backend uses it to
HMAC-SHA256 sign two kinds of short messages:

### Kind 1: bundle token (cached on the SoftPOS)

When an admin links a wristband UID to a user for an event, the server
mints a token that says, in effect:

```json
{
  "kind": "bundle",
  "assignmentId": "...",
  "eventId": "...",
  "userId": "...",
  "wristbandUid": "04:A1:B2:...",
  "issuedAt": 1714050000000,
  "expiresAt": 1714740000000,
  "v": 1
}
```

That payload is base64url encoded, signed with the key, and shipped to
SoftPOS via `GET /events/:eventId/bracelets/sync-bundle`. The phone caches
the whole bundle. When somebody taps a bracelet at a vendor stand:

1. The reader gets the UID.
2. The phone looks the UID up in the cached bundle.
3. The phone HMAC-verifies the token with its embedded key.
4. The phone checks the expiry and that the eventId matches the one the
   device was provisioned for.
5. Only then does it run the payment.

If the network is up, step 2 falls back to `GET .../bracelets/by-uid/:uid`
when the cache misses.

### Kind 2: link token (shown by the attendee as a QR)

When an attendee opens "My festivals" and taps a row, the phone calls
`POST /me/events/:eventId/link-token` and gets back a token like:

```json
{
  "kind": "link",
  "eventId": "...",
  "userId": "...",
  "issuedAt": 1714050000000,
  "expiresAt": 1714050300000
}
```

It expires in 5 minutes. The attendee shows it as a QR. An admin or
operator scans it on their SoftPOS, taps the wristband, and the phone
sends `{ linkToken, wristbandUid }` to
`POST /events/:eventId/bracelets/link-by-token`. The server verifies the
HMAC and the kind, and only then creates the assignment.

The two kinds use the same key but a different `kind` field, so a stolen
sync-bundle entry cannot be replayed as a link request and vice versa.

### Threats this defends against

- **Cloned UID at the gate.** A copy of a UID alone is useless without the
  matching signed token in the bundle.
- **Replayed token.** Bundle tokens are tied to the event end + grace
  period. Link tokens die in 5 minutes. A leaked screenshot is rejected
  by the time it is interesting.
- **Stale assignments.** When an admin revokes a bracelet (lost, stolen,
  given to the wrong user), the bundle no longer includes it on the next
  sync. The phone picks up the revocation as soon as it is online again.
- **Cross-event reuse.** Each token carries `eventId`; the SoftPOS only
  trusts tokens for the event it was provisioned for.

## 3. Balance consolidation

The wallet balance is authoritative on the server. SoftPOS terminals are
allowed to be offline, but they do not own the truth, they hold a queue
that the server applies later.

### Online tap

1. Vendor enters the amount, attendee taps the bracelet.
2. Phone reads UID, verifies the token, calls
   `POST /transactions` with `{ walletId, vendorId, amount, idempotencyKey }`.
3. Server applies it inside a single Drizzle transaction:
   - check wallet status,
   - check current balance,
   - insert the `transactions` row,
   - subtract from `wallets.balance`.
4. Server responds with the new balance, phone shows it.

### Offline tap

1. Phone reads UID and runs the same offline trust checks.
2. Phone records the transaction locally with an idempotency key (UUIDv4)
   and a monotonic local sequence number per device.
3. Phone optimistically lowers a local copy of the balance for that UID so
   the next tap on the same bracelet on the same phone respects the limit.
4. Phone shows "approved offline".

### Reconnection

When the phone gets online again it pushes the queued transactions in
order. The server:

1. Dedupes by idempotency key, so re-pushing the same queue is a no-op.
2. Applies them one by one in arrival order.
3. If a tx would push the wallet negative (because some other phone
   already ate the balance), it marks that transaction `flagged` /
   `rejected_insufficient_funds` and writes an audit row. The vendor sees
   the discrepancy on the next sync.

This is the trade-off the thesis describes in chapter 4: offline taps are
allowed, but the system reserves the right to reject them later if the
wallet had less money than the offline cache thought. With sensibly small
top-ups and short offline windows this is rare in practice; we keep it as
an explicit failure mode so we never have to tell two vendors they share
the same RON.

### Top-ups

Top-ups (cash from an operator, or Stripe online) write to the same
`wallets.balance` ledger via the same transactional path, so consolidation
is one code path, not two.

## 4. Where DESFire EV3 would change things

Today the chip cannot prove anything about itself. We compensate with the
HMAC token. If we swap to MIFARE DESFire EV3 chips (or similar), the chip
itself starts holding its end of the trust:

- During provisioning we write a per-chip key derived from a master key
  plus the UID. Each chip has a different key.
- At tap time the reader runs AES-128 mutual authentication with the
  chip. The chip proves it knows its key, the reader proves it has the
  master, and only then does either side exchange data.
- A cloned UID on a generic tag is useless: it cannot complete the
  handshake.

The HMAC token still has a job, but it is narrower. The chip proves the
hardware is real; the token proves which user/event this real chip
belongs to. That separation is what chapter 4 of the thesis calls
"hardware authenticity vs. business assignment".

Migration steps if we go there:

1. Add `chipKeyVersion` column to `event_bracelets`.
2. During the link flow, after we read the UID, write a diversified key
   to the chip and store the version.
3. SoftPOS provisioning gets the master key (or a derived "reader key")
   embedded; rotation is a separate operational task with its own audit
   trail.
4. The HMAC link/bundle tokens stay exactly as they are.

For now we run with item 0: trust by HMAC, treat the UID as identifier
only. The plumbing on the server and on the phone does not need to change
when we upgrade, because the new chip just slots into the same UID-shaped
hole.
