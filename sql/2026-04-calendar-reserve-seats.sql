-- Реєстрація колонки calendar.reserve_seats — додаткові «місця» поза схемою
-- авто (спальник, підлога, дитина на колінах). Зберігається на тенант, у пікері
-- рендериться окремою секцією під схемою як кнопки R1..RN.
--
-- Запущено через exec_sql RPC автоматично, скрипт лишений у репо для прозорості.

ALTER TABLE public.calendar
    ADD COLUMN IF NOT EXISTS reserve_seats integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.calendar.reserve_seats IS
    'Кількість додаткових (резервних) місць понад звичайні total_seats. '
    'Менеджер обирає 0..5 при створенні рейсу. У seat picker рендеряться '
    'як R1..RN під схемою авто. Не входять у total_seats.';
