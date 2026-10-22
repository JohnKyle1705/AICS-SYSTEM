-- ============================================================
-- AICS Assessment Enforcement Migration
-- Municipality of Daanbantayan — MSWD
-- Run this in Supabase SQL Editor (once)
-- ============================================================

-- 1. Add new columns to assessments table
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS assessor_name        TEXT,
  ADD COLUMN IF NOT EXISTS assessor_designation TEXT,
  ADD COLUMN IF NOT EXISTS interview_time       TIME,
  ADD COLUMN IF NOT EXISTS documents_reviewed   TEXT,
  ADD COLUMN IF NOT EXISTS justification        TEXT,
  ADD COLUMN IF NOT EXISTS recommended_amount   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS assessment_status    TEXT DEFAULT 'submitted'
    CHECK (assessment_status IN ('submitted', 'amended')),
  ADD COLUMN IF NOT EXISTS submitted_at         TIMESTAMPTZ DEFAULT NOW();

-- 2. Keep existing scoring columns (no-op if already added)
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS eligibility_status TEXT,
  ADD COLUMN IF NOT EXISTS urgency_level      TEXT,
  ADD COLUMN IF NOT EXISTS priority_score     INTEGER,
  ADD COLUMN IF NOT EXISTS priority_level     TEXT,
  ADD COLUMN IF NOT EXISTS document_status    TEXT;

-- 3. Unique constraint: only one submitted assessment per request
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_one_per_request
  ON assessments (request_id)
  WHERE assessment_status = 'submitted';

-- 4. Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_assessments_request_id  ON assessments(request_id);
CREATE INDEX IF NOT EXISTS idx_assessments_assessed_by ON assessments(assessed_by);
CREATE INDEX IF NOT EXISTS idx_assessments_submitted_at ON assessments(submitted_at);

-- 5. Function to check if a valid assessment exists for a request
CREATE OR REPLACE FUNCTION public.has_submitted_assessment(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM assessments
  WHERE request_id = p_request_id
    AND assessment_status = 'submitted';
  RETURN v_count > 0;
END;
$$;

-- 6. Trigger function: block Approve/Decline without assessment
CREATE OR REPLACE FUNCTION public.enforce_assessment_before_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (NEW.status IN ('Approved', 'Declined') AND OLD.status = 'Pending') THEN
    IF NOT public.has_submitted_assessment(NEW.id) THEN
      RAISE EXCEPTION 'Action blocked - Assessment is required per AICS policy. Submit an assessment before approving or declining this request.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_assessment_before_decision ON requests;

CREATE TRIGGER trg_enforce_assessment_before_decision
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_assessment_before_decision();

-- 7. Update RLS policies on assessments
DROP POLICY IF EXISTS "Authenticated access" ON assessments;
DROP POLICY IF EXISTS "Admin can manage assessments" ON assessments;
DROP POLICY IF EXISTS "Treasurer can read assessments" ON assessments;
DROP POLICY IF EXISTS "Resident can read own request assessments" ON assessments;

CREATE POLICY "Admin can manage assessments"
  ON assessments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Treasurer can read assessments"
  ON assessments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'treasurer')
  );

CREATE POLICY "Resident can read own request assessments"
  ON assessments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = assessments.request_id
        AND r.encoded_by = auth.uid()
    )
  );

GRANT EXECUTE ON FUNCTION public.has_submitted_assessment(UUID) TO authenticated;

-- ============================================================
-- 8. Assessment Amendments table (preserves original assessment immutability)
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_amendments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE NOT NULL,
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE NOT NULL,
  amended_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  amendment_reason TEXT NOT NULL,
  previous_findings TEXT,
  new_findings TEXT,
  previous_recommendation TEXT,
  new_recommendation TEXT,
  previous_amount NUMERIC(10,2),
  new_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_amendments_assessment_id ON assessment_amendments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_amendments_request_id ON assessment_amendments(request_id);

ALTER TABLE assessment_amendments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage assessment amendments" ON assessment_amendments;
DROP POLICY IF EXISTS "Authenticated can read assessment amendments" ON assessment_amendments;

CREATE POLICY "Admin can manage assessment amendments"
  ON assessment_amendments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated can read assessment amendments"
  ON assessment_amendments FOR SELECT
  USING (
    auth.role() = 'authenticated'
  );
