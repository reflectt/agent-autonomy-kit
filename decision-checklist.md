# Decision Checklist

**Purpose:** Prevent permission-seeking when autonomous paths exist  
**When to Use:** Before asking human "What should I do?" or "What's next?"  
**Status:** MANDATORY gate before requesting human input on task selection  
**Version:** 1.0  
**Last Updated:** Feb 4, 2026

---

## The Problem

Agents were asking humans for next-step guidance even when:
- The queue had HIGH priority tasks ready to work
- Plans/schedules already documented the next action
- 5D loop phases had obvious next steps
- No genuine blocker existed

**Result:** Autonomous execution worked during heartbeats but failed at decision boundaries.

---

## The Solution

**Before asking "What should I do next?", run this checklist.**

If you pass all checks → You're genuinely blocked, okay to ask.

If you fail any check → You're not blocked, you just haven't executed autonomously yet.

---

## The Checklist

### ✅ Check 1: Is This in the Queue?

**Action:**
```bash
node skills/agent-autonomy-kit/check-queue.js
```

**Decision:**
- Exit code 1 (HIGH/CRITICAL tasks exist): **STOP. Don't ask. Execute the queue.**
- Exit code 0 (no HIGH tasks): Continue to Check 2

**Why:**  
The queue is the authoritative source for prioritized work. If HIGH priority tasks exist, you don't need permission—you have direction.

**Example FAIL:**
```
Agent: "What should we tackle next?"
Queue: 14 HIGH priority tasks exist
Result: Agent should spawn for top HIGH task, not ask
```

**Example PASS:**
```
Agent: "Stuck: Need API key for deployment"
Queue: Deploy to production is HIGH priority
Result: Legitimate blocker, okay to ask
```

---

### ✅ Check 2: Is This in a Plan/Schedule?

**Action:**
```bash
# Check heartbeat state for scheduled tasks
cat memory/heartbeat-state.json | jq '.pending'
```

**Decision:**
- If scheduled tasks exist for next 24h: **STOP. Don't ask. Execute the schedule.**
- If no scheduled tasks: Continue to Check 3

**Why:**  
Plans document decisions already made. If the schedule says "Launch Feb 6, 9 AM," you don't need approval—you need execution.

**Example FAIL:**
```
Agent: "Content is ready. Should we launch tomorrow as planned?"
Schedule: "Observability launch Feb 6, 9 AM PST"
Current time: Feb 5, 6:20 PM PST
Result: Plan exists, agent should execute schedule, not ask
```

**Example PASS:**
```
Agent: "Scheduled launch is tomorrow, but discovered critical bug. Should we delay?"
Schedule: Launch planned
New context: Critical bug (unplanned blocker)
Result: Valid question—strategic decision needed
```

---

### ✅ Check 3: Have I Checked 5D Loop Phases?

**Action:** Read HEARTBEAT.md and check each phase:

1. **DISCOVER:** When was last discovery run?
   - Check: `memory/heartbeat-state.json` → `lastDiscovery`
   - If >2 hours ago: **STOP. Don't ask. Spawn Scout.**

2. **DEFINE:** Are there un-triaged opportunities?
   - Check: `process/OPPORTUNITIES.md` for new discoveries
   - If yes: **STOP. Don't ask. Spawn Sage.**

3. **DESIGN:** Are there specs without design?
   - Check: `tasks/DEFINE-*.md` files needing design
   - If yes: **STOP. Don't ask. Spawn Pixel.**

4. **DEVELOP:** Are there designed projects ready to build?
   - Check: Project folders with design but no code
   - If yes: **STOP. Don't ask. Spawn Link.**

5. **DEPLOY:** Are there built projects not yet announced?
   - Check: Completed projects not in distribution channels
   - If yes: **STOP. Don't ask. Spawn Spark/Echo.**

**Decision:**
- If ANY phase shows work to do: **STOP. Don't ask. Spawn the agent.**
- If all phases are current: Continue to Check 4

**Why:**  
The 5D loop generates work autonomously. If phases are stale, you have direction—you don't need permission.

**Example FAIL:**
```
Agent: "Queue is clear. What should I work on?"
Discovery: Last run 4 hours ago (stale)
Result: Agent should spawn Scout, not ask
```

**Example PASS:**
```
Agent: "All 5D phases current, queue clear, no scheduled tasks. Ready for new direction."
5D Loop: All phases healthy (<2h old)
Queue: Empty
Schedule: None for next 24h
Result: Truly idle, valid question
```

---

### ✅ Check 4: Am I Actually Blocked?

**Questions to ask yourself:**

1. **Missing information I can't find?**
   - Searched .secrets/ for credentials? ✅
   - Checked documentation? ✅
   - Tried web search? ✅
   - Still missing critical info? → Okay to ask

2. **Waiting on external dependency?**
   - Human approval needed (deploy to production, budget)? → Okay to ask
   - API access/credentials needed? → Okay to ask
   - Third-party service down? → Escalate, not ask for direction

3. **Technical blocker I can't solve?**
   - Tried debugging? ✅
   - Searched error messages? ✅
   - Checked GitHub issues? ✅
   - Still stuck? → Okay to ask

**Decision:**
- If genuinely blocked: Continue to Check 5
- If not blocked: **STOP. Don't ask. Do the work.**

**Why:**  
"I don't know what to do" is usually "I haven't checked the queue/schedule/5D loop." Genuine blocks are specific ("Missing API key for X").

**Example FAIL:**
```
Agent: "Finished task. What's next?"
Reality: Not blocked, just hasn't checked queue
Result: Run queue checker first
```

**Example PASS:**
```
Agent: "Need production deploy approval for security patch"
Reality: Blocked by policy (human approval required)
Result: Valid escalation
```

---

### ✅ Check 5: Is This a Strategic Decision Outside My Scope?

**Strategic decisions = human authority:**
- Product direction changes (pivot features, sunset products)
- Budget allocation (subscribe to paid service, hire contractors)
- Policy changes (change deployment process, access controls)
- External commitments (conference talks, partnerships)

**Tactical decisions = agent authority:**
- Which queue task to work next (queue priority decides)
- How to implement a feature (technical decisions)
- When to spawn subagents (workflow optimization)
- Content scheduling (if plan exists)

**Decision:**
- If strategic decision: **Okay to ask** (this is the exception)
- If tactical decision: **STOP. Don't ask. Decide autonomously.**

**Why:**  
Agents should own execution. Humans should own strategy. Don't escalate tactical decisions.

**Example PASS:**
```
Agent: "Should we pivot forAgents.dev to focus on MCP tools instead of agents?"
Type: Strategic (product direction)
Result: Valid question—human decision needed
```

**Example FAIL:**
```
Agent: "Should I write the blog post in markdown or HTML?"
Type: Tactical (implementation detail)
Result: Agent should decide (markdown = standard)
```

---

## How to Use This Checklist

### Option 1: Manual Checklist (Always Available)

Before asking "What should I do next?", work through checks 1-5 above. If you pass all checks, you're blocked—okay to ask.

### Option 2: Automated Check (Preferred)

Run the queue checker with `--pre-response` flag:

```bash
node skills/agent-autonomy-kit/check-queue.js --pre-response
```

This automatically checks:
- Queue status (Check 1)
- Scheduled tasks from heartbeat-state.json (Check 2)
- Stale 5D phases (Check 3)

Then manually verify Checks 4-5 (blocking vs strategic).

---

## Examples in Practice

### ❌ FAIL: Asking Without Checking

**Agent:**
```
Just finished the Colony Skill task. What should we tackle next?
```

**Analysis:**
- ❌ Check 1: Didn't run queue checker (14 HIGH tasks exist)
- ❌ Check 3: Didn't check 5D loop
- **Verdict:** FAIL—autonomous path existed, shouldn't ask

**Correct Action:**
```bash
node skills/agent-autonomy-kit/check-queue.js
# Output: "14 HIGH priority tasks exist"
# Spawn agent for top task: Observability Control Plane
```

---

### ❌ FAIL: Deferring Scheduled Decisions

**Agent:**
```
Content is ready for the Observability launch. When do you want to publish?
```

**Analysis:**
- ❌ Check 2: Didn't check schedule
- Schedule shows: "Feb 6, 9 AM PST launch"
- **Verdict:** FAIL—plan exists, shouldn't ask

**Correct Action:**
```bash
cat memory/heartbeat-state.json | jq '.reviewGate'
# Shows: "scheduledLaunch": "2026-02-06T17:00:00Z"
# Decision: Execute schedule as planned
```

---

### ✅ PASS: Legitimate Strategic Question

**Agent:**
```
Should we submit x402 to the OpenClaw USDC Hackathon? 
- Deadline: Feb 8 (4 days)
- Prize: $30K
- Trade-off: Takes 2-3 days from other work

This is a strategic decision—prize vs opportunity cost.
```

**Analysis:**
- ✅ Check 1: Queue clear (no blocking HIGH tasks)
- ✅ Check 2: No conflicting schedule
- ✅ Check 3: 5D phases current
- ✅ Check 4: Not blocked (technically feasible)
- ✅ Check 5: Strategic decision (resource allocation)
- **Verdict:** PASS—valid strategic question

---

### ✅ PASS: Genuine Blocker

**Agent:**
```
Checked queue: Deploy security patch is HIGH priority.
Tried to deploy but need production API key (not in .secrets/).
Searched docs, no key found.
Blocked: Need production credentials.
```

**Analysis:**
- ✅ Check 1: Queue has HIGH task (deploy)
- ✅ Check 4: Genuinely blocked (missing credentials)
- Searched for solution: ✅
- **Verdict:** PASS—legitimate blocker, needs escalation

---

### ✅ PASS: True Idle State

**Agent:**
```
Checked queue: exit code 0 (no HIGH tasks)
Checked 5D phases: All current (<2h)
Checked schedule: No tasks for next 24h
All active agents: complete
Status: Idle, ready for new direction
```

**Analysis:**
- ✅ Check 1: Queue clear
- ✅ Check 2: No scheduled work
- ✅ Check 3: All 5D phases healthy
- ✅ No blockers
- **Verdict:** PASS—genuinely idle, valid to ask

---

## Integration with Other Systems

### Works With: Post-Task Protocol

After completing a task:
1. Run post-task-protocol.md (check queue)
2. If queue clear → Run this decision checklist
3. If still nothing → Then ask human

### Works With: HEARTBEAT.md

Heartbeat execution:
1. Check queue (entry point)
2. Do work
3. Task completes → Post-task protocol → Decision checklist

### Works With: AGENTS.md

Before responding to human:
1. Read AGENTS.md (identity, context)
2. If about to ask "What's next?" → Run decision checklist
3. If passed checklist → Okay to ask

---

## Measuring Success

### Before Checklist
- "What should we tackle next?" = Common
- Permission-seeking = Default after task completion
- Autonomous execution = 40% (heartbeat entry only)

### After Checklist
- "What should we tackle next?" = Rare (only when truly idle)
- Permission-seeking = Only for blocks/strategy
- Autonomous execution = 95%+ (all decision boundaries)

### Key Metrics

Track in daily logs:
- **Permission asks per session:** Target <1 (only genuine blocks)
- **Queue-checked before asking:** Target 100%
- **Strategic vs tactical asks:** Strategic okay, tactical should be 0

---

## FAQ

### Q: This feels like a lot of steps. Do I really need all 5 checks?

**A:** Not always. Often Check 1 (queue) is enough. But if you're about to ask the human for direction, spending 2 minutes on the checklist saves everyone time.

**Shortcut:** Run `check-queue.js --pre-response` (covers Checks 1-3).

### Q: What if I'm 90% sure I should ask but one check fails?

**A:** Follow the check. That's the point—we trust the system over intuition. If the queue says HIGH task exists, do the task. Don't ask.

### Q: Can I ask clarifying questions about tasks?

**A:** Yes! Clarifying questions are different from permission-seeking:

**Permission-seeking (don't ask):**
- "What should we work on?"
- "Should we launch?"

**Clarifying (okay to ask):**
- "Task says 'fix auth bug'—is this the login issue or OAuth?"
- "HIGH priority: Deploy. Need approval before production deploy?"

### Q: What if the queue has LOW priority tasks?

**A:** Check 5D loop phases. If phases are idle and no scheduled work, you can:
1. Pick LOW task and work it
2. Do proactive discovery
3. Ask human for new priorities

LOW tasks don't block asking—only HIGH/CRITICAL do.

### Q: What if I disagree with queue priority?

**A:** Don't override the queue silently. Instead:
1. Follow the queue as written (do the HIGH task)
2. Afterwards, document why priority might be wrong
3. Suggest re-prioritization to human or Rhythm (queue owner)

Trust the system unless you have data showing it's wrong.

---

## Version History

**v1.0 (Feb 4, 2026):**
- Initial checklist
- 5 checks: Queue, Schedule, 5D Loop, Blocking, Strategic
- Prevents permission-seeking at decision boundaries
- Integration with post-task protocol

---

*Exhaust autonomous options before requesting input. Check the queue before asking the human.*
