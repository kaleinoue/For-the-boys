# Quest 06 — Research Like a Pro
> Act 3 · Forge the Game (Research · Build · Debug) • ~90–120 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Use AI to research your game like a pro — without getting fooled by a confident fake — then LOCK a realistic Game Design Document you can actually build.

**🎒 Loadout:**
- claude.ai 🟡 (your main research partner)
- Your MCP-connected Claude Desktop 🟢 from [Quest 5](../act2-agents/quest-05-mcp.md) (optional — lets AI read your real repo)
- `project/GAME.md` (your GDD draft from Quest 2 — you're locking it today)
- A new file you'll create: `project/RESEARCH.md`

**⭐ XP on the line:** 100 base (+50 boss).

---

## 🤔 Why this Quest matters

Every studio that dies usually dies the same way: they picked a game that was too big, or built something nobody wanted, because they never actually *looked*. Research is how you find the **smallest fun version** of your idea before you waste a month coding the wrong thing.

But here's the trap: AI will happily invent "facts" with total confidence. A hallucinated stat sounds exactly like a real one. The crews that win aren't the ones who ask AI the most questions — they're the ones who **verify the answers**. Today you learn to use AI as a research engine *and* a lie detector.

---

## 🧠 The Briefing

### Research isn't "ask AI and copy the answer"

That's how you ship garbage. Real research with AI is a loop:

```
ASK  →  TRIANGULATE  →  CRITIQUE  →  VERIFY  →  DECIDE
```

- **Ask** a sharp question.
- **Triangulate** — get the same answer from 2–3 *independent* places (AI, a real website, a docs page). One source is a rumor. Three that agree is a fact.
- **Critique** — make the AI argue against itself.
- **Verify** — anything that's a number, a name, a URL, or a "best practice" gets checked against reality.
- **Decide** — turn findings into a choice you write down.

### The big danger: hallucination

A **hallucination** is a confident fabrication. The model isn't lying on purpose — it predicts plausible-sounding text, and sometimes plausible ≠ true. The killer is that a made-up "Steam sold 4 million copies" reads identically to a real one.

Things AI fakes most often:
- **Specific numbers** (sales figures, player counts, dates, percentages)
- **URLs and links** (it invents real-looking ones constantly — always click to confirm)
- **Quotes and "studies"** ("a 2021 study found…" — which study? who? link?)
- **Library/API details** (function names that don't exist — you'll feel this hard in Quest 7)

> ⚠️ **Real Talk:** The more specific and confident a claim sounds, the *more* you should check it — not less. "It's around there" is honest hedging. "Exactly 3.7 million units in Q2 2019" with no source is a red flag. Treat unsourced numbers as *guesses* until proven otherwise.

### Triangulation: make AI prove it

Don't accept a lone claim. Push:

```
For each claim you just made, rate your confidence (high/medium/low)
and tell me how I could verify it myself. If you're not sure, say
"unverified" instead of guessing.
```

Giving the AI an *out* ("say unverified") dramatically cuts the fabrication. It would rather guess than admit uncertainty — unless you give it permission to admit it.

### Make AI critique itself

The single most underrated move in this whole campaign:

```
Now argue the OPPOSITE. What's wrong with this plan? What would a
harsh, experienced critic say? Be brutal.
```

One model, two hats. The "build me up" answer and the "tear it down" answer together give you the truth in the middle. You'll use this on your scope at the end of the quest — it's how the Boss works.

> 🤖 **Co-pilot tip:** Keep one long chat per topic, not ten scattered ones. Context compounds — after you've fed it your GDD and your skill level, every later answer gets sharper because it remembers who you are and what you're building.

### Scope: find the smallest fun version

Here's the hardest skill in game dev, and it's not coding — it's **cutting**. Beginners always design a game that takes 10x longer than they think. The fix is brutal honesty about scope.

A useful frame, three tiers:

| Tier | Meaning | Example (a runner game) |
|------|---------|-------------------------|
| **Must have** | The playable core. If this works, you have a game. | Player runs, one obstacle, you can die, score counts up |
| **Nice to have** | Adds juice — only if time. | Sound, a second obstacle type, a high-score save |
| **Cut it** | v2 or never. The dream features. | Multiplayer, level editor, 30 enemy types, story mode |

Your **Must have** should be small enough to build in this Act. If you can't describe a fun 30-second version of your game, the scope is still too big.

A great test prompt:
```
You're a senior indie dev mentoring beginners who know basic JS and
are using Phaser 3. Here's our game idea: [paste]. What is the
ABSOLUTE smallest version that's still fun? What should we cut to
ship it in two weeks? Be specific about what's hard in Phaser.
```

---

## 🛠️ The Quest (do this now)

### Step 1 — Set up your research chat

Open claude.ai 🟡. Paste your current `project/GAME.md` draft and your crew's skill level:
```
You're a senior indie game designer + dev helping a 2–6 person crew,
all ~18, who can read/write basic JavaScript and are building a 2D
browser game in Phaser 3. Be honest and specific. If you're unsure of
a fact, say "unverified" rather than guessing.

Here's our current game design doc draft:
[paste project/GAME.md]
```

*(MCP option: if you set up filesystem access in Quest 5, you can instead let Claude Desktop read `project/GAME.md` straight from your repo — ask it to "read project/GAME.md and summarize our concept.")*

### Step 2 — Research the competition

Ask:
```
List 3–5 existing games similar to ours. For each: name, what's fun
about it, how it makes money / why people play, and ONE lesson we
should steal. Rate your confidence on each, and tell me how to verify.
```
Now **triangulate**: pick the two most interesting games and actually look them up (search the web, check itch.io, watch 60 seconds of gameplay on YouTube). Did they exist? Was the AI right about why they're fun? Note what was accurate vs. invented.

### Step 3 — Research mechanics (fun AND easy to build)

```
Suggest 5 core mechanics that fit our concept. For each, rate:
- Fun (1–5)
- How HARD it is to build in Phaser 3 for beginners (1–5)
We want high fun, low difficulty. Flag any mechanic that needs
networking, complex physics, or lots of art — those are scope traps.
```
You're hunting the top-left corner: **high fun, low difficulty.** That's your core mechanic.

### Step 4 — Write `project/RESEARCH.md`

Create the file and capture what you actually learned (template in 🎒 Loot below). Mark every fact as ✅ verified or ⚠️ unverified. This doc is your receipt — future-you will thank you.

### Step 5 — LOCK the GDD

Open `project/GAME.md` and finalize every section with what research told you:
- **One-liner** — one sentence, no "and also."
- **Hook** — the "one more time" reason.
- **Core loop** — the 3–5 verbs (the mechanic you picked in Step 3).
- **Win / Lose** — both clearly defined.
- **Controls** — arrow keys + one action button. Keep it tiny.
- **Scope tiers** — fill in Must / Nice / Cut honestly.
- **Tech** — Phaser 3 (you're not changing this; the skeleton's ready).

Once it's filled in, write **`LOCKED 2026-06-27`** at the top. Locked means: no new features get added without a crew vote. This is the discipline that ships games.

---

## 🎮 Build-the-Game Tie-In

This quest **is** the tie-in. You walk out of Act 3's first quest with two real artifacts in `project/`:
- **`RESEARCH.md`** — competitors, mechanics, and what's verified vs. guessed.
- **A LOCKED `GAME.md`** — a realistic GDD whose Must-have tier is small enough to actually build.

Next quest you start writing the code. You can only do that cleanly because today you decided *exactly* what the smallest fun version is.

---

## 💀 Boss Challenge (+50 XP)

**Red-team your own scope.** Paste your locked GDD into AI and run:
```
You're a brutally honest senior dev. This is our locked scope. Tell me:
what will make this take 10x LONGER than we think? Where will beginners
in Phaser get stuck for days? What's secretly hard that looks easy?
List the top 5 scope traps and, for each, the cheapest cut that avoids it.
```
Read every trap. Then actually **cut something** from your Must-have tier and move it to Nice-to-have. Write a one-line note in `RESEARCH.md`: *"Cut [X] because the red-team flagged [Y]."* Cutting under fire is a senior-dev move. That's the +50.

---

## 🏆 Achievements

- [ ] 🔎 Triangulator (+20 XP) — caught at least one AI claim that was wrong or unverifiable when you checked it against a real source.
- [ ] ✂️ The Scope Slayer (+15 XP) — moved a feature from Must-have to Cut-it before writing any code.
- [ ] 🔒 Locked In (+15 XP) — `GAME.md` is fully filled in and stamped LOCKED.

---

## 🎒 Loot (keep this forever)

### 1. The Research-Prompt Template
Reuse this for *any* research, in this campaign or beyond:
```
You're a senior [domain] expert helping me research [topic] for [goal].
My background: [what you know]. Be specific and honest.

1. Give me the key findings as a table: Claim | Why it matters | Confidence (H/M/L) | How I can verify it.
2. For anything you're not sure of, write "unverified" — do NOT guess.
3. Then argue the OPPOSITE: what's wrong with this, what would a harsh critic say?
4. End with: the 3 things I should verify myself before trusting this.
```

### 2. The Scope-Cutting Checklist
Run a feature through this before it earns "Must have":
- [ ] Can I describe the **30-second** version of the game without this? (If yes → not Must-have.)
- [ ] Does it need **networking / multiplayer**? → Cut for v1.
- [ ] Does it need **lots of custom art or animation**? → Cut or fake it with shapes.
- [ ] Does it need **complex physics or AI**? → Simplify hard.
- [ ] Could a stranger have **fun without it**? (If yes → demote to Nice-to-have.)
- [ ] Is it **the core mechanic** or **decoration**? Only the core mechanic is Must-have.

> Save both into `CHEATSHEET.md` or keep this quest bookmarked.

---

## ✅ Quest Complete

- [ ] Ran an AI research chat and **triangulated** at least one claim against a real source.
- [ ] Created `project/RESEARCH.md` with findings marked ✅ verified / ⚠️ unverified.
- [ ] Picked a core mechanic that's **high fun, low Phaser difficulty**.
- [ ] Fully filled in and **LOCKED** `project/GAME.md`.
- [ ] (Boss) Red-teamed scope and cut at least one feature.
- [ ] Logged your XP in [`CREW.md`](../../CREW.md). 🎉

---

## 🔭 Going Deeper / Side Quests

- **Play your competitors.** Actually play 2–3 of the games you found on itch.io (free, in-browser). Nothing teaches "what's fun" like feeling it.
- **Read a real GDD.** Search for "one-page game design document" examples — see how tiny a good one can be. Yours should be that short.
- **Phaser examples gallery.** Browse the official examples at phaser.io (look for "Examples" in their docs) and note which of your mechanics already have a working sample. Free starter code = a huge scope cut.
- **Side challenge:** Have two crew members research the *same* mechanic in separate AI chats, then compare. Where the answers disagree is exactly where you need to verify.

---

## ➡️ Next

Time to stop planning and start *building*. You'll copy the skeleton into `project/src/` and turn a moving square into the first real slice of YOUR game.

➡️ **[Quest 07 — Vibe Coding the Game](quest-07-vibe-coding.md)**
