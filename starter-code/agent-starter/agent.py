"""
agent.py — THE AGENT LOOP.

This is the heart of everything. A chatbot just talks. An *agent* runs a loop:

    THINK  -> decide what to do
    ACT    -> call a tool
    OBSERVE-> read what came back
    repeat until it has the answer

We make the AI follow a strict text format so our code can read its decisions.
It's a teaching version — simple enough to read top to bottom, real enough to
actually work. Run it:  python agent.py

Build order in the campaign:
  Quest 3 = llm.py (just the brain / chat)
  Quest 4 = tools.py + this loop (the brain gets HANDS)
  Quest 9 = many of these agents working together (the swarm)
"""

from __future__ import annotations

from dotenv import load_dotenv

from llm import chat
from tools import TOOLS, tool_descriptions

load_dotenv()

MAX_STEPS = 6  # safety rail: never loop forever (and never burn your free quota)

SYSTEM = f"""You are a helpful agent that can use tools to answer questions.

You have these tools:
{tool_descriptions()}

To use a tool, reply in EXACTLY this format and nothing else:
Thought: <your reasoning>
Action: <one tool name from the list above>
Action Input: <what to pass the tool>

When you have the final answer, reply in EXACTLY this format:
Thought: <your reasoning>
Final Answer: <your answer to the user>

Rules:
- Use ONE action at a time, then wait for the Observation.
- Only use tools from the list. Never invent a tool.
- If a tool result answers the question, give the Final Answer.
"""


def parse(text: str) -> tuple[str, str]:
    """Pull the (kind, value) out of the model's reply.

    Returns ("final", answer) or ("action", "tool|input") or ("none", raw).
    """
    action = action_input = final = None
    for line in text.splitlines():
        low = line.lower()
        if low.startswith("action:"):
            action = line.split(":", 1)[1].strip()
        elif low.startswith("action input:"):
            action_input = line.split(":", 1)[1].strip()
        elif low.startswith("final answer:"):
            final = line.split(":", 1)[1].strip()
    if final is not None:
        return "final", final
    if action is not None:
        return "action", f"{action}|{action_input or ''}"
    return "none", text


def run(question: str) -> str:
    print(f"\n🧑 You: {question}\n")
    messages = [{"role": "user", "content": question}]

    for step in range(1, MAX_STEPS + 1):
        reply = chat(messages, system=SYSTEM)
        kind, value = parse(reply)

        if kind == "final":
            print(f"🤖 Agent (step {step}) → FINAL: {value}\n")
            return value

        if kind == "action":
            name, arg = value.split("|", 1)
            print(f"🤖 Agent (step {step}) → thinking, wants tool: {name}({arg!r})")
            fn = TOOLS.get(name)
            observation = fn(arg) if fn else f"Error: no tool named '{name}'."
            print(f"   🔧 Observation: {observation}\n")
            # Feed the agent's own move + the result back so it can keep going.
            messages.append({"role": "assistant", "content": reply})
            messages.append({"role": "user", "content": f"Observation: {observation}"})
            continue

        # Model didn't follow the format — just return what it said.
        print(f"🤖 Agent (step {step}) → (no tool) {reply}\n")
        return reply

    return "I hit my step limit without finishing. Try a simpler question."


if __name__ == "__main__":
    # Try these, then write your own:
    run("What is 1984 divided by 16, and what happened in the year you get?")
    # run("What day of the week is it, and tell me one fact about octopuses.")
