-- 2026-04-23 — Оновлення create_package_from_sheet: додається дедуп по TTN
--
-- КОНТЕКСТ
-- --------
-- Пропускаємо посередню таблицю Posylki_crm. GAS-скрипт
-- backend/Packages-bot-sync.gs читає напряму «Бот накладні ТТН»
-- (аркуші «Аркуш Бот ТТН» і «ЗАЇЗДИ») і шле у Supabase.
--
-- В бот-таблиці нема pkg_id — GAS генерує його як PKG_<SmartSenderId>
-- (колонка J «Ід»). Це стабільний natural key, тож повторне надсилання
-- ловить UNIQUE (tenant_id, pkg_id).
--
-- ДОДАТКОВО user попросив дедуп по НОМЕРУ ТТН для направлення УК→ЄВ,
-- бо один smart_id може помилково появитись з новою ТТН, або навпаки:
-- якщо та сама ТТН уже є в БД під іншим pkg_id — вдруге не вставляємо.
--
-- Для ЄВ→УК (ЗАЇЗДИ) ttn_number реально не використовується
-- (там може бути 'Заїзд' або пусто) — дедуп не застосовуємо.

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
    v_ttn         text := nullif(btrim(coalesce(payload->>'ttn_number','')), '');
    v_sender_n    text := coalesce(nullif(btrim(coalesce(payload->>'sender_name','')), ''), '(невідомо)');
    v_sender_a    text := coalesce(nullif(btrim(coalesce(payload->>'sender_address','')), ''), '(не вказано)');
    v_recip_n     text := coalesce(nullif(btrim(coalesce(payload->>'recipient_name','')), ''), '(невідомо)');
    v_recip_a     text := coalesce(nullif(btrim(coalesce(payload->>'recipient_address','')), ''), '(не вказано)');
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
        RAISE EXCEPTION 'direction має бути "Україна-ЄВ"/"Європа-УК" або їх синонім, отримано: "%"', v_direction;
    END IF;

    -- ── Дедуп по TTN (тільки для УК→ЄВ) ──────────────────────────────────
    -- Якщо активна посилка з цим ttn_number вже є у БД — не створюємо дубль.
    -- Ігноруємо заархівовані (is_archived=true), щоб відновлення працювало.
    IF v_direction = 'Україна-ЄВ' AND v_ttn IS NOT NULL THEN
        IF EXISTS (
            SELECT 1
            FROM public.packages
            WHERE tenant_id  = v_tenant
              AND ttn_number = v_ttn
              AND coalesce(is_archived, false) = false
        ) THEN
            RETURN NULL;  -- поводимось як дубль
        END IF;
    END IF;

    INSERT INTO public.packages (
        pkg_id, tenant_id, direction, source_sheet,
        smart_id,
        sender_name, sender_phone, registrar_phone, sender_address,
        recipient_name, recipient_phone, recipient_address, nova_poshta_city,
        internal_number, ttn_number, description, details,
        item_count, weight_kg,
        np_amount, np_currency, np_form, np_status,
        total_amount, payment_currency,
        deposit, deposit_currency, payment_form, payment_status,
        debt, payment_notes,
        dispatch_date, timing,
        package_status, lead_status, crm_status,
        photo_url, tag, notes,
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
        nullif(payload->>'nova_poshta_city',''),
        nullif(payload->>'internal_number',''),
        v_ttn,
        nullif(payload->>'description',''),
        nullif(payload->>'details',''),
        nullif(payload->>'item_count','')::integer,
        nullif(payload->>'weight_kg','')::numeric,
        nullif(payload->>'np_amount','')::numeric,
        coalesce(nullif(payload->>'np_currency',''), 'UAH'),
        nullif(payload->>'np_form',''),
        coalesce(nullif(payload->>'np_status',''), 'paid'),
        nullif(payload->>'total_amount','')::numeric,
        coalesce(nullif(payload->>'payment_currency',''), 'UAH'),
        nullif(payload->>'deposit','')::numeric,
        coalesce(nullif(payload->>'deposit_currency',''), 'UAH'),
        nullif(payload->>'payment_form',''),
        coalesce(nullif(payload->>'payment_status',''), 'pending'),
        coalesce(nullif(payload->>'debt','')::numeric, 0),
        nullif(payload->>'payment_notes',''),
        nullif(payload->>'dispatch_date','')::date,
        nullif(payload->>'timing',''),
        coalesce(nullif(payload->>'package_status',''), 'pending'),
        coalesce(nullif(payload->>'lead_status',''), 'new'),
        coalesce(nullif(payload->>'crm_status',''), 'active'),
        nullif(payload->>'photo_url',''),
        nullif(payload->>'tag',''),
        nullif(payload->>'notes',''),
        now(), now()
    )
    ON CONFLICT (tenant_id, pkg_id) WHERE tenant_id = 'esco' DO NOTHING
    RETURNING pkg_id INTO v_inserted;

    RETURN v_inserted;
END;
$fn$;

COMMENT ON FUNCTION public.create_package_from_sheet(jsonb) IS
    'Insert package from Google Sheets (tenant=esco). Idempotent on pkg_id. Extra TTN-dedup for Україна-ЄВ.';

COMMIT;

NOTIFY pgrst, 'reload schema';
