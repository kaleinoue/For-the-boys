-- =============================================================================
--  THE FORGE — Turso / libSQL schema
--
--  You do NOT need to run this by hand: server.js issues these same statements
--  on boot when TURSO_DATABASE_URL + TURSO_AUTH_TOKEN are set. It's here so the
--  shape of the data is readable, and for anyone who'd rather set it up first:
--
--      turso db shell the-forge < turso-schema.sql
-- =============================================================================

-- One row per crew member, plus a reserved '__mobs' row holding the mob/projectile
-- config as JSON. `steps` is JSON text (SQLite has no jsonb type).
create table if not exists forge_progress (
  crew_id    text primary key,
  xp         integer not null default 0,
  steps      text    not null default '{}',
  updated_at text
);

-- Sprite art, one row per unique image, keyed by a hash of its contents.
--
-- Art lives HERE and not inside forge_progress.steps on purpose. Inline base64
-- meant every mob edit rewrote every sprite, and every page load re-downloaded
-- all of them — megabytes per visit. Split out, each image is written once and
-- served from /api/sprites/<id>.png with an immutable cache header, so browsers
-- fetch it a single time. See README "Storage".
create table if not exists forge_sprites (
  id         text primary key,   -- sha256(mime:base64), first 32 hex chars
  mime       text not null,      -- image/png, image/webp, ...
  data       text not null,      -- base64 payload, no data: prefix
  created_at text
);

-- Seed the four crew rows (the server also upserts these on write).
insert into forge_progress (crew_id) values
  ('zeppelin'), ('leo'), ('jonah'), ('jyana')
on conflict (crew_id) do nothing;
