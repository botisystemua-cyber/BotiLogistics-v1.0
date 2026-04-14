-- Rename passengers.city -> passengers.messenger
-- Колонка тепер описує канал зв'язку з пасажиром (Telegram/WhatsApp/Viber/SmartSender/Дзвінок/тощо).
-- Формат: TEXT, опціонально. Існуючі дані (якщо є) просто переносяться як є, їх потім можна очистити вручну.
--
-- Safe-run: міграція ідемпотентна — якщо колонку вже перейменовано, ALTER нічого не зробить.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'passengers'
          AND column_name = 'city'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'passengers'
          AND column_name = 'messenger'
    ) THEN
        ALTER TABLE public.passengers RENAME COLUMN city TO messenger;
    END IF;
END $$;

COMMENT ON COLUMN public.passengers.messenger IS
    'Канал/месенджер, через який велася комунікація з пасажиром: Telegram, WhatsApp, Viber, SmartSender, Дзвінок або вільний текст.';
