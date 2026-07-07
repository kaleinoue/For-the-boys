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
  window.BATTLE = { CLASSES, ENEMIES, BOSS, GEAR, TIER_COLOR, DROP_RATES, SCRAP_VALUE, UPGRADE, RARE_OF_SLOT, LEG_MAX_LEVEL, LEG_FODDER_NEED, legLevelGold, itemMods, NORMAL_LOOT, MYTHIC_BY_CLASS, battlePlan, GENERIC_DIALOG, QUEST_DIALOG };
}
if (typeof module !== 'undefined') module.exports = { CLASSES, ENEMIES, BOSS, GEAR, TIER_COLOR, DROP_RATES, SCRAP_VALUE, UPGRADE, RARE_OF_SLOT, LEG_MAX_LEVEL, LEG_FODDER_NEED, legLevelGold, itemMods, NORMAL_LOOT, MYTHIC_BY_CLASS, battlePlan, GENERIC_DIALOG, QUEST_DIALOG };
