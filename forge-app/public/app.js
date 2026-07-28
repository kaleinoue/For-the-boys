// ================= THE FORGE — RPG frontend =================
let QUESTS = null, STATE = null;
let ME = localStorage.getItem('forge_crew_id') || null;
let openQuestId = null;
let GM_CODE = localStorage.getItem('forge_gm_code') || null;   // Game Master passcode
let RUBRICS = null;                                            // cached admin rubrics
let MOBS = { mobs:{}, levels:{} };                             // God-Mode mob DB (custom mobs + level assignments)
let gmClass = localStorage.getItem('forge_gm_class') || '';    // God Mode: fight as any class style (test override)
const isGod = () => !!GM_CODE;
const MAX_LEVEL = 16;                                          // quest indices 0..16

// Fetch the mob DB and merge it into the battle engine so battles + God Mode agree.
async function loadMobs(){
  try{ MOBS = await fetch('/api/mobs').then(r=>r.json()); }catch{ MOBS = { mobs:{}, levels:{} }; }
  if(window.BATTLE && window.BATTLE.setMobConfig) window.BATTLE.setMobConfig(MOBS);
}
// The full effective roster = base built-ins + custom mobs (custom overrides base by id).
function allMobs(){
  const B=window.BATTLE, out={};
  for(const id of (B.BASE_MOB_IDS||[])) out[id] = { ...B.ENEMIES[id], base:true };
  for(const id in (MOBS.mobs||{})) out[id] = { ...MOBS.mobs[id], base:(B.BASE_MOB_IDS||[]).includes(id) };
  return out;
}
// Merge whatever a mob/projectile endpoint returned into MOBS, then push to the engine (never drops other keys).
function applyCfg(r){
  if(r.mobs) MOBS.mobs=r.mobs; if(r.levels) MOBS.levels=r.levels;
  if(r.projectiles) MOBS.projectiles=r.projectiles; if(r.classProjectiles) MOBS.classProjectiles=r.classProjectiles;
  window.BATTLE.setMobConfig(MOBS);
}
const $ = (s) => document.querySelector(s);
const REGION_COLORS = ['#ff6b1a','#ff4d8d','#8b5cf6','#22c1c3','#e5484d','#ffd15c'];

// ---- boot -------------------------------------------------------------------
(async function init(){
  makeEmbers();
  QUESTS = await fetch('/api/quests').then(r=>r.json());
  STATE  = await fetch('/api/state').then(r=>r.json());
  await loadMobs();                                            // merge God-Mode mobs + level assignments into the battle engine
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
  const CL = window.BATTLE.CLASSES;
  const classOpts = `<option value="">class: profile default</option>` +
    Object.entries(CL).map(([id,c])=>`<option value="${id}" ${id===gmClass?'selected':''}>⚔ ${c.name} · ${c.klass}</option>`).join('');
  bar.innerHTML = `<span class="gm-tag">🛠️ GOD MODE</span>
    <label class="gm-actas">Act as: <select id="gm-actas">${opts}</select></label>
    <label class="gm-actas">Test class: <select id="gm-class">${classOpts}</select></label>
    <button id="gm-mobs" class="pixel-btn ghost">🗿 Mob DB</button>
    <button id="gm-proj" class="pixel-btn ghost">🎯 Projectiles</button>
    <span class="gm-hint">all trials unlocked · pick a Test class to fight with any style</span>
    <button id="gm-logout" class="pixel-btn ghost">exit GM</button>`;
  $('#gm-actas').onchange = (e)=>{ ME = e.target.value; localStorage.setItem('forge_crew_id',ME); renderHUD(); renderMap(); };
  $('#gm-class').onchange = (e)=>{ gmClass = e.target.value; localStorage.setItem('forge_gm_class', gmClass); sfx('click');
    toast(gmClass?`Test class: ${CL[gmClass].name} (${CL[gmClass].klass})`:'Class: profile default'); renderHUD(); };
  $('#gm-mobs').onclick = ()=>{ sfx('click'); openMobs(); };
  $('#gm-proj').onclick = ()=>{ sfx('click'); openProj(); };
  $('#gm-logout').onclick = logoutGM;
}

// ---- God Mode: Mob Database -------------------------------------------------
let mobEditId = null;                                          // id being edited (null = new)
let mobDraftSprite = null, mobDraftFrames = 4, genPrevTimer = null;   // pending sprite for the form
const CELL = 96;
// Green-screen style so the model gives us a background we can reliably key out (transparency from image models is unreliable).
const STYLE_PREAMBLE = "16-bit pixel-art game sprite, flat colors, bold clean black outline, single centered character, side view. CRITICAL: place the character on a SOLID FLAT chroma-key green background, hex #00FF00 — no gradients, no shadows, no lighting on the background. Add a thin white outline around the character so it separates cleanly from the green.";
const clampFrames = () => Math.max(1, Math.min(12, +($('#gen-frames').value) || 4));
function frameInstruction(n, mode){
  return mode === 'frames'
    ? ` Produce ${n} SEPARATE images, one per walk-cycle frame — the SAME character at the SAME size and ground line in every image.`
    : ` Output ONE horizontal strip of exactly ${n} evenly-spaced walk-cycle frames of the SAME character, same size and ground line, no gaps or borders.`;
}
function composePrompt(){ return `${$('#gen-style').value.trim()} ${$('#gen-prompt').value.trim()}.${frameInstruction(clampFrames(), $('#gen-mode').value)}`; }

// ---- Prompt generator: build a ready-to-paste, consistent prompt for Gemini Pro ----
async function copyPrompt(){
  if(!$('#gen-prompt').value.trim()){ $('#gen-status').textContent='Describe the creature first.'; return; }
  const full = composePrompt(); $('#gen-fullprompt').value = full;
  const mode = $('#gen-mode').value === 'frames' ? `download all ${clampFrames()} images` : 'download the strip image';
  try{ await navigator.clipboard.writeText(full); $('#gen-status').innerHTML=`<span class="ok">✓ Prompt copied. Paste into Gemini Pro, ${mode}, then Import below.</span>`; }
  catch{ $('#gen-fullprompt').select(); $('#gen-status').textContent='Prompt built below — copy it, paste into Gemini Pro, then Import.'; }
}

// ---- image processing: chroma-key green -> alpha, auto-crop to the character, center into equal cells, assemble a strip ----
function loadImg(src){ return new Promise((res, rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }
function chromaKeyCrop(src){
  const w=src.naturalWidth||src.width, h=src.naturalHeight||src.height;
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
  g.drawImage(src, 0, 0, w, h);
  const im=g.getImageData(0,0,w,h), d=im.data;
  for(let i=0;i<d.length;i+=4){ const r=d[i],gr=d[i+1],b=d[i+2]; if(gr>140 && r<140 && b<140 && gr>r*1.3 && gr>b*1.3) d[i+3]=0; }  // flat green -> transparent
  keepMainBlobs(d, w, h);                                                 // drop the Gemini ✨ watermark + stray specks
  let minx=w, miny=h, maxx=-1, maxy=-1;
  for(let p=0;p<w*h;p++){ if(d[p*4+3]>20){ const px=p%w, py=(p/w)|0; if(px<minx)minx=px; if(px>maxx)maxx=px; if(py<miny)miny=py; if(py>maxy)maxy=py; } }
  g.putImageData(im,0,0);
  if(maxx<minx){ const e=document.createElement('canvas'); e.width=1; e.height=1; return e; }   // nothing survived
  const cw=maxx-minx+1, ch=maxy-miny+1;
  const out=document.createElement('canvas'); out.width=cw; out.height=ch;
  out.getContext('2d').drawImage(c, minx,miny,cw,ch, 0,0,cw,ch);
  return out;
}
// Keep connected (8-way) opaque regions that are a real fraction of the biggest one; zero the rest.
// Removes the corner watermark and stray pixels while keeping detached-but-sizable bits (e.g. an extended sword).
function keepMainBlobs(d, w, h){
  const n=w*h, label=new Int32Array(n), stack=new Int32Array(n), sizes=[0]; let cur=0, best=0;
  for(let s=0;s<n;s++){
    if(label[s]!==0 || d[s*4+3]<=40) continue;
    cur++; let sp=0, size=0; stack[sp++]=s; label[s]=cur;
    while(sp>0){ const q=stack[--sp]; size++; const qx=q%w, qy=(q/w)|0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue;
        const nx=qx+dx, ny=qy+dy; if(nx<0||ny<0||nx>=w||ny>=h) continue;
        const r=ny*w+nx; if(label[r]===0 && d[r*4+3]>40){ label[r]=cur; stack[sp++]=r; } } }
    sizes[cur]=size; if(size>best) best=size;
  }
  if(!best) return; const thresh=Math.max(60, best*0.15);
  for(let p=0;p<n;p++){ const l=label[p]; if(l && sizes[l]<thresh) d[p*4+3]=0; }
}
function buildStrip(cells){
  const c=document.createElement('canvas'); c.width=CELL*cells.length; c.height=CELL; const g=c.getContext('2d');
  cells.forEach((cell,i)=>g.drawImage(cell, i*CELL, 0));
  return c.toDataURL('image/png');
}
// Assemble cropped frames on a SHARED scale + SHARED baseline (feet on the floor) so the walk doesn't bounce/rescale.
function assembleStrip(crops){
  const pad=Math.round(CELL*0.07), baseY=CELL-pad;
  let maxW=1, maxH=1; for(const c of crops){ maxW=Math.max(maxW,c.width); maxH=Math.max(maxH,c.height); }
  const scale=Math.min((CELL-2*pad)/maxH, CELL/maxW);
  const cells=crops.map(c=>{
    const cell=document.createElement('canvas'); cell.width=CELL; cell.height=CELL; const g=cell.getContext('2d');
    const dw=c.width*scale, dh=c.height*scale;
    g.drawImage(c, 0,0,c.width,c.height, (CELL-dw)/2, baseY-dh, dw, dh);   // horizontally centered, feet on the baseline
    return cell;
  });
  return buildStrip(cells);
}
async function stripFromOneImage(dataUrl, frames){    // one image (a strip) -> N keyed+cropped frames
  const img=await loadImg(dataUrl), fw=Math.max(1, Math.floor(img.width/frames)), crops=[];
  for(let i=0;i<frames;i++){
    const col=document.createElement('canvas'); col.width=fw; col.height=img.height;
    col.getContext('2d').drawImage(img, i*fw,0,fw,img.height, 0,0,fw,img.height);
    crops.push(chromaKeyCrop(col));
  }
  return { url: assembleStrip(crops), frames };
}
async function stripFromManyImages(dataUrls){         // N images -> one frame each
  const crops=[]; for(const u of dataUrls) crops.push(chromaKeyCrop(await loadImg(u)));
  return { url: assembleStrip(crops), frames: crops.length };
}
function setDraft(res){ mobDraftSprite=res.url; mobDraftFrames=res.frames; $('#gen-frames').value=res.frames; animatePreview(); }

// Read file(s) -> a normalized strip. 1 file = a strip (sliced by frame count); many files = one frame each.
function filesToStrip(files, frames){
  return Promise.all(files.map(f=>new Promise((r,j)=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.onerror=j; fr.readAsDataURL(f); })))
    .then(urls => urls.length>1 ? stripFromManyImages(urls) : stripFromOneImage(urls[0], frames));
}
function importFiles(fileList){
  const files=[...fileList]; if(!files.length) return;
  $('#gen-status').innerHTML='<span class="spinner"></span> keying + cropping image(s)…';
  filesToStrip(files, clampFrames())
    .then(res=>{ setDraft(res); $('#gen-status').innerHTML=`<span class="ok">✓ Imported ${res.frames} frame(s) — green removed + cropped. Save mob to keep it.</span>`; sfx('win'); })
    .catch(()=>{ $('#gen-status').innerHTML='<span class="lose">Could not read those image(s).</span>'; });
}

// Optional in-app generation with an API key (free tier or pay-as-you-go). Same green-screen prompt + processing.
async function generateSprite(){
  if(!hasGemKey()){ $('#gen-status').innerHTML='<span class="lose">No API key — use Import (make it in Gemini Pro), or add a key in 🔑.</span>'; return; }
  if(!$('#gen-prompt').value.trim()){ $('#gen-status').textContent='Describe the creature first.'; return; }
  const frames=clampFrames(), prompt=composePrompt(); $('#gen-fullprompt').value=prompt;
  $('#gen-status').innerHTML='<span class="spinner"></span> generating with Nano Banana…';
  let r; try{ r=await fetch('/api/admin/mobs/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:GM_CODE,key:getGemKey(),prompt})}).then(x=>x.json()); }
  catch{ $('#gen-status').innerHTML='<span class="lose">Network error reaching the server.</span>'; return; }
  if(!r.ok){ $('#gen-status').innerHTML=`<span class="lose">${esc(r.error||'Generation failed.')}</span>`; return; }
  setDraft(await stripFromOneImage(r.image, frames));
  $('#gen-status').innerHTML='<span class="ok">✓ Sprite ready — previews below. Save mob to keep it.</span>'; sfx('win');
}
function stopPreview(){ if(genPrevTimer){ clearInterval(genPrevTimer); genPrevTimer=null; } }
function animatePreview(){
  stopPreview(); const cv=$('#gen-preview'), g=cv.getContext('2d');
  if(!mobDraftSprite){ g.clearRect(0,0,cv.width,cv.height); return; }
  loadImg(mobDraftSprite).then(img=>{ const n=mobDraftFrames||1, fw=img.width/n; let fi=0;
    genPrevTimer=setInterval(()=>{ g.clearRect(0,0,cv.width,cv.height); g.drawImage(img, fi*fw,0,fw,img.height, 0,0,cv.width,cv.height); fi=(fi+1)%n; }, 130); });
}
function clearSprite(){ mobDraftSprite=null; stopPreview(); const cv=$('#gen-preview'); cv.getContext('2d').clearRect(0,0,cv.width,cv.height); $('#gen-status').textContent='Sprite removed (this mob will use the colored blob).'; }
function openMobs(){ if(!isGod()) return; mobEditId=null; renderMobs(); loadMobForm(null); $('#mobs-modal').classList.remove('hidden'); }
function renderMobs(){
  const all = allMobs();
  // roster list
  $('#mob-list').innerHTML = Object.entries(all).map(([id,m])=>{
    const tag = (m.base?'<span class="mob-base">base</span>':'<span class="mob-custom">custom</span>')+(m.sprite?' <span class="mob-spr">🎨</span>':'');
    const rng = m.ai==='shooter'?` · 🏹 ${m.shotSpd||180}spd/${m.shotCd||1.7}s`:' · 🗡️ melee';
    return `<div class="mobrow"><span class="mob-dot" style="background:${m.color}"></span>
      <b>${esc(m.name)}</b> <small>[${id}]</small> ${tag}
      <small>❤${m.hp} ⚔${m.atk} 👟${m.speed} ⌀${m.r}${rng}</small>
      <span class="mobrow-btns"><button class="pixel-btn ghost" data-medit="${id}">edit</button>${m.base?'':`<button class="pixel-btn ghost" data-mdel="${id}">✕</button>`}</span></div>`;
  }).join('') || '<div class="empty">No mobs.</div>';
  $('#mob-list').querySelectorAll('[data-medit]').forEach(b=>b.onclick=()=>loadMobForm(b.dataset.medit));
  $('#mob-list').querySelectorAll('[data-mdel]').forEach(b=>b.onclick=()=>deleteMob(b.dataset.mdel));
  // level assignments grid
  const ids = Object.keys(all);
  let lv = document.getElementById('mob-level-pick') ? +document.getElementById('mob-level-pick').value : 0;
  const levelOpts = Array.from({length:MAX_LEVEL+1},(_,i)=>`<option value="${i}" ${i===lv?'selected':''}>Level ${i}</option>`).join('');
  const assigned = (MOBS.levels&&MOBS.levels[lv])||[];
  $('#mob-levels').innerHTML = `<div class="mlv-top">Spawns at <select id="mob-level-pick">${levelOpts}</select>
    <small>(none checked = default: grunt+zap, brute from Lv4)</small></div>
    <div class="mlv-checks">${ids.map(id=>`<label class="mlv-check"><input type="checkbox" data-mlv="${id}" ${assigned.includes(id)?'checked':''}/> ${esc(all[id].name)}</label>`).join('')}</div>
    <button id="mob-level-save" class="pixel-btn">save Level ${lv} spawns</button>
    <div id="mob-warn" class="mob-warn"></div>`;
  $('#mob-level-pick').onchange = renderMobs;
  $('#mob-level-save').onclick = saveLevelAssign;
  // reflect the "always at least one ranged" rule for the picked level
  const checkedIds = assigned.length?assigned:(lv>=4?['grunt','zap','brute']:['grunt','zap']);
  const hasRanged = checkedIds.some(id=>all[id]&&all[id].ai==='shooter');
  $('#mob-warn').innerHTML = hasRanged?'' : '⚠ No ranged mob here — the game will still add a Zapper (every wave needs ≥1 ranged).';
}
function loadMobForm(id){
  const m = id ? allMobs()[id] : null; mobEditId = id||null;
  const g=(k,d)=>m&&m[k]!=null?m[k]:d;
  $('#mob-form-title').textContent = id?`Edit ${id}`:'New mob';
  $('#mf-id').value = id||''; $('#mf-id').disabled = !!id;
  $('#mf-name').value = g('name',''); $('#mf-hp').value=g('hp',20); $('#mf-atk').value=g('atk',8);
  $('#mf-speed').value=g('speed',70); $('#mf-r').value=g('r',13); $('#mf-color').value=g('color','#cc8855');
  $('#mf-ai').value=g('ai','chase'); $('#mf-shotcd').value=g('shotCd',1.7); $('#mf-shotspd').value=g('shotSpd',180);
  // projectile dropdown (shooter's shot art)
  const P=projList(), curProj=g('proj','');
  $('#mf-proj').innerHTML = `<option value="">default orb</option>`+Object.entries(P).map(([id,p])=>`<option value="${id}" ${id===curProj?'selected':''}>${esc(p.name)}</option>`).join('');
  toggleShooterFields();
  // sprite / generation fields
  if(!$('#gen-style').value.trim()) $('#gen-style').value = STYLE_PREAMBLE;
  mobDraftSprite = g('sprite', null); mobDraftFrames = g('frames', 4);
  $('#gen-frames').value = mobDraftFrames;
  $('#gen-status').textContent = mobDraftSprite ? 'This mob has a sprite (preview below).' : '';
  animatePreview();
}
function toggleShooterFields(){ $('#mf-shooter').style.display = $('#mf-ai').value==='shooter'?'':'none'; }
async function saveMob(){
  const mob = { id:$('#mf-id').value.trim(), name:$('#mf-name').value.trim(), hp:$('#mf-hp').value, atk:$('#mf-atk').value,
    speed:$('#mf-speed').value, r:$('#mf-r').value, color:$('#mf-color').value, ai:$('#mf-ai').value,
    shotCd:$('#mf-shotcd').value, shotSpd:$('#mf-shotspd').value };
  if(mobDraftSprite){ mob.sprite = mobDraftSprite; mob.frames = mobDraftFrames; }
  if($('#mf-proj').value) mob.proj = $('#mf-proj').value;
  if(!mob.id){ alert('Give the mob an id (letters/numbers).'); return; }
  const r = await fetch('/api/admin/mobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:GM_CODE,mob})}).then(x=>x.json()).catch(()=>({error:'network'}));
  if(r.error){ alert(r.error); return; }
  applyCfg(r); sfx('win'); toast(`🗿 Saved mob "${r.id}"`); mobEditId=null; loadMobForm(null); renderMobs();
}
async function deleteMob(id){
  if(!confirm(`Delete custom mob "${id}"?`)) return;
  const r = await fetch('/api/admin/mobs/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:GM_CODE,id})}).then(x=>x.json()).catch(()=>({error:'network'}));
  if(r.error){ alert(r.error); return; }
  applyCfg(r); sfx('click'); toast(`Deleted "${id}"`); renderMobs();
}
async function saveLevelAssign(){
  const lv = +$('#mob-level-pick').value;
  const mobIds = Array.from(document.querySelectorAll('[data-mlv]')).filter(c=>c.checked).map(c=>c.dataset.mlv);
  const r = await fetch('/api/admin/mobs/levels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:GM_CODE,level:lv,mobIds})}).then(x=>x.json()).catch(()=>({error:'network'}));
  if(r.error){ alert(r.error); return; }
  applyCfg(r); sfx('win'); toast(`Level ${lv} spawns saved`); renderMobs();
}

// ---- God Mode: Projectiles (shared set, sprite art via same pipeline) -------
let projEditId=null, projDraftSprite=null, projDraftFrames=1, projPrevTimer=null;
function projList(){ return MOBS.projectiles || {}; }
function openProj(){ if(!isGod()) return; projEditId=null; renderProj(); loadProjForm(null); $('#proj-modal').classList.remove('hidden'); }
function renderProj(){
  const P=projList();
  $('#proj-list').innerHTML = Object.entries(P).map(([id,p])=>`<div class="mobrow">
    <b>${esc(p.name)}</b> <small>[${id}]</small> ${p.sprite?'<span class="mob-spr">🎨</span>':'<span class="mob-custom">no art</span>'}
    <small>${p.spin?'🌀 spin':'➤ directional'} · ${p.size||16}px · ${p.frames||1}f</small>
    <span class="mobrow-btns"><button class="pixel-btn ghost" data-pedit="${id}">edit</button><button class="pixel-btn ghost" data-pdel="${id}">✕</button></span></div>`).join('') || '<div class="empty">No projectiles yet — make one on the right.</div>';
  $('#proj-list').querySelectorAll('[data-pedit]').forEach(b=>b.onclick=()=>loadProjForm(b.dataset.pedit));
  $('#proj-list').querySelectorAll('[data-pdel]').forEach(b=>b.onclick=()=>deleteProj(b.dataset.pdel));
  // hero class shots
  const CL=window.BATTLE.CLASSES, cp=MOBS.classProjectiles||{};
  const optsFor=(sel)=>`<option value="">— default orb —</option>`+Object.keys(P).map(id=>`<option value="${id}" ${sel===id?'selected':''}>${esc(P[id].name)}</option>`).join('');
  $('#proj-classes').innerHTML = Object.entries(CL).map(([cid,c])=>`<label class="mlv-check">${esc(c.name)} <select data-classproj="${cid}">${optsFor(cp[cid]||'')}</select></label>`).join('');
  $('#proj-classes').querySelectorAll('[data-classproj]').forEach(s=>s.onchange=()=>assignClassProj(s.dataset.classproj, s.value));
}
function loadProjForm(id){
  const P=projList(), p=id?P[id]:null; projEditId=id||null; const g=(k,d)=>p&&p[k]!=null?p[k]:d;
  $('#proj-form-title').textContent=id?`Edit ${id}`:'New projectile';
  $('#pf-id').value=id||''; $('#pf-id').disabled=!!id;
  $('#pf-name').value=g('name',''); $('#pf-size').value=g('size',18); $('#pf-spin').checked=!!g('spin',false);
  if(!$('#pgen-style').value.trim()) $('#pgen-style').value=STYLE_PREAMBLE;
  projDraftSprite=g('sprite',null); projDraftFrames=g('frames',1); $('#pgen-frames').value=projDraftFrames;
  $('#pgen-status').textContent = projDraftSprite?'This projectile has art (preview below).':''; projAnimatePreview();
}
async function saveProj(){
  const proj={ id:$('#pf-id').value.trim(), name:$('#pf-name').value.trim(), size:$('#pf-size').value, spin:$('#pf-spin').checked, frames:projDraftFrames };
  if(projDraftSprite) proj.sprite=projDraftSprite;
  if(!proj.id){ alert('Give the projectile an id (letters/numbers).'); return; }
  const r=await fetch('/api/admin/projectiles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:GM_CODE,proj})}).then(x=>x.json()).catch(()=>({error:'network'}));
  if(r.error){ alert(r.error); return; }
  applyCfg(r); sfx('win'); toast(`🎯 Saved projectile "${r.id}"`); projEditId=null; loadProjForm(null); renderProj();
}
async function deleteProj(id){
  if(!confirm(`Delete projectile "${id}"? (mobs/classes using it revert to the orb)`)) return;
  const r=await fetch('/api/admin/projectiles/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:GM_CODE,id})}).then(x=>x.json()).catch(()=>({error:'network'}));
  if(r.error){ alert(r.error); return; }
  applyCfg(r); sfx('click'); toast(`Deleted "${id}"`); renderProj();
}
async function assignClassProj(classId, projId){
  const r=await fetch('/api/admin/projectiles/classassign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:GM_CODE,classId,projId})}).then(x=>x.json()).catch(()=>({error:'network'}));
  if(r.error){ alert(r.error); return; }
  applyCfg(r); sfx('click'); toast(`${window.BATTLE.CLASSES[classId].name} shot updated`);
}
// projectile sprite studio (own DOM prefix pgen-, shares the processing pipeline)
const pgFrames=()=>Math.max(1,Math.min(12,+($('#pgen-frames').value)||1));
function pgCompose(){ return `${$('#pgen-style').value.trim()} ${$('#pgen-prompt').value.trim()}.${frameInstruction(pgFrames(), $('#pgen-mode').value)}`; }
async function pgCopy(){
  if(!$('#pgen-prompt').value.trim()){ $('#pgen-status').textContent='Describe the projectile first.'; return; }
  const full=pgCompose(); $('#pgen-fullprompt').value=full;
  try{ await navigator.clipboard.writeText(full); $('#pgen-status').innerHTML='<span class="ok">✓ Prompt copied. Make it in Gemini Pro, then Import.</span>'; }
  catch{ $('#pgen-fullprompt').select(); $('#pgen-status').textContent='Prompt built below — copy it into Gemini Pro, then Import.'; }
}
function pgImport(fileList){
  const files=[...fileList]; if(!files.length) return;
  $('#pgen-status').innerHTML='<span class="spinner"></span> keying + cropping…';
  filesToStrip(files, pgFrames()).then(res=>{ projDraftSprite=res.url; projDraftFrames=res.frames; $('#pgen-frames').value=res.frames; projAnimatePreview();
    $('#pgen-status').innerHTML=`<span class="ok">✓ Imported ${res.frames} frame(s). Save projectile to keep it.</span>`; sfx('win'); })
    .catch(()=>{ $('#pgen-status').innerHTML='<span class="lose">Could not read those image(s).</span>'; });
}
async function pgGenerate(){
  if(!hasGemKey()){ $('#pgen-status').innerHTML='<span class="lose">No API key — use Import, or add a key in 🔑.</span>'; return; }
  if(!$('#pgen-prompt').value.trim()){ $('#pgen-status').textContent='Describe the projectile first.'; return; }
  const frames=pgFrames(), prompt=pgCompose(); $('#pgen-fullprompt').value=prompt;
  $('#pgen-status').innerHTML='<span class="spinner"></span> generating…';
  let r; try{ r=await fetch('/api/admin/mobs/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:GM_CODE,key:getGemKey(),prompt})}).then(x=>x.json()); }
  catch{ $('#pgen-status').innerHTML='<span class="lose">Network error.</span>'; return; }
  if(!r.ok){ $('#pgen-status').innerHTML=`<span class="lose">${esc(r.error||'Generation failed.')}</span>`; return; }
  const res=await stripFromOneImage(r.image, frames); projDraftSprite=res.url; projDraftFrames=res.frames; $('#pgen-frames').value=res.frames; projAnimatePreview();
  $('#pgen-status').innerHTML='<span class="ok">✓ Art ready — previews below. Save projectile.</span>'; sfx('win');
}
function projStopPreview(){ if(projPrevTimer){ clearInterval(projPrevTimer); projPrevTimer=null; } }
function projAnimatePreview(){
  projStopPreview(); const cv=$('#pgen-preview'), g=cv.getContext('2d');
  if(!projDraftSprite){ g.clearRect(0,0,cv.width,cv.height); return; }
  loadImg(projDraftSprite).then(img=>{ const n=projDraftFrames||1, fw=img.width/n; let fi=0;
    projPrevTimer=setInterval(()=>{ g.clearRect(0,0,cv.width,cv.height); g.drawImage(img, fi*fw,0,fw,img.height, 0,0,cv.width,cv.height); fi=(fi+1)%n; }, 130); });
}
function projClear(){ projDraftSprite=null; projStopPreview(); $('#pgen-preview').getContext('2d').clearRect(0,0,96,96); $('#pgen-status').textContent='Art removed (this projectile uses the default orb).'; }

// ---- character / inventory (gear affects battle stats) ----
function battleClass(){
  if(isGod() && gmClass && window.BATTLE.CLASSES[gmClass]) return gmClass;   // God Mode class-style override (test any class)
  return (ME && ME!=='gm') ? ME : 'zeppelin';
}
function profileOf(id){ const p = STATE.crew[id]?.steps?.__profile; return { inventory:(p&&p.inventory)||[], equipped:(p&&p.equipped)||{}, battles:(p&&p.battles)||{}, gold:(p&&p.gold)||0, levels:(p&&p.levels)||{}, bonusHearts:(p&&p.bonusHearts)||0 }; }
function computeStats(id){
  const B=window.BATTLE, base={...B.CLASSES[battleClass()].base}, prof=profileOf(id);
  for(const slot in prof.equipped){ const iid=prof.equipped[slot]; if(!B.GEAR[iid])continue; const mods=B.itemMods(iid,(prof.levels[iid])||0); for(const k in mods) base[k]=(base[k]||0)+mods[k]; }
  return base;
}
function renderGear(){
  const G=window.BATTLE.GEAR, TC=window.BATTLE.TIER_COLOR, c=crewById(ME);
  $('#gear-name').textContent = `${c.name} — ${window.BATTLE.CLASSES[battleClass()].klass}`;
  const prof=profileOf(ME), st=computeStats(ME);
  const slots=['weapon','armor','trinket'];
  const slotHtml = slots.map(s=>{ const id=prof.equipped[s]; const g=id&&G[id]; const lv=(id&&prof.levels[id])||0;
    return `<div class="slot"><span class="slot-name">${s}</span>${g?`<button class="item on" data-uneq="${s}" style="border-color:${TC[g.tier]};color:${TC[g.tier]}">${g.name}${lv?` +${lv}`:''} ✕</button>`:`<span class="empty">— empty —</span>`}</div>`; }).join('');
  // inventory grouped by id with counts, excluding equipped
  const counts={}; prof.inventory.forEach(id=>counts[id]=(counts[id]||0)+1);
  const rawCounts={...counts};                          // all copies (incl equipped) — for upgrade checks
  Object.values(prof.equipped).forEach(id=>{ if(counts[id]) counts[id]--; });
  const order=['Mythic','Legendary','Rare','Common'];
  const invHtml = Object.entries(counts).filter(([id,n])=>n>0&&G[id]).sort((a,b)=>order.indexOf(G[a[0]].tier)-order.indexOf(G[b[0]].tier))
    .map(([id,n])=>{ const B=window.BATTLE, g=G[id]; const locked=g.klass&&g.klass!==ME&&ME!=='via'; const lvl=prof.levels[id]||0;
      const mods=Object.entries(B.itemMods(id,lvl)).map(([k,v])=>`${k}+${v}`).join(' '); const sv=B.SCRAP_VALUE[g.tier];
      let upBtn=''; const tier=B.UPGRADE[id];
      if(tier){ const can=(rawCounts[id]>=tier.need)&&((prof.gold||0)>=tier.gold);
        upBtn=`<button class="upg" data-upg="${id}" ${can?'':'disabled'} title="combine ${tier.need}× + ${tier.gold}g → ${G[tier.to].name}">⬆ ${tier.need}×+${tier.gold}g</button>`; }
      else if(g.tier==='Legendary'){
        if(lvl>=B.LEG_MAX_LEVEL){ upBtn=`<button class="upg" disabled>MAX Lv</button>`; }
        else { const fod=B.RARE_OF_SLOT[g.slot], need=B.LEG_FODDER_NEED, cost=B.legLevelGold(lvl);
          const can=(rawCounts[fod]>=need)&&((prof.gold||0)>=cost);
          upBtn=`<button class="upg" data-upg="${id}" ${can?'':'disabled'} title="level up: ${need}× ${G[fod].name} + ${cost}g">⬆ Lv${lvl+1} (${need}× rare +${cost}g)</button>`; } }
      const nm=`${g.name}${lvl?` +${lvl}`:''}`;
      return `<div class="invrow"><button class="item" ${locked?'disabled':`data-eq="${id}" data-slot="${g.slot}"`} style="border-color:${TC[g.tier]};color:${TC[g.tier]}">${nm}${n>1?` ×${n}`:''} <small>[${g.slot} · ${mods}]</small>${locked?' 🔒':''}</button>${upBtn}${sv?`<button class="scrap" data-scrap="${id}" title="scrap for gold">♻ ${sv}g</button>`:''}</div>`; }).join('') || '<div class="empty">No gear yet — win battles to loot some.</div>';
  $('#gear-body').innerHTML = `
    <div class="statgrid">
      <div>❤ Hearts <b>${Math.max(3,Math.round(st.hp/22))+(prof.bonusHearts||0)}</b>${prof.bonusHearts?` <small>(+${prof.bonusHearts} boss)</small>`:''}</div><div>⚔ Attack <b>${st.atk}</b></div>
      <div>🛡 Armor <b>${st.armor||0}</b></div><div>👟 Speed <b>${st.speed}</b></div>
      <div>🎯 Hit <b>${Math.round(((st.hit||0))*100)}%</b></div><div>🗡️ vs dodge</div>
    </div>
    <div class="goldline">💰 <b>${prof.gold||0}</b> gold <button id="sell-all" class="pixel-btn ghost">Sell all junk</button></div>
    <h3 class="sub">Equipped</h3>${slotHtml}
    <h3 class="sub">Inventory <small>(tap gear to equip · ⬆ combine · ♻ scrap)</small></h3><div class="invlist">${invHtml}</div>`;
  $('#gear-body').querySelectorAll('[data-eq]').forEach(b=>b.onclick=()=>equip(b.dataset.slot,b.dataset.eq));
  $('#gear-body').querySelectorAll('[data-uneq]').forEach(b=>b.onclick=()=>equip(b.dataset.uneq,null));
  $('#gear-body').querySelectorAll('[data-scrap]').forEach(b=>b.onclick=()=>scrap(b.dataset.scrap));
  $('#gear-body').querySelectorAll('[data-upg]').forEach(b=>b.onclick=()=>upgrade(b.dataset.upg));
  $('#sell-all').onclick=sellAll;
}
async function sellAll(){
  if(!confirm('Sell ALL unequipped, non-Mythic gear for gold? (keeps equipped gear and Mythics)')) return;
  const d=await fetch('/api/profile/sellall',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({crewId:ME})}).then(r=>r.json());
  if(d.error){ alert(d.error); return; }
  STATE=d.state; sfx('click'); toast(d.sold?`♻ Sold ${d.sold} for ${d.gained} gold`:'Nothing to sell'); renderGear(); renderHUD();
}
async function upgrade(id){
  const B=window.BATTLE, G=B.GEAR, g=G[id]; let msg;
  if(B.UPGRADE[id]){ const r=B.UPGRADE[id]; msg=`Combine ${r.need}× ${g.name} + ${r.gold} gold into ${G[r.to].name}?`; }
  else { const lvl=profileOf(ME).levels[id]||0, fod=B.RARE_OF_SLOT[g.slot]; msg=`Level ${g.name} to +${lvl+1}?  Costs ${B.LEG_FODDER_NEED}× ${G[fod].name} + ${B.legLevelGold(lvl)} gold.`; }
  if(!confirm(msg)) return;
  const d=await fetch('/api/profile/upgrade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({crewId:ME,itemId:id})}).then(x=>x.json());
  if(d.error){ alert(d.error); return; }
  STATE=d.state; sfx('crit'); toast(d.made?`⬆ Forged ${G[d.made].name}!`:`⬆ ${g.name} → +${d.level}!`); renderGear(); renderHUD();
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
  window.ForgeBattle.start({ classId: battleClass(), questIndex: qi, equipped: prof.equipped, levels: prof.levels, hasMythic, bonusHearts: prof.bonusHearts,
    onWin: async (res)=>{
      const d=await fetch('/api/battle/win',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({crewId:ME,questId:'train'+qi,xp:res.xp,loot:res.loot})}).then(r=>r.json());
      if(d.state) STATE=d.state; if(d.gotHeart) toast(`❤ Permanent heart! Max hearts now ${d.bonusHearts} higher.`); renderHUD(); renderMap();
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
  window.ForgeBattle.start({ classId: battleClass(), questIndex: idx, equipped: prof.equipped, levels: prof.levels, dialog, hasMythic, bonusHearts: prof.bonusHearts,
    onWin: async (res)=>{                                // persist loot so it's equippable on the victory screen
      const d = await fetch('/api/battle/win',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({crewId:ME,questId:qid,xp:res.xp,loot:res.loot})}).then(r=>r.json());
      if(d.state) STATE=d.state; if(d.gotHeart) toast(`❤ Permanent heart earned! (+${d.bonusHearts} total)`); renderHUD(); renderMap();
    },
    onContinue: (res)=>{ startMusic(); toast(`⚔ Battle won! +${res.xp} XP · ${res.loot.length} loot`); openQuest(qid); },
    onInventory: (resume)=>openInventoryOverlay(resume),
    onExit: ()=>{ startMusic(); renderMap(); } });
}
let pendingBattleResume=null;
function openInventoryOverlay(resume){ pendingBattleResume = resume || null; renderGear(); $('#gear-modal').classList.remove('hidden'); }
function closeGear(){ $('#gear-modal').classList.add('hidden'); if(pendingBattleResume){ const r=pendingBattleResume; pendingBattleResume=null; r(profileOf(ME).equipped, profileOf(ME).levels); } }

// ---- battle keybinds (PC) ----
const KEY_DEFAULTS={up:'w',down:'s',left:'a',right:'d',attack:'j',dodge:'k'};
function getKeys(){ try{ return Object.assign({},KEY_DEFAULTS,JSON.parse(localStorage.getItem('forge_keys')||'{}')); }catch{ return {...KEY_DEFAULTS}; } }
let rebinding=null;
function renderKeys(){
  const k=getKeys(), rows=[['up','Move Up'],['down','Move Down'],['left','Move Left'],['right','Move Right'],['attack','Attack'],['dodge','Block / Dodge']];
  $('#keys-body').innerHTML=rows.map(([id,label])=>`<div class="keyrow"><span>${label}</span><button class="keybtn" data-key="${id}">${(k[id]||'').toUpperCase()}</button></div>`).join('');
  $('#keys-body').querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{ rebinding=b.dataset.key;
    $('#keys-body').querySelectorAll('.keybtn').forEach(x=>x.classList.remove('await')); b.classList.add('await'); b.textContent='press…'; });
}
function openKeys(){ rebinding=null; renderKeys(); $('#keys-modal').classList.remove('hidden'); }

// ---- Bring-your-own Gemini key (real AI grading). Stored per-device in localStorage,
// sent with each grade request, never persisted on the server or shared with other players.
function getGemKey(){ return localStorage.getItem('forge_gemini_key') || ''; }
function hasGemKey(){ return !!getGemKey().trim(); }
function openApiKey(){
  const inp=$('#apikey-input'); inp.value=getGemKey(); inp.type='password';
  $('#apikey-status').innerHTML = hasGemKey() ? '<span class="ok">✓ a key is saved on this device</span>' : 'No key yet — answers use the offline grader.';
  $('#apikey-modal').classList.remove('hidden');
}
async function saveAndTestKey(){
  const key=$('#apikey-input').value.trim(); const st=$('#apikey-status');
  if(!key){ st.textContent='Paste a key first (starts with AIza…).'; return; }
  localStorage.setItem('forge_gemini_key', key);
  st.innerHTML='<span class="spinner"></span> testing your key…';
  try{
    const r=await fetch('/api/verify-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})}).then(x=>x.json());
    if(r.ok){ st.innerHTML='<span class="ok">🎉 Working! Your answers now get real AI grading.</span>'; sfx('win'); }
    else if(r.status===429 && r.limit==='perMinute'){ const w=r.retryDelay?`~${r.retryDelay}`:'about a minute'; st.innerHTML=`<span class="warn">✓ Your key is valid — you just tested too fast. Wait ${w} and it'll grade fine. (Your saved.)</span>`; }
    else if(r.status===429){ st.innerHTML='<span class="warn">✓ Your key is valid, but its free DAILY limit is used up — resets ~midnight Pacific. It\'s saved; grading works again after the reset.</span>'; }
    else { st.innerHTML=`<span class="lose">That key didn't work${r.status?` (HTTP ${r.status})`:''}. Re-copy it with the copy button and try again.</span>`; }
  }catch(e){ st.innerHTML='<span class="lose">Couldn\'t reach the server to test. Saved anyway — try grading a step.</span>'; }
  updateKeyNudge();
}
function clearKey(){ localStorage.removeItem('forge_gemini_key'); $('#apikey-input').value=''; $('#apikey-status').textContent='Key removed. Answers use the offline grader until you add one.'; updateKeyNudge(); }
function updateKeyNudge(){ const b=$('#btn-apikey'); if(b) b.textContent = hasGemKey() ? '🔑' : '🔑❗'; }

function wireChrome(){
  $('#btn-gm').onclick = ()=>{ initAudio(); loginGM(); };
  $('#btn-keys').onclick = ()=>{ sfx('click'); openKeys(); };
  $('#keys-reset').onclick = ()=>{ localStorage.removeItem('forge_keys'); renderKeys(); };
  $('#mf-save').onclick = ()=>{ sfx('click'); saveMob(); };
  $('#mf-new').onclick = ()=>{ loadMobForm(null); };
  $('#mf-ai').onchange = ()=> toggleShooterFields();
  $('#gen-copy').onclick = ()=>{ sfx('click'); copyPrompt(); };
  $('#gen-files').onchange = (e)=>{ importFiles(e.target.files); e.target.value=''; };
  $('#gen-run').onclick = ()=>{ sfx('click'); generateSprite(); };
  $('#gen-clear').onclick = ()=>{ sfx('click'); clearSprite(); };
  $('#mobs-modal').addEventListener('click', e=>{ if(e.target.matches('[data-close]')||e.target===$('#mobs-modal')) stopPreview(); });
  $('#pf-save').onclick = ()=>{ sfx('click'); saveProj(); };
  $('#pf-new').onclick = ()=>{ loadProjForm(null); };
  $('#pgen-copy').onclick = ()=>{ sfx('click'); pgCopy(); };
  $('#pgen-files').onchange = (e)=>{ pgImport(e.target.files); e.target.value=''; };
  $('#pgen-run').onclick = ()=>{ sfx('click'); pgGenerate(); };
  $('#pgen-clear').onclick = ()=>{ sfx('click'); projClear(); };
  $('#proj-modal').addEventListener('click', e=>{ if(e.target.matches('[data-close]')||e.target===$('#proj-modal')) projStopPreview(); });
  $('#btn-apikey').onclick = ()=>{ sfx('click'); openApiKey(); };
  $('#apikey-save').onclick = ()=>{ sfx('click'); saveAndTestKey(); };
  $('#apikey-clear').onclick = ()=>{ sfx('click'); clearKey(); };
  $('#apikey-show').onclick = ()=>{ const i=$('#apikey-input'); i.type = i.type==='password'?'text':'password'; };
  updateKeyNudge();
  window.addEventListener('keydown',(e)=>{ if(!rebinding)return; e.preventDefault(); const key=e.key.toLowerCase();
    if(key.length===1 && key!==' '){ const k=getKeys(); k[rebinding]=key; localStorage.setItem('forge_keys',JSON.stringify(k)); }
    rebinding=null; renderKeys(); });
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
  if(!hasGemKey() && !isGod()){
    const kn = document.createElement('div'); kn.className='keynote';
    kn.innerHTML = `🔑 No AI key yet — your answers use a basic offline grader. <button class="pixel-btn ghost knbtn">Add your key for real grading</button>`;
    kn.querySelector('.knbtn').onclick = ()=>{ openApiKey(); };
    box.appendChild(kn);
  }
  q.steps.forEach(step=>box.appendChild(renderStep(step)));
  $('#quest-modal').classList.remove('hidden');
}

function renderStep(step){
  const prev = stepState(ME, step.id);
  const el = document.createElement('div'); el.className='step';
  const teach = Array.isArray(step.teach) ? step.teach : (step.teach ? [step.teach] : []);
  el.innerHTML = `<div class="st-top"><span class="st-title">⚔️ ${step.title}</span><span class="st-xp">+${step.xp} XP</span></div>
    ${teach.length?`<div class="teach"><div class="teach-h">📖 Lesson</div><ul>${teach.map(t=>`<li>${fmtInline(t)}</li>`).join('')}</ul></div>`:''}
    <div class="prompt"><div class="prompt-h">✍️ Your task</div>${esc(step.prompt)}</div>
    ${step.check?`<div class="check">🎯 <b>Pass when:</b> ${fmtInline(step.check)}</div>`:''}
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

  // Persist written answers locally so you can reopen a lesson and pick up where you left off,
  // even if you never submitted. A saved local draft wins over the last graded response.
  const dkey = `forge_draft_${ME}_${step.id}`;
  try{ const draft = localStorage.getItem(dkey); if(draft!=null && draft!=='') ta.value = draft; }catch{}
  ta.addEventListener('input', ()=>{ try{ localStorage.setItem(dkey, ta.value); }catch{} });

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
        body:JSON.stringify({crewId:ME,stepId:step.id,response,userKey:getGemKey()})}).then(r=>r.json());
      STATE = data.state;
      slot.innerHTML=''; slot.appendChild(gradeCard(data.result));
      const r=data.result;
      // Cooldown isn't a grade and isn't a key problem — show the note and leave everything else alone.
      if(r.cooldown){ sfx('click'); toast('⏳ Slow down a sec — that saves your AI credits.'); btn.textContent=lbl; return; }
      // Same answer as last time: this is the saved grade replayed, so no API call and no XP re-burst.
      if(r.cached){ btn.textContent = r.passed?'⚒ RE-ATTEMPT':'⚔ ATTEMPT';
        toast('↩ Same answer — showing your saved grade (no AI credits used).'); renderHUD(); renderMap(); return; }
      if(r.offline){ const bk=$('#btn-apikey'); if(bk) bk.textContent='🔑❗'; toast('⚠ Graded offline — real AI grading didn\'t run. Tap 🔑 to re-test your key.'); }
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
// Lesson text formatter: escape first, then allow **bold** and `code`. Safe (no raw HTML from content).
function fmtInline(s){ return esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`([^`]+?)`/g,'<code>$1</code>'); }

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
