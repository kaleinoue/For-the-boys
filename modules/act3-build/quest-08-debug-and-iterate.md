# Quest 08 — Debug & Iterate (+ the Team Git Flow)
> Act 3 · Forge the Game (Research · Build · Debug) • ~90–120 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Squash a real bug in your game slice using AI like a pro — then learn the Git team workflow so your whole crew can build the game together without chaos.

**🎒 Loadout:**
- claude.ai 🟡 (your debugging partner)
- VS Code 🟢 + your browser's **DevTools console** (press **F12** / right-click → Inspect → Console)
- Git + GitHub 🟢 (your crew's shared repo, `For-the-boys`)
- `project/src/index.html` — the playable slice from [Quest 7](quest-07-vibe-coding.md)

**⭐ XP on the line:** 100 base (+50 boss).

---

## 🤔 Why this Quest matters

Two skills separate a hobbyist from a studio. First: **debugging without panic** — bugs aren't failures, they're the job, and AI makes you 10x faster at killing them *if* you feed it the right context. Second: **working as a team without overwriting each other** — that's Git. A crew of 4 editing the same file with no Git is a guaranteed disaster of lost work and "wait, who deleted my code?"

Today you get both. By the end, your core loop is solid *and* your crew can collaborate on the real repo like a real team.

---

## 🧠 The Briefing — Part A: Debugging with AI

### Read the actual error first

Most beginners see red text and panic. Don't. The error is *the answer, mostly written for you.* In the browser, open the **console** (F12 → Console tab) — when your Phaser game breaks, the real error shows up here, usually with a **file, a line number, and a message**:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'setVelocity')
    at update (index.html:63)
```

That tells you: line 63, something is `undefined`, you tried to call `setVelocity` on it. Half the fix is already in the message — probably `player.body` isn't ready or `player` wasn't created.

> ⚠️ **Real Talk:** The console is your best friend and most beginners never open it. If your game "just doesn't work" with no visible error on the page, **the error is almost always sitting in the console.** Open F12 *first*, every time. Silence on the page ≠ no error.

### Feed AI the FULL context (not "it's broken")

Garbage context in, garbage fix out. When you ask AI to debug, give it everything:

```
My Phaser 3 game throws this error:
[paste the FULL error from the console, including the line number]

Here's the relevant code:
[paste the function it points to — and a bit around it]

What I expected: [the player should move].
What actually happens: [nothing moves, console shows the error above].

Explain WHY this happens, then give me the smallest fix. Don't rewrite
the whole file.
```

The four magic ingredients: **full error**, **the actual code**, **expected vs. actual**, and **"explain the why."** Skip any one and the AI guesses.

### Ask for the WHY, then rubber-duck

- **"Explain the why"** so the same bug never beats you twice. A fix you don't understand is a bug you'll re-create.
- **Rubber-ducking:** explain the bug out loud, line by line, to a crewmate or literally a rubber duck. You'll often spot it mid-sentence — your brain debugs better when forced to narrate.

> 🤖 **Co-pilot tip:** When AI gives you a fix, ask *"what was the root cause, and how do I avoid this whole class of bug next time?"* You're not just fixing one bug — you're leveling up so a hundred future bugs never happen.

---

## 🧠 The Briefing — Part B: The Team Git Flow

Git is a **time machine + a merge machine** for your code. GitHub is where your crew's copy lives online. The team flow exists so two people can work at once and nobody loses work.

### The mental model

```
main (the real game, always works)
  └─ your-branch (your safe sandbox)  → commit → push → Pull Request → merge back to main
```

- **Branch:** your own copy of the code to mess with. Breaking it can't hurt `main`.
- **Commit:** a saved snapshot with a message ("add jump sound"). Save points.
- **Push:** upload your commits to GitHub so others can see them.
- **Pull Request (PR):** "hey crew, here's my change — review and merge it into `main`."
- **Pull:** download everyone else's merged work so your copy stays current.

### The golden rule of teams

**Never commit straight to `main`. Always branch.** `main` is the always-works version everyone shares. You experiment on a branch, then merge in through a PR. This one habit prevents 90% of team Git pain.

> 🎮 **Crew move — name branches `yourname/what-it-does`:** that prefix tells everyone, at a glance, whose work it is. For this crew that looks like:
> - `zeppelin/add-double-jump` — Vanguard tuning the movement
> - `leo/title-music` — Bard wiring up the sound
> - `jonah/player-sprite` — Artificer dropping in real art
> - `jyana/pause-menu` — Engine grinding a clear task to done
>
> Four branches, four lanes, no stepping on each other. When you `git branch` and see all four names side by side, that's the studio working in parallel.

> 🔋 **Jyana (Engine):** hand you a scoped branch like `jyana/pause-menu` or `jyana/restart-button` and you'll grind it to *done* faster than anyone — that relentless motor is your superpower. Watch for the tell: when you're not sure what to build next and the drive starts spinning, that's not "you're stuck," that's the signal to break the work into a clearer, smaller task. Get the next concrete step, *then* floor it.

### The 8 commands you'll actually use

```bash
git pull origin main                   # 1. get the latest before you start
git checkout -b zeppelin/add-double-jump  # 2. make + switch to your own branch
git add project/src/index.html         # 3. stage the files you changed
git commit -m "Add double jump"        # 4. save a snapshot with a message
git push -u origin zeppelin/add-double-jump  # 5. upload your branch to GitHub
# 6. open a Pull Request on github.com (the site walks you through it)
git checkout main                      # 7. switch back to main when merged
git pull origin main                   # 8. pull the merged changes down
```

### Merge conflicts (don't fear them)

A **conflict** happens when two people change the *same lines*. Git can't guess who's right, so it marks it:

```
<<<<<<< HEAD
const speed = 240;
=======
const speed = 300;
>>>>>>> zeppelin/add-double-jump
```

(Classic one: Jonah bumped `speed` to `240` on his sprite branch, Zeppelin pushed it to `300` because the movement felt sluggish. Git can't pick — so they talk, decide `300` feels right, keep that, and move on.)

To resolve: **delete the markers** (`<<<<<<<`, `=======`, `>>>>>>>`) and keep the version you want (or combine them), then `git add` and `git commit`. That's it. Conflicts feel scary the first time and trivial by the third. Small, frequent PRs = tiny, easy conflicts.

> ⚠️ **Real Talk:** The #1 cause of nasty conflicts is everyone editing one giant file at the same time. Your whole game is in `index.html` right now — so coordinate: take turns on big changes, keep PRs small, and `git pull` often. As the game grows you'll split it into multiple files, which spreads everyone out.

---

## 🛠️ The Quest (do this now)

### Step 1 — Fix a real bug
Find a real bug in your slice (or plant one: change `player.body` to `playr.body` and watch it break). Then:
1. Open the browser console (**F12**) and read the actual error.
2. Use the full-context debug prompt from Part A — paste the error, the code, expected vs. actual.
3. Read the *why*, apply the smallest fix, reload. Confirm it works.

### Step 2 — Each crew member: branch, commit, PR
Every person does this on a small improvement that fits their lane — Jonah a color/sprite, Leo a sound, Zeppelin a movement tweak or bug fix:
```bash
git pull origin main
git checkout -b jonah/player-sprite
# ...make your small change in project/src/index.html...
git add project/src/index.html
git commit -m "Swap the player square for a real sprite"
git push -u origin jonah/player-sprite
```
Then on **github.com**, open a **Pull Request** from your branch into `main`. Write one sentence on what it does.

### Step 3 — Review & merge
A *different* crewmate reviews — e.g. Leo opens Jonah's `jonah/player-sprite` PR, reads the "Files changed" tab, and leaves a comment ("sprite looks great — does it still hit the same collision box?") before clicking **Merge**. Reviewing someone else's branch is how a bug gets caught before it's in `main`. Then everyone runs:
```bash
git checkout main
git pull origin main
```
so all copies are in sync. Congrats — you just ran the exact workflow real studios use.

### Step 4 — Iterate the core loop
With collaboration unlocked, tighten the game loop: clear win/lose state, score/timer that resets, a restart. Small PRs, each reviewed. Keep `main` always-playable.

---

## 🎮 Build-the-Game Tie-In

Two big upgrades to the real game: the core loop in `project/src/index.html` is now **solid and bug-fixed**, and your crew can **collaborate via Git on the real repo** — branch, PR, merge — without overwriting each other. The studio just went from "one person typing" to "a team building." Every quest from here rides on this workflow.

---

## 💀 Boss Challenge (+50 XP)

Pick ONE:
- **Protect `main`:** on GitHub → repo **Settings → Branches → Add branch protection rule** for `main`. Require a pull request before merging (and a review if your crew is 3+). Now nobody can accidentally torch the main game — the workflow is enforced, not just suggested.
- **AI-review a PR:** copy a teammate's PR **diff** (the "Files changed" view) and paste it into claude.ai:
  ```
  You're a senior dev reviewing this pull request diff (Leo's
  leo/title-music branch). Find bugs, risky changes, and anything that
  could break the game. Suggest improvements. Be specific and reference
  the lines.
  [paste the diff]
  ```
  Post the useful findings as a PR comment. You just added an AI reviewer to your studio — a taste of the swarms coming in Act 4.

---

## 🏆 Achievements

- [ ] 🐛 Bug Slayer (+20 XP) — fixed a real bug using the console + a full-context AI prompt, and can explain the root cause.
- [ ] 🌿 Branch Boss (+15 XP) — opened and merged your first Pull Request on the real repo.
- [ ] 🤝 No Lost Work (+15 XP) — the whole crew merged PRs and synced `main` with zero overwritten code.

---

## 🎒 Loot (keep this forever)

### 1. The Git Cheat-Strip (the 8 commands you'll actually use)
```bash
git pull origin main                 # get the latest before you start
git checkout -b my-branch-name       # make + switch to your own branch
git add <file>                       # stage what you changed (git add . = everything)
git commit -m "clear message"        # save a snapshot
git push -u origin my-branch-name    # upload your branch to GitHub
# → open a Pull Request on github.com, get it reviewed, merge it
git checkout main                    # back to main once it's merged
git pull origin main                 # pull the merged work down
```
Lifesavers: `git status` (what's going on?) · `git log --oneline` (history) · `git diff` (what did I change?).

### 2. The Debugging Ritual
1. **Read the actual error** (F12 → Console). The answer is usually in it.
2. **Reproduce it** — make it happen on purpose so you know when it's fixed.
3. **Feed AI full context** — error + code + expected vs. actual.
4. **Ask for the WHY**, not just the fix.
5. **Rubber-duck** — explain it out loud to a crewmate.
6. **Fix the smallest thing**, reload, confirm. Then commit.

*(Both of these belong in [`CHEATSHEET.md`](../../CHEATSHEET.md) — go add them.)*

---

## ✅ Quest Complete

- [ ] Opened the browser console (F12) and read a real error.
- [ ] Fixed a bug with a full-context AI prompt and can explain the root cause.
- [ ] Made a branch, committed, pushed, and opened a Pull Request on the real repo.
- [ ] A crewmate reviewed and merged it; everyone pulled `main`.
- [ ] The game's core loop is solid and `main` is always-playable.
- [ ] (Boss) Protected `main` or AI-reviewed a PR diff.
- [ ] Logged your XP in [`CREW.md`](../../CREW.md). 🎉

---

## 🔭 Going Deeper / Side Quests

- **GitHub's own Git tutorial:** search "GitHub Git Handbook" — short, official, free, and clearer than most.
- **Try the visual side:** GitHub Desktop (free app) does branches/commits/PRs with buttons if the command line isn't clicking yet. Learn the words here, click them there.
- **Chrome DevTools docs:** search "Chrome DevTools console overview" — the console does more than show errors (you can `console.log()` to spy on your variables).
- **Side challenge:** split your game into two files (e.g. move the game logic into a `game.js` and load it from `index.html`). Smaller files = fewer merge conflicts for the crew, and good practice for the bigger build ahead.

---

## ➡️ Next

Your game is real and your crew can build it together. Now you multiply your power: instead of one AI helper, you'll build a whole **swarm** — a designer, a coder, a playtester, and a hype agent working for your studio.

➡️ **[Quest 09 — Agent Swarms](../act4-swarms/quest-09-agent-swarms.md)**
