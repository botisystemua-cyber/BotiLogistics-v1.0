-- 2026-04-20 — packages: додаємо дату створення накладної (ttn_date)
--
-- На картці посилки не вистачало двох речей: (1) можливості редагувати
-- «Дата відправки» — колонка dispatch_date існувала, але у фронті була
-- readonly; (2) окремого поля «Дата створення накладної» — коли саме
-- оператор виписав ТТН у НП. Додаємо лише колонку, все інше у фронті.
--
-- Тип date (а не timestamptz) — бо оператор вводить календарну дату без
-- часу; це вирівнює з dispatch_date / received_date.

BEGIN;

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS ttn_date date;

COMMIT;

NOTIFY pgrst, 'reload schema';
