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
  if (dropOutcome.type === 'session-expired') {
    return recoverAfterSessionExpired(task, group, current, next, dropOutcome);
  }
  if (dropOutcome.type !== 'dropped') {
    group.state = dropOutcome.type === 'human-required' ? 'PAUSED' : 'HOLDING';
    group.lastMessage = dropOutcome.reason || dropOutcome.type;
    return dropOutcome;
  }

  group.currentPlacement = null;
  group.state = 'CHOOSE_TARGET';
  const chooseOutcome = await chooseTarget(task, group, next, options);
  if (chooseOutcome.type === 'selected' || chooseOutcome.type === 'pending-filter') return chooseOutcome;
  if (chooseOutcome.type === 'session-expired') {
    return recoverAfterSessionExpired(task, group, current, next, chooseOutcome);
  }
  if ((chooseOutcome.type === 'capacity-full' || chooseOutcome.type === 'business-failed') && current.recoverOnUpgradeFailure) {
    await recoverBackup(task, group, current);
  }
  return chooseOutcome;
}

export async function recoverBackup(task, group, current) {
  group.state = 'RECOVER_BACKUP';
  const recovery = await chooseTarget(task, group, current);
  if (recovery.type === 'selected' || recovery.type === 'pending-filter') {
    group.currentPlacement = current;
    group.state = 'HOLDING';
    task.events?.add('recover-selected', `${group.name}: recovered ${current.label || current.classId}`, {
      targetId: current.targetId
    });
    return recovery;
  }

  group.state = 'PAUSED';
  group.pauseScope = 'task';
  task.pauseScope = 'task';
  group.lastMessage = 'backup was dropped but recovery failed';
  task.events?.add('recover-failed', `${group.name}: backup was dropped but recovery failed`, {
    targetId: current.targetId
  });
  return recovery;
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
