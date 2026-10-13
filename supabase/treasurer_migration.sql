-- 1. Add Treasurer to profiles role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'resident', 'treasurer'));

-- 2. Add release_status to requests
ALTER TABLE requests ADD COLUMN IF NOT EXISTS release_status TEXT CHECK (release_status IN ('Pending Release', 'Ready for Release', 'Released'));

-- 3. Add RLS policy for treasurer
CREATE POLICY "Treasurer requests access" ON requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'treasurer') AND status = 'Approved'
);

CREATE POLICY "Treasurer requests update" ON requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'treasurer')
);
