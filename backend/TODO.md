# Backend Implementation Plan

## Overview

Build the database layer and user/event management for the closed-loop festival payment system.
Multi-tenant architecture where every resource is scoped by `event_id`. Single Postgres database, Drizzle ORM, NestJS.

Four user roles:
- **Super Admin** - platform level, access to everything
- **Admin** - event organizer, creates and manages events
- **Operator** - on-site staff (our team), processes cash topups, manages wristband distribution at the event
- **Vendor** - accepts payments at their booth
- **Attendee** - normal user, makes payments and topups

---

## Phase 0: Infrastructure Setup

### TODO 0.1 - Docker Compose
Rewrite the existing `docker-compose.yml` to be production-like for local dev:

- [ ] **PostgreSQL 17** (alpine) with:
  - Named volume for persistence
  - Health check with `pg_isready`
  - Sensible defaults (shared_buffers, work_mem) via custom `postgresql.conf` or env vars
  - Init script to create the database
- [ ] **NestJS app** container:
  - Hot reload in dev (mount `src/` as volume)
  - Depends on postgres health check
  - Env vars from `.env` file
- [ ] **pgAdmin** (optional, for visual DB inspection during dev)
- [ ] Update `.env.example` with all required vars (JWT secrets, bcrypt rounds, etc.)

### TODO 0.2 - Drizzle Setup
- [ ] Verify `drizzle-kit` is installed (already in devDeps)
- [ ] Configure migrations output to `src/common/database/migrations`
- [ ] Add npm scripts: `db:generate`, `db:migrate`, `db:push`, `db:studio`
- [ ] Wire up schema imports in `drizzle.client.ts` (currently commented out)

---

## Phase 1: Database Schema

All tables use `uuid` primary keys (via `gen_random_uuid()`). All timestamps are `timestamptz`. Every multi-tenant table has an `event_id` column with an index.

### TODO 1.1 - Enums
Define the following Postgres enums in `src/common/database/schemas/enums.ts`:

```
user_role: super_admin, admin, operator, vendor, attendee
event_status: draft, setup, active, settlement, closed
vendor_status: pending, approved, rejected, suspended
device_status: active, blocked
wallet_status: active, frozen, closed
transaction_type: payment, topup_online, topup_cash, refund, cashout
transaction_status: completed, pending, failed, flagged
sync_status: success, partial, failed
alert_type: chain_break, root_detected, long_offline, balance_mismatch, suspicious_activity
alert_severity: low, medium, high, critical
```

### TODO 1.2 - Better Auth Core Tables
Better Auth manages these tables automatically. We define them in Drizzle so we can
reference them in our own tables (foreign keys) and extend the `user` table with custom fields.

Run `npx auth@latest generate` to scaffold the base schema, then we add our custom columns.

File: `src/common/database/schemas/auth.ts`

**user** (managed by Better Auth, extended by us):
```
user
├── id              text, PK (Better Auth default)
├── email           varchar(255), unique, not null (Better Auth)
├── emailVerified   boolean (Better Auth)
├── name            varchar(255) (Better Auth)
├── image           text, nullable (Better Auth)
├── createdAt       timestamptz (Better Auth)
├── updatedAt       timestamptz (Better Auth)
│
│   ── Custom fields we add ──
├── phone           varchar(50), nullable
├── role            user_role enum, not null, default 'attendee'
└── is_active       boolean, default true
```

**session** (fully managed by Better Auth):
```
session
├── id              text, PK
├── userId          text, FK -> user
├── token           text, unique
├── expiresAt       timestamptz
├── ipAddress       text, nullable
├── userAgent       text, nullable
├── createdAt       timestamptz
└── updatedAt       timestamptz
```

**account** (fully managed by Better Auth):
```
account
├── id              text, PK
├── userId          text, FK -> user
├── accountId       text
├── providerId      text
├── accessToken     text, nullable
├── refreshToken    text, nullable
├── expiresAt       timestamptz, nullable
├── password        text, nullable (hashed, for credential auth)
├── createdAt       timestamptz
└── updatedAt       timestamptz
```

**verification** (fully managed by Better Auth):
```
verification
├── id              text, PK
├── identifier      text
├── value           text
├── expiresAt       timestamptz
├── createdAt       timestamptz
└── updatedAt       timestamptz
```

Better Auth handles sessions, token rotation, password hashing (bcrypt/argon2), and
account linking out of the box. No need for custom refresh_tokens table or JWT logic.

### TODO 1.4 - Events Table
File: `src/common/database/schemas/events.ts`

```
events
├── id                      uuid, PK
├── name                    varchar(255), not null
├── slug                    varchar(255), unique, not null
├── description             text, nullable
├── organizer_id            uuid, FK -> users, not null
├── status                  event_status enum, default 'draft'
├── currency                varchar(3), default 'EUR'
├── token_currency_rate     decimal(10,4), not null (e.g. 1 token = 0.50 EUR)
├── max_transaction_amount  integer, nullable (in tokens)
├── max_offline_spend       integer, nullable (per wristband cap)
├── default_commission_rate decimal(5,2), default 0 (%)
├── start_date              date, not null
├── end_date                date, not null
├── timezone                varchar(50), default 'Europe/Bucharest'
├── location                varchar(500), nullable
├── created_at              timestamptz, default now()
└── updated_at              timestamptz, default now()
```

Indexes:
- unique on `slug`
- index on `organizer_id`
- index on `status`
- index on `(start_date, end_date)`

### TODO 1.5 - Event Members Table
File: `src/common/database/schemas/event-members.ts`

This table allows admins to invite other staff (co-admins, operators) to help manage an event.
The `organizer_id` on the events table is the owner. This table is for additional team members.

```
event_members
├── id              uuid, PK
├── event_id        uuid, FK -> events (cascade delete)
├── user_id         uuid, FK -> users (cascade delete)
├── role            enum(organizer, admin, operator), not null
├── invited_by      uuid, FK -> users, nullable
├── created_at      timestamptz, default now()
└── UNIQUE(event_id, user_id)
```

Indexes:
- index on `event_id`
- index on `user_id`

### TODO 1.6 - Vendors Table
File: `src/common/database/schemas/vendors.ts`

```
vendors
├── id                uuid, PK
├── user_id           uuid, FK -> users, not null
├── event_id          uuid, FK -> events, not null
├── business_name     varchar(255), not null
├── contact_person    varchar(255), not null
├── contact_email     varchar(255), nullable
├── contact_phone     varchar(50), nullable
├── product_type      varchar(255), nullable (what they sell)
├── description       text, nullable
├── status            vendor_status enum, default 'pending'
├── commission_rate   decimal(5,2), nullable (override per vendor)
├── approved_by       uuid, FK -> users, nullable
├── approved_at       timestamptz, nullable
├── created_at        timestamptz, default now()
└── updated_at        timestamptz, default now()
└── UNIQUE(user_id, event_id)
```

Indexes:
- index on `event_id`
- index on `(event_id, status)`
- index on `user_id`

### TODO 1.7 - Devices Table
File: `src/common/database/schemas/devices.ts`

```
devices
├── id                  uuid, PK
├── vendor_id           uuid, FK -> vendors (cascade delete)
├── device_identifier   varchar(255), not null
├── device_name         varchar(255), nullable (friendly name)
├── status              device_status enum, default 'active'
├── last_sync_at        timestamptz, nullable
├── transaction_count   integer, default 0
├── created_at          timestamptz, default now()
└── updated_at          timestamptz, default now()
```

Indexes:
- index on `vendor_id`
- unique on `device_identifier`

### TODO 1.8 - Wallets Table
File: `src/common/database/schemas/wallets.ts`

```
wallets
├── id              uuid, PK
├── user_id         uuid, FK -> users, not null
├── event_id        uuid, FK -> events, not null
├── balance         integer, default 0 (in tokens, never negative)
├── wristband_uid   varchar(255), nullable (NFC chip UID)
├── status          wallet_status enum, default 'active'
├── created_at      timestamptz, default now()
└── updated_at      timestamptz, default now()
└── UNIQUE(user_id, event_id)
```

Indexes:
- index on `(event_id, wristband_uid)`
- index on `user_id`
- CHECK constraint: `balance >= 0`

### TODO 1.9 - Transactions Table
File: `src/common/database/schemas/transactions.ts`

```
transactions
├── id                    uuid, PK
├── event_id              uuid, FK -> events, not null
├── wallet_id             uuid, FK -> wallets, not null
├── vendor_id             uuid, FK -> vendors, nullable (null for topups)
├── device_id             uuid, FK -> devices, nullable (null for topups)
├── operator_id           uuid, FK -> users, nullable (for cash topups by operator)
├── type                  transaction_type enum, not null
├── amount                integer, not null (always positive, direction from type)
├── status                transaction_status enum, default 'pending'
├── offline               boolean, default false
├── transaction_counter   integer, nullable (rolling counter from wristband)
├── client_timestamp      timestamptz, nullable
├── server_timestamp      timestamptz, default now()
├── idempotency_key       varchar(255), nullable, unique
├── metadata              jsonb, nullable (stripe payment intent id, notes, etc.)
└── created_at            timestamptz, default now()
```

Indexes:
- index on `(event_id, wallet_id)`
- index on `(event_id, vendor_id)`
- index on `(event_id, created_at)`
- index on `(event_id, type)`
- unique on `idempotency_key` (where not null)
- BRIN index on `created_at` (for time-range queries on large tables)

### TODO 1.10 - Sync Logs Table
File: `src/common/database/schemas/sync-logs.ts`

```
sync_logs
├── id                  uuid, PK
├── device_id           uuid, FK -> devices, not null
├── event_id            uuid, FK -> events, not null
├── transaction_count   integer, not null
├── synced_at           timestamptz, default now()
├── status              sync_status enum, not null
├── error_details       text, nullable
└── created_at          timestamptz, default now()
```

Indexes:
- index on `(event_id, device_id)`
- index on `synced_at`

### TODO 1.11 - Security Alerts Table
File: `src/common/database/schemas/security-alerts.ts`

```
security_alerts
├── id              uuid, PK
├── event_id        uuid, FK -> events, not null
├── type            alert_type enum, not null
├── severity        alert_severity enum, default 'medium'
├── device_id       uuid, FK -> devices, nullable
├── wallet_id       uuid, FK -> wallets, nullable
├── description     text, not null
├── resolved        boolean, default false
├── resolved_by     uuid, FK -> users, nullable
├── resolved_at     timestamptz, nullable
├── resolution_note text, nullable
└── created_at      timestamptz, default now()
```

Indexes:
- index on `(event_id, resolved)`
- index on `(event_id, type)`
- index on `created_at`

### TODO 1.12 - Audit Logs Table
File: `src/common/database/schemas/audit-logs.ts`

Tracks every admin/operator action for accountability. Append only, never updated or deleted.

```
audit_logs
├── id              uuid, PK
├── event_id        uuid, FK -> events, nullable (null for platform level actions)
├── user_id         uuid, FK -> users, not null (who did it)
├── action          varchar(100), not null (e.g. 'vendor.approve', 'event.create')
├── entity_type     varchar(50), not null (e.g. 'vendor', 'event', 'device')
├── entity_id       uuid, not null
├── changes         jsonb, nullable (before/after snapshot)
├── ip_address      varchar(45), nullable
└── created_at      timestamptz, default now()
```

Indexes:
- index on `(event_id, created_at)`
- index on `user_id`
- index on `(entity_type, entity_id)`
- BRIN index on `created_at`

### TODO 1.13 - Schema Index File
Create `src/common/database/schemas/index.ts` that re-exports everything for Drizzle.

### TODO 1.14 - Generate and Run First Migration
- [ ] Run `drizzle-kit generate` to create SQL migration
- [ ] Run `drizzle-kit migrate` against local Postgres
- [ ] Verify all tables, indexes, constraints are created

---

## Phase 2: Auth with Better Auth

### TODO 2.1 - Install Better Auth
```bash
npm install better-auth
```

### TODO 2.2 - Better Auth Configuration
File: `src/common/auth/auth.ts`

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../database/drizzle.client";
import { admin } from "better-auth/plugins"; // for role management

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { ...schema, user: schema.users },
    usePlural: true,
  }),
  emailAndPassword: { enabled: true },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // refresh every 24h
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min cache
    },
  },
  user: {
    additionalFields: {
      phone: { type: "string", required: false },
      role: { type: "string", defaultValue: "attendee", required: true },
      isActive: { type: "boolean", defaultValue: true },
    },
  },
  plugins: [admin()], // gives us user management, banning, role impersonation
});
```

### TODO 2.3 - NestJS Integration
Better Auth exposes a handler that works with any framework. For NestJS we create
a catch-all route that forwards `/api/auth/*` requests to Better Auth.

File: `src/modules/auth/auth.controller.ts`
- [ ] Create a catch-all controller for `/api/auth/**` that delegates to `auth.handler`
- [ ] Better Auth handles: sign-up, sign-in, sign-out, session, email verification

File: `src/modules/auth/auth.service.ts`
- [ ] Wrap `auth.api` for server-side calls (get session, create user, etc.)
- [ ] Helper to extract session from NestJS request: `auth.api.getSession({ headers })`

### TODO 2.4 - Auth Guard (NestJS)
We still need NestJS guards, but now they validate Better Auth sessions instead of JWTs.

```
src/common/guards/
├── auth.guard.ts        - checks valid session via auth.api.getSession()
└── roles.guard.ts       - reads @Roles() decorator, checks user.role from session
src/common/decorators/
├── roles.decorator.ts   - @Roles('admin', 'super_admin')
├── current-user.decorator.ts - @CurrentUser() extracts user from request
└── public.decorator.ts  - @Public() skips auth guard
```

- [ ] `AuthGuard` - calls `auth.api.getSession({ headers: req.headers })`, attaches user to request
- [ ] `RolesGuard` - reads `@Roles()` decorator, checks `req.user.role` against allowed roles
- [ ] Apply `AuthGuard` globally, use `@Public()` to skip for public endpoints
- [ ] `@CurrentUser()` param decorator to get the authenticated user in controllers

### TODO 2.5 - Better Auth Endpoints (handled automatically)
Better Auth gives us these out of the box, no custom code needed:
- `POST /api/auth/sign-up/email` - register with email + password
- `POST /api/auth/sign-in/email` - login, returns session cookie
- `POST /api/auth/sign-out` - invalidate session
- `GET /api/auth/get-session` - get current session + user
- Session rotation + cookie management handled automatically

### TODO 2.6 - Client Setup (for admin portal)
```ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({ baseURL: "http://localhost:3000" });
```

### TODO 2.7 - Generate Better Auth Schema
- [ ] Run `npx auth@latest generate` to get the Drizzle schema for Better Auth tables
- [ ] Merge with our custom fields (role, phone, is_active) on the user table
- [ ] Run `drizzle-kit generate` and `drizzle-kit migrate`

---

## Phase 3: User Management

### TODO 3.1 - Users Module Structure
```
src/modules/users/
├── users.module.ts
├── users.controller.ts
├── users.service.ts
└── dto/
    ├── create-user.dto.ts
    ├── update-user.dto.ts
    └── user-response.dto.ts
```

### TODO 3.2 - User Endpoints
- [ ] `GET /users` - list all users (super_admin only), with pagination + filters (role, search)
- [ ] `GET /users/:id` - get user details (super_admin, or self)
- [ ] `PATCH /users/:id` - update user (super_admin can change role, user can change own name/phone)
- [ ] `DELETE /users/:id` - soft delete / deactivate (super_admin only)
- [ ] `PATCH /users/:id/role` - change user role (super_admin only)

### TODO 3.3 - Access Control Matrix

```
Endpoint                    | super_admin | admin | operator | vendor | attendee
----------------------------|-------------|-------|----------|--------|----------
GET /users                  |     ✓       |   ✗   |    ✗     |   ✗    |    ✗
GET /users/:id              |     ✓       | self  |  self    | self   |  self
PATCH /users/:id            |     ✓       | self  |  self    | self   |  self
DELETE /users/:id           |     ✓       |   ✗   |    ✗     |   ✗    |    ✗
PATCH /users/:id/role       |     ✓       |   ✗   |    ✗     |   ✗    |    ✗
POST /events                |     ✓       |   ✓   |    ✗     |   ✗    |    ✗
GET /events                 |     ✓       |  own  |assigned  |applied |    ✗
GET /events/:id             |     ✓       |  own  |assigned  |applied | has wallet
PATCH /events/:id           |     ✓       |  own  |    ✗     |   ✗    |    ✗
POST /events/:eid/members   |     ✓       |  own  |    ✗     |   ✗    |    ✗
GET /events/:eid/vendors    |     ✓       |  own  |assigned  | self   |    ✗
POST /events/:eid/vendors   |     ✓       |   ✓   |    ✗     |   ✓    |    ✗
PATCH /.../vendors/:id      |     ✓       |  own  |    ✗     |   ✗    |    ✗
GET /events/:eid/stats      |     ✓       |  own  |assigned  |   ✗    |    ✗
```

"own" = user is the organizer of that event or is in event_members
"assigned" = user is in event_members for that event
"self" = can only see/edit their own record

---

## Phase 4: Event Management

### TODO 4.1 - Events Module Structure
```
src/modules/events/
├── events.module.ts
├── events.controller.ts
├── events.service.ts
└── dto/
    ├── create-event.dto.ts
    ├── update-event.dto.ts
    ├── event-response.dto.ts
    └── event-query.dto.ts
```

### TODO 4.2 - Event Endpoints
- [ ] `POST /events` - create event (admin/super_admin)
- [ ] `GET /events` - list events (filtered by role, paginated)
- [ ] `GET /events/:id` - event details with stats summary
- [ ] `PATCH /events/:id` - update event config (only in draft/setup status)
- [ ] `PATCH /events/:id/status` - transition event lifecycle
- [ ] `DELETE /events/:id` - soft delete (only in draft status)

### TODO 4.3 - Event Lifecycle State Machine
```
draft -> setup -> active -> settlement -> closed
```

Transition rules:
- `draft -> setup`: event must have name, dates, token rate
- `setup -> active`: must have at least 1 approved vendor
- `active -> settlement`: event end_date must have passed (or manual override by admin)
- `settlement -> closed`: all sync data received, all balances reconciled
- Cannot go backwards
- Only organizer or super_admin can transition

### TODO 4.4 - Event Members (Team Management)
- [ ] `POST /events/:id/members` - invite staff to event (admin adds operators/co-admins)
- [ ] `GET /events/:id/members` - list event team
- [ ] `DELETE /events/:id/members/:userId` - remove team member
- [ ] Validate invited user exists and has the right global role

---

## Phase 5: Vendor Management

### TODO 5.1 - Vendors Module Structure
```
src/modules/vendors/
├── vendors.module.ts
├── vendors.controller.ts
├── vendors.service.ts
└── dto/
    ├── create-vendor.dto.ts
    ├── update-vendor.dto.ts
    ├── vendor-response.dto.ts
    └── vendor-query.dto.ts
```

### TODO 5.2 - Vendor Endpoints
- [ ] `POST /events/:eventId/vendors` - apply as vendor (or admin creates vendor)
- [ ] `GET /events/:eventId/vendors` - list vendors (admin: all, vendor: self only)
- [ ] `GET /events/:eventId/vendors/:id` - vendor details
- [ ] `PATCH /events/:eventId/vendors/:id` - update vendor info
- [ ] `PATCH /events/:eventId/vendors/:id/status` - approve/reject/suspend (admin only)
- [ ] `PATCH /events/:eventId/vendors/:id/commission` - set custom commission (admin only)
- [ ] `DELETE /events/:eventId/vendors/:id` - remove vendor (admin only, only if no transactions)

---

## Phase 6: Dashboard Stats (Read-only for now)

### TODO 6.1 - Stats Endpoints
- [ ] `GET /events/:eventId/dashboard` - aggregated event stats:
  - Total wallets created
  - Total vendors (by status)
  - Total devices (active/blocked)
  - Total tokens in circulation (sum of wallet balances)
  - Transaction volume (today / total)
  - Revenue by vendor (top 10)
  - Unresolved security alerts count
  - Devices not synced in >1 hour

---

## Phase 7: Database Best Practices

### TODO 7.1 - Postgres Performance Config
In the docker-compose postgres service, set via environment or custom config:
- `shared_buffers` = 256MB (for dev, 25% of RAM in prod)
- `effective_cache_size` = 768MB
- `work_mem` = 16MB
- `maintenance_work_mem` = 128MB
- `random_page_cost` = 1.1 (for SSD)

### TODO 7.2 - Connection Pooling
- Configure `postgres.js` (the driver) with sensible pool settings:
  - `max: 20` connections for dev
  - `idle_timeout: 30` seconds
  - `connect_timeout: 10` seconds
- Add a health check endpoint that pings the DB

### TODO 7.3 - Query Patterns
- All queries that touch tenant data MUST include `WHERE event_id = ?`
- Use transactions (`db.transaction()`) for multi-step operations:
  - Creating a vendor + updating audit log
  - Processing a topup (update wallet balance + create transaction)
- Use `FOR UPDATE` locks when updating wallet balances to prevent race conditions
- Consider partial indexes where useful (e.g. `WHERE resolved = false` on security_alerts)

### TODO 7.4 - Data Integrity Constraints
- [ ] CHECK constraint: `wallets.balance >= 0`
- [ ] CHECK constraint: `transactions.amount > 0`
- [ ] CHECK constraint: `events.start_date < events.end_date`
- [ ] CHECK constraint: `events.token_currency_rate > 0`
- [ ] CHECK constraint: `events.default_commission_rate >= 0 AND <= 100`
- [ ] Foreign key ON DELETE behavior:
  - users -> cascade to refresh_tokens
  - events -> restrict (don't delete events with data)
  - vendors -> restrict (don't delete vendors with transactions)

### TODO 7.5 - Soft Deletes vs Hard Deletes
- Users: soft delete via `is_active = false` + Better Auth's `admin` plugin ban feature, never hard delete
- Events: never delete, use lifecycle (closed)
- Vendors: soft delete via status (suspended), never hard delete once approved
- Transactions: NEVER delete, append-only
- Audit logs: NEVER delete, append-only
- Refresh tokens: hard delete on rotation/expiry (cleanup job)

### TODO 7.6 - Pagination
All list endpoints use cursor-based pagination (keyset pagination) for consistent performance:
```
GET /events?cursor=<last_id>&limit=20&sort=created_at:desc
```
Response includes `nextCursor` for the client to use.

### TODO 7.7 - Table Partitioning (future, when data grows)
Candidates for range partitioning by `created_at`:
- `transactions` - partition by month
- `audit_logs` - partition by month
- `sync_logs` - partition by month

Not needed now but design the schema so it is easy to add later.

---

## File Structure Summary

```
backend/
├── docker-compose.yml          (updated)
├── .env.example                (updated)
├── drizzle.config.ts           (already exists)
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── auth/
│   │   │   └── auth.ts              (Better Auth config)
│   │   ├── database/
│   │   │   ├── drizzle.module.ts
│   │   │   ├── drizzle.client.ts
│   │   │   ├── schemas/
│   │   │   │   ├── index.ts
│   │   │   │   ├── enums.ts
│   │   │   │   ├── auth.ts          (Better Auth tables: user, session, account, verification)
│   │   │   │   ├── events.ts
│   │   │   │   ├── event-members.ts
│   │   │   │   ├── vendors.ts
│   │   │   │   ├── devices.ts
│   │   │   │   ├── wallets.ts
│   │   │   │   ├── transactions.ts
│   │   │   │   ├── sync-logs.ts
│   │   │   │   ├── security-alerts.ts
│   │   │   │   └── audit-logs.ts
│   │   │   └── migrations/
│   │   ├── guards/
│   │   │   ├── auth.guard.ts        (validates Better Auth session)
│   │   │   └── roles.guard.ts
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   ├── current-user.decorator.ts
│   │   │   └── public.decorator.ts
│   │   └── ...existing config, types, etc.
│   └── modules/
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts   (catch-all for /api/auth/*)
│       │   └── auth.service.ts      (wraps auth.api for server-side calls)
│       ├── users/
│       │   ├── users.module.ts
│       │   ├── users.controller.ts
│       │   ├── users.service.ts
│       │   └── dto/
│       ├── events/
│       │   ├── events.module.ts
│       │   ├── events.controller.ts
│       │   ├── events.service.ts
│       │   └── dto/
│       └── vendors/
│           ├── vendors.module.ts
│           ├── vendors.controller.ts
│           ├── vendors.service.ts
│           └── dto/
```

---

## Implementation Order

1. **Phase 0** - Docker Compose + Drizzle scripts (get local dev running)
2. **Phase 1** - All database schemas + first migration (get tables in Postgres)
3. **Phase 2** - Auth module (register, login, JWT, guards)
4. **Phase 3** - Users module (CRUD, role management)
5. **Phase 4** - Events module (CRUD, lifecycle, team management)
6. **Phase 5** - Vendors module (applications, approval flow)
7. **Phase 6** - Dashboard stats endpoints
8. **Phase 7** - Apply DB best practices (pooling, constraints, pagination patterns)

Phases 0-1 should be done first as everything depends on them.
Phases 2-5 can be done incrementally, each one building on the previous.
Phases 6-7 are polish that can happen alongside or after the core modules.
