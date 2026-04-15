-- 2026-04-15 — packages.quality_check_required: boolean → text
--
-- Фронт (cargo-crm) пише в «Контроль перевірки» один із трьох станів:
--   '' | 'В перевірці' | 'Готова до маршруту'
-- Колонка була boolean, тому PostgREST повертав type error і жодний апдейт
-- не зберігався (і бокова меню-перевірка завжди показувала 0 у лічильниках).
--
-- Old TRUE  → 'В перевірці' (потребує перевірки)
-- Old FALSE → NULL          (нічого не треба)
-- Old NULL  → NULL
--
-- Виконується ідемпотентно: перевіряємо поточний тип перед ALTER.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_name = 'packages'
           AND column_name = 'quality_check_required'
           AND data_type = 'boolean'
    ) THEN
        ALTER TABLE packages
            ALTER COLUMN quality_check_required TYPE text
            USING CASE
                WHEN quality_check_required IS TRUE THEN 'В перевірці'
                ELSE NULL
            END;
        ALTER TABLE packages ALTER COLUMN quality_check_required DROP DEFAULT;
    END IF;
END $$;
