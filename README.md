# 🚀 Agent Autonomy Kit

[![GitHub](https://img.shields.io/badge/GitHub-reflectt-blue?logo=github)](https://github.com/reflectt/agent-autonomy-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Part of Team Reflectt](https://img.shields.io/badge/Team-Reflectt-purple)](https://github.com/reflectt)

**Stop waiting for prompts. Keep working.**

Most AI agents sit idle between human messages. This kit turns your agent into a self-directed worker that continuously makes progress on meaningful tasks.

---

## The Problem

Agents waste tokens by waiting:
- Heartbeats check "anything need attention?" and reply `HEARTBEAT_OK`
- Team members sit idle until spawned
- Work stops when the human stops prompting
- Subscription limits (tokens/hour, tokens/day) go unused

## The Solution

A proactive work system:
1. **Task Queue** — Always have work ready to pull
2. **Proactive Heartbeat** — Do work, don't just check for work
3. **Team Coordination** — Agents communicate and hand off tasks
4. **Continuous Operation** — Work until limits hit, then sleep

---

## Core Concepts

### 1. The Task Queue (Queue-First Enforcement)

Instead of waiting for prompts, agents pull from a persistent task queue.

**CRITICAL:** The Autonomy Kit enforces queue-first execution. If HIGH or CRITICAL priority tasks exist in the queue, the agent **CANNOT** skip them to work on other things or say HEARTBEAT_OK.

**Location:** `tasks/QUEUE.md` (or GitHub Projects)

```markdown
# Task Queue

## Ready (can be picked up)
- [ ] Research competitor X pricing
- [ ] Write blog post draft on memory systems
- [ ] Review and improve procedure docs

## In Progress
- [ ] @kai: Building autonomy skill
- [ ] @rhythm: Updating process docs

## Blocked
- [ ] Deploy to production (needs: Ryan's approval)

## Done Today
- [x] Memory system shipped
- [x] Team spawning documented
```

**Rules:**
- Any agent can pick up a "Ready" task
- Mark yourself when you start: `@agentname: task`
- Move to Done when complete
- Add new tasks as you discover them

**Priority Levels:**
- `[CRITICAL]` or `🔥 CRITICAL` — Drop everything, fix now
- `[HIGH]` or `🔴 HIGH` — Must be handled before other work
- `[MEDIUM]` — Treated as HIGH by default (safety first)
- `[LOW]` or `🟡 LOW` — Can be deferred

### 2. Queue Checker Script (Enforcement)

The queue checker script **enforces** queue-first execution programmatically.

**Location:** `skills/agent-autonomy-kit/check-queue.js`

**Usage:**
```bash
node skills/agent-autonomy-kit/check-queue.js
```

**How it works:**
1. Scans `tasks/QUEUE.md` for all tasks in the "Ready" section
2. Detects priority level (CRITICAL, HIGH, MEDIUM, LOW)
3. Returns exit code 1 if HIGH/CRITICAL tasks exist
4. Returns exit code 0 only if queue is empty or all tasks are LOW priority

**Exit Codes:**
- `0` = Safe to continue with other work (no urgent tasks)
- `1` = MUST spawn agent for HIGH/CRITICAL task (cannot skip)

**Integration in HEARTBEAT.md:**
```markdown
## 1. Quick Checks

- [ ] Human messages waiting? → Handle immediately
- [ ] Run queue checker (MANDATORY):
  ```bash
  node skills/agent-autonomy-kit/check-queue.js
  ```
  - Exit code 1: MUST spawn agent for top task
  - Exit code 0: Safe to proceed
- [ ] If queue is clear, proceed to work mode
```

**Example Output:**

When HIGH priority tasks exist:
```
=== Queue Priority Check ===

🔴 HIGH priority tasks: 3
   • Fix critical bug in authentication
   • Deploy hotfix to production
   • Update security documentation

❌ CANNOT SKIP QUEUE
You must spawn an agent for HIGH/CRITICAL tasks before doing other work.

Top priority task:
Fix critical bug in authentication

[Exit code: 1]
```

When queue is clear:
```
=== Queue Priority Check ===

🟢 LOW priority tasks: 2

✅ Safe to continue
No HIGH/CRITICAL tasks in queue. You can proceed with other work.

[Exit code: 0]
```

**Why this matters:**

Before this script, agents would:
- Say "HEARTBEAT_OK" and skip important work
- Work on pet projects while HIGH priority tasks sat in the queue
- Require human interpretation of "what's urgent"

After this script:
- **Programmatic enforcement** — no agent discretion, no exceptions
- **Impossible to skip** — exit code 1 blocks heartbeat completion
- **Clear instructions** — script shows exactly which task to spawn for

**📖 See [QUEUE-ENFORCEMENT-EXAMPLES.md](./QUEUE-ENFORCEMENT-EXAMPLES.md) for detailed usage examples and workflow patterns.**

### 3. Proactive Heartbeat

Transform heartbeat from "check for alerts" to "do meaningful work."

**HEARTBEAT.md template:**

```markdown
# Heartbeat Routine

## 1. Check for urgent items (30 seconds)
- Unread messages from human?
- **Run queue checker (MANDATORY):**
  ```bash
  node skills/agent-autonomy-kit/check-queue.js
  ```
  If exit code 1: spawn agent for HIGH/Critical task (no exceptions)
- Blocked tasks needing escalation?
- System health issues?

If urgent: handle immediately.
If queue checker passed (exit 0): continue to work mode.

## 2. Work Mode (use remaining time)

Pull from task queue:
1. Check `tasks/QUEUE.md` for Ready items
2. Pick the highest-priority task you can do
3. Do meaningful work on it
4. Update status when done or blocked

## 3. Before finishing
- Log what you did to daily memory
- Update task queue
- If task incomplete, note progress for next heartbeat
```

### 3. Team Coordination

Agents communicate through Discord (or configured channel):
- Progress updates
- Handoffs ("@rhythm this is ready for review")
- Blockers ("stuck on X, need help")
- Discoveries ("found interesting thing, adding to queue")

### 4. Token Budget Awareness

Know your limits, use them wisely:

```markdown
## Token Strategy

**Daily budget:** ~X tokens (Claude Max)
**Heartbeat cost:** ~2-5k tokens per run
**Runs available:** ~Y per day

**Priority:**
1. Human requests (always first)
2. Urgent tasks (time-sensitive)
3. High-impact tasks (move needles)
4. Maintenance tasks (improvements)

When approaching limits:
- Wrap up current task
- Write detailed handoff notes
- Sleep until reset
```

---

## Installation

### Git Clone (Recommended)
```bash
# Clone into your skills folder
git clone https://github.com/reflectt/agent-autonomy-kit.git skills/agent-autonomy-kit
```

Then follow the setup steps below.

---

## Setup

### 1. Create the task queue

```bash
mkdir -p tasks
cat > tasks/QUEUE.md << 'EOF'
# Task Queue

## Ready
<!-- Add tasks here that any agent can pick up -->

## In Progress
<!-- Tasks currently being worked on -->

## Blocked
<!-- Tasks waiting on something -->

## Done Today
<!-- Completed tasks (clear daily) -->
EOF
```

### 2. Update HEARTBEAT.md

Replace passive checking with **enforced** queue-first work:

```markdown
# Heartbeat Routine

## Quick Checks (if urgent, handle immediately)
- [ ] Human messages waiting?
- [ ] **Run queue checker (MANDATORY):**
  ```bash
  node skills/agent-autonomy-kit/check-queue.js
  ```
  Exit code 1 → Spawn agent for HIGH task (cannot skip)
  Exit code 0 → Safe to continue
- [ ] Critical blockers?

## Work Mode
1. Read `tasks/QUEUE.md`
2. Pick highest-priority Ready task
3. Do the work
4. Update queue and daily memory
5. If time remains, pick another task

## End of Heartbeat
- Log progress to `memory/YYYY-MM-DD.md`
- Post update to team channel if significant
```

### 3. Configure continuous operation

Set heartbeat to run frequently:

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "15m",  // More frequent = more work done
        target: "last",
        activeHours: { start: "06:00", end: "23:00" }
      }
    }
  }
}
```

### 4. Set up team channel (optional)

Configure Discord/Slack for team communication:

```json5
{
  channels: {
    discord: {
      // ... existing config ...
      groups: {
        "team-reflectt": {
          policy: "allow",
          channels: ["team-chat-channel-id"]
        }
      }
    }
  }
}
```

---

## Workflow Example

### Morning (6:00 AM)
1. Heartbeat fires
2. Agent checks: no urgent human messages
3. Agent reads task queue: "Research competitor X pricing"
4. Agent does the research, writes findings
5. Agent updates queue: moves task to Done, adds follow-up tasks discovered
6. Agent posts to team channel: "Competitor research done, see tasks/competitor-analysis.md"

### Throughout the Day
- Heartbeat fires every 15-30 minutes
- Each time: check for urgent → do work → update queue → log progress
- Human messages always get priority
- Team coordinates via channel

### Evening (11:00 PM)
- Last heartbeat of active hours
- Agent wraps up current task
- Writes detailed notes for tomorrow
- Goes dormant until morning

---

## Anti-Patterns

❌ **Passive heartbeats** — "HEARTBEAT_OK" wastes the opportunity to work
❌ **No task queue** — Agents don't know what to work on
❌ **Solo operation** — No coordination means duplicated effort
❌ **Ignoring limits** — Getting rate-limited mid-task loses context
❌ **No handoff notes** — Next session starts from scratch

---

## Metrics to Track

In `memory/metrics.md`:

```markdown
# Autonomy Metrics

## This Week
- Tasks completed: X
- Heartbeats used productively: Y%
- Token utilization: Z%
- Human interventions needed: N

## Patterns
- Most productive hours: morning
- Common blockers: waiting for human approval
- Tasks that work well async: research, writing, code review
```

---

## Related Kits

This kit works best with its companions:

### [Agent Memory Kit](https://github.com/reflectt/agent-memory-kit)
**Required foundation.** Provides the memory system this kit builds on:
- Task progress logged to daily memory (episodic)
- Procedures for common tasks (procedural)
- Learnings added to MEMORY.md (semantic)
- Failures tracked in feedback.md (feedback loops)

### [Agent Team Kit](https://github.com/reflectt/agent-team-kit)
**For multi-agent setups.** Coordinates autonomous agents working together:
- Role-based work distribution
- Self-service task queues
- Team communication patterns

---

## Origin

Created by Team Reflectt after realizing their Claude Max subscription tokens were going unused. The agent would complete a task and wait for the next prompt, leaving hours of potential work on the table.

Now the team works continuously, coordinating via Discord, pulling from a shared task queue, and only sleeping when the token limits are reached.

---

## Cron Jobs for Autonomy

Set up automated reporting and work triggers.

### Avoid duplicate work when subagents are already running (watchdog)

Cron jobs often run on a fixed schedule; if a subagent finished *recently*, its session can look “fresh” even though it’s done.

Use the watchdog below to distinguish **actually running** subagents from **recently completed** ones:

```bash
node skills/agent-autonomy-kit/check-active-subagents.js
# exit 0 => no active subagents
# exit 1 => active subagent(s) detected
```

Suggested pattern for cron message prompts: **run the watchdog first; if it reports active subagents, do nothing and exit.**

Set up automated reporting and work triggers:

### Daily Progress Report (10 PM)
```bash
openclaw cron add \
  --name "Daily Progress Report" \
  --cron "0 22 * * *" \
  --tz "America/Vancouver" \
  --session isolated \
  --message "Generate daily progress report. Read tasks/QUEUE.md for completed tasks. Summarize: completed, in progress, blockers, tomorrow's plan."
```

### Morning Kickoff (7 AM)
```bash
openclaw cron add \
  --name "Morning Kickoff" \
  --cron "0 7 * * *" \
  --tz "America/Vancouver" \
  --session main \
  --system-event "Morning kickoff: Review task queue, pick top priorities, spawn team members for parallel work." \
  --wake now
```

### Overnight Work Check (3 AM)
```bash
openclaw cron add \
  --name "Overnight Work" \
  --cron "0 3 * * *" \
  --tz "America/Vancouver" \
  --session isolated \
  --message "Overnight work session. Pull tasks from queue that don't need human input. Do research, writing, or analysis. Log progress."
```

These run automatically — no human prompt needed.

---

## Queue Enforcement Summary

**The Problem:** Agents skipped HIGH priority tasks and said HEARTBEAT_OK.

**The Solution:** Programmatic enforcement via `check-queue.js`.

**How It Works:**
1. Every heartbeat runs: `node skills/agent-autonomy-kit/check-queue.js`
2. Script scans `tasks/QUEUE.md` for HIGH/CRITICAL tasks in "Ready" section
3. Exit code 1 = MUST spawn agent (impossible to skip)
4. Exit code 0 = Safe to continue with other work

**Success Metric:** After this fix, if there's a HIGH priority task in QUEUE.md, the agent MUST spawn work for it. No exceptions.

**Files:**
- `check-queue.js` — The enforcer script
- `test-queue-checker.sh` — Automated tests (all passing ✅)
- `QUEUE-ENFORCEMENT-EXAMPLES.md` — Real-world usage examples
- `templates/HEARTBEAT.md` — Updated template with enforcement

**Run Tests:**
```bash
bash skills/agent-autonomy-kit/test-queue-checker.sh
```

---

*Idle agents are wasted agents. Keep working.*
