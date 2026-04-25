-- 2026-04-24 — фікс: create_passenger_from_sheet НЕ ВСТАВЛЯЄ smart_id.
--
-- Причина: в оригінальній RPC (2026-04-esco-tenant-and-lead-rpc.sql)
-- я забув додати колонку smart_id у INSERT. Тому у всіх синкнутих
-- пасажирів smart_id=NULL, хоча GAS передавав правильно.
--
-- Цей файл — CREATE OR REPLACE тільки для RPC, нічого іншого не чіпає.

BEGIN;

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
        pax_id, tenant_id, smart_id, direction, source_sheet,
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
        v_pax_id, v_tenant,
        nullif(payload->>'smart_id', ''),   -- ← ОСЬ ТУТ ФІКС
        v_direction,
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

    RETURN v_inserted;
END;
$fn$;

-- Бек-філ існуючих: витягти smart_id з pax_id формату PAX_<число>
UPDATE public.passengers
SET smart_id = substring(pax_id from 5)
WHERE tenant_id = 'esco'
  AND smart_id IS NULL
  AND pax_id LIKE 'PAX\_%'
  AND pax_id !~ '^PAX-';  -- не чіпати xlsx-мігровані PAX-20260326-XXXX

COMMIT;

NOTIFY pgrst, 'reload schema';
