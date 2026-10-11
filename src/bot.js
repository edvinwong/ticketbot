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

// Say why it's stuck, if it is: Discord turning requests away (a 429, or Cloudflare's "error 1015" when this
// host's IP address is blocked, common on free shared hosts), connection drops, and the login steps until ready
client.rest.on('rateLimited', r => console.warn(`Discord rate limit: ${r.method} ${r.route}, retrying in ${Math.ceil(r.retryAfter / 1000)}s (${r.scope}${r.global ? ', global' : ''})`));
client.rest.on('response', (req, res) => { if (res.status === 429 || res.status >= 500) console.warn(`Discord answered ${res.status} ${res.statusText} to ${req.method} ${req.path}${res.status === 429 && !res.headers.get('x-ratelimit-scope') ? ' (no rate-limit headers: probably Cloudflare blocking this IP address)' : ''}`); });
client.on(Events.Debug, msg => { if (!client.isReady()) console.log(`[login] ${msg}`); });
client.on(Events.Warn, msg => console.warn(msg));
client.on(Events.Error, err => console.error(err));
client.on(Events.ShardDisconnect, (e, id) => console.warn(`Disconnected from Discord (shard ${id}, code ${e.code})`));
client.on(Events.ShardReconnecting, id => console.log(`Reconnecting to Discord (shard ${id})`));

// If it hasn't been connected for LOGIN_TIMEOUT seconds (default 120), quit, so the host starts it again
// (which may also give it a different IP address) instead of it sitting at "starting" forever
const timeout = (Number(process.env.LOGIN_TIMEOUT) || 120) * 1000;
let lastReady = Date.now();
setInterval(() => {
  if (client.isReady()) lastReady = Date.now();
  else if (Date.now() - lastReady > timeout) {
    console.error(`Not connected to Discord for ${timeout / 1000}s, restarting. If this keeps happening, Discord is probably blocking this host's IP address (see the rate-limit lines above).`);
    process.exit(1);
  }
}, 10000).unref();
client.login(CONFIG.token).catch(err => { console.error(`Couldn't log in: ${err.message}. Is the token right, and is Message Content Intent turned on? (README.md)`); process.exit(1); });

// A tiny health page when a host wants a web port (e.g. a Render or Railway web service)
if (process.env.PORT) http.createServer((req, res) => { res.writeHead(client.isReady() ? 200 : 503); res.end(client.isReady() ? 'ok' : 'starting'); }).listen(process.env.PORT);
