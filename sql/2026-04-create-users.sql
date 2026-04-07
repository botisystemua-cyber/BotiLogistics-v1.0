-- Users table: per-person login/password/role within a company (tenant).
-- Replaces GAS-based authentication.
-- Safe to run multiple times.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  login text not null,
  password text not null,
  role text not null check (role in ('owner', 'manager', 'driver')),
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Login must be globally unique (one person, one login)
create unique index if not exists users_login_key on users (login);
-- Common lookup: by tenant + role
create index if not exists users_tenant_role_idx on users (tenant_id, role);

-- Open access for the demo (no RLS, like the rest of the project)
grant all on users to anon, authenticated, service_role;
alter table users disable row level security;

-- Seed: create a manager and a driver for gresco for testing
insert into users (tenant_id, login, password, role, full_name)
values
  ('gresco', 'oleg',    'oleg123',    'manager', 'Олег Іванов'),
  ('gresco', 'serhii',  'serhii123',  'driver',  'Сергій Петров'),
  ('gresco', 'ivan',    'ivan123',    'owner',   'Іван Гресько')
on conflict (login) do nothing;
