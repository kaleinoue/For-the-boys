# Quest 10 — Orchestration: Run the Studio
> Act 4 · Agent Swarms & Orchestration • ~90–120 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Take the REAL remaining work on your game, break it into tasks, and route each one to the right agent OR the right human — then run one task end-to-end through your swarm.

**🎒 Loadout:**
- Your Quest 9 swarm: `project/swarm/agents.py` + `project/swarm/orchestrator.py` 🟢
- `project/GAME.md` (your game's current state) and `../../CREW.md` (who's on your crew)
- Your free Gemini key in `.env` 🟡
- Python 3.11+ 🟢, VS Code 🟢

**⭐ XP on the line:** 100 base (+50 boss).

## 🤔 Why this Quest matters

A swarm of agents with no plan is just a pile of talented people standing in a room yelling. **Orchestration** is the part where someone decides *what* needs doing, *who* (or which agent) does it, *in what order*, *who checks the work*, and *when a human absolutely must stay in the loop*. This is the single most valuable AI skill that isn't "prompting" — it's the difference between "I have access to AI" and "I ship things with AI." Get this and you can run a project that's bigger than any one person — or any one agent — could hold in their head.

## 🧠 The Briefing

### Orchestration = decompose → assign → handoff → check → (human gate)

That's the whole loop. Memorize it:

1. **Decompose** — break a big fuzzy goal ("finish the game") into small, concrete tasks.
2. **Assign** — give each task to the *right* doer: a swarm agent, a specific crew member, or a pair.
3. **Handoff** — define what each task *produces* and who/what consumes it next.
4. **Check** — decide how you know it's actually done and good (often a critic agent + a human glance).
5. **Human gate** — flag tasks where a human MUST decide before anything ships.

Notice this is exactly what a good project lead does — you're just adding AI agents as some of the "doers."

> 🤖 **Whose studio is it today?** The 🤖 AI Ops role rotates — check `../../CREW.md` for who's leading the swarm this Act. That person runs the orchestrator, but they don't get to *assign taste*: Jonah still owns "does it look like us," Leo owns "does it sound right," Zeppelin owns "does it feel good and not break." Orchestration is leading the crew, not replacing it.

### "One agent does everything" vs a planned pipeline

You *could* type into claude.ai: *"finish my game."* You'll get vibes, not a game. Here's the contrast:

| Naïve | Orchestrated |
|---|---|
| One agent, one huge vague goal | Goal split into ~8 concrete tasks |
| No idea who does what | Each task assigned to an agent or a person |
| No quality check | A critic agent + human review on risky tasks |
| Runs until it's confused | Each task has a clear "done" definition |
| You can't tell what happened | A visible task board you can point at |

The orchestrated version isn't fancier AI. It's the *same* swarm from Quest 9, pointed at the *right* tasks in the *right* order by a plan you wrote.

### The Human-in-the-Loop decision: when a human MUST stay in

This is the most important judgment call in this entire campaign. Let an agent run free on the wrong task and you'll ship a bug, leak a secret, or post cringe to the world under your studio's name. Use this checklist — **if any box is checked, a human reviews/approves before it ships:**

- [ ] **Risk** — could a mistake break the game, corrupt data, or be hard to undo?
- [ ] **Money / quota** — does it spend money or burn a big chunk of free-tier quota? (🔴 NEVER let an agent loop on anything that costs money. 🟡 watch the quota.)
- [ ] **Judgment / taste** — is "good" subjective? (Is this fun? Is this on-brand?)
- [ ] **Public-facing** — will players/the public see the output directly? (marketing, public posts)
- [ ] **Security / secrets** — does it touch `.env`, keys, accounts, or deploy? (That's Act 5 — keep humans in.)

**Good rule:** agents *draft and propose*; humans *decide and ship*. The swarm is your fastest intern, not your boss.

🤖 **Co-pilot tip:** Stuck on how to split a goal? Paste your `project/GAME.md` into claude.ai 🟡 and ask: *"Here's our game's current state. List the 8 concrete tasks left to ship a playable v1, smallest-first, and tag each as design / code / art / test / launch."* Then you assign owners. Let AI draft the breakdown; you own the routing.

### Practical limits (don't skip this — it's where projects die)

- **Cost / quota:** Every agent call is an API call. A 4-stage pipeline run 50 times = 200 calls. Free tiers (Gemini 🟡, Groq 🟡) have limits. Orchestrate to call agents *deliberately*, not in a frenzy.
- **Error handling:** APIs time out and rate-limit. A real orchestrator catches the error, retries or skips, and keeps going — it doesn't crash the whole studio because one call hiccupped.
- **Don't let agents loop forever.** Remember `MAX_STEPS = 6` in `agent.py`? That guard exists so the agent can't think→act→think→act into infinity, burning quota and money. Every loop you build — pipelines, debates, planners — needs a hard cap. **No exceptions.**

⚠️ **Real Talk:** The flashy demos online ("watch 5 agents build an app autonomously!") quietly hide three things: someone curated the task, someone caught the errors, and someone stopped it before it spiraled. That someone is the orchestrator. That's the job you're learning. It's less magic and more management — which is exactly why it's valuable and rare.

## 🛠️ The Quest (do this now)

### Step 1 — Build your real task board

Make a living kanban for finishing YOUR game. Create `project/TASKBOARD.md`. Pull the real remaining work from `project/GAME.md` and your crew from `../../CREW.md`. Use **this template** (fill it with YOUR tasks — these are examples, routed to the REAL crew by class):

```markdown
# 🎮 TASKBOARD — Ship v1

Owners: name = crew member · S = swarm agent · name+S = human drives, agent assists
Route by class: art → Jonah · sound/hype → Leo · engineering/feel/QA → Zeppelin · 🤖 swarm → whoever leads AI Ops this Act.
Human gate 🚦 = a human MUST approve before this ships.

## 📋 Backlog
| # | Task | Owner | Produces | Done when… | 🚦 |
|---|------|-------|----------|------------|----|
| 1 | Decide the v1 power-up | S(designer→critic) → Jonah | a chosen, scoped idea | written in GAME.md | 🚦 |
| 2 | Write the power-up code | Zeppelin+S(coder) | a Phaser snippet that runs | square grabs it, effect works | 🚦 |
| 3 | Draft enemy behavior idea | S(designer) → Jonah | one concrete idea | in GAME.md backlog |  |
| 4 | Tune jump/movement feel | Zeppelin | tighter controls | feels good to move |  |
| 5 | Write 3 marketing taglines | S(hype) → Leo | 3 options | 1 picked by crew | 🚦 |
| 6 | Pick title-screen music vibe | Leo+S(hype) | a sound direction | Leo locks a vibe |  |
| 7 | Player sprite + color palette | Jonah | art that fits the world | crew says "that's us" | 🚦 |
| 8 | Fix the known collision bug | Zeppelin | a passing fix | bug gone, no regressions | 🚦 |

## 🔨 In Progress
| # | Task | Owner | Notes |
|---|------|-------|-------|

## ✅ Done
| # | Task | Result |
|---|------|--------|
```

**Routing logic you just applied** (this is the skill):
- Pure *idea generation* → swarm first (cheap, fast, low risk), then the right human owns the call. Examples: tasks 1, 3, 5.
- *Art / look-and-feel* (sprites, palette, vision) → **Jonah** (tasks 3, 7). *Sound / hype / taglines* → **Leo** (tasks 5, 6). *Engineering / game feel / QA* → **Zeppelin** (tasks 2, 4, 8). That mirrors your real classes in `../../CREW.md`.
- The 🤖 swarm work itself is led by **whoever's on AI Ops rotation this Act** — they run the pipeline, the rest review the output.
- Anything *public-facing or hard to undo* → 🚦 human gate. Tasks 1, 2, 5, 7, 8.
- *Code that must actually run* → a human in the loop (name+S), because the agent drafts but a human verifies it works.
- *Subjective "is it fun / does it fit us"* judgment → stays with the crew.

### Step 2 — Run ONE task end-to-end through the swarm

Pick task #1 (or any swarm-routed task) and actually run it. Reuse Quest 9's pipeline:

```bash
cd project/swarm
python orchestrator.py   # or import and call run_pipeline with your task
```

Or, more deliberately, in a quick `python` session:

```python
from dotenv import load_dotenv; load_dotenv()
from orchestrator import run_pipeline

result = run_pipeline(
    "Decide the v1 power-up: pick one scoped idea that fits our core loop",
    pipeline=["designer", "critic"],   # idea, then poke holes — no code yet
)
# result["designer"] and result["critic"] are now your draft + critique.
```

### Step 3 — Apply the human gate

The task is 🚦. So **you** (a human) read the swarm's output and make the call: accept, reject, or revise. Then:
- Write the chosen, scoped result into `project/GAME.md`.
- Move task #1 from **Backlog** → **Done** in `TASKBOARD.md`.

You just orchestrated: decomposed → assigned to the swarm → got a handoff → checked it → applied a human gate → shipped it to the GDD. That's the entire loop, done for real.

> ⚔️ **Zeppelin (Vanguard):** when a 🚦 task is "code that must run" (task 2, 8), you're the gate. The coder agent drafts a Phaser snippet — but YOU paste it in, run it, and feel whether it's actually fun. An agent can't tell if a jump feels floaty. You can. That instinct is the gate the swarm doesn't have.

## 🎮 Build-the-Game Tie-In

Your `project/TASKBOARD.md` IS the tie-in — it's a living board for finishing the game, with **AI and humans both assigned**. Keep it open in every work session for the rest of the campaign. As you finish quests, tasks move Backlog → In Progress → Done. By Act 6 (launch) this board is your launch checklist. Commit it to git so the whole crew sees the same plan (you learned the Git team workflow in Quest 8 — branch, commit, PR it in).

## 💀 Boss Challenge (+50 XP)

**Build a Manager agent that writes the task breakdown FOR you (a planning agent).**

Instead of you decomposing the goal by hand, add a `manager` to your roster whose only job is: *given a goal, output a numbered task list.* This is the "manager + workers" pattern from Quest 9 made real.

Add to `project/swarm/agents.py`'s `ROSTER`:

```python
    "manager": (
        "You are a project MANAGER for a tiny indie game studio. Given a goal, "
        "output a numbered task list (max 8 tasks), smallest-first. For EACH "
        "task, on its own line, use EXACTLY this format:\n"
        "N. <task> | owner: <human|swarm> | produces: <thing> | gate: <yes|no>\n"
        "Mark gate: yes for anything public-facing, code that runs, or hard to "
        "undo. Be concrete. No preamble, no closing remarks."
    ),
```

Then add a planner to `orchestrator.py`:

```python
def plan(goal: str, max_tasks: int = 8) -> list[str]:
    """Manager agent turns a goal into a task list. Hard-capped for safety."""
    from agents import ask_agent

    raw = ask_agent("manager", f"Goal: {goal}")
    # Keep only real task lines, and ENFORCE the cap (never trust the model).
    tasks = [ln.strip() for ln in raw.splitlines() if ln.strip()[:2].rstrip(".").isdigit()]
    tasks = tasks[:max_tasks]   # MAX_STEPS-style guard: planning can't run away

    print(f"\n🧭 MANAGER's plan for: {goal}\n" + "=" * 60)
    for t in tasks:
        print(t)
    return tasks


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    plan("Ship a playable v1 of our browser game")
```

Run `python orchestrator.py`. The manager hands you a routed task list — which you paste into `TASKBOARD.md` (after a human sanity-check; the planner *drafts*, you *approve*). Note the `max_tasks` cap: even your planner gets a safety rail, just like `MAX_STEPS`.

## 🏆 Achievements

- [ ] 🧭 Studio Lead (+20 XP) — built `TASKBOARD.md` with real tasks, owners, and 🚦 gates.
- [ ] 🤝 Right Tool, Right Job (+15 XP) — correctly routed at least 6 tasks across swarm vs human with reasons.
- [ ] 🧠 Auto-Planner (+30 XP) — beat the Boss: a manager agent that outputs a capped, routed task list.

## 🎒 Loot (keep this forever)

**1) The orchestration / task-routing template** — your `TASKBOARD.md` format above. Reusable for ANY project: columns for Task, Owner (human vs agent), Produces, Done-when, and a Human-gate flag.

**2) The Human-in-the-Loop decision checklist** (print it, pin it):

> **A human must review/approve before shipping if ANY is true:**
> - 🔁 Hard to undo / could break things (Risk)
> - 💸 Spends money or burns serious quota (never loop an agent on cost)
> - 🎭 "Good" is subjective — taste / fun / brand (Judgment)
> - 🌍 Players or the public see it directly (Public-facing)
> - 🔐 Touches secrets, `.env`, accounts, or deploy (Security)
>
> **Default stance: agents draft & propose; humans decide & ship.**

Carry both into every project you ever run, game or not.

## ✅ Quest Complete

- [ ] Built `project/TASKBOARD.md` from real game work, with owners + 🚦 gates.
- [ ] Routed each task to a swarm agent, a crew member, or a human+agent pair — with reasons.
- [ ] Ran ONE task end-to-end through the swarm and applied the human gate (updated `GAME.md` + moved the task to Done).
- [ ] (Boss) Built a manager/planning agent that outputs a capped task breakdown.
- [ ] Logged your XP in [`../../CREW.md`](../../CREW.md). (+100, +50 if you beat the boss.)

## 🔭 Going Deeper / Side Quests

- Add **error handling** to `run_pipeline`: wrap the `ask_agent` call in `try/except`, print a friendly note, and continue. Real orchestrators survive a flaky API.
- Add a **retry-with-cap** helper (try a call up to 2 times on failure, then give up). Notice it's the same "never loop forever" guard, applied to errors instead of steps.
- Read the official docs for a real orchestration framework — search **LangGraph** (graph-based agent control flow) or **CrewAI** (role-based crews). Compare their concepts to your hand-rolled version; you'll find the same ideas with more machinery.
- Search **"Anthropic building effective agents"** (their engineering blog) — a well-known, accurate write-up on when to use a simple chain vs a multi-agent setup. Spoiler: simplest-thing-that-works wins.

## ➡️ Next

You've built agents, a swarm, and an orchestration plan with secrets and live accounts in the mix. Time to make sure none of it can be hijacked, leaked, or turned against you. → [Quest 11 — Security](../act5-security-audits/quest-11-security.md)
