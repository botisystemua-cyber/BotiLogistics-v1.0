-- 2026-04-20 — C7: розширення mode в package_scan_log + peek_ttn.item_count
--
-- 1) Нові значення mode у package_scan_log:
--   'cancelled' — оператор натиснув «Скасувати» на невідомому ТТН у
--                 check-режимі. pkg_id=NULL, ttn_number зберігається для
--                 аудиту і для показу в CRM «Перевірка → Відхилені».
--   'unpack'    — повторний скан того ж ТТН (дублікат коробки). pkg_id
--                 проставлений, timestamp фіксує момент розпаковки.
--   Решта значень ('intake','load','handout','np_edit') лишаються як були.
--
-- 2) peek_ttn тепер повертає item_count, щоб сканер-stepper одразу бачив
--    поточну к-сть коробок при показі меню для знайденого ТТН.

-- ─── 1. CHECK на mode ──────────────────────────────────────────────────────
ALTER TABLE public.package_scan_log
  DROP CONSTRAINT IF EXISTS package_scan_log_mode_check;

ALTER TABLE public.package_scan_log
  ADD CONSTRAINT package_scan_log_mode_check
  CHECK (mode IN ('intake','load','handout','np_edit','cancelled','unpack'));

-- ─── 2. peek_ttn повертає item_count ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.peek_ttn(p_tenant_id text, p_ttn text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_ttn text := btrim(coalesce(p_ttn, ''));
    v_row public.packages%rowtype;
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
        'item_count', v_row.item_count,
        'payment_status', v_row.payment_status,
        'total_amount', v_row.total_amount,
        'payment_currency', v_row.payment_currency,
        'deposit', v_row.deposit,
        'debt', greatest(0, coalesce(v_row.total_amount,0) - coalesce(v_row.deposit,0)),
        'scan_status', v_row.scan_status
    );
END;
$fn$;

NOTIFY pgrst, 'reload schema';
