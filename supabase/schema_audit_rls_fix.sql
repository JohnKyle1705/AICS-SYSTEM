-- ============================================================
-- AICS Audit Log — RLS Fix & Performance Indexes
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- DROP the old catch-all policy that blocks non-admin inserts
DROP POLICY IF EXISTS "System logs admin only" ON system_logs;

-- Admins can read all logs
CREATE POLICY "System logs admin select"
  ON system_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Any authenticated user can INSERT their own log entry
-- (user_id must match the authenticated user for own-action logs,
--  OR user_id can be NULL for system-level entries)
CREATE POLICY "System logs authenticated insert"
  ON system_logs FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- Nobody can UPDATE or DELETE audit records via the client
-- (Service-role key on server-side bypasses RLS when needed)

-- Additional indexes for search / filter performance
CREATE INDEX IF NOT EXISTS idx_system_logs_action      ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_table_name  ON system_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at  ON system_logs(created_at DESC);
