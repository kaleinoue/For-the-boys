// =============================================================================
//  THE FORGE — app server (zero dependencies; Node 18+)
//  Run:  node server.js       then open  http://localhost:3000
//
//   - serves the frontend in /public
//   - GET  /api/quests  -> campaign structure (rubrics stripped out)
//   - GET  /api/state   -> shared progress for all crew members
//   - POST /api/grade   -> AI-grades a response, awards XP, saves shared state
//   - POST /api/reset   -> wipes progress (handy while testing)
//
//  Secrets (Gemini key + database key) live ONLY here on the server, never in
//  the browser. Storage backend, in priority order: Turso, Supabase, local file.
//
//  Sprite art is NOT stored inside the mob-config blob. Each generated strip is
//  written once to its own content-hashed record and served as a real PNG from
//  /api/sprites/<hash>.png with immutable cache headers, so the browser fetches
//  it once and the database ships kilobytes of JSON instead of megabytes of
//  base64 on every page load. See README "Storage" for the why.
// =============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// minimal .env loader (no dependency) — reads KEY=value lines from ./.env
(function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env — fine */ }
})();

const { CREW, RANKS, ACTS } = require('./data/quests');
const GEARDATA = require('./public/battle-data.js');   // GEAR / CLASSES for validation

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const STATE_FILE = path.join(__dirname, 'data', 'progress.json');
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
// Free-tier default. Flash-Lite has by far the biggest daily allowance (~1000 requests/day
// vs ~250 for Flash), and it grades short answers against a rubric perfectly well — so the
// cheap model is the PRIMARY, not the fallback.
const MODEL = process.env.FORGE_MODEL || 'gemini-2.5-flash-lite';
// Grading fallback chain, ordered biggest-daily-quota first. Each model has its own quota,
// so a cap on one rolls to the next instead of blocking grading. Override with FORGE_MODELS.
//
// Keep RETIRED models out of this list. Every dead name costs a wasted round-trip on every
// grade before the chain reaches a model that answers. gemini-2.0-flash and
// gemini-2.0-flash-lite were shut down 2026-06-01; gemini-2.5-flash retires 2026-10-16.
const GRADE_MODELS = [...new Set((process.env.FORGE_MODELS || `${MODEL},gemini-2.5-flash`).split(',').map(s => s.trim()).filter(Boolean))];
// Models the API told us this key can't use (404 / not found). Remembered for the life of the
// process so we stop paying a round-trip to rediscover it on every single grade.
const deadModels = new Set();
const liveModels = () => { const live = GRADE_MODELS.filter(m => !deadModels.has(m)); return live.length ? live : GRADE_MODELS; };
const IMAGE_MODEL = process.env.FORGE_IMAGE_MODEL || 'gemini-2.5-flash-image';  // "Nano Banana"
// Override only for local testing against a stub. Leave unset in real use.
const GEMINI_BASE = (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
const PASS_SCORE = 60;
const MAX_SPRITE_BYTES = 320 * 1024;  // stored sprite strips are downscaled client-side; cap the payload

// Game Master / admin passcode. Set ADMIN_CODE in your env; defaults otherwise.
const ADMIN_CODE = process.env.ADMIN_CODE || 'forge-gm';
const adminOK = (code) => !!code && code === ADMIN_CODE;

// ---- sprites ----------------------------------------------------------------
// Stored defs carry only `spriteId` (a content hash). The bytes live in their own
// record, and /api/mobs hands the browser a URL. Two mobs generated from the same
// art therefore cost one copy, and re-saving a mob never re-uploads its sprite.
const SPRITE_MIME = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif' };
const SPRITE_URL_RE = /^\/api\/sprites\/([a-f0-9]{32})\.[a-z]{3,4}$/;

function parseDataUrl(s) {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(s || '');
  if (!m || !SPRITE_MIME[m[1]]) return null;
  return { mime: m[1], b64: m[2] };
}
const spriteHash = (mime, b64) => crypto.createHash('sha256').update(mime + ':' + b64).digest('hex').slice(0, 32);
const spriteUrl = (id) => `/api/sprites/${id}.png`;

// Turn whatever the editor sent into { spriteId, pending }. `pending` is set only
// when the bytes are new and still need writing to the store.
//   - a data: URL      -> freshly generated art
//   - /api/sprites/... -> the form was re-saved unchanged; reuse what's stored
function extractSprite(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  const hit = SPRITE_URL_RE.exec(raw);
  if (hit) return { spriteId: hit[1], pending: null };
  if (raw.length > MAX_SPRITE_BYTES) return null;
  const d = parseDataUrl(raw);
  if (!d) return null;
  const id = spriteHash(d.mime, d.b64);
  return { spriteId: id, pending: { id, ...d } };
}

// Swap stored spriteIds for URLs on the way out to the browser. battle.js sets
// `img.src = def.sprite`, which is happy with a URL or a data: URL alike.
function publicDefs(defs) {
  const out = {};
  for (const id in (defs || {})) {
    const d = defs[id];
    out[id] = d && d.spriteId ? { ...omit(d, 'spriteId'), sprite: spriteUrl(d.spriteId) } : d;
  }
  return out;
}
function omit(obj, key) { const { [key]: _drop, ...rest } = obj; return rest; }
function publicMobCfg(cfg) {
  return {
    mobs: publicDefs(cfg.mobs), levels: cfg.levels || {},
    projectiles: publicDefs(cfg.projectiles), classProjectiles: cfg.classProjectiles || {},
  };
}
// Every sprite the config still points at — anything else is orphaned art.
function referencedSprites(cfg) {
  const ids = new Set();
  for (const group of [cfg.mobs, cfg.projectiles])
    for (const id in (group || {})) if (group[id] && group[id].spriteId) ids.add(group[id].spriteId);
  return ids;
}

// Validate + clamp a mob definition coming from the God Mode editor.
function sanitizeMob(m) {
  if (!m || typeof m !== 'object') return null;
  const id = String(m.id || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
  if (!id) return null;
  const num = (v, def, lo, hi) => { v = Number(v); if (!isFinite(v)) v = def; return Math.max(lo, Math.min(hi, Math.round(v * 100) / 100)); };
  const ai = m.ai === 'shooter' ? 'shooter' : 'chase';
  const color = /^#[0-9a-fA-F]{6}$/.test(m.color) ? m.color : '#cc8855';
  const def = { name: String(m.name || id).slice(0, 28), hp: num(m.hp, 20, 1, 100000), atk: num(m.atk, 8, 0, 100000),
    speed: num(m.speed, 70, 5, 600), r: num(m.r, 13, 6, 60), color, ai, power: num(m.power, 1, 1, 4) };  // power = heart damage (heavy = 2+)
  if (ai === 'shooter') { def.shotCd = num(m.shotCd, 1.7, 0.2, 10); def.shotSpd = num(m.shotSpd, 180, 40, 1200); }
  // Optional animated sprite: a horizontal strip (walk-cycle from Nano Banana),
  // stored by reference so the config blob stays small.
  const sp = extractSprite(m.sprite);
  if (sp) { def.spriteId = sp.spriteId; def.frames = num(m.frames, 4, 1, 12); }
  if (typeof m.proj === 'string' && m.proj) { const pid = m.proj.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24); if (pid) def.proj = pid; }  // projectile type for its shots
  return { id, def, pending: sp && sp.pending };
}
// Validate a shared projectile type (sprite + how it flies).
function sanitizeProjectile(m) {
  if (!m || typeof m !== 'object') return null;
  const id = String(m.id || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
  if (!id) return null;
  const num = (v, def, lo, hi) => { v = Number(v); if (!isFinite(v)) v = def; return Math.max(lo, Math.min(hi, Math.round(v * 100) / 100)); };
  const def = { name: String(m.name || id).slice(0, 28), frames: num(m.frames, 1, 1, 12), spin: !!m.spin, size: num(m.size, 16, 6, 60) };
  const sp = extractSprite(m.sprite);
  if (sp) def.spriteId = sp.spriteId;
  return { id, def, pending: sp && sp.pending };
}

// Turso (optional, preferred). libSQL over plain HTTP — no client library needed.
// TURSO_DATABASE_URL looks like libsql://name-org.turso.io; we talk https.
const TURSO_URL = (process.env.TURSO_DATABASE_URL || '').trim().replace(/\/$/, '').replace(/^libsql:\/\//, 'https://');
const TURSO_TOKEN = (process.env.TURSO_AUTH_TOKEN || '').trim();
const USE_TURSO = !!(TURSO_URL && TURSO_TOKEN);

// Supabase (optional, legacy). Use the SERVICE ROLE key — server-side only.
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const USE_SUPABASE = !USE_TURSO && !!(SB_URL && SB_KEY);
const SB_TABLE = process.env.SUPABASE_TABLE || 'forge_progress';
const SB_SPRITES = process.env.SUPABASE_SPRITE_TABLE || 'forge_sprites';

// ---- indexes / helpers ------------------------------------------------------
const stepIndex = {};
for (const act of ACTS)
  for (const q of act.quests)
    for (const s of q.steps) stepIndex[s.id] = { ...s, questCode: q.code, questTitle: q.title };

function rankFor(xp) { let r = RANKS[0]; for (const rank of RANKS) if (xp >= rank.min) r = rank; return r; }
function emptyState() { const s = { crew: {} }; for (const c of CREW) s.crew[c.id] = { xp: 0, steps: {} }; return s; }
// sum step xp, skipping the special __profile key (character/inventory data)
function recomputeXp(m) { m.xp = Object.entries(m.steps).reduce((sum, [k, v]) => sum + (k.startsWith('__') ? 0 : (v.xp || 0)), 0); return m.xp; }
function getProfile(m) { const p = (m.steps.__profile ||= { inventory: [], equipped: {}, battles: {}, gold: 0, levels: {} }); p.inventory ||= []; p.equipped ||= {}; p.battles ||= {}; p.gold ??= 0; p.levels ||= {}; p.bonusHearts ??= 0; return p; }

// campaign structure WITHOUT rubrics (safe to send to the browser)
function publicQuests() {
  return {
    crew: CREW, ranks: RANKS,
    acts: ACTS.map(a => ({
      id: a.id, title: a.title, theme: a.theme,
      quests: a.quests.map(q => ({
        id: q.id, code: q.code, title: q.title,
        // teach (lesson) + check (plain-language pass criteria) are learner-facing; rubric stays hidden.
        steps: q.steps.map(s => ({ id: s.id, title: s.title, xp: s.xp, teach: s.teach || null, prompt: s.prompt, check: s.check || null })),
      })),
    })),
  };
}

// ---- storage layer: Supabase or local file ---------------------------------
async function sbFetch(pathQuery, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${pathQuery}`, {
    ...opts,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res;
}

const EMPTY_MOBS = { mobs: {}, levels: {}, projectiles: {}, classProjectiles: {} };

// Local file store — sprites become real .png files under data/sprites/.
const SPRITE_DIR = path.join(__dirname, 'data', 'sprites');
const fileStore = {
  async getAll() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return emptyState(); } },
  async putMember(id, member) { const s = await this.getAll(); s.crew[id] = member; fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); },
  async resetAll() { const s = await this.getAll(); fs.writeFileSync(STATE_FILE, JSON.stringify({ ...emptyState(), mobs: s.mobs || EMPTY_MOBS }, null, 2)); },
  async getMobs() { const s = await this.getAll(); return s.mobs || { ...EMPTY_MOBS }; },
  async putMobs(cfg) { const s = await this.getAll(); s.mobs = cfg; fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); },
  async getSprite(id) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(SPRITE_DIR, `${id}.json`), 'utf8'));
      return { mime: meta.mime, buf: fs.readFileSync(path.join(SPRITE_DIR, `${id}.bin`)) };
    } catch { return null; }
  },
  async putSprite(s) {
    fs.mkdirSync(SPRITE_DIR, { recursive: true });
    fs.writeFileSync(path.join(SPRITE_DIR, `${s.id}.bin`), Buffer.from(s.b64, 'base64'));
    fs.writeFileSync(path.join(SPRITE_DIR, `${s.id}.json`), JSON.stringify({ mime: s.mime }));
  },
  async pruneSprites(keep) {
    let files; try { files = fs.readdirSync(SPRITE_DIR); } catch { return 0; }
    let n = 0;
    for (const f of files) {
      const id = f.replace(/\.(bin|json)$/, '');
      if (/^[a-f0-9]{32}$/.test(id) && !keep.has(id)) { try { fs.unlinkSync(path.join(SPRITE_DIR, f)); n++; } catch {} }
    }
    return n;
  },
};

// ---- Turso (libSQL HTTP API) -----------------------------------------------
// One POST carries a batch of statements; no driver, no dependency.
const tArg = (v) => v === null || v === undefined ? { type: 'null' }
  : typeof v === 'number' ? (Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v })
  : { type: 'text', value: String(v) };
const sql = (text, ...args) => ({ sql: text, args: args.map(tArg) });

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
// Create the schema on boot so setup is just two env vars.
async function tursoInit() {
  await tursoRun(
    `create table if not exists forge_progress (
       crew_id text primary key, xp integer not null default 0,
       steps text not null default '{}', updated_at text)`,
    `create table if not exists forge_sprites (
       id text primary key, mime text not null, data text not null, created_at text)`,
  );
}

const tursoStore = {
  async getAll() {
    const [rows] = await tursoRun(sql(`select crew_id, xp, steps from forge_progress`));
    const s = emptyState();
    for (const r of rows) if (s.crew[r.crew_id]) s.crew[r.crew_id] = { xp: r.xp || 0, steps: safeJson(r.steps, {}) };
    return s;
  },
  async putMember(id, member) {
    await tursoRun(sql(
      `insert into forge_progress (crew_id, xp, steps, updated_at) values (?, ?, ?, ?)
         on conflict(crew_id) do update set xp = excluded.xp, steps = excluded.steps, updated_at = excluded.updated_at`,
      id, member.xp, JSON.stringify(member.steps), new Date().toISOString()));
  },
  async resetAll() {
    await tursoRun(...CREW.map(c => sql(
      `insert into forge_progress (crew_id, xp, steps, updated_at) values (?, 0, '{}', ?)
         on conflict(crew_id) do update set xp = 0, steps = '{}', updated_at = excluded.updated_at`,
      c.id, new Date().toISOString())));
  },
  // Mob DB lives in a reserved row (crew_id '__mobs'); getAll ignores it since it isn't a real crew id.
  async getMobs() {
    const [rows] = await tursoRun(sql(`select steps from forge_progress where crew_id = '__mobs'`));
    return rows[0] ? safeJson(rows[0].steps, { ...EMPTY_MOBS }) : { ...EMPTY_MOBS };
  },
  async putMobs(cfg) {
    await tursoRun(sql(
      `insert into forge_progress (crew_id, xp, steps, updated_at) values ('__mobs', 0, ?, ?)
         on conflict(crew_id) do update set steps = excluded.steps, updated_at = excluded.updated_at`,
      JSON.stringify(cfg), new Date().toISOString()));
  },
  async getSprite(id) {
    const [rows] = await tursoRun(sql(`select mime, data from forge_sprites where id = ?`, id));
    return rows[0] ? { mime: rows[0].mime, buf: Buffer.from(rows[0].data, 'base64') } : null;
  },
  async putSprite(s) {
    await tursoRun(sql(
      `insert into forge_sprites (id, mime, data, created_at) values (?, ?, ?, ?) on conflict(id) do nothing`,
      s.id, s.mime, s.b64, new Date().toISOString()));
  },
  async pruneSprites(keep) {
    const [rows] = await tursoRun(sql(`select id from forge_sprites`));
    const dead = rows.map(r => r.id).filter(id => !keep.has(id));
    if (dead.length) await tursoRun(...dead.map(id => sql(`delete from forge_sprites where id = ?`, id)));
    return dead.length;
  },
};

const supabaseStore = {
  async getAll() {
    const rows = await (await sbFetch(`${SB_TABLE}?select=crew_id,xp,steps`)).json();
    const s = emptyState();
    for (const r of rows) if (s.crew[r.crew_id]) s.crew[r.crew_id] = { xp: r.xp || 0, steps: r.steps || {} };
    return s;
  },
  async putMember(id, member) {
    await sbFetch(SB_TABLE, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ crew_id: id, xp: member.xp, steps: member.steps, updated_at: new Date().toISOString() }]),
    });
  },
  async resetAll() {
    const rows = CREW.map(c => ({ crew_id: c.id, xp: 0, steps: {}, updated_at: new Date().toISOString() }));
    await sbFetch(SB_TABLE, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
  },
  // Mob DB lives in a reserved row (crew_id '__mobs'); getAll ignores it since it isn't a real crew id.
  async getMobs() {
    try { const rows = await (await sbFetch(`${SB_TABLE}?crew_id=eq.__mobs&select=steps`)).json(); return (rows[0] && rows[0].steps) || { ...EMPTY_MOBS }; }
    catch { return { ...EMPTY_MOBS }; }
  },
  async putMobs(cfg) {
    await sbFetch(SB_TABLE, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ crew_id: '__mobs', xp: 0, steps: cfg, updated_at: new Date().toISOString() }]) });
  },
  async getSprite(id) {
    const rows = await (await sbFetch(`${SB_SPRITES}?id=eq.${encodeURIComponent(id)}&select=mime,data`)).json();
    return rows[0] ? { mime: rows[0].mime, buf: Buffer.from(rows[0].data, 'base64') } : null;
  },
  async putSprite(s) {
    await sbFetch(SB_SPRITES, {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify([{ id: s.id, mime: s.mime, data: s.b64, created_at: new Date().toISOString() }]),
    });
  },
  async pruneSprites(keep) {
    const rows = await (await sbFetch(`${SB_SPRITES}?select=id`)).json();
    const dead = rows.map(r => r.id).filter(id => !keep.has(id));
    for (const id of dead) await sbFetch(`${SB_SPRITES}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    return dead.length;
  },
};

const store = USE_TURSO ? tursoStore : USE_SUPABASE ? supabaseStore : fileStore;
const STORAGE_NAME = USE_TURSO ? 'turso' : USE_SUPABASE ? 'supabase' : 'file';
function safeJson(v, fallback) {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

// ---- caches ----------------------------------------------------------------
// The app is a single instance (Render free tier), and every write goes through
// this process, so an in-memory copy is authoritative between writes. The short
// TTL is just a safety net in case the process isn't the only writer.
const STATE_TTL_MS = 5000;
let stateCache = null, stateCacheAt = 0;
let mobCache = null;

async function loadState() {
  if (stateCache && Date.now() - stateCacheAt < STATE_TTL_MS) return stateCache;
  stateCache = await store.getAll(); stateCacheAt = Date.now();
  return stateCache;
}
async function saveMember(id, member) { await store.putMember(id, member); stateCache = null; }
async function resetState() { await store.resetAll(); stateCache = null; }

// Configs written before the sprite split carry the whole data: URL inline. Move
// those into sprite records the first time we read them, then rewrite once. After
// that the blob is small and this is a no-op.
async function migrateInlineSprites(cfg) {
  let moved = 0;
  for (const group of [cfg.mobs, cfg.projectiles]) {
    for (const id in (group || {})) {
      const d = group[id];
      if (!d || typeof d.sprite !== 'string' || !d.sprite.startsWith('data:image/')) continue;
      const parsed = parseDataUrl(d.sprite);
      delete d.sprite;                       // drop it either way — inline art is what blew the quota
      if (!parsed) continue;
      const sid = spriteHash(parsed.mime, parsed.b64);
      await store.putSprite({ id: sid, ...parsed });
      d.spriteId = sid; moved++;
    }
  }
  return moved;
}
async function loadMobs() {
  if (mobCache) return mobCache;
  const cfg = await store.getMobs();
  const moved = await migrateInlineSprites(cfg);
  mobCache = cfg;
  if (moved) { console.log(`🖼  Migrated ${moved} inline sprite(s) out of the mob config.`); await saveMobs(cfg); }
  return mobCache;
}
// Persist the config, remember it, and drop art nothing points at any more.
async function saveMobs(cfg) {
  await store.putMobs(cfg);
  mobCache = cfg;
  try { await store.pruneSprites(referencedSprites(cfg)); } catch (e) { console.warn('sprite prune failed:', e.message); }
}
async function saveSprite(pending) { if (pending) await store.putSprite(pending); }

// Sprite bytes are immutable and small in number — keep the decoded buffers hot.
const spriteMem = new Map();
async function loadSprite(id) {
  if (spriteMem.has(id)) return spriteMem.get(id);
  const s = await store.getSprite(id);
  if (s && spriteMem.size < 200) spriteMem.set(id, s);
  return s;
}

// ---- the AI judge -----------------------------------------------------------
// Minimum gap between real grading calls for one crew member. Short enough that nobody
// notices while actually working, long enough that a frustrated re-submit spree can't
// drain a daily quota in a minute. 0 disables it.
const GRADE_COOLDOWN_MS = Math.max(0, Number(process.env.FORGE_GRADE_COOLDOWN_MS ?? 8000));
const lastGradeAt = new Map();
const cooldownLeft = (crewId) => Math.max(0, GRADE_COOLDOWN_MS - (Date.now() - (lastGradeAt.get(crewId) || 0)));
const markGraded = (crewId) => lastGradeAt.set(crewId, Date.now());

async function gradeResponse(step, response, userKey) {
  const text = (response || '').trim();
  if (text.length < 3)
    return { passed: false, score: 0, feedback: "Looks empty — give it a real go! Even a rough answer earns feedback.", tip: "Write a few sentences and submit again." };
  // Prefer the player's own key (BYOK, sent per-request, never stored); fall back to a server key if set.
  const key = (userKey && userKey.trim()) || GEMINI_KEY;
  if (!key) return mockGrade(step, text, 'No AI key yet — tap 🔑 and Save & Test.');

  const prompt =
`You are the XP Judge for THE FORGE, a fun, gamified AI course where teens (around 18) learn AI while building a video game. Grade the student's response to a task against the rubric. Be ENCOURAGING but fair — reward real effort and understanding, not perfection or length. Speak directly to the student ("you").

TASK GIVEN TO STUDENT:
${step.prompt}

RUBRIC (what earns a pass):
${step.rubric}

STUDENT RESPONSE:
${text}

Return ONLY JSON:
{"score": <integer 0-100>, "feedback": "<2-3 sentences, specific to THEIR answer, warm and a little hyped>", "tip": "<one concrete way to level it up>"}`;

  // Walk the fallback chain: one request per model. On a rate limit (429) roll straight to the
  // NEXT model (which has its own quota) rather than retrying the same one — a per-minute cap can't
  // clear in seconds, so retrying just burns quota. Stop early on a bad key (400) — every model 400s.
  let lastErr = '', sawRate = false, perDay = false;
  for (const model of liveModels()) {
    let res;
    try { res = await callGemini(model, prompt, key); }
    catch (e) { lastErr = 'network: ' + e.message; continue; }
    if (res.status === 429) {
      const info = classify429((await res.text()).slice(0, 600));
      perDay = perDay || info.limit === 'perDay';
      lastErr = `429 ${info.limit} on ${model}`; sawRate = true; continue;   // next model's own quota
    }
    if (res.status === 400) { lastErr = `${model} HTTP 400`; break; }        // bad key — don't waste more calls
    if (res.status === 404) {                                               // retired / not enabled for this key
      deadModels.add(model);
      console.warn(`Model "${model}" is not available for this key — skipping it from now on.`);
      lastErr = `${model} HTTP 404`; continue;
    }
    if (!res.ok) { lastErr = `${model} HTTP ${res.status}`; continue; }
    try {
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
      const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 0)));
      return { passed: score >= PASS_SCORE, score, feedback: parsed.feedback || 'Graded.', tip: parsed.tip || '' };
    } catch (e) { lastErr = 'parse: ' + e.message; continue; }
  }
  if (sawRate && !/HTTP 400/.test(lastErr)) lastErr = `429 rate limit (${perDay ? 'perDay' : 'perMinute'})`;
  console.error('Grading fell back to mock:', lastErr);
  // Daily and per-minute caps need different advice: one clears in a minute, the other at
  // midnight Pacific. Telling a kid to "wait a bit" on a spent daily quota just wastes calls.
  const note = perDay ? "Your key's DAILY free limit is used up — it resets at midnight Pacific. Your answer is saved."
    : /429|rate limit/i.test(lastErr) ? 'Too many submissions in a minute — wait ~60s and re-submit.'
    : /HTTP 400|API_KEY_INVALID|invalid/i.test(lastErr) ? "Your AI key didn't work — reopen 🔑 and re-paste it with the copy button."
    : /404/.test(lastErr) ? 'No usable grading model for this key — the Game Master may need to set FORGE_MODELS.'
    : 'AI grader unreachable right now — reopen 🔑 to re-test your key.';
  return mockGrade(step, text, note);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Nano Banana image generation. Returns a data URL, or throws with a readable message.
async function generateImage(prompt, key) {
  apiUsage.image++;
  const url = `${GEMINI_BASE}/v1beta/models/${IMAGE_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
  });
  if (!res.ok) { const body = (await res.text()).slice(0, 400); const e = new Error(body); e.status = res.status; throw e; }
  const data = await res.json();
  const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  const img = parts.find(p => p.inlineData && p.inlineData.data);
  if (!img) { const txt = parts.map(p => p.text).filter(Boolean).join(' ').slice(0, 200); const e = new Error(txt || 'Model returned no image.'); e.status = 502; throw e; }
  return `data:${img.inlineData.mimeType || 'image/png'};base64,${img.inlineData.data}`;
}

// Where the quota actually went, since boot. Free-tier limits are per PROJECT, so if the crew
// share one key they share one allowance — this is how the Game Master sees that happening.
const apiUsage = { grade: 0, image: 0, keyTest: 0, cachedGrades: 0, cooldownBlocked: 0, serverKey: 0, ownKey: 0 };

async function callGemini(model, prompt, key) {
  apiUsage.grade++;
  if (key && key !== GEMINI_KEY) apiUsage.ownKey++; else apiUsage.serverKey++;
  const url = `${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${key || GEMINI_KEY}`;
  return fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // maxOutputTokens caps a runaway answer. The judge returns a small fixed JSON object, so
      // this never truncates a real grade — it just stops one bad generation eating the shared
      // per-minute token budget that every crew member's key draws from.
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 400 },
    }),
  });
}

// Tell a per-MINUTE rate limit (resets in seconds) from a per-DAY quota (resets midnight PT).
function classify429(body) {
  const perDay = /per\s*day|requestsperday|perprojectperday|free[_ ]?tier.*day/i.test(body || '');
  const m = (body || '').match(/"retryDelay"\s*:\s*"([^"]+)"/);
  return { limit: perDay ? 'perDay' : 'perMinute', retryDelay: m ? m[1] : null };
}

// Live check: is a Gemini key actually working?
//
// This costs REAL quota, so it is deliberately the cheapest call the app can make: one model,
// one token of output. It used to walk the whole fallback chain, which meant a single "Test my
// key" tap could spend four requests — on a 250/day allowance that is real money. A key that
// works on one free model works on the others, so one probe answers the question.
async function geminiPing(key) {
  const k = (key && key.trim()) || GEMINI_KEY;
  if (!k) return { keyPresent: false, ok: false, note: 'No API key set. Add your own in the app (🔑) or set GEMINI_API_KEY on the server.' };
  const models = liveModels();
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const url = `${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${k}`;
      apiUsage.keyTest++;
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 1 } }),
      });
      if (res.ok) return { keyPresent: true, ok: true, model };
      const body = (await res.text()).slice(0, 600);
      const info = { keyPresent: true, ok: false, status: res.status, model, ...(res.status === 429 ? classify429(body) : { error: body.slice(0, 300) }) };
      // 400 = bad key, and 429 = the key is real but capped (which still proves it works).
      // Neither is worth spending another request on. Only an unavailable model (404) justifies
      // trying the next name in the chain.
      if (res.status === 404) { deadModels.add(model); if (i < models.length - 1) continue; }
      if (res.status === 429) return { ...info, ok: false, keyWorks: true };
      return info;
    } catch (e) { return { keyPresent: true, ok: false, error: String(e.message) }; }
  }
  return { keyPresent: true, ok: false, error: 'No available grading model for this key.' };
}

function mockGrade(step, text, note) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const score = Math.min(100, 30 + words * 4);
  const passed = score >= PASS_SCORE;
  const tail = note || 'Offline grader — add your Gemini key (🔑) for real AI feedback.';
  return {
    passed, score, offline: true,
    feedback: (passed ? `Nice — solid effort (${words} words). ` : `Good start, but stretch it out and be specific. `) + '(' + tail + ')',
    tip: passed ? 'Add a concrete example to make it bulletproof.' : 'Aim for a few clear sentences that hit every part of the task.',
  };
}

// ---- summaries --------------------------------------------------------------
function memberSummary(id, m) {
  return { id, xp: m.xp, rank: rankFor(m.xp), stepsPassed: Object.values(m.steps).filter(s => s.passed).length };
}
function decorate(state) {
  const crew = {};
  for (const c of CREW) { const m = state.crew[c.id] || { xp: 0, steps: {} }; crew[c.id] = { xp: m.xp, rank: rankFor(m.xp), steps: m.steps }; }
  return { crew };
}

// ---- request plumbing -------------------------------------------------------
function sendJson(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function readBody(req) { return new Promise((resolve) => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); }); }
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]); if (rel === '/') rel = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' }); res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (req.method === 'GET' && url === '/api/quests') return sendJson(res, 200, publicQuests());
    if (req.method === 'GET' && url === '/api/state') return sendJson(res, 200, decorate(await loadState()));

    // ---- Mob database ----
    if (req.method === 'GET' && url === '/api/mobs') return sendJson(res, 200, publicMobCfg(await loadMobs()));
    // Sprite bytes: content-hashed, so the URL never changes meaning — cache hard.
    if (req.method === 'GET' && url.startsWith('/api/sprites/')) {
      const hit = SPRITE_URL_RE.exec(url);
      if (!hit) { res.writeHead(404); return res.end('Not found'); }
      const s = await loadSprite(hit[1]);
      if (!s) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': s.mime, 'Content-Length': s.buf.length, 'Cache-Control': 'public, max-age=31536000, immutable' });
      return res.end(s.buf);
    }
    if (req.method === 'POST' && url === '/api/admin/mobs') {          // create / edit a mob
      const { code, mob } = await readBody(req);
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      const s = sanitizeMob(mob);
      if (!s) return sendJson(res, 400, { error: 'Invalid mob (need at least an id).' });
      await saveSprite(s.pending);   // art first, so the config never points at missing bytes
      const cfg = await loadMobs(); cfg.mobs = cfg.mobs || {}; cfg.mobs[s.id] = s.def;
      await saveMobs(cfg);
      const pub = publicMobCfg(cfg);
      return sendJson(res, 200, { ok: true, id: s.id, mobs: pub.mobs, levels: pub.levels });
    }
    if (req.method === 'POST' && url === '/api/admin/mobs/generate') { // Nano Banana sprite generation (uses caller's key)
      const { code, key, prompt } = await readBody(req);
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      const k = (key && String(key).trim()) || GEMINI_KEY;
      if (!k) return sendJson(res, 400, { error: 'No image key. Paste your Gemini key in the 🔑 panel first.' });
      if (!prompt || !String(prompt).trim()) return sendJson(res, 400, { error: 'Empty prompt.' });
      try {
        const image = await generateImage(String(prompt).slice(0, 2000), k);
        return sendJson(res, 200, { ok: true, image, model: IMAGE_MODEL });
      } catch (e) {
        const status = e.status || 500;
        const msg = status === 429 ? 'Rate limit hit — wait a moment and try again.'
          : status === 400 ? 'Image request rejected (bad key, or the model name isn\'t available on this key). ' + String(e.message).slice(0, 160)
          : status === 404 ? `Image model "${IMAGE_MODEL}" not found for this key. Set FORGE_IMAGE_MODEL to a model you can access.`
          : String(e.message).slice(0, 200);
        return sendJson(res, 200, { ok: false, status, error: msg });
      }
    }
    if (req.method === 'POST' && url === '/api/admin/mobs/delete') {   // remove a custom mob / override
      const { code, id } = await readBody(req);
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      const cfg = await loadMobs(); if (cfg.mobs) delete cfg.mobs[id];
      for (const lv in (cfg.levels || {})) cfg.levels[lv] = (cfg.levels[lv] || []).filter(x => x !== id);
      await saveMobs(cfg);
      const pub = publicMobCfg(cfg);
      return sendJson(res, 200, { ok: true, mobs: pub.mobs, levels: pub.levels });
    }
    if (req.method === 'POST' && url === '/api/admin/projectiles') {   // create / edit a shared projectile type
      const { code, proj } = await readBody(req);
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      const s = sanitizeProjectile(proj);
      if (!s) return sendJson(res, 400, { error: 'Invalid projectile (need at least an id).' });
      await saveSprite(s.pending);
      const cfg = await loadMobs(); cfg.projectiles = cfg.projectiles || {}; cfg.projectiles[s.id] = s.def;
      await saveMobs(cfg);
      const pub = publicMobCfg(cfg);
      return sendJson(res, 200, { ok: true, id: s.id, projectiles: pub.projectiles, classProjectiles: pub.classProjectiles });
    }
    if (req.method === 'POST' && url === '/api/admin/projectiles/delete') {
      const { code, id } = await readBody(req);
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      const cfg = await loadMobs();
      if (cfg.projectiles) delete cfg.projectiles[id];
      for (const k in (cfg.classProjectiles || {})) if (cfg.classProjectiles[k] === id) delete cfg.classProjectiles[k];
      for (const mid in (cfg.mobs || {})) if (cfg.mobs[mid] && cfg.mobs[mid].proj === id) delete cfg.mobs[mid].proj;
      await saveMobs(cfg);
      const pub = publicMobCfg(cfg);
      return sendJson(res, 200, { ok: true, projectiles: pub.projectiles, classProjectiles: pub.classProjectiles, mobs: pub.mobs });
    }
    if (req.method === 'POST' && url === '/api/admin/projectiles/classassign') {  // give a hero class a projectile
      const { code, classId, projId } = await readBody(req);
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      const cid = String(classId || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
      if (!cid) return sendJson(res, 400, { error: 'Bad class.' });
      const cfg = await loadMobs(); cfg.classProjectiles = cfg.classProjectiles || {};
      const pid = String(projId || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
      if (pid) cfg.classProjectiles[cid] = pid; else delete cfg.classProjectiles[cid];
      await saveMobs(cfg);
      const pub = publicMobCfg(cfg);
      return sendJson(res, 200, { ok: true, classProjectiles: pub.classProjectiles, projectiles: pub.projectiles });
    }
    if (req.method === 'POST' && url === '/api/admin/mobs/levels') {   // assign which mobs spawn at a level
      const { code, level, mobIds } = await readBody(req);
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      const lv = String(parseInt(level, 10));
      if (!/^\d+$/.test(lv)) return sendJson(res, 400, { error: 'Bad level.' });
      const cfg = await loadMobs(); cfg.levels = cfg.levels || {};
      const ids = Array.isArray(mobIds) ? [...new Set(mobIds.map(String))].slice(0, 24) : [];
      if (ids.length) cfg.levels[lv] = ids; else delete cfg.levels[lv];
      await saveMobs(cfg);
      const pub = publicMobCfg(cfg);
      return sendJson(res, 200, { ok: true, mobs: pub.mobs, levels: pub.levels });
    }

    // ---- Game Master / admin ----
    if (req.method === 'POST' && url === '/api/admin/verify') {
      const { code } = await readBody(req);
      return sendJson(res, 200, { ok: adminOK(code) });
    }
    if (req.method === 'GET' && url === '/api/admin/rubrics') {
      const code = new URL(req.url, 'http://x').searchParams.get('code');
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      const rubrics = {}; for (const id in stepIndex) rubrics[id] = stepIndex[id].rubric;
      return sendJson(res, 200, { rubrics });
    }
    if (req.method === 'POST' && url === '/api/admin/force') {
      const { code, crewId, stepId } = await readBody(req);
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      const step = stepIndex[stepId];
      const state = await loadState();
      const member = state.crew[crewId];
      if (!step || !member) return sendJson(res, 400, { error: 'Unknown crew member or step.' });
      member.steps[stepId] = { passed: true, score: 100, xp: step.xp, response: '[force-cleared by GM]', feedback: 'Force-cleared by the Game Master.', tip: '', at: Date.now() };
      recomputeXp(member);
      await saveMember(crewId, member);
      return sendJson(res, 200, { ok: true, state: decorate(state) });
    }
    // ---- battle / inventory ----
    if (req.method === 'POST' && url === '/api/battle/win') {
      const { crewId, questId, xp, loot } = await readBody(req);
      const state = await loadState(); const m = state.crew[crewId];
      if (!m) return sendJson(res, 400, { error: 'Unknown crew member.' });
      const prof = getProfile(m);
      const items = (Array.isArray(loot) ? loot : []).filter(id => GEARDATA.GEAR[id]).slice(0, 8);
      for (const id of items) {                                  // no duplicate Mythics
        if (GEARDATA.GEAR[id].tier === 'Mythic' && prof.inventory.includes(id)) continue;
        prof.inventory.push(id);
      }
      let gotHeart = false;
      if (questId != null && !prof.battles[questId]) {           // XP once per battle; loot every time
        prof.battles[questId] = true;
        prof.bonusHearts = (prof.bonusHearts || 0) + 1;          // first kill of this boss = a PERMANENT heart
        gotHeart = true;
        m.steps['battle:' + questId] = { xp: Math.max(0, Math.round(+xp || 0)), at: Date.now(), cleared: true };
      }
      recomputeXp(m); await saveMember(crewId, m);
      return sendJson(res, 200, { ok: true, gained: items, gotHeart, bonusHearts: prof.bonusHearts, state: decorate(state) });
    }
    if (req.method === 'POST' && url === '/api/profile/equip') {
      const { crewId, slot, itemId } = await readBody(req);
      const state = await loadState(); const m = state.crew[crewId];
      if (!m) return sendJson(res, 400, { error: 'Unknown crew member.' });
      const prof = getProfile(m);
      if (itemId) {
        const g = GEARDATA.GEAR[itemId];
        if (!g) return sendJson(res, 400, { error: 'Unknown item.' });
        if (g.slot !== slot) return sendJson(res, 400, { error: 'Wrong slot.' });
        // Princess Via is the Spellblade — she can wield any gear, including other classes' Mythics.
        if (g.klass && g.klass !== crewId && crewId !== 'via') return sendJson(res, 403, { error: 'That Mythic belongs to another class.' });
        if (!prof.inventory.includes(itemId)) return sendJson(res, 400, { error: 'Not in inventory.' });
        prof.equipped[slot] = itemId;
      } else { delete prof.equipped[slot]; }
      await saveMember(crewId, m);
      return sendJson(res, 200, { ok: true, state: decorate(state) });
    }
    if (req.method === 'POST' && url === '/api/profile/scrap') {
      const { crewId, itemId } = await readBody(req);
      const state = await loadState(); const m = state.crew[crewId];
      if (!m) return sendJson(res, 400, { error: 'Unknown crew member.' });
      const g = GEARDATA.GEAR[itemId];
      if (!g) return sendJson(res, 400, { error: 'Unknown item.' });
      if (g.tier === 'Mythic') return sendJson(res, 403, { error: 'Mythics cannot be scrapped.' });
      const prof = getProfile(m);
      const idx = prof.inventory.indexOf(itemId);
      if (idx < 0) return sendJson(res, 400, { error: 'Not in inventory.' });
      prof.inventory.splice(idx, 1);
      if (!prof.inventory.includes(itemId)) for (const s in prof.equipped) if (prof.equipped[s] === itemId) delete prof.equipped[s];
      const value = GEARDATA.SCRAP_VALUE[g.tier] || 0;
      prof.gold = (prof.gold || 0) + value;
      await saveMember(crewId, m);
      return sendJson(res, 200, { ok: true, value, gold: prof.gold, state: decorate(state) });
    }
    if (req.method === 'POST' && url === '/api/admin/setxp') {
      const { code, crewId, xp } = await readBody(req);
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      const state = await loadState(); const m = state.crew[crewId];
      if (!m) return sendJson(res, 400, { error: 'Unknown crew member.' });
      const target = Math.max(0, Math.round(+xp || 0));           // no XP cap
      // XP is derived from step xp; a "gm:xp" step holds the admin adjustment.
      const base = Object.entries(m.steps).reduce((s, [k, v]) => s + ((k.startsWith('__') || k === 'gm:xp') ? 0 : (v.xp || 0)), 0);
      const delta = target - base;
      if (delta !== 0) m.steps['gm:xp'] = { xp: delta, at: Date.now() }; else delete m.steps['gm:xp'];
      recomputeXp(m); await saveMember(crewId, m);
      return sendJson(res, 200, { ok: true, xp: m.xp, state: decorate(state) });
    }
    if (req.method === 'POST' && url === '/api/profile/sellall') {
      const { crewId } = await readBody(req);
      const state = await loadState(); const m = state.crew[crewId];
      if (!m) return sendJson(res, 400, { error: 'Unknown crew member.' });
      const prof = getProfile(m);
      const keep = {}; for (const id of Object.values(prof.equipped)) keep[id] = (keep[id] || 0) + 1;  // keep equipped copies
      let gained = 0, sold = 0; const seen = {}, newInv = [];
      for (const id of prof.inventory) {
        const g = GEARDATA.GEAR[id]; seen[id] = (seen[id] || 0) + 1;
        const keepN = g.tier === 'Mythic' ? Infinity : (keep[id] || 0);   // never sell Mythics or equipped
        if (seen[id] <= keepN) { newInv.push(id); }
        else { gained += GEARDATA.SCRAP_VALUE[g.tier] || 0; sold++; }
      }
      prof.inventory = newInv; prof.gold = (prof.gold || 0) + gained;
      await saveMember(crewId, m);
      return sendJson(res, 200, { ok: true, sold, gained, gold: prof.gold, state: decorate(state) });
    }
    if (req.method === 'POST' && url === '/api/profile/upgrade') {
      const { crewId, itemId } = await readBody(req);
      const state = await loadState(); const m = state.crew[crewId];
      if (!m) return sendJson(res, 400, { error: 'Unknown crew member.' });
      const prof = getProfile(m); const g = GEARDATA.GEAR[itemId]; const r = GEARDATA.UPGRADE[itemId];
      if (r) {                                                   // tier upgrade (Common/Rare -> next tier)
        const have = prof.inventory.filter(x => x === itemId).length;
        if (have < r.need) return sendJson(res, 400, { error: `Need ${r.need}× (you have ${have}).` });
        if ((prof.gold || 0) < r.gold) return sendJson(res, 400, { error: `Need ${r.gold} gold (you have ${prof.gold || 0}).` });
        let removed = 0;
        prof.inventory = prof.inventory.filter(x => { if (x === itemId && removed < r.need) { removed++; return false; } return true; });
        if (!prof.inventory.includes(itemId)) for (const s in prof.equipped) if (prof.equipped[s] === itemId) delete prof.equipped[s];
        prof.gold -= r.gold; prof.inventory.push(r.to);
        await saveMember(crewId, m);
        return sendJson(res, 200, { ok: true, made: r.to, gold: prof.gold, state: decorate(state) });
      }
      if (g && g.tier === 'Legendary') {                         // level up a Legendary (stronger, same item)
        if (!prof.inventory.includes(itemId)) return sendJson(res, 400, { error: "You don't own that." });
        const level = prof.levels[itemId] || 0;
        if (level >= GEARDATA.LEG_MAX_LEVEL) return sendJson(res, 400, { error: 'Already at max level.' });
        const fodder = GEARDATA.RARE_OF_SLOT[g.slot], need = GEARDATA.LEG_FODDER_NEED, cost = GEARDATA.legLevelGold(level);
        const have = prof.inventory.filter(x => x === fodder).length;
        if (have < need) return sendJson(res, 400, { error: `Need ${need}× ${GEARDATA.GEAR[fodder].name} (you have ${have}).` });
        if ((prof.gold || 0) < cost) return sendJson(res, 400, { error: `Need ${cost} gold (you have ${prof.gold || 0}).` });
        let removed = 0;
        prof.inventory = prof.inventory.filter(x => { if (x === fodder && removed < need) { removed++; return false; } return true; });
        prof.gold -= cost; prof.levels[itemId] = level + 1;
        await saveMember(crewId, m);
        return sendJson(res, 200, { ok: true, leveled: itemId, level: level + 1, gold: prof.gold, state: decorate(state) });
      }
      return sendJson(res, 400, { error: 'That item cannot be upgraded.' });
    }
    if (req.method === 'GET' && url === '/api/admin/health') {
      const code = new URL(req.url, 'http://x').searchParams.get('code');
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      const cfg = await loadMobs();
      return sendJson(res, 200, {
        storage: STORAGE_NAME, model: MODEL, models: liveModels(), retiredModels: [...deadModels],
        gemini: await geminiPing(),
        sprites: referencedSprites(cfg).size, configBytes: JSON.stringify(cfg).length,
        // Since boot. `serverKey` counting up means the crew are sharing YOUR key — and so
        // sharing one free-tier project quota. See README "AI grading".
        apiUsage: { ...apiUsage },
      });
    }
    // "Test my key" for the in-app API-key panel. The key is checked live and NOT stored anywhere.
    if (req.method === 'POST' && url === '/api/verify-key') {
      const { key } = await readBody(req);
      return sendJson(res, 200, await geminiPing(key));
    }
    if (req.method === 'POST' && url === '/api/reset') {
      const { code } = await readBody(req);
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Reset requires the Game Master passcode.' });
      await resetState();
      return sendJson(res, 200, decorate(await loadState()));
    }
    if (req.method === 'POST' && url === '/api/grade') {
      const { crewId, stepId, response, userKey } = await readBody(req);
      const step = stepIndex[stepId];
      const state = await loadState();
      const member = state.crew[crewId];
      if (!step || !member) return sendJson(res, 400, { error: 'Unknown crew member or step.' });

      const prev = member.steps[stepId];
      const text = (response || '').trim();

      // Re-submitting the exact same words can't produce a different grade, so don't pay for it.
      // Kids re-read their answer and hit ATTEMPT again constantly; on a ~250/day free quota that
      // habit alone is what empties a key. Only replay grades that came from the real judge —
      // a previous offline/mock grade should get a genuine attempt.
      if (prev && !prev.offline && prev.score != null && text.length >= 3 && String(prev.response || '').trim() === text) {
        apiUsage.cachedGrades++;
        return sendJson(res, 200, {
          result: { passed: prev.passed, score: prev.score, feedback: prev.feedback, tip: prev.tip,
                    xpAwarded: prev.xp, alreadyBetter: true, cached: true },
          member: memberSummary(crewId, member),
          state: decorate(state),
        });
      }

      // Cheap guard against rage-submitting: a few seconds between real grading calls. Never
      // blocks the cached path above, so re-reading your own last grade is always instant.
      const wait = cooldownLeft(crewId);
      if (wait > 0) {
        apiUsage.cooldownBlocked++;
        return sendJson(res, 200, {
          result: { passed: false, score: 0, cooldown: true,
                    feedback: `Hold up — the judge is catching its breath. Try again in ${Math.ceil(wait / 1000)}s.`,
                    tip: 'Use the moment to re-read the task and sharpen your answer.', xpAwarded: 0 },
          member: memberSummary(crewId, member),
          state: decorate(state),
        });
      }

      markGraded(crewId);
      const result = await gradeResponse(step, response, userKey);   // userKey is used transiently, never stored
      const awarded = result.passed ? step.xp : 0;
      const keepBest = prev && prev.passed && prev.xp >= awarded;
      if (!keepBest) {
        member.steps[stepId] = { passed: result.passed, score: result.score, xp: awarded, response, feedback: result.feedback, tip: result.tip, offline: !!result.offline, at: Date.now() };
        recomputeXp(member);
        await saveMember(crewId, member);
      } else if (prev.response !== response) {
        // Keep the better score/XP, but remember the student's latest writing so it persists.
        member.steps[stepId] = { ...prev, response };
        await saveMember(crewId, member);
      }
      return sendJson(res, 200, {
        result: { ...result, xpAwarded: keepBest ? prev.xp : awarded, alreadyBetter: keepBest },
        member: memberSummary(crewId, member),
        state: decorate(state),
      });
    }
    return serveStatic(req, res);
  } catch (err) {
    console.error('Request error:', err.message);
    return sendJson(res, 500, { error: 'Server error: ' + err.message });
  }
});

server.listen(PORT, () => {
  const storageNote = USE_TURSO ? 'Turso (shared, cross-device)'
    : USE_SUPABASE ? 'Supabase (shared, cross-device)'
    : 'local file (single server only)';
  console.log(`\n🔥 THE FORGE app running:  http://localhost:${PORT}`);
  console.log(`   Storage: ${storageNote}`);
  console.log(`   AI judge: ${GEMINI_KEY ? 'Gemini (live)' : 'OFFLINE mock (set GEMINI_API_KEY for real grading)'}`);
  console.log(`   Game Master passcode: ${process.env.ADMIN_CODE ? '(set via ADMIN_CODE)' : "DEFAULT 'forge-gm' — set ADMIN_CODE to change"}\n`);
  // Turso creates its own schema, so setup is just the two env vars.
  if (USE_TURSO) tursoInit().catch(e => console.error('Turso init failed:', e.message));
});
