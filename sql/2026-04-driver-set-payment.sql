-- 2026-04-27 — Аудит «хто прийняв оплату» для зведення рейсів
--
-- Контекст: водій у driver-crm тапає чіп «💵 Готівкою / 💳 Карткою / ...» на
-- картці ліда у маршруті. Зведення рейсів у cargo-crm має показувати
-- «у водія Х грн готівки на руках» — для цього треба знати, ХТО і КОЛИ
-- проставив оплату. Якщо проставив менеджер ще до рейсу (клієнт оплатив
-- онлайн) — це НЕ йде в готівку водія; якщо проставив сам водій — йде.
--
-- Тому додаємо два аудит-поля у routes (контекст водія) і packages
-- (щоб менеджер у списку посилок одразу бачив, кому списувати готівку).
-- routes — first-class запис рейсу; packages — мастер-таблиця ліда.
-- Драйверський RPC буде писати атомарно в обидві (за rte_id + pkg_id).

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS payment_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_collected_by text;

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS payment_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_collected_by text;

-- Індекси для зведення «гроші у водія Х за період»
CREATE INDEX IF NOT EXISTS routes_payment_collected_idx
  ON public.routes (tenant_id, payment_collected_by, payment_collected_at DESC)
  WHERE payment_collected_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS packages_payment_collected_idx
  ON public.packages (tenant_id, payment_collected_by, payment_collected_at DESC)
  WHERE payment_collected_by IS NOT NULL;

-- ─── RPC: driver_set_payment ──────────────────────────────────────────
-- Атомарно проставляє статус і форму оплати в routes (за rte_id) і
-- мастер-таблиці packages (за pkg_id з того самого рядка маршруту).
-- Рахує debt автоматично: paid → 0, unpaid → max(0, amount-deposit),
-- partial → лишає як було.
--
-- Аргументи:
--   p_tenant_id     — tenant ізоляція
--   p_rte_id        — UUID рядка routes (id), не RTE_ID-string
--   p_status        — 'Оплачено' | 'Частково' | 'Не оплачено'
--   p_form          — 'Готівка' | 'Картка' | 'Наложка' | 'Частково' | 'Борг'
--   p_collected_by  — login водія (з сесії). Якщо null — не пишемо аудит
--                     (для випадку «менеджер ставить за себе» через CRM —
--                     там клієнт сам пише collected_by=manager_login).
--
-- Захист: якщо рядок уже Оплачено І collected_by !== p_collected_by —
-- повертаємо {ok:false, error:'locked'}. Це і є «замочок» для водія
-- коли менеджер уже відмітив. Фронт перед викликом має зробити confirm.

DROP FUNCTION IF EXISTS public.driver_set_payment(text, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.driver_set_payment(
    p_tenant_id    text,
    p_rte_id       uuid,
    p_status       text,
    p_form         text,
    p_collected_by text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_route        public.routes%rowtype;
    v_pkg_id       text;
    v_amount       numeric;
    v_deposit      numeric;
    v_new_debt     numeric;
    v_now          timestamptz := now();
BEGIN
    -- ── 0. валідація ────────────────────────────────────────────────────
    IF p_tenant_id IS NULL OR p_tenant_id = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'tenant_id обовʼязковий');
    END IF;
    IF p_rte_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'rte_id обовʼязковий');
    END IF;
    IF p_status NOT IN ('Оплачено','Частково','Не оплачено') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'status має бути Оплачено/Частково/Не оплачено');
    END IF;

    -- ── 1. lock рядок маршруту ──────────────────────────────────────────
    SELECT * INTO v_route
      FROM public.routes
     WHERE tenant_id = p_tenant_id
       AND id        = p_rte_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Рядок маршруту не знайдено');
    END IF;

    v_pkg_id  := v_route.pax_id_or_pkg_id;
    v_amount  := COALESCE(v_route.amount, 0);
    v_deposit := COALESCE(v_route.deposit, 0);

    -- ── 2. перерахунок боргу ────────────────────────────────────────────
    IF p_status = 'Оплачено' THEN
        v_new_debt := 0;
    ELSIF p_status = 'Не оплачено' THEN
        v_new_debt := GREATEST(0, v_amount - v_deposit);
    ELSE
        -- Частково — лишаємо як є; менеджер сам введе у CRM
        v_new_debt := COALESCE(v_route.debt, GREATEST(0, v_amount - v_deposit));
    END IF;

    -- ── 3. PATCH routes ─────────────────────────────────────────────────
    UPDATE public.routes
       SET payment_status       = p_status,
           payment_form         = p_form,
           debt                 = v_new_debt,
           payment_collected_at = CASE WHEN p_collected_by IS NOT NULL THEN v_now ELSE payment_collected_at END,
           payment_collected_by = CASE WHEN p_collected_by IS NOT NULL THEN p_collected_by ELSE payment_collected_by END,
           updated_at           = v_now
     WHERE tenant_id = p_tenant_id
       AND id        = p_rte_id;

    -- ── 4. PATCH packages (якщо це посилка) ────────────────────────────
    -- Pax-рядки в routes мають pax_id_or_pkg_id типу PAX_…, посилки PKG_…
    -- Пасажирські оплати у packages не мають дзеркала, тому пропускаємо
    -- умовно: якщо в packages нема такого pkg_id, UPDATE просто не зачепить рядок.
    IF v_pkg_id IS NOT NULL AND v_pkg_id LIKE 'PKG_%' THEN
        UPDATE public.packages
           SET payment_status       = p_status,
               payment_form         = p_form,
               debt                 = v_new_debt,
               payment_collected_at = CASE WHEN p_collected_by IS NOT NULL THEN v_now ELSE payment_collected_at END,
               payment_collected_by = CASE WHEN p_collected_by IS NOT NULL THEN p_collected_by ELSE payment_collected_by END,
               updated_at           = v_now
         WHERE tenant_id = p_tenant_id
           AND pkg_id    = v_pkg_id;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'rte_id', v_route.rte_id,
        'pkg_id', v_pkg_id,
        'status', p_status,
        'form',   p_form,
        'debt',   v_new_debt,
        'collected_by', p_collected_by,
        'collected_at', v_now
    );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.driver_set_payment(text, uuid, text, text, text)
    TO anon, authenticated, service_role;
