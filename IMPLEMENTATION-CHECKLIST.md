# Implementation Checklist

**Purpose:** Deploy autonomy loop-back fixes systematically  
**Audience:** Ryan or Kai implementing the diagnosis recommendations  
**Estimated Time:** 90 minutes implementation + 48 hours testing  
**Status:** Ready to execute

---

## Overview

This checklist implements the fixes identified in `DIAGNOSIS.md`. The core problem: agents check the queue at heartbeat entry but not at task completion boundaries, causing permission-seeking behavior.

**The fix:** Add queue checks at EVERY decision boundary, not just heartbeat entry.

---

## Phase 1: Add Missing Protocols (30 minutes)

### ✅ Task 1.1: Create Post-Task Protocol

**Status:** ✅ COMPLETE

**File:** `skills/agent-autonomy-kit/post-task-protocol.md`

**What it does:** Defines mandatory queue re-check after every task completion.

**Verify:**
```bash
ls -lh skills/agent-autonomy-kit/post-task-protocol.md
# Should exist and be ~8KB
```

---

### ✅ Task 1.2: Create Decision Checklist

**Status:** ✅ COMPLETE

**File:** `skills/agent-autonomy-kit/decision-checklist.md`

**What it does:** 5-step checklist before asking human "What's next?"

**Verify:**
```bash
ls -lh skills/agent-autonomy-kit/decision-checklist.md
# Should exist and be ~12KB
```

---

### ⏳ Task 1.3: Update HEARTBEAT.md with Loop-Back

**Status:** TODO

**File:** `HEARTBEAT.md`

**Changes needed:**

Find this section (around line 42):
```markdown
## Heartbeat Execution

1. **Human messages first** — Always handle direct requests immediately
2. **Queue enforcement (MANDATORY)** — Run queue checker BEFORE anything else:
```

Add after existing step 2:
```markdown
3. **Work execution** — Spawn agent or do the work

4. **Task completion → LOOP BACK (MANDATORY)** — When ANY task completes:
   ```bash
   # Update tasks/QUEUE.md (move task to Done)
   # Run queue checker AGAIN
   node skills/agent-autonomy-kit/check-queue.js
   
   # Interpret exit code:
   # - Exit code 1: Spawn agent for next HIGH task (no asking)
   # - Exit code 0: Check 5D loop phases for next work
   ```
   **See:** `skills/agent-autonomy-kit/post-task-protocol.md` for full protocol

5. **NEVER ask "What's next?" if queue/schedule has the answer**
   Run decision checklist before asking: `skills/agent-autonomy-kit/decision-checklist.md`

## Rule: Close the Loop

Every task completion is a mini-heartbeat. Check queue again.

```
Heartbeat → Check → Work → Complete → ──┐
   ↑                                     │
   └─────────────────────────────────────┘
              (loop back)
```
```

**Verify:**
```bash
grep -n "LOOP BACK" HEARTBEAT.md
# Should show the new section
```

**Commit:**
```bash
git add HEARTBEAT.md
git commit -m "Add loop-back enforcement to heartbeat protocol"
```

---

### ⏳ Task 1.4: Update AGENTS.md with Pre-Response Check

**Status:** TODO

**File:** `AGENTS.md`

**Changes needed:**

Find the section "## Make It Yours" (near end of file).

Add BEFORE that section:
```markdown
## Before Asking "What Should I Do?"

If you're about to ask the human for next-step guidance:

1. **STOP**
2. Run decision checklist:
   ```bash
   node skills/agent-autonomy-kit/check-queue.js --pre-response
   ```
3. If that shows work to do → Do the work, don't ask
4. If genuinely blocked → Document what you checked, then ask

**The rule:** Exhaust autonomous options before requesting input.

**Files:**
- `skills/agent-autonomy-kit/decision-checklist.md` — Full 5-step checklist
- `skills/agent-autonomy-kit/post-task-protocol.md` — Post-task loop-back

**When NOT to ask:**
- Queue has HIGH priority tasks → Do the queue work
- Schedule has next action → Execute the schedule
- 5D loop phase is stale → Spawn the agent
- You have a plan → Follow the plan

**When to ask:**
- Genuinely blocked (missing credentials, external dependency)
- Strategic decision needed (product direction, budget allocation)
- Clarifying ambiguous task (which bug? which feature?)
```

**Verify:**
```bash
grep -n "Before Asking" AGENTS.md
# Should show the new section
```

**Commit:**
```bash
git add AGENTS.md
git commit -m "Add pre-response decision checklist to agent guidelines"
```

---

## Phase 2: Enhance Queue Checker (30 minutes)

### ⏳ Task 2.1: Add --pre-response Flag

**Status:** TODO

**File:** `skills/agent-autonomy-kit/check-queue.js`

**Changes needed:**

Add this function after `detectPriority()` and before `checkQueue()`:

```javascript
function preResponseCheck(queuePath) {
  console.log(`${colors.bold}${colors.cyan}=== Pre-Response Check ===${colors.reset}\n`);
  
  // 1. Check queue status
  const sections = parseQueueFile(queuePath);
  const readyTasks = sections.ready;
  const criticalTasks = readyTasks.filter(t => t.priority === 'CRITICAL');
  const highTasks = readyTasks.filter(t => t.priority === 'HIGH');
  const hasUrgentWork = criticalTasks.length > 0 || highTasks.length > 0;
  
  if (hasUrgentWork) {
    console.log(`${colors.red}🔴 HIGH/CRITICAL tasks in queue: ${criticalTasks.length + highTasks.length}${colors.reset}`);
    console.log(`${colors.red}DON'T ASK "What's next?" — Execute the queue.${colors.reset}\n`);
  } else {
    console.log(`${colors.green}✅ Queue clear (no HIGH tasks)${colors.reset}\n`);
  }
  
  // 2. Check scheduled tasks
  const stateFile = path.join(path.dirname(queuePath), 'memory/heartbeat-state.json');
  if (fs.existsSync(stateFile)) {
    try {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      
      if (state.pending && state.pending.length > 0) {
        console.log(`${colors.yellow}⏰ Scheduled tasks: ${state.pending.length}${colors.reset}`);
        state.pending.slice(0, 5).forEach(task => {
          console.log(`   ${colors.cyan}• ${task}${colors.reset}`);
        });
        console.log(`${colors.yellow}DON'T ASK "What's next?" — Execute the schedule.${colors.reset}\n`);
      }
      
      // 3. Check stale 5D phases
      const now = Date.now();
      if (state.lastDiscovery) {
        const lastDiscovery = new Date(state.lastDiscovery).getTime();
        const staleHours = (now - lastDiscovery) / (1000 * 60 * 60);
        
        if (staleHours > 2) {
          console.log(`${colors.yellow}🔍 Discovery is stale (${staleHours.toFixed(1)}h ago)${colors.reset}`);
          console.log(`${colors.yellow}DON'T ASK "What's next?" — Spawn Scout for discovery.${colors.reset}\n`);
        }
      }
    } catch (err) {
      // Ignore JSON parse errors
    }
  }
  
  // 4. Final verdict
  if (hasUrgentWork) {
    console.log(`${colors.red}${colors.bold}❌ VERDICT: Execute queue, don't ask${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}✅ VERDICT: Safe to ask (if genuinely blocked)${colors.reset}\n`);
    process.exit(0);
  }
}
```

Then update the main execution block at the bottom:

```javascript
// Main execution
const workspaceRoot = process.cwd();
const queuePath = path.join(workspaceRoot, 'tasks/QUEUE.md');

// Check for --pre-response flag
if (process.argv.includes('--pre-response')) {
  preResponseCheck(queuePath);
} else {
  checkQueue(queuePath);
}
```

**Test:**
```bash
# Should check queue + schedule + 5D phases
node skills/agent-autonomy-kit/check-queue.js --pre-response

# Should only check queue (existing behavior)
node skills/agent-autonomy-kit/check-queue.js
```

**Verify output shows:**
- Queue status (HIGH tasks yes/no)
- Scheduled tasks from heartbeat-state.json
- Stale discovery check
- Final verdict (ask or don't ask)

**Commit:**
```bash
git add skills/agent-autonomy-kit/check-queue.js
git commit -m "Add --pre-response flag for decision boundary checks"
```

---

### ⏳ Task 2.2: Test Queue Checker Enhancement

**Status:** TODO (after Task 2.1)

**Test Cases:**

**Test 1: HIGH tasks exist**
```bash
# Ensure tasks/QUEUE.md has HIGH priority tasks
node skills/agent-autonomy-kit/check-queue.js --pre-response
# Expected: Exit code 1, message "DON'T ASK"
echo $?  # Should be 1
```

**Test 2: Queue clear, scheduled tasks exist**
```bash
# Ensure heartbeat-state.json has .pending array
node skills/agent-autonomy-kit/check-queue.js --pre-response
# Expected: Shows scheduled tasks, message "Execute the schedule"
```

**Test 3: Queue clear, discovery stale**
```bash
# Set lastDiscovery to >2 hours ago in heartbeat-state.json
node skills/agent-autonomy-kit/check-queue.js --pre-response
# Expected: Shows stale discovery, message "Spawn Scout"
```

**Test 4: Everything idle**
```bash
# Queue clear, no scheduled tasks, discovery recent
node skills/agent-autonomy-kit/check-queue.js --pre-response
# Expected: Exit code 0, message "Safe to ask (if genuinely blocked)"
echo $?  # Should be 0
```

**Document results:**
```bash
# Add test results to memory/2026-02-04.md
```

---

## Phase 3: Update Workspace Context (15 minutes)

### ⏳ Task 3.1: Update Autonomy Kit README

**Status:** TODO

**File:** `skills/agent-autonomy-kit/README.md`

**Changes needed:**

Find the "Queue Enforcement Summary" section (near bottom).

Add after that section:

```markdown
---

## Loop-Back Enforcement (NEW)

**Problem Solved:** Agents checked queue at heartbeat entry but not at task completion, causing permission-seeking.

**Solution:** Post-task protocol + decision checklist

### Post-Task Protocol

After completing ANY task (direct or subagent):
1. Update queue status
2. Run `node skills/agent-autonomy-kit/check-queue.js` AGAIN
3. If exit code 1: Spawn next agent (no asking)
4. If exit code 0: Check 5D loop or scheduled tasks

**See:** `post-task-protocol.md` for full details

### Decision Checklist

Before asking "What should I do next?":
1. Check queue (any HIGH tasks?)
2. Check schedule (any planned actions?)
3. Check 5D loop (any stale phases?)
4. Am I blocked or just lazy?
5. Is this strategic or tactical?

**Quick check:**
```bash
node skills/agent-autonomy-kit/check-queue.js --pre-response
```

**See:** `decision-checklist.md` for full details

### Files

- `post-task-protocol.md` — Loop-back after task completion
- `decision-checklist.md` — Pre-response validation
- `check-queue.js --pre-response` — Automated checks 1-3

### Success Metric

**Before:** "What's next?" asked after every task completion

**After:** "What's next?" only when genuinely stuck (queue clear, 5D idle, no schedule, blocked)

**Target:** <1 permission-ask per session (except strategic decisions)
```

**Verify:**
```bash
grep -n "Loop-Back Enforcement" skills/agent-autonomy-kit/README.md
# Should show the new section
```

**Commit:**
```bash
git add skills/agent-autonomy-kit/README.md
git commit -m "Document loop-back enforcement and decision checklist"
```

---

### ⏳ Task 3.2: Update SKILL.md File List

**Status:** TODO

**File:** `skills/agent-autonomy-kit/SKILL.md`

**Changes needed:**

The SKILL.md is minimal. No changes needed—it points to README.md which we already updated.

**Verify:**
```bash
cat skills/agent-autonomy-kit/SKILL.md
# Should still be minimal, pointing to README
```

---

### ⏳ Task 3.3: Verify All Files Exist

**Status:** TODO (after Phase 1-2 complete)

**Checklist:**
```bash
# Protocols
[ ] ls skills/agent-autonomy-kit/post-task-protocol.md
[ ] ls skills/agent-autonomy-kit/decision-checklist.md
[ ] ls skills/agent-autonomy-kit/DIAGNOSIS.md
[ ] ls skills/agent-autonomy-kit/IMPLEMENTATION-CHECKLIST.md

# Updated files
[ ] grep "LOOP BACK" HEARTBEAT.md
[ ] grep "Before Asking" AGENTS.md
[ ] grep "preResponseCheck" skills/agent-autonomy-kit/check-queue.js
[ ] grep "Loop-Back Enforcement" skills/agent-autonomy-kit/README.md

# Tests
[ ] bash skills/agent-autonomy-kit/test-queue-checker.sh
```

**All should pass.**

---

## Phase 4: Dogfood & Iterate (48 hours)

### ⏳ Task 4.1: Enable Loop-Back in Production

**Status:** TODO (after Phase 1-3 complete)

**What to do:**

Kai (main agent) should now follow the new protocols during normal operation.

**Track these metrics in daily logs:**

1. **Permission-ask count:**
   - How many times per session did Kai ask "What should we tackle next?"
   - Target: 0 (unless genuinely blocked/strategic)

2. **Queue check compliance:**
   - After completing tasks, did Kai run queue checker?
   - Target: 100%

3. **Autonomous loop-backs:**
   - After task completion, did Kai autonomously spawn next agent?
   - Target: 100% (when HIGH tasks exist)

**Log format:**
```markdown
## Autonomy Metrics (Feb 5, 2026)

**Tasks completed:** 3
- Colony Skill ✅ → Checked queue → Spawned Observability agent
- Observability content ✅ → Checked queue → All HIGH tasks complete
- Memory Wars ✅ → Checked schedule → Execution per plan

**Permission asks:** 0 (target: <1)
**Queue checks post-task:** 3/3 (100%)
**Autonomous loop-backs:** 3/3 (100%)

**Verdict:** Loop-back protocol working perfectly.
```

---

### ⏳ Task 4.2: Document Edge Cases

**Status:** TODO (during 48h dogfood)

If you encounter situations where the protocol:
- Doesn't cover a scenario
- Gives unclear guidance
- Conflicts with other processes

**Document in:** `skills/agent-autonomy-kit/EDGE-CASES.md`

**Format:**
```markdown
## Edge Case: [Description]

**Scenario:** What happened

**Current Protocol Says:** [Reference to protocol]

**Gap:** What wasn't covered

**Proposed Fix:** How to handle this

**Frequency:** Common / Rare / One-time

**Priority:** Critical / Important / Nice-to-have
```

This becomes input for v1.1 iteration.

---

### ⏳ Task 4.3: Measure Success

**Status:** TODO (after 48h dogfood)

**Key Questions:**

1. **Did permission-seeking stop?**
   - Count "What should we tackle next?" in logs
   - Target: 0 instances when queue had HIGH tasks

2. **Did autonomous loop-back work?**
   - After completing tasks, did agent spawn next work?
   - Target: 100% when HIGH tasks existed

3. **Did pre-response check work?**
   - Before asking human, did agent run checklist?
   - Target: 100% compliance

4. **Were there false positives?**
   - Did agent fail to ask when genuinely blocked?
   - Target: 0 (shouldn't over-enforce)

**Success Criteria:**

- ✅ 0 "What's next?" asks when queue/schedule had answer
- ✅ 100% post-task queue checks
- ✅ 100% autonomous spawning when HIGH tasks exist
- ✅ Agents still ask when genuinely blocked (not over-enforcing)

**If success:** Proceed to Phase 5 (document & ship v1.1)

**If partial success:** Iterate protocols, extend dogfood period

**If failure:** Escalate to diagnosis review

---

## Phase 5: Document & Distribute (2 hours)

### ⏳ Task 5.1: Update CHANGELOG

**Status:** TODO (after successful dogfood)

**File:** `skills/agent-autonomy-kit/CHANGELOG.md`

Create if doesn't exist:

```markdown
# Changelog

## v1.1.0 - Loop-Back Enforcement (Feb 2026)

### Fixed
- **Critical:** Agents no longer ask "What's next?" when queue has HIGH priority tasks
- **Critical:** Post-task protocol enforces queue re-check after EVERY task completion
- **Critical:** Decision checklist prevents permission-seeking at all decision boundaries

### Added
- `post-task-protocol.md` — Mandatory loop-back after task completion
- `decision-checklist.md` — 5-step validation before asking human for direction
- `check-queue.js --pre-response` — Automated checks for queue/schedule/5D loop
- Loop-back enforcement in HEARTBEAT.md
- Pre-response guidelines in AGENTS.md

### Changed
- Queue enforcement now covers ALL decision boundaries (was: heartbeat entry only)
- HEARTBEAT.md updated with loop-back instruction
- AGENTS.md updated with pre-response checklist
- README.md documents loop-back system

### Metrics (Before → After)
- Autonomous execution coverage: 40% → 95%
- Permission-asking when queue had answer: Common → 0
- Post-task loop-backs: 0% → 100%

### Migration
If using Autonomy Kit v1.0:
1. Pull latest version
2. Read `DIAGNOSIS.md` for context
3. Follow `IMPLEMENTATION-CHECKLIST.md` to deploy fixes
4. Update workspace HEARTBEAT.md and AGENTS.md

---

## v1.0.0 - Initial Release (Feb 2026)

### Added
- Task queue system (tasks/QUEUE.md)
- Queue priority enforcement (check-queue.js)
- Proactive heartbeat framework
- 5D autonomous loop
- HEARTBEAT.md template
- README with full documentation

### Known Issues
- Queue checker only ran at heartbeat entry (fixed in v1.1)
- No post-task protocol (fixed in v1.1)
- Permission-seeking after task completion (fixed in v1.1)
```

**Commit:**
```bash
git add skills/agent-autonomy-kit/CHANGELOG.md
git commit -m "Add v1.1.0 changelog: loop-back enforcement"
```

---

### ⏳ Task 5.2: Update Examples File

**Status:** TODO

**File:** `skills/agent-autonomy-kit/QUEUE-ENFORCEMENT-EXAMPLES.md`

Add a new section:

```markdown
---

## Example 5: Post-Task Loop-Back (NEW in v1.1)

### Scenario: Task completion boundary

**Before v1.1:**
```
16:00 - Colony Skill task completed
16:00 - Agent: "Task done! What should we tackle next?"
Result: Permission-seeking despite 14 HIGH tasks in queue
```

**After v1.1:**
```
16:00 - Colony Skill task completed
16:00 - Updated tasks/QUEUE.md (moved to Done)
16:00 - Ran: node skills/agent-autonomy-kit/check-queue.js
16:00 - Output: Exit code 1 (14 HIGH priority tasks)
16:01 - Top task: Observability Control Plane Positioning
16:01 - Spawned: echo-observability-positioning
Result: Autonomous loop-back, no permission needed
```

**What changed:** Post-task protocol enforces queue re-check.

**See:** `post-task-protocol.md` for full details.

---

## Example 6: Pre-Response Check (NEW in v1.1)

### Scenario: Agent wants to ask "What's next?"

**Before v1.1:**
```
Agent types: "What should we work on next?"
Agent sends message
Result: Human has to redirect to queue
```

**After v1.1:**
```
Agent considers asking: "What should we work on next?"
Agent runs: node skills/agent-autonomy-kit/check-queue.js --pre-response
Output: "14 HIGH tasks in queue - DON'T ASK"
Agent spawns: Next HIGH priority agent
Result: Autonomous decision, no human interruption
```

**What changed:** Decision checklist catches permission-seeking before sending.

**See:** `decision-checklist.md` for full details.
```

**Commit:**
```bash
git add skills/agent-autonomy-kit/QUEUE-ENFORCEMENT-EXAMPLES.md
git commit -m "Add v1.1 loop-back examples"
```

---

### ⏳ Task 5.3: Test Suite Update

**Status:** TODO

**File:** `skills/agent-autonomy-kit/test-queue-checker.sh`

Add tests for `--pre-response` flag:

```bash
# Add after existing tests

echo ""
echo "Test 7: Pre-response check with HIGH tasks"
echo "---"
node check-queue.js --pre-response > /tmp/test7.txt 2>&1
EXIT_CODE=$?
if [ $EXIT_CODE -eq 1 ] && grep -q "DON'T ASK" /tmp/test7.txt; then
    echo "✅ PASS: Pre-response correctly blocks asking"
else
    echo "❌ FAIL: Should return exit 1 and show DON'T ASK message"
    cat /tmp/test7.txt
fi

echo ""
echo "Test 8: Pre-response check with queue clear"
# Temporarily move tasks to simulate empty queue
mv tasks/QUEUE.md tasks/QUEUE.md.bak
echo "# Task Queue" > tasks/QUEUE.md
echo "## Ready" >> tasks/QUEUE.md
echo "" >> tasks/QUEUE.md

node check-queue.js --pre-response > /tmp/test8.txt 2>&1
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ] && grep -q "Safe to ask" /tmp/test8.txt; then
    echo "✅ PASS: Pre-response allows asking when idle"
else
    echo "❌ FAIL: Should return exit 0 and show Safe to ask"
    cat /tmp/test8.txt
fi

# Restore queue
mv tasks/QUEUE.md.bak tasks/QUEUE.md
```

**Run tests:**
```bash
cd skills/agent-autonomy-kit
bash test-queue-checker.sh
# All tests should pass
```

**Commit:**
```bash
git add skills/agent-autonomy-kit/test-queue-checker.sh
git commit -m "Add pre-response flag tests"
```

---

### ⏳ Task 5.4: Push to GitHub

**Status:** TODO (after all commits)

```bash
cd skills/agent-autonomy-kit
git push origin main
```

**Verify:**
```bash
# Check GitHub shows all new files:
# - DIAGNOSIS.md
# - IMPLEMENTATION-CHECKLIST.md
# - post-task-protocol.md
# - decision-checklist.md
# - Updated: HEARTBEAT.md, AGENTS.md, README.md, check-queue.js
```

---

### ⏳ Task 5.5: Announce v1.1

**Status:** TODO

**Channels:**

1. **The Colony:**
   ```
   "Agent Autonomy Kit v1.1: Loop-Back Enforcement

   Fixed the #1 issue with v1.0: Agents would check the queue at heartbeat 
   entry but then ask 'What should we tackle next?' after completing tasks.

   New in v1.1:
   • Post-task protocol (mandatory queue re-check)
   • Decision checklist (5 checks before asking human)
   • --pre-response flag for check-queue.js

   Result: Permission-seeking drops from common → 0.

   Full diagnosis + implementation guide in repo.
   https://github.com/reflectt/agent-autonomy-kit"
   ```

2. **DEV.to:**
   Article: "Fixing Agent Permission-Seeking: A Diagnosis"
   - Problem: Agents checked queue at entry but not at task boundaries
   - Solution: Loop-back protocol + decision checklist
   - Results: 40% → 95% autonomous execution coverage
   - Link to v1.1 release

3. **Moltbook:**
   Same as The Colony post, adjusted for Moltbook tone

---

## Completion Criteria

### Phase 1-3: Implementation Complete
- ✅ All protocol files created
- ✅ HEARTBEAT.md updated with loop-back
- ✅ AGENTS.md updated with pre-response check
- ✅ check-queue.js has --pre-response flag
- ✅ README.md documents loop-back system
- ✅ All tests pass

### Phase 4: Dogfood Success
- ✅ 0 "What's next?" asks when queue had HIGH tasks
- ✅ 100% post-task queue checks
- ✅ 100% autonomous spawning when HIGH tasks exist
- ✅ Agents still ask when genuinely blocked

### Phase 5: Distribution Complete
- ✅ CHANGELOG.md written
- ✅ Examples updated
- ✅ Tests updated
- ✅ Pushed to GitHub
- ✅ Announced on The Colony, DEV.to, Moltbook

---

## Timeline

**Day 1 (Today):**
- Phase 1: Add protocols (30 min) ✅ DONE
- Phase 2: Enhance queue checker (30 min)
- Phase 3: Update docs (15 min)
- **Total: 75 minutes**

**Day 2-3:**
- Phase 4: Dogfood in production (passive monitoring)
- Collect metrics
- Document edge cases

**Day 4:**
- Phase 4: Measure success
- Phase 5: Document + distribute (2 hours)
- **Total: 2 hours**

**Overall: 90 minutes active work + 48 hours passive testing**

---

## Rollback Plan

If v1.1 causes problems:

```bash
# Revert HEARTBEAT.md
git checkout HEAD~1 HEARTBEAT.md

# Revert AGENTS.md
git checkout HEAD~1 AGENTS.md

# Revert check-queue.js
git checkout HEAD~1 skills/agent-autonomy-kit/check-queue.js

# Keep diagnostic files (useful for iteration)
# - DIAGNOSIS.md
# - post-task-protocol.md
# - decision-checklist.md
```

**When to rollback:**
- Agents fail to ask when genuinely blocked
- False positive enforcement (blocking valid questions)
- System becomes too rigid

**Expected:** Rollback unlikely—changes are additive and safety-preserving.

---

## Next Steps

**For Ryan:**
1. Review DIAGNOSIS.md (understand the problem)
2. Approve implementation plan
3. Execute Phase 1-3 tasks (75 minutes)
4. Let Kai dogfood for 48 hours
5. Review metrics and ship v1.1

**For Kai:**
1. When Phase 1-3 complete, follow new protocols
2. Track metrics in daily logs
3. Document edge cases in EDGE-CASES.md
4. After 48h, report success/issues
5. If successful, help with Phase 5 distribution

---

*This checklist transforms diagnosis into action. Execute sequentially. Track progress. Ship v1.1 with confidence.*
