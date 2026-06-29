# Thesis Defense — Anticipated Questions & Answers

Prep notes for the closed-loop festival payment system. First-person answers, written to be said out loud. Each has a one-line **short answer** you can lead with, then backup depth if the examiner pushes.

---

## 1. Cloning — "Can't someone just copy a wristband?"

**Short answer:** With the plain NTAG chips I used, yes, a full clone is physically possible — but the design bounds the damage, and DESFire removes the attack entirely. I was deliberate about this trade-off.

**Depth:**
- The wristband is a plain NTAG tag. It exposes simple read/write memory and holds no secret, so the chip cannot prove it is the original rather than a byte-for-byte copy. Anyone with an off-the-shelf NFC writer can read the user memory and write it onto a blank tag.
- What I *do* protect is **integrity, not authenticity**. The 28-byte balance record is signed with an HMAC-SHA256 (truncated to 128 bits) over the state, using a key derived per-bracelet with HKDF from a master key and the chip's read-only UID. So you cannot just *raise* your balance — a fabricated record fails verification on the next read.
- A clone therefore starts with a *valid* signed state, but it can only ever spend the balance that was copied. The two copies diverge the moment either one is used, because each spend bumps the monotonic `debit_counter`. As soon as both reach an online terminal, the server sees the same counter value used twice and rejects the duplicate. The exposure is one offline window's worth of the copied balance, not unlimited.
- So the honest framing: the prototype's crypto buys *time and a bound*, not strong anti-cloning. The hardware contributes nothing to that bound — the bound comes from the counters and short offline windows.
- The clean fix is the chip, which leads into the next question.

---

## 2. "Is it safe to keep the balance on the NFC chip at all?"

**Short answer:** Yes — and it's a well-proven pattern (transit cards do exactly this for billions of taps) — but it's only properly safe with a secure-element chip like DESFire. On plain NTAG it works for a demo and is bounded, but it is not production-grade.

**How DESFire makes on-chip balance safe (short version):**
- DESFire EV2/EV3 has a **secure element**: a tamper-resistant chip that stores a secret key which **cannot be read out**, even physically.
- Each card gets a **diversified key** — derived from a master key plus the card's UID — so compromising one card doesn't compromise the rest.
- Every transaction starts with **AES-128 mutual authentication**: the reader and the card challenge each other and each proves it holds the key *without ever transmitting it*. This produces a fresh session key for that one tap.
- After that handshake, all reads and writes happen over an **encrypted and MAC-protected channel**. A rogue reader that doesn't hold the key can't read or write the balance, and a cloned card can't reproduce the secret to pass the handshake.
- DESFire even offers a native **Value File** with hardware-enforced debit / limited-credit permissions, so the chip itself refuses an illegal balance change.

**Why on-chip balance is the right call here:** the whole point is that the wristband can authorize a spend with **no network round-trip** — that's what keeps the festival running when connectivity collapses. The balance has to live somewhere the terminal can reach offline, and the customer's own chip is that place. The key insight is that the chip being a single physical object is *also* the thing that prevents double-spend: only one terminal can touch it at a time, and the decrement is atomic.

**Important:** my reconciliation model does **not** change when you upgrade NTAG → DESFire. Only the terminal's read/write path adds the cryptographic handshake. So the architecture is already DESFire-ready; it's a hardware swap plus a key-provisioning step, not a redesign.

---

## 3. Double-spend — "Two terminals are offline. What stops the same money being spent twice?"

**Short answer:** The wristband is one physical object. Two terminals cannot hold the same chip at the same instant, and each spend atomically decrements the on-chip balance and bumps a counter — so the second terminal reads the already-reduced balance.

**Depth:** This is the elegant part — protection during a network partition does **not** rely on distributed consensus. Terminal A taps, spends 30, writes `(20, debit=1)` to the chip. When terminal B taps, it reads `20`, not the stale `50`. There is no window where both read the full balance. On reconnect, if a late offline debit reuses a counter value the server already saw, the server records it for history but does not subtract it again. Double-spend is closed by physics plus monotonic counters, not by a lock held over a flaky network.

---

## 4. "What stops me rewriting my own chip to a higher balance?"

**Short answer:** The balance record is HMAC-signed with a key you don't have, so a forged record is rejected on the next read.

**Depth:** The signing key is derived per-bracelet via HKDF using the chip's read-only manufacturer UID as salt, so you can't move a valid signature from one bracelet to another either. The one real weakness is *where the master key lives* — see Q5, I'd rather raise it myself than have them find it.

---

## 5. "Where does the signing key live? Isn't that a weakness?" (Raise this yourself.)

**Short answer:** Yes — in the current build the master key is bundled into the mobile app, and that's the single biggest weakness. I know exactly where it is and how I'd fix it.

**Depth:**
- Expo inlines `EXPO_PUBLIC_*` environment variables straight into the JavaScript bundle. Anyone who pulls the APK off a vendor phone can extract the key and derive every bracelet's key. That removes the chip-level HMAC defence in one move.
- There's also a hardcoded fallback key that activates if the env var is missing at build time — convenient for development, dangerous in production. Removing it (or failing the build loudly) is a hard requirement before deployment.
- Two fixes, cheapest first: (1) provision **per-event keys** to the terminal at event start over a short-lived authenticated channel, so compromising one APK only exposes one event for its duration; (2) the proper fix — move to **DESFire**, where the key sits in a secure element that's never in the app bundle at all.
- I'm upfront about this in the thesis because the bound matters: even with the key extracted, the attacker is still limited by online counter checks and the offline-window size. It's a real weakness, not a catastrophic one, and it has a clear remediation path.

---

## 6. "A terminal dies before it syncs its offline queue. What happens to the money?"

**Short answer:** No double-spend, and no customer is overcharged — the loss is purely an *accounting* one, and it's bounded.

**Depth:** The chip already decremented, so the next online terminal trusts the lower balance — the money was correctly taken. What's lost is the itemized record of *which vendor* made those sales. The bound is the offline cap: `OFFLINE_QUEUE_CAP × OFFLINE_MAX_AMOUNT` — in the current build **50 debits × €100 = €5,000 maximum per dead terminal**, and only for sales during that one outage. Policy: trust the chip balance immediately, wait a grace period for late syncs, then log the missing counter range as a discrepancy. The festival absorbs it; vendors with local receipts can reconcile manually. In production those caps would be tuned per event.

---

## 7. "Why allow offline at all? Why not just require connectivity?"

**Short answer:** Because "we can't take your payment, the Wi-Fi is bad" is not acceptable at a festival, and the evidence says connectivity *will* fail at crowd scale.

**Depth:** Shafiq et al. measured 100×–5,000× more connection failures around crowded venues, degradation up to 10 miles out, and it persisted even with portable towers and free Wi-Fi — it's a capacity limit, not a config bug. Download Festival 2015 went fully cashless, the system failed, and they dropped cashless-only the next year. I chose **availability**: keep taking payments through short outages, and cap the risk explicitly rather than pretending the network is always there.

---

## 8. "Then why is it 'online by default' rather than offline-first?"

**Short answer:** Because the offline path almost never actually fires, so building the whole system around it would push queues, conflicts and retries into every component for a rare case.

**Depth:** Online by default via Starlink + a redundant network topology means the server is the source of truth nearly all the time — the cheapest place to enforce invariants like "balance ≥ 0." The chip carries just enough state (balance + two counters) to keep the *rare* offline tap safe. The model swaps which side leads based on what's available: server-first online, chip-first offline. The cost is a reduced feature set during an outage (no top-ups, no live analytics, no refunds), which is acceptable because the only thing that must keep working is the chip-side debit.

---

## 9. "Why closed-loop instead of just using Visa / Mastercard?"

**Short answer:** Open-loop depends on reaching distant bank and scheme hosts in real time — exactly what fails at a festival — and it charges interchange on every tap.

**Depth:** In closed-loop the operator is both issuer and acquirer, so all authorization logic lives inside their own infrastructure; money only crosses an external network once, at top-up. That gives connectivity independence, lower fees (external fees paid once, not per transaction), regulatory simplicity (prepaid in-venue tokens fit the PSD2 limited-network exemption), and full control over limits, refunds and settlement.

---

## 10. "Why not CRDTs / a blockchain / proper distributed consensus?"

**Short answer:** Money is a conserved quantity with a hard invariant (balance ≥ 0), and those tools don't enforce invariants — they guarantee convergence.

**Depth:** CRDTs converge but can't express "never let balance go negative" — the merged state isn't necessarily one any single replica would have accepted. Local-first merging fits documents, not balances; I kept it only as a *read* cache. Blockchain adds consensus latency and infrastructure for a problem that's online most of the time. My approach is simpler: give each counter exactly **one writer** (server writes credits, chip writes debits), so reconciliation is just the union of two non-conflicting streams. No conflict resolution to get wrong.

---

## 11. "Why one PostgreSQL database? Won't it become a bottleneck?"

**Short answer:** Most transactions never touch the database in real time — they happen on the wristband — so the DB mainly absorbs sync batches and dashboard queries.

**Depth:** A single relational DB keeps the invariants (CHECK constraints, partial unique indexes, SERIALIZABLE for the critical paths) simple and correct. The standard scaling path — read replicas, connection pooling, partitioning — needs no application changes. As a reference point, very large single-primary Postgres deployments handle far more than festival volume. I chose correctness and simplicity over premature sharding.

---

## 12. "Can people top up offline?"

**Short answer:** No — top-ups are strictly online, by design.

**Depth:** A top-up moves *real* money in via Stripe, so it must reach the server and the payment provider. The chip only ever *debits* offline; it never increases its own balance. That single rule — the chip can never credit itself — is what makes the whole reconciliation safe. Credits are the server's job alone.

---

## 13. "What about replay attacks?"

**Short answer:** Detectable via the counters. A replayed old signed record shows a stale `debit_counter` / `credit_counter_seen` the next time the bracelet meets an online terminal, and offline debits carry unique idempotency keys so a resubmitted batch is deduplicated.

---

## 14. Privacy / GDPR — "What's exposed if a wristband is lost?"

**Short answer:** A balance and a UID — not an identity.

**Depth:** I kept the ledger free of direct identifiers. The link between a chip UID and a person lives in a single assignment row scoped to one event, so a lost wristband leaks no name, address, or card data, and erasure means dropping that one row. Card data never reaches my backend at all — Stripe handles it, keeping the system out of PCI scope. The operator is the controller, my backend and Stripe are processors.

---

## 15. "Did you measure performance at festival scale?"

**Short answer:** No — and I flag that honestly. The evaluation is qualitative.

**Depth:** I have no tap-latency, throughput, battery, or load-test numbers yet; the verification is end-to-end correctness tests of the reconciliation logic against a real Postgres (idempotent retries, two-terminal contention, top-ups racing offline debits). Measurement at scale is the headline future work. I'd rather state that plainly than over-claim — the contribution is the architecture and the correctness model, not a benchmarked deployment.

---

## 16. "What if Starlink itself goes down entirely?"

**Short answer:** That's exactly the case the chip-as-cache covers — terminals fall back to chip-side authorization and queue debits, within the risk caps, until any uplink returns. The redundant topology means Starlink is one path, not a single point of failure. Weather sensitivity is its main downside, which is why the offline fallback exists rather than being assumed away.

---

## Quick-reference numbers to have ready

- Offline risk cap: **50 debits × €100 = €5,000** max per dead terminal, per outage.
- On-chip record: **28 bytes** — balance + debit_counter + credit_counter_seen (4 bytes each) + **16-byte HMAC-SHA256** (truncated to 128 bits).
- Per-bracelet key: **HKDF-SHA256**(master, salt = chip UID).
- Critical paths run **SERIALIZABLE**; `balance ≥ 0` enforced by a DB **CHECK** constraint.
- Connectivity evidence: **100×–5,000×** more failures at crowd scale (Shafiq 2013); spending lift **g = 0.135** (Schomburgk 2024, 71 studies).
- DESFire: **AES-128 mutual authentication**, diversified per-card keys, non-extractable secure element.
