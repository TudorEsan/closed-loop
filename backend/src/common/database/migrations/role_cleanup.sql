-- Manual upgrade script. Run once with psql against the target database
-- before deploying the new code:
--
--   psql "$DATABASE_URL" -f src/common/database/migrations/role_cleanup.sql
--
-- The project uses drizzle-kit `db:push` and does not keep a generated
-- migration history, so the enum changes need this script to preserve rows.
-- After running it, `npm run db:push` will be a no-op for these tables.
--
-- Collapse roles to a clean two-layer model:
--   * users.role: super_admin | user
--   * event_members.role: admin | operator
--
-- Per-event/per-vendor authority lives in eventMembers / vendorMembers, not on
-- the users table. The previous global values (admin, operator, vendor,
-- attendee) all collapse to "user". The previous event_members.role
-- "organizer" collapses to "admin" (the explicit organizerId column on events
-- still marks the creator).

BEGIN;

-- ---- users.role ----------------------------------------------------------

ALTER TABLE "user" ALTER COLUMN role DROP DEFAULT;

ALTER TYPE user_role RENAME TO user_role_old;

CREATE TYPE user_role AS ENUM ('super_admin', 'user');

ALTER TABLE "user"
  ALTER COLUMN role TYPE user_role
  USING (
    CASE role::text
      WHEN 'super_admin' THEN 'super_admin'::user_role
      ELSE 'user'::user_role
    END
  );

ALTER TABLE "user" ALTER COLUMN role SET DEFAULT 'user';

DROP TYPE user_role_old;

-- ---- event_members.role --------------------------------------------------

-- "organizer" collapses to "admin"; eventS.organizer_id is the source of truth
-- for the event creator and is treated as an implicit admin by ScopeService.
ALTER TYPE event_member_role RENAME TO event_member_role_old;

CREATE TYPE event_member_role AS ENUM ('admin', 'operator');

ALTER TABLE event_members
  ALTER COLUMN role TYPE event_member_role
  USING (
    CASE role::text
      WHEN 'organizer' THEN 'admin'::event_member_role
      WHEN 'admin' THEN 'admin'::event_member_role
      ELSE 'operator'::event_member_role
    END
  );

DROP TYPE event_member_role_old;

COMMIT;
