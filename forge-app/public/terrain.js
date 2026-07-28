// ============ THE FORGE — Battle terrain (environment per level) ============
// The arena stops being a flat green box. Each level adds one new thing to
// fight around, and the features stack as you climb:
//
//   L1  plain field                     (unchanged — the tutorial arena)
//   L2  + solid obstacles               block movement, shots AND line of sight
//   L3  + water                         slows heroes and melee mobs; shots fly over
//   L4  + shooting towers               enemy turrets: telegraph, fire, can be destroyed
//   L5  the battlefield goes 3D         tilted view with real elevation, laid out
//                                       as a MOBA map: 3 lanes, a river, jungle
//                                       bush you can vanish in, high-ground bases
//
// Everything here is pure geometry + drawing. battle.js owns the fighting and
// asks this module questions ("can I stand here?", "can that mob see me?").
//
//   const T = ForgeTerrain.build(level, W, H);
//   T.move(ent, nx, ny, r)   T.slowAt(x,y)   T.losClear(a,b)   T.bushAt(x,y)
//   T.py(y, z)               T.heightAt(x,y) T.drawGround(ctx)  T.props
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Deterministic RNG — a level's layout is identical every attempt, so the
  // crew can learn a map instead of re-reading a new one after every death.
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // ---- per-level recipe -----------------------------------------------------
  // Counts, not coordinates: layouts are generated from these + a seed, which is
  // what makes the God Mode terrain editor a handful of knobs instead of a
  // map editor. `key` levels are 1..5; anything past 5 runs the level-5 map.
  const DEFAULTS = {
    1: { mode: 'flat', rocks: 0, crates: 0, pools: 0, towers: 0, bush: 0 },
    2: { mode: 'flat', rocks: 5, crates: 3, pools: 0, towers: 0, bush: 0 },
    3: { mode: 'flat', rocks: 5, crates: 3, pools: 3, towers: 0, bush: 0 },
    4: { mode: 'flat', rocks: 5, crates: 2, pools: 3, towers: 3, bush: 0, towerCd: 3.0, towerRange: 240 },
    5: { mode: 'iso', moba: true, rocks: 3, crates: 2, pools: 1, towers: 4, bush: 6 },
  };
  const TUNING = { towerHp: 70, towerRange: 250, towerCd: 2.6, waterSlow: 0.45, seed: 0 };
  const planKey = (level) => level <= 1 ? 1 : level >= 5 ? 5 : level;
  function planFor(level) {
    const key = planKey(level);
    const gm = (window.BATTLE && window.BATTLE.terrainCfgFor) ? window.BATTLE.terrainCfgFor(level, key) : null;
    return Object.assign({ key, level }, TUNING, DEFAULTS[key], gm || {});
  }

  // ---- shape helpers (obstacles are circles or axis-aligned rects) ----------
  function overlaps(o, x, y, r) {
    if (o.shape === 'circ') return Math.hypot(x - o.x, y - o.y) < o.r + r;
    const dx = Math.abs(x - o.x) - o.hw, dy = Math.abs(y - o.y) - o.hh;
    if (dx <= 0 && dy <= 0) return true;
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) < r;
  }
  function pushOut(o, e, r) {                    // shove an entity to the nearest free spot
    if (o.shape === 'circ') {
      const d = Math.hypot(e.x - o.x, e.y - o.y) || 0.01, need = o.r + r - d;
      if (need > 0) { e.x += (e.x - o.x) / d * need; e.y += (e.y - o.y) / d * need; }
      return;
    }
    const dx = e.x - o.x, dy = e.y - o.y;
    const px = o.hw + r - Math.abs(dx), py = o.hh + r - Math.abs(dy);
    if (px <= 0 || py <= 0) return;
    if (px < py) e.x += (dx < 0 ? -1 : 1) * px; else e.y += (dy < 0 ? -1 : 1) * py;   // least penetration
  }
  const inRect = (r, x, y) => x > r.x - r.hw && x < r.x + r.hw && y > r.y - r.hh && y < r.y + r.hh;
  const inZone = (z, x, y) => z.shape === 'circ' ? Math.hypot(x - z.x, y - z.y) < z.r : inRect(z, x, y);

  function build(level, W, H) {
    const p = planFor(level);
    const iso = p.mode === 'iso';
    const rand = rng(((p.seed | 0) || 0) * 7919 + p.key * 101 + 13);

    // ---- the view ----------------------------------------------------------
    // Flat levels: world == screen, so every existing number still means what it
    // meant. Iso: the world is TALLER than the screen and gets squashed on the
    // way out, which is what sells the tilt. Combat math never leaves world space.
    const SQ = iso ? 0.62 : 1;                       // vertical squash
    const ZH = iso ? 34 : 0;                         // screen pixels per 1.0 of elevation
    const TOP = iso ? 66 : 0;                        // screen y where the world starts
    const WW = W;                                    // world width  == screen width
    const WH = iso ? (H - TOP - 12) / SQ : H;        // world height (taller than the screen)
    const bounds = iso ? { minX: 18, maxX: W - 18, minY: 14, maxY: WH - 14 }
                       : { minX: 16, maxX: W - 16, minY: 60, maxY: H - 16 };
    const py = (y, z) => TOP + y * SQ - (z || 0) * ZH;     // world y (+elevation) -> screen y

    const obstacles = [], water = [], bush = [], plateaus = [], ramps = [], towerSpots = [];
    const heroStart = { x: WW / 2, y: WH * (p.moba ? 0.93 : iso ? 0.82 : 0.7) };   // MOBA: you start on your own high ground
    const bossStart = { x: WW / 2, y: iso ? WH * 0.12 : bounds.minY + 24 };

    // Keep these clear or the fight jams: hero spawn, boss spawn, and the four
    // screen edges mobs walk in from.
    const keepClear = [{ x: heroStart.x, y: heroStart.y, r: 92 }, { x: bossStart.x, y: bossStart.y, r: 92 }];
    const tooClose = (x, y, r) => keepClear.some(k => Math.hypot(x - k.x, y - k.y) < k.r + r)
      || obstacles.some(o => overlaps(o, x, y, r + 26))
      || x - r < bounds.minX + 8 || x + r > bounds.maxX - 8 || y - r < bounds.minY + 8 || y + r > bounds.maxY - 8;

    function scatter(n, make, tries) {
      for (let i = 0; i < n; i++) {
        for (let t = 0; t < (tries || 40); t++) {
          const o = make(rand);
          if (!tooClose(o.x, o.y, o.shape === 'circ' ? o.r : Math.max(o.hw, o.hh))) { obstacles.push(o); break; }
        }
      }
    }

    if (p.moba) {
      // ---- MOBA map: 3 lanes, a river, jungle bush, two high-ground bases ----
      const laneX = [WW * 0.17, WW * 0.5, WW * 0.83];
      const wallX = [WW * 0.335, WW * 0.665];          // jungle walls between the lanes
      // Jungle walls, broken into blocks so you can cut between lanes.
      for (const wx of wallX) {
        for (const seg of [[0.10, 0.30], [0.38, 0.47], [0.60, 0.72], [0.78, 0.94]]) {
          const y0 = WH * seg[0], y1 = WH * seg[1];
          obstacles.push({ shape: 'rect', kind: 'jungle', x: wx, y: (y0 + y1) / 2, hw: 26, hh: (y1 - y0) / 2, tall: 46, blocksShot: true });
        }
      }
      // The river: a band straight across the middle. Slows you, doesn't stop you.
      water.push({ shape: 'rect', x: WW / 2, y: WH * 0.5, hw: WW / 2, hh: WH * 0.075 });
      // Bases: raised platforms at each end, reachable by a centre ramp.
      plateaus.push({ shape: 'rect', x: WW / 2, y: WH * 0.938, hw: WW * 0.30, hh: WH * 0.062, z: 1 });
      plateaus.push({ shape: 'rect', x: WW / 2, y: WH * 0.062, hw: WW * 0.30, hh: WH * 0.062, z: 1 });
      ramps.push({ shape: 'rect', x: WW / 2, y: WH * 0.855, hw: 62, hh: WH * 0.045, axis: 'y', from: 0, to: 1, dir: 1 });
      ramps.push({ shape: 'rect', x: WW / 2, y: WH * 0.145, hw: 62, hh: WH * 0.045, axis: 'y', from: 0, to: 1, dir: -1 });
      // Bush in the jungle: stand in it and the horde loses track of you.
      const bushSpots = [[0.335, 0.34], [0.665, 0.34], [0.335, 0.66], [0.665, 0.66], [0.17, 0.5], [0.83, 0.5], [0.5, 0.26], [0.5, 0.74]];
      for (let i = 0; i < Math.min(p.bush, bushSpots.length); i++)
        bush.push({ shape: 'rect', x: WW * bushSpots[i][0], y: WH * bushSpots[i][1], hw: 46, hh: 30 });
      // Towers guard the lane mouths on the enemy half.
      const towerSpotsMoba = [[laneX[0], WH * 0.24], [laneX[2], WH * 0.24], [laneX[1], WH * 0.2], [laneX[0], WH * 0.42], [laneX[2], WH * 0.42], [laneX[1], WH * 0.62]];
      for (let i = 0; i < Math.min(p.towers, towerSpotsMoba.length); i++) towerSpots.push({ x: towerSpotsMoba[i][0], y: towerSpotsMoba[i][1] });
      // A few loose rocks so the lanes aren't bare corridors.
      scatter(p.rocks, r => ({ shape: 'circ', kind: 'rock', x: laneX[Math.floor(r() * 3)] + (r() - 0.5) * 90, y: WH * (0.2 + r() * 0.6), r: 16 + r() * 8, tall: 24, blocksShot: true }));
      scatter(p.crates, r => ({ shape: 'rect', kind: 'crate', x: laneX[Math.floor(r() * 3)] + (r() - 0.5) * 70, y: WH * (0.25 + r() * 0.5), hw: 19, hh: 19, tall: 34, blocksShot: true }));
    } else {
      // ---- open arena: scattered cover, pools, turrets ----------------------
      scatter(p.rocks, r => ({ shape: 'circ', kind: 'rock', x: bounds.minX + r() * (bounds.maxX - bounds.minX), y: bounds.minY + r() * (bounds.maxY - bounds.minY), r: 18 + r() * 12, tall: 26, blocksShot: true }));
      scatter(p.crates, r => ({ shape: 'rect', kind: 'crate', x: bounds.minX + r() * (bounds.maxX - bounds.minX), y: bounds.minY + r() * (bounds.maxY - bounds.minY), hw: 20 + r() * 10, hh: 20, tall: 36, blocksShot: true }));
      for (let i = 0; i < p.pools; i++) {
        for (let t = 0; t < 30; t++) {
          const w = { shape: 'circ', x: bounds.minX + rand() * (bounds.maxX - bounds.minX), y: bounds.minY + rand() * (bounds.maxY - bounds.minY), r: 46 + rand() * 34 };
          if (Math.hypot(w.x - heroStart.x, w.y - heroStart.y) < w.r + 70) continue;                  // never drown the spawn
          if (water.some(o => Math.hypot(o.x - w.x, o.y - w.y) < o.r + w.r + 30)) continue;           // no double pools
          if (obstacles.some(o => overlaps(o, w.x, w.y, w.r + 6))) continue;                          // no crates floating in it
          water.push(w); break;
        }
      }
      for (let i = 0; i < p.towers; i++) {
        for (let t = 0; t < 40; t++) {
          const x = bounds.minX + 40 + rand() * (bounds.maxX - bounds.minX - 80), y = bounds.minY + 30 + rand() * (bounds.maxY - bounds.minY - 110);
          if (tooClose(x, y, 30) || towerSpots.some(s => Math.hypot(s.x - x, s.y - y) < 150) || water.some(w => inZone(w, x, y))) continue;
          towerSpots.push({ x, y }); break;
        }
      }
    }

    // ---- queries -----------------------------------------------------------
    function heightAt(x, y) {
      for (const r of ramps) if (inRect(r, x, y)) {          // ramps interpolate, so they're walkable
        const t = clamp((y - (r.y - r.hh)) / (r.hh * 2), 0, 1);
        return r.dir > 0 ? r.from + (r.to - r.from) * t : r.to + (r.from - r.to) * t;
      }
      for (const q of plateaus) if (inZone(q, x, y)) return q.z;
      return 0;
    }
    const waterAt = (x, y) => water.some(w => inZone(w, x, y));
    const bushAt = (x, y) => bush.some(b => inZone(b, x, y));
    const slowAt = (x, y) => waterAt(x, y) ? p.waterSlow : 1;
    const blockedAt = (x, y, r) => obstacles.find(o => overlaps(o, x, y, r || 0)) || null;

    // A cliff is a height jump you can't climb — that's what makes the ramp the
    // only way onto the high ground, without needing any extra geometry.
    const CLIFF = 0.34;
    function standable(x, y, r, fromZ) {
      if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) return false;
      if (blockedAt(x, y, r)) return false;
      if (fromZ != null && Math.abs(heightAt(x, y) - fromZ) > CLIFF) return false;
      return true;
    }
    // Move an entity toward (nx,ny), sliding along whatever it runs into.
    function move(ent, nx, ny, r) {
      const z = ent.z || 0;
      if (standable(nx, ny, r, z)) { ent.x = nx; ent.y = ny; }
      else if (standable(nx, ent.y, r, z)) ent.x = nx;
      else if (standable(ent.x, ny, r, z)) ent.y = ny;
      ent.x = clamp(ent.x, bounds.minX, bounds.maxX); ent.y = clamp(ent.y, bounds.minY, bounds.maxY);
      const o = blockedAt(ent.x, ent.y, r); if (o) pushOut(o, ent, r);          // spawned/shoved inside something
      ent.z = heightAt(ent.x, ent.y);
    }
    // Line of sight / projectile path. Sampled — segments are short and this is
    // cached by the caller, so the loop stays cheap on a phone.
    function losClear(ax, ay, bx, by) {
      if (!obstacles.length) return true;
      const d = Math.hypot(bx - ax, by - ay), steps = Math.ceil(d / 14);
      for (let i = 1; i < steps; i++) {
        const t = i / steps, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        for (const o of obstacles) if (o.blocksShot && overlaps(o, x, y, 0)) return false;
      }
      return true;
    }
    const shotBlocked = (x, y) => obstacles.some(o => o.blocksShot && overlaps(o, x, y, 3));
    // Steering target for a mob that wants to reach (tx,ty). Mobs walk straight at
    // you — with no pathfinding, a cliff would leave them milling at the bottom
    // forever. So when the target is on a different level, send them via the ramp:
    // first to its mouth on their side, then through it.
    function navTarget(e, tx, ty) {
      if (!ramps.length) return { x: tx, y: ty };
      const ez = heightAt(e.x, e.y), tz = heightAt(tx, ty);
      if (Math.abs(ez - tz) <= CLIFF) return { x: tx, y: ty };
      let best = null, bd = 1e9;
      for (const r of ramps) {
        const lowY = r.dir > 0 ? r.y - r.hh : r.y + r.hh, highY = r.dir > 0 ? r.y + r.hh : r.y - r.hh;
        const mouthY = ez < tz ? lowY : highY, farY = ez < tz ? highY : lowY;     // enter from my level
        const d = Math.hypot(r.x - e.x, mouthY - e.y);
        if (d < bd) { bd = d; best = { r, mouthY, farY }; }
      }
      if (!best) return { x: tx, y: ty };
      const onRamp = Math.abs(e.x - best.r.x) < best.r.hw * 1.3 && Math.abs(e.y - best.mouthY) < best.r.hh * 2.4;
      return onRamp ? { x: best.r.x, y: best.farY } : { x: best.r.x, y: best.mouthY };
    }
    function freeSpot(x, y, r) {                              // nudge a spawn out of scenery
      if (standable(x, y, r)) return { x, y };
      for (let i = 0; i < 60; i++) {
        const a = rand() * 6.2832, d = 22 + i * 6;
        const nx = clamp(x + Math.cos(a) * d, bounds.minX, bounds.maxX), ny = clamp(y + Math.sin(a) * d, bounds.minY, bounds.maxY);
        if (standable(nx, ny, r)) return { x: nx, y: ny };
      }
      return { x: clamp(x, bounds.minX, bounds.maxX), y: clamp(y, bounds.minY, bounds.maxY) };
    }

    // ---- drawing -----------------------------------------------------------
    // Ground is static, so it's painted once into an offscreen canvas and blitted
    // every frame. Anything an entity can walk behind is a "prop" instead, and
    // gets depth-sorted with the fighters back in battle.js.
    let groundCv = null;
    function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.2832); }
    function zoneFill(c, z, color, inset) {
      const i = inset || 0;
      if (z.shape === 'circ') { ell(c, z.x, py(z.y, 0), z.r - i, (z.r - i) * SQ); }
      else { const x = z.x - z.hw + i, y = py(z.y - z.hh, 0) + i * SQ, w = z.hw * 2 - i * 2, h = (z.hh * 2 - i * 2) * SQ, r = Math.min(14, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
      c.fillStyle = color; c.fill();
    }
    function paintGround(c) {
      // grass + checker, same look the crew already knows
      c.fillStyle = iso ? '#3f8f47' : '#4fa84f'; c.fillRect(-16, -16, W + 32, H + 32);
      const T = 60; c.fillStyle = iso ? '#47a050' : '#59b559';
      for (let yy = TOP + (iso ? 0 : 44); yy < H; yy += T * SQ) for (let xx = 0; xx < W; xx += T)
        if (((xx / T | 0) + ((yy - TOP) / (T * SQ) | 0)) % 2) c.fillRect(xx, yy, T, T * SQ);
      if (iso) { c.strokeStyle = '#25592c'; c.lineWidth = 10; c.strokeRect(5, TOP - 8, W - 10, H - TOP + 3); }   // field edge, under the terrain
      // High ground: a lit top face lifted off the floor, with the cliff wall
      // showing underneath it — the whole reason the level reads as 3D.
      for (const q of plateaus) {
        const wall = q.z * ZH, x = q.x - q.hw, w = q.hw * 2;
        const yTop = py(q.y - q.hh, 0), yBot = py(q.y + q.hh, 0);
        c.fillStyle = '#24552b'; c.fillRect(x, yTop - wall, w, (yBot - yTop) + wall);        // cliff face
        c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, yBot - wall, w, wall);                 // shaded lip
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2;                                   // rock striations
        for (let i = 1; i < 4; i++) { const xx = x + w * i / 4; c.beginPath(); c.moveTo(xx, yBot - wall + 3); c.lineTo(xx, yBot - 2); c.stroke(); }
        c.save(); c.translate(0, -wall);
        zoneFill(c, q, '#5cc169');                                                            // lit top face
        c.fillStyle = 'rgba(255,255,255,.07)';
        for (let yy = yTop; yy < yBot; yy += 60 * SQ) for (let xx = x; xx < x + w; xx += 60) if (((xx / 60 | 0) + (yy / (60 * SQ) | 0)) % 2) c.fillRect(xx, yy, 60, 60 * SQ);
        c.restore();
      }
      for (const r of ramps) {                                        // ramp: a wedge you can read at a glance
        const x = r.x - r.hw, y0 = py(r.y - r.hh, r.dir > 0 ? r.from : r.to), y1 = py(r.y + r.hh, r.dir > 0 ? r.to : r.from);
        c.fillStyle = '#4aa855'; c.beginPath(); c.moveTo(x, y0); c.lineTo(x + r.hw * 2, y0); c.lineTo(x + r.hw * 2, y1); c.lineTo(x, y1); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2;
        for (let i = 1; i < 5; i++) { const t = i / 5, yy = y0 + (y1 - y0) * t; c.beginPath(); c.moveTo(x + 6, yy); c.lineTo(x + r.hw * 2 - 6, yy); c.stroke(); }
      }
      for (const w of water) {                                        // water: rim, body, highlight, ripples
        zoneFill(c, w, '#1c6fa8');
        zoneFill(c, w, '#2e9ad6', 5);
        c.save(); c.beginPath();
        if (w.shape === 'circ') ell(c, w.x, py(w.y, 0), w.r - 5, (w.r - 5) * SQ); else { const x = w.x - w.hw + 5, y = py(w.y - w.hh, 0) + 5 * SQ; c.rect(x, y, w.hw * 2 - 10, (w.hh * 2 - 10) * SQ); }
        c.clip();
        c.strokeStyle = 'rgba(255,255,255,.30)'; c.lineWidth = 3;
        const y0 = py(w.y - (w.shape === 'circ' ? w.r : w.hh), 0), y1 = py(w.y + (w.shape === 'circ' ? w.r : w.hh), 0);
        for (let yy = y0; yy < y1; yy += 13) { c.beginPath(); const x0 = w.x - (w.shape === 'circ' ? w.r : w.hw); for (let xx = 0; xx <= (w.shape === 'circ' ? w.r * 2 : w.hw * 2); xx += 8) { const sy = yy + Math.sin(xx / 15 + yy) * 2.2; xx ? c.lineTo(x0 + xx, sy) : c.moveTo(x0 + xx, sy); } c.stroke(); }
        c.restore();
      }
      if (!iso) { c.strokeStyle = '#2f6b35'; c.lineWidth = 14; const x = 10, y = 52, w = W - 20, h = H - 62, r = 22; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.stroke(); }
    }
    function ground(dpr) {
      if (groundCv) return groundCv;
      groundCv = document.createElement('canvas'); groundCv.width = W * dpr; groundCv.height = H * dpr;
      const c = groundCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); paintGround(c);
      return groundCv;
    }

    function drawObstacle(c, o) {
      const base = py(o.y, 0), tall = o.tall || 26;
      c.fillStyle = 'rgba(0,0,0,.22)';                                       // ground shadow
      if (o.shape === 'circ') { ell(c, o.x, base + o.r * 0.25 * SQ, o.r * 1.02, o.r * 0.5 * SQ + 3); c.fill(); }
      else { ell(c, o.x, base + o.hh * 0.5 * SQ, o.hw * 1.05, o.hh * 0.6 * SQ + 3); c.fill(); }
      if (o.kind === 'jungle') {                                             // tree clump wall
        const n = Math.max(2, Math.round(o.hh / 22));
        for (let i = 0; i < n; i++) {
          const cy = py(o.y - o.hh + (i + 0.5) * (o.hh * 2 / n), 0), rr = o.hw * 1.05;
          c.fillStyle = '#1f5a2c'; ell(c, o.x, cy - tall * 0.4, rr, rr * 0.85); c.fill();
          c.fillStyle = '#2b7a3a'; ell(c, o.x - rr * 0.18, cy - tall * 0.52, rr * 0.72, rr * 0.6); c.fill();
          c.strokeStyle = '#13381c'; c.lineWidth = 3; ell(c, o.x, cy - tall * 0.4, rr, rr * 0.85); c.stroke();
        }
        return;
      }
      if (o.shape === 'circ') {                                              // boulder
        c.fillStyle = '#5d5468'; ell(c, o.x, base - tall * 0.35, o.r, o.r * 0.9); c.fill();
        c.fillStyle = '#7d738b'; ell(c, o.x - o.r * 0.2, base - tall * 0.55, o.r * 0.72, o.r * 0.6); c.fill();
        c.fillStyle = 'rgba(255,255,255,.30)'; ell(c, o.x - o.r * 0.32, base - tall * 0.72, o.r * 0.3, o.r * 0.2); c.fill();
        c.lineWidth = 3.5; c.strokeStyle = '#2b2334'; ell(c, o.x, base - tall * 0.35, o.r, o.r * 0.9); c.stroke();
        return;
      }
      const x = o.x - o.hw, w = o.hw * 2, topY = base - tall - o.hh * SQ, h = tall + o.hh * SQ * 2;   // crate
      c.fillStyle = '#a8712f'; c.fillRect(x, topY, w, h);
      c.fillStyle = '#c98c3d'; c.fillRect(x, topY, w, h * 0.45);
      c.strokeStyle = '#5e3c14'; c.lineWidth = 3.5; c.strokeRect(x, topY, w, h);
      c.beginPath(); c.moveTo(x, topY); c.lineTo(x + w, topY + h); c.moveTo(x + w, topY); c.lineTo(x, topY + h); c.stroke();
    }
    function drawBush(c, b) {
      c.save(); c.globalAlpha = 0.92;
      const cy = py(b.y, 0);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * 6.2832, bx = b.x + Math.cos(a) * b.hw * 0.55, by = cy + Math.sin(a) * b.hh * SQ * 0.55;
        c.fillStyle = i % 2 ? '#2f7d3c' : '#276b33'; ell(c, bx, by, b.hw * 0.62, b.hh * 0.72 * SQ + 6); c.fill();
      }
      c.fillStyle = '#358c44'; ell(c, b.x, cy, b.hw * 0.8, b.hh * 0.8 * SQ + 5); c.fill();
      c.strokeStyle = '#17421f'; c.lineWidth = 3; ell(c, b.x, cy, b.hw * 0.9, b.hh * 0.9 * SQ + 5); c.stroke();
      c.restore();
    }

    // Props = things fighters can stand in front of or behind. battle.js merges
    // these into its depth-sorted draw list. Bush sorts by its FRONT edge so
    // anyone hiding inside ends up drawn underneath it.
    const props = [
      ...obstacles.map(o => ({ y: o.y + (o.shape === 'circ' ? o.r : o.hh) * 0.5, draw: c => drawObstacle(c, o) })),
      ...bush.map(b => ({ y: b.y + b.hh * 0.9, draw: c => drawBush(c, b) })),
    ];

    return {
      level, plan: p, iso, mode: p.mode, view: { SQ, ZH, TOP, WW, WH, W, H }, bounds,
      obstacles, water, bush, plateaus, ramps, towerSpots, heroStart, bossStart, props,
      py, heightAt, waterAt, bushAt, slowAt, blockedAt, standable, move, losClear, shotBlocked, freeSpot, navTarget, ground,
      rangeBonus: (z) => 1 + (z || 0) * 0.18,          // high ground = longer reach
      towerDef: { hp: p.towerHp, range: p.towerRange, cd: p.towerCd, r: 17 },
      edgeSpawn(r) {                                    // walk-in point on a random edge, never inside scenery
        const e = Math.floor(Math.random() * 4), b = bounds;
        const raw = e === 0 ? { x: b.minX + Math.random() * (b.maxX - b.minX), y: b.minY + 4 }
          : e === 1 ? { x: b.maxX - 4, y: b.minY + Math.random() * (b.maxY - b.minY) }
          : e === 2 ? { x: b.minX + Math.random() * (b.maxX - b.minX), y: b.maxY - 4 }
          : { x: b.minX + 4, y: b.minY + Math.random() * (b.maxY - b.minY) };
        return freeSpot(raw.x, raw.y, r || 12);
      },
    };
  }

  window.ForgeTerrain = { build, DEFAULTS, TUNING, planKey };
})();
