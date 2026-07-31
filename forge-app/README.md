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
across the crew from any device**, wire up Turso 👇

---

## 🌐 Turn on shared progress (Turso — free)

Turso gives you a free hosted SQLite database (5 GB, no card). The server talks to it
over plain HTTP with a secret token, so the browser never touches your database.

1. Install the CLI and sign up: **[docs.turso.tech](https://docs.turso.tech)**.
2. Create the database and a token:
   ```
   turso db create the-forge
   turso db show the-forge --url      # -> TURSO_DATABASE_URL
   turso db tokens create the-forge   # -> TURSO_AUTH_TOKEN
   ```
3. Put both in `.env`:
   ```
   TURSO_DATABASE_URL=libsql://the-forge-YOURNAME.turso.io
   TURSO_AUTH_TOKEN=your-token
   ```
4. Restart: `node server.js`. It prints `Storage: Turso (shared, cross-device)`.

There's no schema step — the server runs `create table if not exists` on boot. (The
SQL is in **`turso-schema.sql`** if you'd rather see it or run it by hand.)

Now everyone's XP lives in one place. Deploy the server to a free host (Render /
Railway / Glitch) and the whole crew can use it from their phones on the same link.

> 🔐 **Why the token is safe here:** it stays on the *server*, in `.env` (gitignored).
> The browser only ever talks to your own server, never to the database.

### Already on Supabase?

It still works — leave `TURSO_*` blank and the Supabase settings take over. You'll
want to run the updated **`supabase-schema.sql`** first, which adds the `forge_sprites`
table (see *Storage* below for why). Turso is the better fit now mainly because of
the free-tier headroom: 5 GB vs 500 MB, and Supabase pauses free projects after 7
days of inactivity, which a play-in-bursts game trips over regularly.

### Moving your data from Supabase to Turso

Setting the `TURSO_*` vars does **not** bring your data with it — a fresh Turso
database is empty, so the crew's XP and every mob they built would look wiped. Copy
it across first with the included one-shot script:

```bash
cd forge-app
# put BOTH sets of credentials in .env (SUPABASE_* and TURSO_*), then:
node migrate-supabase-to-turso.js --dry-run   # show what would move
node migrate-supabase-to-turso.js             # actually move it
```

It copies crew progress, the mob/projectile/terrain config and every sprite record,
then verifies by reading it all back — row counts, total XP, and that every sprite the
config points at really exists. If your Supabase copy still has art inline (from
before the sprite split), the script extracts it on the way through, so you land in
the new shape either way.

It only ever **reads** from Supabase, so your old data stays intact as a rollback.
Re-running is safe (every write is an upsert), and it refuses to overwrite a Turso
database that already holds progress unless you pass `--overwrite`.

Then set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` on your host and redeploy. Leave
the `SUPABASE_*` vars in place — Turso takes priority, so they cost nothing and give
you a one-line rollback. Confirm with `/api/admin/health?code=...` → `"storage":"turso"`.

---

## 🧮 AI grading: making a free key last

Free Gemini quota is counted **per Google Cloud project, not per key** — so a crew
sharing one key shares one daily allowance. The default model is
`gemini-2.5-flash-lite` because it has by far the biggest free daily allowance
(~1,000 requests/day vs ~250 for Flash) and grades short rubric answers fine.

The app avoids the ways this budget normally leaks:

- **Identical re-submissions cost nothing.** Re-submitting the same words replays the
  saved grade instead of calling the API. Kids re-read and re-submit constantly; this
  is the single biggest saving.
- **A short cooldown between graded attempts** (`FORGE_GRADE_COOLDOWN_MS`, default
  8s) stops a frustrated re-submit spree from draining a day's quota in a minute.
- **A key test costs exactly one request** against one model, with a 1-token cap. It
  used to walk the whole fallback chain and spend four.
- **Retired models are dropped, then remembered.** A model the API rejects is skipped
  for the rest of the process instead of costing a wasted round-trip on every grade.
- **Grading output is capped** at 400 tokens — enough for the judge's small JSON,
  not enough for one bad generation to eat the shared per-minute token budget.

> ⚠️ **Keep retired models out of `FORGE_MODELS`.** Google retires models on a
> schedule (`gemini-2.0-flash` and `-flash-lite` shut down 2026-06-01;
> `gemini-2.5-flash` retires 2026-10-16). A dead name in the chain isn't harmless —
> it costs a wasted round-trip on *every* grade before reaching a model that answers.

`GET /api/admin/health?code=...` reports `apiUsage`, including `cachedGrades` and
`cooldownBlocked` (calls saved) and `serverKey` vs `ownKey` — if `serverKey` keeps
climbing, the crew are sharing your quota instead of using their own. Full setup and
troubleshooting: **`GEMINI_SETUP.md`**.

### Routing grading through a gateway instead

If you already run an LLM gateway (OmniRoute, LiteLLM, OpenRouter…), you can point the
whole crew at it and skip per-player keys entirely. Three variables:

```
GEMINI_API_BASE=https://your-gateway/v1
GEMINI_API_STYLE=openai      # or "google" — see below
FORGE_BYOK=0
GEMINI_API_KEY=your-gateway-key
FORGE_MODELS=...             # whatever names YOUR gateway accepts
```

`GEMINI_API_STYLE` picks the dialect, because the two disagree about more than the URL:

| | `google` (default) | `openai` |
|---|---|---|
| path | `{base}/v1beta/models/{model}:generateContent` | `{base}/chat/completions` |
| auth | `?key=` query param | `Authorization: Bearer` |
| body | `contents[].parts[]` | `messages[]` |
| answer | `candidates[0].content.parts[0].text` | `choices[0].message.content` |

Most routers speak `openai`. Check yours before setting it — a mismatch shows up as
every grade falling back to the offline grader.

**`FORGE_BYOK=0` is not optional here.** A gateway won't accept a player's personal
Google key, so leaving the 🔑 panel visible only gives them a way to break their own
grading. With BYOK off the panel is hidden, the client stops sending player keys, and
`GEMINI_API_KEY` grades everyone. The tradeoff is that you're now paying for it — four
players on one allowance rather than four allowances. Everything in the section above
(grade caching, cooldown, token caps) is what keeps that affordable.

One feature doesn't survive the trip: **admin sprite generation is Google-shaped only**.
Under `GEMINI_API_STYLE=openai` the generate button returns a plain message saying so,
and Import still works for adding art. `FORGE_MODEL` also stops matching what you set,
so set `FORGE_MODELS` to the gateway's own model names — they're usually prefixed
(`gemini/gemini-2.5-flash-lite`). `/api/admin/health` echoes back `apiStyle`, `apiBase`
and `byok` so you can confirm what the server actually thinks it's doing.

---

## 💾 Storage: why sprite art lives outside the database

Generated mob art used to be stored as a base64 `data:` URL *inside* the mob-config
row. That's the quickest thing that works, and it scales badly in three ways at once:

- Every mob save rewrote the whole config, so the database stored a fresh copy of
  **all** the art each time.
- Every page load re-downloaded the whole blob, because the browser can't cache art
  that arrives inside a JSON response.
- base64 costs ~33% more bytes than the raw PNG.

Thirty sprites at the 320 KB cap is a ~10 MB blob moving on every single page load —
enough to burn a 5 GB monthly egress allowance in a few hundred visits.

So now each sprite is written **once** to its own record, keyed by a hash of its
contents, and served as a real PNG from `/api/sprites/<hash>.png` with a one-year
`immutable` cache header. The config row holds only a short `spriteId`. That means:

- the browser downloads each sprite once, ever;
- re-saving a mob never re-uploads its art;
- two mobs sharing the same art cost one copy;
- deleting a mob garbage-collects art nothing points at any more.

**Migration is automatic.** The first time the server reads an old config it moves any
inline art into sprite records, rewrites the config once, and logs
`🖼 Migrated N inline sprite(s)`. Nothing to run by hand.

`GET /api/admin/health?code=...` reports `configBytes` and `sprites` so you can see
the config stays small.

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
  and saves everyone's progress to the shared store (Turso if configured, else
  Supabase, else a local file).
- **`public/`** — the frontend (`index.html`, `styles.css`, `app.js`).
- **`public/terrain.js`** — the battlefield itself: each level's obstacles, water,
  towers and elevation, plus the collision / line-of-sight / height queries the
  battle engine asks it. Layouts are **generated from a few knobs + a seed**, so the
  same level always builds the same map and God Mode can retune it without a map editor.

### Why a server (not just a web page)?
Your two choices required it: **AI grading** needs the API key kept secret (so it lives
on the server, never in the browser), and **shared progress** needs one central store.

---

## 🏔 The battlefield ladder

Battles don't all happen in the same green box — the arena upgrades as the level
climbs, and the features **stack**:

| Level | Environment | What it changes about the fight |
|-------|-------------|---------------------------------|
| 1 | Plain field | the tutorial arena — nothing in your way |
| 2 | Solid cover | boulders and crates block movement, projectiles **and** line of sight, so shooters have to reposition |
| 3 | + Water | pools slow heroes and melee mobs to ~45%; shots fly straight over, ranged mobs refuse to wade |
| 4 | + Shooting towers | enemy turrets lock on, telegraph the shot, and fire. Optional to kill — destroying one always drops gear |
| 5 | 3D MOBA map | the view tilts and gains real elevation: 3 lanes, a river, jungle bush you vanish inside, and high-ground bases reached by ramps (high ground = longer reach) |

Levels 6–16 run the level-5 map at higher difficulty.

**Tuning it:** God Mode → **🏔 Terrain**. Every level's knobs — obstacle counts, pools,
tower HP / range / reload, water slow, layout seed, and which layout to use — are
editable and saved server-side, with a **⚔ test fight** button to feel the change
immediately. "Reset to built-in" puts a level back the way it shipped.

## 🎮 What works right now

- Profile picker for **Zeppelin, Leo, Jonah, Jyana** (+ their classes)
- All **16 Quests** as gradeable steps with real prompts + hidden rubrics
- **AI grader**: score /100, pass/fail, specific feedback + a "level it up" tip
- **XP + ranks** (Noob → Forgemaster) with a live XP bar
- **Shared crew leaderboard** (polls every ~12s so crewmates' progress shows up)
- Resubmit to beat your score; reset button for testing
- **Battles** with a per-level battlefield (cover → water → towers → a 3D MOBA map)

## 🚀 Deploy it (free, so the crew plays from their phones)

The app is a Node server, so it needs a Node host (not plain static hosting).
**Render** has a free tier and reads the `render.yaml` in this repo:

1. Push this repo to GitHub (done).
2. Go to **[render.com](https://render.com)** → New → **Blueprint** → connect the repo
   (or use the one-click link in `render.yaml`). It finds `render.yaml` automatically.
3. In the new service's **Environment**, paste your secrets:
   `GEMINI_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
4. Deploy → you get a public URL like `https://the-forge.onrender.com`. Share it.

> ⚠️ **Use a hosted database when deployed.** Render's free filesystem is wiped on
> restart, so the local-file store won't persist there — Turso (or Supabase) will.
> (Also, free Render services sleep after inactivity and take ~30s to wake on the
> first hit.) Railway / Glitch / Fly work too; any Node host is fine.

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
