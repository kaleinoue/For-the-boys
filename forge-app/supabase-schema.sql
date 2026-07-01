-- =============================================================================
--  THE FORGE — Supabase schema
--  Run this once in your Supabase project:  SQL Editor -> New query -> paste -> Run
-- =============================================================================

-- One row per crew member. `steps` holds each graded step as JSON.
create table if not exists forge_progress (
  crew_id    text primary key,
  xp         integer     not null default 0,
  steps      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seed the four crew rows (the server also upserts these on write).
insert into forge_progress (crew_id) values
  ('zeppelin'), ('leo'), ('jonah'), ('jyana')
on conflict (crew_id) do nothing;

-- Row Level Security ON. The app's server uses the SERVICE ROLE key, which
-- bypasses RLS. We add NO public policies, so the table is not readable with the
-- public anon key — progress is only reachable through your server. That's what
-- keeps it safe to make the game repo public.
alter table forge_progress enable row level security;
