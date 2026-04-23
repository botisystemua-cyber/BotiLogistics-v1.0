-- 2026-04-23 — Автосинк посилок з Google Sheets Posylki_crm у Supabase.
--
-- КОНТЕКСТ
-- --------
-- Esco веде посилки у Google Sheets `Posylki_crm`
-- (ID 1_vfEhdLEM2SVTBiu_3eDilMs1HlKxvPrJBbiHYjgrJo), аркуші:
--   «Реєстрація ТТН УК-єв»  (52 кол) — Україна → Європа
--   «Виклик Курєра ЄВ-ук»   (51 кол) — Європа  → Україна
--
-- backend/Packages-sheet-sync.gs шле кожну нову посилку сюди — HTTP POST
-- у RPC create_package_from_sheet(jsonb). Аналог пасажирського каналу.
--
-- ЗМІНИ
-- -----
-- 1) ALTER packages ADD source_sheet text — для аудиту джерела.
-- 2) UNIQUE(tenant_id, pkg_id) partial WHERE tenant='esco' — ідемпотентність.
-- 3) RPC create_package_from_sheet(payload jsonb) — валідує, пінає
--    tenant_id='esco', нормалізує direction, ON CONFLICT DO NOTHING.

BEGIN;

-- ─── 1. Колонка source_sheet ───────────────────────────────────────────────
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS source_sheet text;

-- ─── 2. UNIQUE (tenant_id, pkg_id) ─────────────────────────────────────────
-- Partial (лише esco) — бо інші тенанти можуть мати свої pkg_id з дублями
-- або вже існуючі unique constraints.
CREATE UNIQUE INDEX IF NOT EXISTS packages_esco_pkg_uidx
    ON public.packages (tenant_id, pkg_id)
    WHERE tenant_id = 'esco';

-- ─── 3. RPC create_package_from_sheet ─────────────────────────────────────
-- Вхід payload (усе у snake_case, рядки):
--   pkg_id                 обов'язково
--   direction              'Україна-ЄВ' | 'Європа-УК' (нормалізуємо)
--   sender_name            NOT NULL (fallback '(невідомо)' якщо порожнє)
--   sender_address         NOT NULL (fallback '(не вказано)')
--   recipient_name         NOT NULL (fallback '(невідомо)')
--   recipient_address      NOT NULL (fallback '(не вказано)')
--   решта полів — опційні
--
-- Вихід: pkg_id якщо вставлено, NULL якщо дубль, EXCEPTION якщо невалідно.

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
    v_inserted    text;
BEGIN
    IF v_pkg_id = '' THEN
        RAISE EXCEPTION 'pkg_id обов''язковий';
    END IF;

    -- Нормалізація direction: у xlsx 'УК→ЄВ'/'ЄВ→УК', у БД 'Україна-ЄВ'/'Європа-УК'.
    IF v_direction IN ('УК→ЄВ', 'УК-ЄВ', 'ua-eu', 'UA_EU', 'Україна-ЄВ') THEN
        v_direction := 'Україна-ЄВ';
    ELSIF v_direction IN ('ЄВ→УК', 'ЄВ-УК', 'eu-ua', 'EU_UA', 'Європа-УК') THEN
        v_direction := 'Європа-УК';
    END IF;
    IF v_direction NOT IN ('Україна-ЄВ','Європа-УК') THEN
        RAISE EXCEPTION 'direction має бути "Україна-ЄВ"/"Європа-УК" або їх синонім, отримано: "%"', v_direction;
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
        nullif(payload->>'ttn_number',''),
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

    RETURN v_inserted;  -- NULL якщо дубль
END;
$fn$;

COMMENT ON FUNCTION public.create_package_from_sheet(jsonb) IS
    'Insert package from Google Sheets Posylki_crm (tenant=esco). Idempotent.';

REVOKE ALL ON FUNCTION public.create_package_from_sheet(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.create_package_from_sheet(jsonb)
    TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
