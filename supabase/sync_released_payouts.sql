-- ============================================================
-- SQL Script: Backfill Payouts and Auto-Create on Release
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Backfill any existing released requests that do not have a record in the payouts table
INSERT INTO payouts (request_id, amount_released, release_date, released_by, acknowledgment_notes)
SELECT 
  r.id, 
  COALESCE(r.amount_approved, 0), 
  COALESCE(r.updated_at::date, r.created_at::date, CURRENT_DATE), 
  r.encoded_by,
  'Synced released assistance record'
FROM requests r
WHERE (r.status = 'Released' OR r.release_status = 'Released')
  AND COALESCE(r.amount_approved, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM payouts p WHERE p.request_id = r.id
  );

-- 2. Update trigger to automatically ensure payouts record exists when request is released
CREATE OR REPLACE FUNCTION process_request_fund_deduction()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_fund_id UUID;
  v_current_balance NUMERIC;
BEGIN
  -- Only deduct if status or release_status JUST changed to 'Released'
  IF (NEW.status = 'Released' AND (OLD.status IS NULL OR OLD.status != 'Released')) 
     OR (NEW.release_status = 'Released' AND (OLD.release_status IS NULL OR OLD.release_status != 'Released')) THEN
    
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

    -- Insert fund transaction log
    INSERT INTO fund_transactions (
      fund_id, transaction_type, amount, balance_after, request_id, remarks, processed_by
    ) VALUES (
      v_fund_id, 'Release', NEW.amount_approved, (v_current_balance - NEW.amount_approved), NEW.id, 'Automatic deduction upon release', auth.uid()
    );

    -- Auto-insert into payouts table if not already present
    IF NOT EXISTS (SELECT 1 FROM payouts WHERE request_id = NEW.id) THEN
      INSERT INTO payouts (
        request_id, amount_released, release_date, released_by, acknowledgment_notes
      ) VALUES (
        NEW.id, NEW.amount_approved, CURRENT_DATE, auth.uid(), 'Auto-recorded upon release'
      );
    END IF;
  END IF;

  -- Ensure status and release_status are in sync
  IF (NEW.release_status = 'Released' AND NEW.status != 'Released') THEN
      NEW.status = 'Released';
  ELSIF (NEW.status = 'Released' AND (NEW.release_status IS NULL OR NEW.release_status != 'Released')) THEN
      NEW.release_status = 'Released';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Ensure trigger is attached
DROP TRIGGER IF EXISTS trg_request_fund_deduction ON requests;
CREATE TRIGGER trg_request_fund_deduction
BEFORE UPDATE ON requests
FOR EACH ROW
EXECUTE FUNCTION process_request_fund_deduction();
