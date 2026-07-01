# 🔥 THE FORGE — Interactive App (prototype)

An interactive, **AI-graded** version of the campaign. Each crew member picks their
profile, works through the 16 Quests, types a response at each step, and an AI judge
scores it and awards XP. Progress is **shared** — everyone sees the crew leaderboard.

> This is a working prototype / wireframe: full interaction end-to-end, intentionally
> light on visual polish so you can layer UI on top. Nothing here is locked in.

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

## 🔜 Easy next steps (when you add UI / features)
- **Deploy** the Node app to a free host (Render/Railway/Glitch) so the crew uses it
  from their phones — with Supabase already wired, progress is shared automatically.
- Boss challenges (+50 XP), achievement badges, streaks, sound.
- Auth so each kid logs in as themselves (right now the profile is trust-based).
- Pull the full step-by-step content from each Quest's markdown into `quests.js`.

## ⚠️ Notes
- `data/progress.json` and `.env` are gitignored (progress is runtime data; the key is
  secret). The mock grader means the app is demoable with neither.
- Grading is AI — it's encouraging and effort-based, not a strict exam. Tune the rubrics
  in `quests.js` and the judge prompt in `server.js` to taste.
