import { createZfxkClient } from '../src/client.js';
import { parseCourseTypeOptions } from '../src/course-types.js';
import { downloadJson } from './export-data.js';
import {
  DEFAULT_PAGE_PATH,
  normalizeSessionConfig,
  requireSessionConfig,
  sessionHost,
  setupUrl,
  writeSessionConfig
} from './session-config.js';

const AUTO_SELECTION_DRAFT_STORAGE_KEY = 'zfxk.autoSelection.draft.v1';
const DEFAULT_GROUP_STRATEGY = 'priority';
const DEFAULT_GROUP_NAME = '默认';
const elements = {
  autoHelpBtn: document.querySelector('#autoHelpBtn'),
  autoHelpDialog: document.querySelector('#autoHelpDialog'),
  autoSessionSummary: document.querySelector('#autoSessionSummary'),
  autoConfigLink: document.querySelector('#autoConfigLink'),
  autoInitBtn: document.querySelector('#autoInitBtn'),
  autoIntervalInput: document.querySelector('#autoIntervalInput'),
  autoMaxAttemptsInput: document.querySelector('#autoMaxAttemptsInput'),
  autoDeadlineInput: document.querySelector('#autoDeadlineInput'),
  autoFailureStrategySelect: document.querySelector('#autoFailureStrategySelect'),
  autoStartBtn: document.querySelector('#autoStartBtn'),
  autoPauseBtn: document.querySelector('#autoPauseBtn'),
  autoResumeBtn: document.querySelector('#autoResumeBtn'),
  autoCancelBtn: document.querySelector('#autoCancelBtn'),
  autoAddGroupBtn: document.querySelector('#autoAddGroupBtn'),
  autoGroupTabs: document.querySelector('#autoGroupTabs'),
  autoGroupNameInput: document.querySelector('#autoGroupNameInput'),
  autoGroupStrategyInput: document.querySelector('#autoGroupStrategyInput'),
  autoDeleteGroupBtn: document.querySelector('#autoDeleteGroupBtn'),
  autoTargetList: document.querySelector('#autoTargetList'),
  autoIdTargetForm: document.querySelector('#autoIdTargetForm'),
  autoCourseIdInput: document.querySelector('#autoCourseIdInput'),
  autoClassIdInput: document.querySelector('#autoClassIdInput'),
  autoRefreshTasksBtn: document.querySelector('#autoRefreshTasksBtn'),
  autoTaskSummary: document.querySelector('#autoTaskSummary'),
  autoGroupStatusList: document.querySelector('#autoGroupStatusList'),
  autoEventLog: document.querySelector('#autoEventLog'),
  autoClearEventsBtn: document.querySelector('#autoClearEventsBtn'),
  autoExportConfigBtn: document.querySelector('#autoExportConfigBtn'),
  autoImportConfigInput: document.querySelector('#autoImportConfigInput')
};

const state = {
  client: null,
  transport: null,
  sessionConfig: requireSessionConfig('/auto-selection'),
  entryHtml: '',
  courseTypes: [],
  activeCourseTypeKey: '',
  draft: {
    groups: [defaultGroup(DEFAULT_GROUP_NAME)],
    activeGroupIndex: 0
  },
  tasks: [],
  currentEvents: [],
  localEvents: [],
  eventClearAt: 0,
  pollTimer: null,
  draggedTargetIndex: null,
  busy: false
};

restoreDraft();
bindEvents();
renderSessionOverview();
renderAutoSelectionDraft();
renderAutoTaskStatus();
if (state.sessionConfig) initializeSession();
pollAutoSelectionTasks();

function bindEvents() {
  elements.autoInitBtn.addEventListener('click', () => initializeSession());
  elements.autoConfigLink.href = setupUrl('/auto-selection');
  elements.autoIdTargetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await addIdTargetToAutoSelection();
  });
  elements.autoHelpBtn.addEventListener('click', () => showHelpDialog());
  elements.autoAddGroupBtn.addEventListener('click', () => addAutoSelectionGroup());
  elements.autoGroupTabs.addEventListener('click', (event) => selectAutoGroup(event));
  elements.autoGroupNameInput.addEventListener('input', () => updateActiveGroupInfo());
  elements.autoGroupStrategyInput.addEventListener('change', () => updateActiveGroupInfo());
  elements.autoDeleteGroupBtn.addEventListener('click', () => deleteActiveGroup());
  elements.autoTargetList.addEventListener('click', (event) => handleAutoTargetAction(event));
  elements.autoTargetList.addEventListener('input', (event) => updateAutoTargetField(event));
  elements.autoTargetList.addEventListener('dragstart', (event) => handleTargetDragStart(event));
  elements.autoTargetList.addEventListener('dragover', (event) => handleTargetDragOver(event));
  elements.autoTargetList.addEventListener('drop', (event) => handleTargetDrop(event));
  elements.autoStartBtn.addEventListener('click', () => startAutoSelectionTask());
  elements.autoPauseBtn.addEventListener('click', () => pauseCurrentAutoTask());
  elements.autoResumeBtn.addEventListener('click', () => resumeCurrentAutoTask());
  elements.autoCancelBtn.addEventListener('click', () => cancelCurrentAutoTask());
  elements.autoRefreshTasksBtn.addEventListener('click', () => pollAutoSelectionTasks({ schedule: false, logErrors: true }));
  elements.autoClearEventsBtn.addEventListener('click', () => clearRenderedEvents());
  elements.autoExportConfigBtn.addEventListener('click', () => exportAutoSelectionDraft());
  elements.autoImportConfigInput.addEventListener('change', () => importAutoSelectionDraft());

}

async function initializeSession() {
  await runTask('初始化页面', async () => {
    const config = state.sessionConfig;
    if (!config?.baseUrl) throw new Error('保存配置缺少 Base URL。');
    const pagePath = config.pagePath || DEFAULT_PAGE_PATH;
    let cookie = config.cookie;
    if (!cookie && config.username && config.password) {
      cookie = await loginWithCaptchaCookie({ silent: true });
    }
    if (!cookie) throw new Error('保存配置缺少 Cookie，请先进入配置页面登录。');

    const transport = new ProxyTransport({ baseUrl: config.baseUrl, cookie });
    state.client = createZfxkClient({ baseUrl: config.baseUrl, mode: 'commit', transport });
    state.transport = transport;
    state.entryHtml = String(await transport.get(pagePath) || '');
    state.courseTypes = parseCourseTypeOptions(state.entryHtml);
    const activeType = state.courseTypes.find((option) => option.active) ?? state.courseTypes[0];
    state.activeCourseTypeKey = activeType ? courseTypeKey(activeType) : '';
    await state.client.bootstrap({ html: state.entryHtml, raw: activeType ? courseTypeRaw(activeType) : undefined });
    log('会话已初始化，可按课程 ID 和班级 ID 获取详情并加入目标。');
    renderSessionOverview();
  });
}

async function loginWithCaptchaCookie(options = {}) {
  const operation = async () => {
    const config = state.sessionConfig;
    if (!config?.baseUrl) throw new Error('保存配置缺少 Base URL。');
    if (!config.username) throw new Error('保存配置缺少用户名。');
    if (!config.password) throw new Error('保存配置缺少密码。');
    const response = await fetch('/api/login/zfcaptcha', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        baseUrl: config.baseUrl,
        username: config.username,
        password: config.password,
        maxCaptchaAttempts: 3
      })
    });
    const result = await readResponse(response, '/api/login/zfcaptcha');
    if (!result.cookie) throw new Error('登录接口未返回 Cookie。');
    state.sessionConfig = normalizeSessionConfig({ ...config, cookie: result.cookie });
    writeSessionConfig(state.sessionConfig);
    renderSessionOverview();
    if (!options.silent) log(`登录 Cookie 已填入，验证码尝试 ${result.attempts || 1} 次。`);
    return result.cookie;
  };
  return options.silent ? operation() : runTask('登录获取 Cookie', operation);
}

function addAutoSelectionGroup() {
  const next = state.draft.groups.length + 1;
  state.draft.groups.push(defaultGroup(`选课组 ${next}`));
  state.draft.activeGroupIndex = next - 1;
  persistDraft();
  renderAutoSelectionDraft();
}

function selectAutoGroup(event) {
  const button = event.target.closest('[data-auto-group-index]');
  if (!button) return;
  state.draft.activeGroupIndex = Number(button.dataset.autoGroupIndex);
  renderAutoSelectionDraft();
}

function updateActiveGroupInfo() {
  const group = activeGroup();
  const previousStrategy = normalizeDraftGroupStrategy(group.strategy);
  group.name = elements.autoGroupNameInput.value.trim() || group.name;
  group.strategy = normalizeDraftGroupStrategy(elements.autoGroupStrategyInput.value);
  if (previousStrategy !== group.strategy) sortTargets(group);
  persistDraft();
  if (previousStrategy !== group.strategy) {
    renderAutoSelectionDraft();
  } else {
    renderGroupTabs();
  }
}

function deleteActiveGroup() {
  const group = activeGroup();
  if (!window.confirm(`删除选课组「${group.name}」？组内目标也会一并删除。`)) return;
  if (state.draft.groups.length <= 1) {
    state.draft.groups = [defaultGroup(DEFAULT_GROUP_NAME)];
    state.draft.activeGroupIndex = 0;
  } else {
    const deletedIndex = state.draft.activeGroupIndex;
    state.draft.groups.splice(deletedIndex, 1);
    state.draft.activeGroupIndex = Math.max(0, Math.min(deletedIndex, state.draft.groups.length - 1));
  }
  persistDraft();
  renderAutoSelectionDraft();
  log(`已删除选课组：${group.name}`);
}

async function addIdTargetToAutoSelection() {
  if (!state.client) {
    log('请先初始化页面，以便读取教学班详情。');
    return;
  }
  const courseId = elements.autoCourseIdInput.value.trim();
  const classId = elements.autoClassIdInput.value.trim();
  if (!courseId || !classId) {
    log('请填写课程 ID 和班级 ID。');
    return;
  }
  await runTask('按 ID 获取教学班', async () => {
    const teachingClass = await resolveIdTeachingClass(courseId, classId);
    if (!teachingClass) throw new Error(`课程 ${courseId} 下未找到班级 ${classId}`);
    addResolvedClassToAutoSelection(teachingClass);
    elements.autoClassIdInput.value = '';
  });
}

async function resolveIdTeachingClass(courseId, classId) {
  const classes = await state.client.catalog.getTeachingClasses(courseId);
  return classes.find((item) => matchIdTeachingClass(item, courseId, classId));
}

function matchIdTeachingClass(item, courseId, classId) {
  if (String(item.courseId) !== String(courseId)) return false;
  return [item.classId, item.submitClassId]
    .filter(Boolean)
    .some((id) => String(id) === String(classId));
}

function addResolvedClassToAutoSelection(teachingClass) {
  const group = activeGroup();
  const target = {
    courseId: teachingClass.courseId,
    classId: teachingClass.classId,
    submitClassId: teachingClass.submitClassId,
    label: resolvedClassLabel(teachingClass),
    courseName: resolvedCourseName(teachingClass),
    teachers: resolvedTeacherNames(teachingClass),
    scheduleText: teachingClass.scheduleText,
    locationText: teachingClass.locationText,
    selectedCount: teachingClass.selectedCount,
    capacity: teachingClass.capacity,
    priority: nextPriority(group),
    isBackup: group.strategy !== 'equivalent' && group.targets.length > 0,
    allowAutoDrop: true,
    recoverOnUpgradeFailure: true,
    skipAfterNonCapacityFailure: true,
    status: 'watching'
  };
  const exists = group.targets.some((item) => sameTargetDraft(item, target));
  if (!exists) {
    group.targets.push(target);
    log(`已加入目标：${target.label}`);
  } else {
    log(`目标已在当前组：${target.label}`);
  }
  sortTargets(group);
  persistDraft();
  renderAutoSelectionDraft();
}

function resolvedClassLabel(item) {
  return String(item.raw?.jxbmc || item.name || item.classId || item.submitClassId || '未命名教学班');
}

function resolvedCourseName(item) {
  return String(item.raw?.kcmc || item.courseName || item.courseId || '');
}

function resolvedTeacherNames(item) {
  return item.teachers?.map((teacher) => teacher.name).filter(Boolean).join('、') || '';
}

function renderAutoSelectionDraft() {
  renderGroupTabs();
  const group = activeGroup();
  elements.autoGroupNameInput.value = group.name;
  elements.autoGroupStrategyInput.value = normalizeDraftGroupStrategy(group.strategy);

  if (!group.targets.length) {
    elements.autoTargetList.replaceChildren(empty('按课程 ID 和班级 ID 添加目标'));
    return;
  }

  const showPriorityColumn = normalizeDraftGroupStrategy(group.strategy) !== 'equivalent';
  const table = document.createElement('table');
  table.className = 'auto-target-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th></th>
        ${showPriorityColumn ? '<th>优先级</th>' : ''}
        <th>教学班</th>
        <th>上课时间/地点</th>
        <th>可退课后升级</th>
        <th>状态</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  group.targets.forEach((target, index) => {
    const targetIds = [target.courseId, target.submitClassId || target.classId].filter(Boolean).join(' · ');
    const row = document.createElement('tr');
    row.draggable = true;
    row.dataset.autoTargetRow = String(index);
    row.innerHTML = `
      <td><button type="button" class="auto-drag-handle" aria-label="拖拽排序">☰</button></td>
      ${showPriorityColumn ? `
      <td><input data-auto-target-index="${index}" data-auto-target-field="priority" type="number" value="${Number(target.priority) || 0}"></td>` : ''}
      <td>
        <strong>${escapeHtml(target.label || target.classId)}</strong>
        <span class="auto-target-id-line" title="${escapeHtml(targetIds)}">${escapeHtml(targetIds)}</span>
      </td>
      <td>${renderTargetMeeting(target)}</td>
      <td><input data-auto-target-index="${index}" data-auto-target-field="allowAutoDrop" type="checkbox" ${target.allowAutoDrop !== false ? 'checked' : ''}></td>
      <td><span class="tag ${target.status === 'selected' ? 'ok' : ''}">${escapeHtml(targetStatusText(target.status))}</span></td>
      <td>
        <div class="auto-row-actions">
          <button type="button" class="section-text-button danger-text" data-auto-remove-target="${index}" title="删除">删除</button>
        </div>
      </td>
    `;
    tbody.append(row);
  });
  elements.autoTargetList.replaceChildren(table);
}

function renderGroupTabs() {
  elements.autoGroupTabs.replaceChildren();
  state.draft.groups.forEach((group, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `auto-group-tab ${index === state.draft.activeGroupIndex ? 'active' : ''}`;
    button.dataset.autoGroupIndex = String(index);
    button.innerHTML = `${escapeHtml(group.name)} <span>${group.targets.length}</span>`;
    elements.autoGroupTabs.append(button);
  });
}

function handleAutoTargetAction(event) {
  const removeButton = event.target.closest('[data-auto-remove-target]');
  if (!removeButton) return;
  activeGroup().targets.splice(Number(removeButton.dataset.autoRemoveTarget), 1);
  persistDraft();
  renderAutoSelectionDraft();
}

function updateAutoTargetField(event) {
  const input = event.target.closest('[data-auto-target-field]');
  if (!input) return;
  const group = activeGroup();
  const target = group.targets[Number(input.dataset.autoTargetIndex)];
  if (!target) return;
  const field = input.dataset.autoTargetField;
  target[field] = input.type === 'checkbox' ? input.checked : Number(input.value);
  sortTargets(group);
  persistDraft();
  renderAutoSelectionDraft();
}

function handleTargetDragStart(event) {
  const row = event.target.closest('[data-auto-target-row]');
  if (!row) return;
  state.draggedTargetIndex = Number(row.dataset.autoTargetRow);
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', row.dataset.autoTargetRow);
}

function handleTargetDragOver(event) {
  if (state.draggedTargetIndex === null) return;
  const row = event.target.closest('[data-auto-target-row]');
  if (!row) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function handleTargetDrop(event) {
  const row = event.target.closest('[data-auto-target-row]');
  if (!row || state.draggedTargetIndex === null) return;
  event.preventDefault();
  const targetIndex = Number(row.dataset.autoTargetRow);
  const direction = targetIndex - state.draggedTargetIndex;
  reorderTarget(state.draggedTargetIndex, direction, { absolute: true, targetIndex });
  state.draggedTargetIndex = null;
}

function reorderTarget(index, direction, options = {}) {
  const group = activeGroup();
  const targetIndex = options.absolute ? options.targetIndex : index + direction;
  if (index < 0 || targetIndex < 0 || index >= group.targets.length || targetIndex >= group.targets.length || index === targetIndex) return;
  const [target] = group.targets.splice(index, 1);
  group.targets.splice(targetIndex, 0, target);
  group.targets.forEach((item, itemIndex) => {
    item.priority = group.targets.length - itemIndex;
  });
  persistDraft();
  renderAutoSelectionDraft();
}

async function startAutoSelectionTask() {
  await runTask('启动自动选课', async () => {
    const payload = buildAutoSelectionPayload(true);
    const response = await fetch('/api/auto-selection/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload)
    });
    const task = await readResponse(response, '/api/auto-selection/tasks');
    state.tasks = [task];
    await refreshTaskEvents(task.id);
    renderAutoTaskStatus();
    pollAutoSelectionTasks();
    log(`任务已启动：${task.id}`);
  });
}

async function pauseCurrentAutoTask() {
  const task = currentTask();
  if (!task) return log('暂无可暂停的任务。');
  await runTask('暂停任务', async () => {
    const response = await fetch(`/api/auto-selection/tasks/${encodeURIComponent(task.id)}/pause`, { method: 'POST' });
    const result = await readResponse(response, `/api/auto-selection/tasks/${task.id}/pause`);
    state.tasks = [result];
    await refreshTaskEvents(task.id);
    renderAutoTaskStatus();
  });
}

async function resumeCurrentAutoTask() {
  const task = currentTask();
  if (!task) return log('暂无可恢复的任务。');
  await runTask('恢复任务', async () => {
    const response = await fetch(`/api/auto-selection/tasks/${encodeURIComponent(task.id)}/resume`, { method: 'POST' });
    const result = await readResponse(response, `/api/auto-selection/tasks/${task.id}/resume`);
    state.tasks = [result];
    await refreshTaskEvents(task.id);
    renderAutoTaskStatus();
  });
}

async function cancelCurrentAutoTask() {
  const task = currentTask();
  if (!task) return log('暂无可取消的任务。');
  if (!window.confirm(`确认取消任务 ${task.id}？`)) return;
  await runTask('取消任务', async () => {
    const response = await fetch(`/api/auto-selection/tasks/${encodeURIComponent(task.id)}/cancel`, { method: 'POST' });
    const result = await readResponse(response, `/api/auto-selection/tasks/${task.id}/cancel`);
    state.tasks = [result];
    await refreshTaskEvents(task.id);
    renderAutoTaskStatus();
  });
}

function buildAutoSelectionPayload(includeSecrets = false) {
  const config = state.sessionConfig ?? {};
  return {
    baseUrl: config.baseUrl,
    username: config.username,
    password: includeSecrets ? config.password : undefined,
    cookie: includeSecrets ? config.cookie : undefined,
    pagePath: config.pagePath || DEFAULT_PAGE_PATH,
    intervalMs: Number(elements.autoIntervalInput.value) || 1500,
    maxAttempts: elements.autoMaxAttemptsInput.value ? Number(elements.autoMaxAttemptsInput.value) : null,
    deadlineAt: elements.autoDeadlineInput.value || null,
    groups: sanitizeGroups(state.draft.groups)
  };
}

async function pollAutoSelectionTasks(options = {}) {
  clearTimeout(state.pollTimer);
  try {
    const response = await fetch('/api/auto-selection/tasks');
    const result = await readResponse(response, '/api/auto-selection/tasks');
    state.tasks = result.tasks ?? [];
    const task = currentTask();
    if (task) await refreshTaskEvents(task.id);
    renderAutoTaskStatus();
  } catch (error) {
    if (options.logErrors) log(`任务状态刷新失败：${error.message}`);
  } finally {
    if (options.schedule !== false) {
      state.pollTimer = setTimeout(() => pollAutoSelectionTasks(), 1500);
    }
  }
}

async function refreshTaskEvents(taskId) {
  const response = await fetch(`/api/auto-selection/tasks/${encodeURIComponent(taskId)}/events`);
  const result = await readResponse(response, `/api/auto-selection/tasks/${taskId}/events`);
  state.currentEvents = result.events ?? [];
}

function renderAutoTaskStatus() {
  const task = currentTask();
  if (!task) {
    elements.autoTaskSummary.innerHTML = `
      <div><strong>WAITING</strong><span class="tag">未启动</span></div>
      <div class="auto-state-grid">
        <span>认证状态</span><b>未登录</b>
        <span>下一次刷新</span><b>未排程</b>
        <span>已尝试次数</span><b>0 次</b>
        <span>失败策略</span><b>${escapeHtml(selectedFailureStrategyLabel())}</b>
      </div>
    `;
    elements.autoGroupStatusList.replaceChildren(empty('启动任务后显示组选课状态'));
    renderEvents();
    return;
  }

  elements.autoTaskSummary.innerHTML = `
    <div><strong>${escapeHtml(task.status)}</strong><span class="tag ${autoStateTagClass(task.status)}">${escapeHtml(task.authStatus || 'unknown')}</span></div>
    <div>任务 ID：${escapeHtml(task.id)}</div>
    <div class="auto-state-grid">
      <span>认证状态</span><b>${escapeHtml(task.authStatus || 'unknown')}</b>
      <span>下一次刷新</span><b>${escapeHtml(formatDate(task.nextRunAt))}</b>
      <span>已尝试次数</span><b>${Number(task.attempts) || 0} 次</b>
      <span>启动时间</span><b>${escapeHtml(formatDate(task.startedAt))}</b>
      <span>截止时间</span><b>${escapeHtml(elements.autoDeadlineInput.value || '不限制')}</b>
      <span>刷新间隔</span><b>${Number(task.intervalMs) || Number(elements.autoIntervalInput.value) || 1500} ms</b>
      <span>失败策略</span><b>${escapeHtml(selectedFailureStrategyLabel())}</b>
    </div>
  `;

  elements.autoGroupStatusList.replaceChildren(...(task.groups || []).map((group) => {
    const card = document.createElement('article');
    card.className = 'auto-group-status-card';
    const current = group.targets?.find((target) => target.targetId === group.currentTargetId);
    card.innerHTML = `
      <div class="card-title">
        <strong>${escapeHtml(group.name)}</strong>
        <span class="tag ${autoStateTagClass(group.state)}">${escapeHtml(group.state)}</span>
      </div>
      <div class="meta">当前占位：${escapeHtml(current?.label || group.currentTargetId || '无')}</div>
      <div class="meta">${group.isTopTargetSelected ? '已达到最高优先级' : '继续观察升级机会'}</div>
    `;
    return card;
  }));
  renderEvents();
}

function renderEvents() {
  const events = [
    ...state.localEvents,
    ...state.currentEvents.filter((event) => !state.eventClearAt || Date.parse(event.at) > state.eventClearAt)
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!events.length) {
    elements.autoEventLog.replaceChildren(empty('暂无事件'));
    return;
  }
  elements.autoEventLog.replaceChildren(...events.slice(0, 80).map((event) => {
    const item = document.createElement('li');
    item.innerHTML = `<time>${escapeHtml(formatDate(event.at))}</time><span>${escapeHtml(event.message || event.type)}</span>`;
    return item;
  }));
}

function clearRenderedEvents() {
  state.eventClearAt = Date.now();
  state.localEvents = [];
  renderEvents();
}

function exportAutoSelectionDraft() {
  downloadJson(`zhengfang-selection-assistant-auto-selection-${filenameTimestamp()}.json`, {
    version: 1,
    kind: 'zfxk.autoSelectionTask',
    ...buildAutoSelectionPayload(false)
  });
  log('已导出自动选课配置。');
}

async function importAutoSelectionDraft() {
  const file = elements.autoImportConfigInput.files?.[0];
  if (!file) return;
  await runTask('加载配置', async () => {
    const parsed = JSON.parse(await file.text());
    const response = await fetch('/api/auto-selection/config/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(parsed)
    });
    const result = await readResponse(response, '/api/auto-selection/config/import');
    if (!result.valid) throw new Error(result.errors?.join('；') || '配置无效');
    applyImportedConfig(result.config);
    log('配置已加载为草稿。');
  });
  elements.autoImportConfigInput.value = '';
}

function applyImportedConfig(config) {
  state.sessionConfig = normalizeSessionConfig({
    ...state.sessionConfig,
    baseUrl: config.baseUrl || state.sessionConfig?.baseUrl,
    username: config.username || state.sessionConfig?.username,
    pagePath: config.pagePath || state.sessionConfig?.pagePath || DEFAULT_PAGE_PATH
  });
  writeSessionConfig(state.sessionConfig);
  renderSessionOverview();
  elements.autoIntervalInput.value = config.intervalMs || 1500;
  elements.autoMaxAttemptsInput.value = config.maxAttempts ?? '';
  elements.autoDeadlineInput.value = config.deadlineAt || '';
  state.draft = {
    groups: config.groups?.length ? config.groups.map((group) => ({
      name: group.name,
      strategy: normalizeDraftGroupStrategy(group.strategy),
      targets: group.targets ?? []
    })) : [defaultGroup(DEFAULT_GROUP_NAME)],
    activeGroupIndex: 0
  };
  persistDraft();
  renderAutoSelectionDraft();
}

function activeGroup() {
  if (!state.draft.groups.length) {
    state.draft.groups.push(defaultGroup(DEFAULT_GROUP_NAME));
    state.draft.activeGroupIndex = 0;
  }
  return state.draft.groups[state.draft.activeGroupIndex] ?? state.draft.groups[0];
}

function defaultGroup(name) {
  return { name, strategy: DEFAULT_GROUP_STRATEGY, targets: [] };
}

function normalizeDraftGroup(group) {
  return {
    name: group.name || DEFAULT_GROUP_NAME,
    strategy: normalizeDraftGroupStrategy(group.strategy),
    targets: Array.isArray(group.targets) ? group.targets : []
  };
}

function normalizeDraftGroupStrategy(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'equivalent' || text === 'equal' || text.includes('等价')) return 'equivalent';
  return DEFAULT_GROUP_STRATEGY;
}

function sanitizeGroups(groups) {
  return groups.map((group) => ({
    name: group.name,
    strategy: normalizeDraftGroupStrategy(group.strategy),
    targets: group.targets.map((target) => ({
      courseId: target.courseId,
      classId: target.classId,
      submitClassId: target.submitClassId,
      label: target.label,
      priority: Number(target.priority),
      isBackup: Boolean(target.isBackup),
      allowAutoDrop: target.allowAutoDrop !== false,
      recoverOnUpgradeFailure: target.recoverOnUpgradeFailure !== false,
      skipAfterNonCapacityFailure: target.skipAfterNonCapacityFailure !== false
    }))
  }));
}

function nextPriority(group) {
  const priorities = group.targets.map((target) => Number(target.priority)).filter(Number.isFinite);
  return priorities.length ? Math.max(1, Math.min(...priorities) - 10) : 100;
}

function sortTargets(group) {
  if (normalizeDraftGroupStrategy(group.strategy) === 'equivalent') return;
  group.targets.sort((a, b) => Number(b.priority) - Number(a.priority));
}

function sameTargetDraft(left, right) {
  return String(left.courseId) === String(right.courseId)
    && [left.classId, left.submitClassId].filter(Boolean).some((id) => [right.classId, right.submitClassId].filter(Boolean).includes(id));
}

async function runTask(label, operation) {
  if (state.busy) return undefined;
  state.busy = true;
  setButtonsDisabled(true);
  try {
    const result = await operation();
    return result;
  } catch (error) {
    log(`${label}失败：${error.message}`);
    return undefined;
  } finally {
    state.busy = false;
    setButtonsDisabled(false);
  }
}

function setButtonsDisabled(disabled) {
  document.querySelectorAll('button').forEach((button) => {
    if (button.id === 'autoHelpBtn') return;
    button.disabled = disabled;
  });
}

function log(message) {
  state.localEvents.unshift({
    id: `local_${Date.now()}_${state.localEvents.length}`,
    at: new Date().toISOString(),
    type: 'local',
    message
  });
  renderEvents();
}

function currentTask() {
  return state.tasks.find((task) => !['cancelled', 'failed', 'succeeded'].includes(task.status)) ?? state.tasks[0] ?? null;
}

function showHelpDialog() {
  if (typeof elements.autoHelpDialog.showModal === 'function') elements.autoHelpDialog.showModal();
  else elements.autoHelpDialog.setAttribute('open', '');
}

function renderSessionOverview() {
  if (!state.sessionConfig) {
    elements.autoSessionSummary.textContent = '未保存配置';
    return;
  }
  elements.autoSessionSummary.textContent = `${sessionHost(state.sessionConfig)} · ${state.sessionConfig.username || '未保存用户名'}`;
}

function restoreDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTO_SELECTION_DRAFT_STORAGE_KEY) || '{}');
    if (Array.isArray(saved.groups) && saved.groups.length) {
      state.draft = {
        groups: saved.groups.map(normalizeDraftGroup),
        activeGroupIndex: Math.max(0, Math.min(Number(saved.activeGroupIndex) || 0, saved.groups.length - 1))
      };
    }
  } catch {
    persistDraft();
  }
}

function persistDraft() {
  localStorage.setItem(AUTO_SELECTION_DRAFT_STORAGE_KEY, JSON.stringify(state.draft));
}

function renderTargetMeeting(target) {
  return `
    <div class="auto-meeting-cell">
      <strong>${escapeHtml(stripHtml(target.scheduleText) || target.teachers || '时间待定')}</strong>
      <span>${escapeHtml(stripHtml(target.locationText) || capacityTargetText(target))}</span>
    </div>
  `;
}

function capacityTargetText(target) {
  if (target.selectedCount === undefined || target.capacity === undefined) return '容量待刷新';
  return `${target.selectedCount}/${target.capacity}`;
}

function selectedFailureStrategyLabel() {
  return elements.autoFailureStrategySelect.selectedOptions[0]?.textContent || '非容量失败跳过，容量满继续续刷';
}

function targetStatusText(value = 'watching') {
  const labels = {
    selected: '已占位',
    watching: '观察中',
    skipped: '已跳过',
    failed: '失败'
  };
  return labels[value] || value;
}

function autoStateTagClass(value = '') {
  if (['running', 'SUCCEEDED', 'succeeded', 'selected'].includes(value)) return 'ok';
  if (['paused', 'PAUSED', 'HOLDING', 'WATCHING', 'auth-refreshing'].includes(value)) return 'warn';
  if (['failed', 'FAILED', 'cancelled'].includes(value)) return 'danger';
  return '';
}

function courseTypeKey(option) {
  return [option.kklxdm, option.xkkzId, option.xkkzXh].filter(Boolean).join(':');
}

function courseTypeRaw(option) {
  return {
    kklxdm: option.kklxdm,
    xkkz_id: option.xkkzId,
    njdm_id: option.njdmId,
    zyh_id: option.zyhId,
    xkkz_xh: option.xkkzXh,
    kklxmc: option.label
  };
}

function option(value, label) {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  return item;
}

function empty(text) {
  const item = document.createElement('div');
  item.className = 'empty';
  item.textContent = text;
  return item;
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function stripHtml(value) {
  const template = document.createElement('template');
  template.innerHTML = String(value || '').replace(/<br\s*\/?>/gi, ' / ');
  return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function formatDate(value) {
  if (!value) return '未排程';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function filenameTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function readResponse(response, label) {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === 'string' ? body : body.error || JSON.stringify(body);
    throw new Error(`${label} ${response.status}: ${message}`);
  }
  return body;
}

class ProxyTransport {
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.cookie = options.cookie;
  }

  async get(path) {
    const response = await fetch('/api/proxy/get', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ baseUrl: this.baseUrl, cookie: this.cookie, path })
    });
    return readResponse(response, path);
  }

  async post(path, data = {}) {
    const response = await fetch('/api/proxy/post', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ baseUrl: this.baseUrl, cookie: this.cookie, path, data })
    });
    return readResponse(response, path);
  }
}
