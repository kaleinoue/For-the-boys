"""
llm.py — the "brain" wire.

This is the ONLY file that talks to an AI provider. Everything else in the agent
is provider-agnostic. Want to swap Gemini for Claude, Groq, or anything else?
You only change this one file. That's good design — keep the thing that might
change isolated.

Default: Google Gemini via the free AI Studio API key (no credit card).
Get a key at https://aistudio.google.com  ->  "Get API key".
"""

from __future__ import annotations

import os

from google import genai  # pip install google-genai

# If this model name ever errors, open Google AI Studio and check the current
# free model names — Google renames them now and then. This is normal.
MODEL = os.environ.get("FORGE_MODEL", "gemini-2.0-flash")


def _client() -> genai.Client:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise SystemExit(
            "No GEMINI_API_KEY found.\n"
            "1) Get a free key at https://aistudio.google.com\n"
            "2) Copy .env.example to .env and paste your key in\n"
            "3) Make sure you ran:  pip install -r requirements.txt python-dotenv\n"
        )
    return genai.Client(api_key=key)


def chat(messages: list[dict], system: str | None = None) -> str:
    """Send a conversation, get back the AI's text reply.

    `messages` is a list like: [{"role": "user", "content": "hi"}].
    Roles are "user" or "assistant". We keep it dead simple on purpose.
    """
    client = _client()

    # Gemini calls the assistant role "model". Translate our simple format.
    contents = []
    for m in messages:
        role = "model" if m["role"] == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    config = {}
    if system:
        config["system_instruction"] = system

    resp = client.models.generate_content(
        model=MODEL,
        contents=contents,
        config=config or None,
    )
    return (resp.text or "").strip()


if __name__ == "__main__":
    # Quick smoke test: python llm.py
    from dotenv import load_dotenv

    load_dotenv()
    print(chat([{"role": "user", "content": "Say 'the forge is lit' and nothing else."}]))
