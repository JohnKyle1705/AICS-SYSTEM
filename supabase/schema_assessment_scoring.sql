-- Add missing columns to support the new Priority Scoring system in AssessmentForm
ALTER TABLE assessments
ADD COLUMN IF NOT EXISTS eligibility_status TEXT,
ADD COLUMN IF NOT EXISTS urgency_level TEXT,
ADD COLUMN IF NOT EXISTS priority_score INTEGER,
ADD COLUMN IF NOT EXISTS priority_level TEXT,
ADD COLUMN IF NOT EXISTS document_status TEXT;
