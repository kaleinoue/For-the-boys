# 🃏 The Forge Cheatsheet

The one page you'll actually come back to. Bookmark it. Print it. Tattoo it.
(Don't tattoo it.)

---

## 🎯 The Prompt Recipe (R.A.C.E.)

Good prompts have four things. Miss one and you get mush.

- **R — Role:** Who should the AI be? *"You're a senior game designer..."*
- **A — Action:** What exactly do you want? *"...brainstorm 20 roguelike mechanics..."*
- **C — Context:** What does it need to know? *"...for a 2D browser game made by beginners, must be simple to code..."*
- **E — Expectations:** What should the output look like? *"...as a table with Mechanic | Why it's fun | Coding difficulty (1–5)."*

> Vague in = vague out. Specific in = gold out.

---

## 🔧 Power Moves

| Move | What it does | Magic words |
|------|--------------|-------------|
| **Give it a role** | Sets the expertise & tone | "You are a [expert]..." |
| **Show examples (few-shot)** | Teaches the format you want | "Here are 2 examples: ... Now do the same for ..." |
| **Think step by step** | Better reasoning on hard stuff | "Work through this step by step before answering." |
| **Set the format** | Get usable output | "Reply as JSON / a table / bullet points." |
| **Give it an out** | Stops it making things up | "If you're not sure, say so. Don't guess." |
| **Iterate** | Refine instead of restart | "Good, but make it shorter and funnier." |
| **Ask it to ask you** | Surfaces what it's missing | "Ask me 3 questions before you start." |

---

## 🤖 The Agent Loop (memorize this)

```
   ┌──────────────────────────────────┐
   │  1. THINK  → what should I do?    │
   │  2. ACT    → call a tool          │
   │  3. OBSERVE→ read the result      │
   │  4. repeat until done             │
   └──────────────────────────────────┘
```

A **chatbot** talks. An **agent** *acts* in a loop using **tools**. That's the
whole secret.

---

## 🧩 The Vocabulary (drop these and sound like a pro)

| Term | Plain meaning |
|------|---------------|
| **Token** | A chunk of text (~¾ of a word). Models read/write in tokens. |
| **Context window** | The model's short-term memory — how much it can "see" at once. |
| **System prompt** | The hidden instructions that set the AI's job & rules. |
| **Tool / function calling** | Letting the AI run code/actions, not just talk. |
| **Agent** | An AI that loops: think → use tools → observe → repeat. |
| **MCP** | Model Context Protocol — a universal plug for connecting AI to tools & data. |
| **Swarm** | Multiple agents working together, each with a job. |
| **Hallucination** | When the AI confidently makes something up. |
| **Prompt injection** | An attack: hiding instructions in data to hijack an AI. |
| **Temperature** | Randomness dial. Low = focused, high = creative/wild. |
| **RAG** | Giving the AI your documents to answer from (retrieval). |

---

## 🛡️ Security One-Liners (Quest 11–13)

- **Never** commit API keys. Use a `.env` file (and `.gitignore` it).
- **Never** trust AI output blindly — verify code, facts, and links.
- **Assume** any text the AI reads from the internet might be trying to hijack it.
- **Audit** before you ship: would this embarrass you / break / leak data?

---

## 🆘 When you're stuck (the unstick ritual)

1. **Read the actual error.** The answer is usually in it.
2. **Paste it into AI** with context: OS, what you were doing, full error.
3. **Ask for the *why*, not just the fix** — so you learn it.
4. **Rubber-duck it:** explain the problem out loud / to a crewmate.
5. **Still stuck after 20 min?** Tag a crewmate. Co-op, remember.

---

## 🚦 Cost Code

🟢 Free · 🟡 Free tier (watch limits, no card) · 🔴 Costs money (avoid; flagged)

➡️ Back to the **[README](README.md)**.
