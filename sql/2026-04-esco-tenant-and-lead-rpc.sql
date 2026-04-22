-- 2026-04-22 — Автосинк пасажирських заявок з Google Sheets у Supabase.
--
-- КОНТЕКСТ
-- --------
-- Клієнт Esco веде пасажирські бронювання у Google Sheets
-- «Пасажири Бронювання новий» (ID 1EHJTrCpre63lg_FZeNhmSyk4ArDXu4YumNUpB9ZCFVk),
-- аркуші «Загальний УКР» (Україна→Європа) і «Загальний ШВ» (Європа→Україна).
-- Google Apps Script (backend/Passengers-sheet-sync.gs) шле кожну нову заявку
-- сюди — одним HTTP POST у RPC create_passenger_from_sheet(jsonb).
--
-- ЦЕ РОБИТЬ МІГРАЦІЯ
-- ------------------
-- 1) Створює рядок клієнта 'esco' у public.clients (якщо ще немає).
-- 2) Гарантує UNIQUE(tenant_id, pax_id) на public.passengers — ключ
--    ідемпотентності для RPC.
-- 3) Створює public.create_passenger_from_sheet(jsonb) — єдина точка входу
--    для GAS. Валідує, нормалізує, вставляє; повертає pax_id (NULL — дубль).
--
-- Ідемпотентно: файл безпечно запускати повторно.

BEGIN;

-- ─── 1. Рядок клієнта 'esco' ───────────────────────────────────────────────
-- Інші тенанти створюються ззовні (через config-crm), але 'esco' потрібен
-- негайно — FK passengers.tenant_id → clients.tenant_id не пустить INSERT.
INSERT INTO public.clients (tenant_id, tenant_name, modules)
VALUES ('esco', 'Esco', ARRAY['passenger','cargo'])
ON CONFLICT (tenant_id) DO NOTHING;

-- ─── 2. UNIQUE (tenant_id, pax_id) ─────────────────────────────────────────
-- pax_id приходить з Google Sheets (колонка "Id") — стабільний природний ключ.
-- ON CONFLICT у RPC нижче спирається саме на цей індекс.
CREATE UNIQUE INDEX IF NOT EXISTS passengers_tenant_pax_uidx
    ON public.passengers (tenant_id, pax_id);

-- ─── 3. RPC create_passenger_from_sheet(payload jsonb) ─────────────────────
-- Вхідний payload (усе snake_case, рядки; числа і дати теж як текст — RPC сам
-- приведе):
--   pax_id              обов'язково
--   direction           'Україна-ЄВ' | 'Європа-УК' (обов'язково)
--   full_name | phone   хоча б одне з двох
--   registrar_phone     телефон менеджера/юзера з бота
--   seats_count         numeric
--   deposit             numeric (deposit_currency за замовч. 'CHF')
--   ticket_price        numeric (ticket_currency за замовч. 'CHF')
--                       ← сюди йде «клас авто» (50/100/150) — це ціна у франках
--   booking_created_at  ISO timestamptz (коли бот створив заявку)
--   departure_date      ISO date (дата виїзду / реєстрації)
--   lead_status         порожнє → 'Новий'
--   seat_number         текст, як є: "A1-по 130 фр"
--   arrival_address     для аркуша УКР (куди їдуть у ЄС)
--   departure_address   для аркуша ШВ (звідки забирають з ЄС)
--   notes               примітка (колонка R аркуша ШВ)
--   source_sheet        'Загальний УКР' | 'Загальний ШВ' (для аудиту)
--
-- tenant_id жорстко = 'esco' (пінається в коді функції, payload не враховується).
--
-- Вихід:
--   pax_id якщо рядок вставлено;
--   NULL   якщо дубль (тенант+pax_id уже в БД);
--   EXCEPTION якщо валідація не пройшла (невалідний direction / нема ключових полів).

CREATE OR REPLACE FUNCTION public.create_passenger_from_sheet(payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_tenant      text := 'esco';
    v_pax_id      text := btrim(coalesce(payload->>'pax_id', ''));
    v_full_name   text := nullif(btrim(coalesce(payload->>'full_name', '')), '');
    v_phone       text := nullif(btrim(coalesce(payload->>'phone', '')), '');
    v_direction   text := btrim(coalesce(payload->>'direction', ''));
    v_lead_status text := coalesce(
        nullif(btrim(coalesce(payload->>'lead_status', '')), ''),
        'Новий'
    );
    v_inserted    text;
BEGIN
    -- Вхідна валідація
    IF v_pax_id = '' THEN
        RAISE EXCEPTION 'pax_id обов''язковий';
    END IF;
    IF v_full_name IS NULL AND v_phone IS NULL THEN
        RAISE EXCEPTION 'потрібно хоча б full_name або phone';
    END IF;
    IF v_direction NOT IN ('Україна-ЄВ','Європа-УК') THEN
        RAISE EXCEPTION
            'direction має бути ''Україна-ЄВ'' або ''Європа-УК'', отримано: "%"',
            v_direction;
    END IF;

    INSERT INTO public.passengers (
        pax_id, tenant_id, direction, source_sheet,
        full_name, phone, registrar_phone,
        seats_count,
        deposit, deposit_currency,
        ticket_price, ticket_currency,
        booking_created_at, departure_date,
        lead_status, crm_status, is_archived,
        seat_number,
        arrival_address, departure_address,
        notes,
        created_at, updated_at
    )
    VALUES (
        v_pax_id, v_tenant, v_direction,
        nullif(payload->>'source_sheet', ''),
        v_full_name, v_phone,
        nullif(btrim(coalesce(payload->>'registrar_phone', '')), ''),
        nullif(payload->>'seats_count', '')::numeric,
        nullif(payload->>'deposit', '')::numeric,
        coalesce(nullif(payload->>'deposit_currency', ''), 'CHF'),
        nullif(payload->>'ticket_price', '')::numeric,
        coalesce(nullif(payload->>'ticket_currency', ''), 'CHF'),
        nullif(payload->>'booking_created_at', '')::timestamptz,
        nullif(payload->>'departure_date', '')::date,
        v_lead_status, 'active', false,
        nullif(payload->>'seat_number', ''),
        nullif(payload->>'arrival_address', ''),
        nullif(payload->>'departure_address', ''),
        nullif(payload->>'notes', ''),
        now(), now()
    )
    ON CONFLICT (tenant_id, pax_id) DO NOTHING
    RETURNING pax_id INTO v_inserted;

    RETURN v_inserted;  -- NULL якщо дубль
END;
$fn$;

COMMENT ON FUNCTION public.create_passenger_from_sheet(jsonb) IS
    'Insert passenger lead from Google Sheets (tenant=esco). Idempotent via UNIQUE(tenant_id, pax_id). Returns pax_id or NULL on duplicate.';

REVOKE ALL ON FUNCTION public.create_passenger_from_sheet(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.create_passenger_from_sheet(jsonb)
    TO anon, authenticated, service_role;

COMMIT;

-- Оновити кеш PostgREST, щоб RPC одразу був доступний по HTTP.
NOTIFY pgrst, 'reload schema';
