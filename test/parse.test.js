// The Discord ticket bot's words (src/parse.js): what a message asks for, and how tickets are numbered.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseRequest, nextNumber, ticketTitle, findTag } = require('../src/parse');

test('"create a ticket for X" gives a ticket titled X', () => {
  assert.deepEqual(parseRequest('<@123> create a ticket for Creative Mode'), { title: 'Creative Mode', body: '', tag: null });
  assert.deepEqual(parseRequest('<@!123> Create a ticket for creative mode.'), { title: 'Creative mode', body: '', tag: null });
  assert.equal(parseRequest('<@123> can you make a ticket about the raft sinking').title, 'The raft sinking');
  assert.equal(parseRequest('<@123> new ticket: Chairs').title, 'Chairs');
  assert.equal(parseRequest('<@123> ticket Chairs').title, 'Chairs');
});

test('a word before "ticket" sets the tag; details after a colon, a dash or a new line go in the post', () => {
  assert.deepEqual(parseRequest('<@1> create a bug ticket for Raft sinks: it goes under when two frogs sit on it'),
    { title: 'Raft sinks', body: 'it goes under when two frogs sit on it', tag: 'bugs' });
  assert.deepEqual(parseRequest('<@1> new enhancement ticket for Chairs - decorative chairs to sit on'),
    { title: 'Chairs', body: 'decorative chairs to sit on', tag: 'enhancement' });
  assert.equal(parseRequest('<@1> create a suggestion ticket for Pets').tag, 'suggestion');
  assert.deepEqual(parseRequest('<@1> create a ticket for Fishing animation\nshow other players reeling in'),
    { title: 'Fishing animation', body: 'show other players reeling in', tag: null });
});

test('anything else addressed to the bot gets the help', () => {
  assert.deepEqual(parseRequest('<@1>'), { help: true });
  assert.deepEqual(parseRequest('<@1> help'), { help: true });
  assert.deepEqual(parseRequest('<@1> hello there'), { help: true });
  assert.deepEqual(parseRequest('<@1> create a ticket'), { help: true });
});

test('tickets are numbered after the highest one in the forum', () => {
  const titles = ['[UI-25] Chairs', '[UI-24] Fishing animation', '[UI-8] Model enhancements', 'A post without a number', '[ui-3] lower case'];
  assert.equal(nextNumber(titles), 26);
  assert.equal(nextNumber([]), 1);
  assert.equal(ticketTitle(26, 'Creative Mode'), '[UI-26] Creative Mode');
  assert.ok(ticketTitle(7, 'x'.repeat(200)).length <= 100, 'Discord thread names are at most 100 characters');
});

test("the tag is matched to the forum's own tags", () => {
  const tags = [{ id: 'a', name: 'bugs' }, { id: 'b', name: 'enhancement' }, { id: 'c', name: 'suggestion' }];
  assert.equal(findTag(tags, 'bugs').id, 'a');
  assert.equal(findTag(tags, 'suggestion').id, 'c');
  assert.equal(findTag(tags, null), null);
});

test('the description: after "description", or on the lines below', () => {
  assert.deepEqual(parseRequest('<@1> create a ticket for Pets, description: a frog that follows you around'),
    { title: 'Pets', body: 'a frog that follows you around', tag: null });
  assert.deepEqual(parseRequest('<@1> create a ticket for Pets with description a frog that follows you around'),
    { title: 'Pets', body: 'a frog that follows you around', tag: null });
  assert.deepEqual(parseRequest('<@1> create an enhancement ticket for Pets desc - a frog that follows you'),
    { title: 'Pets', body: 'a frog that follows you', tag: 'enhancement' });
  assert.deepEqual(parseRequest('<@1> create a bug ticket for Raft sinks\nDescription: it goes under\nwhen two frogs sit on it'),
    { title: 'Raft sinks', body: 'it goes under when two frogs sit on it', tag: 'bugs' });
  assert.deepEqual(parseRequest('<@1> create a ticket for Chairs: decorative chairs\nwith cushions'),
    { title: 'Chairs', body: 'decorative chairs\nwith cushions', tag: null });
});

test('"details" or "description" inside a title stays in the title', () => {
  assert.deepEqual(parseRequest('<@1> create a bug ticket for Fix details page'), { title: 'Fix details page', body: '', tag: 'bugs' });
  assert.deepEqual(parseRequest('<@1> create a ticket for Item descriptions are cut off'), { title: 'Item descriptions are cut off', body: '', tag: null });
});
