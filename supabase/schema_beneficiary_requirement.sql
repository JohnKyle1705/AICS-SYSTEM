-- ============================================================
-- AICS Security Policy: Require Beneficiary Registration for Requests
-- Municipality of Daanbantayan — MSWD
-- ============================================================

-- 1. Ensure Row Level Security is active
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;

-- 2. Restrict beneficiaries access:
-- Residents can only access, view, and update their own beneficiary record.
-- Admins and Treasurers have system-wide access.
DROP POLICY IF EXISTS "Beneficiaries access" ON beneficiaries;
CREATE POLICY "Beneficiaries access" ON beneficiaries FOR ALL USING (
  auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'treasurer')
  )
);

-- 3. Restrict requests insert:
-- A resident can ONLY insert an AICS request if:
--   a) Their profile role is 'resident'
--   b) The beneficiary_id belongs to a completed beneficiary record created by the authenticated resident
DROP POLICY IF EXISTS "Requests insert" ON requests;
CREATE POLICY "Requests insert" ON requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'resident')
  AND
  beneficiary_id IN (SELECT id FROM beneficiaries WHERE created_by = auth.uid())
);

-- 4. Restrict requests select:
-- Residents can only select requests encoded by themselves.
DROP POLICY IF EXISTS "Requests select" ON requests;
CREATE POLICY "Requests select" ON requests FOR SELECT USING (
  encoded_by = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'treasurer')
  )
);
