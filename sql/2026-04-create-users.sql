-- Adapt existing `users` table for login/password authentication.
-- Existing schema already has: id, tenant_id, email, phone, full_name, role,
--   password_hash, api_token, is_active, last_login, created_at, updated_at.
-- We add `login` (slug) and `password` (plain — security off per project decision).
-- Idempotent. Safe to run multiple times.

alter table users add column if not exists login text;
alter table users add column if not exists password text;

-- Backfill existing rows: derive login from email local-part, default password
update users set login = split_part(email, '@', 1) where login is null and email is not null;
update users set password = 'changeme123' where password is null;

create unique index if not exists users_login_key on users (login);
create index if not exists users_tenant_role_idx on users (tenant_id, role);

grant all on users to anon, authenticated, service_role;
alter table users disable row level security;

-- Seed test users for gresco
insert into users (tenant_id, login, password, role, full_name, email, is_active) values
  ('gresco', 'oleg',   'oleg123',   'manager', 'Олег Іванов',  'oleg@gresco.com',   true),
  ('gresco', 'serhii', 'serhii123', 'driver',  'Сергій Петров','serhii@gresco.com', true),
  ('gresco', 'ivan',   'ivan123',   'owner',   'Іван Гресько', 'ivan@gresco.com',   true)
on conflict (login) do nothing;
