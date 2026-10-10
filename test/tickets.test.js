// The bot's message handling (src/tickets.js) against stand-ins for Discord: a #general, a forum with posts
// and tags, and messages. Checks what it posts, where, with which number, tag and description.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ChannelType } = require('discord.js');
const { makeHandler } = require('../src/tickets');

const BOT = { id: '111', username: 'TicketBot' };
const CONFIG = { listen: ['general'], forum: 'bugs-and-enhancements', prefix: 'UI' };

// A forum holding posts (some archived), its tags, and what gets created in it
function fakeServer({ active = [], archived = [], noForum = false } = {}) {
  const created = [];
  const list = names => { const m = new Map(names.map((n, i) => [String(i), { id: String(i), name: n }])); m.last = () => [...m.values()].pop(); return m; };
  const forum = {
    id: 'f1', name: 'bugs-and-enhancements', type: ChannelType.GuildForum,
    availableTags: [{ id: 't-bug', name: 'bugs' }, { id: 't-enh', name: 'enhancement' }, { id: 't-sug', name: 'suggestion' }],
    threads: {
      fetchActive: async () => ({ threads: list(active) }),
      fetchArchived: async () => ({ threads: list(archived), hasMore: false }),
      create: async opts => { created.push(opts); return { url: `https://discord.com/channels/g/${opts.name}` }; },
    },
  };
  const channels = noForum ? [] : [forum];
  const guild = { channels: { cache: { find: fn => channels.find(fn) } } };
  return { guild, created };
}

function fakeMessage(guild, content, { channel = 'general', mentionsBot = true, bot = false } = {}) {
  const replies = [];
  return {
    content, guild, url: 'https://discord.com/channels/g/general/m1',
    author: { bot, toString: () => '<@user9>' },
    channel: { id: 'c-' + channel, name: channel },
    mentions: { users: new Map(mentionsBot ? [[BOT.id, BOT]] : []) },
    reply: async text => { replies.push(text); },
    replies,
  };
}

const handler = () => makeHandler(CONFIG, () => BOT);

test('"@bot create a ticket for Creative Mode" opens [UI-26] Creative Mode, after the highest number there', async () => {
  const { guild, created } = fakeServer({ active: ['[UI-25] Chairs', '[UI-24] Fishing animation'], archived: ['[UI-8] Model enhancements'] });
  const msg = fakeMessage(guild, '<@111> create a ticket for Creative Mode');
  await handler()(msg);
  assert.equal(created.length, 1);
  assert.equal(created[0].name, '[UI-26] Creative Mode');
  assert.deepEqual(created[0].appliedTags, []);
  assert.match(created[0].message.content, /No description given/);
  assert.match(created[0].message.content, /Opened by <@user9> from https:\/\/discord\.com\/channels\/g\/general\/m1/);
  assert.match(msg.replies[0], /Created \*\*\[UI-26\] Creative Mode\*\*: https:/);
});

test('the description goes in the post, and the tag is set', async () => {
  const { guild, created } = fakeServer({ active: ['[UI-3] x'] });
  await handler()(fakeMessage(guild, '<@111> create a bug ticket for Raft sinks\nDescription: it goes under when two frogs sit on it'));
  assert.equal(created[0].name, '[UI-4] Raft sinks');
  assert.deepEqual(created[0].appliedTags, ['t-bug']);
  assert.match(created[0].message.content, /^it goes under when two frogs sit on it\n/);
});

test('the numbers come from archived posts too, and two quick tickets get different numbers', async () => {
  const { guild, created } = fakeServer({ active: ['[UI-2] a'], archived: ['[UI-30] old one'] });
  const h = handler();
  // (the stand-in forum doesn't learn its new posts, so feed them back the way Discord would)
  const forumThreads = guild.channels.cache.find(() => true).threads, fetch = forumThreads.fetchActive;
  forumThreads.fetchActive = async () => { const r = await fetch(); created.forEach((c, i) => r.threads.set('n' + i, { id: 'n' + i, name: c.name })); return r; };
  await Promise.all([h(fakeMessage(guild, '<@111> create a ticket for One')), h(fakeMessage(guild, '<@111> create a ticket for Two'))]);
  assert.deepEqual(created.map(c => c.name), ['[UI-31] One', '[UI-32] Two']);
});

test('only when mentioned, only in #general, never for other bots', async () => {
  const { guild, created } = fakeServer();
  const h = handler();
  await h(fakeMessage(guild, 'create a ticket for Nope', { mentionsBot: false }));
  await h(fakeMessage(guild, '<@111> create a ticket for Nope', { channel: 'random' }));
  await h(fakeMessage(guild, '<@111> create a ticket for Nope', { bot: true }));
  assert.equal(created.length, 0);
});

test('anything that isn\'t a ticket gets the help; a missing forum says so', async () => {
  const s1 = fakeServer(), m1 = fakeMessage(s1.guild, '<@111> hello');
  await handler()(m1);
  assert.match(m1.replies[0], /create a ticket for Creative Mode/);
  assert.equal(s1.created.length, 0);
  const s2 = fakeServer({ noForum: true }), m2 = fakeMessage(s2.guild, '<@111> create a ticket for X');
  await handler()(m2);
  assert.match(m2.replies[0], /can't find a forum channel called \*\*bugs-and-enhancements\*\*/);
});
