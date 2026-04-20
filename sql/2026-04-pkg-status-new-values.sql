-- 2026-04-20 — packages.package_status: нормалізація до 5 значень
--
-- Замінюємо розширений набір (Прийнято/В дорозі/На складі/Доставлено/
-- Видано/Невідомий + англомовні delivered/pending/received від RPC)
-- на простий 5-значний UX-орієнтований набір:
--   Зареєстровано, Оформлення, Доставка, Доставлено, Невідомо.
--
-- «Все решта заміни на невідомі» (узгоджено з користувачем).

BEGIN;

UPDATE public.packages
SET package_status = CASE
  WHEN package_status IN ('delivered','Доставлено')      THEN 'Доставлено'
  WHEN package_status IN ('in_transit','В дорозі')       THEN 'Доставка'
  WHEN package_status IN ('received','Отримано')         THEN 'Зареєстровано'
  WHEN package_status = 'Оформлення'                     THEN 'Оформлення'
  ELSE 'Невідомо'
END;

COMMIT;

NOTIFY pgrst, 'reload schema';
