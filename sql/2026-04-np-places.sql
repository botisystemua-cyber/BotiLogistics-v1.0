-- 2026-04-20 — нове поле packages.np_places (кількість фізичних коробок з тим же ТТН)
--
-- Семантика:
--   • item_count  = скільки позицій (речей) ВСЕРЕДИНІ коробок (оператор
--                   вписує вручну при редагуванні ліда у CRM)
--   • np_places   = скільки фізичних коробок з однією і тією ж наліпкою
--                   ТТН фактично приїхало (сканер інкрементує автоматично
--                   при повторному скані того ж ТТН; оператор може
--                   відкоригувати через stepper на сканері або поле
--                   «Місця НП» у редакторі)
--
-- Timeline розпаковок тягнеться з package_scan_log по pkg_id: кожен скан
-- (mode='intake' на першому, 'unpack' на наступних) = окремий рядок з
-- timestamp'ом і scanned_by.

ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS np_places integer DEFAULT 1;

-- peek_ttn тепер повертає np_places, щоб сканер-stepper одразу показав
-- поточну кількість коробок (а не перемішував з item_count).
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
        'np_places', v_row.np_places,
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
