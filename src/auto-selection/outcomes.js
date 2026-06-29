const GROUP_HUMAN_REASONS = new Set([
  'CHILD_CLASSES_REQUIRED',
  'LISTENER_APPLY_REQUIRED',
  'TEXTBOOK_REQUIRED',
  'USER_CANCELLED',
  'WEIGHT_REQUIRED'
]);

const TASK_HUMAN_REASONS = new Set([
  'IDENTITY_CONFIRMATION_REQUIRED',
  'LOGIN_LOCKED',
  'SMS_CODE_REQUIRED',
  'SMS_FAILED',
  'SMS_LOGIN_REQUIRED'
]);

export function matchTarget(target = {}, teachingClass = {}) {
  if (target.courseId && teachingClass.courseId && String(target.courseId) !== String(teachingClass.courseId)) {
    return false;
  }

  const targetIds = new Set(
    [target.classId, target.submitClassId]
      .filter(Boolean)
      .map(String)
  );
  const classIds = [teachingClass.classId, teachingClass.submitClassId, teachingClass.doJxbId]
    .filter(Boolean)
    .map(String);
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
  if (Number.isFinite(capacity) && capacity > 0 && Number.isFinite(selected)) {
    return Math.max(0, capacity - selected);
  }
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
  if (status === 'requires-listener-apply') {
    return { type: 'human-required', reason: 'LISTENER_APPLY_REQUIRED', pauseScope: 'group' };
  }
  if (status === 'sms-failed') return { type: 'human-required', reason: 'SMS_FAILED', pauseScope: 'task' };
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
  if (GROUP_HUMAN_REASONS.has(reason) || reason === 'NOT_DROPPABLE') {
    return { type: 'human-required', reason: reason || 'DROP_CONFIRM_REQUIRED', pauseScope: 'group' };
  }
  if (TASK_HUMAN_REASONS.has(reason)) return { type: 'human-required', reason, pauseScope: 'task' };
  if (status === 'rejected') return { type: 'business-failed', reason: reason || 'DROP_REJECTED' };
  if (resultOrError instanceof Error) return { type: 'transient-error', reason: resultOrError.message };
  return { type: 'transient-error', reason: reason || status || 'UNKNOWN_DROP_RESULT' };
}

export function isSessionError(error) {
  const code = String(error?.code || error?.reason || '');
  const message = String(error?.message || '');
  return code === 'SESSION_EXPIRED'
    || message.includes('SESSION_EXPIRED')
    || message.includes('CONTEXT_NOT_FOUND')
    || message.includes('Illegal access');
}
