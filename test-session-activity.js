#!/usr/bin/env node
'use strict';

const assert = require('assert');

const { classifyLastRecord, isSessionActive, MS } = require('./lib/sessionActivity');

function run() {
  const nowMs = 1_000_000;

  // Completed marker
  {
    const rec = { type: 'message', message: { role: 'assistant', content: [] }, stopReason: 'stop' };
    const c = classifyLastRecord(rec);
    assert.equal(c.status, 'completed');

    const active = isSessionActive({ updatedAt: nowMs - 1 * MS.minute, nowMs, lastRecordStatus: c.status });
    assert.equal(active, false);
  }

  // Running marker: toolUse
  {
    const rec = { type: 'message', message: { role: 'assistant', content: [] }, stopReason: 'toolUse' };
    const c = classifyLastRecord(rec);
    assert.equal(c.status, 'running');

    assert.equal(isSessionActive({ updatedAt: nowMs - 4 * MS.minute, nowMs, lastRecordStatus: c.status }), true);
    assert.equal(isSessionActive({ updatedAt: nowMs - 6 * MS.minute, nowMs, lastRecordStatus: c.status }), false);
  }

  // Unknown marker: only active if <=2 minutes
  {
    const rec = { type: 'message', message: { role: 'assistant', content: [] }, stopReason: 'length' };
    const c = classifyLastRecord(rec);
    assert.equal(c.status, 'unknown');

    assert.equal(isSessionActive({ updatedAt: nowMs - 60 * 1000, nowMs, lastRecordStatus: c.status }), true);
    assert.equal(isSessionActive({ updatedAt: nowMs - 3 * MS.minute, nowMs, lastRecordStatus: c.status }), false);
  }

  console.log('✅ PASS: sessionActivity classification + active gating');
}

run();
