-- ================================================================
-- ESCO MIGRATION — PHASE 1 SCHEMA INSPECTOR
-- ================================================================
-- Мета: побачити реальні колонки 8 цільових таблиць ДО написання
-- INSERT'ів. Вставити весь файл у Supabase Dashboard → SQL Editor →
-- Run, результат скинути Claude.
--
-- Нічого не змінює у базі — тільки читає information_schema.
-- ================================================================

SELECT
    table_name,
    ordinal_position AS pos,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
      'system_settings',
      'app_content',
      'distribution_template',
      'notifications',
      'clients_directory',
      'staff',
      'users',
      'owner_account'
  )
ORDER BY table_name, ordinal_position;
