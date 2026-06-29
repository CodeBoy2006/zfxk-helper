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
    if (group.isTopTargetSelected) {
      group.state = 'SUCCEEDED';
    } else if (selectedTarget) {
      group.state = 'HOLDING';
    } else if (group.state !== 'PAUSED' && group.state !== 'FAILED') {
      group.state = 'WATCHING';
    }
  }
}

export function isGroupSucceeded(group) {
  const activeTargets = group.targets.filter((target) => target.status !== 'skipped');
  if (!activeTargets.length || !group.currentPlacement) return false;
  const [topTarget] = activeTargets.sort(byPriorityDescThenCreatedOrder);
  return sameTarget(group.currentPlacement, topTarget);
}

export async function planGroupAction(task, group) {
  const observed = await observeGroupTargets(task, group);
  const available = observed
    .filter(({ target, teachingClass }) => target.status !== 'skipped' && isTeachingClassAvailable(teachingClass))
    .sort((a, b) => byPriorityDescThenCreatedOrder(a.target, b.target));

  if (!available.length) return { type: 'none' };

  const next = available[0];
  if (!group.currentPlacement) {
    return { type: 'choose', target: next.target, teachingClass: next.teachingClass };
  }
  if (sameTarget(group.currentPlacement, next.target)) return { type: 'none' };
  if (next.target.priority > group.currentPlacement.priority) {
    return {
      type: 'upgrade',
      current: group.currentPlacement,
      next: next.target,
      teachingClass: next.teachingClass
    };
  }
  return { type: 'none' };
}

export async function observeGroupTargets(task, group) {
  const courseIds = [...new Set(group.targets.map((target) => target.courseId).filter(Boolean))];
  const observed = [];
  for (const courseId of courseIds) {
    const teachingClasses = await task.client.catalog.getTeachingClasses(courseId);
    for (const teachingClass of teachingClasses) {
      const target = group.targets.find((candidate) => matchTarget(candidate, teachingClass));
      if (!target) continue;
      target.lastObservedRemaining = classRemaining(teachingClass);
      target.lastMessage = target.lastObservedRemaining === 0 ? 'capacity full' : '';
      observed.push({ target, teachingClass });
    }
  }
  return observed;
}

export async function chooseTarget(task, group, target, options = {}) {
  group.state = 'CHOOSE_TARGET';
  const result = await callChoose(task, target, options.teachingClass);
  const outcome = normalizeChooseOutcome(result);
  if (outcome.type === 'selected' || outcome.type === 'pending-filter') {
    return confirmSelection(task, group, target, result, outcome);
  }
  applyChooseFailure(task, group, target, outcome);
  return outcome;
}

export function backgroundChoosePolicy() {
  return {
    confirm: async (event) => event.kind === 'title-check'
  };
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

async function confirmSelection(task, group, target, result, outcome) {
  const snapshots = [];
  if (result?.snapshot) snapshots.push(result.snapshot);
  for (let attempt = 0; attempt < 2 && !snapshots.some((snapshot) => snapshotHasTarget(snapshot, target)); attempt += 1) {
    snapshots.push(await task.client.chosen.snapshot());
  }

  const selected = snapshots
    .map((snapshot) => findSnapshotSelection(snapshot, target))
    .find(Boolean);

  if (!selected) {
    const transient = { type: 'transient-error', reason: 'SNAPSHOT_CONFIRM_FAILED' };
    group.state = group.currentPlacement ? 'HOLDING' : 'WATCHING';
    target.lastMessage = transient.reason;
    task.events?.add('choose-transient', `${group.name}: snapshot did not confirm ${target.label || target.classId}`);
    return transient;
  }

  target.status = 'selected';
  group.currentPlacement = target;
  group.isTopTargetSelected = isGroupSucceeded(group);
  group.state = group.isTopTargetSelected ? 'SUCCEEDED' : 'HOLDING';
  task.events?.add('choose-selected', `${group.name}: selected ${target.label || target.classId}`, {
    targetId: target.targetId
  });
  return outcome;
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
    if (outcome.pauseScope === 'task') task.pauseScope = 'task';
    return;
  }
  if (outcome.type === 'business-failed' && target.skipAfterNonCapacityFailure) {
    target.status = 'skipped';
  }
  group.state = group.targets.every((candidate) => candidate.status === 'skipped') ? 'FAILED' : 'WATCHING';
}
