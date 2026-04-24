-- 2026-04-24 — RPC приймає реальну дату створення з бот-таблиці.
--
-- РАНІШЕ: created_at = now() (момент синку). Всі синкнуті посилки
-- виглядали як сьогоднішні, не можна було відрізнити нові від старих.
--
-- ЗАРАЗ: якщо payload має bot_created_at — використовуємо її як created_at.
-- Якщо немає — fallback на now().

BEGIN;

CREATE OR REPLACE FUNCTION public.create_package_from_sheet(payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_tenant      text := 'esco';
    v_pkg_id      text := btrim(coalesce(payload->>'pkg_id', ''));
    v_direction   text := btrim(coalesce(payload->>'direction', ''));
    v_sender_n    text := coalesce(nullif(btrim(coalesce(payload->>'sender_name','')), ''), '(невідомо)');
    v_sender_a    text := coalesce(nullif(btrim(coalesce(payload->>'sender_address','')), ''), '(не вказано)');
    v_recip_n     text := coalesce(nullif(btrim(coalesce(payload->>'recipient_name','')), ''), '(невідомо)');
    v_recip_a     text := coalesce(nullif(btrim(coalesce(payload->>'recipient_address','')), ''), '(не вказано)');
    v_created_at  timestamptz := coalesce(
        nullif(payload->>'bot_created_at','')::timestamptz,
        now()
    );
    v_inserted    text;
BEGIN
    IF v_pkg_id = '' THEN
        RAISE EXCEPTION 'pkg_id обов''язковий';
    END IF;

    IF v_direction IN ('УК→ЄВ', 'УК-ЄВ', 'ua-eu', 'UA_EU', 'Україна-ЄВ') THEN
        v_direction := 'Україна-ЄВ';
    ELSIF v_direction IN ('ЄВ→УК', 'ЄВ-УК', 'eu-ua', 'EU_UA', 'Європа-УК') THEN
        v_direction := 'Європа-УК';
    END IF;
    IF v_direction NOT IN ('Україна-ЄВ','Європа-УК') THEN
        RAISE EXCEPTION 'direction має бути "Україна-ЄВ"/"Європа-УК", отримано: "%"', v_direction;
    END IF;

    INSERT INTO public.packages (
        pkg_id, tenant_id, direction, source_sheet,
        smart_id,
        sender_name, sender_phone, registrar_phone, sender_address,
        recipient_name, recipient_phone, recipient_address,
        internal_number, ttn_number, description, details,
        item_count, weight_kg,
        total_amount, payment_currency,
        deposit_currency, payment_status, debt,
        package_status, lead_status, crm_status,
        created_at, updated_at
    )
    VALUES (
        v_pkg_id, v_tenant, v_direction,
        nullif(payload->>'source_sheet',''),
        nullif(payload->>'smart_id',''),
        v_sender_n,
        nullif(payload->>'sender_phone',''),
        nullif(payload->>'registrar_phone',''),
        v_sender_a,
        v_recip_n,
        nullif(payload->>'recipient_phone',''),
        v_recip_a,
        nullif(payload->>'internal_number',''),
        nullif(payload->>'ttn_number',''),
        nullif(payload->>'description',''),
        nullif(payload->>'details',''),
        nullif(payload->>'item_count','')::integer,
        nullif(payload->>'weight_kg','')::numeric,
        nullif(payload->>'total_amount','')::numeric,
        'UAH', 'UAH', 'pending', 0,
        'pending', 'new', 'active',
        v_created_at, v_created_at
    )
    ON CONFLICT (tenant_id, pkg_id) WHERE tenant_id = 'esco' DO NOTHING
    RETURNING pkg_id INTO v_inserted;

    RETURN v_inserted;
END;
$fn$;

COMMIT;

NOTIFY pgrst, 'reload schema';
