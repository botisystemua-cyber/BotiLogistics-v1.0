-- =========================================================================
-- ESCO MIGRATION — PHASE 6 (FINAL): MISC
-- =========================================================================
-- messages:           4
-- route_access:       3
-- client_app_access:  3  (без password_hash)
-- reviews:            1
-- client_ratings:     1
-- ────────────────────────
-- total:              12
-- =========================================================================

BEGIN;

-- ── Schema changes ──────────────────────────────────────────────
ALTER TABLE public.route_access ALTER COLUMN staff_id DROP NOT NULL;
ALTER TABLE public.route_access ALTER COLUMN route_id DROP NOT NULL;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS extra_data jsonb;
ALTER TABLE public.client_ratings ADD COLUMN IF NOT EXISTS extra_data jsonb;

-- ── Partial UNIQUE indexes (WHERE tenant='esco') ────────────────
CREATE UNIQUE INDEX IF NOT EXISTS messages_esco_msg_uidx ON public.messages (tenant_id, message_id) WHERE tenant_id = 'esco';
CREATE UNIQUE INDEX IF NOT EXISTS route_access_esco_acc_uidx ON public.route_access (tenant_id, access_id) WHERE tenant_id = 'esco';
CREATE UNIQUE INDEX IF NOT EXISTS client_app_access_esco_acc_uidx ON public.client_app_access (tenant_id, access_id) WHERE tenant_id = 'esco';
CREATE UNIQUE INDEX IF NOT EXISTS reviews_esco_rev_uidx ON public.reviews (tenant_id, review_id) WHERE tenant_id = 'esco';
CREATE UNIQUE INDEX IF NOT EXISTS client_ratings_esco_rat_uidx ON public.client_ratings (tenant_id, rate_id) WHERE tenant_id = 'esco';

-- ── messages (4) ─────────────────────────────────────
INSERT INTO public.messages (tenant_id, message_id, client_id, created_at, sender_role, sender_name, message_text, is_read, order_id) VALUES ('esco', 'MSG-MNJES395', (SELECT id FROM public.clients_directory WHERE tenant_id='esco' AND cli_id='CLI-20260403-2786' LIMIT 1), '2026-04-03 21:21:26'::timestamptz, 'manager', 'Менеджер', 'хелоу то я', true, NULL) ON CONFLICT (tenant_id, message_id) WHERE tenant_id = 'esco' DO NOTHING;
INSERT INTO public.messages (tenant_id, message_id, client_id, created_at, sender_role, sender_name, message_text, is_read, order_id) VALUES ('esco', 'MSG-MNJF4RFR', (SELECT id FROM public.clients_directory WHERE tenant_id='esco' AND cli_id='CLI-20260403-2786' LIMIT 1), '2026-04-03 21:31:17'::timestamptz, 'manager', 'Менеджер', 'Gjcbkr', true, NULL) ON CONFLICT (tenant_id, message_id) WHERE tenant_id = 'esco' DO NOTHING;
INSERT INTO public.messages (tenant_id, message_id, client_id, created_at, sender_role, sender_name, message_text, is_read, order_id) VALUES ('esco', 'MSG-20260404-IUD2', (SELECT id FROM public.clients_directory WHERE tenant_id='esco' AND cli_id='CLI-20260403-2786' LIMIT 1), '2026-04-04 00:32:18'::timestamptz, 'client', 'Богдан Цимбала', 'я прийняв посилкку', true, NULL) ON CONFLICT (tenant_id, message_id) WHERE tenant_id = 'esco' DO NOTHING;
INSERT INTO public.messages (tenant_id, message_id, client_id, created_at, sender_role, sender_name, message_text, is_read, order_id) VALUES ('esco', 'MSG-20260404-LFHW', (SELECT id FROM public.clients_directory WHERE tenant_id='esco' AND cli_id='CLI-20260404-H95Q' LIMIT 1), '2026-04-04 11:26:56'::timestamptz, 'client', 'Марина Тестова', 'привіт', NULL, NULL) ON CONFLICT (tenant_id, message_id) WHERE tenant_id = 'esco' DO NOTHING;

-- ── route_access (3) ────────────────────────────────
INSERT INTO public.route_access (tenant_id, access_id, staff_id, staff_name, staff_role, route_id, access_from_date, access_to_date, access_level, granted_date, access_status, notes) VALUES ('esco', 'ACC-MRT-001', (SELECT id FROM public.staff WHERE tenant_id='esco' AND staff_id='STF-001' LIMIT 1), 'Шевченко Олег', 'Водій', NULL, '2023-01-01'::date, NULL, 'Читання + Запис', '2023-01-01 00:00:00'::timestamptz, 'Активний', 'Маршрут: Цюріх | Хто надав: Власник | Постійний') ON CONFLICT (tenant_id, access_id) WHERE tenant_id = 'esco' DO NOTHING;
INSERT INTO public.route_access (tenant_id, access_id, staff_id, staff_name, staff_role, route_id, access_from_date, access_to_date, access_level, granted_date, access_status, notes) VALUES ('esco', 'ACC-MRT-002', (SELECT id FROM public.staff WHERE tenant_id='esco' AND staff_id='STF-001' LIMIT 1), 'Шевченко Олег', 'Водій', (SELECT id FROM public.routes WHERE tenant_id='esco' AND rte_id='RTE-20250610-C1M4' LIMIT 1), '2025-06-10'::date, '2025-06-13'::date, 'Читання + Запис', '2025-06-09 00:00:00'::timestamptz, 'Активний', 'Маршрут: Женева | Хто надав: Власник | Тільки цей рейс') ON CONFLICT (tenant_id, access_id) WHERE tenant_id = 'esco' DO NOTHING;
INSERT INTO public.route_access (tenant_id, access_id, staff_id, staff_name, staff_role, route_id, access_from_date, access_to_date, access_level, granted_date, access_status, notes) VALUES ('esco', 'ACC-MRT-003', (SELECT id FROM public.staff WHERE tenant_id='esco' AND staff_id='STF-002' LIMIT 1), 'Менеджер Оля', 'Менеджер', NULL, '2023-01-01'::date, NULL, 'Повний', '2023-01-01 00:00:00'::timestamptz, 'Активний', 'Маршрут: Всі маршрути | Хто надав: Власник') ON CONFLICT (tenant_id, access_id) WHERE tenant_id = 'esco' DO NOTHING;

-- ── client_app_access (3) ───────────────────────────
INSERT INTO public.client_app_access (tenant_id, access_id, client_id, phone, email, login, app_status, registered_date, last_login, last_device, is_blocked, block_reason, notes) VALUES ('esco', 'ACC-CLI-001', (SELECT id FROM public.clients_directory WHERE tenant_id='esco' AND cli_id='CLI-20230714-A1B2' LIMIT 1), '+380991234567', 'ivan@email.com', 'ivan_client', 'Активний', '2023-07-14 10:00:00'::timestamptz, '2025-06-06 12:00:00'::timestamptz, 'Android', false, NULL, NULL) ON CONFLICT (tenant_id, access_id) WHERE tenant_id = 'esco' DO NOTHING;
INSERT INTO public.client_app_access (tenant_id, access_id, client_id, phone, email, login, app_status, registered_date, last_login, last_device, is_blocked, block_reason, notes) VALUES ('esco', 'ACC-20260403-7252', (SELECT id FROM public.clients_directory WHERE tenant_id='esco' AND cli_id='CLI-20260403-2786' LIMIT 1), '+380639763484', NULL, 380639763484, 'Активний', '2026-04-03 21:16:03'::timestamptz, '2026-04-03 21:16:03'::timestamptz, NULL, NULL, NULL, NULL) ON CONFLICT (tenant_id, access_id) WHERE tenant_id = 'esco' DO NOTHING;
INSERT INTO public.client_app_access (tenant_id, access_id, client_id, phone, email, login, app_status, registered_date, last_login, last_device, is_blocked, block_reason, notes) VALUES ('esco', 'ACC-20260404-CELH', (SELECT id FROM public.clients_directory WHERE tenant_id='esco' AND cli_id='CLI-20260404-H95Q' LIMIT 1), '+380636363363', NULL, 380636363363, 'Активний', '2026-04-04 00:55:05'::timestamptz, '2026-04-04 00:55:05'::timestamptz, NULL, NULL, NULL, NULL) ON CONFLICT (tenant_id, access_id) WHERE tenant_id = 'esco' DO NOTHING;

-- ── reviews (1) ──────────────────────────────────────
INSERT INTO public.reviews (tenant_id, review_id, review_date, review_status, route_id, passenger_id, client_id, client_phone, client_name, record_type, driver_rating, driver_comment, driver_score, manager_rating, manager_comment, manager_score, general_review, processed_date, processing_result, extra_data) VALUES ('esco', 'REV-20250601-001', '2025-06-01'::date, 'Опрацьовано', (SELECT id FROM public.routes WHERE tenant_id='esco' AND rte_id='RTE-20250601-C1M4' LIMIT 1), (SELECT id FROM public.passengers WHERE tenant_id='esco' AND pax_id='PAX-20250601-A1B2' LIMIT 1), (SELECT id FROM public.clients_directory WHERE tenant_id='esco' AND cli_id='CLI-20230714-A1B2' LIMIT 1), '+380991234567', 'Іваненко Іван', 'Пасажир', NULL, 'Дуже комфортна поїздка', 5, NULL, 'Менеджер все організував', 5, 'Рекомендую всім! Швидко і зручно', '2025-06-02 00:00:00'::timestamptz, 'Подякували клієнту', '{"smart_id": "69140592", "route_date": "01.06.2025", "direction": "УК → ЄВ", "vehicle_number": "АВТ-01", "driver_name": "Шевченко Олег", "processed_flag": "Так", "processed_by_name": "Менеджер Оля"}'::jsonb) ON CONFLICT (tenant_id, review_id) WHERE tenant_id = 'esco' DO NOTHING;

-- ── client_ratings (1) ──────────────────────────────
INSERT INTO public.client_ratings (tenant_id, rate_id, rating_date, client_id, client_phone, client_name, route_id, passenger_id, record_type, driver_rating, driver_comment, driver_name, manager_rating, manager_comment, manager_name, extra_data) VALUES ('esco', 'RAT-20250601-001', '2025-06-01'::date, (SELECT id FROM public.clients_directory WHERE tenant_id='esco' AND cli_id='CLI-20230714-A1B2' LIMIT 1), '+380991234567', 'Іваненко Іван', (SELECT id FROM public.routes WHERE tenant_id='esco' AND rte_id='RTE-20250601-C1M4' LIMIT 1), (SELECT id FROM public.passengers WHERE tenant_id='esco' AND pax_id='PAX-20250601-A1B2' LIMIT 1), 'Пасажир', 5, 'Пунктуальний і ввічливий', 'Шевченко Олег', 5, 'Завжди на зв''язку', 'Оля', '{"route_date": "01.06.2025"}'::jsonb) ON CONFLICT (tenant_id, rate_id) WHERE tenant_id = 'esco' DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';