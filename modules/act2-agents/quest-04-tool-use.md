# Quest 04 — Tool Use: Give It Hands
> Act 2 · Give It Hands (Agents · Tool Use · MCP) • ~90–120 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Turn your AI brain into an actual **agent** — give it tools, run the THINK → ACT → OBSERVE loop, then write your own tool.
**🎒 Loadout:** Your working `starter-code/agent-starter/` from Quest 3 (venv active, `.env` set) · `tools.py` · `agent.py` · the free no-key tools (calculator, get_time, wikipedia).
**⭐ XP on the line:** 100 base (+50 boss).

## 🤔 Why this Quest matters

A model that only talks is trapped inside its own head — it can't check today's date, can't do reliable math, can't look anything up. Tool use is the jailbreak. The moment your AI can call a function, run code you wrote, and read the result, it stops being a parrot and starts being a **worker**. This is the single most important concept in modern AI engineering. Get this and you understand agents, MCP, and swarms — they're all just fancier versions of the loop you build today.

## 🧠 The Briefing

### The big idea: the model REQUESTS, your code RUNS

Here's the thing most people get wrong, so read it twice:

> **The AI never runs code. It asks YOUR code to run it.**

The model can only output **text**. So "tool use" works like a waiter and a kitchen:

```
1. The model (waiter) writes down an order:   "Action: calculator, Input: 1984 / 16"
2. YOUR code (kitchen) actually cooks it:      runs calculator("1984 / 16") → "124.0"
3. You hand the result back (Observation):     "Observation: 124.0"
4. The model reads it and decides what's next.
```

The model decides *which* tool and *what* to pass it. Your code does the actual running and hands back the result. That separation is the whole trick — and it's also why tools are a **security boundary** (Quest 11/12): you control exactly what the AI is allowed to actually *do*.

> The fancy industry name for this is **function calling** or **tool use**. Big providers have a structured JSON version of it built into their APIs. We're doing the honest, see-every-gear version with plain text so you understand what's *really* happening under that JSON.

### A "tool" is just a Python function

Open `starter-code/agent-starter/tools.py`. Every tool is the same shape: **takes one string, returns one string.** No magic.

```python
def calculator(arg: str) -> str:
    """Do math. Example arg: '2 * (3 + 4)'."""
    ...
def get_time(arg: str) -> str:
    """Return the current date and time."""
    ...
def wikipedia(arg: str) -> str:
    """Look something up on Wikipedia (free, no key). arg = search term."""
    ...
```

All three are **free and need no API key**. Then there's a registry at the bottom:

```python
TOOLS = {
    "calculator": calculator,
    "get_time": get_time,
    "wikipedia": wikipedia,
}
```

`TOOLS` is the menu. The agent reads it to know what it's allowed to do. And `tool_descriptions()` turns each function's first docstring line into the menu text we hand the AI. **That's why the docstring matters** — it's literally how the model learns what a tool does. A vague docstring = a confused agent.

### The agent loop, line by line

Open `agent.py`. This is the heart of everything. The flow inside `run()`:

```
loop up to MAX_STEPS times:
    reply = chat(messages, system=SYSTEM)   # THINK — the brain decides
    parse the reply:
        if "Final Answer:"  → done, return it
        if "Action:"        → run that tool, capture the Observation   # ACT + OBSERVE
                              feed the reply + Observation back in, loop again
```

Two details that make it work:

1. **`MAX_STEPS = 6`** — a safety rail. Without it a confused agent could loop forever and burn your free quota. *Every* agent needs a step limit. No exceptions.
2. **The strict text protocol.** The `SYSTEM` prompt forces the model to answer in *exactly* this format:

```
Thought: <reasoning>
Action: <one tool name>
Action Input: <what to pass it>
```
…or, when it's done:
```
Thought: <reasoning>
Final Answer: <the answer>
```

Why so strict? Because `parse()` is just reading lines of text looking for `Action:` and `Final Answer:`. If the model freelances the format, your code can't understand it. **The protocol is the contract between the AI's words and your code.** This text-protocol style (Thought/Action/Observation) is a classic agent pattern — you're building the real thing, just transparent enough to read.

> 🤖 **Co-pilot tip:** When an agent misbehaves, the fix is almost always in the **system prompt**, not the Python. Paste your `SYSTEM` string into claude.ai and ask *"a model keeps breaking this output format — how would you tighten these instructions so it always uses exactly this structure?"* Prompt-debugging is a real skill; start now.

> ⚠️ **Real Talk:** Notice `calculator` filters its input to digits and `+ - * / ( )` before doing anything, and `wikipedia` wraps its network call in a `try/except`. Tools run **real code on your machine** at the request of an AI that can be wrong or tricked. Never write a tool that blindly trusts its input. The classic disaster is a tool that runs whatever string it's handed — we'll attack exactly that in Quest 12. Build defensively from tool #1.

## 🛠️ The Quest (do this now)

### 1. Activate your environment

```bash
cd starter-code/agent-starter
source .venv/bin/activate          # Windows: .venv\Scripts\activate
```

(If `.venv` or `.env` is missing, you skipped Quest 3 — go back and do it.)

### 2. Read the two files

Read `tools.py` (the hands) and `agent.py` (the loop) all the way through. They're short. For each, find the four parts called out in the Briefing. Don't run anything yet — predict in your head what `agent.py` will print.

### 3. Run the agent and WATCH it think

```bash
python agent.py
```

The starter asks it: *"What is 1984 divided by 16, and what happened in the year you get?"* Watch the printed loop. You'll see something like:

```
🧑 You: What is 1984 divided by 16, and what happened in the year you get?

🤖 Agent (step 1) → thinking, wants tool: calculator('1984 / 16')
   🔧 Observation: 124.0

🤖 Agent (step 2) → thinking, wants tool: wikipedia('124 AD')
   🔧 Observation: Year 124 (CXXIV) was a ...

🤖 Agent (step 3) → FINAL: 1984 ÷ 16 = 124, and ...
```

**Stop and appreciate this.** The AI did math it can't actually do in its head, looked up a real fact, then combined them. That's THINK → ACT → OBSERVE → THINK → ACT → OBSERVE → answer. That is an agent.

### 4. Ask it your own questions

There's a commented-out second example at the bottom of `agent.py`. Uncomment it, or write your own `run(...)` call:

```python
run("What day of the week is it, and tell me one fact about octopuses.")
run("If our crew of 3 splits 240 enemy coins evenly, how many each — and what's a fun fact about the number you get?")
```

Run again and watch which tools it reaches for. Try to design a question that needs **two different tools in a row** — that's the agent flexing.

### 5. WRITE YOUR OWN TOOL

This is the real quest. Add a brand-new tool to `tools.py`. Follow the exact shape: takes one string, returns one string, has a clear one-line docstring.

> ⚔️ **Zeppelin (Vanguard):** A dice/random tool is exactly what an engineer reaches for to tune game balance — roll a hundred fights, see if the numbers feel fair before they ever touch real code. Build this one and you've got a tiny balance lab.

Example — a dice roller (great for a game studio):

```python
import random  # add near the top imports

def roll_dice(arg: str) -> str:
    """Roll dice. arg like '2d6' means roll two six-sided dice. Returns the rolls and total."""
    try:
        count, sides = arg.lower().split("d")
        count, sides = int(count or 1), int(sides)
        if not (1 <= count <= 100 and 1 <= sides <= 1000):
            return "Error: keep it sane (1-100 dice, up to 1000 sides)."
        rolls = [random.randint(1, sides) for _ in range(count)]
        return f"Rolls: {rolls}  Total: {sum(rolls)}"
    except Exception:
        return "Error: use the form NdM, e.g. '3d6'."
```

Then **register it** in the `TOOLS` dict — this is the step people forget:

```python
TOOLS = {
    "calculator": calculator,
    "get_time": get_time,
    "wikipedia": wikipedia,
    "roll_dice": roll_dice,   # ← your new tool
}
```

That's it. You don't touch `agent.py` at all — it reads `TOOLS` and `tool_descriptions()` automatically, so the new tool shows up on the menu the moment you register it. (Same payoff as Quest 3's one-file design: clean seams mean adding power is cheap.)

### 6. Make the agent use your tool

```bash
python agent.py
# add a run() that needs your tool, e.g.:
run("Roll 2d20 for me and tell me which roll was higher.")
```

If you see it pick `roll_dice` and report real numbers — **you built a working tool and watched an agent use it.** That's the whole skill.

### Troubleshooting

- **Agent says "no tool named X"** → you forgot to add it to the `TOOLS` dict, or the name in the dict doesn't match what the model typed.
- **Agent ignores your tool** → its docstring is vague. Make the first line crystal-clear about *when* and *how* to use it; that line is all the model sees.
- **It loops to MAX_STEPS** → usually a tool returning a confusing string, or a question that doesn't actually need a tool. Print the raw `reply` to see what the model is trying to do.

## 🎮 Build-the-Game Tie-In

Turn this agent into your studio's **game-design helper.** Add a tool that's actually useful for making your game. Pick one (or do all three):

- **`roll_dice`** (above) — for prototyping combat/loot/random mechanics.
- **`name_generator`** — feed it a theme, return a few punchy names for enemies, items, or levels. (You can build this with `random.choice` over word lists, *or* — fancier — call your own `chat()` from Quest 3 inside the tool.)

  > 🎨 **Jonah (Artificer):** This is *your* tool. You're naming the characters and the world — a name-generator is a brainstorming partner that throws you twenty options so you can pick the one that fits the art. Feed it your theme and steal the best ones.
- **`save_idea`** — appends a one-line game idea to a local file like `project/IDEAS.md`, so your agent can stockpile ideas while you brainstorm. (This one is also the Boss — read the safety note there first.)

Concrete action: build at least one game-relevant tool, then ask the agent something like *"Brainstorm an enemy, give it a name, and save the idea."* You now have a robot intern that does design grunt-work.

## 💀 Boss Challenge (+50 XP)

**Build a tool that reads AND writes a local file** — so your agent can save game ideas to disk and read them back.

```python
import os

IDEAS_PATH = "ideas.txt"   # stays inside this project folder ON PURPOSE

def save_idea(arg: str) -> str:
    """Append a game idea to the local ideas file. arg = the idea text."""
    text = arg.strip()
    if not text:
        return "Error: nothing to save."
    with open(IDEAS_PATH, "a", encoding="utf-8") as f:
        f.write(text + "\n")
    return f"Saved. The ideas file now has {sum(1 for _ in open(IDEAS_PATH))} ideas."

def read_ideas(arg: str) -> str:
    """Read back all saved game ideas. Ignores its argument."""
    if not os.path.exists(IDEAS_PATH):
        return "No ideas saved yet."
    return open(IDEAS_PATH, encoding="utf-8").read().strip() or "No ideas saved yet."
```

Register both, then run:
```python
run("Invent a boss enemy for a browser game and save the idea.")
run("Read me back all the ideas we've saved.")
```

> ⚠️ **Real Talk — mind the file safety.** A file tool is the first genuinely *dangerous* thing you've built, because now an AI's text decisions touch your disk. Notice we **hardcode the filename** and use a **fixed path inside this folder**. Do NOT let the AI choose arbitrary paths like `arg` being `../../something`. If you ever let a model pick the file path, a tricked or confused agent could read your secrets or overwrite real files. Lock the path down. (Quest 12 = we deliberately try to break exactly this kind of tool.)

## 🏆 Achievements

- [ ] 🛠️ Toolsmith (+20 XP) — wrote and registered your own working tool.
- [ ] 👀 Loop Reader (+15 XP) — ran `agent.py` and can explain, out loud, each THINK/ACT/OBSERVE step it printed.
- [ ] 💾 Scribe (+25 XP) — beat the Boss: agent saves and reads ideas from a local file, safely path-locked.

## 🎒 Loot (keep this forever)

**The custom-tool template + the agent-loop mental model.** Every tool you ever write fits this mold:

```python
def my_tool(arg: str) -> str:
    """ONE clear sentence: what it does + the arg format. (This is all the AI sees.)"""
    # 1. VALIDATE the input — never trust it blindly.
    # 2. DO the thing (math, lookup, file, API call...).
    # 3. RETURN a short, clear string the model can read.

# then REGISTER it:
TOOLS["my_tool"] = my_tool
```

And the model to keep in your head forever:

> **Agent = brain (Quest 3) + hands (tools) + loop (THINK→ACT→OBSERVE) + a step limit.** The model only ever asks; *your code* decides what's allowed to actually run.

## ✅ Quest Complete

- [ ] Read `tools.py` and `agent.py` and can name the four key parts of each.
- [ ] Ran `python agent.py` and watched a real THINK → ACT → OBSERVE loop.
- [ ] Asked your own multi-tool question and saw it chain tools.
- [ ] **Wrote and registered your own tool**, and the agent used it.
- [ ] (Optional) Beat the Boss: a path-locked read/write file tool.
- [ ] **Logged your XP in [`../../CREW.md`](../../CREW.md).**

## 🔭 Going Deeper / Side Quests

- **Real function calling** — read the "function calling" / "tool use" section of Google AI Studio's official docs (or Anthropic's tool-use docs) to see the structured-JSON version the pros use. Same idea, more guardrails.
- **The ReAct pattern** — search "ReAct reasoning and acting language models." That's the academic name for the Thought/Action/Observation loop you just built.
- **Harden a tool** — add input validation to `wikipedia` (length limits, strip weird characters) and think about what a malicious `arg` could do. Great warm-up for Quest 12.

## ➡️ Next

You hand-built your own tools. But what if tools were a **shared standard** — plug-and-play, reusable across every AI app? That's MCP, and it lets Claude read your *actual* repo.
→ **[Quest 05 — MCP: The Universal Adapter](quest-05-mcp.md)**
