# Quest 15 — Launch Day
> Act 6 · Ship It (Polish · Launch · Showcase) • ~120 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Put your game on a real, public, clickable URL — for free — then write store copy, social posts, and a trailer plan with AI in your studio's voice, and ship the link to the world.

**🎒 Loadout:**
- Your polished game in `project/src/` (post-Quest-14)
- Git + GitHub 🟢 (your repo `For-the-boys`)
- A free **itch.io** account 🟢 (optional second host)
- claude.ai 🟡 or Google AI Studio 🟡 (for the marketing copy)
- A phone (to test mobile + share the link)
- `project/GAME.md` (for your pitch + theme)

**⭐ XP on the line:** 100 base (+50 boss).

> 🚀 **Crew finale — all four classes, one launch:** Jonah drives the *visual*
> launch (logo, screenshots, the itch.io page art). Leo runs the *hype* (the trailer
> plan and the launch post — your showman moment). Zeppelin ships the *deploy* and
> tests it works on every device. Jyana drives *launch day itself* — pre-flight
> checklist in hand, he keeps the crew moving box-by-box and won't let "eh, we'll ship
> tomorrow" win. This is everything you've built, going live.

> 🔋 **Jyana (Engine):** "Tomorrow" is where launches go to die, and killing that
> excuse is your job today. You don't plan the launch — the checklist below already
> does — you *run* it. Take the pre-flight list, put your foot down, and drag the crew
> through every box until the link is live. A finished game nobody ships is just a
> folder. You're the reason it actually goes out the door.

---

## 🤔 Why this Quest matters

A game on your laptop is a hobby. A game at a URL anyone on Earth can click is a **product you shipped.** That gap is psychological more than technical — and crossing it is the single most valuable thing in this whole campaign. Most people who "want to make a game" never put one online. Ever. By the end of this quest you'll have done the thing they only talk about: a live link you can text to anyone. That link is proof. Guard it; it's the whole point.

---

## 🧠 The Briefing

### Why your game can be hosted for free (the easy truth)

Your game is **plain HTML, JavaScript, and Phaser loaded from a CDN.** There's no server, no database, no backend to run. That makes it a **static site** — just files a browser downloads and runs. Static sites are the *easiest, cheapest* thing on the internet to host, which is why two excellent free options will run your game forever at $0:

- **GitHub Pages** 🟢 — turns a folder in your GitHub repo into a public website. You already have the repo. This is the most "developer" way and gives you a real URL.
- **itch.io** 🟢 — the home of indie games. You zip your game, upload it, and get a polished game page with a play button. This is the most "gamer" way and comes with a built-in audience.

Do **one or both.** Both are free, neither needs a credit card.

### Deploying to GitHub Pages (step-by-step)

GitHub Pages serves a website straight from your repo. Here's the current shape of it — GitHub tweaks the exact button labels over time, so **follow the on-screen flow**; the order below is stable.

1. **Make sure your game files are pushed to GitHub.** Your playable game lives in `project/src/`. The entry file must be named **`index.html`** (Pages serves `index.html` automatically). Commit and push so it's on GitHub.
2. On GitHub, open your repo → **Settings** (top tab) → **Pages** (left sidebar).
3. Under **"Build and deployment"**, set **Source** to **"Deploy from a branch."**
4. Pick your **branch** (usually `main`) and the **folder**. The folder dropdown offers `/ (root)` or `/docs`.
   - If your `index.html` is at the repo root, choose `/ (root)`.
   - Pages can only serve from root or `/docs` — it can't point straight at `project/src/`. So pick one:
     - **Easiest:** put a copy of your game files in a `/docs` folder at the repo root and select `/docs`, **or**
     - make a separate branch (e.g. `gh-pages`) whose root *is* your game.
5. Click **Save.** Wait ~1 minute. Refresh the Pages settings — a green banner appears: **"Your site is live at `https://<your-username>.github.io/For-the-boys/`."** That's your public URL. Click it. 🎉

> 🤖 **Co-pilot tip:** Confused by the root/docs/branch choice? Paste your repo's file layout into AI: *"My Phaser game's index.html is at project/src/. I want GitHub Pages to serve it. Give me the simplest folder setup and the exact git commands."* It'll spit out the copy-paste fix for your exact structure.

### Deploying to itch.io (step-by-step)

1. **Zip your game folder** — select the files in `project/src/` (the `index.html` *must* be at the top level of the zip, not inside a nested folder) and compress them into a single `.zip`.
2. Make a free account at **itch.io** → **Upload new project** (or your dashboard → "Create new project").
3. Set **Kind of project** to **"HTML."** This unlocks the in-browser play option.
4. **Upload your `.zip`**, then tick **"This file will be played in the browser."**
5. Set the viewport/embed size to match your Phaser game's canvas (e.g. 800×600 — check your `config` in `index.html`).
6. Fill in title, description, cover image, tags. Set visibility to **Public** (or "Restricted" while you test). **Save & view page.** You now have an itch.io game page with a Play button.

> ⚠️ **Real Talk:** Two classic launch-day faceplants. **(1) Secrets.** Your repo is *public* now — anyone can read every file. If an API key, token, or `.env` ever got committed, it is exposed to the entire internet the moment Pages goes live. Run the Quest 11 secret check *before* you flip the switch (your game itself shouldn't have any keys, but check the whole repo). **(2) Broken paths.** Local files often work with `file://` but break on a real server because of case-sensitivity (`Player.png` ≠ `player.png` on Linux servers) or wrong relative paths. Always test the *live URL*, not localhost — that's the only test that counts.

### Marketing with AI — in YOUR voice

You built it; now make people care. AI is a fantastic copywriter *if you brief it well.* The trap: let it write, and you get generic AI mush — "Embark on an unforgettable journey!" Nobody believes that. The fix is to feed it **your** voice and **your** truth, then make it punchy.

You need four things, all AI-assisted, all in the crew's voice:
1. **A punchy game description** — 2–3 sentences. The hook, not the feature list.
2. **An itch.io / store page** — description, "how to play," controls, credits.
3. **Social posts** — 3 short, scroll-stopping posts for whatever platform your crew lives on.
4. **A trailer plan/script** — a 30-second shot list even if you film it on a phone. Hook in the first 3 seconds, gameplay, a punchy end card with the URL.

The key prompt move: **give AI your real details and your vibe, then tell it to match your voice, not invent one.** Examples and a full prompt pack are in your Loot.

> 🎨 **Jonah (Artificer):** The cover image, the screenshots, and the itch.io page art are the first thing anyone sees — they decide whether a stranger clicks play. That's your call. Pick the frames that show the game at its best (mid-action, not the title screen), and make the page *look* like the game feels.

> 🎵 **Leo (Bard):** The trailer and the launch post are your stage. You wrote the hook into the music; now write it into the copy. Read the social posts out loud — if it doesn't sound like something you'd actually say, cut it. The 30-second trailer is a performance, and performance is your craft.

### The pre-launch checklist (run it before you share)

Don't text the link, *then* find the bug. Five-minute checklist before you go loud:
- ✅ **Works on mobile?** Open the live URL on a phone. Does it load? Can you play it? (Even if controls are rough, it shouldn't be a blank screen.)
- ✅ **No broken links / missing assets?** Open the live site, hit F12 → Console. Red 404 errors = a missing image/sound. Fix the paths.
- ✅ **Secrets clean?** No keys, tokens, or `.env` in the public repo (Quest 11 scan).
- ✅ **Credits present?** Sound effects, fonts, art — even free ones often want a credit line. List your crew. Give yourselves the studio name.
- ✅ **First-time clarity.** A stranger lands cold — do they know how to start and what the controls are? (Your Quest 14 playtests told you.)

---

## 🛠️ The Quest (do this now)

### Step 1 — Pre-flight checklist (10 min)
Run the full checklist above on your repo and game. Fix anything red **before** you deploy. Especially: secrets scan + an `index.html` that actually runs.

### Step 2 — Deploy to a public URL (40 min)
Do **GitHub Pages**, itch.io, or both. Follow the steps in the Briefing.
- Get the live URL.
- **Open it on a different device** (a phone, a friend's laptop) to prove it's truly public — not just cached on your machine.
- It works? You just shipped a game. Pause and feel that.

### Step 3 — Write the marketing with AI (35 min)
Open claude.ai 🟡 and run the **Marketing Copy Prompt Pack** (Loot, below). Generate:
- the punchy description,
- the store/page copy,
- 3 social posts,
- the 30-second trailer script.

**Then edit it.** Read every line out loud as a crew. Cut anything that sounds like a robot wrote it. Inject your inside jokes, your real story ("we built this in 6 weeks with AI and zero budget"). AI drafts; the crew has the final voice.

### Step 4 — Write `project/LAUNCH.md` (15 min)
Create `project/LAUNCH.md` with:
- 🔗 The **live URL(s)** (GitHub Pages and/or itch.io)
- 🎮 The final punchy description
- 📱 Your 3 social posts (ready to paste)
- 🎬 The trailer script
- 🏷️ Credits (crew names, studio name, asset credits)

This file is your launch kit. It lives in the repo forever.

### Step 5 — Ship the link (10 min)
Post it. For real. Group chat, story, the family WhatsApp, wherever. Send the live URL to at least a few humans with one of your social posts. **The game is now real.** There's no undo on having shipped.

---

## 🎮 Build-the-Game Tie-In

By the end you have:
1. A **LIVE, public, playable game** at a real URL anyone can click — free hosting, $0 forever.
2. **`project/LAUNCH.md`** committed to your repo: the link, the description, social posts, trailer script, and credits.

Your studio went from "we're building a game" to "play our game, here's the link." That's a shippable portfolio piece for every single person in the crew.

---

## 💀 Boss Challenge (optional, +50 XP)

**First Contact: 10 real players.** Getting a link live is step one; getting *humans to press play* is the actual game. Your mission: **10 real people play your live game and you collect their reactions.**

1. Send the live URL + a social post to 10+ people outside the crew.
2. Make reacting frictionless — ask one tiny question: *"30 seconds: what's your high score, and one word for how it felt?"*
3. Collect every reply in `project/LAUNCH.md` under a **"First 10 Reactions"** section.
4. Notice the pattern: do strangers "get it" without you? Where do they bounce? This is raw material for your Quest 16 showcase numbers — and your post-launch patch list.

10 strangers playing a thing you built and *telling you what they felt* — that's a milestone most developers remember forever.

---

## 🏆 Achievements

- [ ] 🚀 **Liftoff** (+25 XP) — your game is live at a public URL and loads on a device that isn't yours.
- [ ] ✍️ **Voice of the Studio** (+15 XP) — wrote marketing copy with AI and edited it into your *own* voice.
- [ ] 👋 **First Contact** (+20 XP) — got 10 real people to play and collected their reactions (Boss).

---

## 🎒 Loot (keep this forever)

### 🚀 The Launch Checklist
```
=== PRE-LAUNCH CHECKLIST ===
CODE
 [ ] Entry file is named index.html and runs from a clean browser tab
 [ ] No console errors (F12 → Console) on the LIVE url
 [ ] Asset paths use correct case (Player.png ≠ player.png on servers)
SECURITY
 [ ] Secret scan clean — no keys/tokens/.env in the public repo (Quest 11)
 [ ] .gitignore still ignoring .env and secrets
HOSTING
 [ ] Deployed to GitHub Pages and/or itch.io
 [ ] Live URL opens on a DIFFERENT device (phone / friend's laptop)
 [ ] Works (or at least loads) on mobile
POLISH
 [ ] A stranger can tell how to start + the controls, cold
 [ ] Credits present: crew names, studio name, asset/sound/font credits
 [ ] Clear win/lose state
SHARE
 [ ] project/LAUNCH.md written (URL + copy + credits)
 [ ] Link actually posted/sent to real humans
```

### 📣 The Marketing-Copy Prompt Pack
Run these in order in one chat so AI keeps your context. Swap the `[BRACKETS]`.

**1) Brief it (do this first):**
```
You're a copywriter for a scrappy indie game studio. I'll give you the facts and
the vibe; you write copy that sounds like US, not like generic marketing AI.

GAME: [title]
PITCH: [one line — what it is]
HOOK: [the one thing that makes it fun/replayable]
CONTROLS: [e.g. arrow keys + space]
MADE BY: [crew names — e.g. Jonah, Leo, Zeppelin & Jyana], childhood friends who built
         this in [X weeks] with AI + $0.
VOICE: [pick: dry & funny / hype & loud / chill & confident / chaotic gremlin]
PLAY IT: [your live URL]

Confirm you've got it, then wait for my asks. Keep everything punchy. No clichés
like "embark on a journey" or "unforgettable experience." Short words win.
```

**2) The punchy description:**
```
Write 3 versions of a 2-3 sentence game description. Lead with the hook, not a
feature list. Each under 40 words. Make me want to click play right now.
```

**3) The itch.io / store page:**
```
Write the full game page: a short tagline, a 2-paragraph description, a "How to
Play" section with controls, and a credits block. Keep our voice.
```

**4) Social posts:**
```
Write 3 social posts for [platform]. Each scroll-stopping, under 280 chars,
ends with the link. Vary the angle: one funny, one "we built this!", one a
challenge ("beat my high score"). No hashtag spam — 1-2 good ones max.
```

**5) The 30-second trailer script:**
```
Write a 30-second trailer shot list we can film on a phone / screen-record.
Format: [seconds] | [what's on screen] | [text overlay] | [sound].
Hook in the first 3 seconds. End on a card with the title + URL.
```
> 🤖 **Co-pilot tip:** After every output, push back once: *"Make it 30% shorter and punchier, and cut anything that sounds like AI wrote it."* One refinement turn is the difference between mush and gold.

---

## ✅ Quest Complete

- [ ] You ran the pre-launch checklist and fixed anything red.
- [ ] Your game is **LIVE at a public URL** (GitHub Pages and/or itch.io).
- [ ] You verified it on a device that isn't yours.
- [ ] You wrote marketing copy with AI and **edited it into your voice**.
- [ ] You created `project/LAUNCH.md` with the link, copy, and credits.
- [ ] You **shipped the link** to real people.
- [ ] (Boss) 10 real players played it and you logged their reactions.
- [ ] **Log your XP in `../../CREW.md`** (100 base + boss + achievements).

---

## 🔭 Going Deeper / Side Quests

- **GitHub Pages docs** — search "GitHub Pages quickstart" for the official walkthrough. It's short and current; trust it over any tutorial.
- **itch.io HTML5 upload** — search "itch.io HTML5 game upload" for itch's own guide on the zip/embed settings.
- **Custom domain (optional):** both GitHub Pages and itch.io support a custom domain if your crew owns one — not required, but a nice flex for the showcase.
- **Side quest:** Actually *record* the trailer from your script. A 30-second screen capture with a couple of text overlays is enough — and it makes Quest 16's showcase hit way harder.

---

## ➡️ Next

The game is live and the world can play it. Time for the finale — present what you built, run a retrospective, tally your final ranks, and plan what your studio does *next*.

**→ [Quest 16 — Boss: The Showcase](quest-16-boss-showcase.md)**
