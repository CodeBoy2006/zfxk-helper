export const AUTO_SELECTION_CONFIG_KIND = 'zfxk.autoSelectionTask';
export const AUTO_SELECTION_CONFIG_VERSION = 1;
export const DEFAULT_INTERVAL_MS = 1500;
export const DEFAULT_GROUP_STRATEGY = 'priority';

export function normalizeAutoSelectionConfig(input = {}, options = {}) {
  const errors = [];
  const config = {
    baseUrl: trimTrailingSlash(input.baseUrl),
    username: stringOrUndefined(input.username),
    password: stringOrUndefined(input.password),
    cookie: stringOrUndefined(input.cookie),
    pagePath: String(input.pagePath || ''),
    intervalMs: normalizePositiveInteger(input.intervalMs, DEFAULT_INTERVAL_MS),
    maxAttempts: normalizeNullablePositiveInteger(input.maxAttempts),
    deadlineAt: input.deadlineAt || null,
    groups: asArray(input.groups).map((group, groupIndex) => normalizeGroup(group, groupIndex))
  };

  if (options.requireCredentials && !config.password && !config.cookie) {
    errors.push('password or cookie is required');
  }

  return { ...config, errors };
}

export function validateAutoSelectionConfig(input = {}, options = {}) {
  const config = normalizeAutoSelectionConfig(input, options);
  const errors = [...config.errors];
  if (!config.baseUrl) errors.push('baseUrl is required');
  else if (!/^https?:\/\//i.test(config.baseUrl)) errors.push('baseUrl must start with http:// or https://');
  if (!config.pagePath) errors.push('pagePath is required');
  if (!config.groups.length) errors.push('at least one group is required');

  config.groups.forEach((group, groupIndex) => {
    if (!group.name) errors.push(`groups[${groupIndex}].name is required`);
    if (!group.targets.length) errors.push(`groups[${groupIndex}].targets must contain at least one target`);
    group.targets.forEach((target, targetIndex) => {
      if (!target.courseId) errors.push(`groups[${groupIndex}].targets[${targetIndex}].courseId is required`);
      if (!target.classId && !target.submitClassId && !target.teacherName) {
        errors.push(`groups[${groupIndex}].targets[${targetIndex}].classId, submitClassId, or teacherName is required`);
      }
      if (!Number.isFinite(target.priority)) {
        errors.push(`groups[${groupIndex}].targets[${targetIndex}].priority must be a finite number`);
      }
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
      groupId: group.groupId,
      name: group.name,
      strategy: group.strategy,
      targets: group.targets.map((target) => {
        const {
          status,
          lastObservedRemaining,
          lastMessage,
          createdOrder,
          ...exportedTarget
        } = target;
        return exportedTarget;
      })
    }))
  };
}

export function importAutoSelectionConfig(input = {}) {
  const errors = [];
  if (input.kind !== AUTO_SELECTION_CONFIG_KIND) errors.push('kind must be zfxk.autoSelectionTask');
  if (input.version !== AUTO_SELECTION_CONFIG_VERSION) errors.push('version must be 1');

  const config = normalizeAutoSelectionConfig({
    ...input,
    password: undefined,
    cookie: undefined
  });
  const validation = validateAutoSelectionConfig(config);
  return {
    valid: errors.length === 0 && validation.valid,
    errors: [...errors, ...validation.errors],
    config
  };
}

export function maskUsername(username = '') {
  const text = String(username || '');
  if (!text) return '';
  return `${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`;
}

export function byPriorityDescThenCreatedOrder(a, b) {
  return b.priority - a.priority || a.createdOrder - b.createdOrder;
}

function normalizeGroup(group = {}, groupIndex = 0) {
  const strategy = normalizeGroupStrategy(group.strategy);
  const targets = asArray(group.targets)
    .map((target, targetIndex) => normalizeTarget(target, targetIndex))
    .sort((a, b) => strategy === 'equivalent'
      ? a.createdOrder - b.createdOrder
      : byPriorityDescThenCreatedOrder(a, b));

  return {
    groupId: group.groupId || `group_${groupIndex + 1}`,
    name: String(group.name || ''),
    strategy,
    state: group.state || 'WATCHING',
    currentPlacement: null,
    isTopTargetSelected: false,
    pauseScope: undefined,
    lastMessage: '',
    targets
  };
}

function normalizeGroupStrategy(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'equivalent' || text === 'equal' || text.includes('等价')) return 'equivalent';
  return DEFAULT_GROUP_STRATEGY;
}

function normalizeTarget(target = {}, createdOrder = 0) {
  const courseId = String(target.courseId || '');
  const submitClassId = target.submitClassId ? String(target.submitClassId) : undefined;
  const classId = String(target.classId || submitClassId || '');
  const teacherName = stringOrUndefined(target.teacherName);
  return {
    targetId: target.targetId || `${courseId}:${classId || submitClassId || teacherName || 'target'}:${createdOrder}`,
    courseId,
    classId,
    submitClassId,
    teacherName,
    label: stringOrUndefined(target.label),
    courseType: normalizeCourseTypeContext(target.courseType),
    priority: Number(target.priority),
    isBackup: Boolean(target.isBackup),
    allowAutoDrop: target.allowAutoDrop === undefined ? true : Boolean(target.allowAutoDrop),
    recoverOnUpgradeFailure: target.recoverOnUpgradeFailure === undefined ? true : Boolean(target.recoverOnUpgradeFailure),
    skipAfterNonCapacityFailure: target.skipAfterNonCapacityFailure === undefined ? true : Boolean(target.skipAfterNonCapacityFailure),
    status: target.status || 'watching',
    lastObservedRemaining: target.lastObservedRemaining,
    lastMessage: target.lastMessage || '',
    createdOrder
  };
}

export function normalizeCourseTypeContext(value = {}) {
  const source = value ?? {};
  const context = {
    label: stringOrUndefined(source.label ?? source.kklxmc),
    kklxdm: stringOrUndefined(source.kklxdm),
    xkkzId: stringOrUndefined(source.xkkzId ?? source.xkkz_id),
    njdmId: stringOrUndefined(source.njdmId ?? source.njdm_id),
    zyhId: stringOrUndefined(source.zyhId ?? source.zyh_id),
    xkkzXh: stringOrUndefined(source.xkkzXh ?? source.xkkz_xh)
  };
  return Object.values(context).some(Boolean) ? context : undefined;
}

export function courseTypeContextToRaw(value) {
  const context = normalizeCourseTypeContext(value);
  if (!context) return undefined;
  return omitEmpty({
    kklxdm: context.kklxdm,
    kklxmc: context.label,
    xkkz_id: context.xkkzId,
    njdm_id: context.njdmId,
    zyh_id: context.zyhId,
    xkkz_xh: context.xkkzXh
  });
}

export function courseTypeContextKey(value) {
  const context = normalizeCourseTypeContext(value);
  return context
    ? [context.kklxdm, context.xkkzId, context.njdmId, context.zyhId, context.xkkzXh].map((item) => item || '').join('::')
    : '';
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : fallback;
}

function normalizeNullablePositiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  return normalizePositiveInteger(value, null);
}

function stringOrUndefined(value) {
  const text = String(value ?? '').trim();
  return text ? text : undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function omitEmpty(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== ''));
}
