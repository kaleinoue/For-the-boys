# Quest 05 — MCP: The Universal Adapter
> Act 2 · Give It Hands (Agents · Tool Use · MCP) • ~75–100 min • Reward: 100 XP + Achievement + Loot

**🎯 Mission:** Connect Claude Desktop to your real `For-the-boys` repo using MCP, so the AI can actually *read your project files* — then have it review your game design.
**🎒 Loadout:** Claude Desktop 🟢 (free) · your `For-the-boys` repo on disk · the official MCP docs at **[modelcontextprotocol.io](https://modelcontextprotocol.io)** · a text editor for one config file.
**⭐ XP on the line:** 100 base (+50 boss).

## 🤔 Why this Quest matters

In Quest 4 you hand-wrote every tool. That's powerful, but it doesn't scale — imagine rewriting a "read my files" tool from scratch for every AI app you ever use. MCP fixes that. It's the standard that lets AI apps plug into tools and data the same way every laptop charges off the same USB-C cable. After this quest, Claude won't be guessing about your project — it'll be **reading your actual repo**, summarizing your real `GAME.md`, and giving feedback on the game *you're actually building*. That's a different league of useful.

## 🧠 The Briefing

### What MCP is

**MCP = Model Context Protocol.** It's an **open standard**, created by **Anthropic**, that standardizes how AI apps connect to external tools and data.

> Think of it as a **USB-C port for AI.** Before USB-C, every device had its own weird plug. After, one standard port fits everything. MCP is that for AI ↔ tools/data.

The official home (and the source of truth for everything in this quest) is **[modelcontextprotocol.io](https://modelcontextprotocol.io)**. Bookmark it.

### MCP vs. the tools you hand-rolled in Quest 4

You already understand tools — you built three. MCP is the *standardized, shareable* version of that idea:

| | Your Quest 4 tools | MCP |
|---|---|---|
| Where they live | inside your one Python project | in separate, reusable **MCP servers** |
| Reusable elsewhere? | no — they're glued to your code | **yes** — any MCP-aware app can use the same server |
| Who can use them | only your `agent.py` | Claude Desktop, Cline, Cursor, your own apps... |
| Analogy | a custom-machined part | a standard USB-C device anyone can plug in |

So MCP isn't a *replacement* for understanding tools — it's the same brain-asks / code-runs idea from Quest 4, wrapped in a shared protocol so the tools become **plug-and-play across apps**. You learned the manual version first on purpose; now you'll see why a standard matters.

### The two roles: HOST and SERVER

Just two words to learn:

- **MCP host (or client)** — the AI app you're using. It speaks MCP and connects out to servers. **Claude Desktop is a free MCP host.** (So is Cline, the free VS Code extension — your backup if Claude Desktop won't run on your machine.)
- **MCP server** — a small program that *exposes* some capability: your filesystem, a database, the web. The host connects to it and can then use what it offers.

```
[ Claude Desktop ]  ←—— MCP ——→  [ filesystem server ]  ←——→  your For-the-boys/ files
     (HOST)                            (SERVER)
```

The classic first server everyone tries is the **filesystem server** — it lets the host read (and optionally write) files in folders you explicitly allow. That's exactly what we want: let Claude read your repo.

> 🤖 **Co-pilot tip:** You don't have to memorize MCP. Once it's connected, open claude.ai or Claude Desktop and ask *"explain MCP hosts vs servers like I'm 15, with one example."* Then ask it to explain the specific server you just installed. Let the AI teach you the thing you just gave it access to.

> ⚠️ **Real Talk — config details change, so trust the docs, not me.** MCP is young and moving fast: the exact config file location, the exact JSON keys, and the exact command to launch a server **do change between versions.** I'm going to show you the *shape* and the *steps* so you understand what you're doing — but for the **exact current values, follow the official quickstart at [modelcontextprotocol.io](https://modelcontextprotocol.io)** (look for "Connect to local servers" / the Desktop quickstart) and Anthropic's Claude Desktop docs. If something doesn't match what I describe, the docs win. Do not copy stale JSON from random blogs.

> ⚠️ **Real Talk — a filesystem server is real access.** You're giving an AI app permission to read files in a folder. Point it **only** at your `For-the-boys` repo, not your whole home directory, and definitely not at folders with passwords or your `.env`. (Your `.env` is gitignored, but the filesystem server doesn't care about `.gitignore` — it can still read a file if it's in an allowed folder. Keep secrets out of allowed folders.) We dig into this threat model in Quest 11.

## 🛠️ The Quest (do this now)

### 1. Install Claude Desktop 🟢

Download the free app from **[claude.ai/download](https://claude.ai/download)** (Mac/Windows) and sign in.

> **No Mac/Windows?** Use **Cline** (free VS Code extension) as your MCP host instead — it also supports MCP servers. The concepts are identical; the menu names differ. Check Cline's docs for where it stores MCP server config.

### 2. Find the config file (via the docs)

Claude Desktop stores its MCP servers in a JSON config file. The easiest reliable way to open it:

- In Claude Desktop, open **Settings → Developer → Edit Config** (this opens the file for you). The exact menu path can shift between versions — if you don't see it, search the official Claude Desktop / MCP quickstart for "claude_desktop_config.json" and where it lives on your OS.

This opens (or creates) a file commonly named `claude_desktop_config.json`. **Confirm the current name and location in the docs** — don't assume.

### 3. Understand the SHAPE of a server entry

Server entries live under an `mcpServers` object. Conceptually, each entry gives the server a name and tells Claude **how to launch it** — a command, some arguments (including which folder it's allowed to touch):

```jsonc
// THE SHAPE — not guaranteed-current values. Verify exact command/args/keys
// against modelcontextprotocol.io and the Claude Desktop quickstart.
{
  "mcpServers": {
    "filesystem": {
      "command": "<the launcher, e.g. an npx/uvx command from the docs>",
      "args": ["<filesystem server package per docs>", "/ABSOLUTE/PATH/TO/For-the-boys"]
    }
  }
}
```

What you're really saying: *"Hey Claude, there's a server called `filesystem`, launch it with this command, and let it work inside my `For-the-boys` folder."*

Key things to get right from the docs:
- the **exact command/package** to launch the official filesystem server,
- whether you need **Node.js** (`npx`) or **Python/uv** (`uvx`) installed first (the quickstart tells you),
- the **absolute path** to *your* repo — run `pwd` inside the `For-the-boys` folder to get it. Use the full path, not `~` or a relative path.

### 4. Save, fully restart Claude Desktop

MCP config is read at startup. **Quit Claude Desktop completely and reopen it** (not just close the window). After restart you should see an indicator that a tool/MCP connection is available (often a tools/plug icon near the chat box — the exact UI changes, so just look for "the filesystem server is connected"). If it's missing, your JSON has a typo or the command isn't installed — check the docs' troubleshooting.

### 5. Point it at your repo and ASK

Now the payoff. In Claude Desktop, try:

```
List the files in my For-the-boys repo.
```

Then:

```
Read project/GAME.md from my For-the-boys repo and summarize our game in 3 bullets.
```

Claude will ask permission to use the filesystem tool (approve it), then read your **real files** and answer about your **actual project**. The first time it reads a file *you* wrote and talks back about it, the lightbulb goes on: the AI is no longer guessing — it's grounded in your real work. *That's* MCP.

### Troubleshooting

- **No tools icon after restart** → JSON typo (missing comma/bracket) or the launch command isn't installed. Validate your JSON and re-check the install step in the docs.
- **"command not found"** → you're missing the runtime the server needs (Node/`npx` or Python/`uv`). Install it per the quickstart, restart Claude Desktop.
- **It can't see your files** → the path in `args` is wrong or relative. Use the absolute path from `pwd`. Also confirm you pointed it at the repo, not a parent folder you didn't mean to expose.

## 🎮 Build-the-Game Tie-In

Your AI can now **see your real studio.** Use it on the game:

```
Read project/GAME.md from my For-the-boys repo. As a senior game designer,
point out the 3 weakest parts of our design and suggest a concrete fix for each.
Be honest, not nice.
```

Because it's reading the *actual* GDD (not a paste, not a guess), the feedback is grounded in what you really wrote. Take the best suggestion and update `project/GAME.md`. You're now design-reviewing with an AI that has your real context — exactly how you'll lock the concept in Quest 6.

## 💀 Boss Challenge (+50 XP)

**Add a SECOND MCP server and use it.**

Pick another server from the **official servers list** (find it via [modelcontextprotocol.io](https://modelcontextprotocol.io) — there's a reference/servers collection). Good free choices:

- a **fetch / web** server — lets Claude pull a web page, so you can have it pull a competitor game's page and compare to your design (great prep for Quest 6 research), or
- a **sqlite** server — lets Claude query a local database (e.g. stash playtest scores later).

Steps: add a second entry under `mcpServers` (same shape as the filesystem one — command + args from that server's docs), fully restart Claude Desktop, then use it. For a fetch server:

```
Use the fetch server to read [some game/article URL], then compare its core
loop to our game in project/GAME.md.
```

If Claude uses **two different servers in one conversation**, you've grasped the real power of MCP: capabilities are modular, and you bolt on as many as you need.

> ⚠️ **Real Talk:** A **fetch/web server means the AI reads content from the open internet** — which can contain hidden instructions trying to hijack it (that's *prompt injection*, the big Quest 12 boss). For now just notice: the moment your AI reads untrusted web content, you've widened your attack surface. Stay aware.

## 🏆 Achievements

- [ ] 🔌 USB-C for AI (+15 XP) — connected Claude Desktop to your repo via the filesystem MCP server.
- [ ] 📖 Repo Reader (+20 XP) — got Claude to read your real `GAME.md` and summarize it.
- [ ] 🧩 Multi-Server (+25 XP) — beat the Boss: added a second server and used two in one conversation.

## 🎒 Loot (keep this forever)

**A working Claude-Desktop-with-MCP setup + the host/server mental model.** Keep this checklist — it's how you add *any* MCP server to *any* host, forever:

```
ADD AN MCP SERVER (the universal steps)
1. Pick a server from the official list (modelcontextprotocol.io).
2. Install whatever runtime it needs (Node/npx or Python/uv) per its docs.
3. Open the host's MCP config (Claude Desktop: Settings → Developer → Edit Config).
4. Add an entry under "mcpServers": a name + how to launch it (command + args).
   - Point any filesystem/data server ONLY at folders you mean to expose.
   - Never expose folders containing secrets / .env.
5. FULLY restart the host.
6. Confirm it connected, then ask the AI to use it.
ALWAYS get exact command/args/keys from the server's own docs — they change.
```

And the model: **Host (the AI app) + Server (the capability) connected over the MCP standard.** Tools you build by hand (Quest 4) live in your app; MCP servers are shareable across every app.

## ✅ Quest Complete

- [ ] Installed Claude Desktop (or set up Cline as host).
- [ ] Found the MCP config file via the official docs.
- [ ] Added the filesystem server pointed at your `For-the-boys` repo (absolute path).
- [ ] Restarted, confirmed the connection, and got Claude to **list your repo files**.
- [ ] Had Claude read and review your real `project/GAME.md`.
- [ ] (Optional) Beat the Boss: added and used a second MCP server.
- [ ] **Logged your XP in [`../../CREW.md`](../../CREW.md).**

## 🔭 Going Deeper / Side Quests

- **[modelcontextprotocol.io](https://modelcontextprotocol.io)** — read "Introduction" + the Desktop/quickstart guide. This is the canonical source; everything else is commentary.
- **The official servers list** — browse the reference servers (filesystem, fetch, sqlite, git, and more) linked from the MCP site. Each is a new superpower you can bolt on.
- **Build your own MCP server (advanced)** — the MCP docs have an SDK quickstart (Python and TypeScript). If Quest 4 clicked, you can turn your `roll_dice`/`save_idea` tool into a real MCP server other apps can use.
- **Cline** — search "Cline VS Code MCP" if you want MCP *inside* your editor as well.

## ➡️ Next

Act 2 is done — your AI can think, act, use tools, and read your real repo. Time to point all that power at the game itself: research the market, study what works, and **lock your concept**.
→ **[Quest 06 — Research & Lock the Concept](../act3-build/quest-06-research.md)**
