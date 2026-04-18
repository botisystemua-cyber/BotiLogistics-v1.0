-- Cargo scanner overhaul — features 1/3/6/10 from the roadmap.
-- Feature 2 (route binding) is intentionally deferred until cargo routes
-- migrate from Google Apps Script to Supabase.
--
-- What this migration does:
--   1. Adds `packages.scan_status` — a proper 7-state machine that replaces
--      the ad-hoc `quality_check_required` string.
--   2. Creates `package_scan_log` — an append-only audit trail: who, when,
--      what mode, what direction, old→new status, per scan.
--   3. Normalizes `packages.direction` to two canonical codes (`UA_EU`,
--      `EU_UA`). Legacy string 'Україна-ЄВ' is backfilled to 'UA_EU'.
--
-- `quality_check_required` stays as-is (deprecated). We don't migrate its
-- values into `scan_status` because management may want to roll this back.

-- ─── 1. scan_status ────────────────────────────────────────────────────────
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS scan_status text;

-- Soft CHECK via trigger-less constraint: any of the 7 states, or NULL.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'packages_scan_status_chk'
  ) THEN
    ALTER TABLE public.packages
      ADD CONSTRAINT packages_scan_status_chk
      CHECK (scan_status IS NULL OR scan_status IN (
        'received',        -- прийнято на складі відправника
        'checked',         -- перевірено (якість/вага)
        'awaiting_route',  -- чекає на рейс
        'loaded',          -- завантажено в бус (режим, що прийде з міграцією маршрутів)
        'in_transit',      -- в дорозі
        'arrived',         -- прибуло на склад призначення
        'delivered'        -- видано одержувачу
      ));
  END IF;
END $$;

-- Backfill: any non-archived row without scan_status gets 'received'.
-- We do NOT promote 'В перевірці' → 'checked' — legacy column stays untouched
-- so that if scanner rollback is needed, we revert with one UI swap.
UPDATE public.packages
   SET scan_status = 'received'
 WHERE scan_status IS NULL
   AND is_archived = false;

-- ─── 2. direction normalization ────────────────────────────────────────────
-- Old: 'Україна-ЄВ' (cyrillic, mixed case), hardcoded in old scaner_ttn.html.
-- New: 'UA_EU', 'EU_UA' — short ASCII codes friendly to URLs/filters.
UPDATE public.packages
   SET direction = 'UA_EU'
 WHERE direction = 'Україна-ЄВ' OR direction = 'Україна-ЄС' OR direction = 'УК→ЄВ';

UPDATE public.packages
   SET direction = 'EU_UA'
 WHERE direction = 'ЄВ-Україна' OR direction = 'ЄС-Україна' OR direction = 'ЄВ→УК';

-- ─── 3. package_scan_log ───────────────────────────────────────────────────
-- Append-only audit. One row per successful scan event.
-- `pkg_id` / `ttn_number` are copied (not FK'd) so log rows survive package
-- deletion — auditors may still want to see "this TTN was scanned yesterday".
CREATE TABLE IF NOT EXISTS public.package_scan_log (
  id            bigserial PRIMARY KEY,
  tenant_id     text NOT NULL,
  pkg_id        text,                          -- may be null for miss-scans
  ttn_number    text NOT NULL,
  scanned_by    text NOT NULL,                 -- users.login
  scanned_at    timestamptz NOT NULL DEFAULT now(),
  mode          text NOT NULL
    CHECK (mode IN ('intake','load','handout')),
  direction     text
    CHECK (direction IN ('UA_EU','EU_UA') OR direction IS NULL),
  route_name    text,                           -- free-text, null until routes migrate
  from_status   text,                           -- nullable: brand-new package
  to_status     text NOT NULL,
  outcome       text NOT NULL                   -- 'created' | 'updated' | 'already' | 'rejected'
    CHECK (outcome IN ('created','updated','already','rejected')),
  reject_reason text,                           -- filled only when outcome='rejected'
  user_agent    text
);

CREATE INDEX IF NOT EXISTS package_scan_log_tenant_time_idx
  ON public.package_scan_log (tenant_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS package_scan_log_pkg_idx
  ON public.package_scan_log (tenant_id, pkg_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS package_scan_log_ttn_idx
  ON public.package_scan_log (tenant_id, ttn_number, scanned_at DESC);

-- Let anon role (used by browser Supabase JS client) append + read its own
-- tenant's logs. RLS stays off system-wide on this project, same as packages.
GRANT SELECT, INSERT ON public.package_scan_log TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.package_scan_log_id_seq TO anon, authenticated, service_role;

-- ─── 4. helper index for scanner hot-path ─────────────────────────────────
-- Scanner looks up by (tenant_id, ttn_number, is_archived=false) on every beep.
CREATE INDEX IF NOT EXISTS packages_scanner_lookup_idx
  ON public.packages (tenant_id, ttn_number)
  WHERE is_archived = false;
