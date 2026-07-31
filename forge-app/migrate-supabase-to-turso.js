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
//    node migrate-supabase-to-turso.js --from-file export.json
//        # read a hand-made JSON export instead of Supabase's REST API. Needed when
//        # the project is RESTRICTED (free-tier egress cap): the API you'd use to
//        # get your data out is the first thing the cap takes away. The dashboard
//        # SQL editor still works — see the README for the export query.
//
//  Needs BOTH sets of credentials at once. It reads .env if there is one, and
//  ASKS for anything missing — so you can just run it and paste the four values,
//  with no .env at all. It offers to save them at the end.
//
//  Reads Supabase, writes Turso; never writes to Supabase, so the old data stays
//  put as a rollback.
//
//  Safe to re-run: every write is an upsert keyed on crew_id / sprite id.
// =============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

// same minimal .env loader the server uses. `envFile` / `envKeys` are kept so a
// missing-credentials error can say WHICH thing went wrong — no file at all,
// versus a file whose keys aren't the ones we're looking for.
const ENV_PATH = path.join(__dirname, '.env');
let envFile = null;
const envKeys = [];
(function loadEnv() {
  let raw;
  try { raw = fs.readFileSync(ENV_PATH, 'utf8'); } catch { return; }   // no .env — fine
  envFile = ENV_PATH;
  // \r\n: Windows editors write CRLF, and splitting on \n alone leaves a trailing
  // carriage return glued to every value — enough to corrupt a URL or a token.
  // ﻿: Notepad and PowerShell's utf8 both prepend a BOM.
  for (const line of raw.replace(/^﻿/, '').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    envKeys.push(m[1]);
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const argv = process.argv.slice(2);
const args = new Set(argv);
const DRY = args.has('--dry-run');
const OVERWRITE = args.has('--overwrite');
// --from-file <path> or --from-file=<path>: read a hand-made JSON export instead of
// Supabase's REST API. The escape hatch for a project that's been restricted — the
// API you need to get your data out is the first thing a quota cap takes away.
const FROM_FILE = (() => {
  const i = argv.findIndex(a => a === '--from-file' || a.startsWith('--from-file='));
  if (i === -1) return null;
  const v = argv[i].includes('=') ? argv[i].slice(argv[i].indexOf('=') + 1) : argv[i + 1];
  if (!v || v.startsWith('--')) die('--from-file needs a path, e.g. --from-file export.json');
  return v;
})();

// Applied to whatever we end up with, from .env or from the keyboard — a hand-pasted
// value is just as likely to carry a trailing slash or a libsql:// scheme as a stored one.
const cleanUrl = (v) => (v || '').trim().replace(/\/$/, '');
const cleanTursoUrl = (v) => cleanUrl(v).replace(/^libsql:\/\//, 'https://');

let SB_URL = cleanUrl(process.env.SUPABASE_URL);
let SB_KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '').trim();
const SB_TABLE = process.env.SUPABASE_TABLE || 'forge_progress';
const SB_SPRITES = process.env.SUPABASE_SPRITE_TABLE || 'forge_sprites';
let TURSO_URL = cleanTursoUrl(process.env.TURSO_DATABASE_URL);
let TURSO_TOKEN = (process.env.TURSO_AUTH_TOKEN || '').trim();

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

// "Missing X" on its own sends people hunting through a file that was never read.
// Say which situation it is, and list the key names actually parsed (names only —
// the values are secrets). Only reachable with no TTY: a human gets asked instead.
function dieMissing(names) {
  const out = [`Missing ${names.join(' / ')}, and there's no terminal to ask on.`, ''];
  if (!envFile) {
    out.push(`  No .env found at: ${ENV_PATH}`,
             '  That exact path is the only one read. A .env in the repo root, or one that',
             "  Notepad silently saved as .env.txt, won't be picked up.");
  } else {
    out.push(`  Read .env from:   ${envFile}`,
             `  Keys found in it: ${envKeys.length ? envKeys.join(', ') : '(none — if you saved from Notepad, re-save as UTF-8, not Unicode)'}`,
             '',
             '  The file loaded, but those key names are not in it. Check the spelling, and',
             '  that every line reads  KEY=value  with nothing before the key.');
  }
  out.push('', '  Or pass them inline:  SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node migrate-supabase-to-turso.js');
  die(out.join('\n'));
}

// ---- asking for whatever .env didn't supply ---------------------------------
// ONE readline interface for the whole run. Opening a fresh one per question can
// swallow input that has already been buffered — a multi-line paste, or answers
// piped in — because those bytes arrive before the next interface exists. Typed
// values echo normally: masking them means raw mode, and a mis-masked prompt on
// some Windows terminal would be a worse failure than a token sitting in the
// scrollback of a local one-shot script.
let rl = null;
let queued = [];        // lines that arrived before anything asked for them
let waiting = null;     // resolver for an ask() that outran the input
let ended = false;      // stdin closed — asking again would hang forever

function rlInit() {
  if (rl) return;
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // rl.question() only listens for ONE line, and readline emits every line in a
  // chunk the moment it arrives — so pasting all four values at once would fire
  // the first callback and drop the other three on the floor, leaving question 2
  // waiting for input that has already been consumed. Keep them instead.
  rl.on('line', (line) => {
    if (waiting) { const w = waiting; waiting = null; w(line.trim()); }
    else queued.push(line.trim());
  });
  rl.on('close', () => { ended = true; if (waiting) { const w = waiting; waiting = null; w(''); } });
}
function ask(question) {
  rlInit();
  process.stdout.write(question);
  if (queued.length) return Promise.resolve(queued.shift());
  if (ended) return Promise.resolve('');
  return new Promise((resolve) => { waiting = resolve; });
}
function askDone() { if (rl) { rl.close(); rl = null; } }

// Every failed run of this script so far has been a credential that never reached
// process.env: a file that was really .env.example, one Notepad saved as .env.txt,
// a BOM, CRLF. Printing better instructions for editing a file only helps if the
// file is the thing you can get right — so ask for the value instead, and let the
// paste go straight into memory where none of that can intercept it.
async function ensureCredentials() {
  const want = [
    // Reading from a file means Supabase is never contacted, so demanding its
    // credentials would block the one path that still works when the project is
    // restricted — which is the whole point of --from-file.
    ...(FROM_FILE ? [] : [
      ['SUPABASE_URL',         'Supabase project URL — https://xxxxx.supabase.co',   () => SB_URL,      (v) => { SB_URL = cleanUrl(v); }],
      ['SUPABASE_SERVICE_KEY', 'Supabase service_role key — Settings → API',         () => SB_KEY,      (v) => { SB_KEY = v.trim(); }],
    ]),
    ['TURSO_DATABASE_URL',   'Turso URL — turso db show <name> --url',               () => TURSO_URL,   (v) => { TURSO_URL = cleanTursoUrl(v); }],
    ['TURSO_AUTH_TOKEN',     'Turso token — turso db tokens create <name>',          () => TURSO_TOKEN, (v) => { TURSO_TOKEN = v.trim(); }],
  ];
  const missing = want.filter(([, , get]) => !get());
  if (!missing.length) return;
  if (!process.stdin.isTTY) dieMissing(missing.map(([name]) => name));

  console.log(`\n🔑 ${missing.length} value(s) missing${envFile ? ` — .env was read, but doesn't contain them` : ' — no .env found'}.`);
  console.log('   Paste them below; they show on screen as you go. Ctrl-C aborts.\n');

  const typed = new Map();
  for (const [name, help, , set] of missing) {
    let v = '';
    while (!v) {
      v = await ask(`   ${name}\n     ${help}\n   > `);
      // Without the `ended` check an exhausted stdin returns '' forever and this
      // spins instead of stopping.
      if (!v && ended) die(`Input ended before ${name} was given — nothing was changed.`);
      if (!v) console.log('     (that was empty — paste the value, or Ctrl-C to stop)');
    }
    typed.set(name, v); set(v);
  }

  const yes = /^y(es)?$/i.test(await ask('\n   Save these to .env so the next run needs no typing? [y/N] > '));
  askDone();
  if (!yes) return console.log('   Not saved — they live only in this run.\n');
  try {
    let existing = '';
    try { existing = fs.readFileSync(ENV_PATH, 'utf8'); } catch { /* creating it */ }
    if (existing && !existing.endsWith('\n')) existing += '\n';
    // The raw typed text, not the normalised form — .env should read back the way
    // Supabase and Turso hand these out. Both this script and the server tolerate
    // a trailing slash and libsql://, so nothing depends on the tidying.
    const block = [...typed].map(([k, v]) => `${k}=${v}`).join('\n');
    fs.writeFileSync(ENV_PATH, `${existing}${block}\n`, { mode: 0o600 });
    console.log(`   ✔ Wrote ${typed.size} line(s) to ${ENV_PATH} — gitignored, so it won't be committed.\n`);
  } catch (e) {
    console.log(`   ⚠ Couldn't write .env (${e.message}) — continuing anyway; this run still has the values.\n`);
  }
}

// ---- read side --------------------------------------------------------------
async function sbGet(pathQuery) {
  const res = await fetch(`${SB_URL}/rest/v1/${pathQuery}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 404) return null;                      // table doesn't exist
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    // 402 means the project is restricted — usually the free-tier egress cap. The
    // REST API is exactly what you need to GET OUT of Supabase, so being locked out
    // of it is worth naming rather than leaving as a bare status code.
    if (res.status === 402) {
      throw new Error(`Supabase 402 — the project is restricted, so the REST API won't serve reads:\n` +
        `  ${body}\n\n` +
        `  You can still migrate. Export the two tables from the Supabase dashboard's SQL\n` +
        `  editor (it keeps working while the API is capped) and re-run with --from-file.\n` +
        `  See "Migrating from a restricted project" in forge-app/README.md.`);
    }
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  return res.json();
}

// Two ways in: the live REST API, or a JSON export produced by hand. Both hand back
// the same two shapes, so everything downstream is identical either way.
function restSource() {
  return {
    label: SB_URL,
    progress: () => sbGet(`${SB_TABLE}?select=crew_id,xp,steps&limit=1000`),
    async sprites(onProgress) {
      const index = await sbGet(`${SB_SPRITES}?select=id&limit=5000`);
      if (index === null) return null;
      // one at a time: a sprite runs to ~320 KB, and this keeps memory and request
      // sizes predictable while giving real progress output
      const out = [];
      for (const { id } of index) {
        const rows = await sbGet(`${SB_SPRITES}?id=eq.${encodeURIComponent(id)}&select=id,mime,data`);
        if (rows && rows[0]) out.push(rows[0]);
        onProgress(out.length, index.length);
      }
      return out;
    },
  };
}

// Accepts either { progress: [...], sprites: [...] } or a bare progress array, since
// a hand-run `select ... for json`-style export can plausibly produce either.
function fileSource(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { die(`Can't read ${file}: ${e.message}`); }
  let doc;
  try { doc = JSON.parse(raw.replace(/^﻿/, '')); } catch (e) { die(`${file} isn't valid JSON: ${e.message}`); }
  if (Array.isArray(doc)) doc = { progress: doc };
  if (!doc || typeof doc !== 'object') die(`${file} should hold a JSON object or array.`);
  const progress = doc.progress || doc.forge_progress;
  if (!Array.isArray(progress)) {
    die(`${file} has no "progress" array.\n` +
        `  Expected: { "progress": [ {crew_id, xp, steps}, … ], "sprites": [ {id, mime, data}, … ] }\n` +
        `  Found keys: ${Object.keys(doc).join(', ') || '(none)'}`);
  }
  const sprites = doc.sprites || doc.forge_sprites || null;
  if (sprites !== null && !Array.isArray(sprites)) die(`${file}: "sprites" should be an array if present.`);
  for (const r of progress) {
    if (!r || typeof r.crew_id !== 'string') die(`${file}: every progress row needs a "crew_id" string.`);
  }
  return {
    label: file,
    progress: async () => progress,
    sprites: async () => sprites,
  };
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
  await ensureCredentials();
  const source = FROM_FILE ? fileSource(FROM_FILE) : restSource();
  console.log(`   from: ${source.label}`);
  console.log(`   to:   ${TURSO_URL}\n`);

  // ---- 1. read the source ----
  const progressRows = await source.progress();
  if (progressRows === null) die(`Table "${SB_TABLE}" not found in Supabase — nothing to migrate.`);
  const crewRows = progressRows.filter(r => r.crew_id !== '__mobs');
  const mobsRow = progressRows.find(r => r.crew_id === '__mobs');
  console.log(`📖 ${FROM_FILE ? 'Export file' : 'Supabase'}: ${crewRows.length} crew row(s)${mobsRow ? ' + the __mobs config' : ', no __mobs config'}`);

  const sprites = new Map();
  const spriteRows = await source.sprites((n, total) => process.stdout.write(`\r   reading sprites… ${n}/${total}`));
  if (spriteRows === null) {
    console.log(`   (no "${SB_SPRITES}" data — that's fine, art may still be inline)`);
  } else {
    if (spriteRows.length && !FROM_FILE) process.stdout.write('\n');
    for (const r of spriteRows) if (r && r.id) sprites.set(r.id, r);
    if (FROM_FILE) console.log(`   ${sprites.size} sprite(s) in the export`);
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
