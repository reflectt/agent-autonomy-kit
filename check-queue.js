#!/usr/bin/env node
/**
 * Queue Priority Checker
 * 
 * Scans tasks/QUEUE.md and enforces queue-first execution.
 * Returns exit code 1 if HIGH/Critical priority tasks exist.
 * Returns exit code 0 if queue is empty or all tasks are LOW priority.
 * 
 * Usage:
 *   node skills/agent-autonomy-kit/check-queue.js
 * 
 * Integration:
 *   Run this BEFORE saying HEARTBEAT_OK.
 *   If exit code 1: spawn agent for the HIGH priority task.
 *   If exit code 0: safe to continue with other work.
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function parseQueueFile(queuePath) {
  if (!fs.existsSync(queuePath)) {
    return {
      ready: [],
      inProgress: [],
      blocked: [],
    };
  }

  const content = fs.readFileSync(queuePath, 'utf-8');
  const lines = content.split('\n');
  
  let currentSection = null;
  const sections = {
    ready: [],
    inProgress: [],
    blocked: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Section headers - more flexible matching
    if (trimmed.match(/^##\s+(🔥|🔴)?\s*(High Priority|Ready)/i)) {
      currentSection = 'ready';
      continue;
    }
    if (trimmed.match(/^##\s+(🟡|⏳)?\s*(Medium Priority|In Progress)/i)) {
      currentSection = 'inProgress';
      continue;
    }
    if (trimmed.match(/^##\s+(🔵|🚫)?\s*Blocked/i)) {
      currentSection = 'blocked';
      continue;
    }
    if (trimmed.match(/^##\s+(✅|✔️)?\s*Done/i)) {
      currentSection = null; // Ignore completed tasks
      continue;
    }
    if (trimmed.startsWith('##')) {
      // Unknown section - might be a subsection, keep current section
      continue;
    }

    // Parse task lines
    if (currentSection && trimmed.startsWith('-')) {
      const m = trimmed.match(/^-\s*\[([ x])\]\s*(.*)$/);
      if (!m) continue;

      const checked = m[1] === 'x';
      if (checked) continue; // Ignore completed tasks

      const taskText = m[2];
      const priority = detectPriority(taskText);

      sections[currentSection].push({
        text: taskText,
        priority,
        raw: line,
      });
    }
  }

  return sections;
}

function detectPriority(taskText) {
  const upper = taskText.toUpperCase();
  
  // Explicit priority markers
  if (upper.includes('[CRITICAL]') || upper.includes('🔥 CRITICAL') || upper.includes('URGENT:')) {
    return 'CRITICAL';
  }
  if (upper.includes('[HIGH]') || upper.includes('🔴 HIGH') || upper.includes('HIGH PRIORITY')) {
    return 'HIGH';
  }
  if (upper.includes('[MEDIUM]') || upper.includes('🟡 MEDIUM') || upper.includes('MEDIUM PRIORITY') || upper.includes('⭐') && upper.includes('MEDIUM')) {
    return 'MEDIUM';
  }
  if (upper.includes('[LOW]') || upper.includes('🟡 LOW') || upper.includes('LOW PRIORITY')) {
    return 'LOW';
  }

  // Context-based detection
  if (upper.includes('FIX:') || upper.includes('BUG:') || upper.includes('BROKEN')) {
    return 'HIGH';
  }
  
  // Section-based detection (tasks under "🔥 High Priority" header)
  if (taskText.startsWith('**')) {
    return 'HIGH'; // Bold tasks often indicate importance
  }

  // Default: MEDIUM
  return 'MEDIUM';
}

function checkQueue(queuePath) {
  const sections = parseQueueFile(queuePath);
  
  // Only check Ready tasks (tasks that can be picked up NOW)
  const readyTasks = sections.ready;
  
  const criticalTasks = readyTasks.filter(t => t.priority === 'CRITICAL');
  const highTasks = readyTasks.filter(t => t.priority === 'HIGH');
  const mediumTasks = readyTasks.filter(t => t.priority === 'MEDIUM');
  const lowTasks = readyTasks.filter(t => t.priority === 'LOW');

  const hasUrgentWork = criticalTasks.length > 0 || highTasks.length > 0;

  // Output results
  console.log(`${colors.bold}${colors.cyan}=== Queue Priority Check ===${colors.reset}\n`);
  
  if (criticalTasks.length > 0) {
    console.log(`${colors.red}${colors.bold}🔥 CRITICAL tasks: ${criticalTasks.length}${colors.reset}`);
    criticalTasks.forEach(t => console.log(`   ${colors.red}• ${t.text.substring(0, 80)}${colors.reset}`));
    console.log();
  }
  
  if (highTasks.length > 0) {
    console.log(`${colors.red}🔴 HIGH priority tasks: ${highTasks.length}${colors.reset}`);
    highTasks.forEach(t => console.log(`   ${colors.yellow}• ${t.text.substring(0, 80)}${colors.reset}`));
    console.log();
  }
  
  if (mediumTasks.length > 0) {
    console.log(`${colors.yellow}🟡 MEDIUM priority tasks: ${mediumTasks.length}${colors.reset}`);
  }
  
  if (lowTasks.length > 0) {
    console.log(`${colors.green}🟢 LOW priority tasks: ${lowTasks.length}${colors.reset}`);
  }

  if (readyTasks.length === 0) {
    console.log(`${colors.green}✅ Queue is empty - no ready tasks${colors.reset}`);
  }

  console.log();

  // Enforcement decision
  if (hasUrgentWork) {
    console.log(`${colors.red}${colors.bold}❌ CANNOT SKIP QUEUE${colors.reset}`);
    console.log(`${colors.red}You must spawn an agent for HIGH/CRITICAL tasks before doing other work.${colors.reset}`);
    console.log();
    
    // Show top task
    const topTask = criticalTasks.length > 0 ? criticalTasks[0] : highTasks[0];
    console.log(`${colors.bold}Top priority task:${colors.reset}`);
    console.log(`${colors.cyan}${topTask.text}${colors.reset}`);
    console.log();
    
    process.exit(1); // Exit code 1 = MUST handle queue
  } else {
    console.log(`${colors.green}${colors.bold}✅ Safe to continue${colors.reset}`);
    console.log(`${colors.green}No HIGH/CRITICAL tasks in queue. You can proceed with other work.${colors.reset}`);
    console.log();
    process.exit(0); // Exit code 0 = queue is clear
  }
}

// Main execution
const workspaceRoot = process.cwd();
const queuePath = path.join(workspaceRoot, 'tasks/QUEUE.md');

checkQueue(queuePath);
