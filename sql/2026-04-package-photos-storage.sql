-- 2026-04-20 — storage bucket `package-photos` + policy для anon-завантажень.
--
-- ВАЖЛИВО: цей файл треба запустити **ВРУЧНУ** у Supabase Dashboard →
-- SQL Editor, бо storage.objects належить спецролю supabase_storage_admin
-- і звичайний exec_sql RPC не може на ньому створювати policies.
--
-- Що робить:
--   1. Створює public bucket `package-photos` (якщо ще нема) з лімітом 5MB
--      та дозволеними mime-типами image/jpeg, image/png, image/webp.
--   2. Дозволяє anon/authenticated завантажувати і читати в цей bucket.
--
-- Після запуску uploads з браузера (через sb.storage.from(…).upload)
-- почнуть працювати без 403 «violates row-level security policy».

-- ─── 1. Bucket (yes, дублікат — exec_sql уже створив, але IF-check безпечний) ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'package-photos', 'package-photos', true, 5242880,
    ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── 2. Policies ───────────────────────────────────────────────────────────
-- Дозволяємо anon + authenticated робити все в межах цього bucket'а
-- (SELECT/INSERT/UPDATE/DELETE). Інші bucket'и не зачіпаємо.

DROP POLICY IF EXISTS "pkg_photos_anon_rw" ON storage.objects;

CREATE POLICY "pkg_photos_anon_rw" ON storage.objects
    FOR ALL
    TO anon, authenticated
    USING (bucket_id = 'package-photos')
    WITH CHECK (bucket_id = 'package-photos');

-- Публічне читання для всіх (навіть без JWT) — щоб посилання на фото
-- з картки відкривались просто як web-URL, без авторизації.
DROP POLICY IF EXISTS "pkg_photos_public_read" ON storage.objects;

CREATE POLICY "pkg_photos_public_read" ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'package-photos');
