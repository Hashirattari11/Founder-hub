-- =============================================================
-- Phase 15: AI Business Plan Generator (extended module)
-- Builds on Phase 14. Idempotent — safe to re-run in SQL Editor.
-- =============================================================

-- ---------------------------------------------------------------------------
-- business_plans
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS business_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  startup_name TEXT NOT NULL,
  idea TEXT NOT NULL,
  inputs JSONB DEFAULT '{}'::jsonb,
  business_plan JSONB DEFAULT '[]'::jsonb,
  pitch_deck JSONB DEFAULT '[]'::jsonb,
  financial_projection JSONB DEFAULT '{}'::jsonb,
  team_recommendations JSONB DEFAULT '[]'::jsonb,
  investor_readiness JSONB DEFAULT '{}'::jsonb,
  ai_recommendations JSONB DEFAULT '{}'::jsonb,
  share_token TEXT,
  is_public BOOLEAN DEFAULT false,
  provider TEXT DEFAULT 'offline',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE business_plans ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS business_plans_user_idx ON business_plans(user_id);
CREATE INDEX IF NOT EXISTS business_plans_created_idx ON business_plans(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS business_plans_share_token_idx ON business_plans(share_token) WHERE share_token IS NOT NULL;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_business_plan()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_plans_touch ON business_plans;
CREATE TRIGGER business_plans_touch
  BEFORE UPDATE ON business_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_business_plan();

-- ---------------------------------------------------------------------------
-- RLS policies (owner-only writes/reads; public shares are served by the
-- backend share-token endpoint via the service client)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Owners manage business plans" ON business_plans;
CREATE POLICY "Owners manage business plans"
  ON business_plans FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
