// Pure helpers for the WhatsApp relay — no dependencies, so they're testable.
// Given the Forge app's /api/quests (crew + ranks) and /api/state (xp), work out
// what changed and compose the messages to post.

function rankFor(xp, ranks) {
  let r = ranks[0];
  for (const x of ranks) if (xp >= x.min) r = x;
  return r;
}

// A compact snapshot of everyone's xp + rank, to diff against next poll.
function snapshot(meta, state) {
  const s = {};
  for (const c of meta.crew) {
    const m = state.crew[c.id];
    if (m) s[c.id] = { xp: m.xp || 0, rank: (m.rank && m.rank.name) || rankFor(m.xp || 0, meta.ranks).name };
  }
  return s;
}

// Compare previous snapshot to current state -> list of message strings.
function diffMessages(meta, prev, state) {
  const out = [];
  for (const c of meta.crew) {
    if (c.hidden) continue;                 // skip the Game Master
    const cur = state.crew[c.id];
    if (!cur) continue;
    const p = prev[c.id];
    if (!p) continue;                       // no baseline yet -> don't spam on first run
    const curXp = cur.xp || 0;
    if (curXp > p.xp) {
      const gain = curXp - p.xp;
      const rank = (cur.rank && cur.rank.name) || rankFor(curXp, meta.ranks).name;
      const emoji = (cur.rank && cur.rank.emoji) || rankFor(curXp, meta.ranks).emoji;
      if (rank !== p.rank)
        out.push(`🎉 *${c.name}* ${c.emoji} LEVELED UP → *${emoji} ${rank}*!  (+${gain} XP · total ${curXp})`);
      else
        out.push(`${c.emoji} *${c.name}* cleared a trial!  +${gain} XP · total ${curXp}`);
    }
  }
  return out;
}

// Leaderboard text, for a "!standings" command.
function standingsText(meta, state) {
  const rows = meta.crew.filter(c => !c.hidden).map(c => ({ c, m: state.crew[c.id] }))
    .filter(r => r.m).sort((a, b) => (b.m.xp || 0) - (a.m.xp || 0));
  return '🏆 *THE FORGE — Standings*\n' + rows.map((r, i) =>
    `${i + 1}. ${r.c.emoji} ${r.c.name} — ${(r.m.rank && r.m.rank.emoji) || ''} ${(r.m.rank && r.m.rank.name) || ''} · ${r.m.xp || 0} XP`
  ).join('\n');
}

module.exports = { rankFor, snapshot, diffMessages, standingsText };
