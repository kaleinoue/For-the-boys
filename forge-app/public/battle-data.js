// ============ THE FORGE — Battle data (classes, enemies, gear, waves) ============
// All original. Tune freely — the engine reads straight from here.

const CLASSES = {
  zeppelin: { name:'Zeppelin', klass:'Vanguard',  color:'#ff5d5d', accent:'#ff9a9a',
    base:{ hp:130, atk:15, armor:7, speed:118 }, attack:'melee', reach:48, arc:1.7, cd:0.45, dodge:'block' },
  leo:      { name:'Leo',      klass:'Bard',      color:'#ffd15c', accent:'#ffe6a3',
    base:{ hp:82,  atk:9,  armor:2, speed:138 }, attack:'shot',  reach:520, cd:0.30, dodge:'dash' },
  jonah:    { name:'Jonah',    klass:'Artificer', color:'#5cff9d', accent:'#b6ffd6',
    base:{ hp:98,  atk:11, armor:3, speed:126 }, attack:'burst', reach:78,  cd:0.62, dodge:'dash' },
  jyana:    { name:'Jyana',    klass:'Engine',    color:'#c88bff', accent:'#e3c6ff',
    base:{ hp:70,  atk:7,  armor:2, speed:172 }, attack:'melee', reach:34, arc:2.4, cd:0.20, dodge:'dash' },
};

const ENEMIES = {
  grunt: { name:'Grunt',   hp:18, atk:8,  speed:74, r:13, color:'#cc8855', ai:'chase' },
  zap:   { name:'Zapper',  hp:12, atk:6,  speed:52, r:12, color:'#66ccff', ai:'shooter', shotCd:1.7, shotSpd:180 },
  brute: { name:'Brute',   hp:52, atk:15, speed:40, r:19, color:'#aa5555', ai:'chase' },
};

const BOSS = { name:'The Gatekeeper', hp:280, atk:17, speed:58, r:28, color:'#ff3355', ai:'boss', shotCd:1.4, shotSpd:210 };

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
};

const TIER_COLOR = { Common:'#c9d1d9', Rare:'#5eb1ff', Legendary:'#ffb020', Mythic:'#ff5df0' };

// Drop chances on a normal kill (rest = nothing). Boss handled separately.
const DROP_RATES = { Common:0.32, Rare:0.10, Legendary:0.02 };

const NORMAL_LOOT = { Common:['wood_sword','leather','charm'], Rare:['iron_sword','chainmail','swift_boots'], Legendary:['flame_blade','aegis','focus_amulet'] };
const MYTHIC_BY_CLASS = { zeppelin:'myth_zeppelin', leo:'myth_leo', jonah:'myth_jonah', jyana:'myth_jyana' };

// Difficulty by quest index (0..16): count/strength of waves + enemy scaling.
function battlePlan(questIndex) {
  const scale = 1 + questIndex * 0.11;                 // enemies get tougher
  const waveCount = 2 + Math.floor(questIndex / 3);    // more waves later
  const waves = [];
  for (let w = 0; w < waveCount; w++) {
    const n = 3 + Math.floor(questIndex / 4) + w;      // more enemies per later wave
    const types = [];
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      types.push(questIndex >= 4 && r < 0.18 ? 'brute' : r < 0.4 ? 'zap' : 'grunt');
    }
    waves.push(types);
  }
  return { waves, scale, xp: 60 + questIndex * 10 };
}

// A little teaching dialog shown between waves (generic fallback; per-quest set in Stage 3).
const GENERIC_DIALOG = [
  "The Gatekeeper guards this lesson. Cut through its minions to earn it.",
  "Every enemy you fell is a concept you're mastering. Keep moving.",
  "Loot drops as you fight — better gear means you survive tougher trials.",
  "The boss holds a Mythic relic meant for you. Finish this.",
];

if (typeof window !== 'undefined') {
  window.BATTLE = { CLASSES, ENEMIES, BOSS, GEAR, TIER_COLOR, DROP_RATES, NORMAL_LOOT, MYTHIC_BY_CLASS, battlePlan, GENERIC_DIALOG };
}
if (typeof module !== 'undefined') module.exports = { CLASSES, ENEMIES, BOSS, GEAR, TIER_COLOR, DROP_RATES, NORMAL_LOOT, MYTHIC_BY_CLASS, battlePlan, GENERIC_DIALOG };
