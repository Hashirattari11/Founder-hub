-- =============================================================
-- Phase 12 (Part 1): AI Co-Founder Matching
-- Idempotent — safe to re-run in Supabase SQL Editor.
-- =============================================================

CREATE TABLE IF NOT EXISTS cofounder_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  match_score INTEGER,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, target_id)
);

CREATE TABLE IF NOT EXISTS cofounder_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  looking_for_roles TEXT[],
  industry_focus TEXT[],
  commitment_level TEXT CHECK (commitment_level IN ('full_time','part_time','flexible')),
  equity_willing_to_give NUMERIC(5,2),
  startup_stage TEXT,
  location_preference TEXT CHECK (location_preference IN ('same_city','same_country','remote_ok')),
  description TEXT,
  is_looking BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cofounder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cofounder_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own cofounder requests" ON cofounder_requests;
CREATE POLICY "Users manage own cofounder requests" ON cofounder_requests
  FOR ALL USING (auth.uid() = requester_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "Anyone can view cofounder preferences" ON cofounder_preferences;
CREATE POLICY "Anyone can view cofounder preferences" ON cofounder_preferences
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own preferences" ON cofounder_preferences;
CREATE POLICY "Users manage own preferences" ON cofounder_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS cofounder_requests_requester_id_idx ON cofounder_requests(requester_id);
CREATE INDEX IF NOT EXISTS cofounder_requests_target_id_idx ON cofounder_requests(target_id);
CREATE INDEX IF NOT EXISTS cofounder_requests_status_idx ON cofounder_requests(status);
CREATE INDEX IF NOT EXISTS cofounder_preferences_user_id_idx ON cofounder_preferences(user_id);
