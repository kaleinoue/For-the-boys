#!/usr/bin/env node
// =============================================================================
//  THE FORGE — one-shot copy of Supabase -> Turso
//
//  Switching TURSO_* on doesn't bring your data with it: a fresh Turso database
//  is empty, so the crew's XP and every mob/sprite they built would look wiped.
//  Run this once, before (or right after) you flip the env vars.
//
//    node migrate-supabase-to-turso.js --dry-run     # look, change nothing
//    node migrate-supabase-to-turso.js               # do it
//
//  Needs BOTH sets of credentials present at once — put the TURSO_* values in
//  .env next to the SUPABASE_* ones and run it locally. Reads Supabase, writes
//  Turso; never writes to Supabase, so the old data stays put as a rollback.
//
//  Safe to re-run: every write is an upsert keyed on crew_id / sprite id.
// =============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// same minimal .env loader the server uses
(function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env — fine */ }
})();

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const OVERWRITE = args.has('--overwrite');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const SB_TABLE = process.env.SUPABASE_TABLE || 'forge_progress';
const SB_SPRITES = process.env.SUPABASE_SPRITE_TABLE || 'forge_sprites';
const TURSO_URL = (process.env.TURSO_DATABASE_URL || '').trim().replace(/\/$/, '').replace(/^libsql:\/\//, 'https://');
const TURSO_TOKEN = (process.env.TURSO_AUTH_TOKEN || '').trim();

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
if (!SB_URL || !SB_KEY) die('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY — this script reads from Supabase.');
if (!TURSO_URL || !TURSO_TOKEN) die('Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN — this script writes to Turso.');

// ---- Supabase (read side) ---------------------------------------------------
async function sbGet(pathQuery) {
  const res = await fetch(`${SB_URL}/rest/v1/${pathQuery}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 404) return null;                      // table doesn't exist
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// ---- Turso (write side) -----------------------------------------------------
const tArg = (v) => v === null || v === undefined ? { type: 'null' }
  : typeof v === 'number' ? (Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v })
  : { type: 'text', value: String(v) };
const sql = (text, ...a) => ({ sql: text, args: a.map(tArg) });

function tursoRows(result) {
  const cols = (result.cols || []).map(c => c.name);
  return (result.rows || []).map(row => {
    const o = {};
    row.forEach((cell, i) => { o[cols[i]] = cell.type === 'null' ? null : cell.type === 'integer' ? Number(cell.value) : cell.value; });
    return o;
  });
}
async function tursoRun(...stmts) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TURSO_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [...stmts.map(s => ({ type: 'execute', stmt: typeof s === 'string' ? { sql: s } : s })), { type: 'close' }] }),
  });
  if (!res.ok) throw new Error(`Turso ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const out = [];
  for (const r of body.results || []) {
    if (r.type === 'error') throw new Error(`Turso SQL: ${(r.error && r.error.message) || 'unknown'}`);
    if (r.response && r.response.type === 'execute') out.push(tursoRows(r.response.result));
  }
  return out;
}

// ---- sprite helpers (must match server.js exactly, or URLs won't resolve) ----
const SPRITE_MIME = { 'image/png': 1, 'image/webp': 1, 'image/jpeg': 1, 'image/gif': 1 };
const spriteHash = (mime, b64) => crypto.createHash('sha256').update(mime + ':' + b64).digest('hex').slice(0, 32);
function parseDataUrl(s) {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(s || '');
  if (!m || !SPRITE_MIME[m[1]]) return null;
  return { mime: m[1], b64: m[2] };
}
const safeJson = (v, fb) => { if (v && typeof v === 'object') return v; try { return JSON.parse(v); } catch { return fb; } };

// If the Supabase copy predates the sprite split, art is still inline in the config.
// Pull it out here so the Turso copy lands in the new shape either way.
function extractInlineSprites(cfg, sprites) {
  let moved = 0;
  for (const group of [cfg.mobs, cfg.projectiles]) {
    for (const id in (group || {})) {
      const d = group[id];
      if (!d || typeof d.sprite !== 'string' || !d.sprite.startsWith('data:image/')) continue;
      const parsed = parseDataUrl(d.sprite);
      delete d.sprite;
      if (!parsed) continue;
      const sid = spriteHash(parsed.mime, parsed.b64);
      if (!sprites.has(sid)) sprites.set(sid, { id: sid, mime: parsed.mime, data: parsed.b64 });
      d.spriteId = sid; moved++;
    }
  }
  return moved;
}

// -----------------------------------------------------------------------------
(async function main() {
  console.log(`\n🔁 THE FORGE — Supabase ➜ Turso${DRY ? '   (DRY RUN — nothing will be written)' : ''}`);
  console.log(`   from: ${SB_URL}`);
  console.log(`   to:   ${TURSO_URL}\n`);

  // ---- 1. read Supabase ----
  const progressRows = await sbGet(`${SB_TABLE}?select=crew_id,xp,steps&limit=1000`);
  if (progressRows === null) die(`Table "${SB_TABLE}" not found in Supabase — nothing to migrate.`);
  const crewRows = progressRows.filter(r => r.crew_id !== '__mobs');
  const mobsRow = progressRows.find(r => r.crew_id === '__mobs');
  console.log(`📖 Supabase: ${crewRows.length} crew row(s)${mobsRow ? ' + the __mobs config' : ', no __mobs config'}`);

  const sprites = new Map();
  const spriteIndex = await sbGet(`${SB_SPRITES}?select=id&limit=5000`);
  if (spriteIndex === null) {
    console.log(`   (no "${SB_SPRITES}" table — that's fine, art may still be inline)`);
  } else {
    // fetched one at a time: a sprite is up to ~320 KB and this keeps memory
    // and request sizes predictable while giving real progress output
    for (const { id } of spriteIndex) {
      const rows = await sbGet(`${SB_SPRITES}?id=eq.${encodeURIComponent(id)}&select=id,mime,data`);
      if (rows && rows[0]) sprites.set(id, rows[0]);
      process.stdout.write(`\r   reading sprites… ${sprites.size}/${spriteIndex.length}`);
    }
    if (spriteIndex.length) process.stdout.write('\n');
  }

  // ---- 2. normalise the config ----
  // Copy the blob VERBATIM apart from sprite extraction: it carries keys this script
  // has no business knowing about (levels, classProjectiles, terrain, whatever comes
  // next), and dropping one would quietly delete the crew's work.
  let cfg = mobsRow ? safeJson(mobsRow.steps, {}) : null;
  let movedInline = 0;
  if (cfg) {
    movedInline = extractInlineSprites(cfg, sprites);
    if (movedInline) console.log(`🖼  Pulled ${movedInline} inline sprite(s) out of the config into their own records`);
    console.log(`   config keys carried over: ${Object.keys(cfg).join(', ') || '(none)'}`);
  }
  const totalXp = crewRows.reduce((n, r) => n + (r.xp || 0), 0);
  console.log(`📦 To copy: ${crewRows.length} crew row(s) (${totalXp} XP total), ${sprites.size} sprite(s)${cfg ? ', 1 mob config' : ''}`);

  if (DRY) {
    console.log('\n✔ Dry run complete — nothing written. Re-run without --dry-run to migrate.\n');
    return;
  }

  // ---- 3. prepare Turso ----
  await tursoRun(
    `create table if not exists forge_progress (
       crew_id text primary key, xp integer not null default 0,
       steps text not null default '{}', updated_at text)`,
    `create table if not exists forge_sprites (
       id text primary key, mime text not null, data text not null, created_at text)`,
  );

  // Refuse to clobber a Turso database that already has real progress in it.
  const [existing] = await tursoRun(sql(`select count(*) as n from forge_progress where xp > 0 or crew_id = '__mobs'`));
  if ((existing[0] || {}).n > 0 && !OVERWRITE) {
    die(`Turso already holds data (${existing[0].n} row(s) with XP or a mob config).\n` +
        `  Re-run with --overwrite to replace it, or point at an empty database.`);
  }

  // ---- 4. write ----
  const now = new Date().toISOString();
  const upsertProgress = (id, xp, steps) => sql(
    `insert into forge_progress (crew_id, xp, steps, updated_at) values (?, ?, ?, ?)
       on conflict(crew_id) do update set xp = excluded.xp, steps = excluded.steps, updated_at = excluded.updated_at`,
    id, xp, steps, now);

  if (crewRows.length) {
    await tursoRun(...crewRows.map(r => upsertProgress(r.crew_id, r.xp || 0, JSON.stringify(safeJson(r.steps, {})))));
    console.log(`✅ Wrote ${crewRows.length} crew row(s)`);
  }

  // One request per sprite: a batch of 30 × 320 KB would be a ~10 MB request body.
  let n = 0;
  for (const s of sprites.values()) {
    await tursoRun(sql(
      `insert into forge_sprites (id, mime, data, created_at) values (?, ?, ?, ?)
         on conflict(id) do update set mime = excluded.mime, data = excluded.data`,
      s.id, s.mime, s.data, now));
    process.stdout.write(`\r✅ Wrote ${++n}/${sprites.size} sprite(s)`);
  }
  if (sprites.size) process.stdout.write('\n');

  // Config last: it references sprite ids, so the art is already in place by now.
  if (cfg) {
    await tursoRun(upsertProgress('__mobs', 0, JSON.stringify(cfg)));
    console.log('✅ Wrote the mob/terrain config');
  }

  // ---- 5. verify by reading back ----
  const [gotCrew] = await tursoRun(sql(`select crew_id, xp from forge_progress where crew_id != '__mobs'`));
  const [gotSprites] = await tursoRun(sql(`select count(*) as n from forge_sprites`));
  const [gotCfg] = await tursoRun(sql(`select length(steps) as n from forge_progress where crew_id = '__mobs'`));
  const gotXp = gotCrew.reduce((t, r) => t + (r.xp || 0), 0);

  const problems = [];
  if (gotCrew.length !== crewRows.length) problems.push(`crew rows: expected ${crewRows.length}, found ${gotCrew.length}`);
  if (gotXp !== totalXp) problems.push(`total XP: expected ${totalXp}, found ${gotXp}`);
  if ((gotSprites[0] || {}).n !== sprites.size) problems.push(`sprites: expected ${sprites.size}, found ${(gotSprites[0] || {}).n}`);
  if (cfg && !(gotCfg[0] || {}).n) problems.push('mob config missing after write');

  // Every sprite the config points at must actually exist, or mobs render blank.
  if (cfg) {
    const want = new Set();
    for (const group of [cfg.mobs, cfg.projectiles])
      for (const id in (group || {})) if (group[id] && group[id].spriteId) want.add(group[id].spriteId);
    const [have] = await tursoRun(sql(`select id from forge_sprites`));
    const haveSet = new Set(have.map(r => r.id));
    const missing = [...want].filter(id => !haveSet.has(id));
    if (missing.length) problems.push(`${missing.length} referenced sprite(s) missing: ${missing.slice(0, 3).join(', ')}`);
  }

  if (problems.length) {
    console.error('\n✖ Verification FAILED:');
    for (const p of problems) console.error(`   - ${p}`);
    console.error('\n  Supabase was not modified — your original data is intact.\n');
    process.exit(1);
  }

  console.log(`\n✔ Verified: ${gotCrew.length} crew row(s), ${gotXp} XP, ${(gotSprites[0] || {}).n} sprite(s)${cfg ? ', config intact' : ''}`);
  console.log('\nNext: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN on your host and redeploy.');
  console.log('Leave the SUPABASE_* vars in place — Turso takes priority, so they stay as a rollback.');
  console.log('Confirm with /api/admin/health?code=YOURCODE → "storage":"turso".\n');
})().catch(e => die(e.message));
