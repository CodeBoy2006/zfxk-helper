import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classRemaining,
  chooseTarget,
  createAutoSelectionEventLog,
  exportAutoSelectionConfig,
  importAutoSelectionConfig,
  matchTarget,
  normalizeChooseOutcome,
  normalizeAutoSelectionConfig,
  planGroupAction,
  reconcileGroups,
  snapshotHasTarget,
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
  assert.equal(config.groups[0].targets[0].targetId, 'KC1:HIGH:1');
  assert.equal(config.groups[0].targets[0].allowAutoDrop, false);
  assert.equal(config.groups[0].targets[0].recoverOnUpgradeFailure, true);
  assert.equal(config.groups[0].targets[0].status, 'watching');
  assert.equal(config.groups[0].targets[1].targetId, 'KC1:LOW:0');
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

test('auto-selection target matching accepts classId and submitClassId aliases', () => {
  const target = { courseId: 'KC1', classId: 'JXB1', submitClassId: 'DO1' };

  assert.equal(matchTarget(target, { courseId: 'KC1', classId: 'JXB1', submitClassId: 'DO1' }), true);
  assert.equal(matchTarget(target, { courseId: 'KC1', classId: 'DO1', submitClassId: 'JXB1' }), true);
  assert.equal(matchTarget(target, { courseId: 'KC1', classId: 'OTHER', submitClassId: 'NOPE' }), false);
  assert.equal(matchTarget(target, { courseId: 'KC2', classId: 'JXB1', submitClassId: 'DO1' }), false);
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
  const target = {
    courseId: 'KC1',
    classId: 'HIGH',
    submitClassId: 'DO_HIGH',
    priority: 100,
    targetId: 'KC1:HIGH:0',
    status: 'watching'
  };
  const group = {
    name: '体育课',
    state: 'WATCHING',
    targets: [target],
    currentPlacement: null,
    isTopTargetSelected: false
  };
  let snapshotCalls = 0;
  const task = {
    events,
    client: {
      selection: {
        choose: async () => ({ status: 'selected', snapshot: makeSnapshot([]) })
      },
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
