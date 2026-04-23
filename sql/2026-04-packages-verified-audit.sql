-- =========================================================================
-- Аудит переходу посилки у «В перевірці»: хто, коли, звідки
-- =========================================================================
-- Раніше було тільки `quality_checked_at` (нечітка семантика — start чи complete).
-- Додаємо три чіткі колонки для аудиту моменту, коли лід потрапив у розділ
-- «Перевірка»:
--
--   verified_by     — менеджер/сканувальник, який натиснув «В перевірку».
--                     Користувацький login або відображуване імʼя.
--   verified_at     — timestamp переходу (start моменту, не завершення).
--   verified_source — 'crm' | 'scanner' — щоб розрізнити, звідки відбувся
--                     перехід (з панелі cargo-CRM чи з сканеру ТТН).
--
-- Відображається у cargo-crm вкладці ⚙ Системні (readonly).
-- =========================================================================

ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS verified_by text;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS verified_source text;
