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
