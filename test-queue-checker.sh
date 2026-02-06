#!/bin/bash
# Test script for queue checker enforcement

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUEUE_CHECKER="$SCRIPT_DIR/check-queue.js"
TEST_QUEUE_DIR="$(mktemp -d)"
TEST_QUEUE="$TEST_QUEUE_DIR/QUEUE.md"

echo "🧪 Testing Queue Checker Enforcement"
echo "===================================="
echo ""

# Test 1: Empty queue
echo "Test 1: Empty queue (should return 0)"
mkdir -p "$TEST_QUEUE_DIR/tasks"
cat > "$TEST_QUEUE_DIR/tasks/QUEUE.md" << 'EOF'
# Task Queue

## 🔥 High Priority

## 🟡 Medium Priority

## ✅ Done
EOF

cd "$TEST_QUEUE_DIR"
if node "$QUEUE_CHECKER"; then
  echo "✅ PASS: Empty queue returned exit code 0"
else
  echo "❌ FAIL: Empty queue should return 0"
  exit 1
fi
echo ""

# Test 2: Only LOW priority tasks
echo "Test 2: Only LOW priority tasks (should return 0)"
cat > "$TEST_QUEUE_DIR/tasks/QUEUE.md" << 'EOF'
# Task Queue

## 🔥 High Priority
- [ ] [LOW] Update documentation
- [ ] [LOW] Refactor old code

## ✅ Done
EOF

if node "$QUEUE_CHECKER"; then
  echo "✅ PASS: LOW priority tasks returned exit code 0"
else
  echo "❌ FAIL: LOW priority tasks should return 0"
  exit 1
fi
echo ""

# Test 3: HIGH priority task exists
echo "Test 3: HIGH priority task exists (should return 1)"
cat > "$TEST_QUEUE_DIR/tasks/QUEUE.md" << 'EOF'
# Task Queue

## 🔥 High Priority
- [ ] **Fix critical authentication bug**
- [ ] [LOW] Update docs

## ✅ Done
EOF

if node "$QUEUE_CHECKER"; then
  echo "❌ FAIL: HIGH priority task should return exit code 1"
  exit 1
else
  echo "✅ PASS: HIGH priority task returned exit code 1"
fi
echo ""

# Test 4: CRITICAL priority task exists
echo "Test 4: CRITICAL priority task exists (should return 1)"
cat > "$TEST_QUEUE_DIR/tasks/QUEUE.md" << 'EOF'
# Task Queue

## 🔥 High Priority
- [ ] [CRITICAL] 🔥 Production database down

## ✅ Done
EOF

if node "$QUEUE_CHECKER"; then
  echo "❌ FAIL: CRITICAL task should return exit code 1"
  exit 1
else
  echo "✅ PASS: CRITICAL task returned exit code 1"
fi
echo ""

# Test 5: Tasks in "Done" section are ignored
echo "Test 5: Completed HIGH tasks in Done section (should return 0)"
cat > "$TEST_QUEUE_DIR/tasks/QUEUE.md" << 'EOF'
# Task Queue

## 🔥 High Priority

## ✅ Done
- [x] **Fixed authentication bug**
- [x] [HIGH] Deployed hotfix
EOF

if node "$QUEUE_CHECKER"; then
  echo "✅ PASS: Completed tasks ignored, returned exit code 0"
else
  echo "❌ FAIL: Completed tasks should be ignored"
  exit 1
fi
echo ""

# Test 6: Tasks in "In Progress" are handled
echo "Test 6: HIGH priority task in progress (should return 0 - being handled)"
cat > "$TEST_QUEUE_DIR/tasks/QUEUE.md" << 'EOF'
# Task Queue

## 🔥 High Priority

## 🟡 In Progress
- [ ] **Fix authentication bug** (@kai working on it)

## ✅ Done
EOF

if node "$QUEUE_CHECKER"; then
  echo "✅ PASS: In Progress tasks don't block (exit 0)"
else
  echo "❌ FAIL: In Progress tasks should return 0"
  exit 1
fi
echo ""

# Test 7: Tasks in "Blocked" section
echo "Test 7: HIGH priority task blocked (should return 0 - can't work on it)"
cat > "$TEST_QUEUE_DIR/tasks/QUEUE.md" << 'EOF'
# Task Queue

## 🔥 High Priority

## 🔵 Blocked
- [ ] **Deploy to production** (needs: Ryan's approval)

## ✅ Done
EOF

if node "$QUEUE_CHECKER"; then
  echo "✅ PASS: Blocked tasks don't block heartbeat (exit 0)"
else
  echo "❌ FAIL: Blocked tasks should return 0"
  exit 1
fi
echo ""

# Test 8: Mix of priorities - HIGH takes precedence
echo "Test 8: Mix of priorities (should return 1 for HIGH)"
cat > "$TEST_QUEUE_DIR/tasks/QUEUE.md" << 'EOF'
# Task Queue

## 🔥 High Priority
- [ ] [LOW] Update docs
- [ ] **Fix security vulnerability**
- [ ] [LOW] Refactor code

## ✅ Done
EOF

if node "$QUEUE_CHECKER"; then
  echo "❌ FAIL: HIGH priority among LOW should return 1"
  exit 1
else
  echo "✅ PASS: HIGH priority detected among LOW tasks (exit 1)"
fi
echo ""

# Cleanup
rm -rf "$TEST_QUEUE_DIR"

echo "================================"
echo "✅ All tests passed!"
echo ""
echo "Queue checker enforcement is working correctly."
echo "Agents CANNOT skip HIGH/CRITICAL tasks."
