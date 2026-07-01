// =============================================================================
//  THE FORGE — WhatsApp relay (UNOFFICIAL; runs on YOUR computer)
//
//  Watches your live Forge app and posts crew updates into a WhatsApp group,
//  by linking as a device on YOUR WhatsApp account (you scan a QR from your
//  phone once). Runs only while this process + your computer are on.
//
//  ⚠️ This automates a normal WhatsApp account, which is against WhatsApp's
//     terms. There is a (small but real) risk the number gets limited/banned.
//     You accepted this. Keep the message volume low/human.
//
//  Run:  npm install   then   node relay.js
// =============================================================================

const fs = require('fs');
const path = require('path');
(function loadEnv() {           // minimal .env loader (no dependency)
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env — use defaults/prompts below */ }
})();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { snapshot, diffMessages, standingsText } = require('./logic');

const FORGE_URL = (process.env.FORGE_URL || 'https://the-forge-yy5i.onrender.com').replace(/\/$/, '');
const GROUP = process.env.WHATSAPP_GROUP || '';           // exact group name to post into
const POLL_MS = Number(process.env.POLL_MS || 45000);     // how often to check for changes

const fetchJson = (p) => fetch(FORGE_URL + p).then(r => r.json());

const client = new Client({
  authStrategy: new LocalAuth(),        // remembers the login so you scan once
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

client.on('qr', (qr) => {
  console.log('\n📱 Link this relay: on your phone open WhatsApp → Settings → Linked Devices → Link a device → scan:\n');
  qrcode.generate(qr, { small: true });
});

client.on('auth_failure', (m) => console.error('Auth failed:', m));
client.on('disconnected', (r) => console.error('Disconnected:', r, '— restart with `node relay.js`.'));

client.on('ready', async () => {
  console.log('✅ WhatsApp linked.');
  const chats = await client.getChats();
  const groups = chats.filter(c => c.isGroup);
  const group = groups.find(g => g.name === GROUP);
  if (!group) {
    console.log(`\n❌ Couldn't find a group named "${GROUP}". Set WHATSAPP_GROUP in .env to one of these exact names:`);
    groups.forEach(g => console.log('   •', g.name));
    return;
  }
  console.log(`📢 Posting Forge updates to group: "${group.name}"`);

  const meta = await fetchJson('/api/quests');
  let last = snapshot(meta, await fetchJson('/api/state'));
  console.log(`👀 Watching ${FORGE_URL} every ${POLL_MS / 1000}s. (No spam on first run — baseline set.)`);

  // Answer "!standings" / "!forge" in the group with the leaderboard.
  client.on('message', async (msg) => {
    const body = (msg.body || '').trim().toLowerCase();
    if (body === '!standings' || body === '!forge') {
      try { await msg.reply(standingsText(meta, await fetchJson('/api/state'))); } catch (e) { console.error(e.message); }
    }
  });

  // Poll for XP/level changes and post them.
  setInterval(async () => {
    try {
      const state = await fetchJson('/api/state');
      const msgs = diffMessages(meta, last, state);
      last = snapshot(meta, state);
      for (const text of msgs) { await group.sendMessage(text); console.log('→ posted:', text.replace(/\n/g, ' ')); }
    } catch (e) { console.error('poll error:', e.message); }
  }, POLL_MS);
});

client.initialize();
