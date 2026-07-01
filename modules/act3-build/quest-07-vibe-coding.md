# Quest 07 — Vibe Coding the Game
> Act 3 · Forge the Game (Research · Build · Debug) • ~120 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Use AI to write Phaser code *fast* — while still understanding every line — and turn the skeleton into a playable vertical slice of YOUR game: the player plus ONE core mechanic, working.

**🎒 Loadout:**
- claude.ai 🟡 (your pair-programmer)
- VS Code 🟢
- `starter-code/game-skeleton/index.html` (the one-file Phaser game you're about to copy & mutate)
- Your LOCKED `project/GAME.md` from [Quest 6](quest-06-research.md) — your build target
- A browser (Chrome/Firefox) to run the game — Phaser loads from a CDN, no install

**⭐ XP on the line:** 100 base (+50 boss).

> 🎨 **Jonah — this is your level.** Right now the game is a blue square. By the end
> of this quest it should start looking like *yours*. While the crew vibe-codes the
> mechanic, you drive the look: sketch the style, lock the palette, design the first
> real sprite. A game that looks like an artist made it beats an asset-flip every
> single time. (Zeppelin: you own the *feel* of how it moves. Pair up.)

---

## 🤔 Why this Quest matters

"Vibe coding" — building with AI writing most of the code — is a superpower and a trap at the same time. Done right, you ship in hours what used to take days. Done wrong, you end up with a pile of code you can't read, can't fix, and can't extend — a haunted house you built but can't walk through.

The line between the two is one rule: **never paste code you can't explain.** Today you learn the disciplined version: read every diff, ask AI *why*, ship ugly first, and stay the one in control. By the end you'll have a real, playable slice of your game running in your browser.

---

## 🧠 The Briefing

### Vibe coding, done right

The wrong way: "AI, build my whole game," paste 400 lines, it half-works, you have no idea why, and the moment something breaks you're dead.

The right way is a tight loop:

```
ASK for a small change  →  READ the diff  →  ASK "why?"  →  RUN it  →  next small change
```

Three non-negotiable rules:
1. **Small steps.** One mechanic, one change at a time. Never "build the whole thing."
2. **Read every line it writes.** If you can't say what a line does, ask before you paste.
3. **Run after every change.** A working ugly game beats a broken beautiful one.

> ⚠️ **Real Talk:** AI hallucinates code too. It will confidently call Phaser functions that don't exist or use an API from a different version. If a method looks unfamiliar, check it against the real Phaser docs (phaser.io) before trusting it. The browser console (you'll meet it in Quest 8) will scream when AI invents something — that's a feature, not your failure.

### The Phaser skeleton: three functions run everything

Open `starter-code/game-skeleton/index.html`. The entire game lives in three functions wired into a `scene`:

```js
scene: { preload, create, update }
```

| Function | When it runs | What goes here |
|----------|-------------|----------------|
| **`preload()`** | **Once**, at the start | Load assets — images, sounds. `this.load.image('zeppelin', 'player.png')`. The skeleton loads nothing yet (it draws shapes instead). |
| **`create()`** | **Once**, after preload | Build the world — make the player, the coin, the score text, set up collisions and keyboard input. This is your "set the stage." |
| **`update()`** | **~60 times per second**, forever | The game loop — movement, checks, anything that happens "every frame." The skeleton reads arrow keys here and moves the player. |

That's the whole mental model. **Set up once in `create()`, then react every frame in `update()`.** Everything you add to your game slots into one of these three.

Look at what the skeleton already gives you (read the real file — these are the exact lines):
- A **player**: `this.add.rectangle(...)` + `this.physics.add.existing(player)` makes a square that physics can move.
- A **coin**: a circle with physics on it.
- **Collision → reward**: `this.physics.add.overlap(player, coin, () => { ... })` fires a function when they touch — that's where the score goes up and the coin teleports.
- **Input**: `this.input.keyboard.createCursorKeys()` reads the arrow keys; `update()` turns key presses into velocity.

Your job: keep this skeleton, and re-skin its *meaning*. The "coin" becomes whatever your game collects/dodges/hits. The "score" becomes your win condition. The square becomes your player.

### How to ask AI to modify Phaser code (the right prompt)

Give it the **real file**, the **exact change**, and your **constraints**:

```
Here's my Phaser 3 game (one file). [paste index.html]

I want to change ONE thing: instead of collecting a coin, the falling
note should HURT the player ('zeppelin', our runner) and end the game
on contact. Keep it Phaser 3, keep everything else working, and explain
each change you make and WHY. Show me only the lines that change.
```

Why this prompt wins:
- **"one thing"** keeps the diff small and readable.
- **"keep everything else working"** stops it rewriting your whole file.
- **"explain each change and WHY"** turns it into a lesson, not a black box.
- **"only the lines that change"** = a diff you can actually review.

### How to read the result

When AI hands you code back, before you paste:
1. **Find what changed.** Compare to your file. Which lines are new/different?
2. **Explain each one to yourself** (or a crewmate — rubber-ducking). If you hit a line you can't explain, ask: *"What does this line do, and what breaks if I delete it?"*
3. **Spot-check unfamiliar Phaser calls** against phaser.io docs.
4. **Then** paste, save, and reload the browser.

> 🤖 **Co-pilot tip:** When the AI uses a Phaser function you've never seen, don't just trust it — ask *"is `this.physics.add.collider` real in Phaser 3.80, and how is it different from `overlap`?"* You'll learn the engine twice as fast, and you'll catch hallucinated APIs before they waste an hour.

### Ship ugly first

Your slice should look like programmer art — colored rectangles and circles, exactly like the skeleton. **That's correct.** Pretty comes last. A slice you can *play* — even as squares — tells you whether your game is fun. A beautiful menu for a game that doesn't exist tells you nothing.

> ⚔️ **Zeppelin (Vanguard):** while Jonah owns the *look*, you own the *feel*. Even as a plain square, movement can feel floaty or crisp — that's velocity, acceleration, and how fast it stops. You're the athlete; you know the difference between a control that feels tight and one that feels like ice. Tune the numbers (`240` → try `300`, add a little drag) and reload until moving the square just *feels good*. Nail that now, with squares, and the game's already half-won before a single sprite exists.

---

## 🛠️ The Quest (do this now)

### Step 1 — Copy the skeleton into your project
From the repo root:
```bash
mkdir -p project/src
cp starter-code/game-skeleton/index.html project/src/index.html
```
Open `project/src/index.html` in VS Code. Double-click it (or drag it) into your browser. You should see a blue square you move with arrows and a yellow coin to grab. **This is your starting block.** Everything from here is editing this file.

### Step 2 — Re-skin the meaning (no AI yet — just you)
Make tiny edits by hand so you *own* the file:
- Change the player color/size in `create()` (`0x42a5f5` → your color).
- Change the score text wording (`'Score: 0'` → e.g. `'Coins: 0'`).
- Reload the browser after each save. Feel the loop: **edit → save → reload.**

> 🔋 **Jyana (Engine):** this loop is your fuel. Edit → save → reload is a rep, and reps are where you shine — you'll run twenty of them before anyone else has run five. Point that drive at one clear tweak at a time and just keep flooring it; the crew ships fast because you don't let the momentum die.

### Step 3 — Bring in AI for the core mechanic
Pick the ONE mechanic from your locked GDD. Use the prompt template from Loot below. Examples of "one mechanic" slices:
- **Dodge game:** the circle falls from the top; touching it ends the game.
- **Collector with a timer:** add a 30-second countdown in `create()`/`update()`; game ends at 0.
- **Chaser:** the circle moves *toward* the player each frame in `update()`.

Ask AI for just that one change. Read the diff. Ask "why" on anything unclear. Paste. Reload.

### Step 4 — Loop until the slice is real
Repeat Step 3 for **at most 2–3 small changes** until you have: a player you control + one core mechanic + a clear win or lose state. Run it after *every* change. The moment it's playable as squares, **you've shipped a vertical slice.** Stop adding features — that's Quest 8's job.

### Step 5 — Save your work
You'll commit it properly with Git next quest, but for now make sure `project/src/index.html` is saved. That file *is* your game now.

---

## 🎮 Build-the-Game Tie-In

You now have **`project/src/index.html`** — a playable vertical slice of your actual game. Not a mockup, not a doc: a thing you open in a browser and *play*. The skeleton's square-and-coin has become your player and your one core mechanic. This is the spine of the whole game; everything in Acts 3–6 hangs off it.

---

## 💀 Boss Challenge (+50 XP)

**Add juice — and understand every drop.** Pick ONE and have AI help you build it, reading and explaining each change:
- **Sound:** load a free sound effect in `preload()` (`this.load.audio(...)`) and play it on the collision in `create()`.
- **Feedback / particles:** flash the player, shake the camera (`this.cameras.main.shake(...)`), or pop a tween when the mechanic fires.
- **Title screen:** add a second Phaser scene that says your game's name and "Press SPACE to start," then switches to the game scene.

Rule for the +50: for **every line** AI adds, you can explain what it does. If you can't, you didn't earn it — ask first. Juice is what makes a game *feel* good; understanding it is what makes you a dev.

---

## 🏆 Achievements

- [ ] 🎮 First Playable (+20 XP) — your slice runs in the browser with a player + one core mechanic.
- [ ] 🧠 No Black Boxes (+15 XP) — you can explain every line AI wrote into your file.
- [ ] 🧽 Ship-Ugly Champion (+10 XP) — your slice is fun (or fun-ish) using only shapes, no art.

---

## 🎒 Loot (keep this forever)

### The "Modify My Code" Prompt Template
The single most useful coding prompt you'll own. Reuse it forever:
```
Here's my [language/framework] code:
[paste the full file]

I want to change ONE thing: [describe the single change].

Rules:
- Keep everything else working.
- Stay in [Phaser 3 / the same version].
- Show me ONLY the lines that change (like a diff).
- Explain each change and WHY you made it.
- If a function might not exist in this version, flag it so I can verify.
```

Pair it with the **read-before-you-paste** ritual:
1. What changed?  2. Can I explain each new line?  3. Are the API calls real?  4. Run it.

---

## ✅ Quest Complete

- [ ] Copied the skeleton into `project/src/index.html`.
- [ ] Hand-edited it once so you own the file (color, text — your call).
- [ ] Used AI to add your ONE core mechanic, reading every diff.
- [ ] Your slice **runs in the browser**: player + core mechanic + a win/lose state.
- [ ] You can explain every line AI wrote.
- [ ] (Boss) Added juice and understood each change.
- [ ] Logged your XP in [`CREW.md`](../../CREW.md). 🎉

---

## 🔭 Going Deeper / Side Quests

- **Phaser official docs & examples:** phaser.io has a huge "Examples" section — search for "player movement," "collision," or "tween." Free, working code you can study and steal.
- **Free assets:** when you're ready to swap shapes for sprites, search itch.io and OpenGameArt for CC0 / free art and Freesound for sound effects. (Verify the license before shipping.)
- **MDN on the `<canvas>`:** Phaser draws to an HTML canvas. Skim MDN's canvas intro to understand what's under the hood.
- **Side challenge:** add a SECOND mechanic to your slice the same disciplined way — but only after the first one is solid. Resist the urge to pile on; small and working wins.

---

## ➡️ Next

Your slice works… mostly. Time to fix what's broken with AI like a pro — and learn the Git team flow so your whole crew can build on this game without stepping on each other.

➡️ **[Quest 08 — Debug & Iterate (+ the Team Git Flow)](quest-08-debug-and-iterate.md)**
