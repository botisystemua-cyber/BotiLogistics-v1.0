-- 2026-04-20 — Scanner: Нова Пошта payment capture
--
-- Operators scan a TTN and, for some leads, want to mark:
--   «клієнт сам оплатив НП»     → np_status = 'paid_by_client' (80% of cases)
--   «платимо ми — X UAH»        → np_status = 'paid_by_us', np_amount = X,
--                                 AND the amount gets added to `debt` because
--                                 the client now owes us that NP delivery fee.
--
-- `total_amount` is intentionally NOT touched — it's the goods price, a
-- separate concept. Debt reconciliation (zeroing on final payment) happens
-- elsewhere in the finance flow.
--
-- The RPC is wrapped in SELECT ... FOR UPDATE to be race-safe when two
-- operators scan the same TTN concurrently.
--
-- Audit: we reuse `package_scan_log` with a new `mode='np_edit'` so the lead
-- timeline shows "Alex set НП-оплата to paid_by_us: 180 UAH at 09:12".

BEGIN;

-- ─── 1. Extend package_scan_log.mode CHECK ────────────────────────────────
ALTER TABLE public.package_scan_log
  DROP CONSTRAINT IF EXISTS package_scan_log_mode_check;

ALTER TABLE public.package_scan_log
  ADD CONSTRAINT package_scan_log_mode_check
  CHECK (mode IN ('intake','load','handout','np_edit'));

-- ─── 2. register_np_payment RPC ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.register_np_payment(text, text, text, numeric, text);

CREATE OR REPLACE FUNCTION public.register_np_payment(
    p_tenant_id text,
    p_pkg_id    text,
    p_payer     text,       -- 'client' | 'us'
    p_amount    numeric,    -- required when p_payer='us', ignored otherwise
    p_user      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_row        public.packages%rowtype;
    v_new_status text;
    v_new_amount numeric;
    v_new_debt   numeric;
    v_prev_debt  numeric;
    v_now        timestamptz := now();
BEGIN
    IF p_tenant_id IS NULL OR p_tenant_id = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'tenant_id обов''язковий');
    END IF;
    IF p_pkg_id IS NULL OR p_pkg_id = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'pkg_id обов''язковий');
    END IF;
    IF p_payer NOT IN ('client','us') THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'payer має бути client або us');
    END IF;
    IF p_payer = 'us' AND (p_amount IS NULL OR p_amount <= 0) THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Сума обов''язкова коли платимо ми');
    END IF;

    SELECT * INTO v_row
      FROM public.packages
     WHERE tenant_id = p_tenant_id
       AND pkg_id    = p_pkg_id
       AND is_archived = false
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Посилку не знайдено');
    END IF;

    v_prev_debt := coalesce(v_row.debt, 0);

    IF p_payer = 'client' THEN
        v_new_status := 'paid_by_client';
        v_new_amount := v_row.np_amount;       -- no change
        v_new_debt   := v_prev_debt;           -- no change
    ELSE
        v_new_status := 'paid_by_us';
        v_new_amount := p_amount;
        v_new_debt   := v_prev_debt + p_amount;
    END IF;

    UPDATE public.packages
       SET np_status  = v_new_status,
           np_amount  = v_new_amount,
           debt       = v_new_debt,
           updated_at = v_now
     WHERE pkg_id    = p_pkg_id
       AND tenant_id = p_tenant_id;

    INSERT INTO public.package_scan_log
        (tenant_id, pkg_id, ttn_number, scanned_by, mode,
         from_status, to_status, outcome)
    VALUES
        (p_tenant_id, p_pkg_id, v_row.ttn_number, p_user, 'np_edit',
         coalesce(v_row.np_status, 'pending'), v_new_status, 'updated');

    RETURN jsonb_build_object(
        'ok', true,
        'pkg_id', p_pkg_id,
        'np_status', v_new_status,
        'np_amount', v_new_amount,
        'debt',      v_new_debt,
        'prev_debt', v_prev_debt
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.register_np_payment(text,text,text,numeric,text) FROM public;
GRANT EXECUTE ON FUNCTION public.register_np_payment(text,text,text,numeric,text)
    TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
