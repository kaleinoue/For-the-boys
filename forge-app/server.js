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
//  Secrets (Gemini key + Supabase service key) live ONLY here on the server,
//  never in the browser. Storage: Supabase if configured, else a local JSON file.
// =============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

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
const MODEL = process.env.FORGE_MODEL || 'gemini-2.0-flash';
const PASS_SCORE = 60;

// Game Master / admin passcode. Set ADMIN_CODE in your env; defaults otherwise.
const ADMIN_CODE = process.env.ADMIN_CODE || 'forge-gm';
const adminOK = (code) => !!code && code === ADMIN_CODE;

// Supabase (optional). Use the SERVICE ROLE key — server-side only.
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const USE_SUPABASE = !!(SB_URL && SB_KEY);
const SB_TABLE = process.env.SUPABASE_TABLE || 'forge_progress';

// ---- indexes / helpers ------------------------------------------------------
const stepIndex = {};
for (const act of ACTS)
  for (const q of act.quests)
    for (const s of q.steps) stepIndex[s.id] = { ...s, questCode: q.code, questTitle: q.title };

function rankFor(xp) { let r = RANKS[0]; for (const rank of RANKS) if (xp >= rank.min) r = rank; return r; }
function emptyState() { const s = { crew: {} }; for (const c of CREW) s.crew[c.id] = { xp: 0, steps: {} }; return s; }
// sum step xp, skipping the special __profile key (character/inventory data)
function recomputeXp(m) { m.xp = Object.entries(m.steps).reduce((sum, [k, v]) => sum + (k.startsWith('__') ? 0 : (v.xp || 0)), 0); return m.xp; }
function getProfile(m) { const p = (m.steps.__profile ||= { inventory: [], equipped: {}, battles: {}, gold: 0, levels: {} }); p.inventory ||= []; p.equipped ||= {}; p.battles ||= {}; p.gold ??= 0; p.levels ||= {}; return p; }

// campaign structure WITHOUT rubrics (safe to send to the browser)
function publicQuests() {
  return {
    crew: CREW, ranks: RANKS,
    acts: ACTS.map(a => ({
      id: a.id, title: a.title, theme: a.theme,
      quests: a.quests.map(q => ({
        id: q.id, code: q.code, title: q.title,
        steps: q.steps.map(s => ({ id: s.id, title: s.title, xp: s.xp, prompt: s.prompt })),
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

const fileStore = {
  async getAll() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return emptyState(); } },
  async putMember(id, member) { const s = await this.getAll(); s.crew[id] = member; fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); },
  async resetAll() { fs.writeFileSync(STATE_FILE, JSON.stringify(emptyState(), null, 2)); },
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
};

const store = USE_SUPABASE ? supabaseStore : fileStore;

// ---- the AI judge -----------------------------------------------------------
async function gradeResponse(step, response) {
  const text = (response || '').trim();
  if (text.length < 3)
    return { passed: false, score: 0, feedback: "Looks empty — give it a real go! Even a rough answer earns feedback.", tip: "Write a few sentences and submit again." };
  if (!GEMINI_KEY) return mockGrade(step, text);

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

  // Try the primary model, then a lighter model with higher free limits.
  // Retry once on 429 (free-tier rate limit) before giving up to the mock grader.
  const models = [...new Set([MODEL, 'gemini-2.0-flash-lite'])];
  let lastErr = '';
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      try { res = await callGemini(model, prompt); }
      catch (e) { lastErr = 'network: ' + e.message; break; }
      if (res.status === 429) { lastErr = `429 rate limit on ${model}`; if (attempt === 0) { await sleep(1500); continue; } break; }
      if (!res.ok) { lastErr = `${model} HTTP ${res.status}`; break; }
      try {
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
        const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 0)));
        return { passed: score >= PASS_SCORE, score, feedback: parsed.feedback || 'Graded.', tip: parsed.tip || '' };
      } catch (e) { lastErr = 'parse: ' + e.message; break; }
    }
  }
  console.error('Grading fell back to mock:', lastErr);
  return mockGrade(step, text);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function callGemini(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  return fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } }),
  });
}

// Live check: is the Gemini key actually working? Reports the real error.
async function geminiPing() {
  if (!GEMINI_KEY) return { keyPresent: false, ok: false, note: 'GEMINI_API_KEY is empty/not set on this server.' };
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] }) });
    if (!res.ok) return { keyPresent: true, ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
    return { keyPresent: true, ok: true };
  } catch (e) { return { keyPresent: true, ok: false, error: String(e.message) }; }
}

function mockGrade(step, text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const score = Math.min(100, 30 + words * 4);
  const passed = score >= PASS_SCORE;
  return {
    passed, score,
    feedback: passed
      ? `Nice — solid effort (${words} words). (Offline grader: add a GEMINI_API_KEY for real AI feedback.)`
      : `Good start, but stretch it out and be specific. (Offline grader — add a GEMINI_API_KEY for real AI feedback.)`,
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
function sendJson(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
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
    if (req.method === 'GET' && url === '/api/state') return sendJson(res, 200, decorate(await store.getAll()));

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
      const state = await store.getAll();
      const member = state.crew[crewId];
      if (!step || !member) return sendJson(res, 400, { error: 'Unknown crew member or step.' });
      member.steps[stepId] = { passed: true, score: 100, xp: step.xp, response: '[force-cleared by GM]', feedback: 'Force-cleared by the Game Master.', tip: '', at: Date.now() };
      recomputeXp(member);
      await store.putMember(crewId, member);
      return sendJson(res, 200, { ok: true, state: decorate(state) });
    }
    // ---- battle / inventory ----
    if (req.method === 'POST' && url === '/api/battle/win') {
      const { crewId, questId, xp, loot } = await readBody(req);
      const state = await store.getAll(); const m = state.crew[crewId];
      if (!m) return sendJson(res, 400, { error: 'Unknown crew member.' });
      const prof = getProfile(m);
      const items = (Array.isArray(loot) ? loot : []).filter(id => GEARDATA.GEAR[id]).slice(0, 8);
      for (const id of items) {                                  // no duplicate Mythics
        if (GEARDATA.GEAR[id].tier === 'Mythic' && prof.inventory.includes(id)) continue;
        prof.inventory.push(id);
      }
      if (questId != null && !prof.battles[questId]) {           // XP once per battle; loot every time
        prof.battles[questId] = true;
        m.steps['battle:' + questId] = { xp: Math.max(0, Math.round(+xp || 0)), at: Date.now(), cleared: true };
      }
      recomputeXp(m); await store.putMember(crewId, m);
      return sendJson(res, 200, { ok: true, gained: items, state: decorate(state) });
    }
    if (req.method === 'POST' && url === '/api/profile/equip') {
      const { crewId, slot, itemId } = await readBody(req);
      const state = await store.getAll(); const m = state.crew[crewId];
      if (!m) return sendJson(res, 400, { error: 'Unknown crew member.' });
      const prof = getProfile(m);
      if (itemId) {
        const g = GEARDATA.GEAR[itemId];
        if (!g) return sendJson(res, 400, { error: 'Unknown item.' });
        if (g.slot !== slot) return sendJson(res, 400, { error: 'Wrong slot.' });
        if (g.klass && g.klass !== crewId) return sendJson(res, 403, { error: 'That Mythic belongs to another class.' });
        if (!prof.inventory.includes(itemId)) return sendJson(res, 400, { error: 'Not in inventory.' });
        prof.equipped[slot] = itemId;
      } else { delete prof.equipped[slot]; }
      await store.putMember(crewId, m);
      return sendJson(res, 200, { ok: true, state: decorate(state) });
    }
    if (req.method === 'POST' && url === '/api/profile/scrap') {
      const { crewId, itemId } = await readBody(req);
      const state = await store.getAll(); const m = state.crew[crewId];
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
      await store.putMember(crewId, m);
      return sendJson(res, 200, { ok: true, value, gold: prof.gold, state: decorate(state) });
    }
    if (req.method === 'POST' && url === '/api/admin/setxp') {
      const { code, crewId, xp } = await readBody(req);
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      const state = await store.getAll(); const m = state.crew[crewId];
      if (!m) return sendJson(res, 400, { error: 'Unknown crew member.' });
      const target = Math.max(0, Math.round(+xp || 0));           // no XP cap
      // XP is derived from step xp; a "gm:xp" step holds the admin adjustment.
      const base = Object.entries(m.steps).reduce((s, [k, v]) => s + ((k.startsWith('__') || k === 'gm:xp') ? 0 : (v.xp || 0)), 0);
      const delta = target - base;
      if (delta !== 0) m.steps['gm:xp'] = { xp: delta, at: Date.now() }; else delete m.steps['gm:xp'];
      recomputeXp(m); await store.putMember(crewId, m);
      return sendJson(res, 200, { ok: true, xp: m.xp, state: decorate(state) });
    }
    if (req.method === 'POST' && url === '/api/profile/sellall') {
      const { crewId } = await readBody(req);
      const state = await store.getAll(); const m = state.crew[crewId];
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
      await store.putMember(crewId, m);
      return sendJson(res, 200, { ok: true, sold, gained, gold: prof.gold, state: decorate(state) });
    }
    if (req.method === 'POST' && url === '/api/profile/upgrade') {
      const { crewId, itemId } = await readBody(req);
      const state = await store.getAll(); const m = state.crew[crewId];
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
        await store.putMember(crewId, m);
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
        await store.putMember(crewId, m);
        return sendJson(res, 200, { ok: true, leveled: itemId, level: level + 1, gold: prof.gold, state: decorate(state) });
      }
      return sendJson(res, 400, { error: 'That item cannot be upgraded.' });
    }
    if (req.method === 'GET' && url === '/api/admin/health') {
      const code = new URL(req.url, 'http://x').searchParams.get('code');
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Bad passcode.' });
      return sendJson(res, 200, { storage: USE_SUPABASE ? 'supabase' : 'file', model: MODEL, gemini: await geminiPing() });
    }
    if (req.method === 'POST' && url === '/api/reset') {
      const { code } = await readBody(req);
      if (!adminOK(code)) return sendJson(res, 403, { error: 'Reset requires the Game Master passcode.' });
      await store.resetAll();
      return sendJson(res, 200, decorate(await store.getAll()));
    }
    if (req.method === 'POST' && url === '/api/grade') {
      const { crewId, stepId, response } = await readBody(req);
      const step = stepIndex[stepId];
      const state = await store.getAll();
      const member = state.crew[crewId];
      if (!step || !member) return sendJson(res, 400, { error: 'Unknown crew member or step.' });

      const result = await gradeResponse(step, response);
      const awarded = result.passed ? step.xp : 0;
      const prev = member.steps[stepId];
      const keepBest = prev && prev.passed && prev.xp >= awarded;
      if (!keepBest) {
        member.steps[stepId] = { passed: result.passed, score: result.score, xp: awarded, response, feedback: result.feedback, tip: result.tip, at: Date.now() };
        recomputeXp(member);
        await store.putMember(crewId, member);
      } else if (prev.response !== response) {
        // Keep the better score/XP, but remember the student's latest writing so it persists.
        member.steps[stepId] = { ...prev, response };
        await store.putMember(crewId, member);
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
  console.log(`\n🔥 THE FORGE app running:  http://localhost:${PORT}`);
  console.log(`   Storage: ${USE_SUPABASE ? 'Supabase (shared, cross-device)' : 'local file (single server only)'}`);
  console.log(`   AI judge: ${GEMINI_KEY ? 'Gemini (live)' : 'OFFLINE mock (set GEMINI_API_KEY for real grading)'}`);
  console.log(`   Game Master passcode: ${process.env.ADMIN_CODE ? '(set via ADMIN_CODE)' : "DEFAULT 'forge-gm' — set ADMIN_CODE to change"}\n`);
});
