# Security Architecture: POS Devices and NFC Wristbands

This document explains how the POS (Point of Sale) devices interact with NFC wristbands in our closed-loop payment system. The short version: the wristband hardware itself enforces who can spend and who can top up, so even if somebody messes with the POS app, they still cannot cheat the system.

## DESFire EV3 Key Structure

Each NFC wristband uses a MIFARE DESFire EV3 chip. DESFire lets you create multiple "applications" on a single chip, each with its own set of AES-128 keys and access rules. We use this to separate permissions at the hardware level.

### Key Setup Per Wristband

| Key | Name | Permission | Who Gets It |
|-----|------|-----------|-------------|
| Key 0 | Master / Credit Key | Full access: read balance, write balance, credit (increase), debit (decrease) | Only the backend server and authorized top-up stations |
| Key 1 | Debit Key | Can only decrease balance and write to the transaction log | POS devices (vendor terminals) |
| Key 2 | Read Key | Read-only access to balance | Balance check kiosks, attendee mobile app |

### What This Means In Practice

A POS device only has Key 1 (the debit key). When a vendor tries to process a payment:

1. The POS taps the wristband
2. DESFire chip asks the POS to authenticate with a key
3. POS presents Key 1
4. The chip checks the key and says "ok, you have debit-only permission"
5. POS sends a DEBIT command for X tokens
6. The chip decreases the balance and writes a record to the transaction log
7. If the POS tries to send a CREDIT command (increase balance), the chip rejects it

This is not a software check that can be bypassed. It is enforced by the silicon on the chip. Even if a vendor completely rewrites the POS application, the DESFire chip will not accept a credit operation from Key 1. Period.

## Key Derivation and Provisioning

We do not use the same key on every wristband and every POS. That would be a disaster because compromising one device would compromise the whole system.

### How Keys Are Derived

We use key diversification, which is the standard approach for DESFire deployments:

```
derived_key = AES-CMAC(master_key, diversification_data)
```

Where `diversification_data` includes:
- The card UID (7 bytes, unique per physical chip)
- The application ID
- A system identifier constant

This means:
- Each wristband has a unique set of keys (even though they are derived from the same master)
- The POS needs the master debit key to compute the derived debit key for each wristband it encounters
- The master debit key is provisioned to the POS during device approval (see below)

### POS Key Provisioning Flow

1. Admin or vendor owner generates a **registration token** from the admin dashboard
2. The POS app is installed on the vendor's phone/tablet
3. The POS app enters the registration token along with device metadata (model, OS, GPS, fingerprint)
4. The backend creates a device record with status `pending_approval`
5. An admin reviews the device info in the dashboard and approves it
6. On approval, the backend:
   - Generates a `keyDerivationSalt` (random 32 bytes)
   - Derives the POS-specific master debit key using: `AES-CMAC(system_debit_master, device_id + salt)`
   - Sends the derived master debit key to the POS over a TLS-encrypted channel
   - Records `keyVersion` and `keyProvisionedAt` for audit
7. The POS stores the key in Android Keystore or iOS Secure Enclave (hardware-backed secure storage)

### Why Per-Device Keys Matter

If a POS device is compromised (stolen, rooted, key extracted):
- You block that device in the admin panel
- The compromised key only works for that specific device
- At the next sync cycle or at will, the system can rotate keys on affected wristbands
- Other POS devices are completely unaffected

## Transaction Integrity

### Transaction Counter

Every DESFire EV3 chip has an internal transaction counter that automatically increments with each committed transaction. This counter:
- Cannot be reset or decremented
- Is returned as part of every transaction response
- Creates a sequential chain: transaction 1, 2, 3, 4...

If the server sees transactions 1, 2, 4 (missing 3), that is a **chain break** which triggers a security alert. It means either:
- A transaction was processed but not synced (most likely, the POS lost it)
- Somebody is trying to replay or tamper with the transaction log

### CMAC Verification

Every DESFire transaction produces a CMAC (Cipher-based Message Authentication Code). This is a cryptographic signature that proves:
- The transaction happened on a real DESFire chip (not emulated)
- The exact amount was debited
- The transaction counter is authentic

The POS stores the CMAC with each transaction in its local queue. When it syncs to the server, the server can verify each CMAC using the system keys. A fake or modified transaction will fail CMAC verification.

### The Full Transaction Flow

```
1. Vendor enters amount on POS
2. POS taps wristband
3. POS authenticates with DESFire using its debit key
4. POS reads current balance from wristband
5. POS checks: balance >= amount? If not, decline.
6. POS sends DEBIT command to wristband
7. DESFire decreases balance, increments counter, returns CMAC
8. POS stores transaction locally:
   - amount, card UID, counter, CMAC, timestamp, vendor ID, operator ID
9. POS shows "Payment OK" to vendor
10. When connectivity is available, POS syncs batch to server
11. Server validates each transaction:
    - Is this device registered and active?
    - Is the operator assigned to this device?
    - Is the CMAC valid?
    - Is the counter sequential?
    - Is the event still active?
12. Server updates the server-side balance (for reporting/reconciliation)
13. Any anomalies generate security alerts in the admin dashboard
```

## Top-Up Flow

Top-ups can only happen at authorized stations because they require the **credit key** (Key 0).

### Online Top-Up (Stripe)

1. Attendee opens the mobile app, selects amount
2. App creates a Stripe PaymentIntent via backend
3. Attendee pays with card (Stripe handles all card data, we never see it)
4. Stripe webhook confirms payment
5. Backend credits the server-side balance
6. Attendee taps wristband at a top-up station (or uses their own phone if it has NFC)
7. The top-up station authenticates with Key 0 and CREDITs the balance on the chip
8. Done. The wristband balance now matches the server balance.

### Cash Top-Up

1. Attendee goes to a cash desk, pays with cash
2. Operator at the cash desk uses a top-up terminal (not a regular POS)
3. Top-up terminal has Key 0, credits the wristband
4. Transaction recorded and synced to server

### Why POS Cannot Top Up

Just to be super clear: a vendor POS terminal has Key 1 (debit only). Even if the vendor wanted to "top up" a friend's wristband, the DESFire chip on the wristband will reject the credit command because Key 1 does not have credit permission. The vendor would need physical access to a top-up station with Key 0, and those are controlled by the event organizer.

## Device Security Checks

### What We Collect During Registration

When a POS device registers, we capture:
- **Device model and OS**: For inventory and to spot weird configurations (e.g., an emulator pretending to be a real phone)
- **GPS coordinates**: Approximate location to verify the device is at or near the event venue
- **IP address**: Captured server-side (never trust client-reported IP)
- **Device fingerprint**: Hash of hardware attributes, used to detect if the same physical device re-registers under a different identity
- **App version**: To ensure the POS is running a supported version

### What We Cannot Verify Server-Side

Let us be honest about what the server cannot verify:
- Device model and OS are self-reported. A sophisticated attacker can fake these. They are useful for inventory, not for security decisions.
- GPS can be spoofed. Same deal, useful for audit trail, not a security gate.
- The registration token + admin approval is the real security gate, not the device metadata.

### Device Attestation (Future Enhancement)

For stronger device verification, the system can integrate with:
- **Android Play Integrity API**: Google's service that cryptographically verifies the device is genuine, not rooted, and running unmodified software
- **iOS DeviceCheck / App Attest**: Apple's equivalent

These services provide a signed token from Google/Apple that the server can verify. This is the gold standard for device verification but requires additional integration. For the thesis prototype, the registration token + admin approval flow is sufficient.

## Testing With Regular NFC Tags

For the prototype and testing, you do not need DESFire EV3 chips. Regular NFC tags (NTAG215, NTAG216, Mifare Classic) can be used with a software simulation layer.

### How It Works

The POS app has two modes:
- **Production mode**: Full DESFire EV3 protocol (AES auth, CMAC, hardware-enforced access control)
- **Test mode**: Reads/writes plain data to a regular NFC tag, simulates the DESFire security in software

In test mode:
- Balance is stored as a plain integer on the NFC tag (no encryption)
- Transaction counter is maintained in the app instead of the chip hardware
- CMAC is generated in software using the same algorithm, but verified against a test key
- All backend logic (sync, validation, key tracking, operator checks) works exactly the same

### What You Lose In Test Mode

- No hardware-enforced debit-only. The app could theoretically write any value to the tag. The software simulation prevents this, but it is not as bulletproof as real DESFire.
- No tamper-proof counter. The app maintains the counter, so it could in theory be manipulated.
- No CMAC from the chip. The software-generated CMAC proves the app processed the transaction, not that a real chip was involved.

For the thesis, you describe the full DESFire EV3 implementation as the production design and note that the prototype uses NFC tag simulation for practical reasons. This is completely standard for academic prototypes.

## Key Rotation and Revocation

### Blocking a Device

When an admin blocks a POS device:
1. Device status changes to `blocked` in the database
2. On next sync attempt, the server rejects the sync and tells the device it is blocked
3. The device should delete its stored keys from secure storage
4. If the device ignores the block command, it does not matter: the server will reject all future sync attempts from this device ID

### Key Rotation

Key rotation is needed when:
- A device is compromised (key potentially extracted)
- Periodic rotation as a security best practice

The process:
1. Admin triggers key rotation for a device
2. Backend generates a new `keyDerivationSalt`, increments `keyVersion`
3. New derived key is sent to the POS
4. Affected wristbands get their debit keys rotated at next top-up or at dedicated rotation kiosks
5. Old key version is invalidated after a grace period

### Master Key Compromise (Worst Case)

If the system master key is somehow compromised (this should never happen if it is stored in an HSM or secure vault):
1. Generate new master key
2. Re-derive all device keys
3. Re-key all wristbands (this requires physical tap of every wristband, which is why you want the master key in an HSM)

This is an extreme scenario, but the architecture supports recovery from it.
