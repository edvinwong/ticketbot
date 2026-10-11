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

// Strip Discord mentions (<@123>, <@!123>, <@&123>) and the bot's own name if typed as plain text.
function stripMentions(text, botName) {
  let t = text.replace(/<@[!&]?\d+>/g, ' ');
  if (botName) t = t.replace(new RegExp(`^\\s*@?${botName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), ' ');
  return t;
}

// "Title: ...", "Tag: ..." or "Description: ..." on a line of its own, below the request
const FIELD = /^\s*(title|name|subject|tag|type|category|description|desc|details?)\s*[:=-]\s*(.*)$/i;
// A description line, tidied: spaces squeezed (but not the indent of a sub-point), and "•" style bullets made
// "- ", which Discord shows as a list
function tidyLine(line) {
  const b = line.match(/^(\s*)(?:[-*]\s+|[•·●◦▪‣]\s*)(\S.*)$/);
  return b ? `${' '.repeat(Math.min(b[1].replace(/\t/g, '  ').length, 8))}- ${clean(b[2])}` : clean(line);
}
// Lines to the post's description: tidied, blank ones at the ends dropped and runs of them made one
function tidyBody(lines) {
  return lines.map(tidyLine).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// What a message asks for: { title, body, tag } for a new ticket (body: its description, or ''), or
// { help: true } when it's addressed to the bot but doesn't ask for one.
//   "create a ticket for Creative Mode"
//   "create a bug ticket for Raft sinks: it goes under when two frogs sit on it"
//   "new enhancement ticket for Chairs - decorative chairs to sit on"
//   "create a ticket for Pets, description: a frog that follows you around"
//   "create a ticket for Pets with description a frog that follows you around"
//   "create a ticket for Pets" and the description on the lines below it (points and line breaks kept)
//   "create ticket" and "Title: Pets", "Tag: suggestion", "Description:" and its points on the lines below
//   "ticket Creative Mode"
function parseRequest(text, botName) {
  const lines = stripMentions(text || '', botName).split('\n');
  while (lines.length && !clean(lines[0])) lines.shift();   // (the mention on a line of its own)
  const t = clean(lines[0] || '');
  if (!t) return { help: true };
  if (/^(help|\?|how)\b/i.test(t)) return { help: true };
  const m = t.match(/^(?:please\s+)?(?:(?:can|could|would) you\s+)?(?:creat\w*|crate|make|open|add|new|file|log|raise|submit)?\s*(?:a|an|another|new)?\s*(?:new\s+)?(?:(bugs?|enhancements?|suggestions?|improvement|feature|idea)\s+)?(?:ticket|post|issue)s?\b\s*(?:(?:for|about|on|called|titled|named|:|-)\s*)?(.*)$/i);
  if (!m) return { help: true };
  // the lines below: "Title:" and "Tag:" lines, and the description (after a "Description:" line, or
  // every other line), which runs to the end
  let fieldTitle = '', fieldTag = null;
  const below = [];
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].match(FIELD), key = f && f[1].toLowerCase();
    if (f && /^(title|name|subject)$/.test(key) && !below.some(l => clean(l))) fieldTitle = f[2];
    else if (f && /^(tag|type|category)$/.test(key) && !below.some(l => clean(l))) fieldTag = tagFor(clean(f[2]));
    else if (f && /^(desc|description|details?)$/.test(key)) { below.push(f[2], ...lines.slice(i + 1)); break; }
    else below.push(lines[i]);
  }
  let rest = clean(m[2] || '').replace(/^(?:title|name|subject)\s*[:=-]\s*/i, '').replace(/^["“']|["”']$/g, '');
  if (clean(fieldTitle)) rest = clean(fieldTitle);
  if (!rest) return { help: true };
  // the title, and its description: after the word "description" (or desc, details), else after the
  // first ":" or " - ", and the lines below the request
  let title = rest, body = '';
  const said = rest.match(DESC_A) || rest.match(DESC_B), split = rest.match(/^(.{1,90}?)\s*(?::|\s-\s|\s—\s)\s*(.+)$/);
  if (said && clean(said[1])) { title = said[1]; body = said[2]; }
  else if (split) { title = split[1]; body = split[2]; }
  const more = tidyBody(below);
  if (more) body = body ? `${clean(body)}\n${more}` : more;
  title = clean(title).replace(/[.!]+$/, '');
  if (!title) return { help: true };
  return { title: capitalise(title), body: body.includes('\n') ? body : clean(body), tag: fieldTag || tagFor(m[1]) };
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
