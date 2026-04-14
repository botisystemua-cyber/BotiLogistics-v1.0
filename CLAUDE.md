# BotiLogistics CRM v1.0

Universal logistics CRM system for passenger and cargo transportation (UA <-> EU).

## Architecture

```
Frontend (6 CRM apps)
    |
    |-- READ:  Supabase REST API / Google Sheets gviz (legacy)
    |-- WRITE: Supabase REST API / Google Apps Script (legacy)
    |
    v
Supabase PostgreSQL (primary DB, 37 tables)
Google Sheets (legacy, being migrated)
```

## CRM Modules

| Module | Stack | Description |
|--------|-------|-------------|
| `passenger-crm/` | Vanilla HTML + CSS + JS | Passenger management CRM |
| `cargo-crm/` | Vanilla HTML + CSS + JS | Cargo/parcel management CRM |
| `driver-crm/` | React 19 + TypeScript + Tailwind | Driver mobile app |
| `client-crm/` | React 19 + TypeScript + Tailwind | Customer portal |
| `owner-crm/` | React 19 + TypeScript + Tailwind | Owner admin panel |
| `config-crm/` | React 19 + TypeScript + Tailwind | Auth & system config |

## Backend (Legacy)

| File | Description |
|------|-------------|
| `backend/Passengers.gs` | Passenger CRUD (Google Apps Script) |
| `backend/Script-cargo.gs` | Cargo/parcel CRUD |
| `backend/Script-marshrut.gs` | Driver routes & expenses |
| `backend/Script-config.gs` | Authentication & config |

## Supabase (Primary Database)

### Connection Details

| Key | Value |
|-----|-------|
| **Project ID** | `pgdhuezxkehpjlxoesoe` |
| **Project URL** | `https://pgdhuezxkehpjlxoesoe.supabase.co` |
| **REST API** | `https://pgdhuezxkehpjlxoesoe.supabase.co/rest/v1/` |
| **Auth API** | `https://pgdhuezxkehpjlxoesoe.supabase.co/auth/v1/` |
| **Realtime** | `wss://pgdhuezxkehpjlxoesoe.supabase.co/realtime/v1/websocket` |
| **Storage** | `https://pgdhuezxkehpjlxoesoe.supabase.co/storage/v1/` |
| **Dashboard** | `https://supabase.com/dashboard/project/pgdhuezxkehpjlxoesoe` |

### API Keys

| Key | Value | Usage |
|-----|-------|-------|
| **anon (public)** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZGh1ZXp4a2VocGpseG9lc29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDcyNTYsImV4cCI6MjA4OTkyMzI1Nn0.qG8kFr2sTuat4vhQ7NikGaXIa57YAT21ABZ8Q8gkRXg` | Frontend (respects RLS) |
| **service_role** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZGh1ZXp4a2VocGpseG9lc29lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NzI1NiwiZXhwIjoyMDg5OTIzMjU2fQ.CSIz47_OZKNwleOP63N6gX2bIfT4fYEy0HmZf0qA7lE` | Backend only (bypasses RLS) |
| **publishable** | `sb_publishable__8v30kWNQ9qwwccUfb-IcA_x4WoNioX` | Framework integration |

### Database Schema (37 tables)

#### Core Entities
| Table | Columns | Description |
|-------|---------|-------------|
| `passengers` | 40 | Passenger bookings & lead management |
| `packages` | 60 | Parcel/cargo shipments |
| `routes` | 48 | Route assignments (passengers + packages) |
| `dispatches` | 28 | Package dispatch records |
| `calendar` | 17 | Trip/flight schedule with seat availability |
| `seating` | 21 | Seat reservations per vehicle |

#### Users & Access
| Table | Columns | Description |
|-------|---------|-------------|
| `users` | 12 | System users (managers, admins) |
| `staff` | 19 | Staff/driver directory |
| `clients` | 6 | Tenants (multi-tenant via `tenant_id`) |
| `clients_directory` | - | Client contact directory |
| `client_app_access` | - | Client portal access control |
| `access_logs` | - | Authentication audit log |

#### Finance
| Table | Columns | Description |
|-------|---------|-------------|
| `payments` | 21 | Payment records |
| `expenses` | 29 | Driver expenses (fuel, meals, tolls, etc.) |
| `financial_summary` | - | Financial reporting |
| `profit_distribution` | - | Profit sharing |
| `distribution_template` | - | Profit distribution templates |

#### Client-Facing
| Table | Columns | Description |
|-------|---------|-------------|
| `bookings` | 25 | Client booking requests |
| `orders` | 23 | Client parcel orders |
| `messages` | 12 | Chat messages |
| `reviews` | - | Client reviews |
| `client_ratings` | - | Rating aggregations |
| `notifications` | 16 | SMS/push notification log |

#### Vehicles
| Table | Columns | Description |
|-------|---------|-------------|
| `vehicles` | 18 | Fleet (type, seats, prices per currency) |

#### Archive & Audit
| Table | Columns | Description |
|-------|---------|-------------|
| `archive_passengers` | 34 | Soft-deleted passengers |
| `archive_packages` | 29 | Soft-deleted packages |
| `archive_clients` | - | Soft-deleted clients |
| `archive_finances` | - | Archived financial records |
| `archive_routes` | - | Archived routes |
| `audit_logs` | - | System audit trail |
| `change_logs` | - | Field-level change history |

#### System
| Table | Columns | Description |
|-------|---------|-------------|
| `system_settings` | 11 | App configuration |
| `app_content` | - | CMS content |
| `owner_account` | - | Owner profile |
| `package_photos` | - | Package photo storage refs |
| `password_resets` | - | Password reset tokens |
| `route_access` | - | Route-level permissions |

### Key Design Patterns

- **Multi-tenant**: All tables have `tenant_id` FK to `clients.tenant_id`
- **Soft delete**: Archive tables preserve deleted records with metadata
- **Multi-currency**: UAH, EUR, CHF, PLN, CZK, USD
- **Bi-directional routes**: UA -> EU and EU -> UA

### Database migrations (for Claude / automation)

**Запускай DDL сам — не проси користувача.** У БД є RPC `public.exec_sql(query text)`,
доступна лише `service_role`. Використовуй її для `ALTER TABLE`, `CREATE INDEX`,
`CREATE FUNCTION` тощо.

```bash
curl -sS -X POST \
  "https://pgdhuezxkehpjlxoesoe.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  --data '{"query":"ALTER TABLE passengers ADD COLUMN example text;"}'
```

Відповідь: `{"ok": true, "rows_affected": N}` або `{"ok": false, "error": "...", "sqlstate": "..."}`.

- Ключ `service_role` — у таблиці API Keys вище.
- Якщо RPC повертає `404 PGRST202` — функцію ще не створено, запусти
  `sql/2026-04-setup-exec-sql-rpc.sql` у Dashboard → SQL Editor **раз**.
- Для SELECT-звітів усередині SQL використовуй звичайний PostgREST
  (`/rest/v1/<table>?select=...`), а не `exec_sql` — вона повертає лише статус.

## Legacy API Endpoints (Google Apps Script)

| Endpoint | Backend |
|----------|---------|
| Passengers API | `https://script.google.com/macros/s/AKfycbw3YQqn3-iyyxwbsAdgfeaj3bV1ik5cobb9D-hVftqmrSISwCSQDUZrhPW8yELvSXFy/exec` |
| Routes API | `https://script.google.com/macros/s/AKfycbx8ew1K34h8WMy-mAk8HBIuJ28rZmPOxSyBUDZLj9HKbEwU6fAW35OtHsKufYSHqariOw/exec` |

## Dev Setup

```bash
# React apps (driver-crm, client-crm, owner-crm, config-crm)
cd <module-name>
npm install
npm run dev      # Vite dev server
npm run build    # Production build
npm run lint     # ESLint
```

## Test Data

`sheets/` directory contains test data in xlsx format:
- `Passengers_Test.xlsx`
- `Cargo_Test.xlsx`
- `Config_Test.xlsx`
- `Marhrut_Test.xlsx`
- `Clients_Test.xlsx`
