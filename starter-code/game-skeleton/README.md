# 🎮 Game Skeleton

A complete, working browser game in **one file** (`index.html`). Move a square
with the arrow keys, grab the coin, score goes up. That's it — and that's the
perfect seed to grow YOUR game from.

Built with **Phaser 3** (🟢 free, loads from a CDN — nothing to install).

## Run it (the easy way)
1. Open this folder in VS Code.
2. Right-click `index.html` → **"Open with Live Server"** (the free extension).
3. Play. Arrow keys to move.

(No Live Server? Just double-click `index.html` to open it in your browser.)

## The 3 functions that run every game

| Function | When it runs | What goes here |
|----------|--------------|----------------|
| `preload()` | once, at the start | load images/sounds |
| `create()` | once, when the game starts | make the player, enemies, score |
| `update()` | ~60×/second, forever | movement, collisions, the "game loop" |

Master these three and you can build almost anything 2D.

## Your move (in Act 3)
You'll use AI to turn this skeleton into your real game:
- swap the square for a sprite
- add enemies / obstacles / levels
- add a real goal, a fail state, sound, juice

> 🤖 **Co-pilot tip:** Paste this whole file into claude.ai and say: *"This is my
> Phaser game. Add an enemy that chases the player and ends the game on contact.
> Explain what you changed."* Then read the diff and learn from it. That's vibe
> coding done right — fast AND you understand it.

## Launching it (Act 6)
Because it's just HTML + JS, you can host it **free** on GitHub Pages or upload it
to itch.io. Quest 15 walks you through it. A real game, on the real internet, that
your friends can actually play.
