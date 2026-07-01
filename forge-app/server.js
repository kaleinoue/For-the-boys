// =============================================================================
//  THE FORGE — app server (zero dependencies; Node 18+)
//  Run:  node server.js       then open  http://localhost:3000
//
//  What it does:
//   - serves the frontend in /public
//   - GET  /api/quests  -> campaign structure (rubrics stripped out)
//   - GET  /api/state   -> shared progress for all crew members
//   - POST /api/grade   -> AI-grades a response, awards XP, saves shared state
//   - POST /api/reset   -> wipes progress (handy while testing)
//
//  The Gemini API key lives ONLY here on the server (never in the browser), so
//  it can't leak to players. No key? It falls back to a mock grader so the app
//  still runs — see gradeResponse().
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
  } catch { /* no .env — fine, we fall back to the mock grader */ }
})();

const { CREW, RANKS, ACTS } = require('./data/quests');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const STATE_FILE = path.join(__dirname, 'data', 'progress.json');
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.FORGE_MODEL || 'gemini-2.0-flash';
const PASS_SCORE = 60;

// ---- tiny helpers -----------------------------------------------------------
const stepIndex = {};            // stepId -> step (with rubric, server-side only)
for (const act of ACTS)
  for (const q of act.quests)
    for (const s of q.steps) stepIndex[s.id] = { ...s, questCode: q.code, questTitle: q.title };

function rankFor(xp) {
  let r = RANKS[0];
  for (const rank of RANKS) if (xp >= rank.min) r = rank;
  return r;
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { const s = { crew: {} }; for (const c of CREW) s.crew[c.id] = { xp: 0, steps: {} }; return s; }
}
function saveState(state) { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

function recomputeXp(member) {
  member.xp = Object.values(member.steps).reduce((sum, s) => sum + (s.xp || 0), 0);
  return member.xp;
}

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

Return ONLY JSON with this shape:
{"score": <integer 0-100>, "feedback": "<2-3 sentences, specific to THEIR answer, warm and a little hyped>", "tip": "<one concrete way to level it up>"}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
    const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 0)));
    return {
      passed: score >= PASS_SCORE, score,
      feedback: parsed.feedback || 'Graded.',
      tip: parsed.tip || '',
    };
  } catch (err) {
    console.error('Grading error, using fallback:', err.message);
    return mockGrade(step, text);
  }
}

// No-API fallback so the app always works (rough heuristic on effort).
function mockGrade(step, text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const score = Math.min(100, 30 + words * 4);
  const passed = score >= PASS_SCORE;
  return {
    passed, score,
    feedback: passed
      ? `Nice — solid effort (${words} words). (Offline grader: add a GEMINI_API_KEY for real AI feedback.)`
      : `Good start, but stretch it out a bit more and be specific. (Offline grader — add a GEMINI_API_KEY for real AI feedback.)`,
    tip: passed ? 'Add a concrete example to make it bulletproof.' : 'Aim for a few clear sentences that hit every part of the task.',
  };
}

// ---- request handling -------------------------------------------------------
function sendJson(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

function readBody(req) {
  return new Promise((resolve) => {
    let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/api/quests') return sendJson(res, 200, publicQuests());
  if (req.method === 'GET' && url === '/api/state') {
    const state = loadState();
    return sendJson(res, 200, decorate(state));
  }
  if (req.method === 'POST' && url === '/api/reset') {
    const s = { crew: {} }; for (const c of CREW) s.crew[c.id] = { xp: 0, steps: {} };
    saveState(s); return sendJson(res, 200, decorate(s));
  }
  if (req.method === 'POST' && url === '/api/grade') {
    const { crewId, stepId, response } = await readBody(req);
    const step = stepIndex[stepId];
    const member = loadState().crew[crewId];
    if (!step || !member) return sendJson(res, 400, { error: 'Unknown crew member or step.' });

    const result = await gradeResponse(step, response);
    const awarded = result.passed ? step.xp : 0;

    // read-modify-write the shared state (keep the best attempt)
    const state = loadState();
    const m = state.crew[crewId];
    const prev = m.steps[stepId];
    const keepBest = prev && prev.xp >= awarded && prev.passed;
    m.steps[stepId] = keepBest ? prev : {
      passed: result.passed, score: result.score, xp: awarded,
      response, feedback: result.feedback, tip: result.tip, at: Date.now(),
    };
    recomputeXp(m);
    saveState(state);

    return sendJson(res, 200, {
      result: { ...result, xpAwarded: keepBest ? prev.xp : awarded, alreadyBetter: keepBest },
      member: memberSummary(crewId, state.crew[crewId]),
      state: decorate(state),
    });
  }

  return serveStatic(req, res);
});

// attach rank + counts to state before sending
function memberSummary(id, m) {
  const rank = rankFor(m.xp);
  const done = Object.values(m.steps).filter(s => s.passed).length;
  return { id, xp: m.xp, rank, stepsPassed: done };
}
function decorate(state) {
  const crew = {};
  for (const c of CREW) {
    const m = state.crew[c.id] || { xp: 0, steps: {} };
    crew[c.id] = { xp: m.xp, rank: rankFor(m.xp), steps: m.steps };
  }
  return { crew };
}

server.listen(PORT, () => {
  console.log(`\n🔥 THE FORGE app running:  http://localhost:${PORT}`);
  console.log(GEMINI_KEY ? '   AI judge: Gemini (live)\n' : '   AI judge: OFFLINE mock (set GEMINI_API_KEY in .env for real grading)\n');
});
