-- 2026-04-27 — smartsender_package_webhook: допоміжна RPC для Smart Sender (посилки).
--
-- ДЗЕРКАЛО smartsender_passenger_webhook, тільки для пакетів. Допоміжний канал
-- (основний шлях наповнення packages — це create_package_from_sheet з GAS).
-- НЕ ЗАМІНЯЄ і НЕ ЧІПАЄ create_package_from_sheet.
--
-- Сигнатура: smartsender_package_webhook(payload jsonb) RETURNS jsonb.
-- Виклик:    POST /rest/v1/rpc/smartsender_package_webhook
--            body: {"payload": { ... }}
-- Повертає:  {"ok":true,"pkg_id":"PKG...","id":<uuid>,"tenant_id":"..."}
--            або {"ok":false,"error":"..."} (без 4xx — стиль пасажирської).
--
-- Tenant: дефолт 'testvod' (як у пасажирській обгортці).
-- Direction: дефолт 'Україна-ЄВ', без CHECK (лояльно, як у пасажирській).
-- pkg_id: генерується як 'PKG' || epoch (без дедупу — Smart Sender тут
--         тільки додатковий канал; для дедупу йти через create_package_from_sheet).

CREATE OR REPLACE FUNCTION public.smartsender_package_webhook(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_pkg_id text;
    v_id     uuid;
    v_tenant text;
    v_dir    text;
    v_date   date;
    v_raw    text;
BEGIN
    v_tenant := COALESCE(NULLIF(payload->>'tenant_id',''), 'testvod');
    v_pkg_id := 'PKG' || extract(epoch from now())::bigint::text;
    v_dir    := COALESCE(NULLIF(payload->>'direction',''), 'Україна-ЄВ');

    -- dispatch_date: ISO або DD.MM.YYYY (як у пасажирській)
    v_raw := NULLIF(payload->>'dispatch_date','');
    IF v_raw IS NOT NULL THEN
        BEGIN
            v_date := v_raw::date;
        EXCEPTION WHEN others THEN
            BEGIN
                v_date := to_date(v_raw, 'DD.MM.YYYY');
            EXCEPTION WHEN others THEN
                v_date := NULL;
            END;
        END;
    END IF;

    INSERT INTO public.packages (
        pkg_id, tenant_id, smart_id, direction, source_sheet,
        sender_name, sender_phone, registrar_phone, sender_address,
        recipient_name, recipient_phone, recipient_address, nova_poshta_city,
        internal_number, ttn_number,
        description, details,
        item_count, weight_kg,
        np_amount, np_currency, np_form, np_status,
        total_amount, payment_currency,
        deposit, deposit_currency, payment_form, payment_status,
        debt, payment_notes,
        dispatch_date, timing,
        package_status, lead_status, crm_status,
        notes,
        is_archived, created_at, updated_at
    )
    VALUES (
        v_pkg_id, v_tenant,
        NULLIF(payload->>'smart_id',''),
        v_dir,
        v_dir,                                            -- стиль пасажирської: source_sheet = direction
        -- NOT NULL колонки з фолбеками (як у create_package_from_sheet):
        COALESCE(NULLIF(btrim(coalesce(payload->>'sender_name','')),''),    '(невідомо)'),
        payload->>'sender_phone',
        NULLIF(payload->>'registrar_phone',''),
        COALESCE(NULLIF(btrim(coalesce(payload->>'sender_address','')),''), '(не вказано)'),
        COALESCE(NULLIF(btrim(coalesce(payload->>'recipient_name','')),''), '(невідомо)'),
        payload->>'recipient_phone',
        COALESCE(NULLIF(btrim(coalesce(payload->>'recipient_address','')),''), '(не вказано)'),
        NULLIF(payload->>'nova_poshta_city',''),
        NULLIF(payload->>'internal_number',''),
        NULLIF(payload->>'ttn_number',''),
        NULLIF(payload->>'description',''),
        NULLIF(payload->>'details',''),
        NULLIF(payload->>'item_count','')::integer,
        NULLIF(payload->>'weight_kg','')::numeric,
        NULLIF(payload->>'np_amount','')::numeric,
        COALESCE(NULLIF(payload->>'np_currency',''), 'UAH'),
        NULLIF(payload->>'np_form',''),
        NULLIF(payload->>'np_status',''),
        NULLIF(payload->>'total_amount','')::numeric,
        COALESCE(NULLIF(payload->>'payment_currency',''), 'UAH'),
        NULLIF(payload->>'deposit','')::numeric,
        COALESCE(NULLIF(payload->>'deposit_currency',''), 'UAH'),
        NULLIF(payload->>'payment_form',''),
        COALESCE(NULLIF(payload->>'payment_status',''), 'pending'),
        COALESCE(NULLIF(payload->>'debt','')::numeric, 0),
        NULLIF(payload->>'payment_notes',''),
        v_date,
        NULLIF(payload->>'timing',''),
        COALESCE(NULLIF(payload->>'package_status',''), 'pending'),
        COALESCE(NULLIF(payload->>'lead_status',''), 'new'),
        'active',
        NULLIF(payload->>'notes',''),
        false,
        COALESCE(NULLIF(payload->>'created_at','')::timestamptz, now()),
        now()
    )
    RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'ok', true,
        'pkg_id', v_pkg_id,
        'id', v_id,
        'tenant_id', v_tenant
    );
EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.smartsender_package_webhook(jsonb)
    TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.smartsender_package_webhook(jsonb) IS
    'Smart Sender webhook entry-point for packages. Mirror of smartsender_passenger_webhook. Tenant default: testvod. Each call inserts a new row (no dedup). For Sheets-driven sync use create_package_from_sheet.';

NOTIFY pgrst, 'reload schema';
