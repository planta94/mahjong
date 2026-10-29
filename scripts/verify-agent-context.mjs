#!/usr/bin/env node
// Context-Integrity & Quality Invariant Gate (`npm run qa:agent-docs`)
// 1. Root `AGENTS.md` exists, stays under 20,000 UTF-8 bytes, includes `HKMJ-P2P-CHECK-01`,
//    and links to all 4 canonical `docs/reference/*.md` files.
// 2. Duplicate `.agents/` directory does not exist.
// 3. All relative Markdown links in `AGENTS.md` and `docs/reference/*.md` resolve on disk.
// 4. Zero `eslint-disable` comments across TypeScript sources.
// 5. Zero `TestBed.overrideComponent(` calls or trivial assertions in spec files.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const MAX_AGENTS_MD_BYTES = 20_000;
const EXPECTED_REFERENCE_DOCS = [
  'docs/reference/architecture.md',
  'docs/reference/security-and-p2p.md',
  'docs/reference/ui-conventions.md',
  'docs/reference/testing-and-quality.md',
];

const errors = [];

function assertCondition(condition, message) {
  if (!condition) errors.push(message);
}

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function verifyMarkdownLinks(relFilePath) {
  const absFile = path.join(repoRoot, relFilePath);
  if (!fs.existsSync(absFile)) {
    errors.push(`Missing markdown file: ${relFilePath}`);
    return;
  }
  const content = fs.readFileSync(absFile, 'utf8').replace(/```[\s\S]*?```/g, '');
  const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const rawTarget = match[1].trim();
    if (
      !rawTarget ||
      rawTarget.startsWith('#') ||
      rawTarget.startsWith('http://') ||
      rawTarget.startsWith('https://') ||
      rawTarget.startsWith('mailto:') ||
      rawTarget.startsWith('conversation://')
    ) {
      continue;
    }
    const cleanTarget = rawTarget.split('#')[0];
    if (!cleanTarget) continue;
    const resolved = cleanTarget.startsWith('file:///')
      ? decodeURIComponent(cleanTarget.replace(/^file:\/\/\//, ''))
      : path.resolve(path.dirname(absFile), cleanTarget);

    if (!fs.existsSync(resolved)) {
      errors.push(`Broken link in ${relFilePath}: "${rawTarget}" -> ${resolved}`);
    }
  }
}

const agentsMdPath = path.join(repoRoot, 'AGENTS.md');
assertCondition(fs.existsSync(agentsMdPath), 'Root AGENTS.md is missing.');

let agentsMdBytes = 0;
if (fs.existsSync(agentsMdPath)) {
  const buf = fs.readFileSync(agentsMdPath);
  agentsMdBytes = buf.byteLength;
  const text = buf.toString('utf8');
  assertCondition(
    agentsMdBytes < MAX_AGENTS_MD_BYTES,
    `AGENTS.md is ${agentsMdBytes} bytes (exceeds ${MAX_AGENTS_MD_BYTES}).`
  );
  assertCondition(text.includes('HKMJ-P2P-CHECK-01'), 'AGENTS.md missing HKMJ-P2P-CHECK-01.');
  for (const refDoc of EXPECTED_REFERENCE_DOCS) {
    assertCondition(text.includes(refDoc), `AGENTS.md missing link to ${refDoc}.`);
  }
}

assertCondition(!fs.existsSync(path.join(repoRoot, '.agents')), 'Duplicate .agents/ exists.');

verifyMarkdownLinks('AGENTS.md');
for (const refDoc of EXPECTED_REFERENCE_DOCS) {
  assertCondition(fs.existsSync(path.join(repoRoot, refDoc)), `Missing ${refDoc}.`);
  verifyMarkdownLinks(refDoc);
}

const tsFiles = walkFiles(path.join(repoRoot, 'src'), (f) => f.endsWith('.ts'));
for (const file of tsFiles) {
  const rel = path.relative(repoRoot, file);
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('eslint-disable')) {
    errors.push(`Forbidden eslint-disable comment found in ${rel}`);
  }
  if (file.endsWith('.spec.ts')) {
    if (src.includes('overrideComponent(')) {
      errors.push(`Forbidden TestBed.overrideComponent found in ${rel}`);
    }
    for (const banned of ['.toBeTruthy(', '.toBeDefined(', '.not.toBeNull(']) {
      if (src.includes(banned)) {
        errors.push(`Forbidden trivial assertion "${banned}" found in ${rel}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('\n[Agent Context Gate FAILED]');
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(
  `[Agent Context Gate PASSED] AGENTS.md: ${agentsMdBytes} bytes | ${EXPECTED_REFERENCE_DOCS.length} reference docs verified | ${tsFiles.length} TS/spec files clean.`
);
