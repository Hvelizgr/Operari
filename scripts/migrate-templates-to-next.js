// One-shot migration: bring templates/*.yaml up to the canonical
// RunbookSpec format defined in backend/src/runbook/yaml/runbook-spec.ts.
//
// What this does, in order:
//   1. Inserts `version: 1` at the top of the doc if missing.
//   2. Renames per-step `title:` → `name:` (legacy NanoFlow field name).
//   3. Converts the legacy `connections: [{ source, target }]` root
//      block into per-step `next:` fields.
//   4. Drops the `connections:` block.
//   5. Preserves the leading comment block byte-for-byte.
//
// Run once, then leave the file in scripts/ as historical reference
// or delete it. The schema test (runbook-schema.test.ts) pins the
// new format afterwards.
//
//   node scripts/migrate-templates-to-next.js

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const TEMPLATES = path.join(__dirname, '..', 'templates');

function extractLeadingComments(text) {
  const lines = text.split('\n');
  const out = [];
  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') {
      out.push(line);
    } else {
      break;
    }
  }
  return out;
}

for (const file of fs.readdirSync(TEMPLATES)) {
  if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
  const full = path.join(TEMPLATES, file);
  const original = fs.readFileSync(full, 'utf-8');
  const doc = yaml.load(original);
  if (!doc || typeof doc !== 'object') continue;

  // 1. Inject version
  const versioned = doc.version ? doc : { version: 1, ...doc };

  // 2. Rename title → name on each step
  for (const step of versioned.steps ?? []) {
    if (step.title && !step.name) {
      step.name = step.title;
      delete step.title;
    }
  }

  // 3. Convert connections → next
  if (Array.isArray(versioned.connections)) {
    const nextMap = new Map();
    for (const conn of versioned.connections) {
      const arr = nextMap.get(conn.source) ?? [];
      arr.push(conn.target);
      nextMap.set(conn.source, arr);
    }
    for (const step of versioned.steps ?? []) {
      const targets = nextMap.get(step.id);
      if (!targets || targets.length === 0) continue;
      step.next = targets.length === 1 ? targets[0] : targets;
    }
    delete versioned.connections;
  }

  const commentLines = extractLeadingComments(original);
  const commentBlock = commentLines.length > 0 ? commentLines.join('\n') + '\n' : '';

  const dumped = yaml.dump(versioned, { lineWidth: 100, noRefs: true, sortKeys: false });

  fs.writeFileSync(full, commentBlock + dumped);
  console.log(`migrated ${file}`);
}
