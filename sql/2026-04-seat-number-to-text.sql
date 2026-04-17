-- 2026-04-17 — passengers.seat_number, archive_passengers.seat_number: integer → text
--
-- SmartSender передає номер місця у форматі типу "А1-Б2" (буквено-цифрові
-- позначення), а в системі поле було integer — webhook падав на касті.
-- routes.seat_number вже text, тож узгоджуємо схему по таблицях пасажирів.
--
-- Інші таблиці з seat_number (seating, bookings) залишаємо integer —
-- вони працюють з числовою позицією місця у вагоні/розкладі, не з лейблом.
--
-- Виконується ідемпотентно: перевіряємо поточний тип перед ALTER.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'passengers'
           AND column_name = 'seat_number'
           AND data_type IN ('integer', 'numeric')
    ) THEN
        ALTER TABLE passengers
            ALTER COLUMN seat_number TYPE text USING seat_number::text;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'archive_passengers'
           AND column_name = 'seat_number'
           AND data_type IN ('integer', 'numeric')
    ) THEN
        ALTER TABLE archive_passengers
            ALTER COLUMN seat_number TYPE text USING seat_number::text;
    END IF;
END $$;
