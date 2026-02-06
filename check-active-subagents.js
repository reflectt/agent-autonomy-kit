#!/usr/bin/env node
'use strict';

/**
 * Autonomy Watchdog: check whether any subagent sessions are truly active.
 *
 * Why: sessions can be "recently updated" even after completion.
 * This script avoids treating recently-completed subagents as "active work".
 *
 * Output:
 * - Human-readable by default.
 * - Use --json for machine-readable output.
 *
 * Exit codes:
 * - 0: no active subagents detected
 * - 1: at least one active subagent detected
 */

const { execSync } = require('child_process');
const path = require('path');

const {
  getLastRecordInfo,
  isSessionActive,
} = require('./lib/sessionActivity');

function parseArgs(argv) {
  const out = { json: false, activeMinutes: 10 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    if (a === '--active-minutes') {
      out.activeMinutes = parseInt(argv[i + 1], 10);
      i++;
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const raw = execSync(`openclaw sessions --json --active ${args.activeMinutes}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const parsed = JSON.parse(raw);

  const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
  const sessionsStorePath = parsed.path;
  const sessionsDir = sessionsStorePath ? path.dirname(sessionsStorePath) : null;

  const nowMs = Date.now();

  const subagents = sessions.filter(s => typeof s.key === 'string' && s.key.includes(':subagent:'));

  const results = [];
  for (const s of subagents) {
    const updatedAt = s.updatedAt;
    const sessionId = s.sessionId;

    let classification = { status: 'unknown', reason: 'no_sessions_dir' };
    let jsonlPath = null;
    if (sessionsDir && sessionId) {
      const info = getLastRecordInfo({ sessionsDir, sessionId });
      classification = info.classification;
      jsonlPath = info.jsonlPath;
    }

    const active = isSessionActive({
      updatedAt,
      nowMs,
      lastRecordStatus: classification.status,
    });

    results.push({
      key: s.key,
      kind: s.kind,
      sessionId,
      updatedAt,
      ageMs: nowMs - updatedAt,
      lastRecordStatus: classification.status,
      lastRecordReason: classification.reason,
      jsonlPath,
      active,
    });
  }

  const activeOnes = results.filter(r => r.active);

  if (args.json) {
    process.stdout.write(JSON.stringify({
      checkedAt: new Date().toISOString(),
      activeMinutes: args.activeMinutes,
      subagentsChecked: results.length,
      activeSubagents: activeOnes.length,
      results,
    }, null, 2) + '\n');
  } else {
    if (results.length === 0) {
      console.log('No subagent sessions found in recent sessions list.');
    } else if (activeOnes.length === 0) {
      console.log(`No active subagents detected (checked ${results.length}).`);
      for (const r of results) {
        console.log(`- idle: ${r.key} age=${Math.round(r.ageMs/1000)}s last=${r.lastRecordStatus} (${r.lastRecordReason})`);
      }
    } else {
      console.log(`ACTIVE subagents detected (${activeOnes.length}/${results.length}):`);
      for (const r of activeOnes) {
        console.log(`- ACTIVE: ${r.key} age=${Math.round(r.ageMs/1000)}s last=${r.lastRecordStatus} (${r.lastRecordReason})`);
      }
    }
  }

  process.exit(activeOnes.length > 0 ? 1 : 0);
}

main();
