-- ============================================================================
-- AICS Treasurer Financial Workflow Migration
-- Municipality of Daanbantayan — MSWD
--
-- Run this ONCE in Supabase Dashboard → SQL Editor.  It is idempotent (safe to
-- re-run) and NEVER deletes existing records.
--
-- What it does
--   1. Adds audit-grade columns to fund_transactions / requests / payouts.
--   2. Creates financial_processing_log (per-request financial history).
--   3. Replaces the release trigger with a hardened version
--        • no release unless the request was Admin-approved
--        • no duplicate release for the same request
--        • row-level locking on the fund (no race conditions)
--        • optional "treasury must process first" policy
--   4. Adds SECURITY DEFINER RPCs that perform every multi-table financial
--      operation atomically and validate the caller's role server-side:
--        treasurer_process_request, treasurer_return_request,
--        confirm_request_release, record_fund_transaction,
--        reverse_fund_transaction, update_fund_threshold,
--        get_treasury_summary
--   5. Tightens RLS so funds / ledger / payouts can only be changed via RPCs,
--      Treasurers can read (not edit) the requests & beneficiaries they need,
--      and the ledger is append-only (corrections = reversals).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 0. HELPERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aics_current_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND COALESCE(is_active, true) = true
$$;

-- ----------------------------------------------------------------------------
-- 1. SYSTEM SETTINGS (table was missing in the live database)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key   TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  description   TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    UUID REFERENCES profiles(id) ON DELETE SET NULL
);
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read settings"   ON system_settings;
DROP POLICY IF EXISTS "Admins update settings" ON system_settings;
CREATE POLICY "Public read settings" ON system_settings FOR SELECT USING (true);
CREATE POLICY "Admins update settings" ON system_settings FOR ALL
  USING (public.aics_current_role() = 'admin')
  WITH CHECK (public.aics_current_role() = 'admin');

INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('treasurer_can_release', 'false',
   'If true, Treasurers may confirm the official release themselves. Default: only the Admin confirms release.'),
  ('require_treasury_processing', 'true',
   'If true, a request must be processed by the Treasurer (voucher recorded) before it can be released.')
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.aics_setting(p_key TEXT, p_default TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT setting_value FROM system_settings WHERE setting_key = p_key), p_default)
$$;

-- ----------------------------------------------------------------------------
-- 2. AUDIT + NOTIFICATION HELPERS
-- ----------------------------------------------------------------------------
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

CREATE OR REPLACE FUNCTION public.aics_audit(p_action TEXT, p_table TEXT, p_record UUID, p_details JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO system_logs (user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), p_action, p_table, p_record,
          COALESCE(p_details, '{}'::jsonb) || jsonb_build_object('role', public.aics_current_role()));
END;
$$;

CREATE OR REPLACE FUNCTION public.aics_notify_role(
  p_role TEXT, p_title TEXT, p_message TEXT, p_type TEXT, p_request_id UUID, p_link TEXT, p_exclude UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, request_id, link)
  SELECT p.id, p_title, p_message, p_type, p_request_id, p_link
  FROM profiles p
  WHERE p.role = p_role AND COALESCE(p.is_active, true) = true
    AND (p_exclude IS NULL OR p.id <> p_exclude);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. FUND TRANSACTIONS — append-only ledger with reference numbers & reversals
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS fund_tx_ref_seq;

ALTER TABLE fund_transactions ADD COLUMN IF NOT EXISTS reference_no    TEXT;
ALTER TABLE fund_transactions ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'Completed';
ALTER TABLE fund_transactions ADD COLUMN IF NOT EXISTS direction       SMALLINT;
ALTER TABLE fund_transactions ADD COLUMN IF NOT EXISTS assistance_type TEXT;
ALTER TABLE fund_transactions ADD COLUMN IF NOT EXISTS reversal_of     UUID REFERENCES fund_transactions(id) ON DELETE RESTRICT;
ALTER TABLE fund_transactions ADD COLUMN IF NOT EXISTS reversed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE fund_transactions ADD COLUMN IF NOT EXISTS reversed_at     TIMESTAMPTZ;
ALTER TABLE fund_transactions ADD COLUMN IF NOT EXISTS reversal_reason TEXT;
ALTER TABLE fund_transactions ADD COLUMN IF NOT EXISTS approved_by     UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE fund_transactions DROP CONSTRAINT IF EXISTS fund_transactions_transaction_type_check;
ALTER TABLE fund_transactions ADD CONSTRAINT fund_transactions_transaction_type_check
  CHECK (transaction_type IN ('Opening Balance', 'Allocation', 'Release', 'Adjustment', 'Reversal'));
ALTER TABLE fund_transactions DROP CONSTRAINT IF EXISTS fund_transactions_status_check;
ALTER TABLE fund_transactions ADD CONSTRAINT fund_transactions_status_check
  CHECK (status IN ('Completed', 'Reversed'));

-- Backfill (existing semantics: Allocation adds, Release/Adjustment deduct)
UPDATE fund_transactions SET direction = CASE WHEN transaction_type IN ('Allocation', 'Opening Balance') THEN 1 ELSE -1 END
WHERE direction IS NULL;
UPDATE fund_transactions ft SET assistance_type = f.assistance_type
FROM funds f WHERE ft.fund_id = f.id AND ft.assistance_type IS NULL;
WITH ordered AS (
  SELECT id, created_at FROM fund_transactions WHERE reference_no IS NULL ORDER BY created_at, id
)
UPDATE fund_transactions ft
SET reference_no = 'FT-' || to_char(o.created_at, 'YYYY') || '-' || lpad(nextval('fund_tx_ref_seq')::text, 6, '0')
FROM ordered o WHERE ft.id = o.id;

ALTER TABLE fund_transactions ALTER COLUMN direction SET NOT NULL;
ALTER TABLE fund_transactions DROP CONSTRAINT IF EXISTS fund_transactions_direction_check;
ALTER TABLE fund_transactions ADD CONSTRAINT fund_transactions_direction_check CHECK (direction IN (1, -1));
CREATE UNIQUE INDEX IF NOT EXISTS uq_fund_tx_reference_no ON fund_transactions(reference_no);
CREATE INDEX IF NOT EXISTS idx_fund_tx_request    ON fund_transactions(request_id);
CREATE INDEX IF NOT EXISTS idx_fund_tx_created    ON fund_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fund_tx_type       ON fund_transactions(transaction_type, status);

-- Defaults on insert
CREATE OR REPLACE FUNCTION public.fund_tx_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reference_no IS NULL THEN
    NEW.reference_no := 'FT-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('fund_tx_ref_seq')::text, 6, '0');
  END IF;
  IF NEW.direction IS NULL THEN
    NEW.direction := CASE WHEN NEW.transaction_type IN ('Allocation', 'Opening Balance') THEN 1 ELSE -1 END;
  END IF;
  IF NEW.assistance_type IS NULL AND NEW.fund_id IS NOT NULL THEN
    SELECT assistance_type INTO NEW.assistance_type FROM funds WHERE id = NEW.fund_id;
  END IF;
  IF NEW.processed_by IS NULL THEN NEW.processed_by := auth.uid(); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_fund_tx_before_insert ON fund_transactions;
CREATE TRIGGER trg_fund_tx_before_insert BEFORE INSERT ON fund_transactions
FOR EACH ROW EXECUTE FUNCTION public.fund_tx_before_insert();

-- Immutability: financial rows can never be deleted or edited. The only
-- permitted update is marking a row "Reversed" from inside reverse_fund_transaction,
-- or FK columns being nulled by ON DELETE SET NULL.
CREATE OR REPLACE FUNCTION public.fund_tx_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'LEDGER_IMMUTABLE: Financial transactions cannot be deleted. Record a reversal instead.';
  END IF;
  IF current_setting('aics.ledger_write', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.amount = OLD.amount AND NEW.direction = OLD.direction
     AND NEW.transaction_type = OLD.transaction_type AND NEW.status = OLD.status
     AND NEW.fund_id IS NOT DISTINCT FROM OLD.fund_id
     AND NEW.balance_after = OLD.balance_after AND NEW.reference_no = OLD.reference_no
     AND NEW.created_at = OLD.created_at AND NEW.remarks IS NOT DISTINCT FROM OLD.remarks
     AND (NEW.request_id   IS NOT DISTINCT FROM OLD.request_id   OR NEW.request_id   IS NULL)
     AND (NEW.processed_by IS NOT DISTINCT FROM OLD.processed_by OR NEW.processed_by IS NULL)
     AND (NEW.approved_by  IS NOT DISTINCT FROM OLD.approved_by  OR NEW.approved_by  IS NULL)
     AND (NEW.reversed_by  IS NOT DISTINCT FROM OLD.reversed_by  OR NEW.reversed_by  IS NULL) THEN
    RETURN NEW; -- FK ON DELETE SET NULL
  END IF;
  RAISE EXCEPTION 'LEDGER_IMMUTABLE: Financial transactions cannot be edited. Record a reversal or adjustment instead.';
END;
$$;
DROP TRIGGER IF EXISTS trg_fund_tx_immutable ON fund_transactions;
CREATE TRIGGER trg_fund_tx_immutable BEFORE UPDATE OR DELETE ON fund_transactions
FOR EACH ROW EXECUTE FUNCTION public.fund_tx_immutable();

-- ----------------------------------------------------------------------------
-- 4. REQUESTS — reference numbers & treasury processing fields
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS request_ref_seq;

ALTER TABLE requests ADD COLUMN IF NOT EXISTS reference_no          TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS approved_at           TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS voucher_no            TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS treasury_processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS treasury_processed_at TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS treasury_remarks      TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS released_by           UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS released_at           TIMESTAMPTZ;

WITH ordered AS (
  SELECT id, created_at FROM requests WHERE reference_no IS NULL ORDER BY created_at, id
)
UPDATE requests r
SET reference_no = 'AICS-' || to_char(o.created_at, 'YYYY') || '-' || lpad(nextval('request_ref_seq')::text, 5, '0')
FROM ordered o WHERE r.id = o.id;

-- Best-effort backfill of timestamps for historical rows (not financial values)
UPDATE requests SET approved_at = updated_at
WHERE approved_at IS NULL AND status IN ('Approved', 'Released');
UPDATE requests r SET released_at = COALESCE(
  (SELECT MIN(p.created_at) FROM payouts p WHERE p.request_id = r.id), r.updated_at)
WHERE released_at IS NULL AND status = 'Released';

CREATE UNIQUE INDEX IF NOT EXISTS uq_requests_reference_no ON requests(reference_no);
CREATE UNIQUE INDEX IF NOT EXISTS uq_requests_voucher_no   ON requests(voucher_no) WHERE voucher_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_release_status     ON requests(status, release_status);

CREATE OR REPLACE FUNCTION public.requests_before_insert_ref()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reference_no IS NULL THEN
    NEW.reference_no := 'AICS-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('request_ref_seq')::text, 5, '0');
  END IF;
  IF NEW.status = 'Approved' THEN
    NEW.release_status := 'Pending Release';
    NEW.approved_at := COALESCE(NEW.approved_at, NOW());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_requests_before_insert_ref ON requests;
CREATE TRIGGER trg_requests_before_insert_ref BEFORE INSERT ON requests
FOR EACH ROW EXECUTE FUNCTION public.requests_before_insert_ref();

-- ----------------------------------------------------------------------------
-- 5. PAYOUTS — reversible, never deleted
-- ----------------------------------------------------------------------------
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS fund_transaction_id UUID REFERENCES fund_transactions(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 6. FINANCIAL PROCESSING LOG (per-request history)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_processing_log (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  request_id          UUID REFERENCES requests(id) ON DELETE SET NULL,
  fund_transaction_id UUID REFERENCES fund_transactions(id) ON DELETE SET NULL,
  action              TEXT NOT NULL CHECK (action IN (
                        'Queued', 'Processed', 'Returned', 'Release Confirmed', 'Cancelled',
                        'Amount Changed', 'Reversed', 'Insufficient Funds')),
  amount              NUMERIC(15,2),
  previous_amount     NUMERIC(15,2),
  previous_status     TEXT,
  new_status          TEXT,
  remarks             TEXT,
  performed_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  performed_role      TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fin_log_request ON financial_processing_log(request_id, created_at DESC);
ALTER TABLE financial_processing_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read financial log" ON financial_processing_log;
CREATE POLICY "Staff read financial log" ON financial_processing_log FOR SELECT
  USING (public.aics_current_role() IN ('admin', 'treasurer'));
-- No INSERT/UPDATE/DELETE policies: rows are written only by SECURITY DEFINER code.

CREATE OR REPLACE FUNCTION public.aics_fin_log(
  p_request UUID, p_tx UUID, p_action TEXT, p_amount NUMERIC, p_prev_amount NUMERIC,
  p_prev_status TEXT, p_new_status TEXT, p_remarks TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO financial_processing_log (request_id, fund_transaction_id, action, amount, previous_amount,
    previous_status, new_status, remarks, performed_by, performed_role)
  VALUES (p_request, p_tx, p_action, p_amount, p_prev_amount, p_prev_status, p_new_status, p_remarks,
    auth.uid(), public.aics_current_role());
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. REQUEST FINANCIAL TRIGGER (replaces process_request_fund_deduction body)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_request_fund_deduction()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role       TEXT    := public.aics_current_role();
  v_bypass     BOOLEAN := COALESCE(current_setting('aics.fin_write', true), '') = 'on';
  v_reversal   BOOLEAN := COALESCE(current_setting('aics.reversal', true), '') = 'on';
  v_fund       funds%ROWTYPE;
  v_tx_id      UUID;
  v_tx_ref     TEXT;
  v_ben        TEXT;
  v_ref        TEXT := COALESCE(NEW.reference_no, upper(left(NEW.id::text, 8)));
BEGIN
  -- (a) Only Admins (or trusted RPCs) may change approval / financial fields directly
  IF NOT v_bypass AND auth.uid() IS NOT NULL AND COALESCE(v_role, '') <> 'admin' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.amount_approved IS DISTINCT FROM OLD.amount_approved
       OR NEW.release_status IS DISTINCT FROM OLD.release_status
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.voucher_no IS DISTINCT FROM OLD.voucher_no
       OR NEW.treasury_processed_by IS DISTINCT FROM OLD.treasury_processed_by
       OR NEW.released_by IS DISTINCT FROM OLD.released_by
       OR NEW.reference_no IS DISTINCT FROM OLD.reference_no THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Only the MSWD Admin can change the approval or financial fields of a request.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.reference_no IS DISTINCT FROM OLD.reference_no AND OLD.reference_no IS NOT NULL THEN
    NEW.reference_no := OLD.reference_no; -- reference numbers are permanent
  END IF;

  -- (b) Released requests are locked; corrections go through reverse_fund_transaction
  IF OLD.status = 'Released' AND NOT v_reversal THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.amount_approved IS DISTINCT FROM OLD.amount_approved
       OR NEW.release_status IS DISTINCT FROM OLD.release_status THEN
      RAISE EXCEPTION 'RELEASE_LOCKED: This assistance has already been released. Record a reversal in Fund Tracking to correct it.';
    END IF;
    RETURN NEW;
  END IF;
  IF v_reversal THEN
    RETURN NEW;
  END IF;

  -- (c) Keep status / release_status in sync
  IF NEW.release_status = 'Released' AND NEW.status <> 'Released' THEN NEW.status := 'Released'; END IF;
  IF NEW.status = 'Released' AND NEW.release_status IS DISTINCT FROM 'Released' THEN NEW.release_status := 'Released'; END IF;

  SELECT trim(first_name || ' ' || last_name) INTO v_ben FROM beneficiaries WHERE id = NEW.beneficiary_id;
  v_ben := COALESCE(v_ben, 'Beneficiary');

  -- (d) Entering Approved → joins the Treasurer queue
  IF NEW.status = 'Approved' AND OLD.status IS DISTINCT FROM 'Approved' THEN
    IF COALESCE(NEW.amount_approved, 0) <= 0 THEN
      RAISE EXCEPTION 'AMOUNT_REQUIRED: Set an approved amount greater than ₱0 before approving the request.';
    END IF;
    NEW.release_status := 'Pending Release';
    NEW.approved_at := NOW();
    NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
    NEW.voucher_no := NULL; NEW.treasury_processed_by := NULL; NEW.treasury_processed_at := NULL;
    PERFORM public.aics_fin_log(NEW.id, NULL, 'Queued', NEW.amount_approved, NULL, OLD.status, 'Approved',
      'Approved by Admin; awaiting Treasurer processing');
    PERFORM public.aics_notify_role('treasurer', 'Approved Request Needs Processing',
      format('%s – %s Assistance – ₱%s (Ref %s) was approved and needs financial processing.',
             v_ben, NEW.assistance_type, to_char(NEW.amount_approved, 'FM999,999,990.00'), v_ref),
      'pending', NEW.id, '/treasurer/requests?status=Pending%20Release');
    RETURN NEW;
  END IF;

  -- (e) Leaving Approved without release → cancelled for finance
  IF OLD.status = 'Approved' AND NEW.status IN ('Pending', 'Declined') THEN
    NEW.release_status := NULL;
    NEW.voucher_no := NULL; NEW.treasury_processed_by := NULL; NEW.treasury_processed_at := NULL;
    PERFORM public.aics_fin_log(NEW.id, NULL, 'Cancelled', OLD.amount_approved, NULL, 'Approved', NEW.status,
      'Approval withdrawn by Admin');
    PERFORM public.aics_notify_role('treasurer', 'Approved Request Cancelled',
      format('%s – %s Assistance (Ref %s) is no longer approved (now %s). Do not disburse.',
             v_ben, NEW.assistance_type, v_ref, NEW.status),
      'incomplete', NEW.id, '/requests/' || NEW.id);
    RETURN NEW;
  END IF;

  -- (f) Approved amount changed while awaiting release
  IF OLD.status = 'Approved' AND NEW.status = 'Approved'
     AND NEW.amount_approved IS DISTINCT FROM OLD.amount_approved THEN
    IF COALESCE(NEW.amount_approved, 0) <= 0 THEN
      RAISE EXCEPTION 'AMOUNT_REQUIRED: Approved amount must be greater than ₱0.';
    END IF;
    NEW.release_status := 'Pending Release';
    NEW.voucher_no := NULL; NEW.treasury_processed_by := NULL; NEW.treasury_processed_at := NULL;
    PERFORM public.aics_fin_log(NEW.id, NULL, 'Amount Changed', NEW.amount_approved, OLD.amount_approved,
      OLD.release_status, 'Pending Release', 'Approved amount changed by Admin; re-processing required');
    PERFORM public.aics_audit('APPROVED_AMOUNT_CHANGED', 'requests', NEW.id,
      jsonb_build_object('before', OLD.amount_approved, 'after', NEW.amount_approved));
    PERFORM public.aics_notify_role('treasurer', 'Approved Amount Changed',
      format('Approved amount for %s (Ref %s) changed from ₱%s to ₱%s. Please re-process.',
             v_ben, v_ref, to_char(OLD.amount_approved, 'FM999,999,990.00'), to_char(NEW.amount_approved, 'FM999,999,990.00')),
      'pending', NEW.id, '/treasurer/requests?status=Pending%20Release');
  END IF;

  -- (g) Release — the ONLY place where money leaves a fund
  IF NEW.status = 'Released' AND OLD.status IS DISTINCT FROM 'Released' THEN
    IF OLD.status IS DISTINCT FROM 'Approved' THEN
      RAISE EXCEPTION 'NOT_APPROVED: Only Admin-approved requests can be released (current status: %).', OLD.status;
    END IF;
    IF NOT v_bypass AND auth.uid() IS NOT NULL
       AND NOT (v_role = 'admin' OR (v_role = 'treasurer' AND public.aics_setting('treasurer_can_release', 'false') = 'true')) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: You are not authorized to confirm the official release.' USING ERRCODE = '42501';
    END IF;
    IF public.aics_setting('require_treasury_processing', 'true') = 'true'
       AND OLD.release_status IS DISTINCT FROM 'Ready for Release' THEN
      RAISE EXCEPTION 'NOT_PROCESSED: The Treasurer must process this request (record the voucher) before it can be released.';
    END IF;
    IF COALESCE(NEW.amount_approved, 0) <= 0 THEN
      RAISE EXCEPTION 'AMOUNT_REQUIRED: Cannot release. Approved amount must be greater than ₱0.';
    END IF;
    IF EXISTS (SELECT 1 FROM fund_transactions WHERE request_id = NEW.id
               AND transaction_type = 'Release' AND status = 'Completed') THEN
      RAISE EXCEPTION 'DUPLICATE_RELEASE: This request already has a completed release transaction.';
    END IF;

    SELECT * INTO v_fund FROM funds WHERE assistance_type = NEW.assistance_type FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FUND_NOT_INITIALIZED: Fund tracking not initialized for % assistance.', NEW.assistance_type;
    END IF;
    IF v_fund.current_balance < NEW.amount_approved THEN
      RAISE EXCEPTION 'INSUFFICIENT_FUNDS: Available ₱%, required ₱%.', v_fund.current_balance, NEW.amount_approved;
    END IF;

    UPDATE funds SET total_released = total_released + NEW.amount_approved,
                     current_balance = current_balance - NEW.amount_approved,
                     updated_at = NOW(), updated_by = auth.uid()
    WHERE id = v_fund.id;

    INSERT INTO fund_transactions (fund_id, transaction_type, direction, amount, balance_after, request_id,
                                   remarks, processed_by, approved_by, assistance_type)
    VALUES (v_fund.id, 'Release', -1, NEW.amount_approved, v_fund.current_balance - NEW.amount_approved, NEW.id,
            format('Release for %s (Ref %s)%s', v_ben, v_ref,
                   CASE WHEN NEW.voucher_no IS NOT NULL THEN ' · Voucher ' || NEW.voucher_no ELSE '' END),
            auth.uid(), NEW.approved_by, NEW.assistance_type)
    RETURNING id, reference_no INTO v_tx_id, v_tx_ref;

    IF NOT EXISTS (SELECT 1 FROM payouts WHERE request_id = NEW.id AND is_reversed = false) THEN
      INSERT INTO payouts (request_id, amount_released, release_date, released_by, acknowledgment_notes, fund_transaction_id)
      VALUES (NEW.id, NEW.amount_approved, CURRENT_DATE, auth.uid(), 'Official release confirmed', v_tx_id);
    ELSE
      UPDATE payouts SET fund_transaction_id = v_tx_id
      WHERE request_id = NEW.id AND is_reversed = false AND fund_transaction_id IS NULL;
    END IF;

    NEW.released_by := auth.uid();
    NEW.released_at := NOW();

    PERFORM public.aics_fin_log(NEW.id, v_tx_id, 'Release Confirmed', NEW.amount_approved, NULL,
      OLD.release_status, 'Released', 'Transaction ' || v_tx_ref);
    PERFORM public.aics_audit('RELEASE_FUNDS', 'requests', NEW.id, jsonb_build_object(
      'transaction_ref', v_tx_ref, 'amount', NEW.amount_approved, 'fund', NEW.assistance_type,
      'balance_before', v_fund.current_balance, 'balance_after', v_fund.current_balance - NEW.amount_approved));
    PERFORM public.aics_notify_role('treasurer', 'Release Completed',
      format('₱%s released to %s (Ref %s). Transaction %s.',
             to_char(NEW.amount_approved, 'FM999,999,990.00'), v_ben, v_ref, v_tx_ref),
      'info', NEW.id, '/treasurer/transactions?ref=' || v_tx_ref, auth.uid());
    IF v_fund.current_balance - NEW.amount_approved <= v_fund.low_balance_threshold THEN
      PERFORM public.aics_notify_role('treasurer', 'Low Fund Balance',
        format('%s fund balance is now ₱%s (threshold ₱%s).', NEW.assistance_type,
               to_char(v_fund.current_balance - NEW.amount_approved, 'FM999,999,990.00'),
               to_char(v_fund.low_balance_threshold, 'FM999,999,990.00')),
        'incomplete', NULL, '/treasurer/funds');
      PERFORM public.aics_notify_role('admin', 'Low Fund Balance',
        format('%s fund balance is now ₱%s (threshold ₱%s).', NEW.assistance_type,
               to_char(v_fund.current_balance - NEW.amount_approved, 'FM999,999,990.00'),
               to_char(v_fund.low_balance_threshold, 'FM999,999,990.00')),
        'incomplete', NULL, '/admin/funds');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_request_fund_deduction ON requests;
CREATE TRIGGER trg_request_fund_deduction
BEFORE UPDATE ON requests
FOR EACH ROW EXECUTE FUNCTION public.process_request_fund_deduction();

-- Requests inserted directly as Approved also join the queue
CREATE OR REPLACE FUNCTION public.requests_after_insert_queue()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Approved' THEN
    PERFORM public.aics_fin_log(NEW.id, NULL, 'Queued', NEW.amount_approved, NULL, NULL, 'Approved',
      'Encoded as approved; awaiting Treasurer processing');
    PERFORM public.aics_notify_role('treasurer', 'Approved Request Needs Processing',
      format('Request %s (%s Assistance) was approved and needs financial processing.', NEW.reference_no, NEW.assistance_type),
      'pending', NEW.id, '/treasurer/requests?status=Pending%20Release');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_requests_after_insert_queue ON requests;
CREATE TRIGGER trg_requests_after_insert_queue AFTER INSERT ON requests
FOR EACH ROW EXECUTE FUNCTION public.requests_after_insert_queue();

-- One completed release per request (enforced for all future rows; existing
-- historical duplicates are reported instead of being silently modified).
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_fund_tx_one_release_per_request
    ON fund_transactions(request_id)
    WHERE transaction_type = 'Release' AND status = 'Completed' AND request_id IS NOT NULL;
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Historical duplicate releases exist; review them in Transaction History and reverse the extra one. Trigger-level protection is still active.';
END $$;

-- ----------------------------------------------------------------------------
-- 8. RPC: TREASURER PROCESSES AN APPROVED REQUEST
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.treasurer_process_request(
  p_request_id UUID, p_voucher_no TEXT, p_remarks TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role     TEXT := public.aics_current_role();
  r          requests%ROWTYPE;
  v_fund     funds%ROWTYPE;
  v_reserved NUMERIC;
  v_ben      TEXT;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('treasurer', 'admin') THEN
    PERFORM public.aics_audit('UNAUTHORIZED_FINANCIAL_OPERATION', 'requests', p_request_id,
      jsonb_build_object('operation', 'treasurer_process_request'));
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED', 'message', 'Only the Treasurer can process requests.');
  END IF;

  SELECT * INTO r FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND', 'message', 'Request not found.');
  END IF;
  IF r.status <> 'Approved' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_APPROVED',
      'message', format('Only Admin-approved requests can be processed (current status: %s).', r.status));
  END IF;
  IF r.release_status = 'Ready for Release' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_PROCESSED', 'message', 'This request was already processed.');
  END IF;
  IF COALESCE(r.amount_approved, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_APPROVED_AMOUNT', 'message', 'The Admin has not set an approved amount.');
  END IF;
  IF COALESCE(trim(p_voucher_no), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'VOUCHER_REQUIRED', 'message', 'Disbursement voucher / reference number is required.');
  END IF;
  IF EXISTS (SELECT 1 FROM requests WHERE voucher_no = trim(p_voucher_no) AND id <> r.id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DUPLICATE_VOUCHER', 'message', 'This voucher number is already used by another request.');
  END IF;

  SELECT * INTO v_fund FROM funds WHERE assistance_type = r.assistance_type FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FUND_NOT_INITIALIZED', 'message', 'Fund is not initialized.');
  END IF;
  SELECT COALESCE(SUM(amount_approved), 0) INTO v_reserved FROM requests
  WHERE status = 'Approved' AND release_status = 'Ready for Release'
    AND assistance_type = r.assistance_type AND id <> r.id;

  SELECT trim(first_name || ' ' || last_name) INTO v_ben FROM beneficiaries WHERE id = r.beneficiary_id;

  IF v_fund.current_balance - v_reserved < r.amount_approved THEN
    PERFORM public.aics_fin_log(r.id, NULL, 'Insufficient Funds', r.amount_approved, NULL, r.release_status, r.release_status,
      format('Available ₱%s after reservations; required ₱%s', v_fund.current_balance - v_reserved, r.amount_approved));
    PERFORM public.aics_audit('INSUFFICIENT_FUNDS', 'requests', r.id, jsonb_build_object(
      'available', v_fund.current_balance - v_reserved, 'required', r.amount_approved, 'fund', r.assistance_type));
    PERFORM public.aics_notify_role('admin', 'Insufficient Funds',
      format('%s fund cannot cover ₱%s for %s (Ref %s). Available after reservations: ₱%s.',
             r.assistance_type, to_char(r.amount_approved, 'FM999,999,990.00'), COALESCE(v_ben, 'beneficiary'), r.reference_no,
             to_char(v_fund.current_balance - v_reserved, 'FM999,999,990.00')),
      'incomplete', r.id, '/admin/funds');
    PERFORM public.aics_notify_role('treasurer', 'Insufficient Funds',
      format('%s fund cannot cover ₱%s for Ref %s. Record additional funds first.',
             r.assistance_type, to_char(r.amount_approved, 'FM999,999,990.00'), r.reference_no),
      'incomplete', r.id, '/treasurer/funds');
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_FUNDS',
      'message', format('Insufficient %s funds. Available after reservations: ₱%s; required: ₱%s.',
                        r.assistance_type, to_char(v_fund.current_balance - v_reserved, 'FM999,999,990.00'),
                        to_char(r.amount_approved, 'FM999,999,990.00')),
      'available', v_fund.current_balance - v_reserved);
  END IF;

  PERFORM set_config('aics.fin_write', 'on', true);
  UPDATE requests SET release_status = 'Ready for Release',
                      voucher_no = trim(p_voucher_no),
                      treasury_processed_by = auth.uid(),
                      treasury_processed_at = NOW(),
                      treasury_remarks = NULLIF(trim(COALESCE(p_remarks, '')), '')
  WHERE id = r.id;
  PERFORM set_config('aics.fin_write', 'off', true);

  PERFORM public.aics_fin_log(r.id, NULL, 'Processed', r.amount_approved, NULL, r.release_status, 'Ready for Release',
    'Voucher ' || trim(p_voucher_no) || COALESCE(' · ' || NULLIF(trim(COALESCE(p_remarks, '')), ''), ''));
  PERFORM public.aics_audit('TREASURY_PROCESS_REQUEST', 'requests', r.id, jsonb_build_object(
    'voucher_no', trim(p_voucher_no), 'amount', r.amount_approved,
    'before', jsonb_build_object('release_status', r.release_status),
    'after',  jsonb_build_object('release_status', 'Ready for Release')));
  PERFORM public.aics_notify_role('admin', 'Ready for Release Confirmation',
    format('Treasurer processed %s – %s Assistance – ₱%s (Ref %s, Voucher %s). Please confirm the official release.',
           COALESCE(v_ben, 'beneficiary'), r.assistance_type, to_char(r.amount_approved, 'FM999,999,990.00'),
           r.reference_no, trim(p_voucher_no)),
    'pending', r.id, '/requests/' || r.id);

  RETURN jsonb_build_object('ok', true, 'message', 'Request processed and marked Ready for Release.');
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. RPC: TREASURER RETURNS A REQUEST FOR CORRECTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.treasurer_return_request(p_request_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT := public.aics_current_role();
  r      requests%ROWTYPE;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('treasurer', 'admin') THEN
    PERFORM public.aics_audit('UNAUTHORIZED_FINANCIAL_OPERATION', 'requests', p_request_id,
      jsonb_build_object('operation', 'treasurer_return_request'));
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED', 'message', 'Not authorized.');
  END IF;
  IF COALESCE(trim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED', 'message', 'Please describe what needs correction.');
  END IF;
  SELECT * INTO r FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'Approved' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_APPROVED', 'message', 'Only approved, unreleased requests can be returned.');
  END IF;

  PERFORM set_config('aics.fin_write', 'on', true);
  UPDATE requests SET release_status = 'Pending Release', voucher_no = NULL,
                      treasury_processed_by = NULL, treasury_processed_at = NULL,
                      treasury_remarks = trim(p_reason)
  WHERE id = r.id;
  PERFORM set_config('aics.fin_write', 'off', true);

  PERFORM public.aics_fin_log(r.id, NULL, 'Returned', r.amount_approved, NULL, r.release_status, 'Pending Release', trim(p_reason));
  PERFORM public.aics_audit('TREASURY_RETURN_REQUEST', 'requests', r.id, jsonb_build_object(
    'reason', trim(p_reason), 'before', r.release_status, 'after', 'Pending Release'));
  PERFORM public.aics_notify_role('admin', 'Financial Review Required',
    format('Treasurer flagged Ref %s for correction: %s', r.reference_no, trim(p_reason)),
    'incomplete', r.id, '/requests/' || r.id);
  RETURN jsonb_build_object('ok', true, 'message', 'Request returned to the Admin for correction.');
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. RPC: CONFIRM OFFICIAL RELEASE (Admin; Treasurer only if enabled)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_request_release(
  p_request_id UUID, p_release_date DATE DEFAULT CURRENT_DATE, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT := public.aics_current_role();
  r      requests%ROWTYPE;
  v_tx   RECORD;
BEGIN
  IF NOT (v_role = 'admin' OR (v_role = 'treasurer' AND public.aics_setting('treasurer_can_release', 'false') = 'true')) THEN
    PERFORM public.aics_audit('UNAUTHORIZED_FINANCIAL_OPERATION', 'requests', p_request_id,
      jsonb_build_object('operation', 'confirm_request_release'));
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED',
      'message', 'Only the MSWD Admin can confirm the official release.');
  END IF;
  IF p_release_date IS NULL OR p_release_date > CURRENT_DATE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DATE', 'message', 'Release date cannot be in the future.');
  END IF;

  SELECT * INTO r FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND', 'message', 'Request not found.');
  END IF;
  IF r.status = 'Released' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DUPLICATE_RELEASE', 'message', 'This request has already been released.');
  END IF;

  BEGIN
    PERFORM set_config('aics.fin_write', 'on', true);
    UPDATE requests SET status = 'Released', release_status = 'Released' WHERE id = r.id;
    PERFORM set_config('aics.fin_write', 'off', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('aics.fin_write', 'off', true);
    RETURN jsonb_build_object('ok', false, 'error', split_part(SQLERRM, ':', 1), 'message', SQLERRM);
  END;

  SELECT id, reference_no INTO v_tx FROM fund_transactions
  WHERE request_id = r.id AND transaction_type = 'Release' AND status = 'Completed'
  ORDER BY created_at DESC LIMIT 1;

  UPDATE payouts SET release_date = p_release_date,
                     acknowledgment_notes = COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), acknowledgment_notes)
  WHERE request_id = r.id AND is_reversed = false;

  RETURN jsonb_build_object('ok', true, 'message', 'Release confirmed and funds deducted.',
    'transaction_id', v_tx.id, 'transaction_ref', v_tx.reference_no);
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. RPC: RECORD FUNDS RECEIVED / OPENING BALANCE / ADJUSTMENT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_fund_transaction(
  p_assistance_type TEXT, p_transaction_type TEXT, p_amount NUMERIC,
  p_direction INT DEFAULT 1, p_remarks TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role  TEXT := public.aics_current_role();
  v_fund  funds%ROWTYPE;
  v_dir   INT;
  v_new   NUMERIC;
  v_tx    RECORD;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'treasurer') THEN
    PERFORM public.aics_audit('UNAUTHORIZED_FINANCIAL_OPERATION', 'fund_transactions', NULL,
      jsonb_build_object('operation', 'record_fund_transaction', 'amount', p_amount));
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED', 'message', 'Not authorized to record fund transactions.');
  END IF;
  IF p_transaction_type NOT IN ('Opening Balance', 'Allocation', 'Adjustment') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TYPE', 'message', 'Unsupported transaction type.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT', 'message', 'Amount must be greater than ₱0.');
  END IF;
  IF p_transaction_type = 'Adjustment' AND COALESCE(trim(p_remarks), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REMARKS_REQUIRED', 'message', 'Adjustments require a justification.');
  END IF;

  v_dir := CASE WHEN p_transaction_type = 'Adjustment' THEN CASE WHEN p_direction < 0 THEN -1 ELSE 1 END ELSE 1 END;

  SELECT * INTO v_fund FROM funds WHERE assistance_type = p_assistance_type FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FUND_NOT_FOUND', 'message', 'Fund not found.');
  END IF;
  IF p_transaction_type = 'Opening Balance' AND EXISTS (
       SELECT 1 FROM fund_transactions WHERE fund_id = v_fund.id AND transaction_type = 'Opening Balance' AND status = 'Completed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OPENING_EXISTS',
      'message', 'An opening balance already exists for this fund. Use "Funds Received" or an adjustment.');
  END IF;

  v_new := v_fund.current_balance + v_dir * p_amount;
  IF v_new < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NEGATIVE_BALANCE', 'message', 'This would make the fund balance negative.');
  END IF;

  UPDATE funds SET total_allocated = total_allocated + v_dir * p_amount,
                   current_balance = v_new, updated_at = NOW(), updated_by = auth.uid()
  WHERE id = v_fund.id;

  INSERT INTO fund_transactions (fund_id, transaction_type, direction, amount, balance_after, remarks, processed_by, assistance_type)
  VALUES (v_fund.id, p_transaction_type, v_dir, p_amount, v_new,
          COALESCE(NULLIF(trim(COALESCE(p_remarks, '')), ''), p_transaction_type), auth.uid(), v_fund.assistance_type)
  RETURNING id, reference_no INTO v_tx;

  PERFORM public.aics_audit('FUND_TRANSACTION_RECORDED', 'fund_transactions', v_tx.id, jsonb_build_object(
    'reference_no', v_tx.reference_no, 'type', p_transaction_type, 'direction', v_dir, 'amount', p_amount,
    'fund', v_fund.assistance_type, 'balance_before', v_fund.current_balance, 'balance_after', v_new));
  PERFORM public.aics_notify_role(CASE WHEN v_role = 'admin' THEN 'treasurer' ELSE 'admin' END,
    'Fund Transaction Recorded',
    format('%s of ₱%s (%s fund) recorded. Ref %s. New balance ₱%s.', p_transaction_type,
           to_char(p_amount, 'FM999,999,990.00'), v_fund.assistance_type, v_tx.reference_no, to_char(v_new, 'FM999,999,990.00')),
    'info', NULL, CASE WHEN v_role = 'admin' THEN '/treasurer/transactions?ref=' ELSE '/admin/funds/transactions?ref=' END || v_tx.reference_no);

  RETURN jsonb_build_object('ok', true, 'message', 'Transaction recorded.', 'transaction_id', v_tx.id,
    'transaction_ref', v_tx.reference_no, 'balance_after', v_new);
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. RPC: REVERSE A TRANSACTION (append-only correction)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_fund_transaction(p_transaction_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role  TEXT := public.aics_current_role();
  t       fund_transactions%ROWTYPE;
  v_fund  funds%ROWTYPE;
  v_dir   INT;
  v_new   NUMERIC;
  v_rev   RECORD;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'treasurer') THEN
    PERFORM public.aics_audit('UNAUTHORIZED_FINANCIAL_OPERATION', 'fund_transactions', p_transaction_id,
      jsonb_build_object('operation', 'reverse_fund_transaction'));
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED', 'message', 'Not authorized.');
  END IF;
  IF COALESCE(trim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED', 'message', 'A reason is required for every reversal.');
  END IF;

  SELECT * INTO t FROM fund_transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND', 'message', 'Transaction not found.');
  END IF;
  IF t.status <> 'Completed' OR t.transaction_type = 'Reversal' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_REVERSIBLE', 'message', 'This transaction is already reversed or is itself a reversal.');
  END IF;
  IF t.transaction_type = 'Release' AND v_role <> 'admin' THEN
    PERFORM public.aics_audit('UNAUTHORIZED_FINANCIAL_OPERATION', 'fund_transactions', t.id,
      jsonb_build_object('operation', 'reverse_release'));
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED',
      'message', 'Only the MSWD Admin can reverse an official release.');
  END IF;

  SELECT * INTO v_fund FROM funds WHERE id = t.fund_id FOR UPDATE;
  v_dir := -t.direction;
  v_new := v_fund.current_balance + v_dir * t.amount;
  IF v_new < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NEGATIVE_BALANCE',
      'message', 'Reversal would make the fund balance negative (funds already used).');
  END IF;

  IF t.transaction_type = 'Release' THEN
    UPDATE funds SET total_released = total_released - t.amount, current_balance = v_new,
                     updated_at = NOW(), updated_by = auth.uid() WHERE id = v_fund.id;
  ELSE
    UPDATE funds SET total_allocated = total_allocated + v_dir * t.amount, current_balance = v_new,
                     updated_at = NOW(), updated_by = auth.uid() WHERE id = v_fund.id;
  END IF;

  INSERT INTO fund_transactions (fund_id, transaction_type, direction, amount, balance_after, request_id,
                                 remarks, processed_by, reversal_of, assistance_type)
  VALUES (t.fund_id, 'Reversal', v_dir, t.amount, v_new, t.request_id,
          format('Reversal of %s: %s', t.reference_no, trim(p_reason)), auth.uid(), t.id, t.assistance_type)
  RETURNING id, reference_no INTO v_rev;

  PERFORM set_config('aics.ledger_write', 'on', true);
  UPDATE fund_transactions SET status = 'Reversed', reversed_by = auth.uid(), reversed_at = NOW(),
                               reversal_reason = trim(p_reason)
  WHERE id = t.id;
  PERFORM set_config('aics.ledger_write', 'off', true);

  IF t.transaction_type = 'Release' AND t.request_id IS NOT NULL THEN
    PERFORM set_config('aics.reversal', 'on', true);
    PERFORM set_config('aics.fin_write', 'on', true);
    UPDATE requests SET status = 'Approved', release_status = 'Pending Release',
                        released_by = NULL, released_at = NULL, voucher_no = NULL,
                        treasury_processed_by = NULL, treasury_processed_at = NULL,
                        treasury_remarks = 'Release reversed: ' || trim(p_reason)
    WHERE id = t.request_id AND status = 'Released';
    PERFORM set_config('aics.reversal', 'off', true);
    PERFORM set_config('aics.fin_write', 'off', true);
    UPDATE payouts SET is_reversed = true WHERE request_id = t.request_id AND is_reversed = false;
    PERFORM public.aics_fin_log(t.request_id, v_rev.id, 'Reversed', t.amount, NULL, 'Released', 'Pending Release', trim(p_reason));
  END IF;

  PERFORM public.aics_audit('FUND_TRANSACTION_REVERSED', 'fund_transactions', t.id, jsonb_build_object(
    'original_ref', t.reference_no, 'reversal_ref', v_rev.reference_no, 'type', t.transaction_type,
    'amount', t.amount, 'reason', trim(p_reason),
    'balance_before', v_fund.current_balance, 'balance_after', v_new));
  PERFORM public.aics_notify_role('treasurer', 'Transaction Reversed',
    format('%s (%s, ₱%s) was reversed by %s. Reason: %s', t.reference_no, t.transaction_type,
           to_char(t.amount, 'FM999,999,990.00'), v_role, trim(p_reason)),
    'incomplete', t.request_id, '/treasurer/transactions?ref=' || v_rev.reference_no, auth.uid());
  PERFORM public.aics_notify_role('admin', 'Transaction Reversed',
    format('%s (%s, ₱%s) was reversed by %s. Reason: %s', t.reference_no, t.transaction_type,
           to_char(t.amount, 'FM999,999,990.00'), v_role, trim(p_reason)),
    'incomplete', t.request_id, '/admin/funds/transactions?ref=' || v_rev.reference_no, auth.uid());

  RETURN jsonb_build_object('ok', true, 'message', 'Transaction reversed.', 'transaction_ref', v_rev.reference_no);
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. RPC: LOW-BALANCE THRESHOLD (Admin configuration)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_fund_threshold(p_assistance_type TEXT, p_threshold NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old NUMERIC; v_id UUID;
BEGIN
  IF public.aics_current_role() IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED', 'message', 'Only the Admin can change thresholds.');
  END IF;
  IF p_threshold IS NULL OR p_threshold < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT', 'message', 'Threshold must be ₱0 or more.');
  END IF;
  SELECT id, low_balance_threshold INTO v_id, v_old FROM funds WHERE assistance_type = p_assistance_type FOR UPDATE;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FUND_NOT_FOUND', 'message', 'Fund not found.');
  END IF;
  IF v_old = p_threshold THEN RETURN jsonb_build_object('ok', true, 'message', 'No change.'); END IF;
  UPDATE funds SET low_balance_threshold = p_threshold, updated_at = NOW(), updated_by = auth.uid() WHERE id = v_id;
  PERFORM public.aics_audit('FUND_THRESHOLD_UPDATED', 'funds', v_id,
    jsonb_build_object('fund', p_assistance_type, 'before', v_old, 'after', p_threshold));
  RETURN jsonb_build_object('ok', true, 'message', 'Threshold updated.');
END;
$$;

-- ----------------------------------------------------------------------------
-- 14. RPC: TREASURY SUMMARY (single source of truth for dashboards & reports)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_treasury_summary(p_from DATE DEFAULT NULL, p_to DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT := public.aics_current_role();
  v_from TIMESTAMPTZ := COALESCE(p_from::timestamptz, '-infinity'::timestamptz);
  v_to   TIMESTAMPTZ := COALESCE((p_to + 1)::timestamptz, 'infinity'::timestamptz);
  v_types JSONB;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'treasurer') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.assistance_type), '[]'::jsonb) INTO v_types FROM (
    SELECT f.assistance_type,
           f.total_allocated                                   AS total_funds,
           f.total_released                                    AS total_released,
           f.current_balance                                   AS current_balance,
           f.low_balance_threshold                             AS low_balance_threshold,
           (f.current_balance <= f.low_balance_threshold)      AS is_low,
           COALESCE(l.opening, 0)       AS opening_balance,
           COALESCE(l.received, 0)      AS funds_received,
           COALESCE(l.adjust_net, 0)    AS adjustments_net,
           COALESCE(l.released_rng, 0)  AS released_in_range,
           COALESCE(l.reversed_amt, 0)  AS reversed_amount,
           COALESCE(l.reversed_cnt, 0)  AS reversed_count,
           COALESCE(l.ledger_balance, 0) AS ledger_balance,
           (COALESCE(l.ledger_balance, 0) = f.current_balance) AS reconciled,
           COALESCE(q.pending_amt, 0)   AS pending_processing_amount,
           COALESCE(q.pending_cnt, 0)   AS pending_processing_count,
           COALESCE(q.ready_amt, 0)     AS reserved_amount,
           COALESCE(q.ready_cnt, 0)     AS reserved_count,
           COALESCE(q.pending_amt, 0) + COALESCE(q.ready_amt, 0) AS allocated_to_requests,
           f.current_balance - COALESCE(q.pending_amt, 0) - COALESCE(q.ready_amt, 0) AS remaining_balance
    FROM funds f
    LEFT JOIN LATERAL (
      SELECT
        SUM(amount) FILTER (WHERE transaction_type = 'Opening Balance' AND status = 'Completed' AND created_at >= v_from AND created_at < v_to) AS opening,
        SUM(amount) FILTER (WHERE transaction_type IN ('Opening Balance', 'Allocation') AND status = 'Completed' AND created_at >= v_from AND created_at < v_to) AS received,
        SUM(direction * amount) FILTER (WHERE transaction_type = 'Adjustment' AND status = 'Completed' AND created_at >= v_from AND created_at < v_to) AS adjust_net,
        SUM(amount) FILTER (WHERE transaction_type = 'Release' AND status = 'Completed' AND created_at >= v_from AND created_at < v_to) AS released_rng,
        SUM(amount) FILTER (WHERE transaction_type = 'Reversal' AND created_at >= v_from AND created_at < v_to) AS reversed_amt,
        COUNT(*)    FILTER (WHERE transaction_type = 'Reversal' AND created_at >= v_from AND created_at < v_to) AS reversed_cnt,
        SUM(direction * amount) AS ledger_balance
      FROM fund_transactions t WHERE t.fund_id = f.id
    ) l ON true
    LEFT JOIN LATERAL (
      SELECT
        SUM(amount_approved) FILTER (WHERE COALESCE(release_status, 'Pending Release') = 'Pending Release') AS pending_amt,
        COUNT(*)             FILTER (WHERE COALESCE(release_status, 'Pending Release') = 'Pending Release') AS pending_cnt,
        SUM(amount_approved) FILTER (WHERE release_status = 'Ready for Release') AS ready_amt,
        COUNT(*)             FILTER (WHERE release_status = 'Ready for Release') AS ready_cnt
      FROM requests r WHERE r.status = 'Approved' AND r.assistance_type = f.assistance_type
    ) q ON true
  ) x;

  RETURN jsonb_build_object(
    'generated_at', NOW(),
    'from', p_from, 'to', p_to,
    'treasurer_can_release', public.aics_setting('treasurer_can_release', 'false') = 'true',
    'require_treasury_processing', public.aics_setting('require_treasury_processing', 'true') = 'true',
    'funds', v_types,
    'totals', (SELECT jsonb_build_object(
        'total_funds',               COALESCE(SUM((e->>'total_funds')::numeric), 0),
        'total_released',            COALESCE(SUM((e->>'total_released')::numeric), 0),
        'current_balance',           COALESCE(SUM((e->>'current_balance')::numeric), 0),
        'opening_balance',           COALESCE(SUM((e->>'opening_balance')::numeric), 0),
        'funds_received',            COALESCE(SUM((e->>'funds_received')::numeric), 0),
        'adjustments_net',           COALESCE(SUM((e->>'adjustments_net')::numeric), 0),
        'released_in_range',         COALESCE(SUM((e->>'released_in_range')::numeric), 0),
        'reversed_amount',           COALESCE(SUM((e->>'reversed_amount')::numeric), 0),
        'reversed_count',            COALESCE(SUM((e->>'reversed_count')::numeric), 0),
        'pending_processing_amount', COALESCE(SUM((e->>'pending_processing_amount')::numeric), 0),
        'pending_processing_count',  COALESCE(SUM((e->>'pending_processing_count')::numeric), 0),
        'reserved_amount',           COALESCE(SUM((e->>'reserved_amount')::numeric), 0),
        'reserved_count',            COALESCE(SUM((e->>'reserved_count')::numeric), 0),
        'allocated_to_requests',     COALESCE(SUM((e->>'allocated_to_requests')::numeric), 0),
        'remaining_balance',         COALESCE(SUM((e->>'remaining_balance')::numeric), 0),
        'approved_requests_count',   COALESCE(SUM((e->>'pending_processing_count')::numeric + (e->>'reserved_count')::numeric), 0),
        'reconciled',                COALESCE(bool_and((e->>'reconciled')::boolean), true)
      ) FROM jsonb_array_elements(v_types) e)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 15. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- requests: Treasurer may READ financial requests; no direct UPDATE (RPC only)
DROP POLICY IF EXISTS "Treasurer requests access" ON requests;
DROP POLICY IF EXISTS "Treasurer requests update" ON requests;
DROP POLICY IF EXISTS "Treasurer read financial requests" ON requests;
CREATE POLICY "Treasurer read financial requests" ON requests FOR SELECT USING (
  public.aics_current_role() = 'treasurer' AND (
    status IN ('Approved', 'Released')
    OR EXISTS (SELECT 1 FROM financial_processing_log l WHERE l.request_id = requests.id)
  )
);

-- beneficiaries: Treasurer may READ only beneficiaries tied to those requests
DROP POLICY IF EXISTS "Treasurer read financial beneficiaries" ON beneficiaries;
CREATE POLICY "Treasurer read financial beneficiaries" ON beneficiaries FOR SELECT USING (
  public.aics_current_role() = 'treasurer' AND EXISTS (
    SELECT 1 FROM requests r WHERE r.beneficiary_id = beneficiaries.id
      AND (r.status IN ('Approved', 'Released')
           OR EXISTS (SELECT 1 FROM financial_processing_log l WHERE l.request_id = r.id))
  )
);

-- funds: read-only for staff; all writes through RPCs / trigger
DROP POLICY IF EXISTS "Admins full access funds" ON funds;
DROP POLICY IF EXISTS "Treasurers read funds"    ON funds;
DROP POLICY IF EXISTS "Staff read funds"         ON funds;
CREATE POLICY "Staff read funds" ON funds FOR SELECT
  USING (public.aics_current_role() IN ('admin', 'treasurer'));

-- fund_transactions: read-only for staff; append via RPCs / trigger only
DROP POLICY IF EXISTS "Admins full access fund_transactions"  ON fund_transactions;
DROP POLICY IF EXISTS "Treasurers read fund_transactions"     ON fund_transactions;
DROP POLICY IF EXISTS "Treasurers insert fund_transactions"   ON fund_transactions;
DROP POLICY IF EXISTS "Staff read fund_transactions"          ON fund_transactions;
CREATE POLICY "Staff read fund_transactions" ON fund_transactions FOR SELECT
  USING (public.aics_current_role() IN ('admin', 'treasurer'));

-- payouts: was open to every authenticated user (incl. residents)
DROP POLICY IF EXISTS "Authenticated access"      ON payouts;
DROP POLICY IF EXISTS "Staff read payouts"        ON payouts;
DROP POLICY IF EXISTS "Residents read own payouts" ON payouts;
DROP POLICY IF EXISTS "Admins insert payouts"     ON payouts;
DROP POLICY IF EXISTS "Admins update payouts"     ON payouts;
CREATE POLICY "Staff read payouts" ON payouts FOR SELECT
  USING (public.aics_current_role() IN ('admin', 'treasurer'));
CREATE POLICY "Residents read own payouts" ON payouts FOR SELECT
  USING (EXISTS (SELECT 1 FROM requests r WHERE r.id = payouts.request_id AND r.encoded_by = auth.uid()));
CREATE POLICY "Admins update payouts" ON payouts FOR UPDATE
  USING (public.aics_current_role() = 'admin') WITH CHECK (public.aics_current_role() = 'admin');
-- No INSERT/DELETE policy: payouts are created by the release trigger only.

-- ----------------------------------------------------------------------------
-- 16. FUNCTION PERMISSIONS
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.treasurer_process_request(UUID, TEXT, TEXT)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.treasurer_return_request(UUID, TEXT)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_request_release(UUID, DATE, TEXT)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_fund_transaction(TEXT, TEXT, NUMERIC, INT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reverse_fund_transaction(UUID, TEXT)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_fund_threshold(TEXT, NUMERIC)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_treasury_summary(DATE, DATE)                    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.treasurer_process_request(UUID, TEXT, TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.treasurer_return_request(UUID, TEXT)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_request_release(UUID, DATE, TEXT)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_fund_transaction(TEXT, TEXT, NUMERIC, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_fund_transaction(UUID, TEXT)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_fund_threshold(TEXT, NUMERIC)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_treasury_summary(DATE, DATE)                    TO authenticated;

-- Internal helpers are not callable from the client
REVOKE ALL ON FUNCTION public.aics_audit(TEXT, TEXT, UUID, JSONB)                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aics_notify_role(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aics_fin_log(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 17. REALTIME (dashboards refresh automatically)
-- ----------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['requests', 'funds', 'fund_transactions', 'notifications', 'financial_processing_log'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Done. Verify with:  SELECT public.get_treasury_summary();   (as an admin/treasurer)
