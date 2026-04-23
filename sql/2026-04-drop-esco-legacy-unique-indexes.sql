-- =========================================================================
-- Прибираємо унікальні індекси, які залишились з міграції ESCO.
-- =========================================================================
-- Контекст:
--   У ESCO-моделі rte_id/pay_id/dispatch_id/order_id були унікальні на
--   рядок (`rte_id` дорівнював PAX-ID чи PKG-ID конкретного ліда).
--   У поточній нормалізованій моделі `rte_id` — це назва маршруту
--   (наприклад, 'Женева'), і у таблиці routes має бути БАГАТО рядків
--   для одного маршруту (по одному на пасажира/посилку).
--   Залишений з міграції unique-індекс блокував додавання лідів у
--   маршрут через помилку
--     duplicate key value violates unique constraint "routes_esco_rte_uidx"
--     Key (tenant_id, rte_id)=(esco, Женева) already exists
--
-- Файл sql/2026-04-esco-phase4-finance-routes.sql (рядки 27-30) створює
-- саме ці індекси. Тут ми їх прибираємо, щоб запобігти регресії при
-- повторному імпорті даних.
-- =========================================================================

DROP INDEX IF EXISTS public.routes_esco_rte_uidx;
DROP INDEX IF EXISTS public.payments_esco_pay_uidx;
DROP INDEX IF EXISTS public.dispatches_esco_disp_uidx;
DROP INDEX IF EXISTS public.orders_esco_order_uidx;
