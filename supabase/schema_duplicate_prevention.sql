-- ============================================================
-- AICS System – Duplicate Claim Prevention
-- Run this migration to add system settings and 
-- the database trigger to prevent multiple active requests.
-- ============================================================

-- 1. Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Enable RLS for system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Public read settings" ON system_settings FOR SELECT USING (true);

-- Only admins can update settings
CREATE POLICY "Admins update settings" ON system_settings FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Insert default duplicate restriction days (30 days)
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('duplicate_restriction_days', '30', 'Number of days to restrict submitting the same assistance type.')
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Create the duplicate check function
CREATE OR REPLACE FUNCTION check_duplicate_request()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count INT;
  v_same_type_count INT;
  v_restriction_days INT;
BEGIN
  -- Check 1: Prevent multiple active requests of any type
  -- 'Pending' or 'Approved' are considered active in this system
  SELECT COUNT(*) INTO v_active_count
  FROM requests
  WHERE beneficiary_id = NEW.beneficiary_id
    AND status IN ('Pending', 'Approved')
    AND id != NEW.id; -- Ensure it doesn't count itself if updating

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'DUPLICATE_ACTIVE: You already have an existing AICS request that is currently being processed. Multiple active requests are not allowed.';
  END IF;

  -- Check 2: Prevent same assistance type within restriction period
  -- Get restriction days from settings (default to 30 if missing)
  SELECT COALESCE(
    (SELECT setting_value::INT FROM system_settings WHERE setting_key = 'duplicate_restriction_days'), 
    30
  ) INTO v_restriction_days;

  SELECT COUNT(*) INTO v_same_type_count
  FROM requests
  WHERE beneficiary_id = NEW.beneficiary_id
    AND assistance_type = NEW.assistance_type
    AND created_at >= (NOW() - (v_restriction_days || ' days')::INTERVAL)
    AND id != NEW.id;

  IF v_same_type_count > 0 THEN
    RAISE EXCEPTION 'DUPLICATE_TYPE: You have already submitted a request for % assistance within the last % days.', NEW.assistance_type, v_restriction_days;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger to requests table
DROP TRIGGER IF EXISTS trg_check_duplicate_request ON requests;
CREATE TRIGGER trg_check_duplicate_request
  BEFORE INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_request();
