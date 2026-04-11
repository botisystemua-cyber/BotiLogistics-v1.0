-- Migrate users.role (text, single) → users.roles (text[], multi).
-- A user can now have multiple roles simultaneously, e.g. ['owner','driver']
-- for a small-company founder who also drives. The old `role` column is
-- kept in parallel as a read-only mirror so we can safely roll back during
-- the MVP phase. A future migration will drop it once we're confident.
--
-- Idempotent: safe to re-run.

-- 1. Add the new column if it doesn't exist.
alter table users add column if not exists roles text[];

-- 2. Backfill from the old column for any rows that don't have roles yet.
--    Wraps each existing single-role value into a 1-element array.
update users
   set roles = array[role]
 where roles is null
   and role is not null;

-- 3. Default for any future row that doesn't specify roles explicitly.
alter table users alter column roles set default '{driver}';

-- 4. Enforce: at least one role, and only the three known values.
--    Drop any prior version of the constraint first (for idempotency).
alter table users drop constraint if exists users_roles_check;
alter table users add constraint users_roles_check
  check (
    roles is not null
    and array_length(roles, 1) >= 1
    and roles <@ array['owner','manager','driver']::text[]
  );

-- 5. GIN index so `.contains()` / `@>` lookups stay fast as the table grows.
create index if not exists users_roles_gin on users using gin (roles);

-- 6. NOT NULL. We do this last so the CHECK above catches any stragglers
--    before we lock it down.
alter table users alter column roles set not null;
