# 📱 THE FORGE — WhatsApp Relay (unofficial)

Posts crew updates into a WhatsApp group — *"⚔️ Zeppelin cleared a trial! +100 XP"*,
level-ups, and a `!standings` leaderboard — by watching your live Forge app.

> ⚠️ **Read this first.** This links a robot as a device on **your** WhatsApp
> account (you scan a QR from your phone). Automating a normal WhatsApp account is
> **against WhatsApp's terms**, and there's a small but real risk the number gets
> rate-limited or banned. You're doing this on your own number, by choice. Keep it
> low-volume (it only posts real events). If you'd rather zero risk, use Telegram
> instead — ask and I'll wire it in 5 minutes.

## What it does
- Runs **on your computer** (not on Render). It only posts while it's running and
  your machine is on.
- **Reads only** your app's public `/api/state` — no keys, nothing secret.
- Posts when someone's **XP goes up** or they **level up**, and replies to
  **`!standings`** (or `!forge`) in the group with the leaderboard.

## Setup (one time, ~5 min)
You need **Node 18+** on this computer (`node --version`).

```bash
cd whatsapp-relay
npm install                 # installs whatsapp-web.js (downloads a Chromium — normal)
cp .env.example .env        # Windows: copy .env.example .env
#   -> open .env and set WHATSAPP_GROUP to your group's EXACT name
node relay.js
```

1. A **QR code** appears in the terminal.
2. On your phone: **WhatsApp → Settings → Linked Devices → Link a device → scan it.**
3. It prints `✅ WhatsApp linked` and starts watching. Done.

> **Group name wrong?** On startup the relay lists every group name it can see —
> copy the exact one into `WHATSAPP_GROUP` and restart.

## Running it
- Leave the terminal open — it posts as events happen (checks every ~45s).
- It **remembers the login** (in `.wwebjs_auth/`), so next time just `node relay.js`,
  no re-scan.
- Stop it with `Ctrl+C`. Nothing posts while it's stopped.
- To keep it running long-term, keep this computer on, or run it under something like
  `pm2` (optional).

## Commands (type in the WhatsApp group)
- `!standings` or `!forge` → the relay replies with the live leaderboard.

## Notes / limits
- **Your computer must be on** for messages to send. This is the tradeoff of the
  unofficial route (vs. Telegram/Discord, which run in the cloud).
- If WhatsApp logs the device out, delete `.wwebjs_auth/` and re-scan.
- `.env`, `.wwebjs_auth/`, and `.wwebjs_cache/` are gitignored — never commit them.
- Tune volume with `POLL_MS`. Don't set it super low; that looks bot-like.
