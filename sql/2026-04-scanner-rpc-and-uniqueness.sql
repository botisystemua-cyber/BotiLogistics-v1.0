-- 2026-04-18 — Scanner overhaul #2: UNIQUE TTN + single scan_ttn RPC + legacy
-- quality_check_required → GENERATED column derived from scan_status.
--
-- WHY
-- ---
-- 1. `packages.ttn_number` has no UNIQUE constraint, so the scanner's
--    `processUnknown` path could happily create two stub rows for the same
--    TTN (PKG{timestamp} + PKG{timestamp+N}).  The audit showed 0 duplicates
--    right now, so we can safely add a deferred-unsafe UNIQUE index.
--
-- 2. Scan-transition logic lives in TWO places — `cargo-crm/scaner_ttn.html`
--    and `cargo-crm/supabase-api.js :: sbScanTTN`.  We move the state machine
--    into a single PL/pgSQL function `public.scan_ttn(...)`; both clients
--    become thin wrappers that just call it.  Bonus: SELECT ... FOR UPDATE
--    inside the function kills the race-condition we worried about.
--
-- 3. `quality_check_required` (legacy text column) is read by cargo-crm in
--    ~30 places (filters, badges, counters).  Instead of touching every call
--    site, we turn it into a GENERATED column computed from `scan_status`.
--    Writers must now write to `scan_status`; readers see the old values
--    unchanged.  `updateField` for "Контроль перевірки" is translated to
--    scan_status on the API layer.
--
-- STATES
-- ------
-- scan_status now has 8 values (was 7): we add `rejected` so the old
-- "Відхилено" verdict has a home.  No data loss: we backfill from the legacy
-- text column before dropping it.

BEGIN;

-- ─── 1a. Allow NULL `to_status` in scan log (rejected miss-scans) ─────────
-- Previous migration marked it NOT NULL, but when an unknown TTN is scanned
-- in handout mode we have no destination status to write — the old scanner
-- just swallowed the FK error via fire-and-forget.
ALTER TABLE public.package_scan_log
  ALTER COLUMN to_status DROP NOT NULL;

-- ─── 1b. Extend CHECK to include `rejected` ────────────────────────────────
ALTER TABLE public.packages
  DROP CONSTRAINT IF EXISTS packages_scan_status_chk;

ALTER TABLE public.packages
  ADD CONSTRAINT packages_scan_status_chk
  CHECK (scan_status IS NULL OR scan_status IN (
    'received',        -- прийнято на склад відправника
    'checked',         -- перевірено (якість/вага)
    'awaiting_route',  -- чекає на рейс
    'loaded',          -- завантажено в бус
    'in_transit',      -- в дорозі
    'arrived',         -- прибуло на склад призначення
    'delivered',       -- видано одержувачу
    'rejected'         -- відхилено при перевірці
  ));

-- ─── 2. Backfill scan_status from legacy quality_check_required ────────────
-- Only promote if scan_status still matches the implicit state.  We never
-- overwrite a "later" status (e.g. 'delivered') with a "earlier" one.
UPDATE public.packages
   SET scan_status = 'checked'
 WHERE is_archived = false
   AND quality_check_required = 'В перевірці'
   AND (scan_status IS NULL OR scan_status = 'received');

UPDATE public.packages
   SET scan_status = 'awaiting_route'
 WHERE is_archived = false
   AND quality_check_required = 'Готова до маршруту'
   AND scan_status IN ('received', 'checked');

UPDATE public.packages
   SET scan_status = 'rejected'
 WHERE is_archived = false
   AND quality_check_required = 'Відхилено'
   AND scan_status IS DISTINCT FROM 'delivered';

-- ─── 3. UNIQUE on (tenant_id, ttn_number) for active rows ──────────────────
-- Partial index: archived rows and blank TTNs are excluded.  Rationale:
-- archive is allowed to hold historical duplicates; blanks are legitimate
-- for brand-new leads awaiting registration.
CREATE UNIQUE INDEX IF NOT EXISTS packages_ttn_unique_active_idx
  ON public.packages (tenant_id, ttn_number)
  WHERE is_archived = false
    AND ttn_number IS NOT NULL
    AND ttn_number <> '';

-- ─── 4. Swap `quality_check_required` → GENERATED from scan_status ─────────
-- The column was plain text before.  We drop it and re-add as STORED
-- generated so that all existing `SELECT quality_check_required` paths
-- keep working, but no client can write to it (writes must go via
-- scan_status — enforced by Postgres itself).
ALTER TABLE public.packages
  DROP COLUMN IF EXISTS quality_check_required;

ALTER TABLE public.packages
  ADD COLUMN quality_check_required text
  GENERATED ALWAYS AS (
    CASE scan_status
      WHEN 'checked'        THEN 'В перевірці'
      WHEN 'awaiting_route' THEN 'Готова до маршруту'
      WHEN 'rejected'       THEN 'Відхилено'
      ELSE NULL
    END
  ) STORED;

COMMENT ON COLUMN public.packages.quality_check_required IS
  'DEPRECATED read-only view of scan_status. Do not write — update scan_status instead.';

-- ─── 5. scan_ttn RPC — single source of truth for the state machine ───────
-- Signature returns jsonb so clients don't need to know column list.
-- Outcomes:
--   {ok:true, type:'found',   pkg_id, status, sender_name, recipient_name}
--   {ok:true, type:'already', pkg_id, status, sender_name, recipient_name}
--   {ok:true, type:'new',     pkg_id, status}                          (intake only)
--   {ok:false, error:'...reason...', status:<current>}
--
-- Side effects:
--   • UPDATE packages.scan_status (+ updated_at)
--   • INSERT package_scan_log (mode, from_status, to_status, outcome, …)
--   • INSERT packages (intake + unknown TTN) — guarded by UNIQUE index
--
-- SECURITY DEFINER so the anon key used by the browser can invoke it, but
-- the function pins tenant_id from the parameter and validates inputs.

DROP FUNCTION IF EXISTS public.scan_ttn(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.scan_ttn(
    p_tenant_id text,
    p_ttn       text,
    p_mode      text,
    p_direction text,
    p_user      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_ttn          text := btrim(coalesce(p_ttn, ''));
    v_row          public.packages%rowtype;
    v_next_status  text;
    v_reject_msg   text;
    v_pkg_id       text;
    v_now          timestamptz := now();
BEGIN
    -- ── 0. input validation ────────────────────────────────────────────────
    IF p_tenant_id IS NULL OR p_tenant_id = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'tenant_id обов''язковий');
    END IF;
    IF v_ttn = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ТТН не вказано');
    END IF;
    IF p_mode NOT IN ('intake','handout') THEN
        RETURN jsonb_build_object('ok', false,
            'error', 'Режим підтримується лише: intake, handout');
    END IF;
    IF p_direction IS NOT NULL
       AND p_direction NOT IN ('UA_EU','EU_UA') THEN
        RETURN jsonb_build_object('ok', false,
            'error', 'Напрям має бути UA_EU або EU_UA');
    END IF;

    -- ── 1. locked lookup ───────────────────────────────────────────────────
    SELECT * INTO v_row
      FROM public.packages
     WHERE tenant_id  = p_tenant_id
       AND ttn_number = v_ttn
       AND is_archived = false
     ORDER BY created_at
     LIMIT 1
     FOR UPDATE;

    -- ── 2. existing package — transition or acknowledge ────────────────────
    IF FOUND THEN
        IF p_mode = 'intake' THEN
            -- intake: push from {null, received} → checked; else "already"
            IF v_row.scan_status IS NULL OR v_row.scan_status = 'received' THEN
                v_next_status := 'checked';
            ELSE
                -- anything past 'received' — just acknowledge, don't move
                INSERT INTO public.package_scan_log
                    (tenant_id, pkg_id, ttn_number, scanned_by, mode, direction,
                     from_status, to_status, outcome)
                VALUES
                    (p_tenant_id, v_row.pkg_id, v_ttn, p_user, p_mode, p_direction,
                     v_row.scan_status, v_row.scan_status, 'already');
                RETURN jsonb_build_object(
                    'ok', true, 'type', 'already',
                    'pkg_id', v_row.pkg_id,
                    'status', v_row.scan_status,
                    'sender_name', v_row.sender_name,
                    'recipient_name', v_row.recipient_name
                );
            END IF;
        ELSE  -- handout
            IF v_row.scan_status IN ('loaded','in_transit','arrived') THEN
                v_next_status := 'delivered';
            ELSIF v_row.scan_status = 'delivered' THEN
                INSERT INTO public.package_scan_log
                    (tenant_id, pkg_id, ttn_number, scanned_by, mode, direction,
                     from_status, to_status, outcome)
                VALUES
                    (p_tenant_id, v_row.pkg_id, v_ttn, p_user, p_mode, p_direction,
                     v_row.scan_status, v_row.scan_status, 'already');
                RETURN jsonb_build_object(
                    'ok', true, 'type', 'already',
                    'pkg_id', v_row.pkg_id,
                    'status', v_row.scan_status,
                    'sender_name', v_row.sender_name,
                    'recipient_name', v_row.recipient_name
                );
            ELSE
                v_reject_msg := 'Посилка ще не була завантажена в рейс';
                INSERT INTO public.package_scan_log
                    (tenant_id, pkg_id, ttn_number, scanned_by, mode, direction,
                     from_status, to_status, outcome, reject_reason)
                VALUES
                    (p_tenant_id, v_row.pkg_id, v_ttn, p_user, p_mode, p_direction,
                     v_row.scan_status, v_row.scan_status, 'rejected', v_reject_msg);
                RETURN jsonb_build_object(
                    'ok', false,
                    'error', v_reject_msg,
                    'status', v_row.scan_status
                );
            END IF;
        END IF;

        UPDATE public.packages
           SET scan_status = v_next_status,
               updated_at  = v_now
         WHERE pkg_id = v_row.pkg_id
           AND tenant_id = p_tenant_id;

        INSERT INTO public.package_scan_log
            (tenant_id, pkg_id, ttn_number, scanned_by, mode, direction,
             from_status, to_status, outcome)
        VALUES
            (p_tenant_id, v_row.pkg_id, v_ttn, p_user, p_mode, p_direction,
             v_row.scan_status, v_next_status, 'updated');

        RETURN jsonb_build_object(
            'ok', true, 'type', 'found',
            'pkg_id', v_row.pkg_id,
            'status', v_next_status,
            'sender_name', v_row.sender_name,
            'recipient_name', v_row.recipient_name
        );
    END IF;

    -- ── 3. not found ───────────────────────────────────────────────────────
    IF p_mode <> 'intake' THEN
        INSERT INTO public.package_scan_log
            (tenant_id, pkg_id, ttn_number, scanned_by, mode, direction,
             from_status, to_status, outcome, reject_reason)
        VALUES
            (p_tenant_id, NULL, v_ttn, p_user, p_mode, p_direction,
             NULL, NULL, 'rejected', 'ТТН не знайдено в системі');
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'ТТН не знайдено. У режимі "Видача" створення заборонено.'
        );
    END IF;

    -- intake + unknown: create a stub.  UNIQUE index guards against double-tap.
    v_pkg_id := 'PKG' || (extract(epoch from v_now) * 1000)::bigint::text;
    BEGIN
        INSERT INTO public.packages (
            pkg_id, tenant_id, direction,
            created_at, updated_at,
            ttn_number, lead_status, crm_status, is_archived,
            scan_status, quality_checked_at,
            sender_name, sender_phone, sender_address,
            recipient_name, recipient_phone, recipient_address
        ) VALUES (
            v_pkg_id, p_tenant_id, p_direction,
            v_now, v_now,
            v_ttn, 'unknown', 'active', false,
            'received', v_now,
            '', '', '',
            '', '', ''
        );
    EXCEPTION WHEN unique_violation THEN
        -- Another session just inserted same (tenant_id, ttn_number).
        -- Re-read and acknowledge as 'already'.
        SELECT * INTO v_row
          FROM public.packages
         WHERE tenant_id = p_tenant_id
           AND ttn_number = v_ttn
           AND is_archived = false
         LIMIT 1;
        INSERT INTO public.package_scan_log
            (tenant_id, pkg_id, ttn_number, scanned_by, mode, direction,
             from_status, to_status, outcome)
        VALUES
            (p_tenant_id, v_row.pkg_id, v_ttn, p_user, p_mode, p_direction,
             v_row.scan_status, v_row.scan_status, 'already');
        RETURN jsonb_build_object(
            'ok', true, 'type', 'already',
            'pkg_id', v_row.pkg_id,
            'status', v_row.scan_status,
            'sender_name', v_row.sender_name,
            'recipient_name', v_row.recipient_name
        );
    END;

    INSERT INTO public.package_scan_log
        (tenant_id, pkg_id, ttn_number, scanned_by, mode, direction,
         from_status, to_status, outcome)
    VALUES
        (p_tenant_id, v_pkg_id, v_ttn, p_user, p_mode, p_direction,
         NULL, 'received', 'created');

    RETURN jsonb_build_object(
        'ok', true, 'type', 'new',
        'pkg_id', v_pkg_id,
        'status', 'received'
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.scan_ttn(text,text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.scan_ttn(text,text,text,text,text)
    TO anon, authenticated, service_role;

COMMIT;

-- Reload PostgREST schema cache so the new RPC is callable immediately.
NOTIFY pgrst, 'reload schema';
