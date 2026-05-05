-- SQL script to create Support Tickets and Feedbacks tables
-- Run this in your Supabase SQL Editor

-- ============================================================
-- 1. SUPPORT TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  concern_type TEXT NOT NULL CHECK (concern_type IN ('Technical Issue', 'Request Follow-up', 'General Inquiry')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own support tickets" 
ON support_tickets FOR ALL USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')
  )
);

-- ============================================================
-- 2. FEEDBACKS
-- ============================================================
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedbacks_user ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_rating ON feedbacks(rating);

-- RLS
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own feedback" 
ON feedbacks FOR ALL USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')
  )
);

-- ============================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_support_tickets_updated') THEN
    CREATE TRIGGER trg_support_tickets_updated 
    BEFORE UPDATE ON support_tickets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
