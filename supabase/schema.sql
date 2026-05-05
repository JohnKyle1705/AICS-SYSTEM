-- ============================================================
-- AICS Request Management & Beneficiary Information System
-- Municipality of Daanbantayan — MSWD
-- Database Schema for Supabase (PostgreSQL)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'encoder', 'resident')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. BENEFICIARIES
-- ============================================================
CREATE TABLE beneficiaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  suffix TEXT,
  birthdate DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  civil_status TEXT NOT NULL CHECK (civil_status IN ('Single', 'Married', 'Widowed', 'Separated', 'Annulled')),
  barangay TEXT NOT NULL,
  address TEXT NOT NULL,
  contact_number TEXT,
  is_pwd BOOLEAN DEFAULT false,
  is_senior BOOLEAN DEFAULT false,
  is_4ps BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. AICS REQUESTS
-- ============================================================
CREATE TABLE requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  beneficiary_id UUID REFERENCES beneficiaries(id) ON DELETE CASCADE NOT NULL,
  assistance_type TEXT NOT NULL CHECK (assistance_type IN ('Medical', 'Burial', 'Educational', 'Foods')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Released', 'Declined')),
  amount_requested NUMERIC(10,2),
  amount_approved NUMERIC(10,2),
  purpose TEXT NOT NULL,
  remarks TEXT,
  encoded_by UUID REFERENCES profiles(id),
  assessed_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. REQUEST DOCUMENTS
-- ============================================================
CREATE TABLE request_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. ASSESSMENTS
-- ============================================================
CREATE TABLE assessments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE NOT NULL,
  interview_date DATE NOT NULL,
  findings TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  home_visit BOOLEAN DEFAULT false,
  assessed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. PAYOUTS (Distribution Tracking)
-- ============================================================
CREATE TABLE payouts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE NOT NULL,
  amount_released NUMERIC(10,2) NOT NULL,
  release_date DATE NOT NULL,
  released_by UUID REFERENCES profiles(id),
  acknowledgment_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pending', 'incomplete', 'followup', 'info')),
  is_read BOOLEAN DEFAULT false,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. SYSTEM LOGS (Audit Trail)
-- ============================================================
CREATE TABLE system_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_beneficiaries_barangay ON beneficiaries(barangay);
CREATE INDEX idx_beneficiaries_name ON beneficiaries(last_name, first_name);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_type ON requests(assistance_type);
CREATE INDEX idx_requests_beneficiary ON requests(beneficiary_id);
CREATE INDEX idx_requests_created ON requests(created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_system_logs_user ON system_logs(user_id);
CREATE INDEX idx_system_logs_record ON system_logs(record_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Internal system: all authenticated users can access records
-- Authenticated users can read profiles
CREATE POLICY "Authenticated read profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins/staff can manage beneficiaries, Residents see only their own
CREATE POLICY "Beneficiaries access" ON beneficiaries FOR ALL USING (
  auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'encoder')
  )
);

-- Only admins/staff can manage requests, Residents see only their own
CREATE POLICY "Requests access" ON requests FOR ALL USING (
  auth.uid() = encoded_by OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'encoder')
  )
);
CREATE POLICY "Authenticated access" ON request_documents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated access" ON assessments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated access" ON payouts FOR ALL USING (auth.role() = 'authenticated');

-- Notifications: users see their own, admins see all
CREATE POLICY "Notifications own" ON notifications FOR ALL USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "System logs admin only" ON system_logs FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_beneficiaries_updated BEFORE UPDATE ON beneficiaries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assessments_updated BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STORAGE BUCKET (run via Supabase Dashboard → Storage → New Bucket)
-- Name: documents | Private: Yes
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policy: authenticated users can upload/read
-- CREATE POLICY "Authenticated upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'documents');
-- CREATE POLICY "Authenticated read" ON storage.objects FOR SELECT USING (auth.role() = 'authenticated' AND bucket_id = 'documents');
