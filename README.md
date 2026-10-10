# Ticket bot

Mention the bot in **#general** and it opens a numbered post in your **bugs-and-enhancements** forum:

```
@TicketBot create a ticket for Creative Mode
```

creates **[UI-26] Creative Mode** (one more than the highest `[UI-n]` already in the forum, open or
archived), and replies with a link to it.

### Writing a ticket

| You write | Title | Tag | Description in the post |
|---|---|---|---|
| `@bot create a ticket for Creative Mode` | Creative Mode | none | _No description given._ |
| `@bot create a bug ticket for Raft sinks: it goes under when two frogs sit on it` | Raft sinks | bugs | it goes under when two frogs sit on it |
| `@bot create a ticket for Pets, description: a frog that follows you around` | Pets | none | a frog that follows you around |
| `@bot create an enhancement ticket for Chairs with description decorative chairs` | Chairs | enhancement | decorative chairs |
| `@bot create a suggestion ticket for Pets - a frog that follows you` | Pets | suggestion | a frog that follows you |

A description can also go on the lines below the request (Shift+Enter in Discord):

```
@bot create a bug ticket for Raft sinks
Description: it goes under when two frogs sit on it,
and the frogs fall in the sea.
```

- **Tags:** the word before "ticket" sets the forum tag: `bug`, `enhancement` (or `feature`, `improvement`) or `suggestion` (or `idea`). It's matched to the forum's own tags (`bugs`, `enhancement`, `suggestion`).
- **Help:** `@bot help`, or anything the bot can't read as a ticket, gets a reply with these examples.
- **Who opened it:** each post ends with "Opened by @you" and a link back to your message.

## Setting it up (once, about 10 minutes)

You need [Node.js](https://nodejs.org) 20 or newer on whatever computer runs the bot.

### 1. Make the bot in Discord

1. Go to https://discord.com/developers/applications and click **New Application**. Name it (e.g. "TicketBot").
2. Open **Bot** on the left:
   - Click **Reset Token**, then copy the token. Keep it secret: anyone with it can control the bot.
   - Under **Privileged Gateway Intents**, turn on **Message Content Intent** and save. Without it the bot can't read what you wrote.
3. Open **OAuth2 → URL Generator**:
   - Under **Scopes**, tick `bot`.
   - Under **Bot Permissions**, tick View Channels, Send Messages, Send Messages in Threads, Create Public Threads, Read Message History and Embed Links.
   - Open the URL at the bottom, pick your server and click **Authorize**.

   Or use this link with your application's id (from **General Information**) in place of `YOUR_APP_ID`:
   `https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot&permissions=309237730304`

4. If the forum is private or limits who can post, give the bot's role access to **#general** and **#bugs-and-enhancements**.

### 2. Run it

```
cd ticket-bot
npm install
cp .env.example .env        (on Windows: copy .env.example .env)
```

Open `.env`, paste the token after `DISCORD_TOKEN=`, then:

```
npm start
```

It prints `Ticket bot ready as TicketBot#1234 ...` and shows as online in your server. It runs for as
long as that window stays open.

### Settings (`.env`)

| Setting | Default | What it does |
|---|---|---|
| `DISCORD_TOKEN` | — | The bot's token (required) |
| `LISTEN_CHANNELS` | `general` | Channels it listens in (names or ids, comma-separated) |
| `FORUM_CHANNEL` | `bugs-and-enhancements` | The forum channel it posts tickets in (name or id) |
| `TICKET_PREFIX` | `UI` | Numbers look like `[UI-26]` |

## Keeping it online all the time

A bot is only online while something is running it. Options:

- **A computer that stays on** (a home PC, a Raspberry Pi): run `npm start` there. [pm2](https://pm2.keymetrics.io) restarts it after a reboot: `npm i -g pm2 && pm2 start src/bot.js --name ticket-bot && pm2 save && pm2 startup`.
- **A host:** Railway, Fly.io or a Render **Background Worker**. Point it at this folder, with build command `npm install`, start command `npm start`, and `DISCORD_TOKEN` set as an environment variable (don't upload `.env`). A free Render **Web Service** also works, because the bot answers on `PORT` with a health page. But a free web service goes to sleep after 15 minutes without web visits, so it needs an uptime pinger (e.g. UptimeRobot) hitting its URL every few minutes.

## Checking it

`npm test` runs the tests for how it reads requests (titles, descriptions, tags, numbering). They don't need Discord.

## If something's wrong

- **The bot doesn't reply:** check that Message Content Intent is on (step 1.2), that you @mentioned the bot itself (not its role), and that you wrote in a channel listed in `LISTEN_CHANNELS`.
- **"I can't find a forum channel called ...":** set `FORUM_CHANNEL` to the forum's exact name, or to its id (right-click the channel → Copy Channel ID, with Developer Mode on in Discord's settings).
- **"Missing Permissions" / "Missing Access":** the bot's role needs to see the forum and be allowed to create posts in it.
