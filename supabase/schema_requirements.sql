-- ============================================================
-- 9. ASSISTANCE REQUIREMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS assistance_requirements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  assistance_type TEXT NOT NULL CHECK (assistance_type IN ('Medical', 'Burial', 'Educational', 'Foods')),
  document_name TEXT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assistance_requirements_type ON assistance_requirements(assistance_type);

-- RLS
ALTER TABLE assistance_requirements ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read requirements
CREATE POLICY "Authenticated read requirements" 
ON assistance_requirements FOR SELECT 
USING (auth.role() = 'authenticated');

-- Only admins and staff can manage requirements
CREATE POLICY "Admin and staff manage requirements" 
ON assistance_requirements FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')
  )
);

-- Seed Initial Data
INSERT INTO assistance_requirements (assistance_type, document_name, is_required)
VALUES 
  ('Educational', 'Certificate of Enrollment', true),
  ('Educational', 'School ID', true),
  ('Educational', 'Proof of Indigency', true),
  ('Educational', 'Diploma', false),
  
  ('Medical', 'Medical Certificate', true),
  ('Medical', 'Hospital Bill', true),
  ('Medical', 'Prescription', true),
  ('Medical', 'Barangay Certificate of Indigency', true),
  
  ('Foods', 'Barangay Certificate of Indigency', true),
  ('Foods', 'Valid ID', true),
  
  ('Burial', 'Death Certificate', true),
  ('Burial', 'Funeral Contract', true),
  ('Burial', 'Barangay Certificate of Indigency', true)
ON CONFLICT DO NOTHING;
