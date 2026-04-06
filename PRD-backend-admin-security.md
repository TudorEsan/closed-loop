# PRD: Backend, Admin Portal, and Security

This document is a build spec for the closed-loop festival payment system. It covers the backend API (NestJS + Drizzle + PostgreSQL), the admin dashboard (React web app), and the security layer. Everything here comes from the architecture chapter of the thesis. The mobile app and NFC wristband stuff are out of scope for now.

## What already exists

The backend repo has a NestJS 11 scaffold with Drizzle ORM, PostgreSQL connection, Swagger, rate limiting (throttler), and basic config/validation modules. No business logic, no database schema, no auth. The admin-portal repo has a Vite + React + TypeScript setup with shadcn/ui and Tailwind. Just the shell, no pages or logic yet.

---

## 1. Database schema (PostgreSQL + Drizzle)

The system is multi-tenant. Every table is scoped by `event_id`. One deployment handles all festivals.

### Tables to create

**users**
- id (uuid, PK)
- email (unique)
- password_hash
- name
- role (enum: attendee, vendor, admin, super_admin)
- created_at, updated_at

**events**
- id (uuid, PK)
- name
- description
- organizer_id (FK -> users)
- status (enum: setup, active, settlement, closed)
- token_currency_rate (decimal, e.g. 1 token = 0.50 EUR)
- max_transaction_amount (integer, in tokens)
- max_offline_spend (integer, per wristband safety cap)
- commission_rate (decimal, default vendor commission %)
- start_date, end_date
- created_at, updated_at

**vendors**
- id (uuid, PK)
- user_id (FK -> users)
- event_id (FK -> events)
- business_name
- contact_person
- product_type (what they sell)
- status (enum: pending, approved, rejected, suspended)
- commission_rate (decimal, override per vendor, nullable)
- created_at, updated_at

**devices**
- id (uuid, PK)
- vendor_id (FK -> vendors)
- device_identifier (string, the actual phone device ID)
- status (enum: active, blocked)
- last_sync_at (timestamp, nullable)
- transaction_count (integer, running total)
- created_at

**wallets**
- id (uuid, PK)
- user_id (FK -> users)
- event_id (FK -> events)
- balance (integer, in tokens)
- wristband_uid (string, the NFC chip UID, unique per event)
- created_at, updated_at
- UNIQUE constraint on (user_id, event_id) -- one wallet per user per event

**transactions**
- id (uuid, PK)
- event_id (FK -> events)
- wallet_id (FK -> wallets)
- vendor_id (FK -> vendors, nullable for top-ups)
- device_id (FK -> devices, nullable for top-ups)
- type (enum: payment, topup, refund, cashout)
- amount (integer, in tokens)
- status (enum: completed, pending, failed, flagged)
- offline (boolean, was this processed offline?)
- transaction_counter (integer, the rolling counter from the wristband)
- client_timestamp (timestamp, when it happened on device)
- server_timestamp (timestamp, when server received it)
- created_at

**sync_logs**
- id (uuid, PK)
- device_id (FK -> devices)
- event_id (FK -> events)
- transaction_count (how many txns in this batch)
- synced_at (timestamp)
- status (enum: success, partial, failed)

**security_alerts**
- id (uuid, PK)
- event_id (FK -> events)
- type (enum: chain_break, root_detected, long_offline, balance_mismatch, suspicious_activity)
- device_id (FK -> devices, nullable)
- wallet_id (FK -> wallets, nullable)
- description (text)
- resolved (boolean, default false)
- created_at

### Indexes

- transactions: index on (event_id, wallet_id), index on (event_id, vendor_id), index on (event_id, created_at)
- wallets: index on (event_id, wristband_uid)
- devices: index on (vendor_id), index on (device_identifier)
- security_alerts: index on (event_id, resolved)

---

## 2. Backend API (NestJS)

### Auth module

- POST /auth/register -- create account (email + password)
- POST /auth/login -- returns JWT access token + refresh token
- POST /auth/refresh -- exchange refresh token for new access token
- GET /auth/me -- current user profile

JWT strategy: short-lived access token (15 min), longer refresh token (7 days). Store refresh tokens in the database so they can be revoked. Use NestJS guards for role-based access control (RBAC). Roles: attendee, vendor, admin, super_admin.

Guards to implement:
- JwtAuthGuard (validates the access token)
- RolesGuard (checks the user's role against allowed roles on each endpoint)

### Events module

- POST /events -- create event (admin only)
- GET /events -- list events (filtered by role: admins see all their events, vendors see events they're part of)
- GET /events/:id -- get event details
- PATCH /events/:id -- update event config (admin only, only in setup status)
- PATCH /events/:id/status -- transition event lifecycle (setup -> active -> settlement -> closed)

The status transitions should be validated: you can only go forward, and certain transitions have prerequisites (e.g., can't go to "active" without at least one approved vendor).

### Vendors module

- POST /events/:eventId/vendors -- apply as vendor (creates a pending vendor record)
- GET /events/:eventId/vendors -- list vendors for an event (admin sees all, vendor sees only their own)
- PATCH /events/:eventId/vendors/:id -- approve/reject/suspend vendor (admin only)
- PATCH /events/:eventId/vendors/:id/commission -- set custom commission rate (admin only)

### Devices module

- POST /events/:eventId/vendors/:vendorId/devices -- whitelist a device (admin only)
- GET /events/:eventId/vendors/:vendorId/devices -- list devices for a vendor
- PATCH /events/:eventId/devices/:id -- block/unblock a device (admin only)
- GET /events/:eventId/devices -- list all devices for an event with sync status (admin only)

### Wallets module

- POST /events/:eventId/wallets -- create wallet for current user + bind wristband UID
- GET /events/:eventId/wallets/me -- get current user's wallet for this event
- GET /events/:eventId/wallets -- list all wallets (admin only, for monitoring)
- GET /events/:eventId/wallets/:id -- get wallet details including transaction history (admin or wallet owner)

### Transactions / sync module

- POST /events/:eventId/sync -- receive a batch of offline transactions from a vendor device
  - Accepts an array of transactions
  - Each transaction has: wallet_id, amount, type, transaction_counter, client_timestamp, device_id
  - Server validates each transaction: check device is whitelisted and active, check vendor is approved, check event is active
  - Idempotency: use (device_id + transaction_counter) as a dedup key so resending the same batch doesn't create duplicates
  - Flag any chain breaks (gaps in transaction_counter for a given wristband)
  - Update wallet balance on server side (this is the reporting balance, not the authoritative one)
  - Return sync confirmation with count of accepted/rejected transactions

- GET /events/:eventId/transactions -- list transactions with filters (admin only): by vendor, by wallet, by date range, by status
- GET /events/:eventId/transactions/stats -- aggregate stats: total volume, revenue by vendor, transaction count by hour (admin only)

### Stripe / top-up module

- POST /events/:eventId/topup -- initiate a top-up (creates Stripe PaymentIntent)
- POST /webhooks/stripe -- Stripe webhook handler
  - Verify webhook signature
  - On payment_intent.succeeded: credit the wallet, create a "topup" transaction record, mark the top-up as needing wristband write
  - Idempotent: check if this payment intent was already processed

### Security alerts module

- GET /events/:eventId/alerts -- list security alerts (admin only), filterable by type and resolved status
- PATCH /events/:eventId/alerts/:id -- mark alert as resolved (admin only)
- Alerts are created automatically by the sync module when it detects chain breaks, balance mismatches, or by device check-in endpoints when root detection fails

### Dashboard stats endpoints

- GET /events/:eventId/dashboard -- aggregated stats for the admin dashboard:
  - Total tokens in circulation
  - Total transaction volume (today / all time)
  - Active devices count and last sync times
  - Revenue by vendor (top 10)
  - Unresolved security alerts count
  - Sync health: devices that haven't synced in >1 hour

---

## 3. Admin dashboard (React)

Built with Vite + React + TypeScript + shadcn/ui + Tailwind. Already scaffolded.

### Pages to build

**Login page**
- Email + password form
- JWT token storage (in memory, not localStorage for security, with refresh token in httpOnly cookie if possible, otherwise in memory too)

**Events list page**
- List of events the admin manages
- Create new event button
- Status badges (setup, active, settlement, closed)

**Event detail / setup page**
- Edit event config: name, dates, token rate, spending limits, commission rate
- Event lifecycle controls (buttons to transition status, with confirmation dialogs)
- Only editable fields when in "setup" status

**Vendors management page**
- Table of vendor applications with status
- Approve / reject / suspend actions
- Expand to see vendor's devices
- Set custom commission per vendor

**Device management page**
- Table of all devices across all vendors for an event
- Columns: device ID, vendor name, status, last sync time, transaction count
- Block/unblock actions
- Visual indicator for devices that haven't synced recently (>1 hour = yellow, >4 hours = red)

**Monitoring / stats page**
- Total tokens in circulation
- Transaction volume over time (line chart)
- Revenue by vendor (bar chart or table)
- Recent transactions feed
- Sync timeline (when each device last pushed data)

**Security alerts page**
- Table of alerts, sortable by type and date
- Filter by: type, resolved/unresolved
- Each alert shows: type, description, affected device/wallet, timestamp
- Resolve button with optional notes
- Prominent unresolved count in the sidebar/nav

**Navigation**
- Sidebar with: Events, Vendors, Devices, Monitoring, Security Alerts
- Event selector at the top (switch between events the admin manages)
- User menu with logout

### API integration

Use a fetch wrapper or axios with interceptors for:
- Attaching JWT to every request
- Auto-refreshing when a 401 comes back
- Redirecting to login on auth failure

---

## 4. Security implementation

### Authentication

- Passwords hashed with bcrypt (cost factor 12)
- JWT access tokens: 15 min expiry, signed with a secret from env
- Refresh tokens: 7 day expiry, stored in DB, single-use (rotate on refresh)
- Rate limit login attempts (already have throttler, just configure it tighter for /auth/login)

### Authorization (RBAC)

Four roles: attendee, vendor, admin, super_admin. Each endpoint gets a @Roles() decorator specifying which roles can access it. The RolesGuard reads the role from the JWT payload and checks against the decorator.

Role permissions summary:
- super_admin: everything
- admin: manage their own events, vendors, devices, view all data for their events
- vendor: view their own vendor profile, manage their devices, push sync data
- attendee: view their wallet, initiate top-ups

Admins can only see/manage events where they are the organizer. This is enforced at the query level (WHERE organizer_id = current_user.id), not just at the guard level.

### Input validation

Every endpoint uses DTOs with class-validator decorators. Validate:
- UUIDs are actually UUIDs
- Amounts are positive integers
- Enums are valid values
- Strings have sensible max lengths
- Event IDs in path params match the token's event scope

### Stripe webhook security

- Verify the Stripe signature header on every webhook call
- Reject requests that don't pass verification
- Process webhooks idempotently (store the payment intent ID and skip if already processed)

### Sync endpoint security

- Only whitelisted, active devices can push sync data
- Device must belong to an approved vendor for the given event
- Event must be in "active" status to accept sync data
- Transaction counter must be sequential per wristband (gaps trigger a security alert)
- Batch size limits to prevent abuse

### Data protection

- HTTPS everywhere (handled by Railway/load balancer)
- Database connection over SSL
- No sensitive data in JWT payload beyond user ID and role
- Stripe handles all card data, the system never sees card numbers (PCI compliance by not touching it)

---

## 5. Build order (suggested)

This is the order that makes sense for incremental development:

**Phase 1: Foundation**
1. Database schema (all tables, indexes, Drizzle migrations)
2. Auth module (register, login, refresh, JWT guards, RBAC)
3. Basic error handling and validation pipes

**Phase 2: Core business logic**
4. Events module (CRUD + lifecycle state machine)
5. Vendors module (applications, approval flow)
6. Devices module (whitelisting, blocking)
7. Wallets module (creation, binding wristband UID)

**Phase 3: Transactions and sync**
8. Sync endpoint (batch upload, validation, dedup, chain break detection)
9. Transaction queries and stats aggregation
10. Security alerts (auto-creation from sync, manual resolution)

**Phase 4: Payments**
11. Stripe integration (PaymentIntent creation, webhook handler)
12. Top-up flow end to end

**Phase 5: Admin dashboard**
13. Auth flow (login, token management, protected routes)
14. Event management pages
15. Vendor and device management pages
16. Monitoring and stats pages
17. Security alerts page

**Phase 6: Hardening**
18. Rate limiting tuning
19. Input validation review
20. Error handling audit
21. API documentation (Swagger decorators on all endpoints)

---

## Tech stack summary

| Layer | Tech |
|-------|------|
| Backend framework | NestJS 11 |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Railway managed) |
| Auth | JWT (access + refresh tokens), bcrypt |
| Payments | Stripe (PaymentIntents + webhooks) |
| Admin frontend | Vite + React + TypeScript + shadcn/ui + Tailwind |
| Deployment | Docker on Railway (EU region) |
| API docs | Swagger via @nestjs/swagger |

---

## What this PRD does NOT cover

- The React Native mobile app (attendee + vendor POS)
- NFC wristband interaction (DESFire EV3, AES-128 auth, balance read/write)
- On-device offline transaction queue logic
- Wristband key management and diversification
- Cash top-up station flow
- Settlement and cashout after event ends
