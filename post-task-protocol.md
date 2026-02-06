# Post-Task Protocol

**Status:** MANDATORY — Run after EVERY task completion  
**Version:** 1.0  
**Last Updated:** Feb 4, 2026

---

## The Rule

**After completing ANY task (direct work OR subagent return), you MUST check the queue again before asking the human for input.**

---

## Why This Exists

**Problem:** Agents were checking the queue at heartbeat start (✅) but not after task completion (❌). This created a gap where autonomous execution broke down:

```
Heartbeat → Check Queue → Spawn Agent → Task Complete → ❌ "What's next?"
```

**Solution:** Close the loop. Every task completion is a mini-heartbeat:

```
Heartbeat → Check Queue → Work → Complete → Check Queue Again → Loop
```

---

## The Protocol

### Step 1: Update Queue Status

Move completed task from "Ready" or "In Progress" to "Done":

```markdown
## ✅ Done Today
- [x] Colony Skill integration (completed 5:00 PM)
```

### Step 2: Run Queue Checker (MANDATORY)

```bash
node skills/agent-autonomy-kit/check-queue.js
```

**Do this EVERY TIME** after completing a task. No exceptions.

### Step 3: Interpret Exit Code

**Exit Code 1 (HIGH/CRITICAL tasks exist):**
- Read the top priority task from output
- Spawn agent for that task immediately
- Log to daily memory
- **DO NOT ask human "What should we tackle next?"**

**Exit Code 0 (Queue clear or only LOW tasks):**
- Check 5D loop phases (read HEARTBEAT.md)
- Is discovery stale (>2h)? → Spawn Scout
- Are there un-triaged opportunities? → Spawn Sage
- Are there designed projects ready to build? → Spawn Link
- If all phases idle: Check for scheduled tasks in heartbeat-state.json
- If truly nothing: THEN you can say HEARTBEAT_OK or ask human

### Step 4: Log Decision

Write to `memory/YYYY-MM-DD.md`:

```markdown
16:05 - Completed Colony Skill integration
16:05 - Ran queue checker: exit code 1 (14 HIGH tasks remain)
16:06 - Top priority: Observability Control Plane Positioning
16:06 - Spawned echo-observability-positioning
```

---

## Examples

### ✅ CORRECT: Loop Back to Queue

**Scenario:** Just finished Colony Skill integration

```
16:00 - Colony Skill task completed
16:00 - Updated tasks/QUEUE.md (moved to Done Today)
16:00 - Ran: node skills/agent-autonomy-kit/check-queue.js
16:00 - Output: "🔴 HIGH priority tasks: 14"
16:00 - Top task: "Observability Control Plane Positioning"
16:01 - Spawned: echo-observability-positioning with DEFINE spec
16:02 - Logged to memory/2026-02-04.md
```

**Result:** Autonomous execution continues. No permission needed.

---

### ✅ CORRECT: Queue Clear → 5D Loop Check

**Scenario:** Completed last HIGH priority task

```
18:30 - Task completed, queue updated
18:30 - Ran queue checker: exit code 0 (no HIGH tasks)
18:30 - Checked 5D loop phases:
  - Discovery: Last run 3 hours ago (stale)
  - DEFINE: 2 opportunities need specs
18:31 - Decision: Spawn Scout for discovery
18:31 - Spawned: scout-discovery-run-13
```

**Result:** Moved to generative work without asking permission.

---

### ✅ CORRECT: Everything Idle → Check Schedule

**Scenario:** Queue clear, 5D phases healthy

```
22:45 - Task completed, queue clear
22:45 - Queue checker: exit code 0
22:45 - 5D loop: All phases current
22:45 - Checked heartbeat-state.json:
  - Scheduled: Observability launch Feb 6, 9 AM PST
  - Scheduled: LangChain webinar Feb 5
22:46 - Decision: Active scheduling exists, no action needed now
22:46 - Logged: "Task complete, next scheduled work tomorrow 9 AM"
```

**Result:** Recognized scheduled work, didn't ask for permission.

---

### ❌ WRONG: Ask Human Without Checking Queue

**Scenario:** Completed task, immediately asked human

```
16:00 - Colony Skill task completed
16:00 - Updated queue
16:01 - Posted: "Task done! What should we tackle next? 🤔"
```

**Why it's wrong:**
- Didn't run queue checker
- 14 HIGH priority tasks were waiting
- Asked permission when autonomous path existed

**Correct action:** Run queue checker, see 14 HIGH tasks, spawn next agent.

---

### ❌ WRONG: Subagent Return → Defer Decision

**Scenario:** Subagent finished, main agent deferred

```
Agent spawned echo-memory-wars to write campaign
Echo completed: "88KB content ready, all deliverables complete"
Main agent: "Echo finished! When do you want to launch?"
```

**Why it's wrong:**
- Launch schedule exists in heartbeat-state.json (Feb 6, 9 AM)
- Didn't check schedule before asking
- Deferred decision that was already made

**Correct action:** Check schedule, see Feb 6 launch planned, confirm schedule in log, continue with other work.

---

## When You CAN Ask Human

You may ask the human for input if:

1. **Genuinely blocked:**
   - Missing information you can't obtain (API keys, passwords, approvals)
   - External dependency not resolved (waiting for deployment, access)
   - Technical blocker you can't solve (error you can't debug)

2. **Strategic decision needed:**
   - Product direction change
   - Major budget allocation
   - Policy/process changes
   - Anything that affects humans downstream

3. **Clarification needed:**
   - Task in queue is ambiguous
   - Conflicting priorities (two CRITICAL tasks, unclear which first)
   - Scope uncertainty (unclear if task should be HIGH or LOW)

**In these cases:** Document what you checked FIRST, then ask.

**Example:**
```
"Checked queue (exit code 1), top task is 'Deploy to production.'
I need approval before production deployments.
Ready to deploy when you approve."
```

**NOT:**
```
"What should we do next?"
```

---

## Integration Points

### In HEARTBEAT.md

Section "Heartbeat Execution" includes this protocol at step 4.

### In AGENTS.md

Wake routine references this before responding to humans.

### In check-queue.js

The enforcer script that makes this protocol work.

---

## Testing the Protocol

### Self-Check After Task Completion

Ask yourself:
1. ✅ Did I update the queue?
2. ✅ Did I run `check-queue.js`?
3. ✅ Did I interpret the exit code correctly?
4. ✅ Did I spawn next agent OR check 5D loop?
5. ✅ Did I log my decision?

If all ✅ → Protocol followed correctly.

If any ❌ → Review protocol and retry.

---

## Success Metric

**Before this protocol:**
- "What should we tackle next?" = common after task completion
- Permission-seeking = default behavior

**After this protocol:**
- "What should we tackle next?" = only when genuinely stuck
- Autonomous loop-back = default behavior

**The test:** Did you ask permission when the queue had the answer?
- If NO: ✅ Protocol working
- If YES: ❌ Review protocol, check queue first

---

## FAQ

### Q: What if the task was LOW priority?

**A:** Still run the protocol. The queue might have HIGH priority tasks added since you started the LOW task.

### Q: What if I'm not in a heartbeat session?

**A:** This applies to ALL task completions, regardless of session type:
- Direct human requests → complete → check queue
- Heartbeat-spawned work → complete → check queue
- Subagent returns → check queue
- Cron job completes → check queue

### Q: What if check-queue.js fails to run?

**A:** That's a blocker. Report: "Queue checker failed with error X. Need help debugging." This is a legitimate ask.

### Q: Do I check queue after EVERY message?

**A:** No. Only after **completing a task**. Conversational responses don't need queue checks.

**Needs queue check:**
- ✅ Finished building feature
- ✅ Completed research task
- ✅ Subagent reported completion
- ✅ Published content
- ✅ Deployed code

**Doesn't need queue check:**
- ❌ Answering factual question
- ❌ Confirming receipt of message
- ❌ Providing status update mid-task
- ❌ Reporting a blocker

---

## Version History

**v1.0 (Feb 4, 2026):**
- Initial protocol
- Addresses permission-seeking after task completion
- Closes autonomy loop-back gap
- Mandatory queue re-check after every task

---

*The loop never stops. Every task completion is a decision point. Check the queue before asking the human.*
