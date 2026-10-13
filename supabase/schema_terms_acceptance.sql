-- ============================================================
-- AICS System – Terms & Conditions Acceptance Tracking
-- Run this migration to add server-side tracking of user
-- acceptance. This complements the client-side localStorage/
-- AsyncStorage approach.
-- ============================================================

-- Add terms acceptance columns to the profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT;

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_profiles_terms_version ON profiles(terms_version);

-- Optional: Create a dedicated audit table for terms acceptance history
CREATE TABLE IF NOT EXISTS terms_acceptance_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  terms_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE terms_acceptance_log ENABLE ROW LEVEL SECURITY;

-- Users can see their own acceptance history, admins can see all
CREATE POLICY "Terms acceptance own" ON terms_acceptance_log FOR ALL USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_user ON terms_acceptance_log(user_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_version ON terms_acceptance_log(terms_version);
