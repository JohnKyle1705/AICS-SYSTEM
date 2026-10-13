-- Fix foreign key constraints to allow deleting users
-- Run this script in the Supabase SQL Editor

-- 1. beneficiaries
ALTER TABLE beneficiaries DROP CONSTRAINT IF EXISTS beneficiaries_created_by_fkey;
ALTER TABLE beneficiaries ADD CONSTRAINT beneficiaries_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. requests
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_encoded_by_fkey;
ALTER TABLE requests ADD CONSTRAINT requests_encoded_by_fkey FOREIGN KEY (encoded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_assessed_by_fkey;
ALTER TABLE requests ADD CONSTRAINT requests_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_approved_by_fkey;
ALTER TABLE requests ADD CONSTRAINT requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. request_documents
ALTER TABLE request_documents DROP CONSTRAINT IF EXISTS request_documents_uploaded_by_fkey;
ALTER TABLE request_documents ADD CONSTRAINT request_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- 4. assessments
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_assessed_by_fkey;
ALTER TABLE assessments ADD CONSTRAINT assessments_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- 5. payouts
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_released_by_fkey;
ALTER TABLE payouts ADD CONSTRAINT payouts_released_by_fkey FOREIGN KEY (released_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- 6. system_logs
ALTER TABLE system_logs DROP CONSTRAINT IF EXISTS system_logs_user_id_fkey;
ALTER TABLE system_logs ADD CONSTRAINT system_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 7. system_settings
ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_updated_by_fkey;
ALTER TABLE system_settings ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
