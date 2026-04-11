-- ================================================================
-- SEED: маршрут Україна → Іспанія (середа) для тенанта express_sv_travel
-- ================================================================
-- Це РАЗОВИЙ сід для конкретного перевізника. Копія даних, які раніше
-- було засіджено для 'gresco' у sql/2026-04-passenger-route-points.sql,
-- але з іншим tenant_id.
--
-- Передумови:
--   Таблиці passenger_route_points та passenger_route_prices уже мають
--   існувати (створені міграцією 2026-04-passenger-route-points.sql).
--
-- Використання:
--   Supabase Dashboard → SQL Editor → вставити весь файл → Run.
--
-- Ідемпотентно: повторний запуск нічого не зламає (ON CONFLICT DO NOTHING).
-- ================================================================

-- ─── 1. 23 точки маршруту для express_sv_travel ──────────────────
INSERT INTO passenger_route_points
    (tenant_id, route_group, name_ua, country_code, sort_order, location_name, lat, lon, maps_url, delivery_mode)
VALUES
    ('express_sv_travel','ua-es-wed','Чернівці',   'UA',  1, 'Центральний Автовокзал', 48.264973, 25.951929, 'https://maps.app.goo.gl/1DnniH61uU5QKCKRA', 'point'),
    ('express_sv_travel','ua-es-wed','Сучава',     'RO',  2, NULL,                     NULL,       NULL,       NULL,                                          'point'),
    ('express_sv_travel','ua-es-wed','Братислава', 'SK',  3, 'ORLEN',                  48.181325, 17.054571, 'https://maps.app.goo.gl/Ynu84ZxBHkdoDHqM8', 'point'),
    ('express_sv_travel','ua-es-wed','Брно',       'CZ',  4, 'OMV',                    49.174340, 16.512950, 'https://maps.app.goo.gl/HkJjDxmxpS9m5iSs6', 'point'),
    ('express_sv_travel','ua-es-wed','Прага',      'CZ',  5, 'ORLEN',                  50.033641, 14.214376, 'https://maps.app.goo.gl/VcdYViqiJ7vBYFDA8', 'point'),
    ('express_sv_travel','ua-es-wed','Нюрнберг',   'DE',  6, 'Nürnberg',               49.454288, 11.074564, 'https://maps.app.goo.gl/8wFmrmrmYnTEEyXt6', 'point'),
    ('express_sv_travel','ua-es-wed','Карлсруе',   'DE',  7, 'Karlsruhe',              49.006890,  8.403653, 'https://maps.app.goo.gl/5SHCvCpjbq2DnukMA', 'point'),
    ('express_sv_travel','ua-es-wed','Жерона',     'ES',  8, 'Repsol',                 42.173453,  2.930165, 'https://maps.app.goo.gl/hACMpXvRBqJqHCey8', 'point'),
    ('express_sv_travel','ua-es-wed','Барселона',  'ES',  9, 'bp',                     41.493019,  2.099212, 'https://maps.app.goo.gl/4Edu9VxFPuqN2ngh6', 'point'),
    ('express_sv_travel','ua-es-wed','Тарагона',   'ES', 10, 'Tarragona',              41.118883,  1.244491, 'https://maps.app.goo.gl/gLFbMZSBXBxkwLXCA', 'point'),
    ('express_sv_travel','ua-es-wed','Тортоса',    'ES', 11, 'Campo Quality',          40.755046,  0.600016, 'https://maps.app.goo.gl/WNv4cSFnbtooRDE59', 'point'),
    ('express_sv_travel','ua-es-wed','Валенсія',   'ES', 12, 'Galp',                   39.400600, -0.493606, 'https://maps.app.goo.gl/w8xMkFLdLXAXvL697', 'point'),
    ('express_sv_travel','ua-es-wed','Бенідорм',   'ES', 13, 'Cepsa',                  38.535972, -0.202250, 'https://maps.app.goo.gl/w39jaTkkh5Q3986r9', 'address_and_point'),
    ('express_sv_travel','ua-es-wed','Аліканте',   'ES', 14, 'Avanza',                 38.383569, -0.489813, 'https://maps.app.goo.gl/uBqLymLwiip93S1V8', 'point'),
    ('express_sv_travel','ua-es-wed','Торревеха',  'ES', 15, 'Repsol',                 38.233350, -0.790679, 'https://maps.app.goo.gl/5ULGurVdCbcxx9VV8', 'point'),
    ('express_sv_travel','ua-es-wed','Мурсія',     'ES', 16, 'Repsol',                 38.102594, -1.035301, 'https://maps.app.goo.gl/u8Qti8AYxgbxVKUW6', 'point'),
    ('express_sv_travel','ua-es-wed','Алмеріа',    'ES', 17, 'Repsol',                 36.875419, -2.337874, 'https://maps.app.goo.gl/yXctG6nfcaN6A8gn7', 'point'),
    ('express_sv_travel','ua-es-wed','Мотріль',    'ES', 18, 'Cepsa',                  36.770238, -3.556822, 'https://maps.app.goo.gl/9ZYkCcoZjnr4s63aA', 'point'),
    ('express_sv_travel','ua-es-wed','Малага',     'ES', 19, 'Mercadillo de Huelin',   36.703111, -4.445077, 'https://maps.app.goo.gl/Gwnb6SgWEaN7vdHA8', 'address_and_point'),
    ('express_sv_travel','ua-es-wed','Фуенхерола', 'ES', 20, 'Autolavado 24h',         36.546434, -4.633475, 'https://maps.app.goo.gl/Z8ySfjZaQYZz4nH98', 'address_and_point'),
    ('express_sv_travel','ua-es-wed','Марбея',     'ES', 21, 'Shell',                  36.520024, -4.891923, 'https://maps.app.goo.gl/pbFjxkYuZFXR1m6J9', 'address_and_point'),
    ('express_sv_travel','ua-es-wed','Сан-Педро',  'ES', 22, 'CEPSA',                  36.479993, -4.993067, 'https://maps.app.goo.gl/Voh7LMBihXKgchecA', 'address_and_point'),
    ('express_sv_travel','ua-es-wed','Естепона',   'ES', 23, 'Cepsa',                  36.431556, -5.123500, 'https://maps.app.goo.gl/7V9VibZWznHFjJLS8', 'address_and_point')
ON CONFLICT (tenant_id, route_group, name_ua) DO NOTHING;

-- ─── 2. Матриця цін (з дзеркальним реверсом) ────────────────────
-- Той самий plpgsql-блок що й у базовій міграції, але з v_tenant='express_sv_travel'.
-- Правила:
--   Чернівці → Нюрнберг/Карлсруе: 150 EUR
--   Чернівці → Жерона..Естепона (16 міст): 200 EUR
--   {Братислава, Брно, Прага, Нюрнберг, Карлсруе} → Жерона..Естепона: 150 EUR
-- Дзеркальний реверс створюється автоматично для кожного правила.

DO $seed$
DECLARE
    v_tenant      TEXT := 'express_sv_travel';
    v_group       TEXT := 'ua-es-wed';

    v_from_chv    BIGINT;
    v_origin_id   BIGINT;
    v_dest_id     BIGINT;

    v_dest_name   TEXT;
    v_origin_name TEXT;

    v_chv_150 TEXT[] := ARRAY['Нюрнберг','Карлсруе'];
    v_chv_200 TEXT[] := ARRAY[
        'Жерона','Барселона','Тарагона','Тортоса','Валенсія',
        'Бенідорм','Аліканте','Торревеха','Мурсія','Алмеріа','Мотріль','Малага',
        'Фуенхерола','Марбея','Сан-Педро','Естепона'
    ];
    v_eu_dest_150 TEXT[] := ARRAY[
        'Жерона','Барселона','Тарагона','Тортоса','Валенсія',
        'Бенідорм','Аліканте','Торревеха','Мурсія','Алмеріа','Мотріль','Малага',
        'Фуенхерола','Марбея','Сан-Педро','Естепона'
    ];
    v_eu_origins TEXT[] := ARRAY['Братислава','Брно','Прага','Нюрнберг','Карлсруе'];
BEGIN
    SELECT id INTO v_from_chv FROM passenger_route_points
        WHERE tenant_id=v_tenant AND route_group=v_group AND name_ua='Чернівці';

    -- Чернівці → {Нюрнберг, Карлсруе}: 150 EUR + реверс
    FOREACH v_dest_name IN ARRAY v_chv_150 LOOP
        SELECT id INTO v_dest_id FROM passenger_route_points
            WHERE tenant_id=v_tenant AND route_group=v_group AND name_ua=v_dest_name;
        IF v_dest_id IS NOT NULL THEN
            INSERT INTO passenger_route_prices (tenant_id, from_point_id, to_point_id, currency, price)
                VALUES (v_tenant, v_from_chv, v_dest_id, 'EUR', 150)
            ON CONFLICT DO NOTHING;
            INSERT INTO passenger_route_prices (tenant_id, from_point_id, to_point_id, currency, price)
                VALUES (v_tenant, v_dest_id, v_from_chv, 'EUR', 150)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- Чернівці → весь іспанський блок: 200 EUR + реверс
    FOREACH v_dest_name IN ARRAY v_chv_200 LOOP
        SELECT id INTO v_dest_id FROM passenger_route_points
            WHERE tenant_id=v_tenant AND route_group=v_group AND name_ua=v_dest_name;
        IF v_dest_id IS NOT NULL THEN
            INSERT INTO passenger_route_prices (tenant_id, from_point_id, to_point_id, currency, price)
                VALUES (v_tenant, v_from_chv, v_dest_id, 'EUR', 200)
            ON CONFLICT DO NOTHING;
            INSERT INTO passenger_route_prices (tenant_id, from_point_id, to_point_id, currency, price)
                VALUES (v_tenant, v_dest_id, v_from_chv, 'EUR', 200)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- {Братислава, Брно, Прага, Нюрнберг, Карлсруе} → весь іспанський блок: 150 EUR + реверс
    FOREACH v_origin_name IN ARRAY v_eu_origins LOOP
        SELECT id INTO v_origin_id FROM passenger_route_points
            WHERE tenant_id=v_tenant AND route_group=v_group AND name_ua=v_origin_name;
        IF v_origin_id IS NULL THEN CONTINUE; END IF;

        FOREACH v_dest_name IN ARRAY v_eu_dest_150 LOOP
            SELECT id INTO v_dest_id FROM passenger_route_points
                WHERE tenant_id=v_tenant AND route_group=v_group AND name_ua=v_dest_name;
            IF v_dest_id IS NOT NULL THEN
                INSERT INTO passenger_route_prices (tenant_id, from_point_id, to_point_id, currency, price)
                    VALUES (v_tenant, v_origin_id, v_dest_id, 'EUR', 150)
                ON CONFLICT DO NOTHING;
                INSERT INTO passenger_route_prices (tenant_id, from_point_id, to_point_id, currency, price)
                    VALUES (v_tenant, v_dest_id, v_origin_id, 'EUR', 150)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END
$seed$;

-- Оновити REST-кеш Supabase, щоб фронтенд одразу побачив нові рядки
NOTIFY pgrst, 'reload schema';
