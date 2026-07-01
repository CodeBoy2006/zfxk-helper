import {
  byPriorityDescThenCreatedOrder,
  courseTypeContextKey,
  courseTypeContextToRaw,
  normalizeCourseTypeContext
} from './config.js';
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
  if (group.strategy === 'equivalent') {
    return activeTargets.some((target) => sameTarget(group.currentPlacement, target));
  }
  const [topTarget] = activeTargets.sort(byPriorityDescThenCreatedOrder);
  return activeTargets.some((target) =>
    sameTarget(group.currentPlacement, target) && Number(target.priority) === Number(topTarget.priority));
}

export async function planGroupAction(task, group) {
  const observed = await observeGroupTargets(task, group);
  const available = observed
    .filter(({ target, teachingClass }) => target.status !== 'skipped' && isTeachingClassAvailable(teachingClass))
    .sort((a, b) => compareTargetsForGroup(group, a.target, b.target));

  if (!available.length) return { type: 'none' };

  const next = available[0];
  if (!group.currentPlacement) {
    return { type: 'choose', target: next.target, teachingClass: next.teachingClass };
  }
  if (group.strategy === 'equivalent') return { type: 'none' };
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

function compareTargetsForGroup(group, a, b) {
  if (group.strategy === 'equivalent') return a.createdOrder - b.createdOrder;
  return byPriorityDescThenCreatedOrder(a, b);
}

export async function observeGroupTargets(task, group) {
  const observed = [];
  for (const { courseId, courseType, targets } of targetRefreshBuckets(task, group.targets)) {
    await applyCourseTypeContext(task, courseType);
    const teachingClasses = await task.client.catalog.getTeachingClasses(courseId);
    for (const teachingClass of teachingClasses) {
      const target = targets.find((candidate) => matchTarget(candidate, teachingClass));
      if (!target) continue;
      syncObservedTarget(target, teachingClass, courseType);
      target.lastMessage = target.lastObservedRemaining === 0 ? 'capacity full' : '';
      observed.push({ target, teachingClass });
    }
  }
  return observed;
}

function syncObservedTarget(target, teachingClass, courseType) {
  target.courseId = teachingClass.courseId ?? target.courseId;
  target.classId = teachingClass.classId ?? target.classId;
  target.submitClassId = teachingClass.submitClassId ?? target.submitClassId;
  target.label = teachingClass.raw?.jxbmc || teachingClass.name || target.label || target.classId || target.submitClassId;
  target.lastObservedRemaining = classRemaining(teachingClass);
  target.selectedCount = teachingClass.selectedCount;
  target.capacity = teachingClass.capacity;
  if (teachingClass.scheduleText) target.scheduleText = teachingClass.scheduleText;
  if (teachingClass.locationText) target.locationText = teachingClass.locationText;
  if (teachingClass.raw?.kcmc || teachingClass.courseName) {
    target.courseName = teachingClass.raw?.kcmc || teachingClass.courseName;
  }
  if (Array.isArray(teachingClass.teachers)) {
    target.teachers = teachingClass.teachers.map((teacher) => teacher?.name).filter(Boolean).join('、');
  }
  if (!target.courseType && courseType) target.courseType = normalizeCourseTypeContext(courseType);
}

function targetRefreshBuckets(task, targets = []) {
  const buckets = new Map();
  for (const target of targets) {
    if (!target.courseId) continue;
    const courseTypes = target.courseType ? [target.courseType] : (task.courseTypes?.length ? task.courseTypes : [undefined]);
    for (const courseType of courseTypes) {
      const key = [target.courseId, courseTypeContextKey(courseType)].join('::');
      if (!buckets.has(key)) {
        buckets.set(key, {
          courseId: target.courseId,
          courseType,
          targets: []
        });
      }
      buckets.get(key).targets.push(target);
    }
  }
  return [...buckets.values()];
}

export async function applyTargetCourseTypeContext(task, target) {
  await applyCourseTypeContext(task, target?.courseType);
}

async function applyCourseTypeContext(task, courseType) {
  const raw = courseTypeContextToRaw(courseType);
  if (!raw) return;
  if (typeof task.client?.loadCourseTypeDisplayContext === 'function') {
    await task.client.loadCourseTypeDisplayContext({ raw, allowFallback: true });
    return;
  }
  if (typeof task.client?.refreshContext !== 'function') return;
  await task.client.refreshContext({ raw });
}

export async function chooseTarget(task, group, target, options = {}) {
  group.state = 'CHOOSE_TARGET';
  await applyTargetCourseTypeContext(task, target);
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
