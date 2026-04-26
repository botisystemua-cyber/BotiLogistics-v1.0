-- ============================================================================
-- 2026-04-add-cancel-reason.sql
--
-- Driver-CRM (PackageCard / PassengerCard / ShippingCard) у doCancel і doUndo
-- надсилав UPDATE з полем `cancel_reason`, але такої колонки ані в `routes`,
-- ані в `dispatches` не існувало → Supabase повертав помилку
-- «column does not exist», React-стан ревертився, водій бачив тільки
-- спіннер і лід застрягав у статусі «Готово»/«Скасов.».
--
-- Додаємо колонку як просте text-поле (NULL дозволено, без CHECK-constraint).
-- ============================================================================

ALTER TABLE public.routes     ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.dispatches ADD COLUMN IF NOT EXISTS cancel_reason text;

COMMENT ON COLUMN public.routes.cancel_reason
    IS 'Причина скасування / відміни статусу водієм у driver-crm.';
COMMENT ON COLUMN public.dispatches.cancel_reason
    IS 'Причина скасування / відміни статусу водієм у driver-crm.';
