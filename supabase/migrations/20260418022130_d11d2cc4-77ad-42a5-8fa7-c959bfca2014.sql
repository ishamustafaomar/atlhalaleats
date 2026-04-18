-- Add logo/image url to restaurants
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS logo_url text;

-- Storage bucket for restaurant logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-logos', 'restaurant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Restaurant logos are publicly viewable" ON storage.objects;
CREATE POLICY "Restaurant logos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-logos');

-- Authenticated users can upload
DROP POLICY IF EXISTS "Authenticated users can upload restaurant logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload restaurant logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'restaurant-logos');

-- Users can update/delete their own uploads (folder = user id)
DROP POLICY IF EXISTS "Users can update their own restaurant logos" ON storage.objects;
CREATE POLICY "Users can update their own restaurant logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'restaurant-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own restaurant logos" ON storage.objects;
CREATE POLICY "Users can delete their own restaurant logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'restaurant-logos' AND auth.uid()::text = (storage.foldername(name))[1]);