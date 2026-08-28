-- Teams feature: team management with CRUD and role-based access
-- Issue: #62 – feat(frontend): Implement team management page with real backend

-- teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 80),
  description       TEXT CHECK (description IS NULL OR char_length(description) <= 300),
  owner_public_key  TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id              TEXT PRIMARY KEY,
  team_id         TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status          TEXT NOT NULL CHECK (status IN ('active', 'pending')) DEFAULT 'pending',
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ,
  UNIQUE (team_id, email)
);

-- team_invites table (for 7-day invite links)
CREATE TABLE IF NOT EXISTS public.team_invites (
  id          TEXT PRIMARY KEY,
  team_id     TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team_id    ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email       ON public.team_members(email);
CREATE INDEX IF NOT EXISTS idx_teams_owner_public_key  ON public.teams(owner_public_key);
CREATE INDEX IF NOT EXISTS idx_team_invites_token      ON public.team_invites(token);

-- RLS: Enable but allow service role full access
ALTER TABLE public.teams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites   ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_all_teams"         ON public.teams          FOR ALL USING (true);
CREATE POLICY "service_role_all_team_members"  ON public.team_members   FOR ALL USING (true);
CREATE POLICY "service_role_all_team_invites"  ON public.team_invites   FOR ALL USING (true);
