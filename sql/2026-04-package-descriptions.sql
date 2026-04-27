-- ================================================================
-- Cargo CRM: каталог стандартних описів посилок (per-tenant)
-- ================================================================
-- Owner-керований список описів вмісту посилок ("Документи", "Одяг",
-- "Електроніка"...). Використовується як автопідказки в cargo-crm
-- при створенні нової посилки (поля fDescription / fill_description).
-- Дзайн дублює passenger_route_points: tenant_id (TEXT), sort_order.
-- Засів дефолтів робиться клієнтом owner-crm при першому відкритті
-- панелі для тенанта (PackageDescriptionsPanel.tsx -> seedDefaults).
--
-- Запуск:
--   psql <connstr> -f 2026-04-package-descriptions.sql
-- Ідемпотентний (CREATE TABLE IF NOT EXISTS).
-- ================================================================

CREATE TABLE IF NOT EXISTS package_descriptions (
    id          BIGSERIAL    PRIMARY KEY,
    tenant_id   TEXT         NOT NULL,
    text        VARCHAR(200) NOT NULL,
    sort_order  INTEGER      NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, text)
);

CREATE INDEX IF NOT EXISTS idx_pkg_descr_tenant
    ON package_descriptions (tenant_id, sort_order);

-- ================================================================
-- GRANTS + RLS: узгоджено з іншими таблицями проєкту
-- ================================================================
GRANT ALL ON package_descriptions TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE package_descriptions_id_seq TO anon, authenticated, service_role;
ALTER TABLE package_descriptions DISABLE ROW LEVEL SECURITY;

-- Перезавантажити кеш схеми PostgREST для негайної доступності через /rest/v1
NOTIFY pgrst, 'reload schema';
