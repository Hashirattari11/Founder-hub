-- =============================================================
-- Phase 13: Startup Data Room + Equity & Cap Table Management
-- Idempotent — safe to re-run in Supabase SQL Editor.
-- =============================================================

-- -------------------------------------------------------------
-- DATA ROOMS
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS data_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  founder_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Data Room',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  require_nda BOOLEAN DEFAULT false,
  nda_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(startup_id)
);

CREATE TABLE IF NOT EXISTS data_room_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_room_id UUID REFERENCES data_rooms(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT CHECK (category IN (
    'pitch_deck','financials','legal','cap_table',
    'product','team','market_research','contracts','other'
  )),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  description TEXT,
  is_confidential BOOLEAN DEFAULT true,
  views_count INTEGER DEFAULT 0,
  downloads_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_room_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_room_id UUID REFERENCES data_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  access_level TEXT DEFAULT 'view' CHECK (access_level IN ('view','download','full')),
  nda_signed BOOLEAN DEFAULT false,
  nda_signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(data_room_id, user_id)
);

CREATE TABLE IF NOT EXISTS data_room_access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_room_id UUID REFERENCES data_rooms(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(data_room_id, requester_id)
);

CREATE TABLE IF NOT EXISTS document_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES data_room_documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT CHECK (action IN ('viewed','downloaded','shared')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE data_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_room_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_room_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_room_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Founders manage own data rooms" ON data_rooms;
CREATE POLICY "Founders manage own data rooms"
  ON data_rooms FOR ALL USING (auth.uid() = founder_id);

DROP POLICY IF EXISTS "Approved users view data room" ON data_rooms;
CREATE POLICY "Approved users view data room"
  ON data_rooms FOR SELECT USING (
    auth.uid() = founder_id OR
    EXISTS (
      SELECT 1 FROM data_room_access
      WHERE data_room_access.data_room_id = data_rooms.id
      AND data_room_access.user_id = auth.uid()
      AND data_room_access.is_active = true
    )
  );

DROP POLICY IF EXISTS "Founders manage documents" ON data_room_documents;
CREATE POLICY "Founders manage documents"
  ON data_room_documents FOR ALL USING (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Approved users view documents" ON data_room_documents;
CREATE POLICY "Approved users view documents"
  ON data_room_documents FOR SELECT USING (
    auth.uid() = (SELECT founder_id FROM data_rooms WHERE data_rooms.id = data_room_documents.data_room_id)
    OR EXISTS (
      SELECT 1 FROM data_room_access dra
      WHERE dra.data_room_id = data_room_documents.data_room_id
      AND dra.user_id = auth.uid()
      AND dra.is_active = true
    )
  );

DROP POLICY IF EXISTS "Users manage own access requests" ON data_room_access_requests;
CREATE POLICY "Users manage own access requests"
  ON data_room_access_requests FOR ALL USING (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Founders view access requests" ON data_room_access_requests;
CREATE POLICY "Founders view access requests"
  ON data_room_access_requests FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM data_rooms
      WHERE data_rooms.id = data_room_access_requests.data_room_id
      AND data_rooms.founder_id = auth.uid()
    )
  );

-- Private storage bucket for data room files (signed URLs only).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'data-room-files',
  'data-room-files',
  false,
  26214400,
  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','application/vnd.ms-powerpoint','image/png','image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS data_room_documents_room_idx ON data_room_documents(data_room_id);
CREATE INDEX IF NOT EXISTS data_room_access_room_idx ON data_room_access(data_room_id);
CREATE INDEX IF NOT EXISTS data_room_access_user_idx ON data_room_access(user_id);
CREATE INDEX IF NOT EXISTS data_room_access_requests_room_idx ON data_room_access_requests(data_room_id);
CREATE INDEX IF NOT EXISTS document_activity_document_idx ON document_activity_logs(document_id);

-- -------------------------------------------------------------
-- CAP TABLE
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cap_tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  total_shares INTEGER DEFAULT 10000000,
  currency TEXT DEFAULT 'USD',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(startup_id)
);

CREATE TABLE IF NOT EXISTS cap_table_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cap_table_id UUID REFERENCES cap_tables(id) ON DELETE CASCADE,
  holder_name TEXT NOT NULL,
  holder_type TEXT CHECK (holder_type IN ('founder','investor','employee','advisor','esop','other')),
  holder_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  shares INTEGER NOT NULL,
  share_class TEXT DEFAULT 'common' CHECK (share_class IN ('common','preferred','options','warrants')),
  investment_amount BIGINT DEFAULT 0,
  investment_date DATE,
  vesting_start DATE,
  vesting_cliff_months INTEGER DEFAULT 12,
  vesting_total_months INTEGER DEFAULT 48,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS funding_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  round_name TEXT NOT NULL,
  round_type TEXT CHECK (round_type IN ('pre_seed','seed','series_a','series_b','bridge','angel','grant')),
  target_amount BIGINT,
  raised_amount BIGINT DEFAULT 0,
  pre_money_valuation BIGINT,
  post_money_valuation BIGINT,
  share_price NUMERIC(10,4),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  open_date DATE,
  close_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cap_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE cap_table_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Founders manage cap table" ON cap_tables;
CREATE POLICY "Founders manage cap table"
  ON cap_tables FOR ALL USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Data room access can view cap table" ON cap_tables;
CREATE POLICY "Data room access can view cap table"
  ON cap_tables FOR SELECT USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM data_room_access dra
      JOIN data_rooms dr ON dr.startup_id = cap_tables.startup_id
      WHERE dra.user_id = auth.uid() AND dra.is_active = true
    )
  );

DROP POLICY IF EXISTS "Founders manage entries" ON cap_table_entries;
CREATE POLICY "Founders manage entries"
  ON cap_table_entries FOR ALL USING (
    EXISTS (
      SELECT 1 FROM cap_tables
      WHERE cap_tables.id = cap_table_entries.cap_table_id
      AND cap_tables.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Founders manage funding rounds" ON funding_rounds;
CREATE POLICY "Founders manage funding rounds"
  ON funding_rounds FOR ALL USING (
    EXISTS (
      SELECT 1 FROM startups
      WHERE startups.id = funding_rounds.startup_id
      AND startups.founder_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "View funding rounds with data room access" ON funding_rounds;
CREATE POLICY "View funding rounds with data room access"
  ON funding_rounds FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM startups
      WHERE startups.id = funding_rounds.startup_id
      AND (
        startups.founder_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM data_room_access dra
          JOIN data_rooms dr ON dr.startup_id = funding_rounds.startup_id
          WHERE dra.user_id = auth.uid() AND dra.is_active = true
        )
      )
    )
  );

CREATE INDEX IF NOT EXISTS cap_table_entries_table_idx ON cap_table_entries(cap_table_id);
CREATE INDEX IF NOT EXISTS funding_rounds_startup_idx ON funding_rounds(startup_id);
