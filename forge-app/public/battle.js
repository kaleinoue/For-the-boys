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
      <div class="b-hud"><button class="b-inv">🎒</button><span class="b-wave"></span></div>
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
    const invBtn = root.querySelector('.b-inv'), eqBtn = overlay.querySelector('.eq');

    let W = 0, H = 0, DPR = Math.min(2, window.devicePixelRatio || 1);
    function resize() { W = root.clientWidth; H = root.clientHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
    resize(); window.addEventListener('resize', resize);

    // On desktop (no touch), show a controls hint at the start; it auto-hides.
    if (!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) {
      const kh = root.querySelector('.b-keys');
      kh.textContent = `⌨  Move: ${(KEYS.up + KEYS.left + KEYS.down + KEYS.right).toUpperCase()} / Arrows   ·   Attack: ${KEYS.attack.toUpperCase()} or Space   ·   ${cls.dodge === 'block' ? 'Block' : 'Dodge'}: ${KEYS.dodge.toUpperCase()} or Shift`;
      kh.classList.add('on'); setTimeout(() => kh.classList.remove('on'), 6500);
    }

    // ---- state ----
    const HEART_HP = 22;
    const player = { x: W / 2, y: H * 0.7, r: 14, maxHearts: Math.max(3, Math.round(stats.hp / HEART_HP)), face: { x: 0, y: -1 },
      atkCd: 0, dodgeCd: 0, iframe: 0, blocking: false, dashV: null, blockT: 0, blockCd: 0, kbx: 0, kby: 0, kbt: 0 };
    player.hearts = player.maxHearts;
    let enemies = [], projs = [], loot = [], fx = [];
    let waveIdx = -1, bossActive = false, boss = null, state = 'dialog', dlgQueue = [], runLoot = [], last = 0, raf = 0, aliveFrames = 0, paused = false, shake = 0;
    let elapsed = 0, raged = false, warned = false;   // active-fight seconds; after RAGE_START the horde escalates (speed/attack/range)
    const RAGE_START = 60;             // frenzy begins at 60s and steps up every 60s; warning fires 15s before

    // open inventory mid-battle (pauses); resume recomputes stats from new gear
    function openInv() { if (paused || (state !== 'fight' && state !== 'dialog') || !opts.onInventory) return; paused = true; opts.onInventory(resumeFromInv); }
    function resumeFromInv(newEquipped, newLevels) {
      paused = false;
      if (newEquipped) { const old = player.maxHearts; stats = statsFor(opts.classId, newEquipped, newLevels); player.maxHearts = Math.max(3, Math.round(stats.hp / HEART_HP)); player.hearts = clamp(player.hearts + Math.max(0, player.maxHearts - old), 0.25, player.maxHearts); }
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
      const t = B.ENEMIES[typeKey] || B.ENEMIES.grunt; let p = pos;
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') { const edge = Math.floor(rand(0, 4)); p = edge === 0 ? { x: rand(20, W - 20), y: 20 } : edge === 1 ? { x: W - 20, y: rand(20, H - 20) } : edge === 2 ? { x: rand(20, W - 20), y: H - 20 } : { x: 20, y: rand(20, H - 20) }; }
      const hp = Math.round(t.hp * plan.hpScale);
      enemies.push({ type: typeKey, x: p.x, y: p.y, r: t.r, color: t.color, hp, max: hp,
        atk: Math.round(t.atk * plan.atkScale), speed: t.speed, ai: t.ai, hitCd: 0, shotCd: rand(0.5, t.shotCd || 2), shotSpd: t.shotSpd,
        flankDir: Math.random() < 0.5 ? 1 : -1, dashCd: rand(1.5, 3.2), dashV: null, kbx: 0, kby: 0, kbt: 0, phase: rand(0, 6) });
    }
    function startNextWave() {
      waveIdx++;
      if (waveIdx < plan.waves.length) { plan.waves[waveIdx].forEach(t => spawnEnemy(t)); state = 'fight'; updateWaveLabel(); }
      else { spawnBoss(); }
    }
    function spawnBoss() {
      bossActive = true;
      const hp = Math.round(B.BOSS.hp * (1 + plan.level * 0.16));
      boss = { type: 'boss', x: W / 2, y: 80, r: B.BOSS.r, color: B.BOSS.color, hp, max: hp,
        atk: Math.round(B.BOSS.atk * (1 + plan.level * 0.12)), speed: B.BOSS.speed, ai: 'boss', hitCd: 0, shotSpd: B.BOSS.shotSpd,
        core: ['spread', 'charge', 'ring'], coreIdx: 0, actCd: 1.2, doSpecial: false, charge: null, burst: null,
        specials: ['aimed', 'summon', 'cross', 'spiral', 'nova'].slice(0, Math.min(5, plan.level)) };  // +1 random special per level
      enemies.push(boss); bossWrap.classList.add('on'); state = 'fight'; waveEl.textContent = '☠ BOSS'; bSfx('boss'); }
    function updateWaveLabel() { waveEl.textContent = `Wave ${waveIdx + 1}/${plan.waves.length}`; }

    // ---- combat helpers ----
    function hurtPlayer(dmg, sx, sy) {
      if (player.iframe > 0) return;                 // dodging / just-hit i-frames = no damage (misses never call this)
      let hearts = 1, label = '-1';                  // clean hit = 1 heart
      if (player.blocking) {
        // hit is "front" if the attacker is in the direction the player faces
        let ax = (sx != null ? sx - player.x : -player.face.x), ay = (sy != null ? sy - player.y : -player.face.y);
        const m = Math.hypot(ax, ay) || 1; const front = ((ax / m) * player.face.x + (ay / m) * player.face.y) > 0;
        hearts = front ? 0.25 : 0.5; label = front ? '-¼' : '-½';
      }
      player.hearts = Math.max(0, Math.round((player.hearts - hearts) * 4) / 4);
      player.iframe = 0.5; shake = Math.min(12, shake + (hearts >= 1 ? 8 : 4)); bSfx('hurt');
      if (sx != null) knock(player, sx, sy, player.blocking ? 120 : 300);   // clean hits shove you back harder than blocked ones
      fx.push({ t: 'dmg', x: player.x, y: player.y, life: .8, text: label });   // floats over the head
      if (player.hearts <= 0) lose();
    }
    function damageEnemy(e, dmg, sx, sy) {
      e.hp -= dmg; fx.push({ t: 'spark', x: e.x, y: e.y, life: .15 }); bSfx('deal');
      knock(e, sx != null ? sx : player.x, sy != null ? sy : player.y, 300);   // hits bounce enemies back
      if (e.hp <= 0) { killEnemy(e); }
    }
    function killEnemy(e) {
      enemies = enemies.filter(x => x !== e);
      fx.push({ t: 'pop', x: e.x, y: e.y, life: .3, color: e.color });
      if (e === boss) { const myth = B.MYTHIC_BY_CLASS[opts.classId]; runLoot.push(opts.hasMythic ? pickTier('Legendary') : myth, pickTier('Legendary')); boss = null; bossActive = false; win(); return; }
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

      // movement (blocking slows you down); knockback shove is added on top
      const spd = stats.speed * (player.blocking ? 0.55 : 1);
      if (player.dashV) { player.x += player.dashV.x * dt; player.y += player.dashV.y * dt; player.dashV.life -= dt; if (player.dashV.life <= 0) player.dashV = null; }
      else { player.x += ix * spd * dt; player.y += iy * spd * dt; }
      if (player.kbt > 0) { player.x += player.kbx * dt; player.y += player.kby * dt; player.kbt -= dt; }
      player.x = clamp(player.x, 16, W - 16); player.y = clamp(player.y, 60, H - 16);

      // attack
      if (press.atk && player.atkCd <= 0) { doAttack(); player.atkCd = cls.cd; }
      press.atk = false;

      // enemies — the horde grows frenzied at RAGE_START and steps up every 60s (faster travel, attack speed, range).
      elapsed += dt;
      if (!warned && elapsed >= RAGE_START - 15) { warned = true; flash('⚠ RAGE INCOMING — 15s', '#ffd15c'); bSfx('shot'); }
      if (!raged && elapsed >= RAGE_START) { raged = true; flash('THE HORDE GROWS FRENZIED!', '#ff5d5d'); bSfx('boss'); }
      const esc = 1 + Math.max(0, elapsed - RAGE_START) / 60;   // 1x, then climbs uncapped, +1x every 60s
      for (const e of enemies) {
        e.hitCd -= dt;
        const d = dist(e, player), dx = (player.x - e.x) / (d || 1), dy = (player.y - e.y) / (d || 1);
        if (e.ai === 'boss') { bossUpdate(e, dt, dx, dy, d); }
        else if (e.ai === 'shooter') {                       // keep range + coordinate spacing; frenzy adds range + fire rate
          const want = 210 + 70 * (esc - 1); const dir = d > want ? 1 : d < want - 40 ? -1 : 0;
          let sx = 0, sy = 0; for (const o of enemies) { if (o === e || o.ai === 'boss') continue; const dd = dist(o, e); if (dd > 0 && dd < 44) { sx += (e.x - o.x) / dd; sy += (e.y - o.y) / dd; } }
          e.x += (dx * dir + sx * plan.coord * 0.8) * e.speed * esc * dt; e.y += (dy * dir + sy * plan.coord * 0.8) * e.speed * esc * dt;
          e.shotCd -= dt; if (e.shotCd <= 0) { e.shotCd = ((B.ENEMIES[e.type] && B.ENEMIES[e.type].shotCd) || 1.8) * (1 - plan.coord * 0.35) / esc; fireEnemyShot(e, dx, dy, 0, esc); }
        } else {                                              // melee: surround the hero, with an occasional dash lunge
          e.dashCd -= dt;
          if (e.dashV && e.dashV.t > 0) { e.x += e.dashV.x * dt; e.y += e.dashV.y * dt; e.dashV.t -= dt; }
          else if (e.dashCd <= 0 && d < 175 && d > 24) {      // small dash attack toward the hero
            e.dashV = { x: dx * e.speed * 4.4, y: dy * e.speed * 4.4, t: 0.18 }; e.dashCd = rand(2.2, 3.8) / esc; bSfx('attack');
          } else {
            const c = plan.coord; let mvx = dx, mvy = dy;
            mvx += -dy * (0.6 + 0.5 * c) * e.flankDir; mvy += dx * (0.6 + 0.5 * c) * e.flankDir;   // tangential = ring/surround the hero
            for (const o of enemies) { if (o === e || o.ai === 'boss') continue; const dd = dist(o, e); if (dd > 0 && dd < 40) { mvx += (e.x - o.x) / dd * (0.6 + c * 0.8); mvy += (e.y - o.y) / dd * (0.6 + c * 0.8); } }
            const mm = Math.hypot(mvx, mvy) || 1; e.x += mvx / mm * e.speed * esc * dt; e.y += mvy / mm * e.speed * esc * dt;
          }
        }
        if (e.kbt > 0) { e.x += e.kbx * dt; e.y += e.kby * dt; e.kbt -= dt; }   // bounce-back from being hit
        e.x = clamp(e.x, 12, W - 12); e.y = clamp(e.y, 46, H - 12);
        if (d < e.r + player.r && e.hitCd <= 0) { hurtPlayer(e.atk, e.x, e.y); e.hitCd = 0.8 / esc; }   // frenzy = faster melee swings
      }
      if (boss) bossFill.style.width = clamp(boss.hp / boss.max * 100, 0, 100) + '%';

      // projectiles
      for (const p of projs) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.team === 'player') { for (const e of enemies) if (dist(p, e) < e.r + 5) { damageEnemy(e, p.dmg, p.x - p.vx * 0.02, p.y - p.vy * 0.02); p.life = 0; break; } }
        else if (dist(p, player) < player.r + 5) { hurtPlayer(p.dmg, p.x, p.y); p.life = 0; }
      }
      projs = projs.filter(p => p.life > 0 && p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20);

      // loot pickups
      for (const l of loot) { if (dist(l, player) < player.r + l.r + 6) { if (grab(l) !== false) l.dead = true; } }
      loot = loot.filter(l => !l.dead);

      fx.forEach(f => f.life -= dt); fx = fx.filter(f => f.life > 0);

      // wave progression
      if (state === 'fight' && enemies.length === 0 && !bossActive) {
        if (waveIdx + 1 < plan.waves.length) { const line = dialog[(waveIdx + 1) % dialog.length]; showDialog([line], startNextWave); }
        else { showDialog(['The Gatekeeper approaches...'], startNextWave); }
      }
    }

    function doAttack() {
      bSfx('attack');
      if (cls.attack === 'shot') {
        let tx = player.face.x, ty = player.face.y; // auto-aim nearest for mobile feel
        let near = null, nd = 1e9; for (const e of enemies) { const d = dist(e, player); if (d < nd) { nd = d; near = e; } }
        if (near) { tx = (near.x - player.x) / (nd || 1); ty = (near.y - player.y) / (nd || 1); }
        projs.push({ x: player.x, y: player.y, vx: tx * 420, vy: ty * 420, life: 1.6, dmg: stats.atk, team: 'player', color: cls.accent });
        fx.push({ t: 'shot', x: player.x, y: player.y, life: .12 });
      } else if (cls.attack === 'burst') {
        for (const e of [...enemies]) if (dist(e, player) < cls.reach) damageEnemy(e, stats.atk);
        fx.push({ t: 'burst', x: player.x, y: player.y, r: cls.reach, life: .25, color: cls.accent });
      } else if (cls.attack === 'spellblade') {   // dual: melee arc up close + a homing magic bolt at range
        const fa = Math.atan2(player.face.y, player.face.x);
        for (const e of [...enemies]) { const d = dist(e, player); if (d > cls.reach + e.r) continue; const ea = Math.atan2(e.y - player.y, e.x - player.x); let diff = Math.abs(ea - fa); if (diff > Math.PI) diff = 2 * Math.PI - diff; if (diff < cls.arc / 2) damageEnemy(e, stats.atk); }
        fx.push({ t: 'slash', x: player.x, y: player.y, a: fa, reach: cls.reach, arc: cls.arc, life: .18, color: cls.accent });
        let tx = player.face.x, ty = player.face.y, near = null, nd = 1e9;   // magic bolt auto-aims nearest
        for (const e of enemies) { const d = dist(e, player); if (d < nd) { nd = d; near = e; } }
        if (near) { tx = (near.x - player.x) / (nd || 1); ty = (near.y - player.y) / (nd || 1); }
        projs.push({ x: player.x, y: player.y, vx: tx * 460, vy: ty * 460, life: 1.5, dmg: Math.max(1, Math.round(stats.atk * 0.6)), team: 'player', color: cls.accent });
        fx.push({ t: 'shot', x: player.x, y: player.y, life: .12 });
      } else { // melee arc
        const fa = Math.atan2(player.face.y, player.face.x);
        for (const e of [...enemies]) { const d = dist(e, player); if (d > cls.reach + e.r) continue; const ea = Math.atan2(e.y - player.y, e.x - player.x); let diff = Math.abs(ea - fa); if (diff > Math.PI) diff = 2 * Math.PI - diff; if (diff < cls.arc / 2) damageEnemy(e, stats.atk); }
        fx.push({ t: 'slash', x: player.x, y: player.y, a: fa, reach: cls.reach, arc: cls.arc, life: .18, color: cls.accent });
      }
    }
    function fireEnemyShot(e, dx, dy, spread, mult) { const m = mult || 1; const a = Math.atan2(dy, dx) + spread; const sp = (e.shotSpd || 180) * m; projs.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 3 * m, dmg: e.atk, team: 'enemy', color: '#ff88aa' }); }   // mult (frenzy) scales speed AND lifetime = more range
    function mkEShot(e, ux, uy) { projs.push({ x: e.x, y: e.y, vx: ux * (e.shotSpd || 200), vy: uy * (e.shotSpd || 200), life: 3.2, dmg: e.atk, team: 'enemy', color: '#ff88aa' }); }
    // Boss AI: cycles 3 core patterns + fires a random "special" (one more per difficulty level).
    function bossUpdate(e, dt, dx, dy, d) {
      if (e.charge) { e.x += e.charge.x * dt; e.y += e.charge.y * dt; e.charge.t -= dt; if (e.charge.t <= 0) e.charge = null; }
      else { const want = 150; const dir = d > want + 30 ? 1 : d < want - 30 ? -1 : 0; e.x += dx * e.speed * 0.6 * dir * dt; e.y += dy * e.speed * 0.6 * dir * dt; }
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
      if (kind === 'spread') { for (const a of [-0.4, -0.2, 0, 0.2, 0.4]) fireEnemyShot(e, dx, dy, a); bSfx('shot'); }
      else if (kind === 'ring') { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832; mkEShot(e, Math.cos(a), Math.sin(a)); } bSfx('boss'); }
      else if (kind === 'charge') { e.charge = { x: nx * 380, y: ny * 380, t: 0.5 }; bSfx('boss'); }
      else if (kind === 'nova') { for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832; mkEShot(e, Math.cos(a), Math.sin(a)); } bSfx('boss'); }
      else if (kind === 'summon') { const k = 1 + Math.floor(Math.random() * 2); for (let i = 0; i < k; i++) spawnEnemy('grunt', { x: e.x + rand(-30, 30), y: e.y + rand(20, 44) }); bSfx('boss'); }
      else if (kind === 'aimed') { e.burst = { mode: 'aim', n: 5, interval: 0.12, t: 0 }; }
      else if (kind === 'cross') { e.burst = { mode: 'cross', n: 3, interval: 0.18, t: 0, ang: 0 }; }
      else if (kind === 'spiral') { e.burst = { mode: 'spiral', n: 16, interval: 0.06, t: 0, ang: Math.random() * 6.2832 }; }
    }
    function bossBurst(e) {
      if (e.burst.mode === 'aim') fireEnemyShot(e, (player.x - e.x), (player.y - e.y), rand(-0.06, 0.06));
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
    function shadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.82, r * 0.95, r * 0.42, 0, 0, 7); ctx.fill(); }
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
    function drawSprite(e, img, frames) {
      shadow(e.x, e.y, e.r);
      const fw = img.width / frames;
      const fps = e.dashV ? 15 : 8;                                  // dashing = faster cycle
      const hold = Math.max(1, Math.round(60 / fps));
      const fi = Math.floor((aliveFrames + e.phase * 7) / hold) % frames;
      const size = e.r * 2.7;
      const bob = Math.sin((aliveFrames + e.phase * 10) / 6) * (e.r * 0.06);
      let sx = 1, sy = 1;
      if (e.kbt > 0) { sx = 1.18; sy = 0.82; }                        // squash when knocked back
      else if (e.dashV && e.dashV.t > 0) { sx = 0.86; sy = 1.16; }    // stretch into a dash lunge
      const faceLeft = (player.x - e.x) < 0;
      ctx.save();
      ctx.translate(e.x, e.y + bob);
      ctx.scale((faceLeft ? -1 : 1) * sx, sy);
      ctx.drawImage(img, fi * fw, 0, fw, img.height, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    function render() {
      ctx.save();
      if (shake > 0.3) { ctx.translate(rand(-shake, shake), rand(-shake, shake)); shake *= 0.86; } else shake = 0;
      // arena floor
      ctx.fillStyle = '#4fa84f'; ctx.fillRect(-16, -16, W + 32, H + 32);
      const T = 60; ctx.fillStyle = '#59b559';
      for (let yy = 44; yy < H; yy += T) for (let xx = 0; xx < W; xx += T) if (((xx / T | 0) + (yy / T | 0)) % 2) ctx.fillRect(xx, yy, T, T);
      ctx.strokeStyle = '#2f6b35'; ctx.lineWidth = 14; rr(10, 52, W - 20, H - 62, 22); ctx.stroke();
      // loot
      for (const l of loot) {
        if (l.potion) { shadow(l.x, l.y, l.r); ctx.fillStyle = '#ff5d7a'; heartShape(l.x, l.y - l.r * 0.4, l.r * 1.1); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#a01030'; ctx.stroke(); continue; }
        shadow(l.x, l.y, l.r); const bob = Math.sin((aliveFrames + l.x) / 12) * 2;
        ctx.save(); ctx.translate(l.x, l.y + bob); ctx.rotate(0.78);
        ctx.fillStyle = B.TIER_COLOR[l.tier]; rr(-l.r, -l.r, l.r * 2, l.r * 2, 3); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#1a1030'; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.55)'; rr(-l.r * 0.7, -l.r * 0.7, l.r * 0.55, l.r * 0.55, 2); ctx.fill(); ctx.restore();
      }
      // enemies
      for (const e of enemies) {
        const def = B.ENEMIES[e.type], sp = def && def.sprite ? spriteImg(def) : null;
        if (sp) drawSprite(e, sp, def.frames || 4);
        else blob(e.x, e.y, e.r, e.color, { eyes: true, dir: { x: player.x - e.x, y: player.y - e.y }, angry: e.type !== 'zap', outline: '#3a1226' });
        if (e.ai === 'boss') { ctx.fillStyle = '#ffd15c'; const cw = e.r * 0.85, ty = e.y - e.r * 0.92; ctx.beginPath(); ctx.moveTo(e.x - cw, ty); ctx.lineTo(e.x - cw * 0.5, ty - e.r * 0.5); ctx.lineTo(e.x, ty); ctx.lineTo(e.x + cw * 0.5, ty - e.r * 0.5); ctx.lineTo(e.x + cw, ty); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#a2701a'; ctx.stroke(); }
        if (e.hp < e.max) { const w = e.r * 2.2, bx = e.x - w / 2, by = e.y - e.r - 15, h = 7;
          rr(bx, by, w, h, 4); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();
          rr(bx, by, Math.max(0, w * (e.hp / e.max)), h, 4); ctx.fillStyle = e.ai === 'boss' ? '#ff4d6d' : '#5ce65c'; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.4)'; rr(bx, by, w, h, 4); ctx.stroke(); }
      }
      // projectiles
      for (const p of projs) {
        shadow(p.x, p.y, 6); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(p.x - 2, p.y - 2, 3, 0, 7); ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = p.team === 'enemy' ? '#7a1030' : '#1a3a5a'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.stroke();
      }
      // player
      const flash = player.iframe > 0 && Math.floor(player.iframe * 20) % 2;
      blob(player.x, player.y, player.r, cls.color, { eyes: true, dir: player.face, flash, outline: '#1a1030' });
      if (player.blocking) { ctx.strokeStyle = '#8fd3ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(player.x, player.y, player.r + 8, 0, 7); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, player.r + 8, 0, 7); ctx.stroke(); }
      // fx on top
      for (const f of fx) drawFx(f);
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
    function drawFx(f) {
      if (f.t === 'slash') { ctx.globalAlpha = Math.min(1, f.life * 5); ctx.lineCap = 'round';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(f.x, f.y, f.reach * 0.9, f.a - f.arc / 2, f.a + f.arc / 2); ctx.stroke();
        ctx.strokeStyle = f.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, f.reach * 0.9, f.a - f.arc / 2, f.a + f.arc / 2); ctx.stroke(); ctx.lineCap = 'butt'; ctx.globalAlpha = 1; }
      else if (f.t === 'burst') { ctx.globalAlpha = Math.min(1, f.life * 4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - f.life * 2.2), 0, 7); ctx.stroke(); ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - f.life * 2.2), 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      else if (f.t === 'pop') { ctx.globalAlpha = Math.min(1, f.life * 3); ctx.fillStyle = f.color; const rrad = 24 * (1 - f.life * 3); for (let i = 0; i < 8; i++) { const a = i / 8 * 7; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * rrad, f.y + Math.sin(a) * rrad, 4.5, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
      else if (f.t === 'hit') { ctx.globalAlpha = Math.min(1, f.life * 4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, 22 * (1 - f.life * 4) + 6, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      else if (f.t === 'dmg') { ctx.globalAlpha = Math.min(1, f.life * 1.6); ctx.fillStyle = '#ff3b5c'; ctx.strokeStyle = '#5a0010'; ctx.lineWidth = 3; ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center'; const ty = f.y - player.r - 14 - (0.8 - f.life) * 42; ctx.strokeText(f.text, f.x, ty); ctx.fillText(f.text, f.x, ty); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
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
    window.__forgeBattle = () => ({ enemies: enemies.length, state, hearts: player.hearts, maxHearts: player.maxHearts, wave: waveIdx, boss: bossActive, loot: runLoot.length, px: player.x, py: player.y, elapsed, esc: 1 + Math.max(0, elapsed - RAGE_START) / 60, blocking: player.blocking, blockT: player.blockT, blockCd: player.blockCd, elist: enemies.map(e => ({ x: e.x, y: e.y, ai: e.ai, type: e.type, kbt: e.kbt })), specials: boss ? boss.specials.length : 0, pProjs: projs.filter(p => p.team === 'player').length });

    // intro dialog, then first wave
    showDialog([dialog[0] || 'Ready your weapon.'], startNextWave);
    last = performance ? 0 : 0; raf = requestAnimationFrame(frame);

    return { cleanup };
  }

  window.ForgeBattle = { start, statsFor };
})();
