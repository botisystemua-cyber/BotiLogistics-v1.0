-- 2026-04-27 — додати denormalized driver_name/vehicle_name у dispatches
--
-- Контекст: driver-crm у addRouteItem пише INSERT з полями driver_name і
-- vehicle_name; cargo-crm у dispatchRowToGas читає r.driver_name. Але цих
-- колонок у `dispatches` нема — є тільки FK driver_id/vehicle_id (UUID),
-- через які треба JOIN до staff/vehicles. Frontend цього не робить, тому
-- INSERT падає з «Could not find the 'driver_name' column of 'dispatches'
-- in the schema cache», а на читанні відповідні поля просто порожні.
--
-- Найпростіший фікс — додати колонки як text. Це denormalization, але
-- dispatches — append-only лог відправок водія, і JOIN'и нам тут не
-- потрібні. driver_id / vehicle_id лишаються для аналітики.

ALTER TABLE public.dispatches
  ADD COLUMN IF NOT EXISTS driver_name text,
  ADD COLUMN IF NOT EXISTS vehicle_name text;
