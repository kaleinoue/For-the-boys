-- =============================================================================
--  THE FORGE — Supabase schema
--  Run this once in your Supabase project:  SQL Editor -> New query -> paste -> Run
--
--  Safe to re-run on an existing project: it only adds the forge_sprites table
--  needed by the sprite split (see README "Storage").
--
--  Note: Turso is the recommended backend now — see turso-schema.sql. This file
--  stays supported for existing projects.
-- =============================================================================

-- One row per crew member. `steps` holds each graded step as JSON.
create table if not exists forge_progress (
  crew_id    text primary key,
  xp         integer     not null default 0,
  steps      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Sprite art, one row per unique image, keyed by a hash of its contents.
--
-- Art lives HERE and not inside forge_progress.steps on purpose. Inline base64
-- meant every mob edit rewrote a multi-megabyte row (and Postgres MVCC keeps a
-- copy of each old version), and every page load re-downloaded the whole blob.
-- That is what exhausts a free tier. Split out, each image is written once and
-- served from /api/sprites/<id>.png with an immutable cache header.
create table if not exists forge_sprites (
  id         text primary key,   -- sha256(mime:base64), first 32 hex chars
  mime       text        not null,
  data       text        not null,   -- base64 payload, no data: prefix
  created_at timestamptz not null default now()
);

-- Seed the four crew rows (the server also upserts these on write).
insert into forge_progress (crew_id) values
  ('zeppelin'), ('leo'), ('jonah'), ('jyana')
on conflict (crew_id) do nothing;

-- Row Level Security ON. The app's server uses the SERVICE ROLE key, which
-- bypasses RLS. We add NO public policies, so these tables are not readable with
-- the public anon key — progress is only reachable through your server. That's
-- what keeps it safe to make the game repo public.
alter table forge_progress enable row level security;
alter table forge_sprites  enable row level security;

-- Reclaim the space the old inline-sprite rows left behind. Postgres keeps dead
-- row versions until vacuum runs; after migrating, this returns the disk.
--   vacuum full forge_progress;
