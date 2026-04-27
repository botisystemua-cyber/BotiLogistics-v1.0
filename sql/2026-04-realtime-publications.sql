-- 2026-04-27 — Увімкнути Supabase Realtime для основних таблиць CRM
--
-- Контекст: коли водій сканує ТТН або тапає «Оплачено», менеджер у cargo-crm
-- зараз цього не бачить, доки не натисне «🔄 Оновити». Те саме для
-- passenger-crm. А водій не бачить коли менеджер відмінив рейс. Realtime
-- через WebSocket усуває цю прірву — клієнт (browser) отримує INSERT/UPDATE
-- події протягом 200мс і оновлює UI без перезавантаження.
--
-- Що робить цей скрипт:
--   1. REPLICA IDENTITY FULL — інакше у UPDATE-події приходить лише PK,
--      а нам треба бачити old values теж (для diff-логіки на клієнті).
--   2. Додає таблиці до publication `supabase_realtime` — це і є feed,
--      який слухає Realtime-сервер Supabase.
--
-- Idempotent: якщо таблиця вже у publication — DO/EXCEPTION ловить
-- duplicate_object і пропускає. Можна запускати повторно.

ALTER TABLE public.packages   REPLICA IDENTITY FULL;
ALTER TABLE public.routes     REPLICA IDENTITY FULL;
ALTER TABLE public.passengers REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.packages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.routes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.passengers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
