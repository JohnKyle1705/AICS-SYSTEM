-- ============================================================
-- Migration: Add purok column to beneficiaries table
-- Barangay is restricted to Barangay Pajo only.
-- ============================================================

ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS purok TEXT;

-- Optional: Add index for filtering by purok
CREATE INDEX IF NOT EXISTS idx_beneficiaries_purok ON beneficiaries(purok);
