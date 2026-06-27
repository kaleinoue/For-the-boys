# Quest 01 — Talk to the Machine
> Act 1 · Words of Power (Prompting) • ~60–90 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Learn how an AI actually thinks, then bend it to your will with one good prompt — and walk away with 50 game ideas your studio could actually build.

**🎒 Loadout:**
- claude.ai 🟡 (free browser chat — make an account, no card needed)
- `../../CHEATSHEET.md` (the R.A.C.E. recipe lives there)
- A scratch doc or notes app to save ideas
- Your crew (this is more fun out loud)

**⭐ XP on the line:** 100 base. (No boss this quest — Quest 2 has one.)

---

## 🤔 Why this Quest matters

Everyone "uses AI." Almost nobody is *good* at it. The gap between a person who types `"give me game ideas"` and someone who writes a real prompt is the gap between a vending machine and a co-founder. This quest is where you stop poking the machine and start *driving* it. Get this right and every single quest after it — agents, research, building the game — gets 10x easier, because all of it runs on talking to the machine well.

---

## 🧠 The Briefing

### What an LLM actually is (the intuition, not the math)

An LLM (Large Language Model — Claude, Gemini, GPT, all of them) is, at its core, a ridiculously good **autocomplete**. That's not an insult. It read a huge slice of the internet, books, and code, and learned one trick absurdly well: *given some text, predict what comes next.*

You type something. It predicts the next chunk. Then the next. Then the next — one piece at a time — until it's done. That's it. There's no tiny person inside. There's a prediction engine that's seen so much text that "predict the next word" turns into "write a working function" or "brainstorm 50 game ideas."

Three words you need, because they explain *everything* weird the AI does:

| Term | Plain meaning | Why you care |
|------|---------------|--------------|
| **Token** | A chunk of text — roughly ¾ of a word (`"unbelievable"` might be 3 tokens). The model reads and writes in tokens, not letters. | It's why AI is bad at "how many R's in strawberry" — it doesn't see letters, it sees tokens. |
| **Context window** | The model's short-term memory: everything it can "see" at once — your prompt *plus* the whole conversation so far. | When a long chat goes dumb or "forgets," you blew past or buried it in the window. Start fresh. |
| **Prediction** | It generates the *most likely* next token, not the *true* one. | This is why it can sound 100% confident and be 100% wrong. It's predicting, not knowing. |

> 🤖 **Co-pilot tip:** Want to *see* tokens? Search for "tiktokenizer" or any online tokenizer and paste a sentence in. Watching `"strawberry"` split into chunks makes the whole "why is it bad at spelling" thing click instantly.

### Why specificity is the whole game

Because it's predicting the *most likely* continuation, a vague prompt makes it guess what you meant — and "most likely" means "most generic." Vague in, mush out. The more precisely you describe what you want, the narrower and sharper its prediction gets.

Watch the difference. Same goal, two prompts:

**❌ Vague prompt:**
```
give me some game ideas
```
**What you get:** Five painfully generic ideas — "a platformer," "a puzzle game," "an RPG." Stuff you'd have thought of in the shower. Useless.

**✅ Sharp prompt:**
```
You're a senior indie game designer who ships small, addictive browser games.
Brainstorm 10 original game ideas for a crew of beginner coders building in
Phaser 3 (a 2D JavaScript engine). Each game must be finishable in 2–3 weeks,
playable in a browser with arrow keys + one button, and have ONE hook that makes
people replay it.

Format as a table: Title | One-line pitch | Core hook | Coding difficulty (1–5).
```
**What you get:** Ten ideas you could actually start *today*, scoped to your skill level, in a table you can skim. Night and day.

The difference wasn't the AI. It was you.

### The R.A.C.E. recipe (your default prompt shape)

That sharp prompt wasn't luck. It had four parts. Memorize these and you'll never write a mush prompt again. (This lives in `../../CHEATSHEET.md` too — bookmark it.)

- **R — Role:** Who should the AI *be*? → *"You're a senior indie game designer..."*
- **A — Action:** What *exactly* do you want? → *"...brainstorm 10 original game ideas..."*
- **C — Context:** What does it need to know? → *"...for beginner coders, Phaser 3, finishable in 2–3 weeks, arrow keys + one button..."*
- **E — Expectations:** What should the output *look like*? → *"...as a table: Title | Pitch | Hook | Difficulty (1–5)."*

Miss one and quality drops. No **Role** and the tone wanders. No **Context** and it gives you ideas for a 60-person AAA studio. No **Expectations** and you get a wall of prose you have to reorganize yourself.

### Iterate, don't restart

Here's the rookie move: get a meh answer, sigh, and start a brand-new chat with a slightly different prompt. **Stop doing that.** The AI remembers the whole conversation (that's the context window working *for* you). Just push back and refine, like you would with a teammate:

```
Good start. Now: cut anything that needs multiplayer or 3D. Make 5 of them
weirder and more original — surprise me. Keep the table format.
```

Each turn builds on the last. You're sculpting, not rerolling. The best AI users have *long* conversations that get sharper, not a graveyard of abandoned one-shot prompts.

> ⚠️ **Real Talk:** The AI will hand you a confident, well-formatted answer even when it's wrong — wrong facts, fake "statistics," made-up game studios, dead links. It is *predicting plausible text*, not checking truth. Treat every factual claim as "probably right, verify before you bet on it." You'll go deep on this in the security and audit Acts. For now: trust the *vibes*, verify the *facts*.

---

## 🛠️ The Quest (do this now)

### Step 1 — Get into claude.ai 🟡
Go to **claude.ai**, sign up (free, no credit card). This is your prompting dojo for all of Act 1. You'll hit a usage limit if you go hard — that's the free tier; just wait it out or pick it up later.

### Step 2 — Feel the difference yourself
Paste the **vague** prompt (`give me some game ideas`). Read the slop. Now paste the **sharp** R.A.C.E. prompt from the Briefing. Read *that*. You just felt, in your own hands, why this whole Act exists. Don't skip this — it's the lesson.

### Step 3 — Run three prompt experiments
For each, notice exactly what changed in the output:

1. **Role swap:** Take any question and prepend `"You are a brutally honest game critic."` then re-ask as `"You are a hype-man who loves everything."` Same question, watch the tone flip.
2. **Add Expectations:** Ask `"Explain what makes a game addictive."` Then re-ask: `"...in exactly 5 bullet points, each under 12 words."` See how format control = usable output.
3. **Iterate:** After any answer, reply `"Make it half as long and twice as punchy."` Watch it refine instead of restart.

### Step 4 — THE BIG ONE: brainstorm 50 game ideas 🎮
This kicks off your capstone. Open a fresh chat and paste this (the full template is in your **Loot** below — tweak the context to fit your crew):

```
You're a senior indie game designer who has shipped dozens of small, addictive
browser games. You're brainstorming with a new studio: a crew of ~4 friends, age
18, who can read/write basic Python and JavaScript and will build in Phaser 3
(a 2D browser game engine, free).

Brainstorm 50 original browser-game ideas for us. Hard constraints:
- 2D only, playable in a browser, controllable with arrow keys + one action button
- Finishable by beginners in 2–3 weeks of part-time work
- Each must have ONE clear "hook" that makes someone replay it
- No multiplayer, no 3D, no huge art requirements

Go wide — mix genres, be weird, surprise us. Number them 1–50 and format as a
table: # | Title | One-line pitch | Core hook | Coding difficulty (1–5).

Before you start, if anything's unclear, ask me up to 3 questions first.
```

Notice the last line — *asking it to ask you* surfaces what it's missing before it wastes a generation. Answer its questions, then let it rip.

### Step 5 — Shortlist 5, as a crew
Read all 50 out loud with your crew. Argue. Then tell the AI:
```
Here are the 5 we like best: [paste them]. For each, give me a one-sentence
reason it could be a hit AND the single biggest risk to building it.
```
This pressure-tests your gut picks before you commit.

---

## 🎮 Build-the-Game Tie-In

This quest *is* the first move of your studio. By the end you have:
1. A saved list of **50 game ideas** (copy the whole table into a notes doc — you'll want the rejects later).
2. A **shortlist of 5 favorites** your crew actually argued for, with reasons + risks.

Save both somewhere safe (a shared doc, or a new `project/ideas.md` if you like). **Don't** fill in `project/GAME.md` yet — that's Quest 2, where you'll interview the AI to turn one of these into a real design doc.

---

## 🏆 Achievements

- [ ] 🔥 **Prompt Whisperer** (+20 XP) — ran the vague vs. R.A.C.E. prompts back-to-back and *saw* the difference.
- [ ] 🎲 **The 50** (+20 XP) — generated a full list of 50 game ideas and saved it.
- [ ] 🗳️ **The Council** (+10 XP) — shortlisted 5 favorites as a crew, with reasons and risks.

---

## 🎒 Loot (keep this forever)

**The R.A.C.E. recipe** (your default prompt shape):
> **Role** (who the AI is) + **Action** (what you want) + **Context** (what it needs to know) + **Expectations** (what the output should look like).

**The Idea-Storm Prompt™** — reusable for *any* brainstorm, not just games. Swap the `[BRACKETS]`:
```
You're a [EXPERT ROLE with relevant experience].

Brainstorm [NUMBER] original ideas for [GOAL / PROJECT]. Hard constraints:
- [constraint 1]
- [constraint 2]
- [each idea must have ONE clear hook / differentiator]

Go wide — mix approaches, be bold, surprise me. Number them and format as a
table: # | Title | One-line pitch | Key hook | Difficulty (1–5).

Before you start, if anything's unclear, ask me up to 3 questions first.
```

---

## ✅ Quest Complete

- [ ] You have a claude.ai 🟡 account and used it.
- [ ] You ran the vague-vs-sharp comparison and the three experiments.
- [ ] You generated **50 game ideas** and saved them.
- [ ] You shortlisted **5 favorites** with your crew (reasons + risks).
- [ ] You can explain *token*, *context window*, and *R.A.C.E.* to a crewmate.
- [ ] **Log your XP in `../../CREW.md`** (100 base + any achievements).

---

## 🔭 Going Deeper / Side Quests

- **Anthropic's prompting docs** — search "Anthropic prompt engineering overview." The official guide; clear and practical.
- **Tokenizer playground** — search "tiktokenizer" and paste your weirdest sentences in. See tokens with your own eyes.
- **Side quest:** Re-run the 50-ideas prompt with a wildly different Role ("You're a chaotic art-school dropout who hates conventional games"). Compare the lists. Role changes *everything*.
- **Side quest:** Try the same prompt in Google AI Studio 🟡 (you'll set it up in Act 2). Notice how the *prompt skill* carries across every model.

---

## ➡️ Next

You can talk to the machine. Now learn to *engineer* it — system prompts, personas, few-shot examples, and the techniques pros use to get gold every time.

**→ [Quest 02 — Prompt Engineering](quest-02-prompt-engineering.md)**
