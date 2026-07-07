# 🔑 Adding your GEMINI_API_KEY (step by step)

The app grades players' answers with Google's **Gemini** AI. That needs one free
API key, stored **on the server** (never in the browser). Without it, the app still
runs but uses a basic "offline" grader instead of real AI feedback.

There's **one key for the whole app** (it lives on the server), not one per kid.

---

## Part 1 — Get a free Gemini API key (2 min, no credit card)

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with a Google account.
3. Click **"Create API key"** (accept the default project if it asks).
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
- `"ok":false,"status":429` → the key works but hit the **free daily limit**;
  it resets (per-minute in ~1 min, per-day at midnight Pacific).
- `"status":400 / API_KEY_INVALID` → the pasted value is wrong; re-copy it.

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

- **Do the boys each need a key?** No — one key on the server powers everyone.
- **Is it really free?** Yes, on the free tier. Heavy use can hit daily limits
  (grading just falls back to the offline grader until it resets).
- **Where do I change it later?** Same place: Render → the-forge → Environment →
  edit `GEMINI_API_KEY` → Save. Or your local `.env`.
