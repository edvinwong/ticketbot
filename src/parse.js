// The ticket bot's words: what a message asks for, and the ticket's title and description. No Discord
// here, so it can be tested on its own (npm test).

// Tags on the forum channel, and the words that pick each one ("a bug ticket for ...").
const TAG_WORDS = {
  bugs: ['bug', 'bugs', 'broken', 'fix'],
  enhancement: ['enhancement', 'enhancements', 'improvement', 'feature'],
  suggestion: ['suggestion', 'suggestions', 'idea'],
};

const clean = s => s.replace(/\s+/g, ' ').trim();
// "..., description: ...", "... with description ...", "... desc - ...", "... details: ..." (but not a title
// like "Fix details page": the word needs a comma or "with" before it, or a ":" or "-" after it)
const DESC_A = /^(.*?)\s*(?:[,;.]\s*|\s+(?:with|and)\s+(?:the\s+|a\s+)?)(?:description|desc|details?)\b\s*(?:is\b|[:=-])?\s*(.+)$/i;
const DESC_B = /^(.*?)\s+(?:description|desc|details?)\s*[:=-]\s*(.+)$/i;
const DESC_LEAD = /^(?:description|desc|details?)\s*[:=-]\s*/i;

// Strip Discord mentions (<@123>, <@!123>, <@&123>) and the bot's own name if typed as plain text.
function stripMentions(text, botName) {
  let t = text.replace(/<@[!&]?\d+>/g, ' ');
  if (botName) t = t.replace(new RegExp(`^\\s*@?${botName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), ' ');
  return t;
}

// What a message asks for: { title, body, tag } for a new ticket (body: its description, or ''), or
// { help: true } when it's addressed to the bot but doesn't ask for one.
//   "create a ticket for Creative Mode"
//   "create a bug ticket for Raft sinks: it goes under when two frogs sit on it"
//   "new enhancement ticket for Chairs - decorative chairs to sit on"
//   "create a ticket for Pets, description: a frog that follows you around"
//   "create a ticket for Pets with description a frog that follows you around"
//   "create a ticket for Pets" and the description on the lines below it
//   "ticket Creative Mode"
function parseRequest(text, botName) {
  const lines = stripMentions(text || '', botName).split('\n'), more = clean(lines.slice(1).join(' '));
  const t = clean(lines[0]) || more;   // (the request on the first line; anything below it goes in the post)
  if (!t) return { help: true };
  if (/^(help|\?|how)\b/i.test(t)) return { help: true };
  const m = t.match(/^(?:please\s+)?(?:(?:can|could|would) you\s+)?(?:create|make|open|add|new|file|log|raise)?\s*(?:a|an|another|new)?\s*(?:new\s+)?(?:(bugs?|enhancements?|suggestions?|improvement|feature|idea)\s+)?(?:ticket|post|issue)s?\b\s*(?:(?:for|about|on|called|titled|named|:|-)\s*)?(.*)$/i);
  if (!m) return { help: true };
  let rest = clean(m[2] || '').replace(/^["“']|["”']$/g, '');
  if (!rest) return { help: true };
  // the title, and its description: after the word "description" (or desc, details), else after the
  // first ":" or " - ", and the lines below the request
  let title = rest, body = '';
  const said = rest.match(DESC_A) || rest.match(DESC_B), split = rest.match(/^(.{1,90}?)\s*(?::|\s-\s|\s—\s)\s*(.+)$/);
  if (said && clean(said[1])) { title = said[1]; body = said[2]; }
  else if (split) { title = split[1]; body = split[2]; }
  if (more && clean(lines[0])) { const m2 = more.replace(DESC_LEAD, ''); body = body ? `${body}\n${m2}` : m2; }
  title = clean(title).replace(/[.!]+$/, '');
  if (!title) return { help: true };
  return { title: capitalise(title), body: body.split('\n').map(clean).filter(Boolean).join('\n'), tag: tagFor(m[1]) };
}

function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function tagFor(word) {
  if (!word) return null;
  const w = word.toLowerCase();
  for (const [tag, words] of Object.entries(TAG_WORDS)) if (words.includes(w)) return tag;
  return null;
}

// The next ticket number: one more than the highest [PREFIX-N] among the posts' titles.
function nextNumber(titles, prefix = 'UI') {
  const re = new RegExp(`^\\s*\\[${prefix}-(\\d+)\\]`, 'i');
  let max = 0;
  for (const name of titles) { const m = re.exec(name || ''); if (m) max = Math.max(max, +m[1]); }
  return max + 1;
}

// A post's title: "[UI-26] Creative Mode" (a Discord thread name is at most 100 characters).
function ticketTitle(n, title, prefix = 'UI') {
  const head = `[${prefix}-${n}] `;
  return head + (title.length > 100 - head.length ? title.slice(0, 100 - head.length - 1) + '…' : title);
}

// The forum tag a ticket gets, from the channel's own tags (matched loosely: "bug" finds "bugs").
function findTag(available, tag) {
  if (!tag) return null;
  const words = TAG_WORDS[tag] || [tag];
  return available.find(t => words.includes(t.name.toLowerCase().replace(/[^a-z]/g, ''))) || null;
}

module.exports = { parseRequest, nextNumber, ticketTitle, findTag, stripMentions };
