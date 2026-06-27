"""
tools.py — the agent's HANDS.

A "tool" is just a Python function the AI is allowed to call. That's the entire
trick behind agents: the model decides *which* function to run and *what* to pass
it, your code actually runs it, and you feed the result back.

Every tool here is FREE and needs NO API key. Add your own in Quest 4!

Each tool: takes a single string `arg`, returns a string result.
"""

from __future__ import annotations

import datetime
import urllib.parse
import urllib.request
import json


def calculator(arg: str) -> str:
    """Do math. Example arg: '2 * (3 + 4)'. Only digits and + - * / ( ) . allowed."""
    allowed = set("0123456789+-*/(). ")
    if not set(arg) <= allowed:
        return "Error: only numbers and + - * / ( ) are allowed."
    try:
        return str(eval(arg, {"__builtins__": {}}, {}))  # safe: input is filtered above
    except Exception as e:
        return f"Error: {e}"


def get_time(arg: str) -> str:
    """Return the current date and time. Ignores its argument."""
    return datetime.datetime.now().strftime("%A, %d %B %Y, %H:%M")


def wikipedia(arg: str) -> str:
    """Look something up on Wikipedia (free, no API key). arg = search term."""
    try:
        title = urllib.parse.quote(arg.strip().replace(" ", "_"))
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
        req = urllib.request.Request(url, headers={"User-Agent": "ForgeAgent/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
        extract = data.get("extract")
        return extract or f"No Wikipedia summary found for '{arg}'."
    except Exception as e:
        return f"Error looking that up: {e}"


# The registry: name -> function. The agent reads this to know what it can do.
# The text after the colon (the docstring) is what we tell the AI about each tool.
TOOLS = {
    "calculator": calculator,
    "get_time": get_time,
    "wikipedia": wikipedia,
}


def tool_descriptions() -> str:
    """Build the menu of tools we hand to the AI in the system prompt."""
    lines = []
    for name, fn in TOOLS.items():
        doc = (fn.__doc__ or "").strip().split("\n")[0]
        lines.append(f"- {name}: {doc}")
    return "\n".join(lines)
