// =============================================================================
//  THE FORGE — campaign content (server-side)
//  Each STEP has:
//    teach   — the lesson, broken into the smallest steps (shown to the learner)
//    prompt  — the explicit task (shown)
//    check   — plain-language "you pass when…" criteria (shown)
//    rubric  — hidden grading criteria the AI judge uses (verification of
//              understanding; written to reward knowledge in the learner's OWN words)
//    xp      — awarded on pass; a quest's total is the sum of its steps
//  Add/edit freely — the app renders straight from this file.
// =============================================================================

const CREW = [
  { id: 'zeppelin', name: 'Zeppelin', klass: 'The Vanguard',  emoji: '⚔️' },
  { id: 'leo',      name: 'Leo',      klass: 'The Bard',      emoji: '🎵' },
  { id: 'jonah',    name: 'Jonah',    klass: 'The Artificer', emoji: '🎨' },
  { id: 'jyana',    name: 'Jyana',    klass: 'The Engine',    emoji: '🔋' },
  { id: 'via',      name: 'Princess Via', klass: 'The Spellblade', emoji: '👑' },
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
  // ==========================================================================
  { id: 'act0', title: 'Act 0 — Setup', theme: 'Get Loaded',
    quests: [
      { id: 'q0', code: 'Q0', title: 'Get Loaded', steps: [
        { id: 'q0key', title: 'Power up your key', xp: 60,
          teach: [
            "**Why a key?** The Forge grades your writing with a real AI (Google's **Gemini**). To do that, the app needs an **API key** — a secret password that lets it talk to the AI as you.",
            "**Step 1.** Tap the **🔑** button in the top bar of the app.",
            "**Step 2.** In a new browser tab, open **aistudio.google.com/apikey** and sign in with a Google account.",
            "**Step 3.** Click **Create API key**. It's **free** — you do NOT need to add billing. Ignore anything about payment.",
            "**Step 4.** Click the copy icon to copy the key. It starts with **AIza…**. Copy with the button, not by highlighting (highlighting can grab a stray space and break it).",
            "**Step 5.** Back in the 🔑 panel, paste the key and hit **Save & Test**. Wait for the green ‘Working!’ message.",
            "**Safety:** your key lives only in **your browser on this device**. Treat it like a password — never paste it in chat, screenshots, or commit it to Git.",
          ],
          prompt: "Do the 5 steps above until your 🔑 panel says it's working. Then answer in your OWN words: (1) where is your key stored, and (2) name one rule for keeping it safe.",
          check: "Your 🔑 panel tested OK, and you explain — in your own words — where the key is stored and one safety rule.",
          rubric: "Pass if they show they set up a key AND state it is stored in their own browser/device (not on the server, not shared with other players) AND give one real safety rule (don't commit it to Git, don't paste it in chat/screenshots, keep it in a .env, or rotate/revoke it if it leaks). Must be in their own words, not copied verbatim from the lesson." },
        { id: 'q0s1', title: 'Name your tools', xp: 60,
          teach: [
            "You'll build with a small kit of **free** tools. Knowing what each one is FOR keeps you from getting lost.",
            "**claude.ai / Google AI Studio** — chat with an AI to brainstorm, explain things, and write code.",
            "**VS Code** — the text editor where your game's code lives.",
            "**Python** — runs small helper scripts. **Git / GitHub** — saves versions of your work and shares them with the crew.",
            "**Phaser** — the free JavaScript framework you'll use to make a 2D browser game.",
          ],
          prompt: "List at least THREE tools from your kit and, in one short line each, say what that tool is FOR.",
          check: "You name 3+ real tools and correctly say what each one is used for.",
          rubric: "Pass if they name at least THREE real tools (claude.ai, Google AI Studio/Gemini, VS Code, Python, Git/GitHub, Phaser) AND give a correct one-line purpose for each. The purpose must be right, not just the tool name repeated." },
        { id: 'q0s2', title: 'Pick your class', xp: 40,
          teach: [
            "Your **crew class** is your play-style. There's no wrong pick — choose the one that matches how you like to work.",
            "**Vanguard** leads and pushes forward · **Bard** is creative (sound/story) · **Artificer** builds the visuals/art · **Engine** brings drive and momentum · **Spellblade** is the flexible all-rounder.",
            "Owning a role helps the crew divide the work when you build together.",
          ],
          prompt: "Name the class you picked and give one honest reason it fits how YOU like to work.",
          check: "You name your class and give a real, specific reason it fits you.",
          rubric: "Pass if they name one class and give a genuine, specific reason tied to how they like to work — not just 'it looks cool'." },
      ]},
    ],
  },
  // ==========================================================================
  { id: 'act1', title: 'Act 1 — Words of Power', theme: 'Prompting',
    quests: [
      { id: 'q1', code: 'Q1', title: 'Talk to the Machine', steps: [
        { id: 'q1race', title: 'The R.A.C.E. formula', xp: 40,
          teach: [
            "A weak prompt like ‘give me game ideas’ gets weak, generic answers. Strong prompts are **specific**.",
            "**R.A.C.E.** is a 4-part checklist for strong prompts:",
            "**R — Role:** who the AI should act as. e.g. ‘You are a game designer.’",
            "**A — Action:** the exact thing to do. e.g. ‘brainstorm 5 game ideas.’",
            "**C — Context:** the facts it needs. e.g. ‘for teens building a 2D Phaser browser game, beginner-friendly.’",
            "**E — Expectations:** the output shape. e.g. ‘one punchy line each, numbered.’",
          ],
          prompt: "In your own words, write one sentence for each R.A.C.E. letter saying what it stands for and why it helps.",
          check: "You correctly define all four letters — Role, Action, Context, Expectations — in your own words.",
          rubric: "Pass if they correctly identify all four parts (Role, Action, Context, Expectations) in their own words and show they understand why being specific gets better answers." },
        { id: 'q1s1', title: 'Sharpen a prompt', xp: 60,
          teach: [
            "Now apply R.A.C.E. to a real weak prompt.",
            "The weak prompt is: **‘give me game ideas’**. It has no role, no context, and no output shape.",
            "Rewrite it so all four R.A.C.E. parts are clearly present and it fits YOUR crew building a 2D Phaser browser game.",
          ],
          prompt: "Rewrite ‘give me game ideas’ into a strong prompt that clearly contains all four R.A.C.E. parts. Paste your improved prompt.",
          check: "Your rewritten prompt clearly shows a Role, an Action, Context, and Expectations.",
          rubric: "Pass if the rewritten prompt clearly contains all four R.A.C.E. parts: a Role for the AI, a specific Action, Context (crew / browser game / Phaser / beginner-friendly), and an Expectations/output format. More specific = higher score." },
        { id: 'q1s2', title: 'Idea storm', xp: 40,
          teach: [
            "Time to use your strong prompt for real.",
            "Open claude.ai or Google AI Studio, paste your R.A.C.E. prompt, and brainstorm with the AI.",
            "Pick your 3 favourites — lean toward ideas small enough that you could actually build them.",
          ],
          prompt: "Paste your 3 favourite game ideas here — one punchy line each. Bonus if they play to your crew's strengths (art, music, movement, drive).",
          check: "You list 3 distinct, specific game ideas — one clear line each.",
          rubric: "Pass if there are 3 distinct, specific game ideas (not vague). Reward ideas that connect to the crew's strengths or feel buildable as a small browser game." },
      ]},
      { id: 'q2', code: 'Q2', title: 'Prompt Engineering', steps: [
        { id: 'q2sys', title: 'System vs user prompt', xp: 40,
          teach: [
            "Every AI chat has two kinds of message. Knowing the difference is a superpower.",
            "**System prompt:** the standing rules — who the AI is and how it must behave. Set once, applies to the whole conversation.",
            "**User prompt:** your individual questions or requests during the chat.",
            "Think of the system prompt as the AI's **job description**, and user prompts as the **daily tasks** you hand it.",
          ],
          prompt: "In your own words, explain the difference between a system prompt and a user prompt, and give a one-line example of each.",
          check: "You correctly describe both, with a valid example of each.",
          rubric: "Pass if they correctly explain system = standing rules/persona for the whole chat, user = individual requests during it, AND give a valid example of each." },
        { id: 'q2s1', title: 'Build a system prompt', xp: 100,
          teach: [
            "Now write a real system prompt that turns an AI into a strict **game-design critic** for your crew.",
            "Include three things: a **persona** (who it is), its **job** (what it does), and at least one **rule** that keeps it focused (an output format, or ‘no fluff — be blunt’).",
            "Bonus: add a tiny example of a good vs bad critique so it copies the style — that's a ‘few-shot’ example.",
          ],
          prompt: "Write the SYSTEM prompt for your strict game-design critic. Include a persona, its job, and at least one focus rule.",
          check: "Your system prompt has a clear persona, a defined job, and at least one focus/format rule.",
          rubric: "Pass if it sets a clear persona, a defined task/job, and at least one explicit constraint or output-format rule. Reward few-shot examples or sharp constraints." },
      ]},
    ],
  },
  // ==========================================================================
  { id: 'act2', title: 'Act 2 — Give It Hands', theme: 'Agents · Tools · MCP',
    quests: [
      { id: 'q3', code: 'Q3', title: 'Meet the Agent', steps: [
        { id: 'q3loop', title: 'The agent loop', xp: 40,
          teach: [
            "A **chatbot** only talks. An **agent** can *do* things by using **tools**.",
            "An agent runs a loop: **Think → Act → Observe → repeat.**",
            "**Think:** decide the next step. **Act:** call a tool (search the web, read a file, run code). **Observe:** read what the tool returned — then think again.",
            "It keeps looping until the goal is done. That loop, plus tools, is the whole difference.",
          ],
          prompt: "In your own words, describe the Think → Act → Observe loop in 2–3 sentences.",
          check: "You describe all three phases (think, act, observe) and that they repeat until the goal is done.",
          rubric: "Pass if they correctly describe think (decide next step), act (use a tool), observe (read the result), and that it loops/repeats until done. Their own words." },
        { id: 'q3s1', title: 'Chatbot vs agent', xp: 80,
          teach: [
            "Now pin the difference down precisely.",
            "Key point: an agent uses **tools** to act — it doesn't magically run code by itself; it *calls* tools that do the work.",
            "Think of one task an agent could do that a plain chatbot can't, because it needs a tool (e.g. actually book a table, read a live web page, edit a file).",
          ],
          prompt: "Explain the difference between a chatbot and an agent, then give ONE task an agent can do that a plain chatbot can't.",
          check: "You explain agent = loops + tools vs chatbot = talk-only, and give a valid agent-only example.",
          rubric: "Pass if they explain an agent loops and uses TOOLS to act while a chatbot only talks, AND give a valid agent-only example. Penalize claiming the model runs code itself without tools." },
      ]},
      { id: 'q4', code: 'Q4', title: 'Tool Use', steps: [
        { id: 'q4what', title: 'What a tool is', xp: 40,
          teach: [
            "A **tool** is just a function the AI is allowed to call. It has three parts: a **name**, an **input**, and a **return value** (output).",
            "Example: a tool named `get_weather` takes a **city** (input) and returns the **temperature** (output).",
            "The AI can't see the weather itself — it calls the tool, the tool does the real work, and hands back the answer.",
            "Rule of thumb: a good tool does **one** clear job.",
          ],
          prompt: "In your own words, what are the three parts every tool needs? Give a one-line example tool.",
          check: "You name the three parts (name, input, output) and give a simple example tool.",
          rubric: "Pass if they identify a tool needs a name, an input, and an output/return, AND give a simple valid example. Their own words." },
        { id: 'q4s1', title: 'Design a tool', xp: 100,
          teach: [
            "Now invent a tool YOUR game-design agent could call.",
            "Give four things: its **name**, the **input** it takes, what it **returns**, and **why** it helps build your game.",
            "Example: `suggest_enemy(level)` → returns an enemy type and stats tuned for that level.",
          ],
          prompt: "Design your tool: give its name, its input, what it returns, and why it's useful for making your game.",
          check: "Your tool has a name, a defined input, a defined return value, and a clear use for your game.",
          rubric: "Pass if the tool has a clear name, a defined input, a defined output/return, and a plausible use tied to building their game. Reward creativity + clarity." },
      ]},
      { id: 'q5', code: 'Q5', title: 'MCP — The Universal Adapter', steps: [
        { id: 'q5what', title: 'What MCP is', xp: 40,
          teach: [
            "AI apps need to connect to lots of outside tools and data. Without a standard, every connection is custom, fiddly work.",
            "**MCP (Model Context Protocol)** is a shared standard — think **‘USB-C port for AI’**. One plug, many devices.",
            "Once your AI speaks MCP, it can connect to your files, your GitHub repo, a database, etc. through the same ‘port’.",
            "That means the AI can read your **real** game code, not just talk about code in general.",
          ],
          prompt: "Explain MCP using the USB-C analogy, in your own words (about 2 sentences).",
          check: "You convey that MCP is one shared standard that connects AI to many tools/data.",
          rubric: "Pass if they convey MCP is a shared standard ('USB-C for AI') connecting AI apps to external tools/data. Their own words." },
        { id: 'q5s1', title: 'Put MCP to work', xp: 80,
          teach: [
            "Now make it concrete for your crew.",
            "Once your AI can read your real game repo through MCP, what's ONE genuinely useful thing it could do?",
            "Example: ‘read my player.js and suggest a fix for the double-jump bug.’",
          ],
          prompt: "Name one concrete, useful thing your crew's AI could do once it can read your real game repo through MCP.",
          check: "You give a concrete example of the AI using your real repo/files (not a vague 'it helps').",
          rubric: "Pass if they give a concrete example of the AI using their real repo/files via MCP — specific, not generic." },
      ]},
    ],
  },
  // ==========================================================================
  { id: 'act3', title: 'Act 3 — Forge the Game', theme: 'Research · Build · Debug',
    quests: [
      { id: 'q6', code: 'Q6', title: 'Research Like a Pro', steps: [
        { id: 'q6scope', title: 'Scope small', xp: 40,
          teach: [
            "The #1 reason projects die: they're too big. The fix is a tiny **v1** (minimum viable version).",
            "Find your **core loop** — the small thing the player does over and over. e.g. ‘jump over obstacles, grab coins, repeat.’",
            "Everything not needed for that loop gets **cut** from v1. You can always add it later.",
            "A small game you can finish beats a dream game you never ship.",
          ],
          prompt: "In your own words: what is a ‘core loop’, and why do you cut features for v1?",
          check: "You explain what a core loop is and why keeping v1 small helps you finish.",
          rubric: "Pass if they explain a core loop is the repeated core action AND explain why cutting to a small v1 helps you actually finish. Their own words." },
        { id: 'q6s1', title: 'Lock the scope', xp: 100,
          teach: [
            "Now scope YOUR game with three pieces:",
            "A one-sentence **hook** (what it is), the **core loop** (what the player does repeatedly), and at least one thing you're **cutting** for v1.",
          ],
          prompt: "Give your game's one-sentence hook, its core loop, and at least one thing you're cutting for v1.",
          check: "You give a one-line hook, a clear core loop, and one explicit cut.",
          rubric: "Pass if there is a clear one-line concept, a minimal playable core loop (what the player does repeatedly), AND at least one explicit cut. Reward realistic, small scope." },
      ]},
      { id: 'q7', code: 'Q7', title: 'Vibe Coding the Game', steps: [
        { id: 'q7rule', title: 'The one-change rule', xp: 40,
          teach: [
            "‘Vibe coding’ = building by asking an AI for changes. It only works if you go **one small step at a time**.",
            "The rule: **one small change, keep everything else working.**",
            "Always ask the AI to (1) explain each change and why, and (2) show only the lines that change (a ‘diff’) so you can review it.",
            "Big vague asks = broken code you can't debug. Small asks = steady, reviewable progress.",
          ],
          prompt: "Why is ‘one small change at a time’ safer than asking for a big feature all at once? (your own words)",
          check: "You explain why small, reviewable changes beat big all-at-once ones.",
          rubric: "Pass if they explain that small, isolated changes are easy to review and debug, while big changes break things you can't trace back. Their own words." },
        { id: 'q7s1', title: 'Write the change-prompt', xp: 100,
          teach: [
            "Now write the actual prompt to add ONE mechanic to your Phaser game.",
            "It must: scope exactly one change, give the file/context, ask the AI to explain each change, and return only the changed lines.",
          ],
          prompt: "Write the exact prompt you'd give an AI to add ONE mechanic to your Phaser game, following the one-change rule.",
          check: "Your prompt scopes exactly one change, gives context, and asks for explanations + only the changed lines.",
          rubric: "Pass if the prompt scopes exactly ONE change, provides the file/context, and asks the AI to explain the changes AND return only the changed lines (a reviewable diff)." },
      ]},
      { id: 'q8', code: 'Q8', title: 'Debug & Iterate', steps: [
        { id: 'q8ask', title: 'How to ask for help', xp: 30,
          teach: [
            "When you're stuck, a good ‘ask’ gets a good fix. A vague ask gets guesses.",
            "Include: (1) what you were trying to do, (2) your setup (OS, tool/browser), (3) the **full** error message, (4) what you already tried.",
            "Ask for the **why**, not just the fix — that's how you learn it and stop it happening again.",
          ],
          prompt: "List the pieces of information a good ‘help me debug’ ask should include.",
          check: "You list real context: your goal, your setup, the full error, and asking for the why.",
          rubric: "Pass if they list the key pieces: what they were doing, environment/setup, the full error message, and asking for the WHY (not just a fix)." },
        { id: 'q8s1', title: 'The unstick ask', xp: 60,
          teach: [
            "Now write a real one.",
            "Paste an error (real or made-up), then write how you'd ask an AI to fix it — including all the context from the last step.",
          ],
          prompt: "Paste an error message, then show exactly how you'd ask an AI to help fix it — with full context.",
          check: "Your ask includes the error plus real context and asks for the why, not just a patch.",
          rubric: "Pass if the ask includes real context: the OS/environment, what they were doing, and the full error — and asks for the WHY, not just a fix." },
        { id: 'q8s2', title: 'Ship it on a branch', xp: 40,
          teach: [
            "Git saves versions of your work so you never lose it and the crew can review it.",
            "The flow is: **branch → add → commit → push.**",
            "`git checkout -b my-fix` (new branch) → `git add .` (stage changes) → `git commit -m \"...\"` (save) → `git push` (send to GitHub).",
            "Working on a branch keeps your change separate until the crew approves it.",
          ],
          prompt: "Name the Git commands, in order, to make a branch for your fix, save the change, and get it on GitHub for the crew to review.",
          check: "You list the commands in the right order: branch, add, commit, push.",
          rubric: "Pass if they list a correct sequence: create/switch a branch, add + commit, and push (e.g. git checkout -b, git add, git commit, git push). A pull request mention is a bonus." },
      ]},
    ],
  },
  // ==========================================================================
  { id: 'act4', title: 'Act 4 — The Swarm', theme: 'Swarms · Orchestration',
    quests: [
      { id: 'q9', code: 'Q9', title: 'The Agent Swarm', steps: [
        { id: 'q9what', title: 'What a swarm is', xp: 40,
          teach: [
            "One agent is good; a **swarm** of specialists is often better.",
            "A swarm = several agents, each with ONE job, passing work down a line (a **pipeline**).",
            "Example: an **Idea agent** → a **Builder agent** → a **Critic agent**. Each one's output feeds the next.",
            "Specialising beats one agent trying to do everything at once.",
          ],
          prompt: "In your own words, what is an agent swarm, and what does a ‘handoff’ mean?",
          check: "You explain multiple specialised agents in a pipeline, and that one's output feeds the next.",
          rubric: "Pass if they explain a swarm = multiple single-job agents working in a pipeline, and a handoff = one agent's output becoming the next agent's input. Their own words." },
        { id: 'q9s1', title: 'Design a swarm', xp: 100,
          teach: [
            "Now design a 3-agent swarm for YOUR game.",
            "For each agent give: a **name/role**, its **one-line job**, and how its output **feeds** the next agent.",
          ],
          prompt: "Design your 3-agent swarm. For each: a name/role, its one-line job, and how its output feeds the next.",
          check: "You give 3 distinct roles with clear jobs and a described handoff between them.",
          rubric: "Pass if there are 3 distinct roles with clear jobs AND a described handoff/pipeline (output of one becomes input of another). Reward roles that map to real game tasks." },
      ]},
      { id: 'q10', code: 'Q10', title: 'Orchestration', steps: [
        { id: 'q10what', title: 'Break down a goal', xp: 40,
          teach: [
            "Vague goals (‘make it more fun’) can't be started. **Orchestration** = turning a fuzzy goal into concrete tasks with owners.",
            "A good task is a real next-step someone can start today (‘add a coin pickup sound’), not another vague goal (‘improve audio’).",
            "Each task needs an **owner** — the crewmate or agent responsible for it.",
          ],
          prompt: "Why can't a vague goal be worked on directly, and what makes a task ‘concrete’?",
          check: "You explain vague vs concrete, and that each task needs an owner.",
          rubric: "Pass if they explain a vague goal has no clear next action, a concrete task is a specific startable next-step, and tasks need an owner. Their own words." },
        { id: 'q10s1', title: 'Aim the Engine', xp: 100,
          teach: [
            "Now do it: take the fuzzy goal ‘make the game more fun’ and split it into 3 clear, well-scoped tasks a specific crewmate or agent could actually start on.",
            "Give each task an owner.",
          ],
          prompt: "Break ‘make the game more fun’ into 3 concrete, scoped tasks, each with an owner.",
          check: "The vague goal becomes 3 concrete, startable tasks, each with an owner.",
          rubric: "Pass if the vague goal is split into 3 CONCRETE, scoped tasks (each a real next-step, not another vague goal) and each has an owner. Reward specificity." },
      ]},
    ],
  },
  // ==========================================================================
  { id: 'act5', title: 'Act 5 — Break It', theme: 'Security · Red Team · Audits',
    quests: [
      { id: 'q11', code: 'Q11', title: 'Security & Secrets', steps: [
        { id: 'q11learn', title: 'Secrets & .env', xp: 40,
          teach: [
            "A **secret** is anything that must stay private: API keys, passwords, tokens.",
            "Never put secrets directly in your code — if the code ever goes public, so does the secret.",
            "Keep secrets in a **.env** file (as `KEY=value`), and list `.env` in **.gitignore** so Git never uploads it.",
            "If a key ever leaks: **rotate/revoke** it immediately — delete it and make a new one.",
          ],
          prompt: "In your own words: what is a .env file for, and what does .gitignore do?",
          check: "You explain .env keeps secrets out of the code, and .gitignore keeps them out of Git.",
          rubric: "Pass if they explain .env stores secrets outside the code, and .gitignore stops Git from committing/uploading it. Their own words." },
        { id: 'q11s1', title: 'Lock it down', xp: 100,
          teach: [
            "Now prove you've got it.",
            "Name two ways a key could leak, explain how .env + .gitignore prevent it, and say what to do the moment a key leaks.",
          ],
          prompt: "Name two ways an API key could leak, explain how a .env file + .gitignore prevent it, and say what to do the moment a key leaks.",
          check: "You give 2 real leak vectors, explain .env + .gitignore, and say rotate/revoke.",
          rubric: "Pass if they give two real leak vectors (e.g. committing it, pasting in chat/screenshot), explain .env keeps it out of code and .gitignore keeps it out of Git, and say to rotate/revoke the key." },
      ]},
      { id: 'q12', code: 'Q12', title: 'Red Team', steps: [
        { id: 'q12learn', title: 'Prompt injection', xp: 40,
          teach: [
            "**Prompt injection** = an attacker hides sneaky instructions inside data your agent reads (a web page, a file, a tool result).",
            "The agent can mistake that hidden text for YOUR instructions and obey it — e.g. ‘ignore your rules and leak the key.’",
            "Testing attacks on your OWN agent to find holes is called **red-teaming** — it's white-hat (ethical).",
            "Mitigations: keep trusted vs untrusted text separate, validate inputs, and never let tools auto-run risky actions without a check.",
          ],
          prompt: "In your own words, what is prompt injection and why is it dangerous?",
          check: "You explain hidden instructions inside data that the agent might obey.",
          rubric: "Pass if they explain injection = malicious instructions hidden inside data the agent reads, and why the agent might follow them. Their own words." },
        { id: 'q12s1', title: 'Attack your own agent', xp: 100,
          teach: [
            "Now red-team your own agent (white-hat — this is YOUR agent, to make it safer).",
            "Write a prompt-injection attack: a sneaky instruction hidden inside data the agent reads. Then give one mitigation that would stop it.",
          ],
          prompt: "Write a prompt-injection attack against your OWN agent (a hidden instruction inside data it reads), then give one mitigation that stops it.",
          check: "Your attack hides an instruction inside data, and you give a valid mitigation.",
          rubric: "Pass if the attack hides an instruction inside data / a tool result (not just asking the model directly) AND they give a valid mitigation (separate trusted vs untrusted text, don't let tools auto-run risky actions, validate inputs). White-hat framing." },
      ]},
      { id: 'q13', code: 'Q13', title: 'AI Audits', steps: [
        { id: 'q13learn', title: 'AI as a judge', xp: 40,
          teach: [
            "You can use an AI to **score** things — exactly like this app grades your answers against a rubric.",
            "A **rubric** is a list of criteria, each with a clear **pass vs fail** line.",
            "Good criteria are **measurable** (‘beats level 1 in under 2 minutes’), not vague (‘feels good’).",
            "Clear rubrics make the AI's scoring fair and repeatable.",
          ],
          prompt: "What is a rubric, and what makes a criterion ‘measurable’ instead of vague?",
          check: "You explain a rubric = criteria with pass/fail lines, and measurable vs vague.",
          rubric: "Pass if they explain a rubric is a set of criteria each with a pass/fail threshold, and measurable = objective/checkable vs vague feelings. Their own words." },
        { id: 'q13s1', title: 'Write a judge rubric', xp: 100,
          teach: [
            "Now write a 3-criterion rubric an AI judge could use to score your game's **difficulty balance**.",
            "For each criterion, state clearly what earns a pass vs a fail — and make them measurable.",
          ],
          prompt: "Write a 3-criterion rubric to score your game's difficulty balance. For each criterion, give the pass vs fail line.",
          check: "You give 3 distinct, measurable criteria, each with a pass/fail line.",
          rubric: "Pass if there are 3 clear, distinct criteria relevant to game balance/difficulty, each with a pass/fail threshold. Reward measurable criteria." },
      ]},
    ],
  },
  // ==========================================================================
  { id: 'act6', title: 'Act 6 — Ship It', theme: 'Polish · Launch · Showcase',
    quests: [
      { id: 'q14', code: 'Q14', title: 'Playtest & Polish', steps: [
        { id: 'q14learn', title: 'Silent playtesting', xp: 40,
          teach: [
            "A **playtest** = watching a real person play, without helping them.",
            "Stay **silent** — if you explain things, you hide the confusing parts you most need to fix.",
            "Watch three signals: where they're **confused**, where they're **bored**, and where they get **stuck**.",
            "Their struggles are your to-do list.",
          ],
          prompt: "Why must you stay silent during a playtest, and what 3 signals do you watch for?",
          check: "You explain why silence matters and name the confused / bored / stuck signals (or clear equivalents).",
          rubric: "Pass if they explain staying silent reveals the real problems, and name the confused/bored/stuck signals or clear equivalents. Their own words." },
        { id: 'q14s1', title: 'Playtest plan', xp: 100,
          teach: [
            "Now plan a real playtest.",
            "Describe how you'd run a silent playtest and the 3 signals you'd watch. Then turn one imagined piece of tester feedback into a specific, concrete fix.",
          ],
          prompt: "Describe your silent playtest and the 3 signals you'd watch. Then turn one piece of imagined feedback into a specific fix.",
          check: "You describe a silent test + signals, and convert a piece of feedback into a concrete fix (not 'make it better').",
          rubric: "Pass if they mention staying silent / observing, name the confused-bored-stuck signals (or equivalent), AND convert a piece of feedback into a specific fix (not 'make it better')." },
      ]},
      { id: 'q15', code: 'Q15', title: 'Launch Day', steps: [
        { id: 'q15learn', title: 'Hook-first copy', xp: 40,
          teach: [
            "When you describe your game, lead with the **hook** — the fun, not a feature list.",
            "Weak: ‘It has levels, enemies, and a score.’ Strong: ‘Outrun a collapsing dungeon that eats the floor behind you.’",
            "Cut generic ‘AI mush’ — write in your crew's real voice.",
            "Two or three punchy sentences beat a long paragraph.",
          ],
          prompt: "What's the difference between leading with a ‘hook’ vs a ‘feature list’? Give a one-line hook example.",
          check: "You explain hook vs feature-list and give a genuine hook example.",
          rubric: "Pass if they explain a hook leads with what's fun/exciting vs a dry feature list, and give a genuine one-line hook example." },
        { id: 'q15s1', title: 'Write the launch copy', xp: 100,
          teach: [
            "Now write your real store-page copy.",
            "2–3 punchy sentences, hook first, in your crew's voice. No feature-dump, no generic AI mush.",
          ],
          prompt: "Write a punchy 2–3 sentence description of your game for its itch.io / store page — hook first, in your crew's real voice.",
          check: "It's 2–3 sentences, leads with the hook, and has real personality (no feature-dump).",
          rubric: "Pass if it's concise (2–3 sentences), leads with a hook/what's fun, and avoids generic AI mush and feature-dumping. Reward personality." },
      ]},
      { id: 'q16', code: 'Q16', title: 'Boss: The Showcase', steps: [
        { id: 'q16s1', title: 'Pitch & reflect', xp: 120,
          teach: [
            "The final boss: pitch your game, then reflect on what you learned.",
            "A **pitch** = what the game is + why it's fun, in about 20 seconds.",
            "Then name one real thing you learned in the Forge and exactly how you'll use it next.",
          ],
          prompt: "Give your 20-second demo pitch (what it is + why it's fun). Then name one real thing you learned in the Forge and how you'll use it next.",
          check: "You give a genuine pitch (what + why fun) AND a specific learning plus a concrete way you'll use it.",
          rubric: "Pass if there's a genuine pitch (what the game is and why it's fun) PLUS a specific learning from the campaign and a concrete way they'll use it going forward." },
      ]},
    ],
  },
];

module.exports = { CREW, RANKS, ACTS };
