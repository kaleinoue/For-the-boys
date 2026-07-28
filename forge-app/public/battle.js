// ================= THE FORGE — Battle engine (canvas, mobile-first) =================
// window.ForgeBattle.start({ classId, questIndex, dialog?, equipped?, onWin, onExit })
// onWin({ xp, loot:[itemId,...] })   onExit() when the player flees a defeat.
(function () {
  const B = window.BATTLE;
  const HEART = 20;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ---- mob sprite cache: lazily decode data-URL sprite strips, reused across battles ----
  const SPRITE_CACHE = {};
  function spriteImg(def) {
    if (!def || !def.sprite) return null;
    let im = SPRITE_CACHE[def.sprite];
    if (!im) { im = new Image(); im.src = def.sprite; SPRITE_CACHE[def.sprite] = im; }
    return (im.complete && im.naturalWidth) ? im : null;
  }

  // ---- battle sound effects (WebAudio; respects the app's 🔊 mute) ----
  let BAC = null;
  function bAudio() { if (!BAC) { try { BAC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (BAC && BAC.state === 'suspended') BAC.resume(); return BAC; }
  const muted = () => { try { return localStorage.getItem('forge_muted') === '1'; } catch { return false; } };
  function bTone(freq, dur, type, vol, when, slideTo) { const ac = bAudio(); if (!ac || muted()) return; const t = ac.currentTime + (when || 0); const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur); o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.start(t); o.stop(t + dur); }
  function bNoise(dur, vol, when) { const ac = bAudio(); if (!ac || muted()) return; const t = ac.currentTime + (when || 0); const len = Math.max(1, Math.floor(ac.sampleRate * dur)); const buf = ac.createBuffer(1, len, ac.sampleRate); const dta = buf.getChannelData(0); for (let i = 0; i < len; i++) dta[i] = Math.random() * 2 - 1; const n = ac.createBufferSource(); n.buffer = buf; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 700; const g = ac.createGain(); n.connect(f); f.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); n.start(t); n.stop(t + dur); }
  function bSfx(kind) {
    if (kind === 'deal') { bTone(720, .08, 'square', .08, 0, 200); }                        // DEAL damage: bright zap
    else if (kind === 'hurt') { bTone(150, .22, 'sawtooth', .13, 0, 55); bNoise(.12, .05); } // TAKE damage: low thud + crunch
    else if (kind === 'attack') { bNoise(.05, .022); bTone(320, .06, 'triangle', .03); }     // swing
    else if (kind === 'pickup') { bTone(660, .07, 'square', .06); bTone(990, .08, 'square', .05, .07); }
    else if (kind === 'heal') { bTone(520, .1, 'sine', .06); bTone(780, .12, 'sine', .05, .08); }
    else if (kind === 'win') { [523, 659, 784, 1047].forEach((f, i) => bTone(f, .14, 'square', .07, i * .09)); }
    else if (kind === 'lose') { bTone(300, .3, 'sawtooth', .09, 0, 90); }
    else if (kind === 'boss') { bTone(90, .45, 'sawtooth', .1, 0, 60); }
    else if (kind === 'shot') { bTone(470, .09, 'sine', .035, 0, 300); }
  }

  function statsFor(classId, equipped, levels) {
    const c = B.CLASSES[classId]; const s = { ...c.base };
    for (const slot in (equipped || {})) { const id = equipped[slot]; if (!B.GEAR[id]) continue; const mods = B.itemMods(id, (levels && levels[id]) || 0); for (const k in mods) s[k] = (s[k] || 0) + mods[k]; }
    return s;
  }

  function start(opts) {
    const cls = B.CLASSES[opts.classId] || B.CLASSES.zeppelin;
    const plan = B.battlePlan(opts.questIndex || 0);
    const dialog = (opts.dialog && opts.dialog.length ? opts.dialog : B.GENERIC_DIALOG).slice();
    let stats = statsFor(opts.classId, opts.equipped, opts.levels);
    const DK = { up: 'w', down: 's', left: 'a', right: 'd', attack: 'j', dodge: 'k' };
    let KEYS = DK; try { KEYS = Object.assign({}, DK, JSON.parse(localStorage.getItem('forge_keys') || '{}')); } catch {}

    // ---- build DOM ----
    let root = document.getElementById('battle-root');
    if (!root) { root = document.createElement('div'); root.id = 'battle-root'; document.body.appendChild(root); }
    root.innerHTML = `
      <canvas id="battle-canvas"></canvas>
      <div class="b-hud"><button class="b-quit" title="end battle">✕ END</button><button class="b-inv">🎒</button><span class="b-wave"></span></div>
      <div class="b-boss-wrap"><div class="b-boss-fill"></div></div>
      <div class="b-keys"></div>
      <div class="b-toast"></div>
      <div class="b-stick"><div class="nub"></div></div>
      <div class="b-btns"><button class="b-btn atk">ATK</button><button class="b-btn dodge">${cls.dodge === 'block' ? 'BLOCK' : 'DODGE'}</button></div>
      <div class="b-dialog"><div class="box"><div class="who">▸ THE FORGE</div><div class="line"></div><div class="tap">tap to continue ▸</div></div></div>
      <div class="b-overlay"><div><h2></h2><div class="b-loot"></div><div class="b-endbtns"><button class="eq">🎒 EQUIP</button><button class="cta"></button></div></div></div>`;
    root.classList.add('on');
    const cv = root.querySelector('#battle-canvas'), ctx = cv.getContext('2d');
    const waveEl = root.querySelector('.b-wave');
    const bossWrap = root.querySelector('.b-boss-wrap'), bossFill = root.querySelector('.b-boss-fill');
    const dlg = root.querySelector('.b-dialog'), dlgLine = dlg.querySelector('.line');
    const overlay = root.querySelector('.b-overlay'), overH2 = overlay.querySelector('h2'), lootEl = overlay.querySelector('.b-loot'), cta = overlay.querySelector('.cta');
    const toast = root.querySelector('.b-toast');
    const invBtn = root.querySelector('.b-inv'), eqBtn = overlay.querySelector('.eq'), quitBtn = root.querySelector('.b-quit');

    let W = 0, H = 0, DPR = Math.min(2, window.devicePixelRatio || 1);
    let T = null, ready = false;                    // T = this level's terrain (see terrain.js)
    function resize() {
      W = root.clientWidth; H = root.clientHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      T = window.ForgeTerrain.build(plan.level, W, H);
      if (!ready) return;                            // first call runs before the fighters exist
      T.move(player, player.x, player.y, player.r);  // re-seat everyone in the rebuilt world
      for (const e of enemies) T.move(e, e.x, e.y, e.r);
      for (const l of loot) { const s = T.freeSpot(l.x, l.y, l.r); l.x = s.x; l.y = s.y; }
    }
    resize(); window.addEventListener('resize', resize);

    // On desktop (no touch), show a controls hint at the start; it auto-hides.
    if (!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) {
      const kh = root.querySelector('.b-keys');
      kh.textContent = `⌨  Move: ${(KEYS.up + KEYS.left + KEYS.down + KEYS.right).toUpperCase()} / Arrows   ·   Attack: ${KEYS.attack.toUpperCase()} or Space   ·   ${cls.dodge === 'block' ? 'Block' : 'Dodge'}: ${KEYS.dodge.toUpperCase()} or Shift`;
      kh.classList.add('on'); setTimeout(() => kh.classList.remove('on'), 6500);
    }

    // ---- state ----
    const HEART_HP = 22;
    const bonusHearts = opts.bonusHearts || 0;   // permanent hearts earned from first boss kills
    const player = { x: T.heroStart.x, y: T.heroStart.y, z: 0, r: 14, maxHearts: Math.max(3, Math.round(stats.hp / HEART_HP)) + bonusHearts, face: { x: 0, y: -1 },
      atkCd: 0, dodgeCd: 0, iframe: 0, blocking: false, dashV: null, blockT: 0, blockCd: 0, kbx: 0, kby: 0, kbt: 0, noise: 0 };
    player.hearts = player.maxHearts;
    let enemies = [], projs = [], loot = [], fx = [];
    let waveIdx = -1, bossActive = false, boss = null, state = 'dialog', dlgQueue = [], runLoot = [], last = 0, raf = 0, aliveFrames = 0, paused = false, shake = 0;
    let heroHidden = false, lastSeen = { x: player.x, y: player.y }, aimPt = player;   // bush stealth: where the horde thinks you are
    ready = true; T.move(player, player.x, player.y, player.r);
    let elapsed = 0, raged = false, warned = false;   // per-wave seconds; resets each wave. After RAGE_START the horde escalates.
    const RAGE_START = 90;             // frenzy begins at 90s into a wave and steps up every 90s; warning fires 15s before
    const RAGE_STEP = 90;

    // open inventory mid-battle (pauses); resume recomputes stats from new gear
    function openInv() { if (paused || (state !== 'fight' && state !== 'dialog') || !opts.onInventory) return; paused = true; opts.onInventory(resumeFromInv); }
    function resumeFromInv(newEquipped, newLevels) {
      paused = false;
      if (newEquipped) { const old = player.maxHearts; stats = statsFor(opts.classId, newEquipped, newLevels); player.maxHearts = Math.max(3, Math.round(stats.hp / HEART_HP)) + bonusHearts; player.hearts = clamp(player.hearts + Math.max(0, player.maxHearts - old), 0.25, player.maxHearts); }
    }

    // ---- input ----
    const keys = {}; const press = { atk: false, dodge: false }; const move = { x: 0, y: 0 }; let touchDodgeHeld = false;
    const onKey = (e, d) => { const k = e.key.toLowerCase(); keys[k] = d; if (d && (k === ' ' || k === KEYS.attack)) press.atk = true; if (d && (k === 'shift' || k === KEYS.dodge)) press.dodge = true; };
    const kd = e => onKey(e, true), ku = e => onKey(e, false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

    const stick = root.querySelector('.b-stick'), nub = stick.querySelector('.nub');
    let stickId = null, stickOrigin = null;
    stick.addEventListener('pointerdown', e => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); const r = stick.getBoundingClientRect(); stickOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    stick.addEventListener('pointermove', e => { if (e.pointerId !== stickId) return; let dx = e.clientX - stickOrigin.x, dy = e.clientY - stickOrigin.y; const m = Math.hypot(dx, dy) || 1, cap = 46; const mm = Math.min(m, cap); dx = dx / m * mm; dy = dy / m * mm; nub.style.transform = `translate(${dx}px,${dy}px)`; move.x = dx / cap; move.y = dy / cap; });
    const stickEnd = e => { if (e.pointerId !== stickId) return; stickId = null; move.x = move.y = 0; nub.style.transform = ''; };
    stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
    root.querySelector('.b-btn.atk').addEventListener('pointerdown', e => { e.preventDefault(); press.atk = true; });
    const dodgeBtn = root.querySelector('.b-btn.dodge');
    dodgeBtn.addEventListener('pointerdown', e => { e.preventDefault(); press.dodge = true; touchDodgeHeld = true; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => dodgeBtn.addEventListener(ev, () => { touchDodgeHeld = false; }));
    // use 'click' (not pointerdown): on touch, opening on pointerdown lets the
    // tap's click land on the modal backdrop and instantly close it.
    invBtn.addEventListener('click', () => openInv());
    // End battle early: confirm, then bail back to the map (no loot from an abandoned run).
    quitBtn.addEventListener('click', () => {
      if (state === 'won' || state === 'lost') return;
      if (confirm('End this battle and return to the map? You keep no loot from this run.')) { cleanup(); (opts.onExit || (() => {}))(); }
    });

    // ---- dialog ----
    function showDialog(lines, then) { dlgQueue = lines.slice(); state = 'dialog'; nextLine(then); dlg.classList.add('on'); }
    function nextLine(then) { if (!dlgQueue.length) { dlg.classList.remove('on'); then && then(); return; } dlgLine.textContent = dlgQueue.shift(); dlg._then = then; }
    dlg.addEventListener('pointerdown', () => { if (state === 'dialog') nextLine(dlg._then); });

    // knockback: shove `ent` away from (fromX,fromY). Works for enemies and the player.
    function knock(ent, fromX, fromY, power) {
      const a = Math.atan2(ent.y - fromY, ent.x - fromX);
      ent.kbx = Math.cos(a) * power; ent.kby = Math.sin(a) * power; ent.kbt = 0.13;
    }
    // ---- waves ----
    function spawnEnemy(typeKey, pos) {
      const t = B.ENEMIES[typeKey] || B.ENEMIES.grunt;
      const p = (pos && typeof pos.x === 'number') ? T.freeSpot(pos.x, pos.y, t.r) : T.edgeSpawn(t.r);
      const hp = Math.round(t.hp * plan.hpScale);
      enemies.push({ type: typeKey, x: p.x, y: p.y, z: T.heightAt(p.x, p.y), r: t.r, color: t.color, hp, max: hp,
        atk: Math.round(t.atk * plan.atkScale), speed: t.speed, ai: t.ai, hitCd: 0, shotCd: rand(0.5, t.shotCd || 2), shotSpd: t.shotSpd,
        los: true, losT: 0, flankDir: Math.random() < 0.5 ? 1 : -1, dashCd: rand(1.5, 3.2), dashV: null, kbx: 0, kby: 0, kbt: 0, phase: rand(0, 6), proj: t.proj, power: t.power || 1 });
    }
    // Towers are enemy turrets bolted to the map: they hold their ground, lock on,
    // telegraph, and fire. Killing them is optional — and it makes the wave easier.
    function spawnTowers() {
      for (const s of T.towerSpots) {
        const d = T.towerDef, hp = Math.round(d.hp * plan.hpScale);
        enemies.push({ type: 'tower', ai: 'tower', x: s.x, y: s.y, z: T.heightAt(s.x, s.y), r: d.r, color: '#9a8ab8', hp, max: hp,
          atk: Math.round(13 * plan.atkScale), power: 1, range: d.range, cd: d.cd, cdT: rand(0.8, 2.4), aim: 0, los: false, losT: 0,
          fixed: true, hitCd: 0, kbx: 0, kby: 0, kbt: 0, phase: rand(0, 6) });
      }
    }
    const liveMobs = () => enemies.filter(e => e.ai !== 'tower').length;   // towers never gate a wave
    function startNextWave() {
      waveIdx++;
      elapsed = 0; raged = false; warned = false;   // rage timer resets each wave (fresh 90s before frenzy)
      if (waveIdx === 0) spawnTowers();
      if (waveIdx < plan.waves.length) { plan.waves[waveIdx].forEach(t => spawnEnemy(t)); state = 'fight'; updateWaveLabel(); }
      else { spawnBoss(); }
    }
    function spawnBoss() {
      bossActive = true;
      const hp = Math.round(B.BOSS.hp * (1 + plan.level * 0.16));
      const bs = T.freeSpot(T.bossStart.x, T.bossStart.y, B.BOSS.r);
      boss = { type: 'boss', x: bs.x, y: bs.y, z: T.heightAt(bs.x, bs.y), r: B.BOSS.r, color: B.BOSS.color, hp, max: hp,
        atk: Math.round(B.BOSS.atk * (1 + plan.level * 0.12)), speed: B.BOSS.speed, ai: 'boss', hitCd: 0, shotSpd: B.BOSS.shotSpd,
        core: ['spread', 'charge', 'ring'], coreIdx: 0, actCd: 1.2, doSpecial: false, charge: null, burst: null, power: B.BOSS.power || 2,
        specials: ['aimed', 'summon', 'cross', 'spiral', 'nova'].slice(0, Math.min(5, plan.level)) };  // +1 random special per level
      enemies.push(boss); bossWrap.classList.add('on'); state = 'fight'; waveEl.textContent = '☠ BOSS'; bSfx('boss'); }
    function updateWaveLabel() { waveEl.textContent = `Wave ${waveIdx + 1}/${plan.waves.length}`; }

    // ---- combat helpers ----
    // atk = attacker power (scales with level); armor counters it; power = base heart cost (1 light / 2 heavy).
    function hurtPlayer(atk, power, sx, sy) {
      if (player.iframe > 0) return;                 // dodging / just-hit i-frames = no damage (misses never call this)
      const armor = stats.armor || 0;
      let hearts = (power || 1) * (atk / (atk + armor));   // ARMOR COUNTERS POWER
      let blocked = false;
      if (player.blocking) {
        let ax = (sx != null ? sx - player.x : -player.face.x), ay = (sy != null ? sy - player.y : -player.face.y);
        const m = Math.hypot(ax, ay) || 1; const front = ((ax / m) * player.face.x + (ay / m) * player.face.y) > 0;
        hearts *= front ? 0.25 : 0.5; blocked = true;      // block front ¼ / back ½
      }
      hearts = Math.max(0.25, Math.round(hearts * 4) / 4);  // snap to quarter-hearts, min ¼ on a connect
      player.hearts = Math.max(0, Math.round((player.hearts - hearts) * 4) / 4);
      player.iframe = 0.5; shake = Math.min(12, shake + (hearts >= 1 ? 8 : 4)); bSfx('hurt');
      const frac = hearts === 0.25 ? '¼' : hearts === 0.5 ? '½' : hearts === 0.75 ? '¾' : (Number.isInteger(hearts) ? String(hearts) : hearts.toFixed(2));
      fx.push({ t: 'dmg', x: player.x, y: player.y, z: player.z, life: .8, text: (blocked ? '🛡 ' : '') + '-' + frac });   // floats over the head
      if (player.hearts <= 0) lose();
    }
    // Mob dodge: chance rises with engagement RANGE and LEVEL; the player's `hit` stat cancels it. Bosses never dodge.
    function tryHit(e, dmg, sx, sy) {
      if (e.ai !== 'boss' && e.ai !== 'tower') {     // bosses and bolted-down towers never dodge
        const d = dist(e, player);
        let dodge = 0.02 + d * 0.0005 + plan.level * 0.02 - (stats.hit || 0);
        dodge = Math.max(0, Math.min(0.4, dodge));
        if (Math.random() < dodge) { fx.push({ t: 'dmg', x: e.x, y: e.y - e.r - 4, z: e.z, life: .5, text: 'miss' }); return; }
      }
      damageEnemy(e, dmg, sx, sy);
    }
    function damageEnemy(e, dmg, sx, sy) {
      e.hp -= dmg; fx.push({ t: 'spark', x: e.x, y: e.y, z: e.z, life: .15 }); bSfx('deal');
      // knockback intentionally NOT applied on hit (kept as a mechanic for future gear via knock())
      if (e.hp <= 0) { killEnemy(e); }
    }
    function killEnemy(e) {
      enemies = enemies.filter(x => x !== e);
      fx.push({ t: 'pop', x: e.x, y: e.y, z: e.z, life: .3, color: e.color });
      if (e === boss) { const myth = B.MYTHIC_BY_CLASS[opts.classId]; runLoot.push(opts.hasMythic ? pickTier('Legendary') : myth, pickTier('Legendary')); boss = null; bossActive = false; win(); return; }
      if (e.ai === 'tower') {                        // a felled tower always pays out, and stays down
        fx.push({ t: 'burst', x: e.x, y: e.y, z: e.z, r: 60, life: .3, color: '#ffd15c' });
        shake = Math.min(14, shake + 9); bSfx('boss'); flash('TOWER DOWN', '#ffd15c');
        dropLoot(e.x, e.y, pickTier(Math.random() < 0.25 ? 'Legendary' : 'Rare'));
        return;
      }
      // normal gear drop
      const r = Math.random(); let id = null;
      if (r < B.DROP_RATES.Legendary) id = pickTier('Legendary');
      else if (r < B.DROP_RATES.Legendary + B.DROP_RATES.Rare) id = pickTier('Rare');
      else if (r < B.DROP_RATES.Legendary + B.DROP_RATES.Rare + B.DROP_RATES.Common) id = pickTier('Common');
      if (id) dropLoot(e.x, e.y, id);
      // health orb — drops often and PERSISTS on the field between waves
      if (Math.random() < 0.22) loot.push({ x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), r: 8, potion: true, heal: 20 });
    }
    function pickTier(tier) { const a = B.NORMAL_LOOT[tier]; return a[Math.floor(Math.random() * a.length)]; }
    function dropLoot(x, y, id) { loot.push({ x, y, r: 9, id, tier: B.GEAR[id].tier }); }

    // ---- main update ----
    function update(dt) {
      // player movement
      let ix = move.x, iy = move.y;
      if (keys[KEYS.left] || keys['arrowleft']) ix -= 1; if (keys[KEYS.right] || keys['arrowright']) ix += 1;
      if (keys[KEYS.up] || keys['arrowup']) iy -= 1; if (keys[KEYS.down] || keys['arrowdown']) iy += 1;
      const im = Math.hypot(ix, iy); if (im > 1) { ix /= im; iy /= im; }
      if (im > 0.15) player.face = { x: ix, y: iy };
      player.atkCd -= dt; player.dodgeCd -= dt; player.iframe -= dt; player.blockCd -= dt;

      // Vanguard block is a TIMED shield: 1s active, then 1s cooldown (no more hold-forever).
      if (cls.dodge === 'block') {
        if (player.blockT > 0) { player.blockT -= dt; if (player.blockT <= 0) { player.blockT = 0; player.blockCd = 1.0; } }
        else if (press.dodge && player.blockCd <= 0) { player.blockT = 1.0; bSfx('attack'); }
        player.blocking = player.blockT > 0;
      } else {
        player.blocking = false;
        if (press.dodge && player.dodgeCd <= 0) {
          const f = player.face; player.dashV = { x: f.x * 520, y: f.y * 520, life: 0.16 }; player.iframe = 0.28; player.dodgeCd = 0.6;
        }
      }
      press.dodge = false;

      // movement (blocking slows you down, water slows you more); knockback shove is added on top
      const wasWet = T.waterAt(player.x, player.y);
      const spd = stats.speed * (player.blocking ? 0.55 : 1) * T.slowAt(player.x, player.y);
      if (player.dashV) { T.move(player, player.x + player.dashV.x * dt, player.y + player.dashV.y * dt, player.r); player.dashV.life -= dt; if (player.dashV.life <= 0) player.dashV = null; }
      else if (ix || iy) T.move(player, player.x + ix * spd * dt, player.y + iy * spd * dt, player.r);
      if (player.kbt > 0) { T.move(player, player.x + player.kbx * dt, player.y + player.kby * dt, player.r); player.kbt -= dt; }
      if (wasWet && (ix || iy) && Math.random() < 0.25) fx.push({ t: 'splash', x: player.x, y: player.y, life: .35 });

      // attack
      if (press.atk && player.atkCd <= 0) { doAttack(); player.atkCd = cls.cd; player.noise = 1.2; }
      press.atk = false;

      // enemies — the horde grows frenzied 90s into a wave and steps up every 90s (faster travel, attack speed, range).
      elapsed += dt;
      if (!warned && elapsed >= RAGE_START - 15) { warned = true; flash('⚠ RAGE INCOMING — 15s', '#ffd15c'); bSfx('shot'); }
      if (!raged && elapsed >= RAGE_START) { raged = true; flash('THE HORDE GROWS FRENZIED!', '#ff5d5d'); bSfx('boss'); }
      const esc = 1 + Math.max(0, elapsed - RAGE_START) / RAGE_STEP;   // 1x, then climbs uncapped, +1x every 90s
      // Bush stealth: crouch in the brush and the horde loses your trail — they
      // push to where they last saw you. Swinging your weapon gives you away.
      player.noise -= dt;
      heroHidden = T.bushAt(player.x, player.y) && player.noise <= 0;
      if (!heroHidden) { lastSeen.x = player.x; lastSeen.y = player.y; }
      aimPt = heroHidden ? lastSeen : player;
      for (const e of enemies) {
        e.hitCd -= dt;
        if (e.ai === 'tower') { towerUpdate(e, dt); continue; }
        const d = dist(e, aimPt), ax = (aimPt.x - e.x) / (d || 1), ay = (aimPt.y - e.y) / (d || 1);
        // Where to WALK (round the cliff, via the ramp) can differ from where to SHOOT.
        const nav = T.navTarget(e, aimPt.x, aimPt.y), nd = dist(e, nav) || 1;
        const dx = (nav.x - e.x) / nd, dy = (nav.y - e.y) / nd;
        const slow = T.slowAt(e.x, e.y);                     // wading mobs are slow mobs
        let vx = 0, vy = 0;
        if (e.ai === 'boss') { bossUpdate(e, dt, dx, dy, d); }
        else if (e.ai === 'shooter') {                       // keep range + coordinate spacing; frenzy adds range + fire rate
          e.losT -= dt; if (e.losT <= 0) { e.losT = 0.16; e.los = T.losClear(e.x, e.y, player.x, player.y); }
          const want = 210 + 70 * (esc - 1);
          const dir = !e.los ? 1 : d > want ? 1 : d < want - 40 ? -1 : 0;   // no sightline? push in until it has one
          let sx = 0, sy = 0; for (const o of enemies) { if (o === e || o.ai === 'boss' || o.ai === 'tower') continue; const dd = dist(o, e); if (dd > 0 && dd < 44) { sx += (e.x - o.x) / dd; sy += (e.y - o.y) / dd; } }
          if (T.waterAt(e.x, e.y)) { const dry = dryDir(e); sx += dry.x * 2.2; sy += dry.y * 2.2; }   // ranged mobs don't wade
          vx = (dx * dir + sx * plan.coord * 0.8) * e.speed * esc * slow * dt; vy = (dy * dir + sy * plan.coord * 0.8) * e.speed * esc * slow * dt;
          e.shotCd -= dt;
          if (e.shotCd <= 0 && e.los && !heroHidden) { e.shotCd = ((B.ENEMIES[e.type] && B.ENEMIES[e.type].shotCd) || 1.8) * (1 - plan.coord * 0.35) / esc; fireEnemyShot(e, ax, ay, 0, esc); }
        } else {                                              // melee: surround the hero, with an occasional dash lunge
          e.dashCd -= dt;
          if (e.dashV && e.dashV.t > 0) { vx = e.dashV.x * dt; vy = e.dashV.y * dt; e.dashV.t -= dt; }
          else if (e.dashCd <= 0 && d < 175 && d > 24 && !heroHidden) {      // small dash attack toward the hero
            e.dashV = { x: dx * e.speed * 4.4, y: dy * e.speed * 4.4, t: 0.18 }; e.dashCd = rand(2.2, 3.8) / esc; bSfx('attack');
          } else {
            const c = plan.coord; let mvx = dx, mvy = dy;
            mvx += -dy * (0.6 + 0.5 * c) * e.flankDir; mvy += dx * (0.6 + 0.5 * c) * e.flankDir;   // tangential = ring/surround the hero
            for (const o of enemies) { if (o === e || o.ai === 'boss' || o.ai === 'tower') continue; const dd = dist(o, e); if (dd > 0 && dd < 40) { mvx += (e.x - o.x) / dd * (0.6 + c * 0.8); mvy += (e.y - o.y) / dd * (0.6 + c * 0.8); } }
            const mm = Math.hypot(mvx, mvy) || 1; vx = mvx / mm * e.speed * esc * slow * dt; vy = mvy / mm * e.speed * esc * slow * dt;
          }
        }
        if (vx || vy) { T.move(e, e.x + vx, e.y + vy, e.r); if (slow < 1 && Math.random() < 0.06) fx.push({ t: 'splash', x: e.x, y: e.y, life: .3 }); }
        if (e.kbt > 0) { T.move(e, e.x + e.kbx * dt, e.y + e.kby * dt, e.r); e.kbt -= dt; }   // bounce-back from being hit
        const pd = dist(e, player);
        if (pd < e.r + player.r && e.hitCd <= 0) { hurtPlayer(e.atk, e.power || 1, e.x, e.y); e.hitCd = 0.8 / esc; }   // frenzy = faster melee swings
      }
      // ---- collision resolution: no overlap/stacking; player contact = a small bounce ----
      for (let i = 0; i < enemies.length; i++) {
        const a = enemies[i], aFix = a.ai === 'boss' || a.fixed;      // bosses and towers don't get shoved
        // vs other enemies (separate so they never stack)
        for (let j = i + 1; j < enemies.length; j++) {
          const bb = enemies[j], bFix = bb.ai === 'boss' || bb.fixed, dd = dist(a, bb), mn = a.r + bb.r;
          if (dd > 0 && dd < mn) { const ux = (a.x - bb.x) / dd, uy = (a.y - bb.y) / dd, push = mn - dd;
            if (!aFix) { a.x += ux * push * (bFix ? 1 : 0.5); a.y += uy * push * (bFix ? 1 : 0.5); }
            if (!bFix) { bb.x -= ux * push * (aFix ? 1 : 0.5); bb.y -= uy * push * (aFix ? 1 : 0.5); } }
        }
        // vs player: push the enemy out and give the player a small bounce (uses the kept knock mechanic)
        const pd = dist(a, player), minP = a.r + player.r;
        if (pd > 0 && pd < minP) { const ux = (a.x - player.x) / pd, uy = (a.y - player.y) / pd, push = minP - pd;
          if (!aFix) { a.x += ux * push * 0.75; a.y += uy * push * 0.75; }
          T.move(player, player.x - ux * push * (a.fixed ? 1 : 0.25), player.y - uy * push * (a.fixed ? 1 : 0.25), player.r);
          if (!a.fixed && player.kbt <= 0) knock(player, a.x, a.y, 90);   // small bounce (a tower is a wall, not a shove)
        }
        if (!aFix) T.move(a, a.x, a.y, a.r);                          // keep the shoved back out of the scenery
      }
      T.move(player, player.x, player.y, player.r);
      if (boss) bossFill.style.width = clamp(boss.hp / boss.max * 100, 0, 100) + '%';

      // projectiles — shots shatter on cover, which is what makes obstacles matter
      for (const p of projs) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (T.shotBlocked(p.x, p.y)) { fx.push({ t: 'spark', x: p.x, y: p.y, life: .15 }); p.life = 0; continue; }
        if (p.team === 'player') { for (const e of enemies) if (dist(p, e) < e.r + 5) { tryHit(e, p.dmg, p.x - p.vx * 0.02, p.y - p.vy * 0.02); p.life = 0; break; } }
        else if (dist(p, player) < player.r + 5) { hurtPlayer(p.dmg, p.power || 1, p.x, p.y); p.life = 0; }
      }
      const b = T.bounds;
      projs = projs.filter(p => p.life > 0 && p.x > b.minX - 30 && p.x < b.maxX + 30 && p.y > b.minY - 30 && p.y < b.maxY + 30);

      // loot pickups
      for (const l of loot) { if (dist(l, player) < player.r + l.r + 6) { if (grab(l) !== false) l.dead = true; } }
      loot = loot.filter(l => !l.dead);

      fx.forEach(f => f.life -= dt); fx = fx.filter(f => f.life > 0);

      // wave progression
      if (state === 'fight' && liveMobs() === 0 && !bossActive) {
        if (waveIdx + 1 < plan.waves.length) { const line = dialog[(waveIdx + 1) % dialog.length]; showDialog([line], startNextWave); }
        else { showDialog(['The Gatekeeper approaches...'], startNextWave); }
      }
    }

    function doAttack() {
      bSfx('attack');
      const rb = T.rangeBonus(player.z);            // high ground = longer reach
      const reach = cls.reach * rb;
      if (cls.attack === 'shot') {
        let tx = player.face.x, ty = player.face.y; // auto-aim nearest for mobile feel
        let near = null, nd = 1e9; for (const e of enemies) { const d = dist(e, player); if (d < nd) { nd = d; near = e; } }
        if (near) { tx = (near.x - player.x) / (nd || 1); ty = (near.y - player.y) / (nd || 1); }
        projs.push({ x: player.x, y: player.y, vx: tx * 420, vy: ty * 420, life: 1.6 * rb, dmg: stats.atk, team: 'player', color: cls.accent, pdef: B.projForClass(opts.classId) });
        fx.push({ t: 'shot', x: player.x, y: player.y, z: player.z, life: .12 });
      } else if (cls.attack === 'burst') {
        for (const e of [...enemies]) if (dist(e, player) < reach) tryHit(e, stats.atk);
        fx.push({ t: 'burst', x: player.x, y: player.y, z: player.z, r: reach, life: .25, color: cls.accent });
      } else if (cls.attack === 'spellblade') {   // dual: melee arc up close + a homing magic bolt at range
        const fa = Math.atan2(player.face.y, player.face.x);
        for (const e of [...enemies]) { const d = dist(e, player); if (d > reach + e.r) continue; const ea = Math.atan2(e.y - player.y, e.x - player.x); let diff = Math.abs(ea - fa); if (diff > Math.PI) diff = 2 * Math.PI - diff; if (diff < cls.arc / 2 + Math.atan2(e.r, d)) tryHit(e, stats.atk); }
        fx.push({ t: 'slash', x: player.x, y: player.y, z: player.z, a: fa, reach: reach, arc: cls.arc, life: .18, color: cls.accent });
        let tx = player.face.x, ty = player.face.y, near = null, nd = 1e9;   // magic bolt auto-aims nearest
        for (const e of enemies) { const d = dist(e, player); if (d < nd) { nd = d; near = e; } }
        if (near) { tx = (near.x - player.x) / (nd || 1); ty = (near.y - player.y) / (nd || 1); }
        projs.push({ x: player.x, y: player.y, vx: tx * 460, vy: ty * 460, life: 1.5 * rb, dmg: Math.max(1, Math.round(stats.atk * 0.6)), team: 'player', color: cls.accent, pdef: B.projForClass(opts.classId) });
        fx.push({ t: 'shot', x: player.x, y: player.y, z: player.z, life: .12 });
      } else { // melee arc
        const fa = Math.atan2(player.face.y, player.face.x);
        for (const e of [...enemies]) { const d = dist(e, player); if (d > reach + e.r) continue; const ea = Math.atan2(e.y - player.y, e.x - player.x); let diff = Math.abs(ea - fa); if (diff > Math.PI) diff = 2 * Math.PI - diff; if (diff < cls.arc / 2 + Math.atan2(e.r, d)) tryHit(e, stats.atk); }
        fx.push({ t: 'slash', x: player.x, y: player.y, z: player.z, a: fa, reach: reach, arc: cls.arc, life: .18, color: cls.accent });
      }
    }
    function fireEnemyShot(e, dx, dy, spread, mult) { const m = mult || 1; const a = Math.atan2(dy, dx) + spread; const sp = (e.shotSpd || 180) * m; projs.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 3 * m, dmg: e.atk, power: e.power || 1, team: 'enemy', color: '#ff88aa', pdef: B.projById(e.proj) }); }   // mult (frenzy) scales speed AND lifetime = more range
    function mkEShot(e, ux, uy) { projs.push({ x: e.x, y: e.y, vx: ux * (e.shotSpd || 200), vy: uy * (e.shotSpd || 200), life: 3.2, dmg: e.atk, power: e.power || 1, team: 'enemy', color: '#ff88aa', pdef: B.projById(e.proj) }); }
    // Boss AI: cycles 3 core patterns + fires a random "special" (one more per difficulty level).
    function bossUpdate(e, dt, dx, dy, d) {
      if (e.charge) { T.move(e, e.x + e.charge.x * dt, e.y + e.charge.y * dt, e.r); e.charge.t -= dt; if (e.charge.t <= 0) e.charge = null; }
      else { const want = 150; const dir = d > want + 30 ? 1 : d < want - 30 ? -1 : 0; const s = T.slowAt(e.x, e.y); T.move(e, e.x + dx * e.speed * 0.6 * dir * s * dt, e.y + dy * e.speed * 0.6 * dir * s * dt, e.r); }
      if (e.burst) { e.burst.t -= dt; if (e.burst.t <= 0 && e.burst.n > 0) { bossBurst(e); e.burst.n--; e.burst.t = e.burst.interval; if (e.burst.n <= 0) e.burst = null; } }
      e.actCd -= dt;
      if (e.actCd <= 0 && !e.burst && !e.charge) {
        e.actCd = 1.5;
        if (e.doSpecial && e.specials.length) { bossAttack(e, e.specials[Math.floor(Math.random() * e.specials.length)], dx, dy); e.doSpecial = false; }
        else { bossAttack(e, e.core[e.coreIdx % 3], dx, dy); e.coreIdx++; e.doSpecial = true; }
      }
    }
    function bossAttack(e, kind, dx, dy) {
      const m = Math.hypot(dx, dy) || 1, nx = dx / m, ny = dy / m;
      if (kind === 'spread') { for (const a of [-0.4, -0.2, 0, 0.2, 0.4]) fireEnemyShot(e, aimPt.x - e.x, aimPt.y - e.y, a); bSfx('shot'); }
      else if (kind === 'ring') { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832; mkEShot(e, Math.cos(a), Math.sin(a)); } bSfx('boss'); }
      else if (kind === 'charge') { e.charge = { x: nx * 380, y: ny * 380, t: 0.5 }; bSfx('boss'); }
      else if (kind === 'nova') { for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832; mkEShot(e, Math.cos(a), Math.sin(a)); } bSfx('boss'); }
      else if (kind === 'summon') { const k = 1 + Math.floor(Math.random() * 2); for (let i = 0; i < k; i++) spawnEnemy('grunt', { x: e.x + rand(-30, 30), y: e.y + rand(20, 44) }); bSfx('boss'); }
      else if (kind === 'aimed') { e.burst = { mode: 'aim', n: 5, interval: 0.12, t: 0 }; }
      else if (kind === 'cross') { e.burst = { mode: 'cross', n: 3, interval: 0.18, t: 0, ang: 0 }; }
      else if (kind === 'spiral') { e.burst = { mode: 'spiral', n: 16, interval: 0.06, t: 0, ang: Math.random() * 6.2832 }; }
    }
    // Nearest dry direction — ranged mobs use it to wade back out of the water.
    function dryDir(e) {
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832, x = e.x + Math.cos(a) * 34, y = e.y + Math.sin(a) * 34; if (!T.waterAt(x, y)) return { x: Math.cos(a), y: Math.sin(a) }; }
      return { x: 0, y: 0 };
    }
    // Towers: lock on, wind up where you can SEE it coming, then fire. They only
    // shoot what they have a clean line to, so cover and bush both beat them.
    function towerUpdate(t, dt) {
      t.losT -= dt;
      if (t.losT <= 0) { t.losT = 0.2; t.los = T.losClear(t.x, t.y, player.x, player.y); }
      const d = dist(t, player), tracking = d < t.range && t.los && !heroHidden;
      if (t.aim > 0 && !tracking) { t.aim = 0; t.cdT = 0.5; return; }        // broke the lock mid-wind-up
      if (t.aim > 0) {
        t.aim -= dt;
        if (t.aim <= 0) { fireEnemyShot(t, player.x - t.x, player.y - t.y, rand(-0.05, 0.05), 1.15); t.cdT = t.cd; }
      } else if (t.cdT > 0) t.cdT -= dt;
      else if (tracking) { t.aim = 0.7; bSfx('shot'); }
    }
    function bossBurst(e) {
      if (e.burst.mode === 'aim') fireEnemyShot(e, (aimPt.x - e.x), (aimPt.y - e.y), rand(-0.06, 0.06));
      else if (e.burst.mode === 'cross') { for (let i = 0; i < 4; i++) { const a = e.burst.ang + i * 1.5708; mkEShot(e, Math.cos(a), Math.sin(a)); } e.burst.ang += 0.4; }
      else if (e.burst.mode === 'spiral') { const a = e.burst.ang; mkEShot(e, Math.cos(a), Math.sin(a)); e.burst.ang += 0.5; }
      bSfx('shot');
    }
    function grab(l) {
      if (l.potion) { if (player.hearts >= player.maxHearts) return false; player.hearts = clamp(player.hearts + 1, 0, player.maxHearts); flash('+1 ❤', '#5cff9d'); bSfx('heal'); return; }
      runLoot.push(l.id); flash(B.GEAR[l.id].name + '!', B.TIER_COLOR[l.tier]); bSfx('pickup'); }
    function flash(text, color) { toast.textContent = text; toast.style.borderColor = color; toast.style.color = color; toast.classList.remove('on'); void toast.offsetWidth; toast.classList.add('on'); }

    // ---- render (bright cartoon-brawler look; original art) ----
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function shadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.82, r * 0.95, r * 0.42 * T.view.SQ, 0, 0, 7); ctx.fill(); }
    const SY = (e) => T.py(e.y, e.z || 0);          // world entity -> screen y (elevation included)
    function heartShape(x, y, s) { ctx.beginPath(); ctx.moveTo(x, y + s * 0.3); ctx.bezierCurveTo(x, y - s * 0.2, x - s, y - s * 0.2, x - s, y + s * 0.25); ctx.bezierCurveTo(x - s, y + s * 0.6, x, y + s * 0.85, x, y + s); ctx.bezierCurveTo(x, y + s * 0.85, x + s, y + s * 0.6, x + s, y + s * 0.25); ctx.bezierCurveTo(x + s, y - s * 0.2, x, y - s * 0.2, x, y + s * 0.3); ctx.closePath(); }
    function blob(x, y, r, color, o) {
      o = o || {}; shadow(x, y, r);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = o.flash ? '#fff' : color; ctx.fill();
      if (!o.flash) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.arc(x, y + r * 0.55, r, 0, 7); ctx.fill(); ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(x - r * 0.32, y - r * 0.4, r * 0.34, r * 0.2, -0.5, 0, 7); ctx.fill(); }
      ctx.lineWidth = Math.max(3, r * 0.17); ctx.strokeStyle = o.outline || '#20143a'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
      if (o.eyes) {
        let dx = o.dir ? o.dir.x : 0, dy = o.dir ? o.dir.y : 0.4; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
        const ex = r * 0.34, ey = -r * 0.08, es = r * 0.27;
        for (const s of [-1, 1]) { const cx = x + s * ex, cy = y + ey;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, es, 0, 7); ctx.fill();
          ctx.fillStyle = '#1a1030'; ctx.beginPath(); ctx.arc(cx + dx * es * 0.45, cy + dy * es * 0.45, es * 0.55, 0, 7); ctx.fill(); }
        if (o.angry) { ctx.strokeStyle = '#1a1030'; ctx.lineWidth = Math.max(2, r * 0.11); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x - ex - es * 0.7, y + ey - es * 0.8); ctx.lineTo(x - ex + es * 0.7, y + ey - es * 0.2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + ex + es * 0.7, y + ey - es * 0.8); ctx.lineTo(x + ex - es * 0.7, y + ey - es * 0.2); ctx.stroke(); ctx.lineCap = 'butt'; }
      }
    }
    // Draw an animated mob from its sprite strip, with procedural life (bob, squash, facing, dash stretch).
    function drawSprite(e, sy, img, frames) {
      shadow(e.x, sy, e.r);
      const fw = img.width / frames;
      const fps = e.dashV ? 15 : 8;                                  // dashing = faster cycle
      const hold = Math.max(1, Math.round(60 / fps));
      const fi = Math.floor((aliveFrames + e.phase * 7) / hold) % frames;
      const size = e.r * 2.7;
      const bob = Math.sin((aliveFrames + e.phase * 10) / 6) * (e.r * 0.06);
      let qx = 1, qy = 1;
      if (e.kbt > 0) { qx = 1.18; qy = 0.82; }                        // squash when knocked back
      else if (e.dashV && e.dashV.t > 0) { qx = 0.86; qy = 1.16; }    // stretch into a dash lunge
      const faceLeft = (player.x - e.x) < 0;
      ctx.save();
      ctx.translate(e.x, sy + bob);
      ctx.scale((faceLeft ? -1 : 1) * qx, qy);
      ctx.drawImage(img, fi * fw, 0, fw, img.height, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    function drawLootItem(l) {
      const sy = T.py(l.y, l.z || 0);
      if (l.potion) { shadow(l.x, sy, l.r); ctx.fillStyle = '#ff5d7a'; heartShape(l.x, sy - l.r * 0.4, l.r * 1.1); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#a01030'; ctx.stroke(); return; }
      shadow(l.x, sy, l.r); const bob = Math.sin((aliveFrames + l.x) / 12) * 2;
      ctx.save(); ctx.translate(l.x, sy + bob); ctx.rotate(0.78);
      ctx.fillStyle = B.TIER_COLOR[l.tier]; rr(-l.r, -l.r, l.r * 2, l.r * 2, 3); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#1a1030'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; rr(-l.r * 0.7, -l.r * 0.7, l.r * 0.55, l.r * 0.55, 2); ctx.fill(); ctx.restore();
    }
    // A turret: stone shaft, battlement, and an eye that goes hot while it winds up.
    function drawTower(t, sy) {
      shadow(t.x, sy, t.r);
      const h = 46, bw = t.r * 1.5, tw = t.r * 1.1, hot = t.aim > 0;
      ctx.beginPath(); ctx.moveTo(t.x - bw, sy + 5); ctx.lineTo(t.x - tw, sy - h); ctx.lineTo(t.x + tw, sy - h); ctx.lineTo(t.x + bw, sy + 5); ctx.closePath();
      ctx.fillStyle = '#6b6079'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(t.x - bw, sy - h, bw, h + 6);
      ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) { const yy = sy + 5 - (h + 5) * i / 4; ctx.beginPath(); ctx.moveTo(t.x - bw, yy); ctx.lineTo(t.x + bw, yy); ctx.stroke(); }
      ctx.restore();
      ctx.lineWidth = 3.5; ctx.strokeStyle = '#2b2334'; ctx.beginPath(); ctx.moveTo(t.x - bw, sy + 5); ctx.lineTo(t.x - tw, sy - h); ctx.lineTo(t.x + tw, sy - h); ctx.lineTo(t.x + bw, sy + 5); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = '#8b7ea1'; rr(t.x - tw - 5, sy - h - 13, (tw + 5) * 2, 15, 3); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
      const glow = hot ? 7 + Math.sin(aliveFrames * 0.5) * 1.6 : 5;
      ctx.fillStyle = hot ? '#ff3b5c' : '#c86a4a'; ctx.beginPath(); ctx.arc(t.x, sy - h - 5, glow, 0, 7); ctx.fill();
      if (hot) { ctx.strokeStyle = 'rgba(255,59,92,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.x, sy - h - 5, glow + 6 + (0.7 - t.aim) * 14, 0, 7); ctx.stroke(); }
    }
    function drawTelegraph(t) {                        // the "it's about to fire" beam
      const sy = SY(t) - 51, py2 = SY(player);
      ctx.save(); ctx.globalAlpha = 0.25 + (0.7 - t.aim) * 0.5;
      ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 2.5; ctx.setLineDash([9, 7]); ctx.lineDashOffset = -aliveFrames * 1.5;
      ctx.beginPath(); ctx.moveTo(t.x, sy); ctx.lineTo(player.x, py2); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
    function drawEnemy(e) {
      const sy = SY(e);
      if (T.bushAt(e.x, e.y)) ctx.globalAlpha = 0.55;   // mobs in the brush go faint too
      if (e.ai === 'tower') drawTower(e, sy);
      else {
        const def = B.ENEMIES[e.type], sp = def && def.sprite ? spriteImg(def) : null;
        if (sp) drawSprite(e, sy, sp, def.frames || 4);
        else blob(e.x, sy, e.r, e.color, { eyes: true, dir: { x: player.x - e.x, y: player.y - e.y }, angry: e.type !== 'zap', outline: '#3a1226' });
        if (e.ai === 'boss') { ctx.fillStyle = '#ffd15c'; const cw = e.r * 0.85, ty = sy - e.r * 0.92; ctx.beginPath(); ctx.moveTo(e.x - cw, ty); ctx.lineTo(e.x - cw * 0.5, ty - e.r * 0.5); ctx.lineTo(e.x, ty); ctx.lineTo(e.x + cw * 0.5, ty - e.r * 0.5); ctx.lineTo(e.x + cw, ty); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#a2701a'; ctx.stroke(); }
      }
      if (e.hp < e.max) { const w = e.r * 2.2, bx = e.x - w / 2, by = sy - e.r - (e.ai === 'tower' ? 76 : 15), h = 7;
        rr(bx, by, w, h, 4); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();
        rr(bx, by, Math.max(0, w * (e.hp / e.max)), h, 4); ctx.fillStyle = e.ai === 'boss' ? '#ff4d6d' : e.ai === 'tower' ? '#ffb020' : '#5ce65c'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.4)'; rr(bx, by, w, h, 4); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    function drawHero() {
      const sy = SY(player), flash = player.iframe > 0 && Math.floor(player.iframe * 20) % 2;
      if (heroHidden) ctx.globalAlpha = 0.5;
      blob(player.x, sy, player.r, cls.color, { eyes: true, dir: player.face, flash, outline: '#1a1030' });
      if (player.blocking) { ctx.strokeStyle = '#8fd3ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(player.x, sy, player.r + 8, 0, 7); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, sy, player.r + 8, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (heroHidden) { ctx.fillStyle = '#b6ffd6'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('HIDDEN', player.x, sy - player.r - 18); ctx.textAlign = 'left'; }
    }
    function drawProj(p) {
      const sy = T.py(p.y, 0.3);                       // shots ride at chest height
      const pimg = p.pdef ? spriteImg(p.pdef) : null;
      if (pimg) {                                                    // animated sprite projectile
        const n = p.pdef.frames || 1, fw = pimg.width / n, fi = Math.floor(aliveFrames / 4) % n, size = p.pdef.size || 16;
        ctx.save(); ctx.translate(p.x, sy);
        ctx.rotate(p.pdef.spin ? aliveFrames * 0.3 : Math.atan2(p.vy * T.view.SQ, p.vx));   // spin, or point along travel
        ctx.drawImage(pimg, fi * fw, 0, fw, pimg.height, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else {                                                       // default orb
        shadow(p.x, sy, 6); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, sy, 7, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(p.x - 2, sy - 2, 3, 0, 7); ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = p.team === 'enemy' ? '#7a1030' : '#1a3a5a'; ctx.beginPath(); ctx.arc(p.x, sy, 7, 0, 7); ctx.stroke();
      }
    }
    function render() {
      ctx.save();
      if (shake > 0.3) { ctx.translate(rand(-shake, shake), rand(-shake, shake)); shake *= 0.86; } else shake = 0;
      ctx.drawImage(T.ground(DPR), 0, 0, W, H);        // terrain floor, painted once per battle
      // Anything that can stand in front of anything else is sorted by world Y —
      // that's what turns the tilted level-5 map into a scene with depth.
      const list = T.props.slice();
      for (const l of loot) list.push({ y: l.y, draw: () => drawLootItem(l) });
      for (const e of enemies) list.push({ y: e.y, draw: () => drawEnemy(e) });
      list.push({ y: player.y, draw: drawHero });
      list.sort((a, b) => a.y - b.y);
      for (const it of list) it.draw(ctx);
      for (const e of enemies) if (e.ai === 'tower' && e.aim > 0) drawTelegraph(e);
      for (const p of projs) drawProj(p);
      for (const f of fx) drawFx(f);                   // fx always on top so hits stay readable
      ctx.restore();
      drawHearts();                                  // red hearts, quarter-precision, on canvas (no shake)
    }
    function drawHearts() {
      const n = player.maxHearts, avail = W - 44;
      let s = 12, sp = 2 * s + 6; if (n * sp > avail) { sp = Math.max(13, avail / n); s = Math.max(5, (sp - 4) / 2); }
      const y = s + 10;
      for (let i = 0; i < n; i++) {
        const cx = 20 + s + i * sp, frac = clamp(player.hearts - i, 0, 1);
        heartShape(cx, y, s); ctx.fillStyle = '#3a1020'; ctx.fill();                 // empty
        if (frac > 0) { ctx.save(); heartShape(cx, y, s); ctx.clip(); ctx.fillStyle = '#ff2b4e'; ctx.fillRect(cx - s - 1, y - s - 1, (2 * s + 2) * frac, 3 * s); ctx.restore(); }
        heartShape(cx, y, s); ctx.lineWidth = 2; ctx.strokeStyle = '#12060a'; ctx.stroke();   // outline
      }
    }
    // FX live in world space. Ground decals (swings, shockwaves) are drawn inside a
    // squashed transform so they lie flat on the tilted floor; text and sparks don't.
    function drawFx(f) {
      const sy = T.py(f.y, f.z || 0), SQ = T.view.SQ;
      const flat = (draw) => { ctx.save(); ctx.translate(f.x, sy); ctx.scale(1, SQ); draw(); ctx.restore(); };
      if (f.t === 'slash') { ctx.globalAlpha = Math.min(1, f.life * 5);   // filled CONE (pie wedge) matching the hit area
        const R = f.reach + 8, a0 = f.a - f.arc / 2, a1 = f.a + f.arc / 2;
        flat(() => {
          ctx.fillStyle = f.color; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a1); ctx.closePath(); ctx.globalAlpha = Math.min(1, f.life * 5) * 0.35; ctx.fill();
          ctx.globalAlpha = Math.min(1, f.life * 5); ctx.lineCap = 'round';
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, R, a0, a1); ctx.stroke();
          ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a0) * R, Math.sin(a0) * R); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a1) * R, Math.sin(a1) * R); ctx.stroke(); ctx.lineCap = 'butt';
        }); ctx.globalAlpha = 1; }
      else if (f.t === 'burst') { ctx.globalAlpha = Math.min(1, f.life * 4); const R = f.r * (1 - f.life * 2.2);
        flat(() => { ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke(); ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke(); }); ctx.globalAlpha = 1; }
      else if (f.t === 'pop') { ctx.globalAlpha = Math.min(1, f.life * 3); const rrad = 24 * (1 - f.life * 3);
        flat(() => { ctx.fillStyle = f.color; for (let i = 0; i < 8; i++) { const a = i / 8 * 7; ctx.beginPath(); ctx.arc(Math.cos(a) * rrad, Math.sin(a) * rrad, 4.5, 0, 7); ctx.fill(); } }); ctx.globalAlpha = 1; }
      else if (f.t === 'splash') { ctx.globalAlpha = Math.min(1, f.life * 3) * 0.8; const R = 8 + (0.35 - f.life) * 44;
        flat(() => { ctx.strokeStyle = '#cbefff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke(); }); ctx.globalAlpha = 1; }
      else if (f.t === 'spark') { ctx.globalAlpha = Math.min(1, f.life * 7); ctx.fillStyle = '#fff6c2';
        for (let i = 0; i < 5; i++) { const a = i / 5 * 7 + f.x, d = 9 * (1 - f.life * 6); ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, sy + Math.sin(a) * d * SQ, 2.6, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
      else if (f.t === 'hit') { ctx.globalAlpha = Math.min(1, f.life * 4); flat(() => { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 22 * (1 - f.life * 4) + 6, 0, 7); ctx.stroke(); }); ctx.globalAlpha = 1; }
      else if (f.t === 'dmg') { ctx.globalAlpha = Math.min(1, f.life * 1.6); ctx.fillStyle = '#ff3b5c'; ctx.strokeStyle = '#5a0010'; ctx.lineWidth = 3; ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center'; const ty = sy - player.r - 14 - (0.8 - f.life) * 42; ctx.strokeText(f.text, f.x, ty); ctx.fillText(f.text, f.x, ty); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
    }

    // ---- end states ----
    async function win() {
      state = 'won'; teardownInput(); bSfx('win');
      for (const l of loot) { if (l.id) runLoot.push(l.id); }   // auto-collect any gear still on the field
      loot = [];
      const items = [...runLoot];
      overH2.textContent = 'VICTORY!'; overlay.classList.remove('lose');
      lootEl.innerHTML = items.length ? items.map(id => { const g = B.GEAR[id]; return `<div class="item" style="border-color:${B.TIER_COLOR[g.tier]};color:${B.TIER_COLOR[g.tier]}">${g.tier} · ${g.name}</div>`; }).join('') : '<div class="item">No gear this time — the trial still awaits.</div>';
      eqBtn.style.display = items.length ? '' : 'none'; eqBtn.textContent = '🎒 EQUIP';
      cta.textContent = `CLAIM ${plan.xp} XP ▸`; overlay.classList.add('on');
      try { if (opts.onWin) await opts.onWin({ xp: plan.xp, loot: items }); } catch (e) { }   // persist loot so it's equippable now
      eqBtn.onclick = () => { opts.onInventory && opts.onInventory(() => { }); };
      cta.onclick = () => { cleanup(); (opts.onContinue || opts.onExit || (() => {}))({ xp: plan.xp, loot: items }); };
    }
    function lose() {
      if (state === 'lost') return; state = 'lost'; teardownInput(); bSfx('lose');
      overH2.textContent = 'DEFEATED'; overlay.classList.add('lose');
      lootEl.innerHTML = '<div class="item">The Gatekeeper holds. Regroup and try again.</div>';
      eqBtn.style.display = ''; eqBtn.textContent = 'FLEE'; eqBtn.onclick = () => { cleanup(); opts.onExit && opts.onExit(); };
      cta.textContent = 'RETRY ▸'; overlay.classList.add('on');
      cta.onclick = () => { cleanup(); start(opts); };
    }

    // ---- loop / lifecycle ----
    function frame(ts) {
      const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; aliveFrames++;
      if (state === 'fight' && !paused) update(dt);
      render();
      raf = requestAnimationFrame(frame);
    }
    function teardownInput() { move.x = move.y = 0; }
    function cleanup() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); root.classList.remove('on'); root.innerHTML = ''; }

    // debug hook (handy for testing; harmless)
    window.__forgeBattle = () => ({ enemies: enemies.length, state, hearts: player.hearts, maxHearts: player.maxHearts, wave: waveIdx, boss: bossActive, loot: runLoot.length, px: player.x, py: player.y, elapsed, esc: 1 + Math.max(0, elapsed - RAGE_START) / RAGE_STEP, blocking: player.blocking, blockT: player.blockT, blockCd: player.blockCd, elist: enemies.map(e => ({ x: e.x, y: e.y, ai: e.ai, type: e.type, kbt: e.kbt })), specials: boss ? boss.specials.length : 0, pProjs: projs.filter(p => p.team === 'player').length, eProjs: projs.filter(p => p.team === 'enemy').length,
      mode: T.mode, obstacles: T.obstacles.length, pools: T.water.length, bushes: T.bush.length, hidden: heroHidden, pz: player.z,
      towers: enemies.filter(e => e.ai === 'tower').map(e => ({ x: e.x, y: e.y, hp: e.hp, aim: e.aim })), liveMobs: liveMobs() });

    // intro dialog, then first wave
    showDialog([dialog[0] || 'Ready your weapon.'], startNextWave);
    last = performance ? 0 : 0; raf = requestAnimationFrame(frame);

    return { cleanup };
  }

  window.ForgeBattle = { start, statsFor };
})();
