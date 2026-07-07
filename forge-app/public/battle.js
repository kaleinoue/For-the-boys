// ================= THE FORGE — Battle engine (canvas, mobile-first) =================
// window.ForgeBattle.start({ classId, questIndex, dialog?, equipped?, onWin, onExit })
// onWin({ xp, loot:[itemId,...] })   onExit() when the player flees a defeat.
(function () {
  const B = window.BATTLE;
  const HEART = 20;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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

    // ---- build DOM ----
    let root = document.getElementById('battle-root');
    if (!root) { root = document.createElement('div'); root.id = 'battle-root'; document.body.appendChild(root); }
    root.innerHTML = `
      <canvas id="battle-canvas"></canvas>
      <div class="b-hud"><span class="b-hearts"></span><button class="b-inv">🎒</button><span class="b-wave"></span></div>
      <div class="b-boss-wrap"><div class="b-boss-fill"></div></div>
      <div class="b-keys"></div>
      <div class="b-toast"></div>
      <div class="b-stick"><div class="nub"></div></div>
      <div class="b-btns"><button class="b-btn atk">ATK</button><button class="b-btn dodge">${cls.dodge === 'block' ? 'BLOCK' : 'DODGE'}</button></div>
      <div class="b-dialog"><div class="box"><div class="who">▸ THE FORGE</div><div class="line"></div><div class="tap">tap to continue ▸</div></div></div>
      <div class="b-overlay"><div><h2></h2><div class="b-loot"></div><div class="b-endbtns"><button class="eq">🎒 EQUIP</button><button class="cta"></button></div></div></div>`;
    root.classList.add('on');
    const cv = root.querySelector('#battle-canvas'), ctx = cv.getContext('2d');
    const heartsEl = root.querySelector('.b-hearts'), waveEl = root.querySelector('.b-wave');
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
      kh.textContent = `⌨  Move: WASD / Arrow keys   ·   Attack: J or Space   ·   ${cls.dodge === 'block' ? 'Block' : 'Dodge'}: K or Shift`;
      kh.classList.add('on'); setTimeout(() => kh.classList.remove('on'), 6500);
    }

    // ---- state ----
    const player = { x: W / 2, y: H * 0.7, r: 14, hp: stats.hp, max: stats.hp, face: { x: 0, y: -1 },
      atkCd: 0, dodgeCd: 0, iframe: 0, blocking: false, dashV: null };
    let enemies = [], projs = [], loot = [], fx = [];
    let waveIdx = -1, bossActive = false, boss = null, state = 'dialog', dlgQueue = [], runLoot = [], last = 0, raf = 0, aliveFrames = 0, paused = false, shake = 0;

    // open inventory mid-battle (pauses); resume recomputes stats from new gear
    function openInv() { if (paused || (state !== 'fight' && state !== 'dialog') || !opts.onInventory) return; paused = true; opts.onInventory(resumeFromInv); }
    function resumeFromInv(newEquipped, newLevels) {
      paused = false;
      if (newEquipped) { const old = player.max; stats = statsFor(opts.classId, newEquipped, newLevels); player.max = stats.hp; player.hp = clamp(player.hp + Math.max(0, player.max - old), 1, player.max); }
    }

    // ---- input ----
    const keys = {}; const press = { atk: false, dodge: false }; const move = { x: 0, y: 0 };
    const onKey = (e, d) => { keys[e.key.toLowerCase()] = d; if (d && (e.key === ' ' || e.key.toLowerCase() === 'j')) press.atk = true; if (d && (e.key.toLowerCase() === 'k' || e.key === 'Shift')) press.dodge = true; };
    const kd = e => onKey(e, true), ku = e => onKey(e, false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

    const stick = root.querySelector('.b-stick'), nub = stick.querySelector('.nub');
    let stickId = null, stickOrigin = null;
    stick.addEventListener('pointerdown', e => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); const r = stick.getBoundingClientRect(); stickOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    stick.addEventListener('pointermove', e => { if (e.pointerId !== stickId) return; let dx = e.clientX - stickOrigin.x, dy = e.clientY - stickOrigin.y; const m = Math.hypot(dx, dy) || 1, cap = 46; const mm = Math.min(m, cap); dx = dx / m * mm; dy = dy / m * mm; nub.style.transform = `translate(${dx}px,${dy}px)`; move.x = dx / cap; move.y = dy / cap; });
    const stickEnd = e => { if (e.pointerId !== stickId) return; stickId = null; move.x = move.y = 0; nub.style.transform = ''; };
    stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
    root.querySelector('.b-btn.atk').addEventListener('pointerdown', e => { e.preventDefault(); press.atk = true; });
    root.querySelector('.b-btn.dodge').addEventListener('pointerdown', e => { e.preventDefault(); press.dodge = true; });
    // use 'click' (not pointerdown): on touch, opening on pointerdown lets the
    // tap's click land on the modal backdrop and instantly close it.
    invBtn.addEventListener('click', () => openInv());

    // ---- dialog ----
    function showDialog(lines, then) { dlgQueue = lines.slice(); state = 'dialog'; nextLine(then); dlg.classList.add('on'); }
    function nextLine(then) { if (!dlgQueue.length) { dlg.classList.remove('on'); then && then(); return; } dlgLine.textContent = dlgQueue.shift(); dlg._then = then; }
    dlg.addEventListener('pointerdown', () => { if (state === 'dialog') nextLine(dlg._then); });

    // ---- waves ----
    function spawnEnemy(typeKey) {
      const t = B.ENEMIES[typeKey]; const edge = Math.floor(rand(0, 4));
      const p = edge === 0 ? { x: rand(20, W - 20), y: 20 } : edge === 1 ? { x: W - 20, y: rand(20, H - 20) } : edge === 2 ? { x: rand(20, W - 20), y: H - 20 } : { x: 20, y: rand(20, H - 20) };
      enemies.push({ type: typeKey, x: p.x, y: p.y, r: t.r, color: t.color, hp: Math.round(t.hp * plan.scale), max: Math.round(t.hp * plan.scale),
        atk: Math.round(t.atk * plan.scale), speed: t.speed, ai: t.ai, hitCd: 0, shotCd: rand(0.5, t.shotCd || 2), shotSpd: t.shotSpd });
    }
    function startNextWave() {
      waveIdx++;
      if (waveIdx < plan.waves.length) { plan.waves[waveIdx].forEach(spawnEnemy); state = 'fight'; updateWaveLabel(); }
      else { spawnBoss(); }
    }
    function spawnBoss() {
      bossActive = true; boss = { type: 'boss', x: W / 2, y: 80, r: B.BOSS.r, color: B.BOSS.color, hp: Math.round(B.BOSS.hp * (1 + (opts.questIndex||0)*0.08)),
        max: 0, atk: Math.round(B.BOSS.atk * plan.scale), speed: B.BOSS.speed, ai: 'boss', hitCd: 0, shotCd: 1, shotSpd: B.BOSS.shotSpd };
      boss.max = boss.hp; enemies.push(boss); bossWrap.classList.add('on'); state = 'fight'; waveEl.textContent = '☠ BOSS'; }
    function updateWaveLabel() { waveEl.textContent = `Wave ${waveIdx + 1}/${plan.waves.length}`; }

    // ---- combat helpers ----
    function hurtPlayer(dmg) {
      if (player.iframe > 0) return;
      let d = Math.max(1, dmg - stats.armor); if (player.blocking) d = Math.max(1, Math.round(d * 0.3));
      player.hp -= d; player.iframe = 0.5; fx.push({ t: 'hit', x: player.x, y: player.y, life: .2 }); shake = Math.min(12, shake + 7);
      if (player.hp <= 0) lose();
    }
    function damageEnemy(e, dmg) {
      e.hp -= dmg; fx.push({ t: 'spark', x: e.x, y: e.y, life: .15 });
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
      if (keys['arrowleft'] || keys['a']) ix -= 1; if (keys['arrowright'] || keys['d']) ix += 1;
      if (keys['arrowup'] || keys['w']) iy -= 1; if (keys['arrowdown'] || keys['s']) iy += 1;
      const im = Math.hypot(ix, iy); if (im > 1) { ix /= im; iy /= im; }
      if (im > 0.15) player.face = { x: ix, y: iy };
      let spd = stats.speed;
      if (player.dashV) { player.x += player.dashV.x * dt; player.y += player.dashV.y * dt; player.dashV.life -= dt; if (player.dashV.life <= 0) player.dashV = null; }
      else { player.x += ix * spd * dt; player.y += iy * spd * dt; }
      player.x = clamp(player.x, 16, W - 16); player.y = clamp(player.y, 60, H - 16);
      player.atkCd -= dt; player.dodgeCd -= dt; player.iframe -= dt; player.blocking = false;

      // dodge / block
      if (press.dodge && player.dodgeCd <= 0) {
        if (cls.dodge === 'block') { player.blocking = true; player.iframe = 0.35; player.dodgeCd = 0.6; }
        else { const f = player.face; player.dashV = { x: f.x * 520, y: f.y * 520, life: 0.16 }; player.iframe = 0.28; player.dodgeCd = 0.7; }
      }
      // holding block for vanguard while button held (approx via press flag each frame is one-shot; keep simple)
      press.dodge = false;

      // attack
      if (press.atk && player.atkCd <= 0) { doAttack(); player.atkCd = cls.cd; }
      press.atk = false;

      // enemies
      for (const e of enemies) {
        e.hitCd -= dt;
        const d = dist(e, player), dx = (player.x - e.x) / (d || 1), dy = (player.y - e.y) / (d || 1);
        if (e.ai === 'shooter' || e.ai === 'boss') {
          const want = e.ai === 'boss' ? 140 : 220;
          const dir = d > want ? 1 : d < want - 40 ? -1 : 0;
          e.x += dx * e.speed * dir * dt; e.y += dy * e.speed * dir * dt;
          e.shotCd -= dt;
          if (e.shotCd <= 0) { e.shotCd = e === boss ? 1.3 : (B.ENEMIES[e.type] ? B.ENEMIES[e.type].shotCd : 1.8);
            if (e.ai === 'boss') { for (const a of [-0.3, 0, 0.3]) fireEnemyShot(e, dx, dy, a); } else fireEnemyShot(e, dx, dy, 0); }
        } else { e.x += dx * e.speed * dt; e.y += dy * e.speed * dt; }
        e.x = clamp(e.x, 12, W - 12); e.y = clamp(e.y, 46, H - 12);
        if (d < e.r + player.r && e.hitCd <= 0) { hurtPlayer(e.atk); e.hitCd = 0.8; }
      }
      if (boss) bossFill.style.width = clamp(boss.hp / boss.max * 100, 0, 100) + '%';

      // projectiles
      for (const p of projs) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.team === 'player') { for (const e of enemies) if (dist(p, e) < e.r + 5) { damageEnemy(e, p.dmg); p.life = 0; break; } }
        else if (dist(p, player) < player.r + 5) { hurtPlayer(p.dmg); p.life = 0; }
      }
      projs = projs.filter(p => p.life > 0 && p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20);

      // loot pickups
      for (const l of loot) { if (dist(l, player) < player.r + l.r + 6) { grab(l); l.dead = true; } }
      loot = loot.filter(l => !l.dead);

      fx.forEach(f => f.life -= dt); fx = fx.filter(f => f.life > 0);

      // wave progression
      if (state === 'fight' && enemies.length === 0 && !bossActive) {
        if (waveIdx + 1 < plan.waves.length) { const line = dialog[(waveIdx + 1) % dialog.length]; showDialog([line], startNextWave); }
        else { showDialog(['The Gatekeeper approaches...'], startNextWave); }
      }
    }

    function doAttack() {
      if (cls.attack === 'shot') {
        let tx = player.face.x, ty = player.face.y; // auto-aim nearest for mobile feel
        let near = null, nd = 1e9; for (const e of enemies) { const d = dist(e, player); if (d < nd) { nd = d; near = e; } }
        if (near) { tx = (near.x - player.x) / (nd || 1); ty = (near.y - player.y) / (nd || 1); }
        projs.push({ x: player.x, y: player.y, vx: tx * 420, vy: ty * 420, life: 1.6, dmg: stats.atk, team: 'player', color: cls.accent });
        fx.push({ t: 'shot', x: player.x, y: player.y, life: .12 });
      } else if (cls.attack === 'burst') {
        for (const e of [...enemies]) if (dist(e, player) < cls.reach) damageEnemy(e, stats.atk);
        fx.push({ t: 'burst', x: player.x, y: player.y, r: cls.reach, life: .25, color: cls.accent });
      } else { // melee arc
        const fa = Math.atan2(player.face.y, player.face.x);
        for (const e of [...enemies]) { const d = dist(e, player); if (d > cls.reach + e.r) continue; const ea = Math.atan2(e.y - player.y, e.x - player.x); let diff = Math.abs(ea - fa); if (diff > Math.PI) diff = 2 * Math.PI - diff; if (diff < cls.arc / 2) damageEnemy(e, stats.atk); }
        fx.push({ t: 'slash', x: player.x, y: player.y, a: fa, reach: cls.reach, arc: cls.arc, life: .18, color: cls.accent });
      }
    }
    function fireEnemyShot(e, dx, dy, spread) { const a = Math.atan2(dy, dx) + spread; projs.push({ x: e.x, y: e.y, vx: Math.cos(a) * (e.shotSpd || 180), vy: Math.sin(a) * (e.shotSpd || 180), life: 3, dmg: e.atk, team: 'enemy', color: '#ff88aa' }); }
    function grab(l) {
      if (l.potion) { const h = l.heal || 24; player.hp = clamp(player.hp + h, 0, player.max); flash('+' + h + ' HP', '#5cff9d'); return; }
      runLoot.push(l.id); flash(B.GEAR[l.id].name + '!', B.TIER_COLOR[l.tier]); }
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
        blob(e.x, e.y, e.r, e.color, { eyes: true, dir: { x: player.x - e.x, y: player.y - e.y }, angry: e.type !== 'zap', outline: '#3a1226' });
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
      // hearts (DOM)
      const total = Math.max(1, Math.round(player.max / HEART)), filled = Math.max(0, Math.ceil(player.hp / HEART));
      heartsEl.textContent = '❤'.repeat(Math.min(filled, total)) + '🤍'.repeat(Math.max(0, total - filled));
    }
    function drawFx(f) {
      if (f.t === 'slash') { ctx.globalAlpha = Math.min(1, f.life * 5); ctx.lineCap = 'round';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(f.x, f.y, f.reach * 0.9, f.a - f.arc / 2, f.a + f.arc / 2); ctx.stroke();
        ctx.strokeStyle = f.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, f.reach * 0.9, f.a - f.arc / 2, f.a + f.arc / 2); ctx.stroke(); ctx.lineCap = 'butt'; ctx.globalAlpha = 1; }
      else if (f.t === 'burst') { ctx.globalAlpha = Math.min(1, f.life * 4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - f.life * 2.2), 0, 7); ctx.stroke(); ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - f.life * 2.2), 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      else if (f.t === 'pop') { ctx.globalAlpha = Math.min(1, f.life * 3); ctx.fillStyle = f.color; const rrad = 24 * (1 - f.life * 3); for (let i = 0; i < 8; i++) { const a = i / 8 * 7; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * rrad, f.y + Math.sin(a) * rrad, 4.5, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
      else if (f.t === 'hit') { ctx.globalAlpha = Math.min(1, f.life * 4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, 22 * (1 - f.life * 4) + 6, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    }

    // ---- end states ----
    async function win() {
      state = 'won'; teardownInput();
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
      if (state === 'lost') return; state = 'lost'; teardownInput();
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
    window.__forgeBattle = () => ({ enemies: enemies.length, state, hp: player.hp, max: player.max, wave: waveIdx, boss: bossActive, loot: runLoot.length });

    // intro dialog, then first wave
    showDialog([dialog[0] || 'Ready your weapon.'], startNextWave);
    last = performance ? 0 : 0; raf = requestAnimationFrame(frame);

    return { cleanup };
  }

  window.ForgeBattle = { start, statsFor };
})();
