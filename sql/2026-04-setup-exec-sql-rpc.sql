-- ============================================================================
-- ONE-TIME SETUP: create public.exec_sql() RPC for running DDL via service_role.
-- ============================================================================
-- Запустити РАЗ у Supabase Dashboard → SQL Editor → Run.
-- Після цього будь-яка автоматизація з service_role-ключем зможе виконувати
-- довільний SQL (включаючи DDL) через REST: POST /rest/v1/rpc/exec_sql.
--
-- Безпека:
--   • EXECUTE дозволено ТІЛЬКИ ролі service_role (anon/authenticated заблоковані).
--   • Оскільки service_role bypass-ить RLS і може все, функція не розширює
--     його права — вона просто дає зручний канал виконання DDL.
--   • Якщо service_role-ключ "витече" — власник такого ключа і так мав би
--     повний доступ через direct Postgres. Ця функція нічого не погіршує.
-- ============================================================================

-- Якщо функція вже існує з іншою сигнатурою/return type — дропаємо, щоб
-- уникнути "42P13: cannot change return type of existing function".
drop function if exists public.exec_sql(text);

create or replace function public.exec_sql(query text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    res jsonb;
    row_count bigint;
begin
    -- Виконуємо довільний SQL (DDL або DML). Якщо це SELECT — результат
    -- не повертаємо (для цього використовуй звичайний PostgREST).
    execute query;
    get diagnostics row_count = ROW_COUNT;

    return jsonb_build_object(
        'ok', true,
        'rows_affected', row_count
    );
exception when others then
    return jsonb_build_object(
        'ok', false,
        'error', sqlerrm,
        'sqlstate', sqlstate
    );
end;
$$;

-- Обмежуємо доступ: тільки service_role може викликати.
revoke all on function public.exec_sql(text) from public;
revoke all on function public.exec_sql(text) from anon;
revoke all on function public.exec_sql(text) from authenticated;
grant execute on function public.exec_sql(text) to service_role;

comment on function public.exec_sql(text) is
    'Admin-only DDL/DML executor. Доступна лише service_role. Повертає {ok, rows_affected} або {ok:false, error, sqlstate}.';
