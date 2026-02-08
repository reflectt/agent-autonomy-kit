#!/usr/bin/env node
/**
 * Queue Freshness Checker
 * 
 * Fails if tasks/QUEUE.md hasn't been updated in >24 hours.
 * Prevents the team from running on a stale backlog while thinking everything is fine.
 * 
 * Exit code 1 = STALE (must refresh queue before continuing)
 * Exit code 0 = FRESH
 */

const fs = require('fs');
const path = require('path');

const MAX_AGE_HOURS = 24;

const queuePath = path.join(process.cwd(), 'tasks/QUEUE.md');

if (!fs.existsSync(queuePath)) {
  console.error('❌ tasks/QUEUE.md does not exist! Create it.');
  process.exit(1);
}

// Check file modification time
const stat = fs.statSync(queuePath);
const mtime = stat.mtimeMs;
const now = Date.now();
const ageHours = (now - mtime) / (1000 * 60 * 60);

// Also try to parse the "Last updated" line
const content = fs.readFileSync(queuePath, 'utf-8');
const match = content.match(/Last updated:\s*(.+)/i);

if (ageHours > MAX_AGE_HOURS) {
  console.error(`❌ QUEUE IS STALE — last modified ${ageHours.toFixed(1)} hours ago`);
  if (match) console.error(`   Header says: "${match[1].trim()}"`);
  console.error(`   Maximum allowed age: ${MAX_AGE_HOURS} hours`);
  console.error('');
  console.error('ACTION REQUIRED: Spawn Rhythm 🥁 to refresh the queue before continuing.');
  console.error('A stale queue means the team works on nothing while reporting "all clear."');
  process.exit(1);
} else {
  console.log(`✅ Queue is fresh (modified ${ageHours.toFixed(1)} hours ago)`);
  if (match) console.log(`   Header: "${match[1].trim()}"`);
  process.exit(0);
}
