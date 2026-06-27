# 🤖 Agent Starter

This is the reference build of the agent you create across the campaign. Use it to
check your work or to get unstuck — but **type your own version first**. Reading
code teaches you nothing; writing it teaches you everything.

## What's here

| File | What it is | Built in |
|------|------------|----------|
| `llm.py` | The "brain" — the only file that talks to an AI provider | Quest 3 |
| `tools.py` | The "hands" — free tools the agent can call | Quest 4 |
| `agent.py` | The **agent loop** — think → act → observe → repeat | Quest 4 |
| `requirements.txt` | The Python packages you need | Quest 3 |
| `.env.example` | Template for your secret API key | Quest 3 |

## Run it (5 steps)

```bash
# 1. (optional but smart) make a clean Python environment
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. install the packages
pip install -r requirements.txt

# 3. set up your secret key
cp .env.example .env             # Windows: copy .env.example .env
#   ...then open .env and paste your free Gemini key in

# 4. test the brain
python llm.py                    # should print: the forge is lit

# 5. run the full agent
python agent.py
```

## How it works (the 30-second version)

The AI can only output **text**. So we make it output text in a strict format:

```
Thought: I should multiply these numbers.
Action: calculator
Action Input: 1984 / 16
```

Our `agent.py` *reads* that text, runs the real `calculator` function, and feeds
the result back as an `Observation:`. The AI then decides the next move. Loop
until it says `Final Answer:`. **That loop is the entire magic of agents.**

## ⚠️ Keep your key secret
`.env` holds your API key. It's listed in `.gitignore` so Git ignores it. Never
remove it from there. Never paste your key in chat. (Quest 11 = why this matters.)

## Swapping providers
Only `llm.py` knows about Gemini. To use Claude/Groq/anything, you rewrite *just
that one file's* `chat()` function. The rest of the agent doesn't care. That's the
power of keeping the changeable part in one place.
