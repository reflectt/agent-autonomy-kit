'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Determine whether a session appears to be actively running.
 *
 * Spec (conservative):
 * - Consider a subagent session active only if updatedAt is within last 5 minutes AND
 *   the last event indicates it is still running OR we cannot find a completion marker.
 * - If we can't detect a completion marker (i.e., last event is unknown / unreadable),
 *   require updatedAt within last 2 minutes.
 */

const MS = {
  minute: 60 * 1000,
};

function readLastJsonlRecord(jsonlPath) {
  // Read small tail safely: files can be large.
  // Strategy: read last ~128KB and parse the last non-empty line.
  const fd = fs.openSync(jsonlPath, 'r');
  try {
    const stat = fs.fstatSync(fd);
    const tailSize = Math.min(128 * 1024, stat.size);
    const start = Math.max(0, stat.size - tailSize);
    const buf = Buffer.alloc(tailSize);
    fs.readSync(fd, buf, 0, tailSize, start);
    const text = buf.toString('utf8');
    const lines = text.split('\n');

    // Walk backwards for last non-empty, parseable JSON line.
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        return JSON.parse(line);
      } catch {
        // keep walking in case we cut in the middle of a line
        continue;
      }
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

function classifyLastRecord(rec) {
  if (!rec || typeof rec !== 'object') return { status: 'unknown', reason: 'no_record' };

  // OpenClaw session jsonl records are typically:
  // { type: 'message', message: { role: 'assistant'|'user'|'toolResult', ... }, stopReason?: 'stop'|'toolUse'|... }
  if (rec.type === 'message') {
    const role = rec.message && rec.message.role;

    // Completion marker: assistant finished normally.
    if (role === 'assistant' && (rec.stopReason === 'stop' || rec.stopReason === 'end')) {
      return { status: 'completed', reason: `assistant_stopReason:${rec.stopReason}` };
    }

    // Strong running indicators.
    if (role === 'assistant' && rec.stopReason === 'toolUse') {
      return { status: 'running', reason: 'assistant_waiting_tool' };
    }
    if (role === 'toolResult') {
      return { status: 'running', reason: 'tool_result_last' };
    }

    // Weak/unknown: could be user message or other assistant stop reasons.
    return { status: 'unknown', reason: `message_role:${role || 'none'} stopReason:${rec.stopReason || 'none'}` };
  }

  return { status: 'unknown', reason: `record_type:${rec.type || 'none'}` };
}

function isSessionActive({ updatedAt, nowMs, lastRecordStatus }) {
  const ageMs = nowMs - updatedAt;
  if (!Number.isFinite(ageMs) || ageMs < 0) return false;

  if (lastRecordStatus === 'running') {
    return ageMs <= 5 * MS.minute;
  }

  if (lastRecordStatus === 'completed') {
    return false;
  }

  // Unknown: only treat as active if it's *very* fresh.
  return ageMs <= 2 * MS.minute;
}

function getLastRecordInfo({ sessionsDir, sessionId }) {
  const jsonlPath = path.join(sessionsDir, `${sessionId}.jsonl`);
  if (!fs.existsSync(jsonlPath)) {
    return { jsonlPath, lastRecord: null, classification: { status: 'unknown', reason: 'missing_jsonl' } };
  }

  const lastRecord = readLastJsonlRecord(jsonlPath);
  const classification = classifyLastRecord(lastRecord);
  return { jsonlPath, lastRecord, classification };
}

module.exports = {
  readLastJsonlRecord,
  classifyLastRecord,
  isSessionActive,
  getLastRecordInfo,
  MS,
};
