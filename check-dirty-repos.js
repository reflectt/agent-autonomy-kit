#!/usr/bin/env node

/**
 * Dirty repo watchdog.
 *
 * Usage:
 *   node check-dirty-repos.js <path> [path2 ...]
 *
 * Exit codes:
 *   0 = all clean
 *   1 = at least one repo dirty (modified/untracked)
 *   2 = usage / repo missing
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repos = process.argv.slice(2);
if (repos.length === 0) {
  console.error('Usage: node check-dirty-repos.js <repoPath> [repoPath2 ...]');
  process.exit(2);
}

function isGitRepo(p) {
  try {
    return fs.existsSync(path.join(p, '.git'));
  } catch {
    return false;
  }
}

let dirty = [];
let missing = [];

for (const repoPath of repos) {
  const p = path.resolve(repoPath);
  if (!fs.existsSync(p) || !isGitRepo(p)) {
    missing.push(repoPath);
    continue;
  }

  const r = spawnSync('git', ['status', '--porcelain'], { cwd: p, encoding: 'utf8' });
  if (r.status !== 0) {
    missing.push(repoPath);
    continue;
  }

  const lines = (r.stdout || '').trim().split('\n').filter(Boolean);
  if (lines.length) dirty.push({ repoPath, count: lines.length });
}

if (missing.length) {
  console.error('[dirty-repos] missing or not a repo:', missing.join(', '));
  process.exit(2);
}

if (dirty.length) {
  console.log('[dirty-repos] DIRTY repos:');
  for (const d of dirty) console.log(`- ${d.repoPath} (${d.count} change(s))`);
  process.exit(1);
}

console.log('[dirty-repos] all clean');
process.exit(0);
