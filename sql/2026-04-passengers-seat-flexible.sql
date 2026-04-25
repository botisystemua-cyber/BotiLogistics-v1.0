-- passengers.seat_flexible — гнучке (вільна розсадка) місце.
-- Якщо true — пасажир сидить на вказаному seat_number, але це місце «м'яке»:
-- коли інший пасажир обирає його як hard, цей flexible пасажир автоматично
-- переміщується на наступне вільне (Phase 2 — shuffle логіка в коді).
--
-- Phase 1: колонка зберігається, фронт виставляє true коли менеджер обирає
-- «🆓 Без місця» в trip-assign модалці (з авто-присвоєнням першого вільного).

ALTER TABLE public.passengers
    ADD COLUMN IF NOT EXISTS seat_flexible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.passengers.seat_flexible IS
    'true = «вільна розсадка» (м''яке місце, можна посунути авто-shuffle при конфлікті). '
    'false = жорстке місце (потребує ручного перерозподілу).';
