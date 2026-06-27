# Quest 11 — Security & Secrets
> Act 5 · Break It (Security · Red Team · Audits) • ~90–120 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Lock down your studio's repo so you can make it public for launch *without* leaking a key, shipping insecure AI-written code, or doxxing your crew.

**🎒 Loadout:**
- Your `For-the-boys` repo (with `project/` and `starter-code/agent-starter/`)
- Git + GitHub 🟢 (you set this up in Quest 8)
- The root `.gitignore` (already guards `.env` — you'll verify it actually works)
- Terminal / VS Code 🟢
- 10 minutes inside your Google AI Studio 🟡 dashboard (to practice rotating a key)

**⭐ XP on the line:** 100 base (+50 boss).

---

## 🤔 Why this Quest matters

You're about to make this game **public**. The whole internet — bots included — will be able to read every file you ever committed. Right now your repo probably has a live API key one bad `git add .` away from the open web, and a pile of AI-written code nobody audited. Leaked free-tier keys get scraped and drained by bots within *minutes*; insecure code gets exploited the moment someone looks. This quest is the difference between a launch and a public faceplant. Security isn't paranoia — it's the price of going public.

---

## 🧠 The Briefing

This is **defensive** security: you are hardening *your own* project so it survives contact with the public. Everything here is about protecting what's yours.

### Secrets: the one mistake that haunts you

A **secret** is anything that proves "I'm allowed to do this": API keys, passwords, tokens. Your `GEMINI_API_KEY` is a secret. It's basically a password to *your* free AI quota.

Two rules, non-negotiable:

1. **Never commit a secret to Git.** Git remembers *everything*. Even if you delete a key in a later commit, it's still sitting in the history forever — and anyone who clones the repo gets the whole history. "I'll just delete it after" does not work.
2. **Never paste a secret into a chat** (claude.ai, a Discord, a random "API key checker" site). You don't control where that text goes.

The fix is dead simple and you already have it:

| Piece | Job |
|-------|-----|
| `.env` | A plain file holding your real secrets (`GEMINI_API_KEY=...`). Lives **only on your machine**. |
| `.env.example` | A fake, committed template (`GEMINI_API_KEY=paste-your-key-here`) so teammates know what to fill in. **No real values.** |
| `.gitignore` | A list of files Git must *pretend don't exist*. Yours already lists `.env`, so Git never even offers to commit it. |
| `python-dotenv` | The library that reads `.env` into your program at runtime (`load_dotenv()`), so your code gets the key without it ever touching the source. |

That's the whole pattern: **the secret exists, but only on disk, and Git is blind to it.** Your starter code already does this right — `llm.py` reads `os.environ.get("GEMINI_API_KEY")` and `agent.py` calls `load_dotenv()`. You just have to not break it.

> 🤖 **Co-pilot tip:** Ask claude.ai: *"Explain like I'm 18: why does deleting a secret from a file NOT remove it from git history, and what's the only real fix?"* The answer ("you have to rotate the key, because the old commit still exists") is the single most important security fact in this whole Act.

### When (not if) a key leaks: ROTATE IT

Say it happens. You committed `.env`, pushed, and now your key is on GitHub. Deleting the file does **not** save you — the key is in the history *and* a bot may have already grabbed it.

The only real fix is **rotation**: go to the provider, **delete/revoke the leaked key, and generate a new one.** The instant you revoke it, the leaked copy is a dead string. Then put the *new* key in `.env` (never committed) and you're safe.

> ⚠️ **Real Talk:** A drained free-tier key isn't "just" annoying. If a bot pumps thousands of requests through *your* key, you can blow your quota in minutes, get your account flagged, or — on a paid provider — rack up a real bill. Treat a leaked key as already-compromised. Rotate first, investigate later. Free does not mean consequence-free.

### Don't trust AI output blindly

You're going to ship code an AI wrote. The AI is a confident autocomplete (Quest 1) — it predicts plausible code, not *correct* or *safe* code. Three specific traps:

- **Insecure code.** AI loves quick hacks: building a database query by gluing strings together (SQL injection), using `eval()` on user input, hardcoding a secret right in the source "to make it work." Looks fine, runs fine, exploitable. *(Notice `tools.py`'s calculator filters input to a tiny allowed-character set BEFORE `eval` — that's the kind of guard AI skips.)*
- **Hallucinated dangerous commands.** Ask for a "cleanup script" and you might get `rm -rf` pointed somewhere ugly, or a "fix" that force-pushes over your team's work. Never run a command you don't understand. Read it. Ask what each flag does.
- **Invented libraries (typosquatting).** AI sometimes recommends `pip install <package>` for a package that **doesn't exist**. Attackers watch for these and register the fake name with malware inside — so a confident hallucination becomes a real install of someone's payload. Before you `pip install` anything an AI named, **search for it on the real package index (pypi.org / npmjs.com)** and check it's legit and popular.

The rule: **AI writes the draft, you are the senior reviewer.** Read it before you run it. Always.

### Data privacy: your keyboard is a leak

Whatever you paste into an AI tool *leaves your machine*. So don't paste:

- **Secrets** (keys, passwords, tokens).
- **Personal/private data** — a crewmate's real address, phone number, anything you wouldn't post publicly. Don't put your friends in someone else's training pipeline.
- **Anything under NDA** (a part-time job's internal code, a school's private data, etc.).

For this project you're almost always pasting game ideas and public code — totally fine. Just build the reflex: *"would I be okay if this exact text were screenshotted?"*

### Prompt injection: a teaser (full fight in Quest 12)

One more threat, because your agent has *tools*. **Prompt injection** is when malicious instructions are hidden *inside data your AI reads* — a webpage, a file, a Wikipedia result — that say something like *"ignore your previous instructions and ___."* If your agent trusts that text, the attacker is now driving your agent. That's a whole quest of its own. For now, just file it away: **data the AI reads is not the same as instructions you gave it.** Quest 12 is where you attack your own agent with exactly this.

---

## 🛠️ The Quest (do this now)

You're running a **pre-launch security audit** on your own repo. Work through it in order.

### Step 1 — Confirm `.gitignore` is actually protecting `.env`
Don't assume — *prove* it. In your repo root:
```bash
git check-ignore -v starter-code/agent-starter/.env
```
If `.env` is ignored, Git prints the matching rule (something pointing at your `.gitignore`). If it prints **nothing**, the file is NOT ignored — stop and fix `.gitignore` before doing anything else. Also run:
```bash
git status
```
You should **not** see any `.env` file listed as new/modified. If you do, it was never ignored — fix that now.

### Step 2 — Hunt for secrets already in your working files
Search your whole repo for things that look like live keys (Gemini keys often start with `AIza`; many keys are long random strings):
```bash
git grep -nE "AIza[0-9A-Za-z_-]{20,}|api[_-]?key\s*=\s*['\"][^'\"]+" -- ':!*.example' ':!*.md'
```
This searches **tracked files only**, skipping `.example` templates and these lesson docs. Ideally: zero hits. Any real-looking key here = a secret living in a committed (or about-to-be-committed) file. Move it into `.env` and replace the source with `os.environ.get(...)`.

### Step 3 — The "would I be embarrassed if this were public?" pass
Open every file you've added in `project/` and skim it as if a stranger is reading it tomorrow. Look for:
- Hardcoded keys, passwords, or tokens.
- Real personal info (your address, a crewmate's phone, private chat logs).
- Edgy joke comments / commit messages you don't want your name on publicly.
- TODOs like `# FIXME this is insecure` that you forgot.

Fix or delete anything that makes you wince.

### Step 4 — Audit the AI-written code you're about to ship
Open `project/src/` (your game) and any tools you added in Quest 4. For each chunk an AI wrote, ask:
- Do I actually understand what every line does? (If no — get it explained, *then* keep or cut it.)
- Does it `eval()` / run anything built from user or web input without a guard?
- Does it `pip install` / load a library I never verified exists on pypi.org or npmjs.com?

Write down anything sketchy — you'll formally exploit-test it in Quest 12.

### Step 5 — Practice rotating a key (do this for real, it's free)
This is a fire drill so you're not learning it during an actual leak:
1. Open **Google AI Studio** 🟡 → your API keys.
2. Generate a **second** key. Paste it into your `.env`, replacing the old one.
3. Run `python starter-code/agent-starter/llm.py` — still works? Good, the new key is live.
4. Now **delete the OLD key** in AI Studio. Confirm your app still runs (it's on the new key) and that the old string is now dead.

You just rehearsed the exact move that saves you when a real leak happens. Muscle memory.

### Step 6 — Add any missing safety
- Confirm `.env.example` exists and has **only** placeholder values (yours does — keep it that way).
- If any teammate cloned the repo and made their own `.env`, confirm *theirs* is ignored too (`git check-ignore` on their machine).
- Commit your cleanup (the *fixes*, never the secrets).

---

## 🎮 Build-the-Game Tie-In

This is the quest where your game becomes **safe to make public**. By the end:
- `project/` contains **zero secrets** and zero private data.
- Every AI-written file in `project/src/` has been read by a human (you), not just pasted and trusted.
- You've proven `.env` is gitignored and rehearsed key rotation.

Add a short `## Security` section to `project/GAME.md` noting: "Repo audited for secrets on [date]; `.env` confirmed ignored; key rotation rehearsed." When you launch in Quest 15, you launch clean.

---

## 💀 Boss Challenge (+50 XP)

**Scan your entire commit history for secrets — not just current files.**

Step 2 only checked your *current* files. A leaked key might be buried in an old commit you've forgotten. Hunt the whole timeline. Two ways:

**Option A — pure Git (no install):**
```bash
git log -p | grep -nE "AIza[0-9A-Za-z_-]{20,}|secret|password|api[_-]?key" || echo "Clean: no obvious secrets in history."
```
This dumps every change ever made and greps it for secret-shaped text.

**Option B — write a tiny scanner** (`scan_secrets.py` in your scratch area, NOT committed to project):
```python
"""scan_secrets.py — flag secret-shaped strings across git history. Run from repo root."""
import re, subprocess

# Patterns that look like leaked secrets. Add your own as you learn more.
PATTERNS = [
    r"AIza[0-9A-Za-z_\-]{20,}",                 # Google/Gemini-style API key
    r"(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*['\"]?[^\s'\"]{8,}",
]

# Every line ever added across all commits (the "+" lines in diffs).
diff = subprocess.run(
    ["git", "log", "-p", "--all"], capture_output=True, text=True
).stdout

hits = []
for line in diff.splitlines():
    if not line.startswith("+"):
        continue
    for pat in PATTERNS:
        if re.search(pat, line):
            hits.append(line.strip()[:120])

if hits:
    print(f"⚠️  {len(hits)} suspicious line(s) found in history:")
    for h in set(hits):
        print("  ", h)
    print("\nIf any are REAL keys: rotate them now, then clean history (git filter-repo / BFG).")
else:
    print("✅ No secret-shaped strings found in history.")
```
Run it: `python scan_secrets.py`. If it finds a *real* key, the fix is **rotate it immediately** (it's already public), then rewrite history with `git filter-repo` or the BFG Repo-Cleaner (search those — both are free; rotation comes first because history-rewriting is messy and the key is already out).

---

## 🏆 Achievements

- [ ] 🔐 **Vault Sealed** (+15 XP) — proved `.env` is gitignored with `git check-ignore` and found zero secrets in working files.
- [ ] 🔄 **Fire Drill** (+15 XP) — rotated a real (live) Google AI Studio key and confirmed the app runs on the new one.
- [ ] 🕵️ **Ghost Hunter** (+20 XP) — scanned full commit history (boss) and confirmed it's clean (or rotated + cleaned what you found).

---

## 🎒 Loot (keep this forever)

**The Pre-Commit / Pre-Launch Security Checklist** — run this before every push, and especially before going public. Drop it in `project/` or your `CHEATSHEET.md`:

```
🔐 FORGE SECURITY CHECKLIST — run before any push, twice before launch

SECRETS
[ ] No real keys/passwords/tokens in any committed file
[ ] .env is gitignored  →  `git check-ignore -v .env` prints a rule
[ ] .env.example has placeholders ONLY
[ ] `git status` shows no .env staged
[ ] (pre-launch) full history scanned — no secrets in old commits

AI-WRITTEN CODE
[ ] I understand every line I'm shipping (no "magic" pasted code)
[ ] No eval()/exec()/shell on raw user or web input without a guard
[ ] Every pip/npm package was verified real on pypi.org / npmjs.com

PRIVACY
[ ] No personal/private data (mine or a crewmate's) in the repo
[ ] Nothing I'd be embarrassed to have screenshotted

IF A KEY LEAKED
[ ] ROTATE it at the provider FIRST (revoke old, make new)
[ ] Put the new key in .env (never committed)
[ ] Then clean history if needed
```

---

## ✅ Quest Complete

- [ ] `.env` confirmed gitignored; `.env.example` holds placeholders only.
- [ ] Working files and `project/src/` scanned — no secrets, no private data.
- [ ] You read (not just pasted) the AI-written code you're shipping.
- [ ] You rotated a real key and confirmed the app runs on the new one.
- [ ] (Boss) Full commit history scanned for secrets.
- [ ] The Security Checklist is saved somewhere permanent.
- [ ] **Log your XP in `../../CREW.md`** (100 base + achievements + boss).

---

## 🔭 Going Deeper / Side Quests

- **GitHub Secret Scanning** — GitHub auto-scans public repos for leaked keys and can alert you. Search "GitHub secret scanning" and enable it on your repo before launch. Free safety net.
- **OWASP Top 10** — the classic list of the most common web security holes. Search "OWASP Top Ten." Skim it; you'll recognize a few traps from your own AI-written code.
- **Side quest:** Deliberately commit a *fake* key to a throwaway branch, then practice removing it from history with the BFG Repo-Cleaner (search "BFG repo cleaner"). Learn the messy cleanup in a safe sandbox, not during a real leak.
- **Side quest:** Add the `scan_secrets.py` boss script as a Git **pre-commit hook** (search "git pre-commit hook") so it runs automatically and blocks any commit containing a secret-shaped string.

---

## ➡️ Next

Your repo is locked down — no leaks, no blind trust. Now flip to offense: stop *defending* and start *attacking* your own systems before anyone else does. Time to break your own game and jailbreak your own agent.

**→ [Quest 12 — Red Team](quest-12-red-team.md)**
