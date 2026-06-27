# Quest 03 — Meet the Agent
> Act 2 · Give It Hands (Agents · Tool Use · MCP) • ~90–120 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Wire up the AI "brain" in Python — your own code that talks to a real model through an API, not a chat window.
**🎒 Loadout:** VS Code 🟢 · Python 3.11+ 🟢 · a terminal · a free Google AI Studio (Gemini) API key 🟡 · the files in `starter-code/agent-starter/`.
**⭐ XP on the line:** 100 base (+50 boss).

## 🤔 Why this Quest matters

Up to now you've been typing into a chat box. That's fine for thinking, but you can't *build* on a chat box — you can't loop it, automate it, or give it tools. This quest is where you stop being a user of AI and start being a **builder** of AI. You're going to write code that calls a model directly through an API, and that one move unlocks the entire rest of the campaign: agents, swarms, the AI helpers that will design and test your game. Everything from here grows out of the tiny file you build today.

## 🧠 The Briefing

### Chatbot vs. Agent (say it with me)

These are NOT the same thing, and mixing them up will confuse you for the next three quests:

| | Chatbot | Agent |
|---|---|---|
| What it does | **Talks.** You ask, it answers, done. | **Acts.** It thinks, *uses tools*, observes results, repeats. |
| Example | claude.ai answering a question | An AI that looks up a fact, does the math, then answers |
| The loop | one turn in, one turn out | THINK → ACT → OBSERVE → repeat |

> An **agent = an LLM in a loop that uses tools.** A chatbot just talks. Burn that into your brain.

Today you build only the **brain** — the part that can think and reply. In Quest 4 you give it **hands** (tools) and wrap it in the loop. Brain now, hands next.

### The THINK → ACT → OBSERVE loop (the thing you're building toward)

Here's the shape of every agent ever made:

```
THINK    "To answer this, I should look up X."
ACT      calls a tool: wikipedia("X")
OBSERVE  reads what the tool returned
THINK    "Now I have what I need."
...repeat until done...
```

A chatbot only ever does the first THINK and stops. An agent keeps going until it has the real answer. You're not building the full loop today — you're building the THINK part, the brain that the loop will call over and over.

### An API vs. a chat window

When you use claude.ai or Gemini in a browser, a human is in the loop: you type, you read. An **API** (Application Programming Interface) is the same model with the human removed — it's a door your *code* knocks on. Your program sends text, the model sends text back, no browser, no person clicking.

```
Chat window:   You  ⌨️  →  🌐 website  →  🤖 model  →  🌐  →  👀 You
API:           your_code.py  →  🌐 endpoint  →  🤖 model  →  back to your_code.py
```

Why this matters: code can loop, branch, and combine API calls. A chat window can't. The API is what makes an *agent* possible at all.

> 🤖 **Co-pilot tip:** Stuck on a Python error in this quest? Copy the **entire** red error message (the "traceback") into claude.ai and ask *"explain this Python error and the most likely fix, I'm on [Mac/Windows/Linux]."* Pasting the whole traceback beats pasting one line every time.

### Why we isolate the provider in ONE file (`llm.py`)

Look at the starter file `starter-code/agent-starter/llm.py`. Notice it's the **only** file that imports the Gemini SDK and knows the model name. That's deliberate. The rule is:

> **Keep the thing most likely to change in one place.**

Model names change. Free tiers run out. Maybe next month you want Groq instead of Gemini. If every file in your project talked to Gemini directly, switching would mean editing ten files and breaking five of them. Because everything goes through `llm.py`'s `chat()` function instead, swapping providers means rewriting **one function** — and the rest of your agent never even notices. (You'll prove this in the Boss.)

### What `chat()` actually does

```python
def chat(messages: list[dict], system: str | None = None) -> str:
    """Send a conversation, get back the AI's text reply."""
```

- `messages` is the conversation so far: `[{"role": "user", "content": "hi"}]`. Roles are `"user"` or `"assistant"`.
- `system` is an optional instruction that sets the AI's behavior ("You are a game designer...").
- It returns a plain **string** — the reply text.

That's the whole brain: text in, text out. Dead simple on purpose. The starter's `chat()` does one extra bit of translation — Google's SDK calls the assistant role `"model"`, so `llm.py` quietly converts our clean `"user"/"assistant"` format into Gemini's format. That ugliness lives in `llm.py` so the rest of your code stays clean. *That's the point of isolating the provider.*

> ⚠️ **Real Talk:** Your API key is a password to a paid-grade service running on a free tier. If it leaks (e.g. you commit it to GitHub), bots **will** find it within minutes and burn your quota — or worse if it's ever a paid key. We're using a free no-card key so the blast radius is small, but build the secret-keeping habit NOW. Keys live in `.env`, `.env` is gitignored, and you never paste a key into a chat. Quest 11 is the whole horror-movie version of this.

## 🛠️ The Quest (do this now)

### 1. Get your free Gemini API key 🟡 (no credit card)

1. Go to **[aistudio.google.com](https://aistudio.google.com)** and sign in with a Google account.
2. Click **"Get API key"** → **"Create API key"**.
3. Copy the key somewhere safe for a minute. It looks like `AIza...`. **Do not** paste it into any chat, screenshot it into a group, or commit it. Treat it like your phone passcode.

### 2. Open the agent project

Open the `starter-code/agent-starter/` folder in VS Code. You'll see `llm.py`, `tools.py`, `agent.py`, `requirements.txt`, `.env.example`, and a `README.md`. Today is all about **`llm.py`** — the others come in Quest 4.

### 3. Make a clean Python environment (a "venv")

A **virtual environment** is a private sandbox for this project's packages, so they don't collide with other Python stuff on your machine. Do it once, activate it every time you work.

```bash
# from inside starter-code/agent-starter/
python3 -m venv .venv

# activate it:
source .venv/bin/activate         # Mac / Linux
.venv\Scripts\activate            # Windows (PowerShell or cmd)
```

When it's active your terminal prompt shows `(.venv)` at the front. That's your "I'm in the sandbox" signal.

### 4. Install the packages

```bash
pip install -r requirements.txt
```

That installs `google-genai` (the Gemini SDK) and `python-dotenv` (loads your `.env` file). If `pip` complains, try `python -m pip install -r requirements.txt`.

### 5. Create your secret `.env`

```bash
cp .env.example .env              # Mac / Linux
copy .env.example .env            # Windows
```

Open the new `.env` and paste your real key in:

```
GEMINI_API_KEY=AIza...your-real-key...
```

Save it. Then confirm `.env` is ignored by Git — the repo's root `.gitignore` already lists `.env`, so you should be safe, but check: run `git status` and make sure **`.env` does not show up** as a file to commit. If it does, stop and fix `.gitignore` before going further.

### 6. Read `llm.py` top to bottom

Before you run it, *read it.* It's ~60 lines. Find:
- the `MODEL` line (the model name — `gemini-2.0-flash`),
- the `_client()` function (builds the connection, yells helpfully if your key is missing),
- the `chat()` function (the brain: messages in, string out),
- the `if __name__ == "__main__":` block at the bottom (a tiny smoke test).

> The starter ships this code already written so you can check your work — but you learn by **typing**, not reading. Recommended: make a new empty file and retype `llm.py` yourself, glancing at the original only when stuck. Muscle memory beats skimming.

### 7. Run the brain

```bash
python llm.py
```

You should see it print something like:

```
the forge is lit
```

That text came from a real AI model, through an API, into your code, out your terminal. **You just made an AI think on command from your own program.** If you got that line, the brain works.

### 8. Talk to it for real

Edit the bottom of `llm.py` (the `__main__` block) and try your own message — for example:

```python
print(chat(
    [{"role": "user", "content": "Give me 3 wild browser-game ideas in one line each."}],
    system="You are a punchy indie game designer. No fluff.",
))
```

Run `python llm.py` again. Notice how the `system` argument changes the *vibe* of the reply. That `system` slot is going to become very important — it's how Quest 4 tells the agent which tools it's allowed to use.

### Troubleshooting

- **`No GEMINI_API_KEY found`** → your `.env` isn't loaded or the key line is wrong. Check the spelling `GEMINI_API_KEY=` and that you ran from inside the folder.
- **Model-name error / 404** → Google occasionally renames free models. Open AI Studio, find the current free model name, and set it in `.env` as `FORGE_MODEL=...`. The starter is built to read that override.
- **`ModuleNotFoundError: google`** → your venv isn't active, or `pip install` didn't run in it. Re-activate and reinstall.

## 🎮 Build-the-Game Tie-In

This Python setup is your **studio's tooling** — the workbench every later quest builds on. Right now it just says "the forge is lit," but:
- In **Quest 4** this same brain gets *tools* and becomes a **game-design helper** that can look things up and crunch numbers for you.
- In **Quest 9** you'll run a whole **swarm** of these — a designer, a coder, a playtester — all powered by the `chat()` function you wired today.

Concrete action: in your `project/GAME.md`, drop a quick note under any section: *"Studio AI tooling online — Gemini brain wired in Quest 3."* Tiny, but it marks the moment your studio got a robot intern.

## 💀 Boss Challenge (+50 XP)

**Prove the one-file design by swapping the provider to Groq 🟡 (free).**

The whole point of isolating the provider in `llm.py` is that you can change it without touching anything else. Do it:

1. Get a free API key at **[console.groq.com](https://console.groq.com)** (free tier, very fast, no card).
2. Add it to `.env` as `GROQ_API_KEY=...`.
3. Rewrite **only** `llm.py`'s `chat()` to call Groq instead of Gemini. Groq's API is OpenAI-compatible, so you'd `pip install groq`, create a client with your key, and send the same `messages` list. Check Groq's own quickstart docs for the exact current call and a valid free model name (model names change — get them from the docs, don't guess).
4. Run `python llm.py` again. Same command, different brain, **zero other files touched.**

If it replies, you just experienced *why* good code isolates the changeable part. That instinct will save you a hundred hours over a career.

> ⚠️ **Real Talk:** Don't fabricate the Groq code from memory — open their quickstart and copy the current shape. Half of "AI engineering" is reading the actual docs instead of trusting what you *think* the API looks like.

## 🏆 Achievements

- [ ] 🔌 First Contact (+15 XP) — got `python llm.py` to print a real AI reply.
- [ ] 🤫 Keymaster (+15 XP) — confirmed `.env` is gitignored and your key never left your machine.
- [ ] 🔁 Brain Surgeon (+25 XP) — completed the Boss and swapped Gemini → Groq by editing only `llm.py`.

## 🎒 Loot (keep this forever)

**Your working `llm.py` + the setup ritual.** The provider-swappable brain is the reusable core of every agent you'll ever build. Keep this command block somewhere you can find it — it's how you start *any* Python AI project from now on:

```bash
# THE FORGE STARTUP RITUAL (run from your project folder)
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then paste your key into .env
python llm.py                      # smoke-test the brain
```

And the mental model: **one file owns the provider; everything else just calls `chat()`.**

## ✅ Quest Complete

- [ ] Got a free Gemini API key (no card).
- [ ] Created and **activated** a `.venv`.
- [ ] Ran `pip install -r requirements.txt` successfully.
- [ ] Created `.env`, pasted your key, and confirmed it's gitignored.
- [ ] Ran `python llm.py` and saw a real AI reply.
- [ ] Changed the `system` prompt and saw the reply's vibe change.
- [ ] (Optional) Beat the Boss: swapped to Groq by editing only `llm.py`.
- [ ] **Logged your XP in [`../../CREW.md`](../../CREW.md).**

## 🔭 Going Deeper / Side Quests

- **Google AI Studio docs** — read the Python quickstart for the `google-genai` SDK on Google's official AI for Developers site. See what else `generate_content` can do (temperature, streaming).
- **What's a traceback?** — search "python traceback read" and learn to read errors bottom-up. This is a superpower.
- **Try a longer conversation** — add a second `{"role": "assistant", ...}` and a follow-up `{"role": "user", ...}` to your `messages` list and watch the model remember context.

## ➡️ Next

The brain can think — now give it **hands.** You'll add real tools and wrap the brain in the THINK → ACT → OBSERVE loop, and watch your AI actually *do* things.
→ **[Quest 04 — Tool Use: Give It Hands](quest-04-tool-use.md)**
