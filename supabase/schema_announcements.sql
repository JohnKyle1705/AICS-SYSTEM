-- SQL script to create Announcements table
-- Run this in your Supabase SQL Editor

-- ============================================================
-- 1. ANNOUNCEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_published BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);

-- RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can read published announcements
CREATE POLICY "Anyone can read published announcements" 
ON announcements FOR SELECT USING (is_published = true OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
));

-- Only admins can manage announcements
CREATE POLICY "Admins can manage announcements" 
ON announcements FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_announcements_updated') THEN
    CREATE TRIGGER trg_announcements_updated 
    BEFORE UPDATE ON announcements 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
