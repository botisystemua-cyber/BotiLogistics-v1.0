-- 2026-04-15 — packages/passengers.archived_from_routes
--
-- При архівації посилки (cargo-crm) або пасажира (passenger-crm), якщо лід
-- був у маршрутах — видаляємо route-рядки (бо рейс уже їхній не стосується),
-- але зберігаємо імена маршрутів у новій колонці, щоб у картці архіву було
-- видно "Був у маршруті: X, Y" для контексту.
--
-- Тип text (CSV, null якщо не був ніде). Безпечно додається до обох таблиць.

ALTER TABLE packages  ADD COLUMN IF NOT EXISTS archived_from_routes text;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS archived_from_routes text;
