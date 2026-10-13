DROP POLICY IF EXISTS "Requests access" ON requests;
CREATE POLICY "Requests select update delete" ON requests FOR SELECT USING (
  auth.uid() = encoded_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Requests update delete" ON requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Requests delete" ON requests FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Requests insert" ON requests;
CREATE POLICY "Requests insert" ON requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'resident')
  AND
  beneficiary_id IN (SELECT id FROM beneficiaries WHERE created_by = auth.uid())
);
