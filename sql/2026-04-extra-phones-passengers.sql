-- 2026-04-26 — додаткові номери пасажира (продовження міграції 2026-04-20).
--
-- Аналогічно `packages.extra_phones`, додаємо jsonb-масив додаткових
-- телефонів до `passengers`. У клієнта часто 2-3 номери (UA + EU),
-- первинний залишається в `phone`, додаткові — у цьому полі.

ALTER TABLE passengers
    ADD COLUMN IF NOT EXISTS extra_phones jsonb DEFAULT '[]'::jsonb;
