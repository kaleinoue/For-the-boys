# Quest 09 — The Agent Swarm
> Act 4 · Agent Swarms & Orchestration • ~120 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Build a tiny indie-studio *swarm* — multiple specialized AI agents (designer, coder, critic, hype) that pass work to each other — instead of one do-everything bot.

**🎒 Loadout:**
- `starter-code/agent-starter/llm.py` 🟢 (you'll reuse its `chat()` — do NOT rewrite it)
- Your free Gemini key in `.env` 🟡 (`GEMINI_API_KEY=...`)
- Python 3.11+ 🟢, VS Code 🟢
- A real question about YOUR game (from `project/GAME.md`)

**⭐ XP on the line:** 100 base (+50 boss).

## 🤔 Why this Quest matters

One agent that "does everything" is like one person being designer, programmer, QA, and marketer at 2am — it gets foggy, contradicts itself, and forgets what it decided three steps ago. Real studios split roles so each brain stays sharp. You already split that way in real life: Jonah leads the art and the vision, Leo owns sound and hype, Zeppelin engineers and breaks things. You're about to do the same with AI: several small agents, each with ONE job and ONE attitude, handing work down a line. Think of the swarm as AI *stand-ins* for those roles — an idea-pitcher, a builder, a critic, a hype writer — but the REAL crew still drives every decision. This is the pattern behind almost every serious AI product you've heard of. Learn it here on something fun (your game) before you ever need it for something that matters.

## 🧠 The Briefing

### A swarm is not magic — it's a `for` loop over agents

Let's kill the mystery right now. Back in Quest 3 you built `llm.py` — one function, `chat(messages, system)`, that sends a conversation plus a *system prompt* and returns text. In Quest 4 you wrapped a THINK→ACT→OBSERVE loop around it to make a single agent.

**A swarm is just multiple of those, each with a different system prompt, glued together by a plain Python script that decides who talks when.**

That's it. No new library. No secret API. The "intelligence" of a swarm doesn't come from a framework — it comes from:

1. **Specialized roles** — each agent gets a sharply different system prompt, so it behaves like a different specialist.
2. **Separation of concerns** — the designer never worries about code; the critic never worries about being nice. Each agent does one thing well.
3. **Handoffs** — the *output* of one agent becomes the *input* of the next. Your orchestrator code moves the work along.

⚠️ **Real Talk:** "Multi-agent system" sounds like sci-fi swarm intelligence. It isn't. It's a script calling an LLM a few times with different instructions. When someone hypes "autonomous agent swarms," translate it in your head to "a Python loop with some prompts." That mental model will keep you from getting scammed by buzzwords for the rest of your career.

### Why specialists beat one generalist

Give one agent the prompt *"design a feature, write the code, find the bugs in your own code, AND write the marketing"* and watch it get mediocre at all four. Two reasons:

- **Conflicting goals.** A designer wants bold ideas. A critic wants to tear them apart. You can't be maximally creative and maximally skeptical in the same breath. Different system prompts let each agent fully commit to its job.
- **Focus = quality.** A prompt that says *"You are a ruthless QA playtester. Your ONLY job is to find what breaks."* produces far better bug-hunting than a paragraph trying to be everything at once.

Same model (Gemini), same `chat()` function — the *system prompt* is the entire personality. That's the lever.

> 🎨 **Jonah (Artificer):** the **designer** agent is the AI version of your job — it throws out bold ideas. Treat it like a sketchpad partner, not a boss: it pitches, you decide what's actually on-brand for our game.

### The three patterns you'll actually use

Almost every swarm is one of these (or a mix). Keep it this simple:

| Pattern | Shape | Use it when… | Example |
|---|---|---|---|
| **Pipeline** | A → B → C (output feeds the next) | Work has clear stages | Designer → Coder → Critic |
| **Parallel fan-out** | one input → A, B, C at once → combine | You want several takes independently | Three designers pitch power-ups, you pick |
| **Manager + workers** | Manager assigns → workers do → manager checks | A goal needs planning + sub-tasks | (You build this in Quest 10) |

A **critic / playtester** agent is a special, high-value worker you can bolt onto any of these: its only job is to poke holes in another agent's output. Cheap to add, massively improves quality.

```
PIPELINE (this quest):

  game question
        │
        ▼
   🎨 Designer ──► 🛠️ Coder ──► 🧪 Critic ──► 📣 Hype
   (idea)         (plan)       (pokes holes)  (tagline)
```

🤖 **Co-pilot tip:** When you're stuck designing a swarm, ask claude.ai 🟡: *"I have a task: ___. Break it into 3–4 specialized agent roles, and for each give me a one-paragraph system prompt."* It's great at decomposing work into roles — that's exactly the skill orchestration rewards.

### The one rule that keeps a swarm honest

Every agent call still goes through `llm.py`'s `chat(messages, system)`. So:
- `system=` → **who this agent IS** (the role/personality). This changes per agent.
- `messages=` → **the work so far** (usually one user message containing the previous agent's output).

You never need to touch `llm.py`. If the swarm works, it's because your *orchestrator script* and your *system prompts* are good. That separation is the whole point of why `llm.py` was built the way it was.

## 🛠️ The Quest (do this now)

You'll build a `swarm/` folder next to the agent starter and create three files: a roster of agents, an orchestrator, and a runner.

> 🤖 **AI Ops is on rotation.** The 🤖 swarm role passes around the crew so nobody outsources learning AI. Check `../../CREW.md` for whose turn it is to lead AI Ops this Act — that's who owns building the swarm this quest. Zeppelin, Leo, or Jonah: tag in.

### Step 1 — Make the folder and a quick sanity check

```bash
cd starter-code/agent-starter
mkdir -p ../../project/swarm
```

We'll put the swarm in `project/swarm/` (it's part of YOUR studio now), and import `chat` from the starter `llm.py`. Make sure your `.env` has `GEMINI_API_KEY=...` and you've run `pip install -r requirements.txt`.

### Step 2 — Write the agent roster: `project/swarm/agents.py`

This file is *only* system prompts + a tiny helper. One agent = one personality.

```python
"""
agents.py — the studio roster.

Each "agent" is just a NAME + a SYSTEM PROMPT (its personality/role).
The brain is shared: every agent runs through llm.py's chat().
We import chat from the agent-starter so we never duplicate the brain.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Reuse the EXISTING brain from the agent-starter. No rewriting llm.py.
STARTER = Path(__file__).resolve().parents[2] / "starter-code" / "agent-starter"
sys.path.insert(0, str(STARTER))
from llm import chat  # noqa: E402  (the provider-swappable brain you built in Quest 3)


# --- The roster: name -> system prompt (the ENTIRE personality) -------------
ROSTER = {
    "designer": (
        "You are a bold indie game DESIGNER. You pitch ONE concrete game "
        "feature or mechanic. Be specific and fun, not generic. Keep it under "
        "120 words. No code — just the idea and why it's cool."
    ),
    "coder": (
        "You are a pragmatic game CODER working in Phaser 3 (JavaScript). "
        "Given a feature idea, output a short implementation PLAN: the steps, "
        "what variables/functions you'd add, and ONE tiny code snippet. "
        "Be realistic about scope. Under 150 words."
    ),
    "critic": (
        "You are a ruthless QA PLAYTESTER. Your ONLY job is to find what's "
        "weak, confusing, unfun, or unscoped about a proposed feature and its "
        "plan. List 3 concrete problems and 1 suggested fix each. Be blunt but "
        "useful. No praise."
    ),
    "hype": (
        "You are a HYPE writer. Given a feature, write ONE punchy tagline "
        "(max 12 words) a player would see. No quotes, no explanation."
    ),
}


def ask_agent(name: str, work: str) -> str:
    """Run one agent: feed it the work-so-far, return its reply.

    `name` picks the system prompt (the role). `work` is the previous
    agent's output (or the original question for the first agent).
    """
    system = ROSTER[name]
    messages = [{"role": "user", "content": work}]
    return chat(messages, system=system)
```

Notice: **`ask_agent` is the entire engine.** Every agent is the same one-line call — only the `name` (→ system prompt) changes. That's separation of concerns made literal.

### Step 3 — Write the orchestrator: `project/swarm/orchestrator.py`

The orchestrator is the *director*. It decides the order and prints the conversation so you can SEE the work flow between agents (just like the transparent loop in `agent.py`).

```python
"""
orchestrator.py — the studio director.

A swarm is just multiple agents coordinated by code. This runs them as a
PIPELINE: each agent's output becomes the next agent's input. Swap the order,
add agents, or branch — it's your script, your rules.
"""
from __future__ import annotations

from agents import ask_agent


def run_pipeline(question: str, pipeline: list[str]) -> dict[str, str]:
    """Run agents in order; each one sees the PREVIOUS agent's output.

    Returns a dict of {agent_name: its_output} so you can use the results.
    """
    print(f"\n🎬 STUDIO MEETING — topic:\n   {question}\n" + "=" * 60)

    history: dict[str, str] = {}
    work = question  # what we hand to the first agent

    for name in pipeline:
        print(f"\n>>> {name.upper()} is working...")
        reply = ask_agent(name, work)
        history[name] = reply
        print(reply)
        print("-" * 60)
        # Handoff: bundle the question + what just happened for the next agent.
        work = (
            f"Original topic: {question}\n\n"
            f"The {name} just produced:\n{reply}\n\n"
            f"Do YOUR job based on this."
        )

    print("\n✅ Meeting adjourned.\n")
    return history


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()
    run_pipeline(
        "Propose and critique a new power-up for our game",
        pipeline=["designer", "coder", "critic", "hype"],
    )
```

### Step 4 — Run it

```bash
cd ../../project/swarm   # if you're still in agent-starter
python orchestrator.py
```

You'll watch the designer pitch something, the coder turn it into a plan, the critic shred it, and the hype agent slap a tagline on it — each one reacting to the last. **That handoff is the whole idea of a swarm.**

If it errors on the model name, open Google AI Studio 🟡 and check the current free model name (same fix as always — Google renames `gemini-*` models sometimes; edit `MODEL` in `llm.py`).

⚠️ **Real Talk:** four agents = four API calls per run. On the free tier you have generous-but-finite quota. Don't sit there spamming `python orchestrator.py` 200 times. Run it, read it, tweak a prompt, run again. You'll learn more in 10 thoughtful runs than 200 mindless ones — and you won't hit a rate limit mid-quest.

## 🎮 Build-the-Game Tie-In

Run the swarm on a **real** decision for YOUR game. Open `project/GAME.md`, find something undecided (a power-up, an enemy, a level mechanic), and feed it in:

```python
run_pipeline(
    "A new power-up: something that fits our game's core loop",
    pipeline=["designer", "coder", "critic", "hype"],
)
```

Then **actually use the output**:
1. Take the designer's idea + the critic's fixes and write the *survivor* version into `project/GAME.md` under a new `## Power-ups` or `## Ideas Backlog` section.
2. Keep the coder's snippet as a note for when you build it (Quest 7/8 territory).
3. If the hype tagline is good, save it — you'll want marketing copy in Act 6.

The swarm didn't decide FOR you. It gave your crew a sharper starting point than a blank page. That's the job.

> 🎮 **Crew move:** the swarm just played AI-Jonah (idea), AI-Zeppelin (build + critique), and AI-Leo (hype) for you — fast and free. Now the REAL crew weighs in: Jonah checks if the idea fits the look, Zeppelin checks if it'll feel good to play, Leo checks if the tagline slaps. The agents draft; you three are the final cut.

## 💀 Boss Challenge (+50 XP)

**Make the designer and critic DEBATE until they converge.**

A pipeline runs once. A *debate* loops two agents against each other for N rounds — designer proposes, critic attacks, designer revises, repeat — until the critic runs out of real complaints (or you hit a round cap, your `MAX_STEPS`-style safety rail from `agent.py`).

Add this to `orchestrator.py`:

```python
def run_debate(question: str, rounds: int = 3) -> str:
    """Designer vs Critic, N rounds, until they converge or hit the cap."""
    print(f"\n🥊 DEBATE: {question}\n" + "=" * 60)

    proposal = ask_agent("designer", question)
    print(f"\n🎨 DESIGNER (round 1):\n{proposal}")

    for r in range(1, rounds + 1):
        critique = ask_agent("critic", proposal)
        print(f"\n🧪 CRITIC (round {r}):\n{critique}")

        # Convergence check: did the critic basically give up?
        if "no major" in critique.lower() or "ship it" in critique.lower():
            print("\n🏁 Critic is satisfied — converged early.")
            break

        revise = (
            f"Original topic: {question}\n\n"
            f"Your previous design:\n{proposal}\n\n"
            f"The playtester's complaints:\n{critique}\n\n"
            f"Revise your design to fix these. Keep what worked."
        )
        proposal = ask_agent("designer", revise)
        print(f"\n🎨 DESIGNER (revised, round {r + 1}):\n{proposal}")

    print("\n✅ Final design above.\n")
    return proposal


# at the bottom, under load_dotenv():
# run_debate("A boss enemy for level 1", rounds=3)
```

Tweak the critic's system prompt to end with *"If the design is genuinely solid, say 'SHIP IT' and stop nitpicking."* so the convergence check can actually trigger. Notice you reused the EXACT same `ask_agent` — debate is just a different *orchestration* of the same roster. That's the lesson.

## 🏆 Achievements

- [ ] 🐝 Hive Mind (+20 XP) — ran a 4-agent pipeline end to end and read the full handoff chain.
- [ ] 🎨 Roster Builder (+15 XP) — added or heavily rewrote a 5th agent's system prompt (e.g. a "Budget" agent that flags scope creep).
- [ ] 🥊 Fight Club (+30 XP) — beat the Boss: got designer vs critic to converge in code.

## 🎒 Loot (keep this forever)

**The reusable swarm orchestrator.** `agents.py` + `orchestrator.py` work for ANY task, not just games. To reuse them, you change exactly two things: the **ROSTER** (the system prompts / roles) and the **pipeline list** (the order). The mental model to tattoo on your brain:

> **A swarm = many `chat()` calls with different system prompts, coordinated by your own code. Specialized roles beat one generalist because each prompt can fully commit to one job. The handoff (output → input) is the whole trick.**

Save both files in `project/swarm/`. You'll route real game tasks through them next quest.

## ✅ Quest Complete

- [ ] Created `project/swarm/agents.py` (roster + `ask_agent`) reusing `llm.py`'s `chat()`.
- [ ] Created `project/swarm/orchestrator.py` and ran a 4-agent pipeline.
- [ ] Ran the swarm on a REAL game question and updated `project/GAME.md` with the result.
- [ ] (Boss) Got two agents to debate and converge.
- [ ] Logged your XP in [`../../CREW.md`](../../CREW.md). (+100, +50 if you beat the boss.)

## 🔭 Going Deeper / Side Quests

- Add a **parallel fan-out**: call three different designer prompts on the same question, print all three, and let your crew vote. (Real swarms branch, not just line up.)
- Read how production frameworks structure this — search for the official docs of **CrewAI** and **LangGraph** (multi-agent orchestration). You don't need them yet; recognize that they're doing what you just did, with more plumbing.
- Skim **Anthropic's engineering blog** posts on multi-agent systems (search "Anthropic building effective agents") — well-known, accurate, and it'll confirm: keep it as simple as the task allows.

## ➡️ Next

The swarm can *do* the work — but who decides what work to do, in what order, and when a human must step in? Time to run the studio. → [Quest 10 — Orchestration: Run the Studio](quest-10-orchestration.md)
