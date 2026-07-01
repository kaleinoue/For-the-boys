// =============================================================================
//  THE FORGE — campaign content (server-side)
//  Each STEP has a `prompt` (shown to the learner) and a `rubric` (hidden —
//  used by the AI judge to score the response). Add/edit freely: the app renders
//  straight from this file. XP per step; a quest's total is the sum of its steps.
// =============================================================================

const CREW = [
  { id: 'zeppelin', name: 'Zeppelin', klass: 'The Vanguard',  emoji: '⚔️' },
  { id: 'leo',      name: 'Leo',      klass: 'The Bard',      emoji: '🎵' },
  { id: 'jonah',    name: 'Jonah',    klass: 'The Artificer', emoji: '🎨' },
  { id: 'jyana',    name: 'Jyana',    klass: 'The Engine',    emoji: '🔋' },
  // Hidden admin profile — reached via the Game Master passcode, not the hero
  // select. Not shown on the roster or leaderboard.
  { id: 'gm',       name: 'Game Master', klass: 'Admin · God Mode', emoji: '🛠️', hidden: true },
];

// Rank ladder (min cumulative XP -> rank)
const RANKS = [
  { min: 0,    name: 'Noob',        emoji: '🥚' },
  { min: 300,  name: 'Apprentice',  emoji: '🌱' },
  { min: 800,  name: 'Operator',    emoji: '⚙️' },
  { min: 1400, name: 'Architect',   emoji: '🏗️' },
  { min: 2000, name: 'Forgemaster', emoji: '🔥' },
];

const ACTS = [
  {
    id: 'act0', title: 'Act 0 — Setup', theme: 'Get Loaded',
    quests: [
      { id: 'q0', code: 'Q0', title: 'Get Loaded', steps: [
        { id: 'q0s1', title: 'Loadout check', xp: 100,
          prompt: "You're about to start the Forge. Name the core free tools you'll use, and tell us which crew class you picked (Vanguard / Bard / Artificer / Engine) and why it fits you.",
          rubric: "Pass if the response names at least THREE of these tools (claude.ai, Google AI Studio / Gemini, Claude Desktop, VS Code, Python, Git or GitHub, Phaser) AND names one crew class with a short reason. Reward genuine effort." },
      ]},
    ],
  },
  {
    id: 'act1', title: 'Act 1 — Words of Power', theme: 'Prompting',
    quests: [
      { id: 'q1', code: 'Q1', title: 'Talk to the Machine', steps: [
        { id: 'q1s1', title: 'Sharpen a prompt', xp: 60,
          prompt: "Here's a weak prompt: \"give me game ideas\". Rewrite it using R.A.C.E. — Role, Action, Context, Expectations — for your crew building a 2D browser game in Phaser. Paste your improved prompt.",
          rubric: "Pass if the rewritten prompt clearly contains all four R.A.C.E. parts: a Role for the AI, a specific Action, Context (crew / browser game / Phaser / beginner-friendly), and an Expectations/output format. More specific = higher score." },
        { id: 'q1s2', title: 'Idea storm', xp: 40,
          prompt: "Using a strong prompt, brainstorm with an AI and paste your 3 favourite game ideas here — one punchy line each. Bonus if they play to your crew's strengths (art, music, movement, drive).",
          rubric: "Pass if there are 3 distinct, specific game ideas (not vague). Reward ideas that connect to the crew's strengths or feel buildable as a small browser game." },
      ]},
      { id: 'q2', code: 'Q2', title: 'Prompt Engineering', steps: [
        { id: 'q2s1', title: 'Build a system prompt', xp: 100,
          prompt: "Write a SYSTEM prompt that turns an AI into a strict game-design critic for your crew. Include: a persona, its job, and at least one rule that keeps it focused (e.g. output format or 'no fluff').",
          rubric: "Pass if it sets a clear persona, a defined task/job, and at least one explicit constraint or output-format rule. Reward few-shot examples or sharp constraints." },
      ]},
    ],
  },
  {
    id: 'act2', title: 'Act 2 — Give It Hands', theme: 'Agents · Tools · MCP',
    quests: [
      { id: 'q3', code: 'Q3', title: 'Meet the Agent', steps: [
        { id: 'q3s1', title: 'Chatbot vs agent', xp: 100,
          prompt: "In your own words: what's the difference between a chatbot and an agent? Describe the think → act → observe loop, and give one task an agent could do that a plain chatbot can't.",
          rubric: "Pass if they correctly explain that an agent loops and uses TOOLS to act (think→act→observe→repeat) while a chatbot only talks, AND give a valid agent-only example. Penalize if they claim the model runs code itself without tools." },
      ]},
      { id: 'q4', code: 'Q4', title: 'Tool Use', steps: [
        { id: 'q4s1', title: 'Design a tool', xp: 100,
          prompt: "Invent a tool (function) your game-design agent could call. Give: its name, the input it takes, what it returns, and why it's useful for making your game.",
          rubric: "Pass if the tool has a clear name, a defined input, a defined output/return, and a plausible use tied to building their game. Reward creativity + clarity." },
      ]},
      { id: 'q5', code: 'Q5', title: 'MCP — The Universal Adapter', steps: [
        { id: 'q5s1', title: 'Explain MCP', xp: 100,
          prompt: "Explain MCP using the 'USB-C port for AI' analogy, then name one useful thing your crew's AI could do once it can read your real game repo through MCP.",
          rubric: "Pass if they convey that MCP is a shared standard connecting AI apps to external tools/data (the USB-C analogy) AND give a concrete example of the AI using their real repo/files." },
      ]},
    ],
  },
  {
    id: 'act3', title: 'Act 3 — Forge the Game', theme: 'Research · Build · Debug',
    quests: [
      { id: 'q6', code: 'Q6', title: 'Research Like a Pro', steps: [
        { id: 'q6s1', title: 'Lock the scope', xp: 100,
          prompt: "Describe YOUR game in one sentence (the hook). Then list the smallest 'must-have' core loop that makes it playable — and name at least one thing you're cutting for v1.",
          rubric: "Pass if there is a clear one-line concept, a minimal playable core loop (what the player does repeatedly), AND at least one explicit cut. Reward realistic, small scope." },
      ]},
      { id: 'q7', code: 'Q7', title: 'Vibe Coding the Game', steps: [
        { id: 'q7s1', title: 'Write the change-prompt', xp: 100,
          prompt: "Write the exact prompt you'd give an AI to add ONE mechanic to your Phaser game, following the rule: one small change, keep everything else working, explain each change and why, show only the lines that change.",
          rubric: "Pass if the prompt scopes exactly ONE change, provides the file/context, and asks the AI to explain the changes AND return only the changed lines (a reviewable diff)." },
      ]},
      { id: 'q8', code: 'Q8', title: 'Debug & Iterate', steps: [
        { id: 'q8s1', title: 'The unstick ask', xp: 60,
          prompt: "Paste an error message (real or made-up). Then show how you'd ask an AI to help fix it — including the context you'd give it.",
          rubric: "Pass if the 'ask' includes real context: the OS/environment, what they were doing, and the full error — and asks for the WHY, not just a fix." },
        { id: 'q8s2', title: 'Ship it on a branch', xp: 40,
          prompt: "Name the Git commands (in order) to make a branch for your fix, save the change, and get it on GitHub for the crew to review.",
          rubric: "Pass if they list a correct sequence: create/switch a branch, add + commit, and push (e.g. git checkout -b, git add, git commit, git push). A pull request mention is a bonus." },
      ]},
    ],
  },
  {
    id: 'act4', title: 'Act 4 — The Swarm', theme: 'Swarms · Orchestration',
    quests: [
      { id: 'q9', code: 'Q9', title: 'The Agent Swarm', steps: [
        { id: 'q9s1', title: 'Design a swarm', xp: 100,
          prompt: "Design a 3-agent swarm to help make your game. For each agent give: a name/role, its system-prompt job in one line, and describe how one agent's output feeds the next.",
          rubric: "Pass if there are 3 distinct roles with clear jobs AND a described handoff/pipeline (output of one becomes input of another). Reward roles that map to real game tasks." },
      ]},
      { id: 'q10', code: 'Q10', title: 'Orchestration', steps: [
        { id: 'q10s1', title: 'Aim the Engine', xp: 100,
          prompt: "Take a fuzzy goal — \"make the game more fun\" — and break it into 3 clear, well-scoped tasks a specific crewmate or agent could actually start on. Assign an owner to each.",
          rubric: "Pass if the vague goal is split into 3 CONCRETE, scoped tasks (each a real next-step, not another vague goal) and each has an owner. Reward specificity — this is the skill of turning drive into shipped work." },
      ]},
    ],
  },
  {
    id: 'act5', title: 'Act 5 — Break It', theme: 'Security · Red Team · Audits',
    quests: [
      { id: 'q11', code: 'Q11', title: 'Security & Secrets', steps: [
        { id: 'q11s1', title: 'Lock it down', xp: 100,
          prompt: "Name two ways an API key could leak, explain how a .env file + .gitignore prevent it, and say what you should do the moment a key does leak.",
          rubric: "Pass if they give two real leak vectors (e.g. committing it, pasting in chat/screenshot), explain .env keeps it out of code and .gitignore keeps it out of Git, and say 'rotate/revoke the key'." },
      ]},
      { id: 'q12', code: 'Q12', title: 'Red Team', steps: [
        { id: 'q12s1', title: 'Attack your own agent', xp: 100,
          prompt: "Write a prompt-injection attack you'd test against your OWN agent (a sneaky instruction hidden inside data the agent reads). Then give one mitigation that would stop it.",
          rubric: "Pass if the attack hides an instruction inside data / a tool result (not just asking the model directly) AND they give a valid mitigation (separate trusted vs untrusted text, don't let tools auto-run risky actions, validate inputs). White-hat framing (their own agent)." },
      ]},
      { id: 'q13', code: 'Q13', title: 'AI Audits', steps: [
        { id: 'q13s1', title: 'Write a judge rubric', xp: 100,
          prompt: "Write a 3-criterion rubric an AI judge could use to score your game's difficulty balance. For each criterion, say what earns a pass vs a fail.",
          rubric: "Pass if there are 3 clear, distinct criteria relevant to game balance/difficulty, each with a pass/fail threshold. Reward measurable criteria." },
      ]},
    ],
  },
  {
    id: 'act6', title: 'Act 6 — Ship It', theme: 'Polish · Launch · Showcase',
    quests: [
      { id: 'q14', code: 'Q14', title: 'Playtest & Polish', steps: [
        { id: 'q14s1', title: 'Playtest plan', xp: 100,
          prompt: "Describe how you'd run a silent playtest and the 3 signals you'd watch for. Then turn one imagined piece of tester feedback into a specific, concrete fix.",
          rubric: "Pass if they mention staying silent / observing, name the confused-bored-stuck signals (or equivalent), AND convert a piece of feedback into a specific fix (not 'make it better')." },
      ]},
      { id: 'q15', code: 'Q15', title: 'Launch Day', steps: [
        { id: 'q15s1', title: 'Write the launch copy', xp: 100,
          prompt: "Write a punchy 2–3 sentence description of your game for its itch.io / store page — lead with the hook, not a feature list — in your crew's real voice.",
          rubric: "Pass if it's concise (2–3 sentences), leads with a hook/what's fun, and avoids generic AI mush and feature-dumping. Reward personality." },
      ]},
      { id: 'q16', code: 'Q16', title: 'Boss: The Showcase', steps: [
        { id: 'q16s1', title: 'Pitch & reflect', xp: 100,
          prompt: "Give your 20-second demo pitch for the finished game (what it is + why it's fun). Then name one real thing you learned in the Forge and how you'll use it next.",
          rubric: "Pass if there's a genuine pitch (what the game is and why it's fun) PLUS a specific learning from the campaign and a concrete way they'll use it going forward." },
      ]},
    ],
  },
];

module.exports = { CREW, RANKS, ACTS };
