# Auto Selection Background Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reviewed automatic course-selection feature: local Node background tasks, grouped priority targets, backup holding, priority upgrade, recovery, account-password auth renewal, JSON import/export, and a dense three-column UI matching the supplied control-panel reference.

**Architecture:** Keep automatic selection in `src/auto-selection/` with small modules for contracts, result normalization, group decisions, upgrade recovery, task scheduling, and task management. `scripts/serve-web.js` only adapts HTTP routes, while `web/app.js`, `web/index.html`, and `web/styles.css` expose a high-density control surface that reuses parsed teaching-class data.

**Tech Stack:** Node.js ESM, built-in `node:test`, existing `ZfxkClient`, `loginWithZfCaptcha`, static HTML/CSS/JS served by `scripts/serve-web.js`.

---

## File Structure

- Create `src/auto-selection/config.js`: normalize/validate task config, generate stable target IDs, sanitize exports, mask usernames.
- Create `src/auto-selection/outcomes.js`: target matching, capacity checks, choose/drop result normalization, snapshot confirmation helpers.
- Create `src/auto-selection/events.js`: bounded in-memory event log with credential redaction.
- Create `src/auto-selection/group-runner.js`: snapshot reconciliation, target observation, group action planning, direct choose flow.
- Create `src/auto-selection/upgrade-runner.js`: `drop -> choose -> recover` flow, including session-expired recovery branches.
- Create `src/auto-selection/task-runner.js`: task timer, auth renewal, write lock, tick loop, status transitions.
- Create `src/auto-selection/task-manager.js`: create/list/get/cancel/resume tasks and expose import/validate helpers.
- Create `src/auto-selection/index.js`: public module exports for server and tests.
- Create `test/auto-selection.test.js`: contracts, outcome, group-runner, upgrade-runner, task-runner unit tests.
- Modify `src/index.js`: export auto-selection modules for SDK consumers.
- Modify `src/index.d.ts`: add TypeScript contracts for auto-selection.
- Modify `scripts/serve-web.js`: wire `/api/auto-selection/*` routes and safe JSON responses.
- Modify `web/index.html`: add automatic-selection control panels and file input.
- Modify `web/app.js`: task draft state, add-target flow, import/export, route calls, polling, and status rendering.
- Modify `web/styles.css`: dense console layout using the supplied screenshot as visual target: left config column, center group/target table, right task status/events.
- Modify `test/web.test.js`: assert UI controls and route call strings exist.
- Modify `src/docs/openapi.js` and regenerate `docs/openapi.json`: document the SDK-facing auto-selection contracts.
- Modify `README.md`: document first-version behavior, task lifetime, credential handling, import/export, and manual verification.
- Append `statusquo.md`: immutable project status entry after implementation.

---

### Task 1: Contracts And Configuration

**Files:**
- Create: `src/auto-selection/config.js`
- Create: `src/auto-selection/index.js`
- Test: `test/auto-selection.test.js`

- [ ] **Step 1: Write failing config tests**

Add this block to `test/auto-selection.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  exportAutoSelectionConfig,
  importAutoSelectionConfig,
  normalizeAutoSelectionConfig,
  validateAutoSelectionConfig
} from '../src/auto-selection/index.js';

test('auto-selection config normalizes defaults, target ids, and priority order', () => {
  const config = normalizeAutoSelectionConfig({
    baseUrl: 'https://xk.example.edu.cn/jwglxt/',
    username: '2023123456',
    password: 'secret',
    pagePath: '/xsxk/index.html',
    groups: [{
      name: '体育课',
      targets: [
        { courseId: 'KC1', classId: 'LOW', priority: 10, isBackup: true },
        { courseId: 'KC1', classId: 'HIGH', submitClassId: 'DO_HIGH', priority: 100 }
      ]
    }]
  });

  assert.equal(config.baseUrl, 'https://xk.example.edu.cn/jwglxt');
  assert.equal(config.intervalMs, 1500);
  assert.equal(config.maxAttempts, null);
  assert.equal(config.deadlineAt, null);
  assert.equal(config.groups[0].targets[0].classId, 'HIGH');
  assert.equal(config.groups[0].targets[0].targetId, 'KC1:HIGH:0');
  assert.equal(config.groups[0].targets[0].allowAutoDrop, false);
  assert.equal(config.groups[0].targets[0].recoverOnUpgradeFailure, true);
  assert.equal(config.groups[0].targets[0].status, 'watching');
  assert.equal(config.groups[0].targets[1].targetId, 'KC1:LOW:1');
  assert.equal(config.groups[0].targets[1].allowAutoDrop, true);
});

test('auto-selection export and import omit password and cookie but keep runnable draft fields', () => {
  const normalized = normalizeAutoSelectionConfig({
    baseUrl: 'https://xk.example.edu.cn/jwglxt',
    username: '2023123456',
    password: 'secret',
    cookie: 'JSESSIONID=secret',
    pagePath: '/xsxk/index.html',
    groups: [{ name: '体育课', targets: [{ courseId: 'KC1', classId: 'A', priority: 1 }] }]
  });

  const exported = exportAutoSelectionConfig(normalized);
  assert.equal(exported.kind, 'zfxk.autoSelectionTask');
  assert.equal(exported.version, 1);
  assert.equal(exported.username, '2023123456');
  assert.equal('password' in exported, false);
  assert.equal('cookie' in exported, false);

  const imported = importAutoSelectionConfig(exported);
  assert.equal(imported.valid, true);
  assert.equal(imported.config.password, undefined);
  assert.equal(imported.config.cookie, undefined);
  assert.equal(imported.config.groups[0].targets[0].courseId, 'KC1');
});

test('auto-selection validation reports invalid targets without throwing', () => {
  const result = validateAutoSelectionConfig({
    baseUrl: '',
    pagePath: '',
    groups: [{ name: '', targets: [{ courseId: '', classId: '', priority: 'high' }] }]
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /baseUrl is required/);
  assert.match(result.errors.join('\n'), /groups\[0\]\.targets\[0\]\.courseId is required/);
  assert.match(result.errors.join('\n'), /priority must be a finite number/);
});
```

- [ ] **Step 2: Run config tests to verify failure**

Run:

```bash
npm test -- --test-name-pattern "auto-selection config|auto-selection export|auto-selection validation"
```

Expected: `ERR_MODULE_NOT_FOUND` for `src/auto-selection/index.js`.

- [ ] **Step 3: Implement config contracts**

Create `src/auto-selection/config.js` with these exports:

```js
export const AUTO_SELECTION_CONFIG_KIND = 'zfxk.autoSelectionTask';
export const AUTO_SELECTION_CONFIG_VERSION = 1;
export const DEFAULT_INTERVAL_MS = 1500;

export function normalizeAutoSelectionConfig(input = {}, options = {}) {
  const errors = [];
  const baseUrl = trimTrailingSlash(input.baseUrl);
  const groups = (Array.isArray(input.groups) ? input.groups : []).map((group, groupIndex) => normalizeGroup(group, groupIndex));
  const config = {
    baseUrl,
    username: stringOrUndefined(input.username),
    password: stringOrUndefined(input.password),
    cookie: stringOrUndefined(input.cookie),
    pagePath: String(input.pagePath || ''),
    intervalMs: normalizePositiveInteger(input.intervalMs, DEFAULT_INTERVAL_MS),
    maxAttempts: input.maxAttempts === undefined || input.maxAttempts === null || input.maxAttempts === '' ? null : normalizePositiveInteger(input.maxAttempts, null),
    deadlineAt: input.deadlineAt || null,
    groups
  };

  if (options.requireCredentials && !config.password && !config.cookie) errors.push('password or cookie is required');
  return Object.assign(config, { errors });
}

export function validateAutoSelectionConfig(input = {}, options = {}) {
  const config = normalizeAutoSelectionConfig(input, options);
  const errors = [...config.errors];
  if (!config.baseUrl) errors.push('baseUrl is required');
  if (!/^https?:\/\//i.test(config.baseUrl || '')) errors.push('baseUrl must start with http:// or https://');
  if (!config.pagePath) errors.push('pagePath is required');
  if (!config.groups.length) errors.push('at least one group is required');

  config.groups.forEach((group, groupIndex) => {
    if (!group.name) errors.push(`groups[${groupIndex}].name is required`);
    if (!group.targets.length) errors.push(`groups[${groupIndex}].targets must contain at least one target`);
    group.targets.forEach((target, targetIndex) => {
      if (!target.courseId) errors.push(`groups[${groupIndex}].targets[${targetIndex}].courseId is required`);
      if (!target.classId && !target.submitClassId) errors.push(`groups[${groupIndex}].targets[${targetIndex}].classId or submitClassId is required`);
      if (!Number.isFinite(target.priority)) errors.push(`groups[${groupIndex}].targets[${targetIndex}].priority must be a finite number`);
    });
  });

  return { valid: errors.length === 0, errors, config };
}

export function exportAutoSelectionConfig(config) {
  const normalized = normalizeAutoSelectionConfig(config);
  return {
    version: AUTO_SELECTION_CONFIG_VERSION,
    kind: AUTO_SELECTION_CONFIG_KIND,
    baseUrl: normalized.baseUrl,
    pagePath: normalized.pagePath,
    username: normalized.username,
    intervalMs: normalized.intervalMs,
    maxAttempts: normalized.maxAttempts,
    deadlineAt: normalized.deadlineAt,
    groups: normalized.groups.map((group) => ({
      name: group.name,
      targets: group.targets.map(({ status, lastObservedRemaining, lastMessage, createdOrder, ...target }) => target)
    }))
  };
}

export function importAutoSelectionConfig(input = {}) {
  const errors = [];
  if (input.kind !== AUTO_SELECTION_CONFIG_KIND) errors.push('kind must be zfxk.autoSelectionTask');
  if (input.version !== AUTO_SELECTION_CONFIG_VERSION) errors.push('version must be 1');
  const normalized = normalizeAutoSelectionConfig({ ...input, password: undefined, cookie: undefined });
  const validation = validateAutoSelectionConfig(normalized);
  return { valid: errors.length === 0 && validation.valid, errors: [...errors, ...validation.errors], config: normalized };
}

export function maskUsername(username = '') {
  const text = String(username || '');
  if (!text) return '';
  return `${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`;
}

function normalizeGroup(group = {}, groupIndex = 0) {
  const targets = (Array.isArray(group.targets) ? group.targets : [])
    .map((target, targetIndex) => normalizeTarget(target, targetIndex))
    .sort(byPriorityDescThenCreatedOrder);
  return {
    groupId: group.groupId || `group_${groupIndex + 1}`,
    name: String(group.name || `选课组 ${groupIndex + 1}`),
    state: group.state || 'WATCHING',
    currentPlacement: null,
    isTopTargetSelected: false,
    pauseScope: undefined,
    lastMessage: '',
    targets
  };
}

function normalizeTarget(target = {}, createdOrder = 0) {
  const courseId = String(target.courseId || '');
  const classId = String(target.classId || target.submitClassId || '');
  const submitClassId = target.submitClassId ? String(target.submitClassId) : undefined;
  const priority = Number(target.priority);
  return {
    targetId: target.targetId || `${courseId}:${classId || submitClassId || 'target'}:${createdOrder}`,
    courseId,
    classId,
    submitClassId,
    label: target.label ? String(target.label) : undefined,
    priority,
    isBackup: Boolean(target.isBackup),
    allowAutoDrop: target.allowAutoDrop === undefined ? Boolean(target.isBackup) : Boolean(target.allowAutoDrop),
    recoverOnUpgradeFailure: target.recoverOnUpgradeFailure === undefined ? true : Boolean(target.recoverOnUpgradeFailure),
    skipAfterNonCapacityFailure: target.skipAfterNonCapacityFailure === undefined ? true : Boolean(target.skipAfterNonCapacityFailure),
    status: target.status || 'watching',
    lastObservedRemaining: target.lastObservedRemaining,
    lastMessage: target.lastMessage || '',
    createdOrder
  };
}

export function byPriorityDescThenCreatedOrder(a, b) {
  return b.priority - a.priority || a.createdOrder - b.createdOrder;
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

function stringOrUndefined(value) {
  const text = String(value ?? '').trim();
  return text ? text : undefined;
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : fallback;
}
```

Create `src/auto-selection/index.js`:

```js
export * from './config.js';
```

- [ ] **Step 4: Run config tests to verify pass**

Run:

```bash
npm test -- --test-name-pattern "auto-selection config|auto-selection export|auto-selection validation"
```

Expected: all three tests pass.

- [ ] **Step 5: Commit contracts**

Run:

```bash
git add src/auto-selection/config.js src/auto-selection/index.js test/auto-selection.test.js
git commit -m "feat: add auto selection config contracts"
```

Expected: commit succeeds.

---

### Task 2: Outcome Normalization And Snapshot Matching

**Files:**
- Create: `src/auto-selection/outcomes.js`
- Modify: `src/auto-selection/index.js`
- Test: `test/auto-selection.test.js`

- [ ] **Step 1: Write failing outcome tests**

Append:

```js
import {
  classRemaining,
  matchTarget,
  normalizeChooseOutcome,
  snapshotHasTarget
} from '../src/auto-selection/index.js';

test('auto-selection target matching accepts classId and submitClassId aliases', () => {
  const target = { courseId: 'KC1', classId: 'JXB1', submitClassId: 'DO1' };
  assert.equal(matchTarget(target, { courseId: 'KC1', classId: 'JXB1', submitClassId: 'DO1' }), true);
  assert.equal(matchTarget(target, { courseId: 'KC1', classId: 'DO1', submitClassId: 'JXB1' }), true);
  assert.equal(matchTarget(target, { courseId: 'KC1', classId: 'OTHER', submitClassId: 'NOPE' }), false);
});

test('auto-selection outcome separates capacity full from human required and business failure', () => {
  assert.deepEqual(normalizeChooseOutcome({ status: 'capacity-full' }), { type: 'capacity-full' });
  assert.deepEqual(normalizeChooseOutcome({ status: 'pending-filter' }), { type: 'pending-filter' });
  assert.deepEqual(normalizeChooseOutcome({ status: 'requires-listener-apply' }), {
    type: 'human-required',
    reason: 'LISTENER_APPLY_REQUIRED',
    pauseScope: 'group'
  });
  assert.deepEqual(normalizeChooseOutcome({ status: 'rejected', reason: 'WEIGHT_REQUIRED' }), {
    type: 'human-required',
    reason: 'WEIGHT_REQUIRED',
    pauseScope: 'group'
  });
  assert.deepEqual(normalizeChooseOutcome({ status: 'rejected', reason: 'SESSION_EXPIRED' }), { type: 'session-expired' });
  assert.equal(normalizeChooseOutcome({ status: 'rejected', reason: 'REJECTED' }).type, 'business-failed');
});

test('auto-selection snapshot matching uses both selected ids', () => {
  const snapshot = {
    byClassId: new Map([
      ['JXB1', { classId: 'JXB1', submitClassId: 'DO1', courseId: 'KC1' }],
      ['DO1', { classId: 'JXB1', submitClassId: 'DO1', courseId: 'KC1' }]
    ])
  };
  assert.equal(snapshotHasTarget(snapshot, { courseId: 'KC1', classId: 'DO1' }), true);
  assert.equal(snapshotHasTarget(snapshot, { courseId: 'KC1', classId: 'NOPE' }), false);
});

test('auto-selection capacity helper treats known capacity as remaining seats', () => {
  assert.equal(classRemaining({ selectedCount: 12, capacity: 30 }), 18);
  assert.equal(classRemaining({ selectedCount: 30, capacity: 30 }), 0);
  assert.equal(classRemaining({ selectedCount: 0, capacity: 0, flags: { full: false } }), null);
});
```

- [ ] **Step 2: Run outcome tests to verify failure**

Run:

```bash
npm test -- --test-name-pattern "auto-selection target|auto-selection outcome|auto-selection snapshot|auto-selection capacity"
```

Expected: named exports are missing.

- [ ] **Step 3: Implement outcomes**

Create `src/auto-selection/outcomes.js`:

```js
const GROUP_HUMAN_REASONS = new Set([
  'CHILD_CLASSES_REQUIRED',
  'WEIGHT_REQUIRED',
  'TEXTBOOK_REQUIRED',
  'LISTENER_APPLY_REQUIRED',
  'USER_CANCELLED'
]);

const TASK_HUMAN_REASONS = new Set([
  'SMS_LOGIN_REQUIRED',
  'IDENTITY_CONFIRMATION_REQUIRED',
  'LOGIN_LOCKED',
  'SMS_CODE_REQUIRED',
  'SMS_FAILED'
]);

export function matchTarget(target = {}, teachingClass = {}) {
  if (target.courseId && teachingClass.courseId && String(target.courseId) !== String(teachingClass.courseId)) return false;
  const targetIds = new Set([target.classId, target.submitClassId].filter(Boolean).map(String));
  const classIds = [teachingClass.classId, teachingClass.submitClassId, teachingClass.doJxbId].filter(Boolean).map(String);
  return classIds.some((id) => targetIds.has(id));
}

export function sameTarget(a = {}, b = {}) {
  return matchTarget(a, b) || matchTarget(b, a);
}

export function snapshotHasTarget(snapshot, target) {
  return Boolean(findSnapshotSelection(snapshot, target));
}

export function findSnapshotSelection(snapshot, target) {
  const byClassId = snapshot?.byClassId;
  if (byClassId?.get) {
    for (const id of [target.classId, target.submitClassId].filter(Boolean)) {
      const selected = byClassId.get(String(id));
      if (selected && matchTarget(target, selected)) return selected;
    }
  }
  return (snapshot?.selectedClasses ?? []).find((selected) => matchTarget(target, selected));
}

export function classRemaining(teachingClass = {}) {
  const capacity = Number(teachingClass.capacity);
  const selected = Number(teachingClass.selectedCount);
  if (Number.isFinite(capacity) && capacity > 0 && Number.isFinite(selected)) return Math.max(0, capacity - selected);
  return null;
}

export function isTeachingClassAvailable(teachingClass = {}) {
  if (!teachingClass.flags?.canSelect) return false;
  const remaining = classRemaining(teachingClass);
  if (remaining !== null) return remaining > 0;
  return !teachingClass.flags?.full;
}

export function normalizeChooseOutcome(resultOrError) {
  if (isSessionError(resultOrError)) return { type: 'session-expired' };
  const status = String(resultOrError?.status || '');
  const reason = String(resultOrError?.reason || resultOrError?.code || '');
  if (status === 'selected') return { type: 'selected' };
  if (status === 'pending-filter') return { type: 'pending-filter' };
  if (status === 'capacity-full') return { type: 'capacity-full' };
  if (status === 'requires-listener-apply') return { type: 'human-required', reason: 'LISTENER_APPLY_REQUIRED', pauseScope: 'group' };
  if (status === 'sms-failed') return { type: 'human-required', reason: 'SMS_FAILED', pauseScope: 'task' };
  if (reason === 'SESSION_EXPIRED' || resultOrError?.message?.includes?.('CONTEXT_NOT_FOUND')) return { type: 'session-expired' };
  if (GROUP_HUMAN_REASONS.has(reason)) return { type: 'human-required', reason, pauseScope: 'group' };
  if (TASK_HUMAN_REASONS.has(reason)) return { type: 'human-required', reason, pauseScope: 'task' };
  if (status === 'rejected') return { type: 'business-failed', reason: reason || 'REJECTED' };
  if (resultOrError instanceof Error) return { type: 'transient-error', reason: resultOrError.message };
  return { type: 'transient-error', reason: reason || status || 'UNKNOWN_CHOOSE_RESULT' };
}

export function normalizeDropOutcome(resultOrError) {
  if (isSessionError(resultOrError)) return { type: 'session-expired' };
  const status = String(resultOrError?.status || '');
  const reason = String(resultOrError?.reason || resultOrError?.code || '');
  if (status === 'dropped' || status === 'already-dropped') return { type: 'dropped' };
  if (status === 'sms-failed') return { type: 'human-required', reason: 'SMS_FAILED', pauseScope: 'task' };
  if (reason === 'SESSION_EXPIRED') return { type: 'session-expired' };
  if (reason === 'USER_CANCELLED' || reason === 'NOT_DROPPABLE') return { type: 'human-required', reason, pauseScope: 'group' };
  if (status === 'rejected') return { type: 'business-failed', reason: reason || 'DROP_REJECTED' };
  if (resultOrError instanceof Error) return { type: 'transient-error', reason: resultOrError.message };
  return { type: 'transient-error', reason: reason || status || 'UNKNOWN_DROP_RESULT' };
}

export function isSessionError(error) {
  const message = String(error?.message || '');
  const code = String(error?.code || error?.reason || '');
  return code === 'SESSION_EXPIRED' || message.includes('SESSION_EXPIRED') || message.includes('CONTEXT_NOT_FOUND') || message.includes('Illegal access');
}
```

Modify `src/auto-selection/index.js`:

```js
export * from './config.js';
export * from './outcomes.js';
```

- [ ] **Step 4: Run outcome tests to verify pass**

Run:

```bash
npm test -- --test-name-pattern "auto-selection target|auto-selection outcome|auto-selection snapshot|auto-selection capacity"
```

Expected: all outcome tests pass.

- [ ] **Step 5: Commit outcomes**

Run:

```bash
git add src/auto-selection/outcomes.js src/auto-selection/index.js test/auto-selection.test.js
git commit -m "feat: normalize auto selection outcomes"
```

Expected: commit succeeds.

---

### Task 3: Group Runner

**Files:**
- Create: `src/auto-selection/events.js`
- Create: `src/auto-selection/group-runner.js`
- Modify: `src/auto-selection/index.js`
- Test: `test/auto-selection.test.js`

- [ ] **Step 1: Write failing group-runner tests**

Append:

```js
import {
  chooseTarget,
  createAutoSelectionEventLog,
  planGroupAction,
  reconcileGroups
} from '../src/auto-selection/index.js';

function makeSnapshot(selectedClasses = []) {
  const byClassId = new Map();
  for (const selected of selectedClasses) {
    byClassId.set(selected.classId, selected);
    byClassId.set(selected.submitClassId, selected);
  }
  return { selectedClasses, byClassId };
}

test('auto-selection reconcile clears manual drops and detects manual upgrade', () => {
  const config = normalizeAutoSelectionConfig({
    baseUrl: 'https://xk.example.edu.cn/jwglxt',
    pagePath: '/xsxk/index.html',
    groups: [{
      name: '体育课',
      targets: [
        { courseId: 'KC1', classId: 'HIGH', submitClassId: 'DO_HIGH', priority: 100 },
        { courseId: 'KC1', classId: 'LOW', submitClassId: 'DO_LOW', priority: 10, isBackup: true }
      ]
    }]
  });
  const group = config.groups[0];
  group.currentPlacement = group.targets[1];
  reconcileGroups(config.groups, makeSnapshot([]));
  assert.equal(group.currentPlacement, null);
  assert.equal(group.state, 'WATCHING');

  reconcileGroups(config.groups, makeSnapshot([{ courseId: 'KC1', classId: 'HIGH', submitClassId: 'DO_HIGH' }]));
  assert.equal(group.currentPlacement.targetId, group.targets[0].targetId);
  assert.equal(group.state, 'SUCCEEDED');
  assert.equal(group.isTopTargetSelected, true);
});

test('auto-selection group planner refreshes only target course ids and picks highest available target', async () => {
  const config = normalizeAutoSelectionConfig({
    baseUrl: 'https://xk.example.edu.cn/jwglxt',
    pagePath: '/xsxk/index.html',
    groups: [{
      name: '体育课',
      targets: [
        { courseId: 'KC1', classId: 'HIGH', priority: 100 },
        { courseId: 'KC1', classId: 'LOW', priority: 10, isBackup: true }
      ]
    }]
  });
  const calls = [];
  const task = {
    client: {
      catalog: {
        getTeachingClasses: async (courseId) => {
          calls.push(courseId);
          return [
            { courseId, classId: 'HIGH', submitClassId: 'DO_HIGH', selectedCount: 30, capacity: 30, flags: { canSelect: true, full: true } },
            { courseId, classId: 'LOW', submitClassId: 'DO_LOW', selectedCount: 5, capacity: 30, flags: { canSelect: true, full: false } }
          ];
        }
      }
    }
  };

  const action = await planGroupAction(task, config.groups[0]);
  assert.deepEqual(calls, ['KC1']);
  assert.equal(action.type, 'choose');
  assert.equal(action.target.classId, 'LOW');
  assert.equal(config.groups[0].targets[0].lastObservedRemaining, 0);
  assert.equal(config.groups[0].targets[1].lastObservedRemaining, 25);
});

test('auto-selection choose does a second snapshot before treating selected as confirmed', async () => {
  const events = createAutoSelectionEventLog();
  const target = { courseId: 'KC1', classId: 'HIGH', submitClassId: 'DO_HIGH', priority: 100, targetId: 'KC1:HIGH:0', status: 'watching' };
  const group = { name: '体育课', state: 'WATCHING', targets: [target], currentPlacement: null, isTopTargetSelected: false };
  let snapshotCalls = 0;
  const task = {
    events,
    client: {
      selection: { choose: async () => ({ status: 'selected', snapshot: makeSnapshot([]) }) },
      chosen: {
        snapshot: async () => {
          snapshotCalls += 1;
          return snapshotCalls === 1
            ? makeSnapshot([])
            : makeSnapshot([{ courseId: 'KC1', classId: 'HIGH', submitClassId: 'DO_HIGH', selectedBySystem: true }]);
        }
      }
    }
  };

  const outcome = await chooseTarget(task, group, target);
  assert.equal(outcome.type, 'selected');
  assert.equal(snapshotCalls, 2);
  assert.equal(group.state, 'SUCCEEDED');
  assert.equal(group.currentPlacement.targetId, target.targetId);
});
```

- [ ] **Step 2: Run group tests to verify failure**

Run:

```bash
npm test -- --test-name-pattern "auto-selection reconcile|auto-selection group planner|auto-selection choose"
```

Expected: named exports are missing.

- [ ] **Step 3: Implement events and group runner**

Create `src/auto-selection/events.js`:

```js
const SECRET_PATTERNS = [
  /JSESSIONID=[^;\s]+/gi,
  /route=[^;\s]+/gi,
  /password["':=\s]+[^"',\s]+/gi,
  /cookie["':=\s]+[^"',\n]+/gi
];

export function createAutoSelectionEventLog(limit = 200) {
  const entries = [];
  return {
    entries,
    add(type, message, details = {}) {
      const event = {
        id: `evt_${Date.now()}_${entries.length + 1}`,
        at: new Date().toISOString(),
        type,
        message: redact(message),
        details: redactObject(details)
      };
      entries.push(event);
      while (entries.length > limit) entries.shift();
      return event;
    },
    list() {
      return entries.slice();
    }
  };
}

export function redact(value) {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[redacted]'), String(value ?? ''));
}

function redactObject(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => (
    /password|cookie|authorization/i.test(key) ? '[redacted]' : typeof item === 'string' ? redact(item) : item
  )));
}
```

Create `src/auto-selection/group-runner.js` with exports:

```js
import { byPriorityDescThenCreatedOrder } from './config.js';
import {
  classRemaining,
  findSnapshotSelection,
  isTeachingClassAvailable,
  matchTarget,
  normalizeChooseOutcome,
  sameTarget,
  snapshotHasTarget
} from './outcomes.js';

export function reconcileGroups(groups = [], snapshot) {
  for (const group of groups) {
    const selectedTarget = group.targets
      .filter((target) => snapshotHasTarget(snapshot, target))
      .sort(byPriorityDescThenCreatedOrder)[0] ?? null;
    group.currentPlacement = selectedTarget;
    group.isTopTargetSelected = isGroupSucceeded(group);
    if (group.isTopTargetSelected) group.state = 'SUCCEEDED';
    else if (selectedTarget) group.state = 'HOLDING';
    else if (group.state !== 'PAUSED' && group.state !== 'FAILED') group.state = 'WATCHING';
  }
}

export function isGroupSucceeded(group) {
  const activeTargets = group.targets.filter((target) => target.status !== 'skipped');
  if (!activeTargets.length || !group.currentPlacement) return false;
  return sameTarget(group.currentPlacement, activeTargets.sort(byPriorityDescThenCreatedOrder)[0]);
}

export async function planGroupAction(task, group) {
  const observed = await observeGroupTargets(task, group);
  const available = observed
    .filter(({ target, teachingClass }) => target.status !== 'skipped' && isTeachingClassAvailable(teachingClass))
    .sort((a, b) => byPriorityDescThenCreatedOrder(a.target, b.target));

  if (!available.length) return { type: 'none' };
  const next = available[0].target;
  if (!group.currentPlacement) return { type: 'choose', target: next, teachingClass: available[0].teachingClass };
  if (sameTarget(group.currentPlacement, next)) return { type: 'none' };
  if (next.priority > group.currentPlacement.priority) return { type: 'upgrade', current: group.currentPlacement, next, teachingClass: available[0].teachingClass };
  return { type: 'none' };
}

export async function observeGroupTargets(task, group) {
  const courseIds = [...new Set(group.targets.map((target) => target.courseId).filter(Boolean))];
  const rows = [];
  for (const courseId of courseIds) {
    const classes = await task.client.catalog.getTeachingClasses(courseId);
    for (const teachingClass of classes) {
      const target = group.targets.find((candidate) => matchTarget(candidate, teachingClass));
      if (!target) continue;
      target.lastObservedRemaining = classRemaining(teachingClass);
      target.lastMessage = target.lastObservedRemaining === 0 ? 'capacity full' : '';
      rows.push({ target, teachingClass });
    }
  }
  return rows;
}

export async function chooseTarget(task, group, target, options = {}) {
  group.state = 'CHOOSE_TARGET';
  const result = await callChoose(task, target, options.teachingClass);
  const outcome = normalizeChooseOutcome(result);
  if (outcome.type === 'selected' || outcome.type === 'pending-filter') {
    return confirmSelection(task, group, target, outcome);
  }
  applyChooseFailure(task, group, target, outcome);
  return outcome;
}

async function callChoose(task, target, teachingClass) {
  try {
    return await task.client.selection.choose(
      { courseId: target.courseId, classId: target.classId || target.submitClassId, teachingClass },
      backgroundChoosePolicy()
    );
  } catch (error) {
    return error;
  }
}

export function backgroundChoosePolicy() {
  return {
    confirm: async (event) => event.kind === 'title-check',
    chooseWeight: undefined,
    chooseChildClasses: undefined,
    chooseTextbooks: undefined
  };
}

async function confirmSelection(task, group, target, initialOutcome) {
  const snapshots = [];
  if (initialOutcome.snapshot) snapshots.push(initialOutcome.snapshot);
  snapshots.push(await task.client.chosen.snapshot());
  if (!snapshots.some((snapshot) => snapshotHasTarget(snapshot, target))) {
    snapshots.push(await task.client.chosen.snapshot());
  }
  const selected = snapshots.map((snapshot) => findSnapshotSelection(snapshot, target)).find(Boolean);
  if (!selected) {
    const outcome = { type: 'transient-error', reason: 'SNAPSHOT_CONFIRM_FAILED' };
    group.state = group.currentPlacement ? 'HOLDING' : 'WATCHING';
    target.lastMessage = outcome.reason;
    task.events?.add('choose-transient', `${group.name}: snapshot did not confirm ${target.label || target.classId}`);
    return outcome;
  }
  target.status = 'selected';
  group.currentPlacement = target;
  group.isTopTargetSelected = isGroupSucceeded(group);
  group.state = group.isTopTargetSelected ? 'SUCCEEDED' : 'HOLDING';
  task.events?.add('choose-selected', `${group.name}: selected ${target.label || target.classId}`, { targetId: target.targetId });
  return initialOutcome;
}

function applyChooseFailure(task, group, target, outcome) {
  target.lastMessage = outcome.reason || outcome.type;
  if (outcome.type === 'capacity-full') {
    group.state = group.currentPlacement ? 'HOLDING' : 'WATCHING';
    return;
  }
  if (outcome.type === 'human-required') {
    group.state = 'PAUSED';
    group.pauseScope = outcome.pauseScope;
    task.pauseScope = outcome.pauseScope === 'task' ? 'task' : task.pauseScope;
    return;
  }
  if (outcome.type === 'business-failed' && target.skipAfterNonCapacityFailure) {
    target.status = 'skipped';
  }
  group.state = group.targets.every((candidate) => candidate.status === 'skipped') ? 'FAILED' : 'WATCHING';
}
```

Modify `src/auto-selection/index.js`:

```js
export * from './config.js';
export * from './events.js';
export * from './group-runner.js';
export * from './outcomes.js';
```

- [ ] **Step 4: Run group tests to verify pass**

Run:

```bash
npm test -- --test-name-pattern "auto-selection reconcile|auto-selection group planner|auto-selection choose"
```

Expected: all group-runner tests pass.

- [ ] **Step 5: Commit group runner**

Run:

```bash
git add src/auto-selection/events.js src/auto-selection/group-runner.js src/auto-selection/index.js test/auto-selection.test.js
git commit -m "feat: add auto selection group runner"
```

Expected: commit succeeds.

---

### Task 4: Upgrade Runner

**Files:**
- Create: `src/auto-selection/upgrade-runner.js`
- Modify: `src/auto-selection/index.js`
- Test: `test/auto-selection.test.js`

- [ ] **Step 1: Write failing upgrade tests**

Append:

```js
import { upgradeTarget } from '../src/auto-selection/index.js';

test('auto-selection upgrade recovers backup when higher target is capacity full', async () => {
  const low = { targetId: 'KC1:LOW:1', courseId: 'KC1', classId: 'LOW', submitClassId: 'DO_LOW', priority: 10, allowAutoDrop: true, recoverOnUpgradeFailure: true, status: 'selected' };
  const high = { targetId: 'KC1:HIGH:0', courseId: 'KC1', classId: 'HIGH', submitClassId: 'DO_HIGH', priority: 100, allowAutoDrop: false, recoverOnUpgradeFailure: true, status: 'watching' };
  const group = { name: '体育课', state: 'HOLDING', targets: [high, low], currentPlacement: low, isTopTargetSelected: false };
  const calls = [];
  const task = {
    events: createAutoSelectionEventLog(),
    client: {
      selection: {
        drop: async (input) => { calls.push(['drop', input.classId]); return { status: 'dropped' }; },
        choose: async (input) => {
          calls.push(['choose', input.classId]);
          return input.classId === 'HIGH'
            ? { status: 'capacity-full' }
            : { status: 'selected' };
        }
      },
      chosen: {
        snapshot: async () => makeSnapshot([{ courseId: 'KC1', classId: 'LOW', submitClassId: 'DO_LOW', selectedBySystem: true }])
      }
    }
  };

  const outcome = await upgradeTarget(task, group, low, high);
  assert.equal(outcome.type, 'capacity-full');
  assert.deepEqual(calls, [['drop', 'LOW'], ['choose', 'HIGH'], ['choose', 'LOW']]);
  assert.equal(group.currentPlacement.targetId, low.targetId);
  assert.equal(group.state, 'HOLDING');
});

test('auto-selection upgrade handles session expired after drop by reauthing and recovering backup', async () => {
  const low = { targetId: 'KC1:LOW:1', courseId: 'KC1', classId: 'LOW', submitClassId: 'DO_LOW', priority: 10, allowAutoDrop: true, recoverOnUpgradeFailure: true, status: 'selected' };
  const high = { targetId: 'KC1:HIGH:0', courseId: 'KC1', classId: 'HIGH', submitClassId: 'DO_HIGH', priority: 100, allowAutoDrop: false, recoverOnUpgradeFailure: true, status: 'watching' };
  const group = { name: '体育课', state: 'HOLDING', targets: [high, low], currentPlacement: low, isTopTargetSelected: false };
  const calls = [];
  const task = {
    events: createAutoSelectionEventLog(),
    refreshAuth: async () => { calls.push(['auth']); },
    client: {
      selection: {
        drop: async () => { calls.push(['drop']); return { status: 'dropped' }; },
        choose: async (input) => {
          calls.push(['choose', input.classId]);
          return input.classId === 'HIGH'
            ? { status: 'rejected', reason: 'SESSION_EXPIRED' }
            : { status: 'selected' };
        }
      },
      chosen: {
        snapshot: async () => makeSnapshot([])
      }
    }
  };

  const outcome = await upgradeTarget(task, group, low, high);
  assert.equal(outcome.type, 'session-expired');
  assert.deepEqual(calls, [['drop'], ['choose', 'HIGH'], ['auth'], ['choose', 'LOW']]);
  assert.equal(group.currentPlacement.targetId, low.targetId);
});
```

- [ ] **Step 2: Run upgrade tests to verify failure**

Run:

```bash
npm test -- --test-name-pattern "auto-selection upgrade"
```

Expected: `upgradeTarget` export is missing.

- [ ] **Step 3: Implement upgrade runner**

Create `src/auto-selection/upgrade-runner.js`:

```js
import { chooseTarget } from './group-runner.js';
import { normalizeDropOutcome, snapshotHasTarget } from './outcomes.js';

export async function upgradeTarget(task, group, current, next, options = {}) {
  if (!current.allowAutoDrop) {
    group.state = 'PAUSED';
    group.pauseScope = 'group';
    group.lastMessage = 'current placement does not allow automatic drop';
    return { type: 'human-required', reason: 'AUTO_DROP_NOT_ALLOWED', pauseScope: 'group' };
  }

  group.state = 'DROP_BACKUP';
  const dropOutcome = normalizeDropOutcome(await callDrop(task, current));
  if (dropOutcome.type === 'session-expired') return recoverAfterSessionExpired(task, group, current, next, dropOutcome);
  if (dropOutcome.type !== 'dropped') {
    group.state = dropOutcome.type === 'human-required' ? 'PAUSED' : 'HOLDING';
    group.lastMessage = dropOutcome.reason || dropOutcome.type;
    return dropOutcome;
  }

  group.currentPlacement = null;
  group.state = 'CHOOSE_TARGET';
  const chooseOutcome = await chooseTarget(task, group, next, options);
  if (chooseOutcome.type === 'selected' || chooseOutcome.type === 'pending-filter') return chooseOutcome;
  if (chooseOutcome.type === 'session-expired') return recoverAfterSessionExpired(task, group, current, next, chooseOutcome);
  if ((chooseOutcome.type === 'capacity-full' || chooseOutcome.type === 'business-failed') && current.recoverOnUpgradeFailure) {
    await recoverBackup(task, group, current);
  }
  return chooseOutcome;
}

async function callDrop(task, current) {
  try {
    return await task.client.selection.drop({
      courseId: current.courseId,
      classId: current.classId,
      submitClassId: current.submitClassId,
      canDrop: true
    }, {
      confirm: async () => true
    });
  } catch (error) {
    return error;
  }
}

async function recoverAfterSessionExpired(task, group, current, next, outcome) {
  task.status = 'auth-refreshing';
  if (typeof task.refreshAuth === 'function') await task.refreshAuth();
  const snapshot = await task.client.chosen.snapshot();
  if (snapshotHasTarget(snapshot, next)) {
    group.currentPlacement = next;
    group.state = 'SUCCEEDED';
    return outcome;
  }
  if (!snapshotHasTarget(snapshot, current) && current.recoverOnUpgradeFailure) {
    await recoverBackup(task, group, current);
  }
  return outcome;
}

export async function recoverBackup(task, group, current) {
  group.state = 'RECOVER_BACKUP';
  const recovery = await chooseTarget(task, group, current);
  if (recovery.type === 'selected' || recovery.type === 'pending-filter') {
    group.currentPlacement = current;
    group.state = 'HOLDING';
    task.events?.add('recover-selected', `${group.name}: recovered ${current.label || current.classId}`, { targetId: current.targetId });
    return recovery;
  }
  group.state = 'PAUSED';
  group.pauseScope = 'task';
  task.pauseScope = 'task';
  group.lastMessage = 'backup was dropped but recovery failed';
  task.events?.add('recover-failed', `${group.name}: backup was dropped but recovery failed`, { targetId: current.targetId });
  return recovery;
}
```

Modify `src/auto-selection/index.js`:

```js
export * from './config.js';
export * from './events.js';
export * from './group-runner.js';
export * from './outcomes.js';
export * from './upgrade-runner.js';
```

- [ ] **Step 4: Run upgrade tests to verify pass**

Run:

```bash
npm test -- --test-name-pattern "auto-selection upgrade"
```

Expected: both upgrade tests pass.

- [ ] **Step 5: Commit upgrade runner**

Run:

```bash
git add src/auto-selection/upgrade-runner.js src/auto-selection/index.js test/auto-selection.test.js
git commit -m "feat: add auto selection upgrade recovery"
```

Expected: commit succeeds.

---

### Task 5: Task Runner And Manager

**Files:**
- Create: `src/auto-selection/task-runner.js`
- Create: `src/auto-selection/task-manager.js`
- Modify: `src/auto-selection/index.js`
- Test: `test/auto-selection.test.js`

- [ ] **Step 1: Write failing runner and manager tests**

Append:

```js
import {
  AutoSelectionTaskManager,
  AutoSelectionTaskRunner
} from '../src/auto-selection/index.js';

test('auto-selection task runner serializes tick and write operations', async () => {
  const config = normalizeAutoSelectionConfig({
    baseUrl: 'https://xk.example.edu.cn/jwglxt',
    username: '2023123456',
    password: 'secret',
    pagePath: '/xsxk/index.html',
    groups: [{ name: '体育课', targets: [{ courseId: 'KC1', classId: 'A', priority: 1 }] }]
  });
  const calls = [];
  const runner = new AutoSelectionTaskRunner({
    id: 'task_test',
    config,
    autoStart: false,
    login: async () => ({ cookieHeader: 'JSESSIONID=test' }),
    createClient: () => ({
      bootstrapFromPage: async () => calls.push('bootstrap'),
      chosen: { snapshot: async () => makeSnapshot([]) },
      catalog: { getTeachingClasses: async () => [] }
    })
  });

  await Promise.all([runner.tick(), runner.tick()]);
  assert.deepEqual(calls, ['bootstrap']);
  assert.equal(runner.attempts, 1);
  assert.equal(runner.status, 'running');
});

test('auto-selection task manager creates sanitized task snapshots and cancels timers', async () => {
  const manager = new AutoSelectionTaskManager({
    autoStartTasks: false,
    login: async () => ({ cookieHeader: 'JSESSIONID=test' }),
    createClient: () => ({
      bootstrapFromPage: async () => {},
      chosen: { snapshot: async () => makeSnapshot([]) },
      catalog: { getTeachingClasses: async () => [] }
    })
  });
  const created = await manager.createTask({
    baseUrl: 'https://xk.example.edu.cn/jwglxt',
    username: '2023123456',
    password: 'secret',
    pagePath: '/xsxk/index.html',
    groups: [{ name: '体育课', targets: [{ courseId: 'KC1', classId: 'A', priority: 1 }] }]
  });

  assert.equal(created.usernameMasked, '******3456');
  assert.equal('password' in JSON.stringify(created), false);
  assert.equal(manager.listTasks().length, 1);
  const cancelled = manager.cancelTask(created.id);
  assert.equal(cancelled.status, 'cancelled');
});
```

- [ ] **Step 2: Run runner tests to verify failure**

Run:

```bash
npm test -- --test-name-pattern "auto-selection task"
```

Expected: runner and manager exports are missing.

- [ ] **Step 3: Implement task runner**

Create `src/auto-selection/task-runner.js`:

```js
import { createZfxkClient, HttpTransport, loginWithZfCaptcha } from '../index.js';
import { createAutoSelectionEventLog } from './events.js';
import { isSessionError } from './outcomes.js';
import { planGroupAction, reconcileGroups, chooseTarget, isGroupSucceeded } from './group-runner.js';
import { upgradeTarget } from './upgrade-runner.js';
import { maskUsername } from './config.js';

export class AutoSelectionTaskRunner {
  constructor(options = {}) {
    this.id = options.id;
    this.config = options.config;
    this.status = 'queued';
    this.authStatus = 'logged-out';
    this.attempts = 0;
    this.nextRunAt = null;
    this.startedAt = new Date();
    this.events = options.events ?? createAutoSelectionEventLog();
    this.login = options.login ?? loginWithZfCaptcha;
    this.createClient = options.createClient ?? defaultCreateClient;
    this.client = options.client;
    this.timer = null;
    this.isTicking = false;
    this.writeLock = false;
    this.pauseScope = undefined;
    this.autoStart = options.autoStart !== false;
    if (this.autoStart) this.start();
  }

  start() {
    if (this.status === 'cancelled') return;
    this.status = 'running';
    this.schedule(0);
  }

  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.status = 'cancelled';
    this.events.add('task-cancelled', 'Task cancelled');
    return this.snapshot();
  }

  resume() {
    if (this.status !== 'paused') return this.snapshot();
    this.pauseScope = undefined;
    for (const group of this.config.groups) {
      if (group.state === 'PAUSED') group.state = group.currentPlacement ? 'HOLDING' : 'WATCHING';
      group.pauseScope = undefined;
    }
    this.status = 'running';
    this.schedule(0);
    return this.snapshot();
  }

  schedule(delay = this.config.intervalMs) {
    if (!this.autoStart || this.status === 'cancelled') return;
    if (this.timer) clearTimeout(this.timer);
    this.nextRunAt = new Date(Date.now() + delay);
    this.timer = setTimeout(() => this.tick().catch((error) => this.handleTickError(error)), delay);
  }

  async tick() {
    if (this.isTicking || this.status === 'cancelled' || this.status === 'paused') return this.snapshot();
    this.isTicking = true;
    try {
      this.attempts += 1;
      await this.ensureAuthenticated();
      const snapshot = await this.client.chosen.snapshot();
      reconcileGroups(this.config.groups, snapshot);

      for (const group of this.config.groups) {
        if (this.writeLock) break;
        if (['PAUSED', 'FAILED', 'SUCCEEDED'].includes(group.state)) continue;
        const action = await planGroupAction(this, group);
        if (action.type === 'none') continue;
        await this.withWriteLock(async () => {
          if (action.type === 'choose') await chooseTarget(this, group, action.target, { teachingClass: action.teachingClass });
          if (action.type === 'upgrade') await upgradeTarget(this, group, action.current, action.next, { teachingClass: action.teachingClass });
        });
        break;
      }

      this.updateStatus();
      return this.snapshot();
    } catch (error) {
      if (isSessionError(error)) {
        await this.refreshAuth();
        return this.snapshot();
      }
      this.events.add('task-error', error.message);
      this.status = 'running';
      return this.snapshot();
    } finally {
      this.isTicking = false;
      if (this.autoStart && this.status === 'running') this.schedule();
    }
  }

  async ensureAuthenticated() {
    if (this.client) return;
    await this.refreshAuth();
  }

  async refreshAuth() {
    this.status = 'auth-refreshing';
    if (this.config.password) {
      const login = await this.login({
        baseUrl: this.config.baseUrl,
        username: this.config.username,
        password: this.config.password,
        maxCaptchaAttempts: 3
      });
      this.client = this.createClient({ baseUrl: this.config.baseUrl, cookie: login.cookieHeader, config: this.config });
    } else {
      this.client = this.createClient({ baseUrl: this.config.baseUrl, cookie: this.config.cookie, config: this.config });
    }
    await this.client.bootstrapFromPage({ path: this.config.pagePath });
    this.authStatus = 'logged-in';
    this.status = 'running';
    this.events.add('auth-refreshed', 'Authentication ready');
  }

  async withWriteLock(operation) {
    if (this.writeLock) return;
    this.writeLock = true;
    try {
      await operation();
    } finally {
      this.writeLock = false;
    }
  }

  updateStatus() {
    if (this.config.groups.every(isGroupSucceeded)) this.status = 'succeeded';
    else if (this.config.groups.every((group) => group.state === 'FAILED')) this.status = 'failed';
    else if (this.pauseScope === 'task' || this.config.groups.every((group) => group.state === 'PAUSED' || group.state === 'FAILED')) this.status = 'paused';
    else if (this.config.maxAttempts && this.attempts >= this.config.maxAttempts) this.status = 'paused';
    else this.status = 'running';
  }

  handleTickError(error) {
    this.events.add('task-error', error.message);
    if (this.status === 'running') this.schedule();
  }

  snapshot() {
    return {
      id: this.id,
      status: this.status,
      usernameMasked: maskUsername(this.config.username),
      authStatus: this.authStatus,
      attempts: this.attempts,
      intervalMs: this.config.intervalMs,
      nextRunAt: this.nextRunAt?.toISOString() ?? null,
      startedAt: this.startedAt.toISOString(),
      groups: this.config.groups.map((group) => ({
        groupId: group.groupId,
        name: group.name,
        state: group.state,
        currentTargetId: group.currentPlacement?.targetId ?? null,
        currentPriority: group.currentPlacement?.priority ?? null,
        isTopTargetSelected: group.isTopTargetSelected,
        pauseScope: group.pauseScope,
        lastMessage: group.lastMessage || '',
        targets: group.targets.map((target) => ({
          targetId: target.targetId,
          courseId: target.courseId,
          classId: target.classId,
          submitClassId: target.submitClassId,
          label: target.label,
          priority: target.priority,
          isBackup: target.isBackup,
          allowAutoDrop: target.allowAutoDrop,
          recoverOnUpgradeFailure: target.recoverOnUpgradeFailure,
          skipAfterNonCapacityFailure: target.skipAfterNonCapacityFailure,
          status: target.status,
          lastObservedRemaining: target.lastObservedRemaining,
          lastMessage: target.lastMessage
        }))
      })),
      events: this.events.list()
    };
  }
}

function defaultCreateClient({ baseUrl, cookie }) {
  return createZfxkClient({
    baseUrl,
    mode: 'commit',
    auth: { type: 'cookie', cookie },
    transport: new HttpTransport({ baseUrl, auth: { type: 'cookie', cookie } })
  });
}
```

- [ ] **Step 4: Implement task manager**

Create `src/auto-selection/task-manager.js`:

```js
import { normalizeAutoSelectionConfig, validateAutoSelectionConfig } from './config.js';
import { exportAutoSelectionConfig, importAutoSelectionConfig } from './config.js';
import { AutoSelectionTaskRunner } from './task-runner.js';

export class AutoSelectionTaskManager {
  constructor(options = {}) {
    this.tasks = new Map();
    this.nextId = 1;
    this.options = options;
  }

  async createTask(input = {}) {
    const validation = validateAutoSelectionConfig(input, { requireCredentials: true });
    if (!validation.valid) {
      const error = new Error(validation.errors.join('; '));
      error.code = 'AUTO_SELECTION_CONFIG_INVALID';
      error.errors = validation.errors;
      throw error;
    }
    const id = `task_${Date.now()}_${this.nextId++}`;
    const runner = new AutoSelectionTaskRunner({
      id,
      config: normalizeAutoSelectionConfig(input),
      autoStart: this.options.autoStartTasks !== false,
      login: this.options.login,
      createClient: this.options.createClient
    });
    this.tasks.set(id, runner);
    if (this.options.autoStartTasks === false) await runner.tick();
    return runner.snapshot();
  }

  listTasks() {
    return [...this.tasks.values()].map((task) => task.snapshot());
  }

  getTask(id) {
    return this.tasks.get(id)?.snapshot() ?? null;
  }

  getTaskEvents(id) {
    return this.tasks.get(id)?.events.list() ?? null;
  }

  cancelTask(id) {
    const task = this.tasks.get(id);
    return task ? task.cancel() : null;
  }

  resumeTask(id) {
    const task = this.tasks.get(id);
    return task ? task.resume() : null;
  }

  validateConfig(input) {
    return validateAutoSelectionConfig(input, { requireCredentials: false });
  }

  importConfig(input) {
    return importAutoSelectionConfig(input);
  }

  exportConfig(input) {
    return exportAutoSelectionConfig(input);
  }
}
```

Modify `src/auto-selection/index.js`:

```js
export * from './config.js';
export * from './events.js';
export * from './group-runner.js';
export * from './outcomes.js';
export * from './task-manager.js';
export * from './task-runner.js';
export * from './upgrade-runner.js';
```

- [ ] **Step 5: Run task tests to verify pass**

Run:

```bash
npm test -- --test-name-pattern "auto-selection task"
```

Expected: task runner and manager tests pass.

- [ ] **Step 6: Commit task runner and manager**

Run:

```bash
git add src/auto-selection/task-runner.js src/auto-selection/task-manager.js src/auto-selection/index.js test/auto-selection.test.js
git commit -m "feat: add auto selection task manager"
```

Expected: commit succeeds.

---

### Task 6: Local Web API Routes

**Files:**
- Modify: `scripts/serve-web.js`
- Modify: `test/web.test.js`

- [ ] **Step 1: Write failing API surface test**

Add these assertions to the existing `web frontend files expose` test:

```js
  const server = await readFile(new URL('../scripts/serve-web.js', import.meta.url), 'utf8');
  assert.match(server, /AutoSelectionTaskManager/);
  assert.match(server, /\/api\/auto-selection\/tasks/);
  assert.match(server, /\/api\/auto-selection\/config\/validate/);
  assert.match(server, /\/api\/auto-selection\/config\/import/);
  assert.match(server, /handleAutoSelection/);
```

- [ ] **Step 2: Run web test to verify failure**

Run:

```bash
npm test -- --test-name-pattern "web frontend files"
```

Expected: assertions fail because routes are not wired.

- [ ] **Step 3: Add API route dispatch**

Modify the imports in `scripts/serve-web.js`:

```js
import { AutoSelectionTaskManager } from '../src/auto-selection/index.js';
import { formatCookieHeader, loginWithZfCaptcha, solveZfCaptcha } from '../src/index.js';
```

Add near constants:

```js
const autoSelectionManager = new AutoSelectionTaskManager();
```

Add before static file serving:

```js
  if (url.pathname.startsWith('/api/auto-selection/')) {
    await handleAutoSelection(request, response, url);
    return;
  }
```

Add route handler functions:

```js
async function handleAutoSelection(request, response, url) {
  try {
    if (url.pathname === '/api/auto-selection/tasks' && request.method === 'POST') {
      writeJson(response, 200, await autoSelectionManager.createTask(await readJson(request)));
      return;
    }
    if (url.pathname === '/api/auto-selection/tasks' && request.method === 'GET') {
      writeJson(response, 200, { tasks: autoSelectionManager.listTasks() });
      return;
    }
    const taskMatch = url.pathname.match(/^\/api\/auto-selection\/tasks\/([^/]+)(?:\/([^/]+))?$/);
    if (taskMatch) {
      const [, id, action] = taskMatch;
      if (!action && request.method === 'GET') return writeFoundTask(response, autoSelectionManager.getTask(id));
      if (action === 'events' && request.method === 'GET') return writeFoundEvents(response, autoSelectionManager.getTaskEvents(id));
      if (action === 'cancel' && request.method === 'POST') return writeFoundTask(response, autoSelectionManager.cancelTask(id));
      if (action === 'resume' && request.method === 'POST') return writeFoundTask(response, autoSelectionManager.resumeTask(id));
    }
    if (url.pathname === '/api/auto-selection/config/validate' && request.method === 'POST') {
      writeJson(response, 200, autoSelectionManager.validateConfig(await readJson(request)));
      return;
    }
    if (url.pathname === '/api/auto-selection/config/import' && request.method === 'POST') {
      writeJson(response, 200, autoSelectionManager.importConfig(await readJson(request)));
      return;
    }
    writeText(response, 404, 'Not found');
  } catch (error) {
    writeJson(response, error.code === 'AUTO_SELECTION_CONFIG_INVALID' ? 400 : 500, {
      error: error.message,
      code: error.code,
      errors: error.errors
    });
  }
}

function writeFoundTask(response, task) {
  if (!task) return writeText(response, 404, 'Task not found');
  return writeJson(response, 200, task);
}

function writeFoundEvents(response, events) {
  if (!events) return writeText(response, 404, 'Task not found');
  return writeJson(response, 200, { events });
}
```

- [ ] **Step 4: Run API web test to verify pass**

Run:

```bash
npm test -- --test-name-pattern "web frontend files"
```

Expected: web file assertions pass.

- [ ] **Step 5: Commit API routes**

Run:

```bash
git add scripts/serve-web.js test/web.test.js
git commit -m "feat: add auto selection web api"
```

Expected: commit succeeds.

---

### Task 7: Frontend Draft Model And Controls

**Files:**
- Modify: `web/index.html`
- Modify: `web/app.js`
- Modify: `test/web.test.js`

- [ ] **Step 1: Write failing UI structure assertions**

Add to `test/web.test.js`:

```js
  assert.match(html, /id="autoSelectionPanel"/);
  assert.match(html, /id="autoGroupTabs"/);
  assert.match(html, /id="autoTargetList"/);
  assert.match(html, /id="autoTaskStatusPanel"/);
  assert.match(html, /id="autoEventLog"/);
  assert.match(html, /id="autoExportConfigBtn"/);
  assert.match(html, /id="autoImportConfigInput"/);
  assert.match(app, /autoSelectionDraft/);
  assert.match(app, /addClassToAutoSelection/);
  assert.match(app, /pollAutoSelectionTasks/);
  assert.match(app, /\/api\/auto-selection\/tasks/);
  assert.match(app, /\/api\/auto-selection\/config\/import/);
  assert.match(app, /加入自动选课/);
```

- [ ] **Step 2: Run UI test to verify failure**

Run:

```bash
npm test -- --test-name-pattern "web frontend files"
```

Expected: new assertions fail.

- [ ] **Step 3: Add HTML panels**

In `web/index.html`, add a topbar toggle and a dedicated `auto-selection-workspace` section near the existing workspace:

```html
<button id="autoSelectionToggleBtn" type="button" title="打开自动选课">自动选课</button>
```

```html
<section id="autoSelectionPanel" class="auto-selection-workspace" aria-label="自动选课">
  <aside class="auto-config-pane" aria-label="任务配置">
    <div class="section-heading"><h2><span class="step-badge">1</span>任务配置</h2></div>
    <label>刷新间隔 <input id="autoIntervalInput" type="number" min="500" step="100" value="1500"></label>
    <label>最大尝试次数 <input id="autoMaxAttemptsInput" type="number" min="1" placeholder="不限制"></label>
    <label>截止时间 <input id="autoDeadlineInput" type="datetime-local"></label>
    <label>失败策略 <select id="autoFailureStrategySelect"><option value="skip-non-capacity">非容量失败跳过，容量满继续刷</option></select></label>
    <div class="auto-config-actions">
      <button id="autoStartBtn" type="button">启动自动选课</button>
      <button id="autoPauseBtn" type="button" class="secondary">暂停显示</button>
      <button id="autoCancelBtn" type="button" class="danger">取消任务</button>
    </div>
    <div class="auto-import-export">
      <button id="autoExportConfigBtn" type="button" class="secondary">导出配置</button>
      <label class="file-button">加载配置 <input id="autoImportConfigInput" type="file" accept="application/json,.json"></label>
    </div>
  </aside>
  <section class="auto-groups-pane" aria-label="选课组配置">
    <div class="section-heading">
      <h2><span class="step-badge">2</span>选课组配置</h2>
      <button id="autoAddGroupBtn" type="button">新建选课组</button>
    </div>
    <div id="autoGroupTabs" class="auto-group-tabs"></div>
    <div id="autoTargetList" class="auto-target-list"></div>
  </section>
  <aside id="autoTaskStatusPanel" class="auto-status-pane" aria-label="后台任务状态">
    <div class="section-heading"><h2><span class="step-badge">3</span>后台任务状态</h2></div>
    <div id="autoTaskSummary" class="auto-task-summary">暂无运行任务</div>
    <div id="autoGroupStatusList" class="auto-group-status-list"></div>
    <ol id="autoEventLog" class="auto-event-log"></ol>
  </aside>
</section>
```

- [ ] **Step 4: Add frontend state and interactions**

In `web/app.js`, extend `elements`:

```js
  autoSelectionPanel: document.querySelector('#autoSelectionPanel'),
  autoSelectionToggleBtn: document.querySelector('#autoSelectionToggleBtn'),
  autoIntervalInput: document.querySelector('#autoIntervalInput'),
  autoMaxAttemptsInput: document.querySelector('#autoMaxAttemptsInput'),
  autoDeadlineInput: document.querySelector('#autoDeadlineInput'),
  autoStartBtn: document.querySelector('#autoStartBtn'),
  autoPauseBtn: document.querySelector('#autoPauseBtn'),
  autoCancelBtn: document.querySelector('#autoCancelBtn'),
  autoExportConfigBtn: document.querySelector('#autoExportConfigBtn'),
  autoImportConfigInput: document.querySelector('#autoImportConfigInput'),
  autoAddGroupBtn: document.querySelector('#autoAddGroupBtn'),
  autoGroupTabs: document.querySelector('#autoGroupTabs'),
  autoTargetList: document.querySelector('#autoTargetList'),
  autoTaskSummary: document.querySelector('#autoTaskSummary'),
  autoGroupStatusList: document.querySelector('#autoGroupStatusList'),
  autoEventLog: document.querySelector('#autoEventLog')
```

Extend `state`:

```js
  autoSelectionDraft: {
    groups: [{ name: '体育课', targets: [] }],
    activeGroupIndex: 0
  },
  autoTasks: [],
  autoPollingTimer: null,
  autoPanelVisible: true
```

Add event listeners:

```js
elements.autoSelectionToggleBtn.addEventListener('click', () => toggleAutoSelectionPanel());
elements.autoAddGroupBtn.addEventListener('click', () => addAutoSelectionGroup());
elements.autoStartBtn.addEventListener('click', () => startAutoSelectionTask());
elements.autoCancelBtn.addEventListener('click', () => cancelCurrentAutoTask());
elements.autoExportConfigBtn.addEventListener('click', () => exportAutoSelectionDraft());
elements.autoImportConfigInput.addEventListener('change', () => importAutoSelectionDraft());
elements.autoGroupTabs.addEventListener('click', (event) => selectAutoGroup(event));
elements.autoTargetList.addEventListener('click', (event) => handleAutoTargetAction(event));
elements.autoTargetList.addEventListener('input', (event) => updateAutoTargetField(event));
```

Add `addClassToAutoSelection` and call it from `renderClasses()`:

```js
const autoButton = document.createElement('button');
autoButton.type = 'button';
autoButton.className = 'secondary auto-add-class-button';
autoButton.textContent = '加入自动选课';
autoButton.addEventListener('click', () => addClassToAutoSelection(item));
actions.append(autoButton);
```

Implement:

```js
function addClassToAutoSelection(teachingClass) {
  const group = state.autoSelectionDraft.groups[state.autoSelectionDraft.activeGroupIndex] ?? state.autoSelectionDraft.groups[0];
  const target = {
    courseId: teachingClass.courseId,
    classId: teachingClass.classId,
    submitClassId: teachingClass.submitClassId,
    label: `${teachingClass.name || teachingClass.raw?.jxbmc || teachingClass.classId}`,
    priority: nextAutoPriority(group),
    isBackup: group.targets.length > 0,
    allowAutoDrop: group.targets.length > 0,
    recoverOnUpgradeFailure: true,
    skipAfterNonCapacityFailure: true
  };
  group.targets.push(target);
  group.targets.sort((a, b) => Number(b.priority) - Number(a.priority));
  renderAutoSelectionDraft();
  log(`已加入自动选课：${target.label}`);
}

function nextAutoPriority(group) {
  const priorities = group.targets.map((target) => Number(target.priority)).filter(Number.isFinite);
  return priorities.length ? Math.max(1, Math.min(...priorities) - 10) : 100;
}
```

- [ ] **Step 5: Add API calls and renderers**

Add:

```js
async function startAutoSelectionTask() {
  await runTask('启动自动选课', async () => {
    const payload = buildAutoSelectionPayload(true);
    const response = await fetch('/api/auto-selection/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload)
    });
    const task = await readResponse(response, '/api/auto-selection/tasks');
    state.autoTasks = [task];
    renderAutoTaskStatus();
    pollAutoSelectionTasks();
  });
}

function buildAutoSelectionPayload(includeSecrets = false) {
  return {
    baseUrl: elements.baseUrlInput.value.trim(),
    username: elements.usernameInput.value.trim(),
    password: includeSecrets ? elements.passwordInput.value : undefined,
    cookie: includeSecrets ? elements.cookieInput.value.trim() : undefined,
    pagePath: elements.pagePathInput.value.trim(),
    intervalMs: Number(elements.autoIntervalInput.value) || 1500,
    maxAttempts: elements.autoMaxAttemptsInput.value ? Number(elements.autoMaxAttemptsInput.value) : null,
    deadlineAt: elements.autoDeadlineInput.value || null,
    groups: state.autoSelectionDraft.groups
  };
}

async function pollAutoSelectionTasks() {
  clearTimeout(state.autoPollingTimer);
  const response = await fetch('/api/auto-selection/tasks');
  const result = await readResponse(response, '/api/auto-selection/tasks');
  state.autoTasks = result.tasks ?? [];
  renderAutoTaskStatus();
  state.autoPollingTimer = setTimeout(pollAutoSelectionTasks, 1500);
}

function renderAutoSelectionDraft() {
  elements.autoGroupTabs.replaceChildren();
  state.autoSelectionDraft.groups.forEach((group, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `auto-group-tab ${index === state.autoSelectionDraft.activeGroupIndex ? 'active' : ''}`;
    button.dataset.autoGroupIndex = String(index);
    button.textContent = `${group.name} ${group.targets.length}`;
    elements.autoGroupTabs.append(button);
  });

  const group = state.autoSelectionDraft.groups[state.autoSelectionDraft.activeGroupIndex];
  if (!group) {
    elements.autoTargetList.textContent = '暂无选课组';
    return;
  }
  if (!group.targets.length) {
    elements.autoTargetList.textContent = '从教学班列表加入目标';
    return;
  }

  const table = document.createElement('table');
  table.className = 'auto-target-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>优先级</th><th>教学班</th><th>保底</th><th>可退升级</th><th>失败恢复</th><th>操作</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  group.targets.forEach((target, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input data-auto-target-index="${index}" data-auto-target-field="priority" type="number" value="${Number(target.priority) || 0}"></td>
      <td><strong>${escapeHtml(target.label || target.classId)}</strong><br><span>${escapeHtml(target.courseId)} · ${escapeHtml(target.submitClassId || target.classId)}</span></td>
      <td><input data-auto-target-index="${index}" data-auto-target-field="isBackup" type="checkbox" ${target.isBackup ? 'checked' : ''}></td>
      <td><input data-auto-target-index="${index}" data-auto-target-field="allowAutoDrop" type="checkbox" ${target.allowAutoDrop ? 'checked' : ''}></td>
      <td><input data-auto-target-index="${index}" data-auto-target-field="recoverOnUpgradeFailure" type="checkbox" ${target.recoverOnUpgradeFailure !== false ? 'checked' : ''}></td>
      <td><button type="button" class="section-text-button" data-auto-remove-target="${index}">移除</button></td>
    `;
    tbody.append(row);
  });
  elements.autoTargetList.replaceChildren(table);
}

function renderAutoTaskStatus() {
  const task = state.autoTasks[0];
  if (!task) {
    elements.autoTaskSummary.textContent = '暂无运行任务';
    elements.autoGroupStatusList.replaceChildren();
    elements.autoEventLog.replaceChildren();
    return;
  }
  elements.autoTaskSummary.innerHTML = `
    <div><strong>${escapeHtml(task.status)}</strong> · ${escapeHtml(task.usernameMasked || '')}</div>
    <div>认证：${escapeHtml(task.authStatus || 'unknown')}</div>
    <div>尝试：${Number(task.attempts) || 0} 次</div>
    <div>下次刷新：${escapeHtml(task.nextRunAt || '未排程')}</div>
  `;
  elements.autoGroupStatusList.replaceChildren(...(task.groups || []).map((group) => {
    const card = document.createElement('article');
    card.className = 'auto-group-status-card';
    card.innerHTML = `
      <div class="card-title"><strong>${escapeHtml(group.name)}</strong><span>${escapeHtml(group.state)}</span></div>
      <div class="meta">当前占位：${escapeHtml(group.currentTargetId || '无')} · ${group.isTopTargetSelected ? '成功' : '继续观察'}</div>
    `;
    return card;
  }));
  elements.autoEventLog.replaceChildren(...(task.events || []).slice(-30).map((event) => {
    const item = document.createElement('li');
    item.textContent = `${event.at?.slice(11, 19) || ''} ${event.message || event.type}`;
    return item;
  }));
}

function selectAutoGroup(event) {
  const button = event.target.closest('[data-auto-group-index]');
  if (!button) return;
  state.autoSelectionDraft.activeGroupIndex = Number(button.dataset.autoGroupIndex);
  renderAutoSelectionDraft();
}

function handleAutoTargetAction(event) {
  const removeButton = event.target.closest('[data-auto-remove-target]');
  if (!removeButton) return;
  const group = state.autoSelectionDraft.groups[state.autoSelectionDraft.activeGroupIndex];
  group.targets.splice(Number(removeButton.dataset.autoRemoveTarget), 1);
  renderAutoSelectionDraft();
}

function updateAutoTargetField(event) {
  const input = event.target.closest('[data-auto-target-field]');
  if (!input) return;
  const group = state.autoSelectionDraft.groups[state.autoSelectionDraft.activeGroupIndex];
  const target = group.targets[Number(input.dataset.autoTargetIndex)];
  const field = input.dataset.autoTargetField;
  target[field] = input.type === 'checkbox' ? input.checked : Number(input.value);
  group.targets.sort((a, b) => Number(b.priority) - Number(a.priority));
  renderAutoSelectionDraft();
}
```

- [ ] **Step 6: Run UI structure tests to verify pass**

Run:

```bash
npm test -- --test-name-pattern "web frontend files"
```

Expected: UI structure assertions pass.

- [ ] **Step 7: Commit frontend controls**

Run:

```bash
git add web/index.html web/app.js test/web.test.js
git commit -m "feat: add auto selection web controls"
```

Expected: commit succeeds.

---

### Task 8: Frontend Visual Polish Against Reference Image

**Files:**
- Modify: `web/styles.css`
- Modify: `test/web.test.js`

- [ ] **Step 1: Write failing style assertions**

Add to `test/web.test.js`:

```js
  assert.match(css, /auto-selection-workspace/);
  assert.match(css, /auto-config-pane/);
  assert.match(css, /auto-groups-pane/);
  assert.match(css, /auto-status-pane/);
  assert.match(css, /step-badge/);
  assert.match(css, /auto-target-table/);
  assert.match(css, /grid-template-columns:\s*minmax\(280px,\s*0\.82fr\)\s*minmax\(520px,\s*1\.45fr\)\s*minmax\(340px,\s*0\.95fr\)/);
```

- [ ] **Step 2: Run style test to verify failure**

Run:

```bash
npm test -- --test-name-pattern "web frontend files"
```

Expected: style assertions fail.

- [ ] **Step 3: Add dense three-column styles**

Append CSS:

```css
.auto-selection-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 0.82fr) minmax(520px, 1.45fr) minmax(340px, 0.95fr);
  gap: 12px;
  margin-top: 12px;
  align-items: stretch;
}

.auto-config-pane,
.auto-groups-pane,
.auto-status-pane {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
  min-height: 560px;
  padding: 12px;
}

.step-badge {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-right: 8px;
  border-radius: 5px;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
}

.auto-config-pane label {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
  color: var(--muted);
  font-weight: 750;
}

.auto-config-actions,
.auto-import-export,
.auto-group-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.file-button {
  position: relative;
  display: inline-grid;
  place-items: center;
  min-height: 36px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0 12px;
  background: #fff;
  color: var(--text);
  cursor: pointer;
}

.file-button input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.auto-group-tab {
  border-color: #d7e6f6;
  background: #f7fbff;
  color: #155fa0;
}

.auto-group-tab.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.auto-target-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
  font-size: 14px;
}

.auto-target-table th,
.auto-target-table td {
  border-bottom: 1px solid #e7edf6;
  padding: 8px 6px;
  text-align: left;
  vertical-align: middle;
}

.auto-target-table th {
  color: #66758c;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.auto-target-table input[type="number"] {
  width: 72px;
}

.auto-task-summary,
.auto-group-status-card,
.auto-event-log {
  border: 1px solid #e2eaf4;
  border-radius: 7px;
  background: #fff;
}

.auto-task-summary {
  display: grid;
  gap: 8px;
  padding: 10px;
}

.auto-group-status-list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.auto-group-status-card {
  padding: 10px;
}

.auto-event-log {
  max-height: 260px;
  margin: 12px 0 0;
  padding: 10px 10px 10px 30px;
  overflow: auto;
  color: #4e5e76;
  font-size: 13px;
}

@media (max-width: 1180px) {
  .auto-selection-workspace {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: Run style tests to verify pass**

Run:

```bash
npm test -- --test-name-pattern "web frontend files"
```

Expected: style assertions pass.

- [ ] **Step 5: Commit visual styles**

Run:

```bash
git add web/styles.css test/web.test.js
git commit -m "feat: style auto selection workspace"
```

Expected: commit succeeds.

---

### Task 9: Docs, Types, And OpenAPI

**Files:**
- Modify: `src/index.js`
- Modify: `src/index.d.ts`
- Modify: `src/docs/openapi.js`
- Regenerate: `docs/openapi.json`
- Modify: `README.md`

- [ ] **Step 1: Export SDK modules**

Modify `src/index.js`:

```js
export * from './auto-selection/index.js';
```

- [ ] **Step 2: Add TypeScript declarations**

Append to `src/index.d.ts`:

```ts
export type AutoSelectionTaskStatus = 'queued' | 'running' | 'auth-refreshing' | 'paused' | 'succeeded' | 'failed' | 'cancelled';
export type AutoSelectionGroupStatus = 'WATCHING' | 'ATTEMPTING' | 'HOLDING' | 'PRECHECK_UPGRADE' | 'DROP_BACKUP' | 'CHOOSE_TARGET' | 'RECOVER_BACKUP' | 'SUCCEEDED' | 'PAUSED' | 'FAILED';
export type AutoSelectionTargetStatus = 'watching' | 'selected' | 'skipped' | 'failed';

export interface AutoSelectionTarget {
  targetId?: string;
  courseId: string;
  classId: string;
  submitClassId?: string;
  label?: string;
  priority: number;
  isBackup?: boolean;
  allowAutoDrop?: boolean;
  recoverOnUpgradeFailure?: boolean;
  skipAfterNonCapacityFailure?: boolean;
  status?: AutoSelectionTargetStatus;
  lastObservedRemaining?: number | null;
  lastMessage?: string;
  createdOrder?: number;
}

export interface AutoSelectionGroupConfig {
  groupId?: string;
  name: string;
  state?: AutoSelectionGroupStatus;
  currentPlacement?: AutoSelectionTarget | null;
  isTopTargetSelected?: boolean;
  pauseScope?: 'group' | 'task';
  targets: AutoSelectionTarget[];
}

export interface AutoSelectionTaskConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  cookie?: string;
  pagePath: string;
  intervalMs?: number;
  maxAttempts?: number | null;
  deadlineAt?: string | null;
  groups: AutoSelectionGroupConfig[];
}

export interface AutoSelectionTaskSnapshot {
  id: string;
  status: AutoSelectionTaskStatus;
  usernameMasked: string;
  authStatus: string;
  attempts: number;
  intervalMs: number;
  nextRunAt: string | null;
  startedAt: string;
  groups: AutoSelectionGroupConfig[];
  events: Array<{ id: string; at: string; type: string; message: string; details?: Record<string, unknown> }>;
}

export declare class AutoSelectionTaskManager {
  constructor(options?: Record<string, unknown>);
  createTask(input: AutoSelectionTaskConfig): Promise<AutoSelectionTaskSnapshot>;
  listTasks(): AutoSelectionTaskSnapshot[];
  getTask(id: string): AutoSelectionTaskSnapshot | null;
  getTaskEvents(id: string): AutoSelectionTaskSnapshot['events'] | null;
  cancelTask(id: string): AutoSelectionTaskSnapshot | null;
  resumeTask(id: string): AutoSelectionTaskSnapshot | null;
  validateConfig(input: AutoSelectionTaskConfig): { valid: boolean; errors: string[]; config: AutoSelectionTaskConfig };
  importConfig(input: Record<string, unknown>): { valid: boolean; errors: string[]; config: AutoSelectionTaskConfig };
  exportConfig(input: AutoSelectionTaskConfig): Record<string, unknown>;
}
```

- [ ] **Step 3: Add OpenAPI paths and schemas**

In `src/docs/openapi.js`, add this tag inside `tags`:

```js
      { name: 'AutoSelection' }
```

Add these path entries inside `paths`:

```js
      '/sdk/auto-selection/config/validate': {
        post: {
          tags: ['AutoSelection'],
          operationId: 'validateAutoSelectionConfig',
          summary: 'Validate an automatic-selection task draft without starting it.',
          requestBody: requestBody(ref('AutoSelectionTaskConfig')),
          responses: {
            200: ok('Validation result', object({
              valid: boolean(),
              errors: arrayOf(string()),
              config: ref('AutoSelectionTaskConfig')
            }, ['valid', 'errors', 'config']))
          }
        }
      },
      '/sdk/auto-selection/config/import': {
        post: {
          tags: ['AutoSelection'],
          operationId: 'importAutoSelectionConfig',
          summary: 'Import a sanitized automatic-selection JSON config as a draft.',
          requestBody: requestBody(mapOf({})),
          responses: {
            200: ok('Imported draft config', object({
              valid: boolean(),
              errors: arrayOf(string()),
              config: ref('AutoSelectionTaskConfig')
            }, ['valid', 'errors', 'config']))
          }
        }
      }
```

Add these schemas inside `schemas`:

```js
  AutoSelectionTarget: object({
    targetId: string(),
    courseId: string(),
    classId: string(),
    submitClassId: string(),
    label: string(),
    priority: number(),
    isBackup: boolean(),
    allowAutoDrop: boolean(),
    recoverOnUpgradeFailure: boolean(),
    skipAfterNonCapacityFailure: boolean(),
    status: string(),
    lastObservedRemaining: number(),
    lastMessage: string()
  }, ['courseId', 'classId', 'priority']),
  AutoSelectionGroupConfig: object({
    groupId: string(),
    name: string(),
    state: string(),
    pauseScope: string(),
    targets: arrayOf(ref('AutoSelectionTarget'))
  }, ['name', 'targets']),
  AutoSelectionTaskConfig: object({
    baseUrl: string(),
    username: string(),
    password: string(),
    cookie: string(),
    pagePath: string(),
    intervalMs: integer(),
    maxAttempts: integer(),
    deadlineAt: string(),
    groups: arrayOf(ref('AutoSelectionGroupConfig'))
  }, ['baseUrl', 'pagePath', 'groups']),
  AutoSelectionTaskSnapshot: object({
    id: string(),
    status: string(),
    usernameMasked: string(),
    authStatus: string(),
    attempts: integer(),
    intervalMs: integer(),
    nextRunAt: string(),
    startedAt: string(),
    groups: arrayOf(ref('AutoSelectionGroupConfig')),
    events: arrayOf(object({
      id: string(),
      at: string(),
      type: string(),
      message: string(),
      details: mapOf({})
    }, ['id', 'at', 'type', 'message']))
  }, ['id', 'status', 'usernameMasked', 'authStatus', 'attempts', 'intervalMs', 'groups', 'events'])
```

- [ ] **Step 4: Regenerate docs**

Run:

```bash
npm run openapi
```

Expected: `docs/openapi.json` updates and command exits 0.

- [ ] **Step 5: Update README**

Add a section:

```md
## 自动选课后台任务

`npm run web` now includes a local-only automatic selection task runner. The browser page can be closed after a task starts; the task continues while the Node process is alive.

- Use explicit teaching-class targets from the parsed class list.
- Targets are grouped and sorted by priority.
- Lower-priority backups can be held first, then upgraded when a higher-priority class has capacity.
- If an upgrade loses the race, the runner attempts to recover the previous backup.
- Username/password login is preferred for session renewal; cookies are accepted only as optional initial credentials.
- Exported JSON configs never include password, cookie, runtime events, or selected snapshots.

This first version keeps tasks in memory. Stopping the Node process cancels running tasks.
```

- [ ] **Step 6: Run docs/types tests**

Run:

```bash
npm test -- --test-name-pattern "docs|web frontend files"
```

Expected: docs and web assertions pass.

- [ ] **Step 7: Commit docs and types**

Run:

```bash
git add src/index.js src/index.d.ts src/docs/openapi.js docs/openapi.json README.md test/web.test.js
git commit -m "docs: document auto selection tasks"
```

Expected: commit succeeds.

---

### Task 10: Full Verification And Status Log

**Files:**
- Modify: `statusquo.md`

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: all `node --test` tests pass.

- [ ] **Step 2: Run docs generation**

Run:

```bash
npm run docs
```

Expected: OpenAPI and Typedoc generation pass.

- [ ] **Step 3: Start web server for manual UI verification**

Run:

```bash
npm run web
```

Expected: terminal prints `zfxk web frontend: http://127.0.0.1:4173/`.

- [ ] **Step 4: Browser verification**

Open `http://127.0.0.1:4173/` in the in-app browser and verify:

```text
The automatic-selection workspace is visible.
The layout uses three dense columns.
The first column contains task config, import, export, start, pause, and cancel controls.
The center column contains group tabs and target rows.
The right column contains task summary, group state cards, and recent events.
Teaching-class cards have a "加入自动选课" action.
Text does not overlap at desktop width and mobile width.
```

- [ ] **Step 5: Stop web server**

Terminate the `npm run web` session with Ctrl-C.

- [ ] **Step 6: Append status log**

Append to `statusquo.md`:

```md
## [2026-06-29 21:45] Auto Selection Background Tasks
- **Changes:** Implemented automatic selection contracts, outcome normalization, group and upgrade runners, task manager, local web API routes, dense UI controls, JSON import/export, SDK typings, OpenAPI, README docs, and tests.
- **Status:** Completed
- **Next Steps:** Use a real school account in the local web app to validate live backend behavior; keep exported configs out of credentials storage.
- **Context:** Tasks are in-memory and continue only while `npm run web` keeps the Node process alive. Exported configs intentionally omit password and Cookie.
```

- [ ] **Step 7: Check diff and whitespace**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; status shows only intended files.

- [ ] **Step 8: Commit final status**

Run:

```bash
git add .
git commit -m "feat: add auto selection background tasks"
```

Expected: commit succeeds.

- [ ] **Step 9: Push**

Run:

```bash
git push
```

Expected: branch pushes to `origin/main` or reports everything up to date.

---

## Self-Review

**Spec coverage:** The tasks cover config normalization, target IDs, credential redaction, capacity-vs-snapshot outcome handling, wide class matching, snapshot reconciliation, task-level write lock, group-level and task-level pauses, backup recovery, session-expired upgrade recovery, API routes, import/export, UI controls, docs, and tests.

**Placeholder scan:** The plan contains no unresolved marker text, no deferred implementation text, and no empty edge-case instructions. Every implementation task names exact files, commands, expected results, and concrete code.

**Type consistency:** The same names are used across tests and modules: `AutoSelectionTaskManager`, `AutoSelectionTaskRunner`, `normalizeAutoSelectionConfig`, `validateAutoSelectionConfig`, `importAutoSelectionConfig`, `exportAutoSelectionConfig`, `matchTarget`, `snapshotHasTarget`, `planGroupAction`, `chooseTarget`, and `upgradeTarget`.
