# 🔥 THE FORGE — RPG App

A browser **RPG** version of the campaign. Pick your hero, travel the quest map,
and clear "trials" by typing responses — an **AI judge** scores each one, awards XP,
and levels you up. Progress is **shared** across the crew (live guild leaderboard).

**Game feel:** hero-select screen, a 7-region world map with locked/unlocked quest
nodes, XP bars, rank-ups (Noob → Forgemaster) with a level-up sequence, loot bursts,
and procedural retro sound — all hand-built in HTML/CSS/JS (no engine, no art assets,
deploys anywhere).

### The RPG loop
```
Choose hero → World map → tap an unlocked quest node → read the trial →
type your response → AI judge scores it → win XP + loot → level up → next node unlocks
```

Heroes = the crew and their classes: ⚔️ Zeppelin (Vanguard) · 🎵 Leo (Bard) ·
🎨 Jonah (Artificer) · 🔋 Jyana (Engine).

---

## ▶️ Run it (30 seconds, zero dependencies)

You need **Node 18+** (`node --version`). No `npm install` required.

```bash
cd forge-app
cp .env.example .env      # then paste your free Gemini key into .env  (optional)
node server.js
```

Open **http://localhost:3000** → pick a crew member → start a Quest.

> **No API key?** It still runs — it falls back to an offline "mock" grader so you can
> click through everything. Add a free [Gemini key](https://aistudio.google.com) to
> `.env` for real AI grading + feedback.

By default progress saves to a local file (fine for one machine). To make it **shared
across the crew from any device**, wire up Supabase 👇

---

## 🌐 Turn on shared progress (Supabase — free)

Supabase gives you a free hosted database. The server talks to it with the secret
**service-role key**, so the browser never touches your database directly.

1. Make a free project at **[supabase.com](https://supabase.com)** (no card).
2. **SQL Editor → New query** → paste the contents of **`supabase-schema.sql`** → **Run**.
   (Creates the `forge_progress` table + the 4 crew rows.)
3. **Project Settings → API** → copy your **Project URL** and the **`service_role`** key
   (⚠️ the secret one, *not* `anon`).
4. Put them in `.env`:
   ```
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```
5. Restart: `node server.js`. It prints `Storage: Supabase (shared, cross-device)`.

Now everyone's XP lives in one place. Deploy the server to a free host (Render /
Railway / Glitch) and the whole crew can use it from their phones on the same link.

> 🔐 **Why the service-role key is safe here:** it stays on the *server*, in `.env`
> (gitignored). The table has Row Level Security on with no public policies, so the
> database can't be read with the public key — only through your server.

---

## 🧠 How it works

```
Browser (public/)  ──►  Node server (server.js)  ──►  Gemini API (AI judge)
   picks profile          holds the secret key           scores the response
   types response         grades vs hidden rubric
   sees XP + board        stores shared progress ──► data/progress.json
```

- **`data/quests.js`** — the campaign: Acts → Quests → Steps. Each step has a `prompt`
  (shown) and a hidden `rubric` (used to grade). **Edit this to change content.**
- **`server.js`** — serves the app, keeps the API key server-side, grades responses,
  and saves everyone's progress to the shared store (Supabase if configured, else a
  local file).
- **`public/`** — the frontend (`index.html`, `styles.css`, `app.js`).

### Why a server (not just a web page)?
Your two choices required it: **AI grading** needs the API key kept secret (so it lives
on the server, never in the browser), and **shared progress** needs one central store.

---

## 🎮 What works right now

- Profile picker for **Zeppelin, Leo, Jonah, Jyana** (+ their classes)
- All **16 Quests** as gradeable steps with real prompts + hidden rubrics
- **AI grader**: score /100, pass/fail, specific feedback + a "level it up" tip
- **XP + ranks** (Noob → Forgemaster) with a live XP bar
- **Shared crew leaderboard** (polls every ~12s so crewmates' progress shows up)
- Resubmit to beat your score; reset button for testing

## 🚀 Deploy it (free, so the crew plays from their phones)

The app is a Node server, so it needs a Node host (not plain static hosting).
**Render** has a free tier and reads the `render.yaml` in this repo:

1. Push this repo to GitHub (done).
2. Go to **[render.com](https://render.com)** → New → **Blueprint** → connect the repo
   (or use the one-click link in `render.yaml`). It finds `render.yaml` automatically.
3. In the new service's **Environment**, paste your secrets:
   `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
4. Deploy → you get a public URL like `https://the-forge.onrender.com`. Share it.

> ⚠️ **Use Supabase when deployed.** Render's free filesystem is wiped on restart, so
> the local-file store won't persist there — the Supabase store will. (Also, free
> Render services sleep after inactivity and take ~30s to wake on the first hit.)
> Railway / Glitch / Fly work too; any Node host is fine.

## 🔜 Easy next steps
- Boss challenges (+50 XP), achievement badges, streaks, daily quests.
- Real hero art / animated sprites; a proper winding map path.
- Login per hero (progress is trust-based right now).
- Pull each quest's full multi-step content from its markdown into `quests.js`.
- Auth so each kid logs in as themselves (right now the profile is trust-based).
- Pull the full step-by-step content from each Quest's markdown into `quests.js`.

## ⚠️ Notes
- `data/progress.json` and `.env` are gitignored (progress is runtime data; the key is
  secret). The mock grader means the app is demoable with neither.
- Grading is AI — it's encouraging and effort-based, not a strict exam. Tune the rubrics
  in `quests.js` and the judge prompt in `server.js` to taste.
