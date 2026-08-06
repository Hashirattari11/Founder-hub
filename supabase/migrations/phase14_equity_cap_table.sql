-- =============================================================
-- Phase 14: Equity & Cap Table Management (extended module)
-- Builds on Phase 13. Idempotent — safe to re-run in SQL Editor.
-- =============================================================

-- ---------------------------------------------------------------------------
-- Security-definer helpers (avoid RLS recursion like the meetings fix).
-- Management = startup founder. View = founder OR valid data room access.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cap_table_owner(cap_table_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.founder_id
  FROM cap_tables ct
  JOIN startups s ON s.id = ct.startup_id
  WHERE ct.id = cap_table_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_cap_table(cap_table_id uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.cap_table_owner(cap_table_id) = p_user;
$$;

CREATE OR REPLACE FUNCTION public.can_view_cap_table(cap_table_id uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.cap_table_owner(cap_table_id) = p_user
  OR EXISTS (
    SELECT 1
    FROM cap_tables ct
    JOIN data_rooms dr ON dr.startup_id = ct.startup_id
    JOIN data_room_access dra ON dra.data_room_id = dr.id
    WHERE ct.id = cap_table_id
      AND dra.user_id = p_user
      AND dra.is_active = true
      AND (NOT dr.require_nda OR dra.nda_signed)
      AND (dra.expires_at IS NULL OR dra.expires_at > now())
  );
$$;

-- ---------------------------------------------------------------------------
-- Extend cap_tables (Phase 13) with ESOP pool + default vesting settings
-- ---------------------------------------------------------------------------

ALTER TABLE cap_tables
  ADD COLUMN IF NOT EXISTS esop_pool_shares BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_vesting_cliff_months INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS default_vesting_total_months INTEGER DEFAULT 48;

-- ---------------------------------------------------------------------------
-- share_classes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS share_classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cap_table_id UUID NOT NULL REFERENCES cap_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class_type TEXT DEFAULT 'common' CHECK (class_type IN ('common','preferred','options','warrants')),
  par_value NUMERIC(12,4) DEFAULT 0.0001,
  liquidation_preference NUMERIC(6,2) DEFAULT 1.00,
  voting_rights BOOLEAN DEFAULT true,
  conversion_ratio NUMERIC(12,6) DEFAULT 1.0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE share_classes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- equity_holders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS equity_holders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cap_table_id UUID NOT NULL REFERENCES cap_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  title TEXT,
  holder_type TEXT DEFAULT 'other' CHECK (holder_type IN ('founder','investor','employee','advisor','esop','other')),
  share_class_id UUID REFERENCES share_classes(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  shares BIGINT NOT NULL DEFAULT 0,
  equity_percent NUMERIC(6,3),
  investment_amount BIGINT DEFAULT 0,
  investment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE equity_holders ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- vesting_schedules
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vesting_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  holder_id UUID NOT NULL REFERENCES equity_holders(id) ON DELETE CASCADE,
  schedule_type TEXT DEFAULT 'standard' CHECK (schedule_type IN ('standard','cliff_only','accelerated','custom')),
  start_date DATE,
  cliff_months INTEGER DEFAULT 12,
  total_months INTEGER DEFAULT 48,
  vesting_frequency TEXT DEFAULT 'monthly' CHECK (vesting_frequency IN ('monthly','quarterly','annually')),
  exercise_price NUMERIC(12,4),
  acceleration_on_sale BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vesting_schedules ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- investment_rounds
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS investment_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cap_table_id UUID NOT NULL REFERENCES cap_tables(id) ON DELETE CASCADE,
  round_name TEXT NOT NULL,
  round_type TEXT DEFAULT 'seed' CHECK (round_type IN ('pre_seed','seed','series_a','series_b','series_c','bridge','angel','grant','other')),
  target_amount BIGINT,
  raised_amount BIGINT DEFAULT 0,
  pre_money_valuation BIGINT,
  post_money_valuation BIGINT,
  new_shares_issued BIGINT,
  share_price NUMERIC(12,4),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','open','closed','cancelled')),
  open_date DATE,
  close_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE investment_rounds ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS share_classes_cap_table_idx ON share_classes(cap_table_id);
CREATE INDEX IF NOT EXISTS equity_holders_cap_table_idx ON equity_holders(cap_table_id);
CREATE INDEX IF NOT EXISTS equity_holders_user_idx ON equity_holders(user_id);
CREATE INDEX IF NOT EXISTS equity_holders_class_idx ON equity_holders(share_class_id);
CREATE INDEX IF NOT EXISTS vesting_schedules_holder_idx ON vesting_schedules(holder_id);
CREATE INDEX IF NOT EXISTS investment_rounds_cap_table_idx ON investment_rounds(cap_table_id);

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Founders manage cap table" ON cap_tables;
CREATE POLICY "Founders manage cap table"
  ON cap_tables FOR ALL USING (public.can_manage_cap_table(id))
  WITH CHECK (public.can_manage_cap_table(id));

DROP POLICY IF EXISTS "Data room access can view cap table" ON cap_tables;
CREATE POLICY "Data room access can view cap table"
  ON cap_tables FOR SELECT USING (public.can_view_cap_table(id));

DROP POLICY IF EXISTS "Founders manage share classes" ON share_classes;
CREATE POLICY "Founders manage share classes"
  ON share_classes FOR ALL USING (public.can_manage_cap_table(cap_table_id))
  WITH CHECK (public.can_manage_cap_table(cap_table_id));

DROP POLICY IF EXISTS "Data room can view share classes" ON share_classes;
CREATE POLICY "Data room can view share classes"
  ON share_classes FOR SELECT USING (public.can_view_cap_table(cap_table_id));

DROP POLICY IF EXISTS "Founders manage equity holders" ON equity_holders;
CREATE POLICY "Founders manage equity holders"
  ON equity_holders FOR ALL USING (public.can_manage_cap_table(cap_table_id))
  WITH CHECK (public.can_manage_cap_table(cap_table_id));

DROP POLICY IF EXISTS "Data room can view equity holders" ON equity_holders;
CREATE POLICY "Data room can view equity holders"
  ON equity_holders FOR SELECT USING (public.can_view_cap_table(cap_table_id));

DROP POLICY IF EXISTS "Holders view own equity" ON equity_holders;
CREATE POLICY "Holders view own equity"
  ON equity_holders FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Founders manage vesting schedules" ON vesting_schedules;
CREATE POLICY "Founders manage vesting schedules"
  ON vesting_schedules FOR ALL USING (
    EXISTS (SELECT 1 FROM equity_holders eh WHERE eh.id = vesting_schedules.holder_id AND public.can_manage_cap_table(eh.cap_table_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM equity_holders eh WHERE eh.id = vesting_schedules.holder_id AND public.can_manage_cap_table(eh.cap_table_id))
  );

DROP POLICY IF EXISTS "Data room can view vesting schedules" ON vesting_schedules;
CREATE POLICY "Data room can view vesting schedules"
  ON vesting_schedules FOR SELECT USING (
    EXISTS (SELECT 1 FROM equity_holders eh WHERE eh.id = vesting_schedules.holder_id AND public.can_view_cap_table(eh.cap_table_id))
  );

DROP POLICY IF EXISTS "Founders manage investment rounds" ON investment_rounds;
CREATE POLICY "Founders manage investment rounds"
  ON investment_rounds FOR ALL USING (public.can_manage_cap_table(cap_table_id))
  WITH CHECK (public.can_manage_cap_table(cap_table_id));

DROP POLICY IF EXISTS "Data room can view investment rounds" ON investment_rounds;
CREATE POLICY "Data room can view investment rounds"
  ON investment_rounds FOR SELECT USING (public.can_view_cap_table(cap_table_id));

-- ---------------------------------------------------------------------------
-- Seed default share classes for every cap table
-- ---------------------------------------------------------------------------

INSERT INTO share_classes (cap_table_id, name, class_type)
SELECT ct.id, 'Common Stock', 'common'
FROM cap_tables ct
WHERE NOT EXISTS (SELECT 1 FROM share_classes sc WHERE sc.cap_table_id = ct.id AND sc.class_type = 'common');

INSERT INTO share_classes (cap_table_id, name, class_type)
SELECT ct.id, 'Preferred Stock', 'preferred'
FROM cap_tables ct
WHERE NOT EXISTS (SELECT 1 FROM share_classes sc WHERE sc.cap_table_id = ct.id AND sc.class_type = 'preferred');

INSERT INTO share_classes (cap_table_id, name, class_type)
SELECT ct.id, 'Options Pool', 'options'
FROM cap_tables ct
WHERE NOT EXISTS (SELECT 1 FROM share_classes sc WHERE sc.cap_table_id = ct.id AND sc.class_type = 'options');
