-- 2026-04-20 — Прибрати застарілий global-unique constraint на ttn_number
--
-- Проблема: packages_ttn_number_key (UNIQUE btree(ttn_number)) — legacy, без
-- partial WHERE. Блокував створення нового ліда якщо архівований з тим же
-- ТТН уже існував, хоча бажана поведінка — «архівовані не рахуються».
-- Правильний partial-unique індекс packages_ttn_unique_active_idx
-- (WHERE is_archived=false AND ttn_number<>'') лишається і забезпечує
-- єдиність тільки для активних рядків.
--
-- Ефект: scan_ttn тепер може створити новий Невідомий лід навіть якщо
-- є архівований з тим же ТТН. User scenario: «відсканував → зберіг →
-- в CRM Невідомі з'явився новий лід» працює без ручного втручання.

ALTER TABLE public.packages DROP CONSTRAINT IF EXISTS packages_ttn_number_key;

NOTIFY pgrst, 'reload schema';
