// The ticket bot: mention it in #general with "create a ticket for Creative Mode" (and a description, if
// you like) and it opens a post in the bugs-and-enhancements forum, numbered after the last one
// ("[UI-26] Creative Mode"), with the description in the post, and replies with a link. See README.md.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { makeHandler } = require('./tickets');

// Settings from a .env file beside package.json (KEY=value lines), unless already set in the environment
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const CONFIG = {
  token: process.env.DISCORD_TOKEN,
  listen: (process.env.LISTEN_CHANNELS || 'general').split(',').map(s => s.trim()).filter(Boolean),   // names or ids
  forum: process.env.FORUM_CHANNEL || 'bugs-and-enhancements',                                        // name or id
  prefix: process.env.TICKET_PREFIX || 'UI',
};
if (!CONFIG.token || CONFIG.token === 'paste-your-bot-token-here') {
  console.error('Put your bot token in .env (DISCORD_TOKEN=...). See README.md.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.on(Events.MessageCreate, makeHandler(CONFIG, () => client.user));

client.once(Events.ClientReady, c => console.log(`Ticket bot ready as ${c.user.tag}: listening in #${CONFIG.listen.join(', #')}, posting to ${CONFIG.forum}`));
client.login(CONFIG.token).catch(err => { console.error(`Couldn't log in: ${err.message}. Is the token right, and is Message Content Intent turned on? (README.md)`); process.exit(1); });

// A tiny health page when a host wants a web port (e.g. a Render or Railway web service)
if (process.env.PORT) http.createServer((req, res) => { res.writeHead(client.isReady() ? 200 : 503); res.end(client.isReady() ? 'ok' : 'starting'); }).listen(process.env.PORT);
