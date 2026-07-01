// ================= THE FORGE — RPG frontend =================
let QUESTS = null, STATE = null;
let ME = localStorage.getItem('forge_crew_id') || null;
let openQuestId = null;
let GM_CODE = localStorage.getItem('forge_gm_code') || null;   // Game Master passcode
let RUBRICS = null;                                            // cached admin rubrics
const isGod = () => !!GM_CODE;
const $ = (s) => document.querySelector(s);
const REGION_COLORS = ['#ff6b1a','#ff4d8d','#8b5cf6','#22c1c3','#e5484d','#ffd15c'];

// ---- boot -------------------------------------------------------------------
(async function init(){
  makeEmbers();
  QUESTS = await fetch('/api/quests').then(r=>r.json());
  STATE  = await fetch('/api/state').then(r=>r.json());
  buildHeroSelect();
  wireChrome();
  if (ME) enterGame();
  setInterval(async ()=>{ STATE = await fetch('/api/state').then(r=>r.json());
    if(ME){ renderHUD(); renderMap(); if(!$('#guild-modal').classList.contains('hidden')) renderGuild(); } }, 12000);
})();

// ---- helpers ----------------------------------------------------------------
const crewById = (id)=>QUESTS.crew.find(c=>c.id===id);
const flatQuests = ()=>QUESTS.acts.flatMap(a=>a.quests);
const findQuest = (id)=>flatQuests().find(q=>q.id===id);
const stepState = (id,sid)=>STATE.crew[id]?.steps?.[sid];
function questStatus(id, q){
  const p = q.steps.filter(s=>stepState(id,s.id)?.passed).length;
  return p===0 ? 'none' : p===q.steps.length ? 'done' : 'part';
}
function isUnlocked(qid){
  if (isGod()) return true;                         // God Mode: everything open
  const list = flatQuests(); const i = list.findIndex(q=>q.id===qid);
  if (i<=0) return true;
  return questStatus(ME, list[i-1])==='done';
}
function portrait(crew, small){
  return `<div class="portrait ${small?'sm':''} acc-${crew.id}">${crew.emoji}</div>`;
}

// ---- title / hero select ----------------------------------------------------
function buildHeroSelect(){
  const wrap = $('#hero-select'); wrap.innerHTML='';
  for(const c of QUESTS.crew.filter(x=>!x.hidden)){
    const m = STATE.crew[c.id] || {xp:0,rank:{emoji:'🥚',name:'Noob'}};
    const card = document.createElement('button');
    card.className = `hero-card acc-${c.id}`;
    card.innerHTML = `${portrait(c)}
      <div class="hc-name">${c.name}</div>
      <div class="hc-class">${c.emoji} ${c.klass}</div>
      <div class="hc-stat">${m.rank.emoji} ${m.rank.name} · ${m.xp} XP</div>
      <div class="hc-enter">▶ press to play</div>`;
    card.onclick = ()=>{ initAudio(); sfx('select'); ME=c.id; localStorage.setItem('forge_crew_id',c.id); enterGame(); };
    wrap.appendChild(card);
  }
}

function enterGame(){
  $('#screen-title').classList.add('hidden');
  $('#screen-map').classList.remove('hidden');
  renderAdminBar(); renderHUD(); renderMap();
}

async function loginGM(){
  const code = prompt('Enter the Game Master passcode:'); if(!code) return;
  const r = await fetch('/api/admin/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})}).then(x=>x.json()).catch(()=>({ok:false}));
  if(!r.ok){ alert('Wrong passcode.'); return; }
  GM_CODE = code; localStorage.setItem('forge_gm_code', code);
  ME = 'gm'; localStorage.setItem('forge_crew_id','gm');
  STATE = await fetch('/api/state').then(x=>x.json());
  sfx('levelup'); enterGame();
}
function logoutGM(){ GM_CODE=null; localStorage.removeItem('forge_gm_code'); ME=null; localStorage.removeItem('forge_crew_id');
  $('#admin-bar').classList.add('hidden'); $('#screen-map').classList.add('hidden'); $('#screen-title').classList.remove('hidden'); buildHeroSelect(); }

function renderAdminBar(){
  const bar = $('#admin-bar');
  if(!isGod()){ bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const opts = QUESTS.crew.map(c=>`<option value="${c.id}" ${c.id===ME?'selected':''}>${c.emoji} ${c.name}</option>`).join('');
  bar.innerHTML = `<span class="gm-tag">🛠️ GOD MODE</span>
    <label class="gm-actas">Act as: <select id="gm-actas">${opts}</select></label>
    <span class="gm-hint">all trials unlocked · force-clear + rubrics on each step</span>
    <button id="gm-logout" class="pixel-btn ghost">exit GM</button>`;
  $('#gm-actas').onchange = (e)=>{ ME = e.target.value; localStorage.setItem('forge_crew_id',ME); renderHUD(); renderMap(); };
  $('#gm-logout').onclick = logoutGM;
}

function wireChrome(){
  $('#btn-gm').onclick = ()=>{ initAudio(); loginGM(); };
  $('#btn-switch').onclick = ()=>{ sfx('click'); ME=null; localStorage.removeItem('forge_crew_id');
    $('#admin-bar').classList.add('hidden'); $('#screen-map').classList.add('hidden'); $('#screen-title').classList.remove('hidden'); buildHeroSelect(); };
  $('#btn-guild').onclick = ()=>{ sfx('click'); renderGuild(); $('#guild-modal').classList.remove('hidden'); };
  $('#btn-sound').onclick = (e)=>{ MUTED=!MUTED; localStorage.setItem('forge_muted',MUTED?'1':''); e.target.textContent = MUTED?'🔇':'🔊'; if(!MUTED){initAudio();sfx('click');} };
  $('#btn-sound').textContent = MUTED?'🔇':'🔊';
  $('#btn-reset').onclick = async ()=>{ if(!isGod()){ alert('Game Master only.'); return; }
    if(!confirm('Wipe ALL crew progress? This cannot be undone.'))return;
    const r = await fetch('/api/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:GM_CODE})}).then(x=>x.json());
    if(r.error){ alert(r.error); return; }
    STATE = r; renderHUD(); renderMap(); renderGuild(); };
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('.modal').classList.add('hidden'));
  document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{ if(e.target===m) m.classList.add('hidden'); }));
}

// ---- HUD --------------------------------------------------------------------
function renderHUD(){
  const c = crewById(ME), m = STATE.crew[ME];
  const pt = $('#hud-portrait'); pt.className = `portrait sm acc-${c.id}`; pt.textContent = c.emoji;
  $('#hud-name').textContent = `${c.name}`;
  $('#hud-level').textContent = `${m.rank.emoji} ${m.rank.name}  ·  ${c.klass}`;
  const next = QUESTS.ranks.find(r=>r.min>m.xp);
  const ceil = next ? next.min : (m.xp||1);
  $('#hud-xpfill').style.width = Math.min(100,(m.xp/ceil)*100)+'%';
  $('#hud-xptext').textContent = next ? `${m.xp} / ${next.min} XP` : `${m.xp} XP · MAX`;
}

// ---- world map --------------------------------------------------------------
function renderMap(){
  const map = $('#map'); map.innerHTML='';
  QUESTS.acts.forEach((act,ai)=>{
    const anyUnlocked = act.quests.some(q=>isUnlocked(q.id));
    const region = document.createElement('div');
    region.className = 'region'+(anyUnlocked?'':' locked');
    region.style.setProperty('--ra', REGION_COLORS[ai%REGION_COLORS.length]);
    region.innerHTML = `<div class="region-head">
        <span class="region-sigil">${anyUnlocked?'🗺️':'🔒'}</span>
        <span class="region-name">${act.title}</span>
        <span class="region-theme">${act.theme}</span>
      </div>`;
    const trail = document.createElement('div'); trail.className='trail';
    for(const q of act.quests){
      const st = questStatus(ME,q); const unlocked = isUnlocked(q.id);
      const cls = !unlocked?'locked':st==='done'?'done':st==='part'?'part':'available';
      const node = document.createElement('div'); node.className = `node ${cls}`;
      const face = !unlocked?'🔒':st==='done'?'✓':q.code.replace('Q','');
      node.innerHTML = `<div class="connector"></div><div class="medallion">${face}</div><div class="n-title">${q.title}</div>`;
      node.querySelector('.medallion').onclick = ()=>{
        if(!unlocked){ sfx('locked'); node.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:200});
          toast('🔒 Clear the trial before it'); return; }
        sfx('click'); openQuest(q.id);
      };
      trail.appendChild(node);
    }
    region.appendChild(trail); map.appendChild(region);
  });
}

// ---- quest modal ------------------------------------------------------------
function openQuest(qid){
  openQuestId = qid;
  const q = findQuest(qid);
  const total = q.steps.reduce((s,x)=>s+x.xp,0);
  $('#q-code').textContent = q.code; $('#q-title').textContent = q.title; $('#q-xp').textContent = `${total} XP`;
  const box = $('#q-steps'); box.innerHTML='';
  q.steps.forEach(step=>box.appendChild(renderStep(step)));
  $('#quest-modal').classList.remove('hidden');
}

function renderStep(step){
  const prev = stepState(ME, step.id);
  const el = document.createElement('div'); el.className='step';
  el.innerHTML = `<div class="st-top"><span class="st-title">⚔️ ${step.title}</span><span class="st-xp">+${step.xp} XP</span></div>
    <div class="prompt">${esc(step.prompt)}</div>
    <textarea placeholder="Write your response, hero...">${prev?esc(prev.response):''}</textarea>
    <div class="st-actions">
      <button class="pixel-btn submit">${prev?.passed?'⚒ RE-ATTEMPT':'⚔ ATTEMPT'}</button>
      ${isGod()?`<button class="pixel-btn ghost gm-force">⚡ Force Clear</button><button class="pixel-btn ghost gm-rubric">👁 Rubric</button>`:''}
      <span class="st-state">${prev?(prev.passed?`<span class="ok">✓ cleared · ${prev.xp} XP</span>`:'not cleared — try again'):''}</span>
    </div>
    <div class="rubric-slot"></div>
    <div class="grade-slot"></div>`;
  const ta=el.querySelector('textarea'), btn=el.querySelector('.submit'), slot=el.querySelector('.grade-slot');
  if(prev) slot.appendChild(gradeCard(prev));

  if(isGod()){
    el.querySelector('.gm-force').onclick = async ()=>{
      const data = await fetch('/api/admin/force',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({code:GM_CODE,crewId:ME,stepId:step.id})}).then(r=>r.json());
      if(data.error){ alert(data.error); return; }
      STATE = data.state; sfx('crit'); burstXP(btn, step.xp); toast(`⚡ Force-cleared for ${crewById(ME).name}`);
      el.querySelector('.st-state').innerHTML = `<span class="ok">✓ cleared · ${step.xp} XP</span>`;
      renderHUD(); renderMap();
    };
    el.querySelector('.gm-rubric').onclick = async ()=>{
      const rs = el.querySelector('.rubric-slot');
      if(rs.innerHTML){ rs.innerHTML=''; return; }
      if(!RUBRICS){ RUBRICS = (await fetch('/api/admin/rubrics?code='+encodeURIComponent(GM_CODE)).then(r=>r.json()).catch(()=>({rubrics:{}}))).rubrics || {}; }
      rs.innerHTML = `<div class="rubric-box"><b>🎯 Grading rubric (hidden from players):</b><br>${esc(RUBRICS[step.id]||'(none)')}</div>`;
    };
  }
  btn.onclick = async ()=>{
    const response = ta.value.trim(); if(!response){ ta.focus(); return; }
    const beforeRank = STATE.crew[ME].rank.name;
    btn.disabled=true; const lbl=btn.textContent; btn.innerHTML='<span class="spinner"></span> judging';
    try{
      const data = await fetch('/api/grade',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({crewId:ME,stepId:step.id,response})}).then(r=>r.json());
      STATE = data.state;
      slot.innerHTML=''; slot.appendChild(gradeCard(data.result));
      const r=data.result;
      el.querySelector('.st-state').innerHTML = r.passed?`<span class="ok">✓ cleared · ${r.xpAwarded} XP</span>`:'not cleared — try again';
      btn.textContent = r.passed?'⚒ RE-ATTEMPT':'⚔ ATTEMPT';
      if(r.passed){
        sfx(r.score>=90?'crit':'win'); burstXP(btn, r.xpAwarded); toast(`✓ TRIAL CLEARED  +${r.xpAwarded} XP`);
        const afterRank = STATE.crew[ME].rank.name;
        if(afterRank!==beforeRank) levelUp(STATE.crew[ME].rank);
      } else sfx('fail');
      renderHUD(); renderMap();
    }catch(e){ slot.innerHTML=`<div class="grade fail"><div class="g-fb">⚠ Couldn't reach the judge. Is the server running?</div></div>`; btn.textContent=lbl; }
    finally{ btn.disabled=false; }
  };
  return el;
}

function gradeCard(r){
  const d=document.createElement('div'); d.className='grade '+(r.passed?'pass':'fail');
  d.innerHTML=`<div class="g-top"><span class="${r.passed?'win':'lose'}">${r.passed?'✦ VICTORY':'✕ KEEP GOING'}</span>
      <span class="g-score">${r.score}/100</span></div>
    <div class="g-fb">${esc(r.feedback||'')}</div>
    ${r.tip?`<div class="g-tip">💡 ${esc(r.tip)}</div>`:''}`;
  return d;
}

// ---- guild (leaderboard) ----------------------------------------------------
function renderGuild(){
  const list = $('#guild-list'); list.innerHTML='';
  $('#btn-reset').style.display = isGod() ? '' : 'none';   // reset is GM-only
  const rows = QUESTS.crew.filter(c=>!c.hidden).map(c=>({c,m:STATE.crew[c.id]})).sort((a,b)=>b.m.xp-a.m.xp);
  rows.forEach(({c,m},i)=>{
    const passed=Object.values(m.steps||{}).filter(s=>s.passed).length;
    const row=document.createElement('div'); row.className='g-row'+(c.id===ME?' me':'');
    row.innerHTML=`<div class="g-rank-badge">#${i+1}</div>${portrait(c,true)}
      <div><div class="g-nm acc-${c.id}" style="color:var(--accent)">${c.name}</div>
        <div class="g-meta">${m.rank.emoji} ${m.rank.name} · ${passed}/17 trials</div></div>
      <div class="g-xp">${m.xp} XP</div>`;
    list.appendChild(row);
  });
}

// ---- level up ---------------------------------------------------------------
function levelUp(rank){
  $('#lu-rank').textContent = `${rank.emoji}  ${rank.name}`;
  $('#levelup').classList.remove('hidden'); sfx('levelup');
  setTimeout(()=>$('#levelup').classList.add('hidden'), 2600);
  $('#levelup').onclick=()=>$('#levelup').classList.add('hidden');
}

// ---- juice: particles, toast, embers, sound --------------------------------
function burstXP(anchor, xp){
  const r=anchor.getBoundingClientRect();
  for(let i=0;i<6;i++){ const p=document.createElement('div'); p.className='particle'; p.textContent = i%2?'+XP':'✦';
    p.style.left=(r.left+r.width/2+ (Math.random()*60-30))+'px'; p.style.top=(r.top-6)+'px';
    p.style.animationDelay=(i*40)+'ms'; document.body.appendChild(p); setTimeout(()=>p.remove(),1200); }
}
let toastT; function toast(msg){ clearTimeout(toastT); let t=$('.toast'); if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t);} t.textContent=msg; toastT=setTimeout(()=>t.remove(),2600); }
function makeEmbers(){ const wrap=$('#embers'); for(let i=0;i<26;i++){ const e=document.createElement('div'); e.className='ember';
  e.style.left=Math.random()*100+'vw'; e.style.setProperty('--dx',(Math.random()*40-20)+'px');
  e.style.animationDuration=(6+Math.random()*8)+'s'; e.style.animationDelay=(-Math.random()*10)+'s';
  e.style.opacity=(.2+Math.random()*.5); wrap.appendChild(e);} }
function esc(s){return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

// ---- procedural sound (WebAudio, no files) ---------------------------------
let AC=null, MUTED = localStorage.getItem('forge_muted')==='1';
function initAudio(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch{} } }
function tone(freq,dur,type='square',vol=.06,when=0){ if(MUTED||!AC)return;
  const t=AC.currentTime+when, o=AC.createOscillator(), g=AC.createGain();
  o.type=type; o.frequency.value=freq; o.connect(g); g.connect(AC.destination);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.start(t); o.stop(t+dur); }
function sfx(kind){ if(MUTED)return; initAudio();
  if(kind==='select'){ tone(330,.08);tone(495,.1,'square',.06,.08); }
  else if(kind==='click'){ tone(420,.05,'square',.04); }
  else if(kind==='win'){ [523,659,784].forEach((f,i)=>tone(f,.12,'square',.06,i*.08)); }
  else if(kind==='crit'){ [523,659,784,1047].forEach((f,i)=>tone(f,.13,'square',.07,i*.07)); }
  else if(kind==='levelup'){ [392,523,659,784,1047].forEach((f,i)=>tone(f,.16,'triangle',.08,i*.1)); }
  else if(kind==='fail'){ tone(220,.18,'sawtooth',.05); tone(160,.22,'sawtooth',.05,.1); }
  else if(kind==='locked'){ tone(140,.12,'square',.05); }
}
