-- ============================================================
-- AICS Fund Tracking Module Schema
-- Run this in your Supabase SQL Editor to apply
-- ============================================================

-- 1. Create Funds Table
CREATE TABLE IF NOT EXISTS funds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  assistance_type TEXT NOT NULL UNIQUE CHECK (assistance_type IN ('Medical', 'Burial')),
  total_allocated NUMERIC(15,2) DEFAULT 0,
  total_released NUMERIC(15,2) DEFAULT 0,
  current_balance NUMERIC(15,2) DEFAULT 0,
  low_balance_threshold NUMERIC(15,2) DEFAULT 10000,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- 2. Create Fund Transactions Table
CREATE TABLE IF NOT EXISTS fund_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fund_id UUID REFERENCES funds(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Allocation', 'Release', 'Adjustment')),
  amount NUMERIC(15,2) NOT NULL,
  balance_after NUMERIC(15,2) NOT NULL,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL, -- Null if allocation/adjustment
  remarks TEXT,
  processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security Policies
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_transactions ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access funds" ON funds FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins full access fund_transactions" ON fund_transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Treasurers can READ funds and fund_transactions
CREATE POLICY "Treasurers read funds" ON funds FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'treasurer')
);
CREATE POLICY "Treasurers read fund_transactions" ON fund_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'treasurer')
);

-- Treasurers can INSERT into fund_transactions (via the trigger)
-- The trigger runs with elevated privileges (SECURITY DEFINER) so they actually don't need direct access.
CREATE POLICY "Treasurers insert fund_transactions" ON fund_transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'treasurer')
);

-- 4. Create the Automatic Deduction Trigger Function on requests table
-- This function runs when a request status is updated to 'Released'.
CREATE OR REPLACE FUNCTION process_request_fund_deduction()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_fund_id UUID;
  v_current_balance NUMERIC;
BEGIN
  -- Only deduct if status or release_status JUST changed to 'Released'
  IF (NEW.status = 'Released' AND OLD.status != 'Released') OR (NEW.release_status = 'Released' AND (OLD.release_status IS NULL OR OLD.release_status != 'Released')) THEN
    
    -- Get fund record
    SELECT id, current_balance INTO v_fund_id, v_current_balance
    FROM funds WHERE assistance_type = NEW.assistance_type;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fund tracking not initialized for assistance type %', NEW.assistance_type;
    END IF;

    IF COALESCE(NEW.amount_approved, 0) <= 0 THEN
      RAISE EXCEPTION 'Cannot release request. Approved amount must be greater than 0.';
    END IF;

    IF v_current_balance < NEW.amount_approved THEN
      RAISE EXCEPTION 'Insufficient funds. Available: %, Requested: %', v_current_balance, NEW.amount_approved;
    END IF;

    -- Update funds
    UPDATE funds 
    SET 
      total_released = total_released + NEW.amount_approved,
      current_balance = current_balance - NEW.amount_approved,
      updated_at = NOW(),
      updated_by = auth.uid()
    WHERE id = v_fund_id;

    -- Insert transaction log
    INSERT INTO fund_transactions (
      fund_id, transaction_type, amount, balance_after, request_id, remarks, processed_by
    ) VALUES (
      v_fund_id, 'Release', NEW.amount_approved, (v_current_balance - NEW.amount_approved), NEW.id, 'Automatic deduction upon release', auth.uid()
    );
  END IF;

  -- Ensure we sync the statuses so they match if one of them is marked released
  IF (NEW.release_status = 'Released' AND NEW.status != 'Released') THEN
      NEW.status = 'Released';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the requests table
DROP TRIGGER IF EXISTS trg_request_fund_deduction ON requests;
CREATE TRIGGER trg_request_fund_deduction
BEFORE UPDATE ON requests
FOR EACH ROW
EXECUTE FUNCTION process_request_fund_deduction();

-- 5. Seed Initial Data
-- Create 0-balance records so they exist immediately for the Admin to update
INSERT INTO funds (assistance_type, total_allocated, total_released, current_balance, low_balance_threshold)
VALUES 
  ('Medical', 0, 0, 0, 10000),
  ('Burial', 0, 0, 0, 10000)
ON CONFLICT (assistance_type) DO NOTHING;
