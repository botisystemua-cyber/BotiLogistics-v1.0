-- ================================================================
-- Passenger CRM: route points catalog, price matrix, client address history
-- ================================================================
-- Запроваджує каталог точок маршруту Україна ↔ Іспанія (середа, 16:00),
-- матрицю цін "звідки-куди" та історію адрес клієнтів для автопідставки.
--
-- Використання:
--   psql <connstr> -f 2026-04-passenger-route-points.sql
--
-- Ідемпотентний: повторний запуск не створить дублікатів (ON CONFLICT DO NOTHING).
-- ================================================================

-- ─── 1. Каталог точок маршруту ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS passenger_route_points (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      TEXT        NOT NULL,
    route_group    TEXT        NOT NULL DEFAULT 'ua-es-wed',  -- який маршрут: 'ua-es-wed' (Україна→Іспанія, середа)
    name_ua        TEXT        NOT NULL,                       -- "Чернівці", "Бенідорм"
    country_code   TEXT        NOT NULL,                       -- 'UA','RO','SK','CZ','DE','ES'
    sort_order     INTEGER     NOT NULL,                       -- порядок на маршруті 1..23
    location_name  TEXT,                                       -- "Центральний Автовокзал", "ORLEN", "Repsol" тощо
    lat            NUMERIC(9,6),
    lon            NUMERIC(9,6),
    maps_url       TEXT,                                       -- оригінальний shortlink Google Maps
    delivery_mode  TEXT        NOT NULL DEFAULT 'point'
                                        CHECK (delivery_mode IN ('point','address_and_point')),
    active         BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, route_group, name_ua)
);

CREATE INDEX IF NOT EXISTS idx_prp_tenant_group
    ON passenger_route_points (tenant_id, route_group, sort_order)
    WHERE active = TRUE;

-- ─── 2. Матриця цін за маршрутом (звідки → куди) ──────────────────
CREATE TABLE IF NOT EXISTS passenger_route_prices (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      TEXT        NOT NULL,
    from_point_id  BIGINT      NOT NULL REFERENCES passenger_route_points(id) ON DELETE CASCADE,
    to_point_id    BIGINT      NOT NULL REFERENCES passenger_route_points(id) ON DELETE CASCADE,
    currency       TEXT        NOT NULL DEFAULT 'EUR',
    price          NUMERIC(10,2) NOT NULL,
    active         BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, from_point_id, to_point_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_prprices_lookup
    ON passenger_route_prices (tenant_id, from_point_id, to_point_id, currency)
    WHERE active = TRUE;

-- ─── 3. Історія адрес клієнта (для автопідставки при повторних замовленнях) ──
CREATE TABLE IF NOT EXISTS passenger_client_addresses (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      TEXT        NOT NULL,
    phone          TEXT        NOT NULL,                      -- нормалізований (тільки цифри + "+")
    full_name      TEXT,
    point_id       BIGINT      NOT NULL REFERENCES passenger_route_points(id) ON DELETE CASCADE,
    address_text   TEXT        NOT NULL,
    address_type   TEXT        NOT NULL CHECK (address_type IN ('from','to')),
    use_count      INTEGER     NOT NULL DEFAULT 1,
    last_used_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, phone, point_id, address_type, address_text)
);

CREATE INDEX IF NOT EXISTS idx_pca_lookup
    ON passenger_client_addresses (tenant_id, phone, point_id, address_type, last_used_at DESC NULLS LAST);

-- ================================================================
-- SEED: 23 точки маршруту Україна → Іспанія (середа, виїзд 16:00)
-- ================================================================
-- Тенант: gresco (основний seed; для інших тенантів додати окремо)
-- Порядок: 1 = Чернівці, 23 = Естепона

INSERT INTO passenger_route_points
    (tenant_id, route_group, name_ua, country_code, sort_order, location_name, lat, lon, maps_url, delivery_mode)
VALUES
    ('gresco','ua-es-wed','Чернівці',   'UA',  1, 'Центральний Автовокзал', 48.264973, 25.951929, 'https://maps.app.goo.gl/1DnniH61uU5QKCKRA', 'point'),
    ('gresco','ua-es-wed','Сучава',     'RO',  2, NULL,                     NULL,       NULL,       NULL,                                          'point'),
    ('gresco','ua-es-wed','Братислава', 'SK',  3, 'ORLEN',                  48.181325, 17.054571, 'https://maps.app.goo.gl/Ynu84ZxBHkdoDHqM8', 'point'),
    ('gresco','ua-es-wed','Брно',       'CZ',  4, 'OMV',                    49.174340, 16.512950, 'https://maps.app.goo.gl/HkJjDxmxpS9m5iSs6', 'point'),
    ('gresco','ua-es-wed','Прага',      'CZ',  5, 'ORLEN',                  50.033641, 14.214376, 'https://maps.app.goo.gl/VcdYViqiJ7vBYFDA8', 'point'),
    ('gresco','ua-es-wed','Нюрнберг',   'DE',  6, 'Nürnberg',               49.454288, 11.074564, 'https://maps.app.goo.gl/8wFmrmrmYnTEEyXt6', 'point'),
    ('gresco','ua-es-wed','Карлсруе',   'DE',  7, 'Karlsruhe',              49.006890,  8.403653, 'https://maps.app.goo.gl/5SHCvCpjbq2DnukMA', 'point'),
    ('gresco','ua-es-wed','Жерона',     'ES',  8, 'Repsol',                 42.173453,  2.930165, 'https://maps.app.goo.gl/hACMpXvRBqJqHCey8', 'point'),
    ('gresco','ua-es-wed','Барселона',  'ES',  9, 'bp',                     41.493019,  2.099212, 'https://maps.app.goo.gl/4Edu9VxFPuqN2ngh6', 'point'),
    ('gresco','ua-es-wed','Тарагона',   'ES', 10, 'Tarragona',              41.118883,  1.244491, 'https://maps.app.goo.gl/gLFbMZSBXBxkwLXCA', 'point'),
    ('gresco','ua-es-wed','Тортоса',    'ES', 11, 'Campo Quality',          40.755046,  0.600016, 'https://maps.app.goo.gl/WNv4cSFnbtooRDE59', 'point'),
    ('gresco','ua-es-wed','Валенсія',   'ES', 12, 'Galp',                   39.400600, -0.493606, 'https://maps.app.goo.gl/w8xMkFLdLXAXvL697', 'point'),
    ('gresco','ua-es-wed','Бенідорм',   'ES', 13, 'Cepsa',                  38.535972, -0.202250, 'https://maps.app.goo.gl/w39jaTkkh5Q3986r9', 'address_and_point'),
    ('gresco','ua-es-wed','Аліканте',   'ES', 14, 'Avanza',                 38.383569, -0.489813, 'https://maps.app.goo.gl/uBqLymLwiip93S1V8', 'point'),
    ('gresco','ua-es-wed','Торревеха',  'ES', 15, 'Repsol',                 38.233350, -0.790679, 'https://maps.app.goo.gl/5ULGurVdCbcxx9VV8', 'point'),
    ('gresco','ua-es-wed','Мурсія',     'ES', 16, 'Repsol',                 38.102594, -1.035301, 'https://maps.app.goo.gl/u8Qti8AYxgbxVKUW6', 'point'),
    ('gresco','ua-es-wed','Алмеріа',    'ES', 17, 'Repsol',                 36.875419, -2.337874, 'https://maps.app.goo.gl/yXctG6nfcaN6A8gn7', 'point'),
    ('gresco','ua-es-wed','Мотріль',    'ES', 18, 'Cepsa',                  36.770238, -3.556822, 'https://maps.app.goo.gl/9ZYkCcoZjnr4s63aA', 'point'),
    ('gresco','ua-es-wed','Малага',     'ES', 19, 'Mercadillo de Huelin',   36.703111, -4.445077, 'https://maps.app.goo.gl/Gwnb6SgWEaN7vdHA8', 'address_and_point'),
    ('gresco','ua-es-wed','Фуенхерола', 'ES', 20, 'Autolavado 24h',         36.546434, -4.633475, 'https://maps.app.goo.gl/Z8ySfjZaQYZz4nH98', 'address_and_point'),
    ('gresco','ua-es-wed','Марбея',     'ES', 21, 'Shell',                  36.520024, -4.891923, 'https://maps.app.goo.gl/pbFjxkYuZFXR1m6J9', 'address_and_point'),
    ('gresco','ua-es-wed','Сан-Педро',  'ES', 22, 'CEPSA',                  36.479993, -4.993067, 'https://maps.app.goo.gl/Voh7LMBihXKgchecA', 'address_and_point'),
    ('gresco','ua-es-wed','Естепона',   'ES', 23, 'Cepsa',                  36.431556, -5.123500, 'https://maps.app.goo.gl/7V9VibZWznHFjJLS8', 'address_and_point')
ON CONFLICT (tenant_id, route_group, name_ua) DO NOTHING;

-- ================================================================
-- SEED: матриця цін
-- ================================================================
-- Правила з тексту замовника:
--   Чернівці → Нюрнберг/Карлсруе                     : 150 EUR
--   Чернівці → Жерона..Валенсія                       : 200 EUR
--   Чернівці → Бенідорм..Малага                       : 200 EUR
--   Чернівці → Фуенхерола..Естепона                   : 200 EUR
--   Братислава/Брно/Прага/Нюрнберг/Карлсруе → Жерона..Естепона : 150 EUR
-- Зворотний напрям: ціни дзеркально (підтверджено замовником).

DO $seed$
DECLARE
    v_tenant      TEXT := 'gresco';
    v_group       TEXT := 'ua-es-wed';

    -- helper масиви точок для діапазонів
    v_from_chv    BIGINT;
    v_from_brat   BIGINT;
    v_from_brno   BIGINT;
    v_from_prg    BIGINT;
    v_from_nur    BIGINT;
    v_from_krlr   BIGINT;

    v_dest_id     BIGINT;
    v_origin_id   BIGINT;

    v_dest_name   TEXT;
    v_origin_name TEXT;

    -- списки призначень за групами цін від Чернівців
    v_chv_150 TEXT[] := ARRAY['Нюрнберг','Карлсруе'];
    v_chv_200 TEXT[] := ARRAY[
        'Жерона','Барселона','Тарагона','Тортоса','Валенсія',
        'Бенідорм','Аліканте','Торревеха','Мурсія','Алмеріа','Мотріль','Малага',
        'Фуенхерола','Марбея','Сан-Педро','Естепона'
    ];

    -- список призначень 150€ з EU-хабів
    v_eu_dest_150 TEXT[] := ARRAY[
        'Жерона','Барселона','Тарагона','Тортоса','Валенсія',
        'Бенідорм','Аліканте','Торревеха','Мурсія','Алмеріа','Мотріль','Малага',
        'Фуенхерола','Марбея','Сан-Педро','Естепона'
    ];

    -- EU-хаби, з яких їде 150€
    v_eu_origins TEXT[] := ARRAY['Братислава','Брно','Прага','Нюрнберг','Карлсруе'];
BEGIN
    SELECT id INTO v_from_chv FROM passenger_route_points
        WHERE tenant_id=v_tenant AND route_group=v_group AND name_ua='Чернівці';

    -- Чернівці → {Нюрнберг, Карлсруе}: 150 EUR
    FOREACH v_dest_name IN ARRAY v_chv_150 LOOP
        SELECT id INTO v_dest_id FROM passenger_route_points
            WHERE tenant_id=v_tenant AND route_group=v_group AND name_ua=v_dest_name;
        IF v_dest_id IS NOT NULL THEN
            INSERT INTO passenger_route_prices (tenant_id, from_point_id, to_point_id, currency, price)
                VALUES (v_tenant, v_from_chv, v_dest_id, 'EUR', 150)
            ON CONFLICT DO NOTHING;
            -- реверс
            INSERT INTO passenger_route_prices (tenant_id, from_point_id, to_point_id, currency, price)
                VALUES (v_tenant, v_dest_id, v_from_chv, 'EUR', 150)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- Чернівці → весь іспанський блок: 200 EUR
    FOREACH v_dest_name IN ARRAY v_chv_200 LOOP
        SELECT id INTO v_dest_id FROM passenger_route_points
            WHERE tenant_id=v_tenant AND route_group=v_group AND name_ua=v_dest_name;
        IF v_dest_id IS NOT NULL THEN
            INSERT INTO passenger_route_prices (tenant_id, from_point_id, to_point_id, currency, price)
                VALUES (v_tenant, v_from_chv, v_dest_id, 'EUR', 200)
            ON CONFLICT DO NOTHING;
            -- реверс
            INSERT INTO passenger_route_prices (tenant_id, from_point_id, to_point_id, currency, price)
                VALUES (v_tenant, v_dest_id, v_from_chv, 'EUR', 200)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- {Братислава, Брно, Прага, Нюрнберг, Карлсруе} → весь іспанський блок: 150 EUR
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
                -- реверс
                INSERT INTO passenger_route_prices (tenant_id, from_point_id, to_point_id, currency, price)
                    VALUES (v_tenant, v_dest_id, v_origin_id, 'EUR', 150)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END
$seed$;
