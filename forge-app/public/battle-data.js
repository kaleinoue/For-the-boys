// ============ THE FORGE — Battle data (classes, enemies, gear, waves) ============
// All original. Tune freely — the engine reads straight from here.

// `hit` = accuracy stat that cancels a mob's dodge chance. `armor` counters enemy power (reduces heart loss).
const CLASSES = {
  zeppelin: { name:'Zeppelin', klass:'Vanguard',  color:'#ff5d5d', accent:'#ff9a9a',
    base:{ hp:130, atk:15, armor:7, speed:118, hit:0.10 }, attack:'melee', reach:52, arc:2.1, cd:0.45, dodge:'block' },  // wide frontal CONE
  leo:      { name:'Leo',      klass:'Bard',      color:'#ffd15c', accent:'#ffe6a3',
    base:{ hp:82,  atk:9,  armor:2, speed:138, hit:0.18 }, attack:'shot',  reach:520, cd:0.30, dodge:'dash' },
  jonah:    { name:'Jonah',    klass:'Artificer', color:'#5cff9d', accent:'#b6ffd6',
    base:{ hp:98,  atk:13, armor:3, speed:126, hit:0.12 }, attack:'burst', reach:78,  cd:0.52, dodge:'dash' },  // (B) stronger single/boss dmg
  jyana:    { name:'Jyana',    klass:'Engine',    color:'#c88bff', accent:'#e3c6ff',
    base:{ hp:79,  atk:7,  armor:2, speed:172, hit:0.10 }, attack:'melee', reach:34, arc:2.4, cd:0.20, dodge:'dash' },  // (D) 4 hearts floor
  // Dual class: every swing is a melee arc AND a homing magic bolt. Can equip any gear (incl. other classes' Mythics).
  via:      { name:'Princess Via', klass:'Spellblade', color:'#ff7bd5', accent:'#ffc2ec',
    base:{ hp:104, atk:13, armor:4, speed:130, hit:0.12 }, attack:'spellblade', reach:46, arc:1.7, cd:0.42, dodge:'dash' },
};

// `power` = heart damage a clean hit does (before armor). Light mobs 1, heavy 2.
const ENEMIES = {
  grunt: { name:'Grunt',   hp:18, atk:8,  speed:74, r:13, color:'#cc8855', ai:'chase', power:1 },
  zap:   { name:'Zapper',  hp:12, atk:6,  speed:52, r:12, color:'#66ccff', ai:'shooter', shotCd:1.7, shotSpd:180, power:1 },
  brute: { name:'Brute',   hp:52, atk:15, speed:40, r:19, color:'#aa5555', ai:'chase', power:2 },
};

const BOSS = { name:'The Gatekeeper', hp:280, atk:17, speed:58, r:28, color:'#ff3355', ai:'boss', shotCd:1.4, shotSpd:210, power:2 };

// Gear. slot: weapon | armor | trinket. mods add to stats. Mythics are class-locked.
const GEAR = {
  wood_sword:  { name:'Wooden Sword',    tier:'Common',    slot:'weapon',  mods:{ atk:2 } },
  leather:     { name:'Leather Vest',    tier:'Common',    slot:'armor',   mods:{ armor:2, hp:8 } },
  charm:       { name:'Lucky Charm',     tier:'Common',    slot:'trinket', mods:{ hp:6 } },
  iron_sword:  { name:'Iron Sword',      tier:'Rare',      slot:'weapon',  mods:{ atk:6 } },
  chainmail:   { name:'Chainmail',       tier:'Rare',      slot:'armor',   mods:{ armor:5, hp:16 } },
  swift_boots: { name:'Swift Boots',     tier:'Rare',      slot:'trinket', mods:{ speed:22 } },
  flame_blade: { name:'Flameblade',      tier:'Legendary', slot:'weapon',  mods:{ atk:12, speed:6 } },
  aegis:       { name:'Aegis Plate',     tier:'Legendary', slot:'armor',   mods:{ armor:10, hp:30 } },
  focus_amulet:{ name:'Amulet of Focus', tier:'Legendary', slot:'trinket', mods:{ atk:5, hp:15 } },
  // class-specific Mythics (boss guaranteed)
  myth_zeppelin:{ name:'Bulwark of the Vanguard', tier:'Mythic', slot:'weapon', klass:'zeppelin', mods:{ atk:18, armor:12, hp:55 } },
  myth_leo:     { name:"Bard's Resonator",        tier:'Mythic', slot:'weapon', klass:'leo',      mods:{ atk:20, speed:22, hp:28 } },
  myth_jonah:   { name:"Artificer's Prism",       tier:'Mythic', slot:'weapon', klass:'jonah',    mods:{ atk:16, hp:38, armor:6 } },
  myth_jyana:   { name:'Engine Core',             tier:'Mythic', slot:'weapon', klass:'jyana',    mods:{ atk:15, speed:38, hp:22 } },
  myth_via:     { name:'Aria, the Spellblade',    tier:'Mythic', slot:'weapon', klass:'via',      mods:{ atk:17, speed:20, hp:34, armor:6 } },
};

const TIER_COLOR = { Common:'#c9d1d9', Rare:'#5eb1ff', Legendary:'#ffb020', Mythic:'#ff5df0' };

// Drop chances on a normal kill (rest = nothing). Boss handled separately.
const DROP_RATES = { Common:0.32, Rare:0.10, Legendary:0.02 };

// Gold you get for scrapping a piece of gear (Mythics can't be scrapped).
const SCRAP_VALUE = { Common:5, Rare:20, Legendary:60 };

// Crafting: combine N copies of an item (+gold) to forge the next tier in its
// slot. Higher tiers need more copies. Mythic can't be crafted.
const UPGRADE = {
  wood_sword:  { to:'iron_sword',   need:10, gold:50 },
  leather:     { to:'chainmail',    need:10, gold:50 },
  charm:       { to:'swift_boots',  need:10, gold:50 },
  iron_sword:  { to:'flame_blade',  need:25, gold:200 },
  chainmail:   { to:'aegis',        need:25, gold:200 },
  swift_boots: { to:'focus_amulet', need:25, gold:200 },
};

// Legendaries don't jump tiers — they LEVEL UP into a stronger version of the
// same item, consuming Rares of that slot + gold. Each level = +20% stats.
const RARE_OF_SLOT = { weapon:'iron_sword', armor:'chainmail', trinket:'swift_boots' };
const LEG_MAX_LEVEL = 5;
const LEG_FODDER_NEED = 5;                              // Rares consumed per level
const legLevelGold = (level) => 300 * (level + 1);      // gold per level-up
// stat mods scaled for a leveled item (+20% per level, rounded)
function itemMods(itemId, level) { const g = GEAR[itemId]; const f = 1 + (level || 0) * 0.20; const o = {}; for (const k in g.mods) o[k] = Math.round(g.mods[k] * f); return o; }

const NORMAL_LOOT = { Common:['wood_sword','leather','charm'], Rare:['iron_sword','chainmail','swift_boots'], Legendary:['flame_blade','aegis','focus_amulet'] };
const MYTHIC_BY_CLASS = { zeppelin:'myth_zeppelin', leo:'myth_leo', jonah:'myth_jonah', jyana:'myth_jyana', via:'myth_via' };

// ---- Mob database ----------------------------------------------------------
// The 3 built-ins above are the base roster. God Mode can add custom mobs and
// assign which mobs spawn at each level; those live in a server-side config that
// gets merged in here at runtime via setMobConfig().
const BASE_MOB_IDS = ['grunt', 'zap', 'brute'];
let LEVEL_MOBS = {};                                   // { levelIndex: [mobId, ...] } — God Mode assignments
let PROJECTILES = {};                                  // { projId: {name, sprite, frames, spin, size} } shared set
let CLASS_PROJ = {};                                   // { classId: projId } hero-class shot art
let TERRAIN = {};                                      // { levelIndex: {rocks, pools, towers, ...} } — God Mode terrain knobs
function setMobConfig(cfg) {                            // called by the app after fetching /api/mobs
  if (cfg && cfg.mobs) for (const id in cfg.mobs) { if (cfg.mobs[id]) ENEMIES[id] = cfg.mobs[id]; }
  LEVEL_MOBS = (cfg && cfg.levels) || {};
  PROJECTILES = (cfg && cfg.projectiles) || {};
  CLASS_PROJ = (cfg && cfg.classProjectiles) || {};
  TERRAIN = (cfg && cfg.terrain) || {};
}
// Terrain overrides for a battle. An exact level wins; otherwise the level falls
// back to its environment tier (levels past 5 all run the level-5 map).
function terrainCfgFor(level, key) { return TERRAIN[String(level)] || TERRAIN[String(key)] || null; }
function projById(id) { return (id && PROJECTILES[id]) || null; }
function projForClass(classId) { return projById(CLASS_PROJ[classId]); }
function mobPoolFor(level) {                            // which mob ids can spawn at this level
  const assigned = LEVEL_MOBS[level];
  if (Array.isArray(assigned) && assigned.length) { const p = assigned.filter(k => ENEMIES[k]); if (p.length) return p; }
  const pool = ['grunt', 'zap']; if (level >= 5) pool.push('brute');   // (E) heavy brutes gated to L5+
  return pool.filter(k => ENEMIES[k]);
}

// Difficulty by quest index / "level" (0..16).
function battlePlan(questIndex) {
  const level = questIndex;
  const hpScale  = 1 + level * 0.20;                   // toughness ramps hard
  const atkScale = 1 + level * 0.14;                   // power ramps
  const coord    = Math.min(1, level / 9);             // mob coordination 0..1
  const waveCount = 2 + Math.floor(level / 3);         // more waves later
  const pool = mobPoolFor(level);
  const ranged = pool.filter(k => ENEMIES[k] && ENEMIES[k].ai === 'shooter');
  const melee  = pool.filter(k => !ENEMIES[k] || ENEMIES[k].ai !== 'shooter');
  const rangedPick = ranged.length ? ranged : ['zap'];  // ALWAYS at least one ranged available
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const waves = [];
  for (let w = 0; w < waveCount; w++) {
    const n = 3 + Math.floor(level / 4) + w;           // more enemies per later wave
    const types = [pick(rangedPick)];                  // guarantee >=1 ranged per wave
    for (let i = 1; i < n; i++) {
      types.push(Math.random() < 0.32 ? pick(rangedPick) : pick(melee.length ? melee : pool));
    }
    for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }  // shuffle so ranged isn't always first
    waves.push(types);
  }
  return { waves, level, hpScale, atkScale, coord, xp: 60 + level * 10 };
}

// A little teaching dialog shown between waves (generic fallback; per-quest set in Stage 3).
const GENERIC_DIALOG = [
  "The Gatekeeper guards this lesson. Cut through its minions to earn it.",
  "Every enemy you fell is a concept you're mastering. Keep moving.",
  "Loot drops as you fight — better gear means you survive tougher trials.",
  "The boss holds a Mythic relic meant for you. Finish this.",
];

// Per-quest teaching dialog, shown between waves. Original summaries of each
// quest's lesson, in a battle-mentor voice.
const QUEST_DIALOG = {
  q0:  ["Every hero needs a loadout. Yours is AI — the tools that make you dangerous.","Claude, a free Gemini key, VS Code, Git. Gear up.","Pick your class and own it. The crew wins together."],
  q1:  ["A vague command earns a vague blade. Be specific.","R.A.C.E. — Role, Action, Context, Expectations. Carve your prompt.","Steer the machine, or it wanders. You hold the reins."],
  q2:  ["Give the AI a persona and rules, and it fights for you.","Show it examples. Demand a format. Precision cuts deeper.","A sharp prompt is a sharp weapon."],
  q3:  ["A chatbot only talks. An AGENT acts — think, act, observe, repeat.","Give a mind a loop and tools, and it works while you rest.","Today you stop chatting and start commanding."],
  q4:  ["Tools are the hands. The model asks; your code strikes.","One good tool turns a single wish into a hundred actions.","Give your agent a weapon it can actually swing."],
  q5:  ["MCP is the universal mount — plug any tool into any AI.","Standardize the connection; wield everything the same way.","Stop rebuilding hilts. Forge one that fits all."],
  q6:  ["Scout before you strike. One source is a rumor.","Triangulate the truth from three places, then lock your plan.","Know the battlefield before you name your game."],
  q7:  ["Build fast with AI — but never wield code you can't explain.","Small strokes. Read each one. Ship ugly. Keep control.","A slice you can play beats a dream you can't."],
  q8:  ["Errors aren't defeat — they're the map to the fix.","Feed the AI the full error and the context, then branch, commit, push.","Every bug you fell makes the next one easier."],
  q9:  ["One agent is a soldier. Many, coordinated, are an army.","Split the work — designer, coder, critic — each its own blade.","Command the swarm; don't drown in it."],
  q10: ["Raw power needs aim. Break the goal into clear strikes.","The orchestrator turns chaos into a shipped plan.","Point the engine at ONE target, then let it run."],
  q11: ["Guard your secrets like your life. Keys never leave the vault.","Never trust output blindly — verify before you wield it.","A leaked key is a blade handed to your enemy."],
  q12: ["To defend, you must first attack — your OWN systems.","Instructions hidden in data can hijack a mind. Hunt them.","Break it in the training yard so it holds in the field."],
  q13: ["Don't trust the oracle — audit it. Hallucinations wear confidence.","Judge the output against a rubric. Truth over vibes.","A good judge is worth ten blind believers."],
  q14: ["Watch a stranger struggle in silence. Their confusion is gold.","Juice — sound, feel, feedback — turns 'fine' into 'again!'","Polish is the difference between played and ignored."],
  q15: ["A blade left in the forge helps no one. Ship it to the world.","A live link is proof. Guard it, then shout about it.","Today you cross the line most people never do."],
  q16: ["This is the final gate. Show what you built and what you learned.","You entered a noob. You leave a Forgemaster.","One last stand — then the world sees the crew."],
};

if (typeof window !== 'undefined') {
  window.BATTLE = { CLASSES, ENEMIES, BASE_MOB_IDS, BOSS, GEAR, TIER_COLOR, DROP_RATES, SCRAP_VALUE, UPGRADE, RARE_OF_SLOT, LEG_MAX_LEVEL, LEG_FODDER_NEED, legLevelGold, itemMods, NORMAL_LOOT, MYTHIC_BY_CLASS, battlePlan, setMobConfig, terrainCfgFor, mobPoolFor, projById, projForClass, GENERIC_DIALOG, QUEST_DIALOG };
}
if (typeof module !== 'undefined') module.exports = { CLASSES, ENEMIES, BASE_MOB_IDS, BOSS, GEAR, TIER_COLOR, DROP_RATES, SCRAP_VALUE, UPGRADE, RARE_OF_SLOT, LEG_MAX_LEVEL, LEG_FODDER_NEED, legLevelGold, itemMods, NORMAL_LOOT, MYTHIC_BY_CLASS, battlePlan, setMobConfig, terrainCfgFor, mobPoolFor, projById, projForClass, GENERIC_DIALOG, QUEST_DIALOG };
