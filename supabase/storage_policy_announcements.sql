-- Run this script in your Supabase SQL Editor

-- 1. Create the announcements bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist to prevent conflicts
DROP POLICY IF EXISTS "announcements_public_read" ON storage.objects;
DROP POLICY IF EXISTS "announcements_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "announcements_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "announcements_auth_delete" ON storage.objects;

-- 2. Allow public read access to the announcements bucket
CREATE POLICY "announcements_public_read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'announcements');

-- 3. Allow authenticated users to upload to the announcements bucket
CREATE POLICY "announcements_auth_upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' AND 
  bucket_id = 'announcements'
);

-- 4. Allow authenticated users to update their own uploads (optional, but good for editing)
CREATE POLICY "announcements_auth_update" 
ON storage.objects FOR UPDATE 
USING (
  auth.role() = 'authenticated' AND 
  bucket_id = 'announcements'
);

-- 5. Allow authenticated users to delete announcements (optional, for cleanup)
CREATE POLICY "announcements_auth_delete" 
ON storage.objects FOR DELETE 
USING (
  auth.role() = 'authenticated' AND 
  bucket_id = 'announcements'
);
