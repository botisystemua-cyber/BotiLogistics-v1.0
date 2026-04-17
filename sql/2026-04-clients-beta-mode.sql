-- Бета-доступ для клієнтів (тенантів).
--
-- Додає 3 колонки в public.clients:
--   is_beta           — прапорець "бета-тенант"
--   beta_expires_at   — коли бета згорає (NULL = нескінченно)
--   beta_promoted_at  — коли бета промоутнули до основної версії
--
-- Створює 2 RPC:
--   public.promote_tenant(tenant_id)
--     — знімає is_beta, очищує beta_expires_at, фіксує beta_promoted_at=now().
--   public.delete_tenant_data(tenant_id, confirm)
--     — каскадно видаляє все, що належить тенанту (всі таблиці public.*
--       з колонкою tenant_id), потім сам рядок у clients.
--       Для захисту вимагає, щоб confirm дорівнював tenant_id.
--
-- Міграція ідемпотентна: IF NOT EXISTS / OR REPLACE.
-- Працює на уже існуючих даних без змін: всі поточні клієнти — is_beta=false.

-- ── 1. Columns ──────────────────────────────────────────────────────────
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_beta           BOOLEAN     NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS beta_expires_at   TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS beta_promoted_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.clients.is_beta          IS 'Чи це бета-тенант (тимчасовий акаунт для тестування).';
COMMENT ON COLUMN public.clients.beta_expires_at  IS 'Коли бета-доступ автоматично втрачає силу. NULL = без обмежень.';
COMMENT ON COLUMN public.clients.beta_promoted_at IS 'Коли тенант було промоутнуто з бети в основну версію.';

CREATE INDEX IF NOT EXISTS clients_is_beta_idx ON public.clients (is_beta) WHERE is_beta = true;

-- ── 2. promote_tenant(tenant_id) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.promote_tenant(p_tenant_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.clients;
BEGIN
  UPDATE public.clients
     SET is_beta          = false,
         beta_expires_at  = NULL,
         beta_promoted_at = now(),
         updated_at       = now()
   WHERE tenant_id = p_tenant_id
   RETURNING * INTO updated_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_not_found', 'tenant_id', p_tenant_id);
  END IF;

  RETURN jsonb_build_object(
    'ok',               true,
    'tenant_id',        updated_row.tenant_id,
    'beta_promoted_at', updated_row.beta_promoted_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.promote_tenant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_tenant(text) TO anon, authenticated, service_role;

-- ── 3. delete_tenant_data(tenant_id, confirm) ───────────────────────────
-- Видаляє ВСЕ по тенанту: iterates по всіх таблицях public.* з колонкою
-- tenant_id і виконує DELETE WHERE tenant_id = ?. В кінці видаляє сам
-- рядок у clients. Повертає breakdown по кількості рядків на таблицю.
--
-- БЕЗПЕКА: щоб не вистрілити в ногу, вимагаємо, щоб p_confirm === p_tenant_id.
CREATE OR REPLACE FUNCTION public.delete_tenant_data(p_tenant_id text, p_confirm text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r           record;
  cnt         bigint;
  total       bigint := 0;
  breakdown   jsonb  := '{}'::jsonb;
BEGIN
  IF p_confirm IS NULL OR p_confirm <> p_tenant_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'confirm_mismatch',
      'hint',  'pass tenant_id as confirm to proceed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE tenant_id = p_tenant_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_not_found', 'tenant_id', p_tenant_id);
  END IF;

  -- Iterate по всіх таблицях public.* з колонкою tenant_id (окрім самої clients)
  FOR r IN
    SELECT c.table_name
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.column_name  = 'tenant_id'
       AND c.table_name  <> 'clients'
       AND EXISTS (
         SELECT 1 FROM information_schema.tables t
          WHERE t.table_schema = 'public'
            AND t.table_name   = c.table_name
            AND t.table_type   = 'BASE TABLE'
       )
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE tenant_id = $1', r.table_name) USING p_tenant_id;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    IF cnt > 0 THEN
      breakdown := breakdown || jsonb_build_object(r.table_name, cnt);
      total     := total + cnt;
    END IF;
  END LOOP;

  -- Нарешті сам клієнт (тенант)
  DELETE FROM public.clients WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  IF cnt > 0 THEN
    breakdown := breakdown || jsonb_build_object('clients', cnt);
    total     := total + cnt;
  END IF;

  RETURN jsonb_build_object(
    'ok',        true,
    'tenant_id', p_tenant_id,
    'total',     total,
    'breakdown', breakdown
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_tenant_data(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_tenant_data(text, text) TO anon, authenticated, service_role;
