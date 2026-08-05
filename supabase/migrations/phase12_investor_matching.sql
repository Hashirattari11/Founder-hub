-- =============================================================
-- Phase 12 (Part 2): AI Investor Matching
-- Idempotent — safe to re-run in Supabase SQL Editor.
-- =============================================================

CREATE TABLE IF NOT EXISTS investor_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  investment_thesis TEXT,
  portfolio_companies TEXT[],
  check_size_min BIGINT,
  check_size_max BIGINT,
  preferred_industries TEXT[],
  preferred_stages TEXT[],
  preferred_locations TEXT[],
  value_add TEXT,
  total_investments INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investor_match_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  investor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  founder_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  match_score INTEGER,
  ai_reasoning TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','viewed','interested','passed','meeting_scheduled')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(startup_id, investor_id)
);

ALTER TABLE investor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_match_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view investor profiles" ON investor_profiles;
CREATE POLICY "Anyone can view investor profiles" ON investor_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Investors manage own profile" ON investor_profiles;
CREATE POLICY "Investors manage own profile" ON investor_profiles
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Founders view own match requests" ON investor_match_requests;
CREATE POLICY "Founders view own match requests" ON investor_match_requests
  FOR SELECT USING (auth.uid() = founder_id OR auth.uid() = investor_id);

DROP POLICY IF EXISTS "Founders create match requests" ON investor_match_requests;
CREATE POLICY "Founders create match requests" ON investor_match_requests
  FOR INSERT WITH CHECK (auth.uid() = founder_id);

DROP POLICY IF EXISTS "Investors update own match requests" ON investor_match_requests;
CREATE POLICY "Investors update own match requests" ON investor_match_requests
  FOR UPDATE USING (auth.uid() = investor_id);

CREATE INDEX IF NOT EXISTS investor_profiles_user_id_idx ON investor_profiles(user_id);
CREATE INDEX IF NOT EXISTS investor_match_requests_startup_id_idx ON investor_match_requests(startup_id);
CREATE INDEX IF NOT EXISTS investor_match_requests_investor_id_idx ON investor_match_requests(investor_id);
CREATE INDEX IF NOT EXISTS investor_match_requests_founder_id_idx ON investor_match_requests(founder_id);
CREATE INDEX IF NOT EXISTS investor_match_requests_status_idx ON investor_match_requests(status);
