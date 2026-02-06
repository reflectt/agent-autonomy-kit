#!/usr/bin/env node
/**
 * check-queue-hygiene.js
 *
 * Enforces that tasks/QUEUE.md stays actionable:
 * - No completed items ([x]) may remain inside the "High Priority / Ready" section.
 *
 * Rationale: leaving completed items in Ready causes the team to stop shipping
 * (they think work is done) and makes the queue checker less useful.
 *
 * Exit codes:
 * - 0: OK
 * - 1: Hygiene violation
 */

const fs = require('fs');
const path = require('path');

const queuePath = path.resolve(process.cwd(), 'tasks/QUEUE.md');

function die(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

if (!fs.existsSync(queuePath)) {
  die(`Queue file not found: ${queuePath}`);
}

const text = fs.readFileSync(queuePath, 'utf8');

const startHeader = '## 🔥 High Priority / Ready';
const startIdx = text.indexOf(startHeader);
if (startIdx === -1) {
  die(`Could not find section header: ${startHeader}`);
}

// Find end of this section: next "## " header after start.
const afterStart = text.slice(startIdx + startHeader.length);
const nextHeaderMatch = afterStart.match(/\n##\s+/);
const endIdx = nextHeaderMatch
  ? startIdx + startHeader.length + nextHeaderMatch.index
  : text.length;

const readySection = text.slice(startIdx, endIdx);

const completedLines = readySection
  .split(/\r?\n/)
  .filter((l) => /^- \[x\]/i.test(l.trim()));

if (completedLines.length > 0) {
  die(
    [
      'QUEUE HYGIENE FAILURE: Completed tasks found in "High Priority / Ready".',
      'Move these items to "✅ Recently Completed" (or remove them) so Ready stays executable:',
      ...completedLines.map((l) => `  ${l.trim()}`),
    ].join('\n')
  );
}

process.stdout.write('Queue hygiene OK: no completed items in High Priority / Ready.\n');
process.exit(0);
