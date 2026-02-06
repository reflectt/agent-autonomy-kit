# Queue Enforcement Examples

**Problem:** Before queue enforcement, agents would skip HIGH priority tasks and say HEARTBEAT_OK.

**Solution:** The queue checker script makes it **impossible** to skip queue tasks.

---

## How It Works

### Step 1: Run the Queue Checker

Every heartbeat, BEFORE doing anything else:

```bash
node skills/agent-autonomy-kit/check-queue.js
```

### Step 2: Interpret the Exit Code

- **Exit code 0**: Queue is clear → Safe to proceed with other work
- **Exit code 1**: HIGH/Critical tasks exist → **MUST spawn agent**

### Step 3: Enforce the Rule

If exit code is 1, you **CANNOT**:
- Say "HEARTBEAT_OK"
- Work on pet projects
- Do discovery or proactive work
- Check email or social media

You **MUST**:
- Spawn a subagent for the top priority task
- Wait for completion or hand off to next heartbeat
- Update the queue when task is done

---

## Real Example: Heartbeat Flow

### Scenario: Agent receives heartbeat

```
[15:30] Heartbeat received
```

**Step 1: Run queue checker**

```bash
$ node skills/agent-autonomy-kit/check-queue.js

=== Queue Priority Check ===

🔴 HIGH priority tasks: 3
   • Fix authentication bug in production
   • Deploy security hotfix
   • Update API documentation

❌ CANNOT SKIP QUEUE
You must spawn an agent for HIGH/CRITICAL tasks before doing other work.

Top priority task:
Fix authentication bug in production

Exit code: 1
```

**Step 2: Agent sees exit code 1**

Agent logic:
```
IF queue_checker_exit_code == 1:
    MUST spawn agent for top task
    CANNOT say HEARTBEAT_OK
```

**Step 3: Spawn subagent**

```bash
openclaw spawn \
  --label "fix-auth-bug" \
  --message "HIGH PRIORITY: Fix authentication bug in production. See tasks/QUEUE.md for details. Update queue when complete."
```

**Step 4: Log and exit**

```markdown
# memory/2026-02-04.md

15:30 - Heartbeat received
15:30 - Queue checker detected HIGH priority tasks (3 total)
15:30 - Spawned agent: fix-auth-bug for top task
15:31 - Waiting for task completion before next heartbeat cycle
```

---

## Example 2: Clear Queue

### Scenario: No HIGH priority tasks

**Step 1: Run queue checker**

```bash
$ node skills/agent-autonomy-kit/check-queue.js

=== Queue Priority Check ===

🟢 LOW priority tasks: 2

✅ Safe to continue
No HIGH/CRITICAL tasks in queue. You can proceed with other work.

Exit code: 0
```

**Step 2: Agent sees exit code 0**

Agent logic:
```
IF queue_checker_exit_code == 0:
    Safe to proceed with:
    - 5D Loop phases
    - Proactive discovery
    - Documentation improvements
    - Research tasks
```

**Step 3: Agent can do other work**

The agent is now free to:
- Check for review gates
- Run Scout for discovery
- Update documentation
- Work on LOW priority tasks if desired

---

## Example 3: Multiple HIGH Priority Tasks

### Scenario: 12 HIGH priority tasks in queue

**Step 1: Run queue checker**

```bash
$ node skills/agent-autonomy-kit/check-queue.js

=== Queue Priority Check ===

🔴 HIGH priority tasks: 12
   • DEV.to follow-up article
   • The Colony post
   • Moltbook announcements
   • Token Budget Tracking
   • Memory Kit v2
   • Team Kit improvements
   • Vercel Analytics integration
   • Blog content series
   • Premium features
   • Favicon design
   • Agent profile additions
   • Show HN post

❌ CANNOT SKIP QUEUE
You must spawn an agent for HIGH/CRITICAL tasks before doing other work.

Top priority task:
DEV.to follow-up article

Exit code: 1
```

**Step 2: Spawn for TOP task only**

Don't try to do all 12 at once. Spawn for the **first** one:

```bash
openclaw spawn \
  --label "devto-article" \
  --message "HIGH PRIORITY: Write DEV.to follow-up article 'Why We Built 9 Agent Kits in 1 Day'. See tasks/QUEUE.md for details."
```

**Step 3: Next heartbeat handles next task**

After the first task completes:
- Queue checker runs again
- Now shows 11 HIGH priority tasks
- Spawn agent for the new top task
- Repeat until all HIGH tasks are handled

**This prevents:**
- Overwhelming the system with 12 parallel agents
- Token budget exhaustion
- Context switching chaos

**This ensures:**
- Sequential processing of important work
- Proper handoffs between tasks
- Clear progress tracking

---

## Example 4: CRITICAL Task (Drop Everything)

### Scenario: Production is down

**Task in QUEUE.md:**
```markdown
## 🔥 High Priority

- [ ] [CRITICAL] 🔥 Production database connection failing - users locked out
```

**Queue Checker Output:**

```bash
$ node skills/agent-autonomy-kit/check-queue.js

=== Queue Priority Check ===

🔥 CRITICAL tasks: 1
   • [CRITICAL] 🔥 Production database connection failing - users locked out

❌ CANNOT SKIP QUEUE
You must spawn an agent for HIGH/CRITICAL tasks before doing other work.

Top priority task:
[CRITICAL] 🔥 Production database connection failing - users locked out

Exit code: 1
```

**Agent Response:**

Immediately spawn with maximum priority:

```bash
openclaw spawn \
  --label "critical-db-fix" \
  --model "claude-opus-4" \
  --thinking "high" \
  --message "🔥 CRITICAL: Production database connection failing. Users locked out. Investigate and fix immediately. Escalate to Ryan if needed."
```

Notify human:

```bash
openclaw message send \
  --target "ryan" \
  --message "🚨 CRITICAL task detected: Production DB failing. Spawned agent 'critical-db-fix' to investigate. Standing by for escalation if needed."
```

---

## Anti-Patterns (What NOT to Do)

### ❌ BAD: Saying HEARTBEAT_OK when queue has HIGH tasks

```
Agent: "Queue has 3 HIGH priority tasks, but I'll do discovery instead. HEARTBEAT_OK."
```

**Why it's bad:** Skips explicit needs for speculative work.

### ❌ BAD: "Interpreting" priority away

```
Agent: "The task says HIGH but it's been there for 2 days, so it can't be that urgent. HEARTBEAT_OK."
```

**Why it's bad:** Agent discretion defeats the purpose of the queue.

### ❌ BAD: Spawning multiple agents for all HIGH tasks

```
Agent: "12 HIGH tasks detected. Spawning 12 agents..."
```

**Why it's bad:** Overwhelms resources, burns tokens, creates chaos.

### ❌ BAD: Ignoring the exit code

```
Agent: "Queue checker returned exit code 1, but I really want to work on this cool feature. HEARTBEAT_OK."
```

**Why it's bad:** Defeats programmatic enforcement.

---

## Correct Patterns (What to Do)

### ✅ GOOD: Respect the exit code

```
Agent checks queue → Exit code 1 → Spawns agent for top task → Updates queue → Done
```

### ✅ GOOD: Sequential processing

```
Heartbeat 1: Spawn for task #1
Heartbeat 2: Check completion → Task #1 done → Spawn for task #2
Heartbeat 3: Check completion → Task #2 done → Spawn for task #3
...
```

### ✅ GOOD: Update queue after completion

When subagent finishes, update `tasks/QUEUE.md`:
```markdown
## ✅ Done Today
- [x] DEV.to follow-up article (completed by @echo)
```

Move task from "Ready" to "Done" so next heartbeat sees accurate state.

### ✅ GOOD: Escalate when stuck

If a HIGH task is blocked:
```markdown
## 🔵 Blocked
- [ ] Deploy to production (needs: Ryan's approval)
```

Move it from "Ready" to "Blocked" so queue checker doesn't keep spawning for it.

---

## Integration Checklist

- [ ] Queue checker script installed: `skills/agent-autonomy-kit/check-queue.js`
- [ ] HEARTBEAT.md updated with mandatory queue check
- [ ] Agent understands exit codes (0 = clear, 1 = MUST spawn)
- [ ] Queue priorities documented (CRITICAL, HIGH, MEDIUM, LOW)
- [ ] Workflow tested: HIGH task → queue checker → spawn agent → update queue

---

## Success Metrics

**Before queue enforcement:**
- Agents skipped HIGH priority tasks
- "HEARTBEAT_OK" without checking queue
- Human had to remind agents about urgent work

**After queue enforcement:**
- Exit code 1 = impossible to skip HIGH tasks
- Agents spawn work automatically for queue priorities
- Queue gets worked down systematically
- Human only intervenes for blocked tasks or strategic decisions

---

**The Rule:** If `check-queue.js` returns exit code 1, you MUST spawn an agent. No exceptions. No discretion. No "but I think this other thing is more important."

**The Result:** Autonomous agents that actually work on what matters, not what's interesting.
