# 🧰 The Free AI Toolbox

Everything in this campaign is built to run on **free tools**. This page is the
master list. Bookmark it.

## 🚦 The Cost Code

Every tool you'll touch is tagged:

- 🟢 **FREE** — genuinely free, no card, no catch.
- 🟡 **FREE TIER** — free up to a limit (requests/day, etc.). Fine for learning.
  Just watch your usage. **No credit card required** for the ones we use.
- 🔴 **COSTS MONEY** — we *avoid* these in the core campaign. If a Quest ever
  suggests one, it's clearly optional and flagged. **Never enter a credit card
  without checking with whoever's funding this.**

> **Real Talk:** "Free tier" companies hope you'll eventually pay. That's a fair
> trade — but it means limits can change. If a free tier disappears or a tool
> wants a card, stop and check the current alternatives below. The *skills* you
> learn transfer to any tool; the specific tool doesn't matter.

---

## 🎒 Your Core Loadout

### 1. claude.ai 🟡 FREE TIER
- **What:** Claude, in your browser. Your main thinking/prompting partner.
- **Use it for:** Acts 1, 3, 6 — prompting, design docs, research, writing.
- **Get it:** [claude.ai](https://claude.ai) — sign up free. Free plan has daily
  message limits; if you hit them, switch to Google AI Studio (below) and come
  back later.

### 2. Google AI Studio (Gemini API) 🟡 FREE TIER — *no credit card*
- **What:** A free API key for Google's Gemini models. This is what powers the
  **code** we write (agents, tool use, swarms).
- **Why this one:** Most "build an agent" tutorials need a paid API key. Google
  AI Studio gives you a real API key on a **free tier with no card required** —
  perfect for learning.
- **Use it for:** Acts 2, 4, 5 — every Python agent we build.
- **Get it:** [aistudio.google.com](https://aistudio.google.com) → "Get API key".
  Keep that key secret (Quest 11 explains why in blood).

### 3. Claude Desktop 🟢 FREE
- **What:** The Claude desktop app (Mac/Windows). The easiest free way to play
  with **MCP** (the thing that gives AI superpowers — Quest 5).
- **Get it:** [claude.ai/download](https://claude.ai/download)

### 4. VS Code 🟢 FREE
- **What:** The code editor you'll write everything in.
- **Get it:** [code.visualstudio.com](https://code.visualstudio.com)
- **Add these free extensions:** Python, Live Server (for testing your game).

### 5. Python 3.11+ 🟢 FREE
- **What:** The language our agents are written in.
- **Get it:** [python.org/downloads](https://python.org/downloads). On Mac you
  may already have it (`python3 --version`).

### 6. Git + GitHub 🟢 FREE
- **What:** How your crew shares code without emailing zip files like cavemen.
  Also how you'll **launch** your game for free.
- **Get it:** [git-scm.com](https://git-scm.com) + a free account at
  [github.com](https://github.com).

### 7. Phaser 3 🟢 FREE
- **What:** A free JavaScript game framework. Runs in any browser. No install —
  it loads from a CDN link in your HTML.
- **Docs:** [phaser.io](https://phaser.io)

### 8. itch.io 🟢 FREE (for launch)
- **What:** The indie game site where you'll publish your game in Act 6. Free to
  upload, free to play, instant audience.
- **Get it:** [itch.io](https://itch.io) (you'll also use **GitHub Pages**, free).

---

## 🔁 Backup Options (if a free tier runs out)

| If this runs out... | Swap to this 🟡/🟢 |
|---------------------|---------------------|
| claude.ai messages | Google AI Studio chat, or Gemini in browser |
| Gemini API limits | [Groq](https://console.groq.com) (free API key, very fast), [OpenRouter](https://openrouter.ai) free models |
| Claude Desktop (no Win/Mac) | Run MCP via [Cline](https://github.com/cline/cline) (free VS Code extension) |

All the **code** we write is provider-swappable — change a few lines and it runs
on a different model. We'll show you how in Quest 3.

---

## 🔴 Stuff we deliberately DON'T require

- Paid ChatGPT Plus / Claude Pro (nice, not needed)
- Paid API credits (we use free tiers)
- Paid game engines or asset packs (we make our own / use free assets)
- Any tool that demands a credit card to start

If you *want* to upgrade later and someone's funding it — great, everything here
works better with paid keys. But you can finish the entire campaign for **$0**.

➡️ Back to **[Setup](00-setup.md)** or the **[README](../README.md)**.
