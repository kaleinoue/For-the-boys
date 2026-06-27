# Quest 14 — Playtest & Polish
> Act 6 · Ship It (Polish · Launch · Showcase) • ~120 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Put your game in front of real humans, shut up and watch, then use AI to turn their confusion into a ranked fix-list — and make the game *feel* good with juice.

**🎒 Loadout:**
- Your actual game running in a browser from `project/src/` (the vertical slice you built in Quests 7–8)
- 2–4 **playtesters** who are NOT in your crew (friends, siblings, that one cousin)
- claude.ai 🟡 or Google AI Studio 🟡 (to triage notes into a fix-list)
- Your **AI-judge** from Quest 13 (you'll reuse it for the balance pass)
- A note-taker + a stopwatch (your phone is fine)
- `project/RESEARCH.md` and `project/GAME.md` for reference

**⭐ XP on the line:** 100 base (+50 boss).

> 🎵 **Leo — this is your level.** "Juice" is mostly *sound and timing*, which is
> literally your craft. Hits, whooshes, a beat under the action, feedback that lands
> on rhythm — that's what turns "fine" into "I can't stop playing." This quest shows
> you free tools to make sound effects (and you can drop in music). Make it *sing*.

---

## 🤔 Why this Quest matters

You have been staring at this game for weeks. You *know* where to go, what the button does, why the enemy is "obviously" dangerous. That knowledge is poison — it makes your game look way more playable than it is. The only way to find out what you actually built is to hand it to someone who knows nothing and **watch them flounder in silence.** Every confused face is a free bug report. This quest is the difference between "my game" and "a game people can actually play."

---

## 🧠 The Briefing

### The #1 playtest rule: shut up and watch

Here's the move that feels impossible and changes everything: **you do not talk during a playtest.** No "you have to press space." No "oh that's just a placeholder." No nervous laughing. You hand them the game, say *"play this and think out loud,"* and then you become a silent, note-taking ghost.

Why? Because the second you explain something, you've contaminated the test. On launch day there's no you sitting next to every player whispering hints. If a tester can't figure out the controls without you, **that's the bug** — and you just found it for free. The instinct to defend your game ("well, *normally* people get it") is the enemy. Bite your tongue. Write it down.

> 🤖 **Co-pilot tip:** Set a literal rule before each session: *"I'm not allowed to speak until they say they're done or they physically rage-quit."* Give a crewmate permission to elbow you if you break it. It's that hard and that important.

> 🎨 **Jonah (Artificer):** Watch where testers' eyes go *before* they touch a key. If three of them don't even notice the player sprite or can't tell the enemy from the background, that's a *visual* clarity bug, not a control bug — and it's yours to fix. Confusion on screen is art feedback in disguise.

### What you're actually looking for: confused / bored / stuck

You're not collecting opinions ("I think it's cool!" — useless). You're collecting **moments**. Watch for three things and timestamp them:

| Signal | What it looks like | What it usually means |
|--------|-------------------|----------------------|
| 😕 **Confused** | "Wait, what do I do?" · clicking random keys · re-reading the screen | Your tutorial/onboarding is missing or unclear |
| 🥱 **Bored** | sighing · "is this it?" · playing on autopilot · checking their phone | Pacing problem — too slow, too repetitive, no payoff |
| 😤 **Stuck** | dying at the same spot 5x · "this is impossible" · trying to quit | Difficulty spike or a missing piece of feedback |

A great trick: ask them to **narrate out loud** ("think-aloud protocol"). "I'm pressing this because… ok that didn't work… maybe this?" Their narration is a live feed straight into their confused little brain. Gold.

### Bugs vs. "feel" — two different problems

When the notes come in, sort every problem into one of two buckets, because they get fixed in totally different ways:

- **🐛 Bug** = the game is *broken*. Player walks through a wall. Score doesn't update. Game crashes. These are *objectively wrong* — code is doing something it shouldn't. You fix these with debugging (hello, Quest 8).
- **🎨 Feel** = the game *works* but isn't *fun*. The jump is floaty. The enemy spawns feel unfair. There's no satisfying "pop" when you grab a coin. Nothing is broken — it just doesn't feel good. You fix these with **juice**.

Both matter. But don't confuse them: you can't "debug" boredom, and adding screenshake won't fix a player falling through the floor.

### Juice: the cheap magic that makes games feel good

"Juice" (or "game feel") is all the little feedback that makes an action feel *satisfying* even though it doesn't change the rules at all. Same game, but it *slaps*. The classics, cheapest first:

- **🔊 Sound** — a tiny "blip" on jump, a "ding" on coin, a "crunch" on hit. Sound is the single biggest bang-for-buck. Grab free sound effects (search **"jsfxr"** or **"sfxr"** — a free browser tool that generates retro game sounds in one click) and play them in Phaser: `this.sound.play('coin')` after loading them in `preload()`.
- **📳 Screenshake** — a tiny camera shake on impact: `this.cameras.main.shake(100, 0.01)` (duration ms, intensity). A *little* goes a long way. Too much = nausea.
- **✨ Feedback** — flash the player white on hit, scale a coin up before it vanishes, pop a "+10" number that floats and fades. A Phaser **tween** (`this.tweens.add({...})`) does most of this in a few lines.
- **📈 Difficulty curve** — the *shape* of the challenge over time. Good games ramp: easy enough to feel competent in 10 seconds, then a gentle climb. A flat-hard game feels unfair; a flat-easy game feels boring. This is the most important "feel" fix and the one your Boss Challenge attacks.

> ⚔️ **Zeppelin (Vanguard):** The difficulty curve and the *feel* of movement are your home turf — you're the athlete, you know when a jump lands a half-beat late or an enemy spawn is cheap. Own the tuning pass: enemy speed, spawn rate, jump weight. When a tester rage-quits at the same spot twice, that number is yours to fix until it feels fair.

> ⚠️ **Real Talk:** AI is *great* at suggesting polish ("add a hit-flash, a coin pickup sound, and a combo counter") and *terrible* at knowing what's actually fun for *your* game. Fun is felt, not computed. Use AI to generate options and prioritize the obvious stuff — but the crew plays it and the crew decides. If the screenshake makes your game feel worse, delete it. No model can overrule your own hands on the keyboard.

### Using AI as your triage officer

You'll walk out of playtests with a messy pile of notes. Dumping that pile on the crew leads to fixing whatever's loudest, not whatever matters. Instead, feed the raw notes to AI and make it do the boring sort: cluster duplicates, split bugs from feel, and rank by **impact × effort**. You stay the judge — but now you're judging a clean, ranked list instead of chaos.

---

## 🛠️ The Quest (do this now)

### Step 1 — Prep the playtest (10 min)
- Get your game running clean from `project/src/` in a fresh browser tab. No console open, no dev clutter.
- Recruit **2–4 testers outside the crew.** One at a time is better than a crowd.
- Assign roles: one person **drives the laptop to the tester and goes silent**; one person is the **scribe** with the feedback form (in your Loot below).

### Step 2 — Run the sessions (40 min)
For each tester, follow the script (Loot, below). The short version:
1. Say only: *"Play this. Think out loud as you go. I won't help you."*
2. Start a timer. **Stay silent.** Scribe writes timestamped notes: every 😕 / 🥱 / 😤 moment, exact quotes, where they got stuck.
3. When they finish or quit, *now* you can ask the 4 debrief questions (in the form).
4. Reset and run the next tester.

### Step 3 — Dump notes to AI for triage (15 min)
Paste your raw notes into claude.ai 🟡 with this prompt (full version in Loot):
```
You're a senior game producer doing playtest triage. Below are raw, messy notes
from 3 playtests of our Phaser 3 browser game. The game is: [one-line pitch].

Do this:
1. Cluster duplicate issues (if 3 people got stuck at the same spot, that's ONE issue, marked "x3").
2. Tag each issue as BUG (broken) or FEEL (works but not fun).
3. Rank them by impact × effort: a "Fix First" table (high impact, low effort),
   then "Worth It", then "Later/Skip".
4. For the top 3, suggest a concrete fix in Phaser terms.

Be ruthless about priority. I have limited time.

NOTES:
[paste everything]
```

### Step 4 — Fix the top issues (30 min)
- Take the **"Fix First"** list. As a crew, sanity-check it (AI ranks impact decently but doesn't *feel* your game — overrule it where your gut disagrees).
- Fix the top 2–3 issues. Bugs get debugged; feel issues get juiced. Split the work the way you've split it all along: Zeppelin tunes game feel and difficulty (`zeppelin/slower-enemy-ramp`), Jonah fixes the visual confusion testers flagged (`jonah/clearer-enemy-sprite`), Leo lands the sound and timing (`leo/coin-pickup-sfx`).
- Commit each fix on a branch with a clear message (your Quest 8 Git workflow). One fix = one commit.

### Step 5 — Add at least 2 pieces of juice (15 min)
Pick two from the juice menu and actually ship them:
- A **sound** on your core action (jump / grab / hit). Generate it at jsfxr, drop it in `project/src/`, load in `preload()`, play it.
- A **screenshake** or **hit-flash** on impact.
- A floating **"+10"** score popup via a tween.

Play it before and after. You'll feel the difference instantly. That feeling is the whole point of this quest.

---

## 🎮 Build-the-Game Tie-In

By the end you have:
1. A **more fun, more finished game** — top playtest issues fixed, at least 2 pieces of juice added, committed to your repo.
2. A **prioritized polish list** (the AI-triaged "Fix First / Worth It / Later" table) saved into `project/RESEARCH.md` or a new `project/POLISH.md`. The "Later" items become your post-launch to-do list — don't delete them.

Your game just crossed the line from "tech demo" to "thing people can actually enjoy." That's exactly the version you'll launch in Quest 15.

---

## 💀 Boss Challenge (optional, +50 XP)

**The Balance Pass.** Dust off the **AI-judge** you built in Quest 13 and point it at the *real, live game* — specifically its difficulty.

1. Capture your game's difficulty data: starting health, enemy speed, spawn rate, scoring, how long an average run lasts (use your playtest timings!).
2. Feed it to your AI-judge with a rubric: *"Score this difficulty curve 1–10 on: fair start, smooth ramp, satisfying climax, no unwinnable spikes. Flag any single number that's badly tuned and suggest a specific new value."*
3. **Cross-check the judge against your humans.** Where the AI says "enemy speed is too high" and your testers also rage-quit at speed — that's a confirmed fix. Where the judge and the humans *disagree*, the humans win (remember Quest 13: the judge is a tool, not the truth).
4. Tune the numbers, replay, repeat until the curve feels right.

You just used an AI auditor to balance a real game. That's a skill most hobby devs never learn.

---

## 🏆 Achievements

- [ ] 🤐 **Silent Observer** (+20 XP) — ran a full playtest without explaining or defending your game once.
- [ ] 🧃 **Juiced** (+20 XP) — added at least 2 pieces of juice and felt the game get better.
- [ ] ⚖️ **The Tuner** (+15 XP) — completed the Boss balance pass with the Quest 13 AI-judge.

---

## 🎒 Loot (keep this forever)

### 📋 The Playtest Script + Feedback Form
Reuse this for every game you ever make. Print it or copy it into a doc.

```
=== WOW-STUDIO PLAYTEST FORM ===
Game: ____________   Tester (first name only): ____   Date: ____
Tester's gaming experience: none / casual / hardcore

— FACILITATOR SAYS (and nothing else): —
"Play this. Think out loud as you go. I won't help you — if you're stuck,
 that's useful info for me, not a fail. Ready? Go."

— SCRIBE NOTES (timestamp everything) —
 [time] 😕 CONFUSED: ____________________________
 [time] 🥱 BORED:    ____________________________
 [time] 😤 STUCK:    ____________________________
 [time] 💬 QUOTE:    "__________________________"
 Did they figure out the controls unprompted?  Y / N  (how long? ___)
 Where did they quit / finish? ____________________

— DEBRIEF (only AFTER they stop playing) —
 1. In one sentence, what was this game about?
 2. What was the most fun moment? The most frustrating?
 3. Was anything confusing or unclear?
 4. Would you play it again? Why / why not?

— FACILITATOR RULE: do NOT explain, defend, or hint. Bite your tongue. —
```

### 🧃 The Juice Checklist
Tick what your game has. Empty boxes are easy wins:
```
SOUND
 [ ] Sound on core action (jump/grab/shoot)
 [ ] Sound on success (score/win/pickup)
 [ ] Sound on failure (hit/death/miss)
 [ ] Light background music or ambient loop
FEEDBACK
 [ ] Hit-flash or color change on impact
 [ ] Screenshake on big events (small! 100ms, 0.01)
 [ ] Floating "+score" / damage numbers (tween)
 [ ] Particle burst on pickup/explosion
 [ ] Button/UI reacts on hover & click
GAME FEEL
 [ ] Player movement feels responsive (no lag/float you didn't want)
 [ ] Difficulty ramps (easy start → gentle climb)
 [ ] A clear win OR lose state with a satisfying screen
 [ ] A reason to play "one more time"
```

### 🔧 The AI Triage Prompt
The full Step-3 prompt above — keep it; it turns any pile of feedback (not just games) into a ranked action list.

---

## ✅ Quest Complete

- [ ] You ran a real playtest with **outside testers** and stayed silent.
- [ ] You collected timestamped notes and ran the debrief questions.
- [ ] You used AI to triage notes into a **BUG/FEEL, impact-ranked** list.
- [ ] You fixed the top 2–3 issues and committed them.
- [ ] You added **at least 2 pieces of juice** and felt the difference.
- [ ] (Boss) You ran a balance pass with the Quest 13 AI-judge.
- [ ] You can explain the difference between a **bug** and a **feel** problem.
- [ ] **Log your XP in `../../CREW.md`** (100 base + boss + achievements).

---

## 🔭 Going Deeper / Side Quests

- **"Juice it or lose it"** — search this exact phrase for the famous talk/demo on game feel. It's the canonical 20 minutes on why juice matters. Watch it with the crew.
- **jsfxr / sfxr** — search "jsfxr" for the free browser tool that makes retro sound effects in one click. Make a whole sound pack in 10 minutes.
- **Phaser tweens & camera** — the official docs at **phaser.io** have examples for `tweens` and `camera.shake`. Steal them shamelessly.
- **Side quest:** Run the *same* playtest on a phone. Touch controls reveal a totally different set of problems — and mobile matters for launch day.

---

## ➡️ Next

The game is fun and finished. Now make it **real** — push it to a public URL, write the marketing in your own voice with AI, and let the world press play.

**→ [Quest 15 — Launch Day](quest-15-launch-day.md)**
