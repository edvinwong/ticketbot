// What the bot does with a message: the help, or a new numbered post in the forum. Given the Discord
// objects, so it can be tried against stand-ins (test/tickets.test.js) as well as the real thing (bot.js).
const { ChannelType } = require('discord.js');
const { parseRequest, nextNumber, ticketTitle, findTag } = require('./parse');

const HELP = [
  'Tell me what the ticket is for, like this:',
  '• `@me create a ticket for Creative Mode`',
  '• `@me create a bug ticket for Raft sinks: it goes under when two frogs sit on it`',
  '• `@me create a ticket for Pets, description: a frog that follows you around`',
  '• `@me create an enhancement ticket for Chairs` and the description on the next lines',
  '• `@me create ticket`, then `Title: ...`, `Tag: bug` and `Description:` on the next lines, with points below it (`- like this`)',
  'A word before "ticket" (bug, enhancement, suggestion) sets its tag. The description can come after `description:`, a `:`, a ` - `, or on the lines below.',
].join('\n');

const matches = (ch, list) => list.some(x => x === ch.id || x.toLowerCase() === ch.name.toLowerCase());

// Every post's title in the forum, open and archived, to number the next one
async function allTitles(forum) {
  const names = [];
  const active = await forum.threads.fetchActive();
  active.threads.forEach(t => names.push(t.name));
  let before;
  for (let page = 0; page < 20; page++) {   // (100 a page: 2000 archived posts is plenty)
    const res = await forum.threads.fetchArchived({ type: 'public', limit: 100, before });
    res.threads.forEach(t => names.push(t.name));
    if (!res.hasMore || !res.threads.size) break;
    before = res.threads.last().id;
  }
  return names;
}

// The message handler. CONFIG: { listen, forum, prefix }; me(): the bot's own user, once logged in.
function makeHandler(CONFIG, me) {
  const forumOf = guild => guild.channels.cache.find(c => c.type === ChannelType.GuildForum && (c.id === CONFIG.forum || c.name.toLowerCase() === CONFIG.forum.toLowerCase())) || null;
  let queue = Promise.resolve();   // one ticket at a time, so two quick requests never get the same number
  const oneAtATime = fn => (queue = queue.then(fn, fn));
  async function createTicket(message, req) {
    const forum = forumOf(message.guild);
    if (!forum) return message.reply(`I can't find a forum channel called **${CONFIG.forum}**.`);
    const n = nextNumber(await allTitles(forum), CONFIG.prefix);
    const name = ticketTitle(n, req.title, CONFIG.prefix);
    const tag = findTag(forum.availableTags, req.tag);
    const content = [req.body || '_No description given._', '', `Opened by ${message.author} from ${message.url}`].join('\n').slice(0, 2000);
    const thread = await forum.threads.create({ name, message: { content }, appliedTags: tag ? [tag.id] : [] });
    return message.reply(`Created **${name}**${tag ? ` (${tag.name})` : ''}: ${thread.url}`);
  }
  return async message => {
    try {
      const user = me();
      if (message.author.bot || !message.guild || !user) return;
      if (!message.mentions.users.has(user.id)) return;
      if (!matches(message.channel, CONFIG.listen)) return;
      const req = parseRequest(message.content, user.username);
      if (!req || req.help) return void message.reply(HELP);
      await oneAtATime(() => createTicket(message, req));
    } catch (err) {
      console.error(err);
      return message.reply(`Sorry, I couldn't create that ticket (${err.message}). Check that I can see the forum and create posts in it.`).catch(() => {});
    }
  };
}

module.exports = { makeHandler, HELP };

