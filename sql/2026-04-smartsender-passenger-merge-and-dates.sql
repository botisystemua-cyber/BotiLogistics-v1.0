-- 2026-04-27 — smartsender_passenger_webhook: merge + розширений парсер дат.
--
-- ЩО МІНЯЄТЬСЯ
-- ------------
-- 1. Замість сліпого INSERT — upsert+merge:
--    a) шукаємо існуючий не-архівний рядок з тим самим (tenant_id, smart_id);
--    b) якщо smart_id порожній — за (tenant_id, phone);
--    c) якщо знайдено — UPDATE merge (COALESCE: нові непорожні поля затирають
--       старі, відсутні/порожні — НЕ чіпають існуючі);
--    d) якщо ні — INSERT як раніше.
-- 2. Парсер departure_date: ISO + DD.MM.YYYY + DD/MM/YYYY + DD-MM-YYYY +
--    YYYY/MM/DD + YYYY.MM.DD.
-- 3. У відповідь додано поле "action": 'inserted' | 'updated'.
--
-- BACK-COMPAT
-- -----------
-- Сигнатура та формат відповіді не змінилися (поля 'ok'/'pax_id'/'id'/
-- 'tenant_id' лишаються; додано лише 'action'). EXCEPTION-блок зберігається —
-- помилки повертаються як {"ok":false,"error":SQLERRM}, без 4xx/5xx.
--
-- ОБМЕЖЕННЯ
-- ---------
-- Якщо SS шле webhook без phone і без smart_id — дедупити нема за чим, тоді
-- кожен виклик і далі створюватиме новий рядок. Це не баг RPC, а брак ключа.

CREATE OR REPLACE FUNCTION public.smartsender_passenger_webhook(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_tenant       text;
    v_smart_id     text;
    v_phone        text;
    v_full_name    text;
    v_direction    text;
    v_messenger    text;
    v_pax_id       text;
    v_id           uuid;
    v_existing_id  uuid;
    v_existing_pax text;
    v_date         date;
    v_raw          text;
    v_action       text;
    v_fmt          text;
    v_formats      text[] := ARRAY[
        'DD.MM.YYYY',
        'DD/MM/YYYY',
        'DD-MM-YYYY',
        'YYYY/MM/DD',
        'YYYY.MM.DD'
    ];
BEGIN
    v_tenant    := COALESCE(NULLIF(payload->>'tenant_id',''), 'testvod');
    v_smart_id  := NULLIF(btrim(COALESCE(payload->>'smart_id','')), '');
    v_phone     := NULLIF(btrim(COALESCE(payload->>'phone','')), '');
    v_full_name := NULLIF(btrim(COALESCE(payload->>'full_name','')), '');
    v_direction := COALESCE(NULLIF(payload->>'direction',''), 'Україна-ЄВ');
    v_messenger := COALESCE(NULLIF(payload->>'messenger',''), 'telegram');

    -- ── departure_date: ISO, потім по списку форматів ─────────────────
    v_raw := NULLIF(btrim(COALESCE(payload->>'departure_date','')), '');
    IF v_raw IS NOT NULL THEN
        BEGIN
            v_date := v_raw::date;
        EXCEPTION WHEN others THEN
            FOREACH v_fmt IN ARRAY v_formats LOOP
                BEGIN
                    v_date := to_date(v_raw, v_fmt);
                    EXIT;
                EXCEPTION WHEN others THEN
                    NULL;  -- спробувати наступний формат
                END;
            END LOOP;
        END;
    END IF;

    -- ── Шукаємо існуючий рядок: smart_id → phone ──────────────────────
    IF v_smart_id IS NOT NULL THEN
        SELECT id, pax_id INTO v_existing_id, v_existing_pax
        FROM public.passengers
        WHERE tenant_id = v_tenant
          AND smart_id  = v_smart_id
          AND COALESCE(is_archived, false) = false
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    IF v_existing_id IS NULL AND v_phone IS NOT NULL THEN
        SELECT id, pax_id INTO v_existing_id, v_existing_pax
        FROM public.passengers
        WHERE tenant_id = v_tenant
          AND phone     = v_phone
          AND COALESCE(is_archived, false) = false
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
        -- ── MERGE: тільки непорожні поля з payload затирають старі ───
        UPDATE public.passengers SET
            smart_id          = COALESCE(v_smart_id, smart_id),
            full_name         = COALESCE(v_full_name, full_name),
            phone             = COALESCE(v_phone, phone),
            departure_address = COALESCE(NULLIF(payload->>'departure_address',''), departure_address),
            arrival_address   = COALESCE(NULLIF(payload->>'arrival_address',''), arrival_address),
            departure_date    = COALESCE(v_date, departure_date),
            departure_time    = COALESCE(NULLIF(payload->>'departure_time',''), departure_time),
            seats_count       = COALESCE(NULLIF(payload->>'seats_count','')::numeric, seats_count),
            seat_number       = COALESCE(NULLIF(payload->>'seat_number',''), seat_number),
            direction         = COALESCE(NULLIF(payload->>'direction',''), direction),
            source_sheet      = COALESCE(NULLIF(payload->>'direction',''), source_sheet),
            messenger         = COALESCE(NULLIF(payload->>'messenger',''), messenger),
            notes             = COALESCE(NULLIF(payload->>'notes',''), notes),
            updated_at        = now()
        WHERE id = v_existing_id;
        v_id     := v_existing_id;
        v_pax_id := v_existing_pax;
        v_action := 'updated';
    ELSE
        -- ── INSERT новий ─────────────────────────────────────────────
        -- pax_id у мс (не в с) — щоб уникнути колізій при швидких викликах.
        v_pax_id := 'PAX' || (extract(epoch from clock_timestamp())*1000)::bigint::text;
        INSERT INTO public.passengers (
            tenant_id, pax_id, smart_id,
            full_name, phone,
            departure_address, arrival_address,
            departure_date, departure_time,
            seats_count, seat_number,
            direction, source_sheet, messenger,
            notes, booking_created_at,
            is_archived, crm_status, lead_status
        ) VALUES (
            v_tenant, v_pax_id, v_smart_id,
            v_full_name,
            COALESCE(v_phone, ''),                          -- phone NOT NULL у БД
            NULLIF(payload->>'departure_address',''),
            NULLIF(payload->>'arrival_address',''),
            v_date, NULLIF(payload->>'departure_time',''),
            NULLIF(payload->>'seats_count','')::numeric,
            NULLIF(payload->>'seat_number',''),
            v_direction, v_direction, v_messenger,
            NULLIF(payload->>'notes',''),
            COALESCE(NULLIF(payload->>'booking_created_at','')::timestamptz, now()),
            false, 'active', 'Новий'
        )
        RETURNING id INTO v_id;
        v_action := 'inserted';
    END IF;

    RETURN jsonb_build_object(
        'ok',        true,
        'pax_id',    v_pax_id,
        'id',        v_id,
        'tenant_id', v_tenant,
        'action',    v_action
    );
EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$fn$;

NOTIFY pgrst, 'reload schema';
