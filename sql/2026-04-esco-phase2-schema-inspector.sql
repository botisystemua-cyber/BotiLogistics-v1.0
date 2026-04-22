-- ============================================================================
-- ESCO MIGRATION — PHASE 2 SCHEMA INSPECTOR
-- ============================================================================
-- Перед Phase 2 (vehicles + calendar) треба побачити реальні колонки
-- цих двох таблиць і всі CHECK constraints.
--
-- ЯК ЗАПУСТИТИ
-- ------------
-- Supabase Dashboard → SQL Editor → New query → скопіювати ПО ЧЕРЗІ кожен
-- із двох SELECT нижче → Run → Download CSV (або скопіювати результат).
-- Надіслати обидва результати Claude.
--
-- Нічого не змінює у базі, тільки читає information_schema / pg_constraint.
-- ============================================================================


-- ── ЗАПИТ 1: колонки vehicles + calendar ────────────────────────────────
SELECT
    table_name,
    ordinal_position AS pos,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('vehicles', 'calendar')
ORDER BY table_name, ordinal_position;


-- ── ЗАПИТ 2: CHECK constraints на vehicles, calendar, passengers ────────
SELECT
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'c'
  AND conrelid::regclass::text IN ('vehicles', 'calendar', 'passengers');
