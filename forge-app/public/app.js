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
  buildMusicPicker(); startMusic();
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
function logoutGM(){ stopMusic(); GM_CODE=null; localStorage.removeItem('forge_gm_code'); ME=null; localStorage.removeItem('forge_crew_id');
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

// ---- character / inventory (gear affects battle stats) ----
function battleClass(){ return (ME && ME!=='gm') ? ME : 'zeppelin'; }
function profileOf(id){ const p = STATE.crew[id]?.steps?.__profile; return { inventory:(p&&p.inventory)||[], equipped:(p&&p.equipped)||{}, battles:(p&&p.battles)||{}, gold:(p&&p.gold)||0 }; }
function computeStats(id){
  const G=window.BATTLE.GEAR, base={...window.BATTLE.CLASSES[battleClass()].base};
  const eq=profileOf(id).equipped;
  for(const slot in eq){ const it=G[eq[slot]]; if(it) for(const k in it.mods) base[k]=(base[k]||0)+it.mods[k]; }
  return base;
}
function renderGear(){
  const G=window.BATTLE.GEAR, TC=window.BATTLE.TIER_COLOR, c=crewById(ME);
  $('#gear-name').textContent = `${c.name} — ${window.BATTLE.CLASSES[battleClass()].klass}`;
  const prof=profileOf(ME), st=computeStats(ME);
  const slots=['weapon','armor','trinket'];
  const slotHtml = slots.map(s=>{ const id=prof.equipped[s]; const g=id&&G[id];
    return `<div class="slot"><span class="slot-name">${s}</span>${g?`<button class="item on" data-uneq="${s}" style="border-color:${TC[g.tier]};color:${TC[g.tier]}">${g.name} ✕</button>`:`<span class="empty">— empty —</span>`}</div>`; }).join('');
  // inventory grouped by id with counts, excluding equipped
  const counts={}; prof.inventory.forEach(id=>counts[id]=(counts[id]||0)+1);
  Object.values(prof.equipped).forEach(id=>{ if(counts[id]) counts[id]--; });
  const order=['Mythic','Legendary','Rare','Common'];
  const invHtml = Object.entries(counts).filter(([id,n])=>n>0&&G[id]).sort((a,b)=>order.indexOf(G[a[0]].tier)-order.indexOf(G[b[0]].tier))
    .map(([id,n])=>{ const g=G[id]; const locked=g.klass&&g.klass!==ME; const mods=Object.entries(g.mods).map(([k,v])=>`${k}+${v}`).join(' '); const sv=window.BATTLE.SCRAP_VALUE[g.tier];
      return `<div class="invrow"><button class="item" ${locked?'disabled':`data-eq="${id}" data-slot="${g.slot}"`} style="border-color:${TC[g.tier]};color:${TC[g.tier]}">${g.name}${n>1?` ×${n}`:''} <small>[${g.slot} · ${mods}]</small>${locked?' 🔒':''}</button>${sv?`<button class="scrap" data-scrap="${id}" title="scrap for gold">♻ ${sv}g</button>`:''}</div>`; }).join('') || '<div class="empty">No gear yet — win battles to loot some.</div>';
  $('#gear-body').innerHTML = `
    <div class="statgrid">
      <div>❤ Health <b>${st.hp}</b></div><div>⚔ Attack <b>${st.atk}</b></div>
      <div>🛡 Armor <b>${st.armor}</b></div><div>👟 Speed <b>${st.speed}</b></div>
    </div>
    <div class="goldline">💰 <b>${prof.gold||0}</b> gold</div>
    <h3 class="sub">Equipped</h3>${slotHtml}
    <h3 class="sub">Inventory <small>(tap gear to equip · ♻ to scrap for gold)</small></h3><div class="invlist">${invHtml}</div>`;
  $('#gear-body').querySelectorAll('[data-eq]').forEach(b=>b.onclick=()=>equip(b.dataset.slot,b.dataset.eq));
  $('#gear-body').querySelectorAll('[data-uneq]').forEach(b=>b.onclick=()=>equip(b.dataset.uneq,null));
  $('#gear-body').querySelectorAll('[data-scrap]').forEach(b=>b.onclick=()=>scrap(b.dataset.scrap));
}
async function scrap(id){
  const g=window.BATTLE.GEAR[id];
  if(!confirm(`Scrap ${g.name} for ${window.BATTLE.SCRAP_VALUE[g.tier]} gold?`)) return;
  const d=await fetch('/api/profile/scrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({crewId:ME,itemId:id})}).then(r=>r.json());
  if(d.error){ alert(d.error); return; }
  STATE=d.state; sfx('click'); toast(`♻ +${d.value} gold (${d.gold} total)`); renderGear(); renderHUD();
}
async function setXp(id, val){
  const d=await fetch('/api/admin/setxp',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code:GM_CODE,crewId:id,xp:val})}).then(r=>r.json());
  if(d.error){ alert(d.error); return; }
  STATE=d.state; sfx('click'); toast(`Set ${crewById(id).name} to ${d.xp} XP`); renderGuild(); renderHUD(); renderMap();
}
async function equip(slot,itemId){
  const d=await fetch('/api/profile/equip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({crewId:ME,slot,itemId})}).then(r=>r.json());
  if(d.error){ alert(d.error); return; }
  STATE=d.state; sfx('click'); renderGear(); renderHUD();
}
function launchBattle(){
  const prof=profileOf(ME);
  const qi=Math.min(16, Object.keys(prof.battles).length);   // difficulty grows as you clear
  stopMusic();
  const hasMythic = prof.inventory.includes(window.BATTLE.MYTHIC_BY_CLASS[battleClass()]);
  window.ForgeBattle.start({ classId: battleClass(), questIndex: qi, equipped: prof.equipped, hasMythic,
    onWin: async (res)=>{
      const d=await fetch('/api/battle/win',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({crewId:ME,questId:'train'+qi,xp:res.xp,loot:res.loot})}).then(r=>r.json());
      if(d.state) STATE=d.state; renderHUD(); renderMap();
    },
    onContinue: (res)=>{ startMusic(); toast(`+${res.xp} XP · ${res.loot.length} loot — check 🎒 GEAR`); },
    onInventory: (resume)=>openInventoryOverlay(resume),
    onExit: ()=>{ startMusic(); } });
}

// Quest flow: fight the quest's battle first, THEN the AI trial opens.
function attemptQuest(qid){
  if(isGod()){ openQuest(qid); return; }               // GM skips straight to the trial
  if(profileOf(ME).battles[qid]){ openQuest(qid); return; }
  launchQuestBattle(qid);
}
function launchQuestBattle(qid){
  const idx = Math.max(0, flatQuests().findIndex(q=>q.id===qid));
  const dialog = (window.BATTLE.QUEST_DIALOG && window.BATTLE.QUEST_DIALOG[qid]) || window.BATTLE.GENERIC_DIALOG;
  const prof = profileOf(ME); stopMusic();
  const hasMythic = prof.inventory.includes(window.BATTLE.MYTHIC_BY_CLASS[battleClass()]);
  window.ForgeBattle.start({ classId: battleClass(), questIndex: idx, equipped: prof.equipped, dialog, hasMythic,
    onWin: async (res)=>{                                // persist loot so it's equippable on the victory screen
      const d = await fetch('/api/battle/win',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({crewId:ME,questId:qid,xp:res.xp,loot:res.loot})}).then(r=>r.json());
      if(d.state) STATE=d.state; renderHUD(); renderMap();
    },
    onContinue: (res)=>{ startMusic(); toast(`⚔ Battle won! +${res.xp} XP · ${res.loot.length} loot`); openQuest(qid); },
    onInventory: (resume)=>openInventoryOverlay(resume),
    onExit: ()=>{ startMusic(); renderMap(); } });
}
let pendingBattleResume=null;
function openInventoryOverlay(resume){ pendingBattleResume = resume || null; renderGear(); $('#gear-modal').classList.remove('hidden'); }
function closeGear(){ $('#gear-modal').classList.add('hidden'); if(pendingBattleResume){ const r=pendingBattleResume; pendingBattleResume=null; r(profileOf(ME).equipped); } }

function wireChrome(){
  $('#btn-gm').onclick = ()=>{ initAudio(); loginGM(); };
  $('#btn-gear').onclick = ()=>{ sfx('click'); renderGear(); $('#gear-modal').classList.remove('hidden'); };
  $('#btn-battle').onclick = ()=>{ initAudio(); sfx('click'); launchBattle(); };
  $('#btn-switch').onclick = ()=>{ sfx('click'); stopMusic(); ME=null; localStorage.removeItem('forge_crew_id');
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
  // closing the gear screen resumes a paused battle and re-applies stats
  $('#gear-modal').addEventListener('click', e=>{ if(e.target.matches('[data-close]')||e.target===$('#gear-modal')) closeGear(); });
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
      const needsBattle = unlocked && !isGod() && st!=='done' && !profileOf(ME).battles[q.id];
      const cls = !unlocked?'locked':st==='done'?'done':st==='part'?'part':'available';
      const node = document.createElement('div'); node.className = `node ${cls}`;
      const face = !unlocked?'🔒':st==='done'?'✓':q.code.replace('Q','');
      node.innerHTML = `<div class="connector"></div><div class="medallion">${face}</div><div class="n-title">${needsBattle?'⚔ ':''}${q.title}</div>`;
      node.querySelector('.medallion').onclick = ()=>{
        if(!unlocked){ sfx('locked'); node.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:200});
          toast('🔒 Clear the quest before it'); return; }
        sfx('click'); attemptQuest(q.id);
      };
      trail.appendChild(node);
    }
    region.appendChild(trail); map.appendChild(region);
  });
}

// ---- quest modal ------------------------------------------------------------
function openQuest(qid){
  openQuestId = qid;
  const act = QUESTS.acts.find(a=>a.quests.some(q=>q.id===qid));
  if(act) musSetArea(act.id);                 // music follows the world
  const q = findQuest(qid);
  const total = q.steps.reduce((s,x)=>s+x.xp,0);
  $('#q-code').textContent = q.code; $('#q-title').textContent = q.title; $('#q-xp').textContent = `${total} XP`;
  const box = $('#q-steps'); box.innerHTML='';
  const cleared = !!profileOf(ME).battles[qid];
  const note = document.createElement('div'); note.className='battle-note';
  note.innerHTML = cleared
    ? `⚔ Battle cleared — loot's in 🎒 GEAR. <button class="pixel-btn ghost bnote">Replay for loot</button>`
    : `⚔ <button class="pixel-btn ghost bnote">Fight this quest's battle</button>`;
  note.querySelector('.bnote').onclick = ()=>{ $('#quest-modal').classList.add('hidden'); launchQuestBattle(qid); };
  box.appendChild(note);
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
    if(isGod()){                                   // GM: edit this hero's XP
      const ed=document.createElement('div'); ed.className='gxp-edit';
      ed.innerHTML=`<input type="number" min="0" value="${m.xp}" aria-label="set XP" /><button class="pixel-btn ghost">set XP</button>`;
      ed.querySelector('button').onclick=()=>setXp(c.id, ed.querySelector('input').value);
      row.appendChild(ed);
    }
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

// ============ background chiptune (synthesized — free, no files) ============
// All ORIGINAL era-style tracks + genuine PUBLIC-DOMAIN melodies (Korobeiniki =
// traditional folk; Ode to Joy = Beethoven). No copyrighted game music.
function noteHz(n){ if(!n||n==='r')return 0; const m=/^([A-G]#?)(-?\d)$/.exec(n);
  const map={C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
  return 440*Math.pow(2,((map[m[1]]+(+m[2]+1)*12)-69)/12); }
function expand(line){ const a=[]; for(const [n,d] of line){ a.push({f:noteHz(n),dur:d}); for(let i=1;i<d;i++)a.push(null);} return a; }
const C_=(b,n)=>({b:noteHz(b),n:n.map(noteHz)});
const CH={ Am:C_('A2',['A3','C4','E4']), F:C_('F2',['F3','A3','C4']), C:C_('C3',['C4','E4','G4']),
  G:C_('G2',['G3','B3','D4']), Em:C_('E2',['E3','G3','B3']), Dm:C_('D3',['D4','F4','A4']),
  Gm:C_('G2',['G3','A#3','D4']), A:C_('A2',['A3','C#4','E4']), E:C_('E2',['E3','G#3','B3']), Bm:C_('B2',['B3','D4','F#4']) };

// type 'arp' = looping chord progression (safe & consonant). type 'mel' = a public-domain melody line.
const TRACKS={
  overworld:{label:'⚔️ Overworld',  bpm:140, wave:'square',   type:'arp', chords:[CH.Am,CH.F,CH.C,CH.G]},
  puzzle:   {label:'🧩 Puzzle',     bpm:128, wave:'square',   type:'arp', chords:[CH.C,CH.Am,CH.F,CH.G]},
  dungeon:  {label:'🕯️ Dungeon',    bpm:96,  wave:'triangle', type:'arp', chords:[CH.Em,CH.C,CH.Am,CH.Bm]},
  castle:   {label:'🦇 Castle',     bpm:104, wave:'square',   type:'arp', chords:[CH.Dm,CH.Gm,CH.A,CH.Dm]},
  boss:     {label:'⚡ Boss',       bpm:158, wave:'square',   type:'arp', chords:[CH.Am,CH.F,CH.E,CH.E]},
  victory:  {label:'🎉 Victory',    bpm:124, wave:'square',   type:'arp', chords:[CH.C,CH.G,CH.Am,CH.F]},
  ode:{label:'🎼 Ode to Joy (Beethoven)', bpm:118, wave:'square', type:'mel',
    lead:expand([['E4',4],['E4',4],['F4',4],['G4',4],['G4',4],['F4',4],['E4',4],['D4',4],['C4',4],['C4',4],['D4',4],['E4',4],['E4',6],['D4',2],['D4',8]]),
    bass:expand([['C2',16],['G2',16],['C2',16],['G2',8],['C2',8]])},
  koro:{label:'🧱 Korobeiniki (trad.)', bpm:150, wave:'square', type:'mel',
    lead:expand([['E5',4],['B4',2],['C5',2],['D5',4],['C5',2],['B4',2],['A4',4],['A4',2],['C5',2],['E5',4],['D5',2],['C5',2],['B4',6],['C5',2],['D5',4],['E5',4],['C5',4],['A4',4],['A4',8]]),
    bass:expand([['E2',16],['A2',16],['E2',16],['B2',8],['E2',8]])},
  mountainking:{label:'👑 Mountain King (Grieg)', bpm:150, wave:'square', type:'mel',
    lead:expand([['B4',2],['C#5',2],['D5',2],['E5',2],['F#5',2],['D5',2],['F#5',2],['r',2],
      ['F5',2],['D5',2],['F5',2],['r',2],['F5',2],['D5',2],['F5',2],['r',2],
      ['B4',2],['C#5',2],['D5',2],['E5',2],['F#5',2],['D5',2],['F#5',2],['r',2],
      ['A5',2],['F#5',2],['A5',2],['r',2],['A5',2],['F#5',2],['A5',2],['r',2]]),
    bass:expand([['B2',16],['B2',16],['B2',16],['F#2',8],['B2',8]])},
  cavalry:{label:'🐎 Cavalry (fast)', bpm:170, wave:'square', type:'arp', chords:[CH.Am,CH.E,CH.Dm,CH.E]},
};
const ACT_TRACK={ act0:'overworld', act1:'puzzle', act2:'dungeon', act3:'overworld', act4:'boss', act5:'mountainking', act6:'victory' };

let MUS_MODE = localStorage.getItem('forge_music') || 'auto';   // 'off' | 'auto' | trackKey
let curActId='act0', curTrack=null, musStepDur=0.15;
let musGain=null, musTimer=null, musNext=0, musStep=0;

function musInit(){ initAudio(); if(AC && !musGain){ musGain=AC.createGain(); musGain.gain.value=0.05; musGain.connect(AC.destination); } }
function musVoice(freq,dur,type,vol,at){ if(!AC||!musGain||!freq)return;
  const o=AC.createOscillator(), g=AC.createGain(); o.type=type; o.frequency.value=freq; o.connect(g); g.connect(musGain);
  g.gain.setValueAtTime(0.0001,at); g.gain.linearRampToValueAtTime(vol,at+0.01); g.gain.exponentialRampToValueAtTime(0.0001,at+Math.max(0.05,dur));
  o.start(at); o.stop(at+Math.max(0.05,dur)); }
function musPlayStep(s,at){
  if(!curTrack) return; const sd=musStepDur, w=curTrack.wave;
  if(curTrack.type==='arp'){
    const ch=curTrack.chords[Math.floor(s/16)%curTrack.chords.length], e=s%16;
    if(e%4===0) musVoice(ch.b, sd*3.6, 'triangle', 0.5, at);                   // bass on beats
    if(e%2===0) musVoice(ch.n[(e/2)%ch.n.length], sd*1.8, w, 0.26, at);        // arpeggio (eighths)
  } else {                                                                     // melody
    const L=curTrack.lead[s%curTrack.lead.length]; if(L) musVoice(L.f, L.dur*sd*0.95, w, 0.34, at);
    const B=curTrack.bass[s%curTrack.bass.length]; if(B) musVoice(B.f, B.dur*sd*0.9, 'triangle', 0.4, at);
  }
}
function musSchedule(){ if(!AC)return; while(musNext < AC.currentTime + 0.15){ musPlayStep(musStep, musNext); musNext+=musStepDur; musStep++; } }
function setTrack(key){ const t=TRACKS[key]; if(!t)return; curTrack=t; musStepDur=60/t.bpm/4; musStep=0; if(AC) musNext=AC.currentTime+0.08; }
function pickKey(){ return MUS_MODE==='auto' ? (ACT_TRACK[curActId]||'overworld') : MUS_MODE; }
function startMusic(){
  if(MUS_MODE==='off'){ stopMusic(); return; }
  musInit(); if(!AC) return; setTrack(pickKey());
  if(AC.state==='suspended'){ const go=()=>{AC.resume();document.removeEventListener('pointerdown',go);document.removeEventListener('keydown',go);reallyStartMusic();};
    document.addEventListener('pointerdown',go); document.addEventListener('keydown',go); return; }
  reallyStartMusic();
}
function reallyStartMusic(){ if(!AC) return; if(!musTimer){ musNext=AC.currentTime+0.1; musTimer=setInterval(musSchedule,30); } }
function stopMusic(){ if(musTimer){ clearInterval(musTimer); musTimer=null; } }
function musSetArea(actId){ if(actId && actId!==curActId){ curActId=actId; if(MUS_MODE==='auto'&&musTimer) setTrack(pickKey()); } }
function buildMusicPicker(){
  const sel=$('#music-pick'); if(!sel) return;
  const opts=[['off','🔇 Music Off'],['auto','🎵 Auto (by area)'],...Object.entries(TRACKS).map(([k,t])=>[k,t.label])];
  sel.innerHTML=opts.map(([v,l])=>`<option value="${v}" ${v===MUS_MODE?'selected':''}>${l}</option>`).join('');
  sel.onchange=()=>{ MUS_MODE=sel.value; localStorage.setItem('forge_music',MUS_MODE); if(MUS_MODE==='off') stopMusic(); else startMusic(); };
}
