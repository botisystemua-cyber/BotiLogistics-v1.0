-- 2026-04-18 — Scanner UX overhaul #3
--
-- After first rollout we learned that operators don't actually need to pick
-- "intake" vs "handout" — the system can infer the transition from the
-- package's current scan_status. The scanner becomes one-click "Scan"; the
-- RPC figures out what that scan means:
--
--   current status           →  next status    mode logged
--   ─────────────────────────────────────────────────────────
--   (not in DB)              →  received      intake  (created)
--   null / 'received'        →  'checked'     intake  (updated)
--   'checked'                →  'delivered'   handout (updated)
--   'awaiting_route'         →  'delivered'   handout (updated)
--   'loaded' / 'in_transit'  →  'delivered'   handout (updated)
--   'arrived'                →  'delivered'   handout (updated)
--   'delivered'              →  stays         handout (already)
--   'rejected'               →  stays         intake  (rejected)
--
-- The RPC signature gains `payment_status`, `total_amount`, `deposit`, `debt`,
-- `item_count` in its jsonb result so the scanner UI can show payment info
-- and pre-fill the box-count modal without a second round-trip.
--
-- We also add `peek_ttn(...)` — read-only twin for the Check mode. It does
-- not touch scan_status and, per product decision, does NOT log to
-- package_scan_log either.

BEGIN;

-- ─── 1. Replace scan_ttn with auto-mode version ────────────────────────────
DROP FUNCTION IF EXISTS public.scan_ttn(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.scan_ttn(
    p_tenant_id text,
    p_ttn       text,
    p_direction text,
    p_user      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_ttn         text := btrim(coalesce(p_ttn, ''));
    v_row         public.packages%rowtype;
    v_next_status text;
    v_mode        text;  -- value written into package_scan_log.mode
    v_outcome     text;
    v_pkg_id      text;
    v_now         timestamptz := now();
    v_total       numeric;
    v_deposit     numeric;
    v_debt        numeric;
BEGIN
    IF p_tenant_id IS NULL OR p_tenant_id = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'tenant_id обов''язковий');
    END IF;
    IF v_ttn = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ТТН не вказано');
    END IF;
    IF p_direction IS NOT NULL AND p_direction NOT IN ('UA_EU','EU_UA') THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Напрям має бути UA_EU або EU_UA');
    END IF;

    SELECT * INTO v_row
      FROM public.packages
     WHERE tenant_id  = p_tenant_id
       AND ttn_number = v_ttn
       AND is_archived = false
     ORDER BY created_at
     LIMIT 1
     FOR UPDATE;

    -- ── 2a. Unknown TTN → intake-create ───────────────────────────────────
    IF NOT FOUND THEN
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
            -- Concurrent create; re-read and acknowledge as `already`.
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
                (p_tenant_id, v_row.pkg_id, v_ttn, p_user, 'intake', p_direction,
                 v_row.scan_status, v_row.scan_status, 'already');
            RETURN jsonb_build_object(
                'ok', true, 'type', 'already',
                'pkg_id', v_row.pkg_id,
                'status', v_row.scan_status,
                'item_count', v_row.item_count,
                'payment_status', v_row.payment_status,
                'total_amount', v_row.total_amount,
                'deposit', v_row.deposit,
                'debt', greatest(0, coalesce(v_row.total_amount,0) - coalesce(v_row.deposit,0))
            );
        END;

        INSERT INTO public.package_scan_log
            (tenant_id, pkg_id, ttn_number, scanned_by, mode, direction,
             from_status, to_status, outcome)
        VALUES
            (p_tenant_id, v_pkg_id, v_ttn, p_user, 'intake', p_direction,
             NULL, 'received', 'created');

        RETURN jsonb_build_object(
            'ok', true, 'type', 'new',
            'pkg_id', v_pkg_id,
            'status', 'received',
            'item_count', NULL,
            'payment_status', NULL,
            'total_amount', NULL,
            'deposit', NULL,
            'debt', 0
        );
    END IF;

    -- ── 2b. Existing package → auto-transition ────────────────────────────
    CASE
        WHEN v_row.scan_status IS NULL OR v_row.scan_status = 'received' THEN
            v_next_status := 'checked';
            v_mode := 'intake';
            v_outcome := 'updated';
        WHEN v_row.scan_status IN ('checked','awaiting_route','loaded','in_transit','arrived') THEN
            v_next_status := 'delivered';
            v_mode := 'handout';
            v_outcome := 'updated';
        WHEN v_row.scan_status = 'delivered' THEN
            v_next_status := 'delivered';
            v_mode := 'handout';
            v_outcome := 'already';
        WHEN v_row.scan_status = 'rejected' THEN
            v_next_status := 'rejected';
            v_mode := 'intake';
            v_outcome := 'rejected';
        ELSE
            v_next_status := v_row.scan_status;
            v_mode := 'intake';
            v_outcome := 'already';
    END CASE;

    -- Only write when status actually changes (no-op UPDATE still touches
    -- updated_at, which pollutes audit trails).
    IF v_outcome = 'updated' THEN
        UPDATE public.packages
           SET scan_status = v_next_status,
               updated_at  = v_now
         WHERE pkg_id = v_row.pkg_id
           AND tenant_id = p_tenant_id;
    END IF;

    INSERT INTO public.package_scan_log
        (tenant_id, pkg_id, ttn_number, scanned_by, mode, direction,
         from_status, to_status, outcome, reject_reason)
    VALUES
        (p_tenant_id, v_row.pkg_id, v_ttn, p_user, v_mode, p_direction,
         v_row.scan_status, v_next_status, v_outcome,
         CASE WHEN v_outcome = 'rejected' THEN 'Посилку відхилено при перевірці' END);

    v_total   := coalesce(v_row.total_amount, 0);
    v_deposit := coalesce(v_row.deposit, 0);
    v_debt    := greatest(0, v_total - v_deposit);

    RETURN jsonb_build_object(
        'ok', v_outcome <> 'rejected',
        'type', CASE v_outcome
                  WHEN 'updated'  THEN 'found'
                  WHEN 'already'  THEN 'already'
                  WHEN 'rejected' THEN 'rejected'
                END,
        'error', CASE WHEN v_outcome = 'rejected'
                      THEN 'Посилку відхилено при перевірці' END,
        'pkg_id', v_row.pkg_id,
        'status', v_next_status,
        'prev_status', v_row.scan_status,
        'item_count', v_row.item_count,
        'payment_status', v_row.payment_status,
        'total_amount', v_row.total_amount,
        'deposit', v_row.deposit,
        'debt', v_debt
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.scan_ttn(text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.scan_ttn(text,text,text,text)
    TO anon, authenticated, service_role;

-- ─── 2. peek_ttn — read-only for Check mode ────────────────────────────────
-- Returns payment-centric fields only. No state change, no audit log.
DROP FUNCTION IF EXISTS public.peek_ttn(text, text);

CREATE OR REPLACE FUNCTION public.peek_ttn(
    p_tenant_id text,
    p_ttn       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_ttn  text := btrim(coalesce(p_ttn, ''));
    v_row  public.packages%rowtype;
BEGIN
    IF p_tenant_id IS NULL OR p_tenant_id = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'tenant_id обов''язковий');
    END IF;
    IF v_ttn = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ТТН не вказано');
    END IF;

    SELECT * INTO v_row
      FROM public.packages
     WHERE tenant_id = p_tenant_id
       AND ttn_number = v_ttn
       AND is_archived = false
     ORDER BY created_at
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ТТН не знайдено');
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'pkg_id', v_row.pkg_id,
        'ttn_number', v_row.ttn_number,
        'payment_status', v_row.payment_status,
        'total_amount',   v_row.total_amount,
        'payment_currency', v_row.payment_currency,
        'deposit',        v_row.deposit,
        'debt', greatest(0, coalesce(v_row.total_amount,0) - coalesce(v_row.deposit,0)),
        'scan_status',    v_row.scan_status
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.peek_ttn(text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.peek_ttn(text,text)
    TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
