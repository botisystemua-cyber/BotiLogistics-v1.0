-- 2026-04-27 — Об'єднання дублікатів у «Перевірці»
--
-- Контекст: клієнт відправляє три коробки, кожна реєструється з власним ТТН
-- (250, 255, 266) — у БД це 3 окремих рядки `packages` зі спільним
-- recipient_phone. Менеджер у «Перевірці» бачить дублікат-чіп «🔁 Ще 2»
-- (захід 1) і хоче обʼєднати їх в один лід. Один іде в маршрут, у деталях
-- ліда видно всі три ТТН.
--
-- Структурне рішення (варіант A — простіше і дозволяє розʼєднати):
--   Додаємо `merged_into_pkg_id` — FK на pkg_id «головного» ліда. Дочірні
--   ліди залишаються в БД зі своїми даними (для розʼєднання + аудиту), але
--   фронт-фільтр приховує їх зі списку перевірки.
--   merged_into_pkg_id IS NULL — це або одиночний лід, або primary
--   обʼєднання.

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS merged_into_pkg_id text;

-- Індекс на parent → fast lookup усіх дочок при відкритті primary-картки.
CREATE INDEX IF NOT EXISTS packages_merged_parent_idx
  ON public.packages (tenant_id, merged_into_pkg_id)
  WHERE merged_into_pkg_id IS NOT NULL;

-- FK захист: якщо primary-лід видалили чи архівували, дочка має сама
-- очиститись (стати окремим лідом), а не висіти orphan'ом. Тому ON DELETE
-- SET NULL. ON UPDATE CASCADE — якщо колись pkg_id мігрує (теоретично).
DO $$ BEGIN
  ALTER TABLE public.packages
    ADD CONSTRAINT packages_merged_into_pkg_fk
    FOREIGN KEY (tenant_id, merged_into_pkg_id)
    REFERENCES public.packages (tenant_id, pkg_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN
    -- Якщо UNIQUE(tenant_id, pkg_id) ще не існує — без FK обходимось,
    -- лишаємо тільки індекс. Реальної цілісності досягаємо в RPC.
    NULL;
END $$;
