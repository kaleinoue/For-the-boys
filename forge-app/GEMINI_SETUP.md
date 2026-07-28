# 🔑 Adding your GEMINI_API_KEY (step by step)

The app grades players' answers with Google's **Gemini** AI. That needs one free
API key, stored **on the server** (never in the browser). Without it, the app still
runs but uses a basic "offline" grader instead of real AI feedback.

The server key is a **fallback for the whole app**. For a crew of four, you want
**one key per kid** — read the next section for why that matters a lot.

---

## ⚡ Read this first: why a free key "runs out instantly"

Free-tier quota is counted **per Google Cloud project**, *not per API key*. Two keys
made in the same project share one allowance. So if the whole crew plays on the
server key — or everyone made their key in the same default project — four kids are
drawing down **one** daily budget, and it empties roughly four times faster.

Current free-tier allowances (they get cut periodically, so check the link below):

| Model | Requests/min | **Requests/day** |
|---|---|---|
| `gemini-2.5-flash-lite` ← the app's default | 15 | **~1,000** |
| `gemini-2.5-flash` | 10 | ~250 |
| `gemini-2.5-flash-image` (sprite art) | 10 | ~500 |

**What to do:**

1. **Give each kid their own key in their own project.** In AI Studio, use
   *Create API key → **Create key in new project***. Four separate projects = four
   separate daily allowances. Each kid pastes theirs into the app via the **🔑**
   button; it stays in their browser and is used for their own grading.
2. **Leave the server key set as a backup**, but expect it to be the shared one that
   runs dry first.
3. **Check where the quota is going.** The health URL below reports `apiUsage`. If
   `serverKey` keeps climbing while `ownKey` stays near zero, the crew haven't added
   their own keys yet — that's your problem right there.

Current limits: <https://ai.google.dev/gemini-api/docs/rate-limits>

> The app already avoids the obvious waste: identical re-submissions replay the saved
> grade without calling the API, there's a short cooldown between graded attempts, and
> a key test costs exactly one request. See the README section "AI grading".

---

## Part 1 — Get a free Gemini API key (2 min, no credit card)

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with a Google account.
3. Click **"Create API key"**. If you're making keys for more than one person, pick
   **"Create key in new project"** each time — see the quota note above.
4. A key appears that starts with **`AIza...`**. Click the **copy icon** to copy it.
   - ⚠️ Copy with the button, not by highlighting — highlighting can grab a stray
     space and break it.
   - 🔒 Treat it like a password. Don't post it in chat, screenshots, or commits.
5. It's **free tier** — you do **not** need to "Set up billing." Ignore that.

---

## Part 2 — Add it to the LIVE app (Render)

This is the one that matters for the deployed game your crew plays.

1. Go to **https://dashboard.render.com** and open the **`the-forge`** web service.
2. In the left menu, click **Environment**.
3. Under **Environment Variables**, look for **`GEMINI_API_KEY`**:
   - If it exists: click **Edit**, clear the value, **paste** your key.
   - If it's missing: click **+ Add Environment Variable** →
     Key = `GEMINI_API_KEY`, Value = your `AIza...` key.
4. Click **Save Changes**. Render automatically **redeploys** (takes ~1–2 min).
   Wait until the service says **"Live"** again.

> ⚠️ Put it under **Environment Variables**, NOT "Secret Files". And make sure it's
> on the **service** itself (or an Environment Group that's **linked** to the
> service) — an unlinked group won't reach the app.

### Check it worked
In your browser, open (replace `YOURCODE` with your Game Master passcode):

```
https://the-forge-yy5i.onrender.com/api/admin/health?code=YOURCODE
```

- `"gemini":{"keyPresent":true,"ok":true}` → 🎉 real AI grading is on.
- `"keyPresent":false` → the key isn't reaching the app (see the ⚠️ note above).
- `"ok":false,"status":429` → the key works but is capped right now. `"limit":"perDay"`
  resets at midnight Pacific; `"perMinute"` clears in about a minute.
- `"status":400 / API_KEY_INVALID` → the pasted value is wrong; re-copy it.
- `"apiUsage"` → where the quota went since the app last restarted:
  - `grade` — real grading calls made
  - `cachedGrades` — re-submissions served from the saved grade (**free**)
  - `cooldownBlocked` — rapid re-submits refused before spending a call (**free**)
  - `image` — sprite generations (these hit the image quota)
  - `serverKey` vs `ownKey` — how many calls used *your* key vs the kids' own keys
- `"retiredModels"` → names the API rejected as unavailable. If a model you set in
  `FORGE_MODELS` shows up here, drop it — Google retires models on a schedule.

---

## Part 3 — Add it for LOCAL development (optional)

Only needed if you run the app on your own computer (`node server.js`).

1. In the `forge-app` folder, copy `.env.example` to `.env`.
2. Open `.env` and set:
   ```
   GEMINI_API_KEY=AIza...your-key...
   ```
3. Save, then run `node server.js`. It prints **`AI judge: Gemini (live)`** when
   the key is working.

`.env` is gitignored, so your key never gets committed.

---

## FAQ

- **Do the boys each need a key?** Strictly, no — the server key powers everyone. But
  **yes, you want them to**, each created in its own project. Free quota is per
  project, so four kids on the server key share one daily allowance and drain it four
  times faster. Each player adds their own key via the **🔑** button (also the first
  Q0 step). It's saved only in their browser, sent with each grade request, and never
  stored on the server.
- **Is it really free?** Yes, on the free tier. Heavy use can hit daily limits, and
  grading falls back to the offline grader until it resets — no charge either way,
  since a free-tier key with no billing attached simply gets refused, never billed.
- **The app said my daily limit is gone but I barely used it.** Check `apiUsage` on
  the health URL. Common causes: the crew are all on the server key (one shared
  project), or sprite generation in God Mode — image calls are much scarcer than
  grading calls (~500/day) and each "regenerate" spends one.
- **Grading feels stale / it didn't re-grade.** Submitting the *exact same words*
  replays your saved grade instead of spending a call. Change the answer to get a
  fresh grade.
- **Can I change which model grades?** Set `FORGE_MODELS` to a comma-separated list,
  cheapest first (default: `gemini-2.5-flash-lite,gemini-2.5-flash`). Keep retired
  names out — every dead name costs a wasted round-trip per grade.
- **Where do I change the key later?** Same place: Render → the-forge → Environment →
  edit `GEMINI_API_KEY` → Save. Or your local `.env`.
