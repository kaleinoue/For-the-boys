# Quest 02 — Prompt Engineering
> Act 1 · Words of Power (Prompting) • ~90–120 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Graduate from "good prompts" to *engineered* prompts — and use them to interview the AI into writing the first draft of your game's design doc.

**🎒 Loadout:**
- claude.ai 🟡 (still your dojo)
- `../../CHEATSHEET.md` (Power Moves table — you'll use most of it)
- `../../project/GAME.md` (the GDD template you'll fill in)
- Your shortlist of 5 ideas from **Quest 01**
- Your crew

**⭐ XP on the line:** 100 base (+50 boss).

---

## 🤔 Why this Quest matters

Quest 1 taught you to *talk* to the machine. This one teaches you to *program it with words.* Real prompt engineering — system prompts, personas, examples, step-by-step reasoning, locked output formats — is the difference between an AI that's a fun toy and one that reliably does exactly what you need, the same way, every time. This is the skill that quietly powers every agent and swarm you'll build later. Today it earns its keep by turning a blank `GAME.md` into a real design doc.

---

## 🧠 The Briefing

R.A.C.E. is your foundation. These are the power tools you bolt onto it.

### System prompt vs. user prompt

Every chat actually has two layers:

- **System prompt** — the *standing orders*. The AI's job, rules, personality, and constraints that apply to the *whole* conversation. Set once, obeyed throughout.
- **User prompt** — the individual messages you type, the specific asks.

Think of it like a job: the **system prompt** is the contract and job description; the **user prompts** are the day-to-day tasks. In claude.ai you set a soft system prompt just by opening with it:

```
For this whole conversation, you are a senior game designer who only suggests
ideas a 2-person beginner team can actually build in Phaser 3. Be blunt about
scope. Never suggest 3D or multiplayer. Got it? Then wait for my first task.
```

Everything after that inherits those rules. When you write real agent code in Act 2, the system prompt becomes an actual separate field — same idea, now it's structural.

### Roles & personas (turn the dial all the way)

You met Role in Quest 1. Go further — a rich persona shapes *vocabulary, priorities, and what it even notices*:

```
You are "Marge," a grizzled QA lead with 15 years testing mobile games. You are
allergic to feature creep and you've killed a hundred bloated designs. Be terse.
```
A persona isn't a costume — it changes the *substance* of the answer. "Marge" will flag scope problems a generic assistant glosses over.

### Few-shot examples (show, don't tell)

The single most powerful move. Instead of *describing* the format you want, **show examples** and let it pattern-match:

```
Turn each game idea into a punchy store blurb. Examples:

Idea: dodge falling rocks → Blurb: "ROCK BOTTOM — gravity wants you dead. How
long can you last?"
Idea: feed a growing slime → Blurb: "GROW GOOP — feed the blob. Don't let it eat
YOU."

Now do this one: Idea: a snake that paints the floor →
```
"Zero-shot" = no examples. "Few-shot" = a handful. Few-shot crushes vague instructions because the model is a pattern machine — give it the pattern.

### Chain-of-thought ("think step by step")

For anything that needs *reasoning* — logic, math, planning, balancing — tell it to work through it before answering:

```
Work through this step by step before giving your answer: if a level needs to
last ~60 seconds and the player jumps every ~2 seconds, roughly how many
obstacles should I place, and how far apart? Show your reasoning, then the number.
```
Forcing the steps out loud genuinely improves accuracy on hard problems — it can't "show its work" and skip the thinking at the same time. For simple lookups, skip it (it just adds noise).

### Output formatting (make it usable)

Tell it the exact shape and it'll hold it:

- **Table:** `"Reply as a markdown table with columns: X | Y | Z."`
- **JSON** (you'll need this for agents): `"Reply with ONLY valid JSON, no prose: {\"title\": ..., \"difficulty\": ...}."`
- **Markdown doc:** `"Format as markdown with ## headers for each section."`

> 🤖 **Co-pilot tip:** When you want JSON for code, add *"Output only the JSON, no explanation, no markdown fences."* Models love wrapping JSON in ```` ```json ```` fences and chatty preambles that crash your parser. Tell it not to.

### Give it an "out" (the anti-hallucination move)

Because the model predicts *plausible* text, cornering it ("what's the answer?") invites it to **invent** one. Give it permission to bail:

```
If you don't know or aren't sure, say "I'm not sure" — do NOT guess or make up
facts, names, or numbers.
```
One line. Massively fewer confident lies. You'll lean on this hard in the audit Act.

### Temperature / creativity intuition

**Temperature** is a randomness dial on how the model picks each next token. Low (~0–0.3) = focused, consistent, repeatable — for code, JSON, facts. High (~0.8–1.0) = wild, varied, surprising — for brainstorming and creative writing. claude.ai hides the dial, but you can fake it with words: *"give me your safest, most conventional answer"* vs. *"go weird, take risks, surprise me."* When you write API code in Act 2, temperature becomes a real number you set.

### A worked example: weak → great in 3 iterations

Watch a junk prompt get *engineered*:

**Iteration 1 (weak):**
```
write a description for my game
```
→ Generic, has no idea what your game is. Useless.

**Iteration 2 (added R.A.C.E.):**
```
You're a game copywriter. Write a store description for my browser game where you
play a raccoon stealing snacks from a campsite while dodging a flashlight. Make it
fun.
```
→ Way better, but tone's random, length's random, and you got one option.

**Iteration 3 (engineered: persona + examples + format + constraints):**
```
You are a punchy indie-game copywriter (think itch.io, not corporate). 

Write 3 store descriptions for my browser game: you're a raccoon stealing snacks
from a campsite, dodging a sweeping flashlight beam. Tone like these examples:
- "DELIVER OR DIE — 60 seconds. Hot pizza. Angry traffic. Go."
- "GROW GOOP — feed the blob. Don't let it eat YOU."

Rules: each under 30 words, lead with a CAPS hook, end with a dare. Give me 3
distinct angles (funny / tense / cute). Output as a numbered list.
```
→ Three sharp, on-brand, ready-to-paste options. *That's* the job. Notice it's just the power moves stacked: **persona + few-shot + format + constraints**.

> ⚠️ **Real Talk:** More instructions isn't always better. Cram in 12 conflicting rules and the model gets confused or quietly ignores half. Engineering is about the *right* instructions, clearly ordered — not the most. If a prompt gets worse as you add to it, you've over-stuffed it. Cut back.

---

## 🛠️ The Quest (do this now)

### Step 1 — Drill each technique once
In claude.ai, deliberately practice each one. Don't just read them — *type them*:

1. **System prompt:** Open a chat with a standing-orders message, then give it a task and confirm it obeyed the rules.
2. **Persona:** Ask the same question to two different personas (the "Marge" QA lead vs. a hype marketer). Compare.
3. **Few-shot:** Give 2 examples of a format, then ask for a third. Watch it match.
4. **Chain-of-thought:** Give it a small balancing/logic problem with *"work step by step first."*
5. **Format lock:** Get the same answer as a table, then as JSON-only.
6. **The out:** Ask something obscure with and without *"say if you're unsure."* Compare honesty.

### Step 2 — Interview the AI to draft your GDD 🎮
This is the main event. Open `../../project/GAME.md` and read the template's sections. Pick **one** direction from your Quest 1 shortlist (your crew decides — argue it out). Then run the **interview technique** in claude.ai:

```
You are a senior game designer helping a beginner studio fill out a Game Design
Document. We're building a 2D browser game in Phaser 3. Our chosen concept:
[paste your one shortlisted idea].

Interview me to fill out this GDD, ONE question at a time. After each answer, ask
the next question. Cover, in order: the one-liner, the fun hook, the core loop
(3–5 actions), win/lose conditions, controls, look & feel, and the REALISTIC
minimum scope. Push back if my scope is too big for beginners. When we're done,
output the whole thing as clean markdown matching these section headers:
[paste the section titles from GAME.md].
```

One question at a time is the magic — it drags real decisions out of you instead of you staring at a blank template. Answer honestly. Let it challenge your scope.

### Step 3 — Write the first draft into GAME.md
Take the AI's final markdown and **fill in `../../project/GAME.md`**. Edit freely — it's *your* game, the AI is a co-writer, not the boss. This is a **DRAFT**. You'll lock it for real in Quest 6 after you research competitors and tech. Leave the "Who does what" table for your crew to assign.

---

## 🎮 Build-the-Game Tie-In

By the end of this quest, `../../project/GAME.md` has a real **first draft**: a one-liner, a hook, a core loop, win/lose, controls, a vibe, and an honest scope. That's your studio's north star locked onto paper. Every later quest — research, building the slice, the swarm — points back at this doc. Commit it with your crew so everyone's building the *same* game.

---

## 💀 Boss Challenge (+50 XP)

**One-shot the pitch.** Write a *single* mega-prompt — no follow-ups allowed — that makes the AI output a complete mini game-design pitch for your concept in one go. It must stack: **a role/persona + context about your game + at least one few-shot example of the tone/format you want + an explicit output format** (e.g. sections for Hook, Core Loop, Why It's Fun, MVP Scope, One Risk). Run it once. If the output is genuinely pitch-ready with zero edits, you beat the boss. If you had to follow up, your prompt wasn't engineered enough — refine and try again. Save your winning mega-prompt.

---

## 🏆 Achievements

- [ ] 🧬 **Persona Architect** (+15 XP) — got two personas to give substantially different answers to the same question.
- [ ] 🎯 **Few-Shot Sniper** (+15 XP) — used examples to lock an exact output format.
- [ ] 📜 **The Interview** (+20 XP) — filled out the first GDD draft via one-question-at-a-time interviewing.
- [ ] 🐉 **One-Shot Wonder** (+30 XP) — beat the Boss with a single mega-prompt.

---

## 🎒 Loot (keep this forever)

**Reusable System-Prompt Template** — paste at the top of any serious task, fill the `[BRACKETS]`:
```
You are [ROLE/PERSONA with relevant experience and a clear attitude].
Your job for this whole conversation: [the standing objective].
Rules:
- [hard constraint, e.g. "only suggest things a beginner can build"]
- [tone/format rule]
- If you're unsure or don't know, say so — never invent facts, names, or numbers.
When you reply, format as: [exact output shape].
Acknowledge these rules, then wait for my first task.
```

**The Prompt-Debugging Checklist** — when a prompt gives garbage, run down this list:
1. **Did I give it a Role?** No persona → wandering tone.
2. **Is the Action one clear ask?** Multiple buried asks → it does one and drops the rest.
3. **Did I give enough Context?** It can't read your mind or your repo (yet).
4. **Did I lock the format (Expectations)?** No format → unusable wall of text.
5. **Would an example help?** Switch from telling to *showing* (few-shot).
6. **Is it reasoning?** Add "think step by step first."
7. **Could it be hallucinating?** Add "say if you're unsure; don't guess."
8. **Did I over-stuff it?** Too many conflicting rules → cut back.
9. **Am I restarting when I should iterate?** Push back and refine in the same chat.
10. **Still bad?** Ask the AI itself: *"Why might that prompt have given a weak answer? Rewrite it to be better."*

---

## ✅ Quest Complete

- [ ] You practiced all six techniques in claude.ai.
- [ ] You ran the GDD interview (one question at a time).
- [ ] `../../project/GAME.md` has a real first draft filled in.
- [ ] Your crew agreed on ONE game direction.
- [ ] (Optional) You beat the Boss with a one-shot mega-prompt.
- [ ] You can explain *system vs. user prompt*, *few-shot*, and *temperature* to a crewmate.
- [ ] **Log your XP in `../../CREW.md`** (100 base + boss + achievements).

---

## 🔭 Going Deeper / Side Quests

- **Anthropic prompt engineering guide** — search "Anthropic prompt engineering" for the official techniques (system prompts, few-shot, chain-of-thought) straight from the source.
- **Google AI Studio 🟡** — search "Google AI Studio." Poke at its prompt interface; you'll set up its free API key in Act 2 to power your agents.
- **Side quest — the "rubric" trick:** Ask the AI to *grade its own answer* against criteria you give, then improve it. Self-critique loops are a sneak peek at the AI-judge work in Act 5.
- **Side quest — meta-prompting:** Ask *"Write the ideal prompt to get [your goal]"* and use *its* prompt. Surprisingly strong.

---

## ➡️ Next

You've mastered words of power. Time to give the AI *hands* — to stop chatting and start *acting*. Act 2 begins: meet the agent.

**→ [Quest 03 — Meet the Agent](../act2-agents/quest-03-meet-the-agent.md)**
