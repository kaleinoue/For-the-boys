// THE FORGE — frontend. Renders the campaign, submits responses, shows XP.
// Talks to the server for AI grading + shared crew progress.

let QUESTS = null;   // {crew, ranks, acts}
let STATE = null;    // {crew:{id:{xp,rank,steps}}}
let ME = localStorage.getItem('forge_crew_id') || null;
let currentQuestId = null;

const $ = (sel) => document.querySelector(sel);

// ---- boot -------------------------------------------------------------------
(async function init() {
  QUESTS = await fetch('/api/quests').then(r => r.json());
  STATE = await fetch('/api/state').then(r => r.json());
  renderPicker();
  if (ME) enterApp();
  // light polling so crewmates' progress shows up "live"
  setInterval(refreshState, 12000);
})();

async function refreshState() {
  STATE = await fetch('/api/state').then(r => r.json());
  if (ME) { renderMap(); renderBoard(); renderMe(); }
}

// ---- profile picker ---------------------------------------------------------
function renderPicker() {
  const wrap = $('#picker-crew');
  wrap.innerHTML = '';
  for (const c of QUESTS.crew) {
    const m = STATE.crew[c.id] || { xp: 0, rank: { emoji: '🥚' } };
    const b = document.createElement('button');
    b.className = 'crew-pick';
    b.innerHTML = `<div class="emoji">${c.emoji}</div><div class="nm">${c.name}</div>
      <div class="kl">${c.klass}</div><div class="xp">${m.rank.emoji} ${m.xp} XP</div>`;
    b.onclick = () => { ME = c.id; localStorage.setItem('forge_crew_id', c.id); enterApp(); };
    wrap.appendChild(b);
  }
}

function enterApp() {
  $('#picker').classList.add('hidden');
  $('#topbar').classList.remove('hidden');
  $('#app').classList.remove('hidden');
  $('#switch-btn').onclick = () => {
    ME = null; localStorage.removeItem('forge_crew_id');
    $('#picker').classList.remove('hidden');
    $('#topbar').classList.add('hidden');
    $('#app').classList.add('hidden');
    renderPicker();
  };
  // default to first not-yet-done quest, else first quest
  currentQuestId = firstUnfinishedQuest() || QUESTS.acts[0].quests[0].id;
  renderMe(); renderMap(); renderQuest(); renderBoard();
}

// ---- helpers ----------------------------------------------------------------
function meCrew() { return QUESTS.crew.find(c => c.id === ME); }
function allQuests() { return QUESTS.acts.flatMap(a => a.quests); }
function findQuest(id) { return allQuests().find(q => q.id === id); }
function stepState(stepId) { return STATE.crew[ME]?.steps?.[stepId]; }

function questStatus(q) {
  const passed = q.steps.filter(s => stepState(s.id)?.passed).length;
  if (passed === 0) return 'none';
  if (passed === q.steps.length) return 'done';
  return 'part';
}
function firstUnfinishedQuest() {
  for (const q of allQuests()) if (questStatus(q) !== 'done') return q.id;
  return null;
}

// ---- top bar (me) -----------------------------------------------------------
function renderMe() {
  const c = meCrew(); const m = STATE.crew[ME];
  $('#me-emoji').textContent = c.emoji;
  $('#me-name').textContent = c.name;
  $('#me-rank').textContent = `${m.rank.emoji} ${m.rank.name}`;
  const nextRank = QUESTS.ranks.find(r => r.min > m.xp);
  const ceil = nextRank ? nextRank.min : m.xp || 1;
  $('#me-xpfill').style.width = Math.min(100, (m.xp / ceil) * 100) + '%';
  $('#me-xptext').textContent = nextRank ? `${m.xp} / ${nextRank.min} XP` : `${m.xp} XP · MAX`;
}

// ---- quest map --------------------------------------------------------------
function renderMap() {
  const map = $('#map'); map.innerHTML = '';
  for (const act of QUESTS.acts) {
    const t = document.createElement('div'); t.className = 'act-title'; t.textContent = act.title; map.appendChild(t);
    for (const q of act.quests) {
      const st = questStatus(q);
      const b = document.createElement('button');
      b.className = 'q-btn' + (q.id === currentQuestId ? ' active' : '');
      const tick = st === 'done' ? '✓' : st === 'part' ? '·' : '';
      b.innerHTML = `<span class="q-tick ${st}">${tick}</span><span class="q-code">${q.code}</span><span>${q.title}</span>`;
      b.onclick = () => { currentQuestId = q.id; renderMap(); renderQuest(); };
      map.appendChild(b);
    }
  }
}

// ---- quest panel ------------------------------------------------------------
function renderQuest() {
  const q = findQuest(currentQuestId);
  const el = $('#quest');
  const totalXp = q.steps.reduce((s, x) => s + x.xp, 0);
  el.innerHTML = `<div class="qhead"><div class="code">${q.code} · ${totalXp} XP</div><h2>${q.title}</h2></div>`;
  for (const step of q.steps) el.appendChild(renderStep(step));
}

function renderStep(step) {
  const prev = stepState(step.id);
  const wrap = document.createElement('div'); wrap.className = 'step';
  wrap.innerHTML = `
    <div class="st-top"><span class="st-title">${step.title}</span><span class="st-xp">+${step.xp} XP</span></div>
    <div class="prompt">${escapeHtml(step.prompt)}</div>
    <textarea placeholder="Type your response...">${prev ? escapeHtml(prev.response) : ''}</textarea>
    <div class="st-actions">
      <button class="submit-btn">${prev?.passed ? 'Resubmit' : 'Submit for XP'}</button>
      <span class="st-state">${prev ? (prev.passed ? `<span class="done-badge">✓ Passed · ${prev.xp} XP</span>` : 'Not passed yet — try again') : ''}</span>
    </div>
    <div class="grade-slot"></div>`;

  const ta = wrap.querySelector('textarea');
  const btn = wrap.querySelector('.submit-btn');
  const slot = wrap.querySelector('.grade-slot');
  if (prev) slot.appendChild(gradeCard(prev));

  btn.onclick = async () => {
    const response = ta.value.trim();
    if (!response) { ta.focus(); return; }
    btn.disabled = true; const label = btn.textContent; btn.innerHTML = '<span class="spinner"></span> grading';
    try {
      const data = await fetch('/api/grade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crewId: ME, stepId: step.id, response }),
      }).then(r => r.json());
      STATE = data.state;
      slot.innerHTML = ''; slot.appendChild(gradeCard(data.result));
      if (data.result.passed) toast(`✓ ${data.result.xpAwarded} XP awarded!`);
      renderMe(); renderMap(); renderBoard();
      wrap.querySelector('.st-state').innerHTML = data.result.passed
        ? `<span class="done-badge">✓ Passed · ${data.result.xpAwarded} XP</span>`
        : 'Not passed yet — try again';
      btn.textContent = data.result.passed ? 'Resubmit' : 'Submit for XP';
    } catch (e) {
      slot.innerHTML = `<div class="grade fail"><div class="g-fb">Couldn't reach the grader. Is the server running?</div></div>`;
      btn.textContent = label;
    } finally { btn.disabled = false; }
  };
  return wrap;
}

function gradeCard(r) {
  const d = document.createElement('div');
  d.className = 'grade ' + (r.passed ? 'pass' : 'fail');
  d.innerHTML = `<div class="g-top"><span>${r.passed ? '✓ Passed' : '✕ Keep going'}</span>
      <span class="g-score">Score: ${r.score}/100</span></div>
    <div class="g-fb">${escapeHtml(r.feedback || '')}</div>
    ${r.tip ? `<div class="g-tip">💡 ${escapeHtml(r.tip)}</div>` : ''}`;
  return d;
}

// ---- leaderboard ------------------------------------------------------------
function renderBoard() {
  const el = $('#board');
  const rows = QUESTS.crew.map(c => ({ c, m: STATE.crew[c.id] }))
    .sort((a, b) => b.m.xp - a.m.xp);
  el.innerHTML = '<h3>🏆 Crew Leaderboard</h3>';
  for (const { c, m } of rows) {
    const passed = Object.values(m.steps || {}).filter(s => s.passed).length;
    const row = document.createElement('div');
    row.className = 'lb-row' + (c.id === ME ? ' me' : '');
    row.innerHTML = `<span class="lb-emoji">${c.emoji}</span>
      <div><div class="lb-nm">${c.name}</div><div class="lb-meta">${m.rank.emoji} ${m.rank.name} · ${passed} done</div></div>
      <span class="lb-xp">${m.xp}</span>`;
    el.appendChild(row);
  }
  const reset = document.createElement('button');
  reset.className = 'ghost-btn reset'; reset.textContent = 'reset all progress';
  reset.onclick = async () => {
    if (!confirm('Wipe ALL crew progress? (prototype testing)')) return;
    STATE = await fetch('/api/reset', { method: 'POST' }).then(r => r.json());
    renderMe(); renderMap(); renderQuest(); renderBoard();
  };
  el.appendChild(reset);
}

// ---- misc -------------------------------------------------------------------
function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
let toastTimer;
function toast(msg) {
  clearTimeout(toastTimer);
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  toastTimer = setTimeout(() => t.remove(), 2600);
}
