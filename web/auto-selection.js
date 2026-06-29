import { createZfxkClient } from '../src/client.js';
import { parseCourseTypeOptions } from '../src/course-types.js';
import { downloadJson } from './export-data.js';

const DEFAULT_PAGE_PATH = '/xsxk/zzxkyzb_cxZzxkYzbIndex.html?gnmkdm=N253512';
const MAIN_SESSION_STORAGE_KEY = 'zfxk.web.session.v1';
const AUTO_SESSION_STORAGE_KEY = 'zfxk.autoSelection.session.v1';
const AUTO_SELECTION_DRAFT_STORAGE_KEY = 'zfxk.autoSelection.draft.v1';
const DEFAULT_GROUP_STRATEGY = 'priority';
const elements = {
  autoEnabledSwitch: document.querySelector('#autoEnabledSwitch'),
  autoHelpBtn: document.querySelector('#autoHelpBtn'),
  autoHelpDialog: document.querySelector('#autoHelpDialog'),
  autoCollapseBtn: document.querySelector('#autoCollapseBtn'),
  sessionForm: document.querySelector('#sessionForm'),
  baseUrlInput: document.querySelector('#baseUrlInput'),
  usernameInput: document.querySelector('#usernameInput'),
  passwordInput: document.querySelector('#passwordInput'),
  pagePathInput: document.querySelector('#pagePathInput'),
  cookieInput: document.querySelector('#cookieInput'),
  loginWithCaptchaBtn: document.querySelector('#loginWithCaptchaBtn'),
  solveCaptchaBtn: document.querySelector('#solveCaptchaBtn'),
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
  autoClearGroupBtn: document.querySelector('#autoClearGroupBtn'),
  autoTargetList: document.querySelector('#autoTargetList'),
  autoIdTargetForm: document.querySelector('#autoIdTargetForm'),
  autoCourseIdInput: document.querySelector('#autoCourseIdInput'),
  autoClassIdInput: document.querySelector('#autoClassIdInput'),
  autoRefreshTasksBtn: document.querySelector('#autoRefreshTasksBtn'),
  autoTaskSummary: document.querySelector('#autoTaskSummary'),
  autoAuthRefreshBtn: document.querySelector('#autoAuthRefreshBtn'),
  autoGroupStatusList: document.querySelector('#autoGroupStatusList'),
  autoEventLog: document.querySelector('#autoEventLog'),
  autoClearEventsBtn: document.querySelector('#autoClearEventsBtn'),
  autoExportConfigBtn: document.querySelector('#autoExportConfigBtn'),
  autoImportConfigInput: document.querySelector('#autoImportConfigInput')
};

const state = {
  client: null,
  transport: null,
  entryHtml: '',
  courseTypes: [],
  activeCourseTypeKey: '',
  draft: {
    groups: [defaultGroup('体育课')],
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

restoreSession();
restoreDraft();
bindEvents();
renderAutoSelectionDraft();
renderAutoTaskStatus();
pollAutoSelectionTasks();

function bindEvents() {
  elements.sessionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await initializeSession();
  });
  elements.loginWithCaptchaBtn.addEventListener('click', () => loginWithCaptchaCookie());
  elements.solveCaptchaBtn.addEventListener('click', () => solveCaptchaCookie());
  elements.autoIdTargetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await addIdTargetToAutoSelection();
  });
  elements.autoEnabledSwitch.addEventListener('change', () => renderAutoTaskStatus());
  elements.autoHelpBtn.addEventListener('click', () => showHelpDialog());
  elements.autoCollapseBtn.addEventListener('click', () => toggleChromeCompactMode());
  elements.autoAddGroupBtn.addEventListener('click', () => addAutoSelectionGroup());
  elements.autoGroupTabs.addEventListener('click', (event) => selectAutoGroup(event));
  elements.autoGroupNameInput.addEventListener('input', () => updateActiveGroupInfo());
  elements.autoGroupStrategyInput.addEventListener('change', () => updateActiveGroupInfo());
  elements.autoClearGroupBtn.addEventListener('click', () => clearActiveGroupTargets());
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
  elements.autoAuthRefreshBtn.addEventListener('click', () => refreshAuthFromStatusPanel());
  elements.autoClearEventsBtn.addEventListener('click', () => clearRenderedEvents());
  elements.autoExportConfigBtn.addEventListener('click', () => exportAutoSelectionDraft());
  elements.autoImportConfigInput.addEventListener('change', () => importAutoSelectionDraft());

  for (const input of [elements.baseUrlInput, elements.usernameInput, elements.pagePathInput, elements.cookieInput]) {
    input.addEventListener('input', persistSession);
    input.addEventListener('change', persistSession);
  }
}

async function initializeSession() {
  await runTask('初始化页面', async () => {
    const baseUrl = elements.baseUrlInput.value.trim();
    const pagePath = elements.pagePathInput.value.trim() || DEFAULT_PAGE_PATH;
    let cookie = elements.cookieInput.value.trim();
    if (!baseUrl) throw new Error('请填写 Base URL。');
    if (!cookie && elements.usernameInput.value.trim() && elements.passwordInput.value) {
      cookie = await loginWithCaptchaCookie({ silent: true });
    }
    if (!cookie) throw new Error('请填写 Cookie，或填写用户名密码后登录。');

    persistSession();
    const transport = new ProxyTransport({ baseUrl, cookie });
    state.client = createZfxkClient({ baseUrl, mode: 'commit', transport });
    state.transport = transport;
    state.entryHtml = String(await transport.get(pagePath) || '');
    state.courseTypes = parseCourseTypeOptions(state.entryHtml);
    const activeType = state.courseTypes.find((option) => option.active) ?? state.courseTypes[0];
    state.activeCourseTypeKey = activeType ? courseTypeKey(activeType) : '';
    await state.client.bootstrap({ html: state.entryHtml, raw: activeType ? courseTypeRaw(activeType) : undefined });
    log('会话已初始化，可按课程 ID 和班级 ID 获取详情并加入目标。');
  });
}

async function solveCaptchaCookie() {
  await runTask('获取验证码 Cookie', async () => {
    const baseUrl = elements.baseUrlInput.value.trim();
    if (!baseUrl) throw new Error('请填写 Base URL。');
    const response = await fetch('/api/captcha/solve', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ baseUrl })
    });
    const result = await readResponse(response, '/api/captcha/solve');
    if (!result.cookie) throw new Error('验证码接口未返回 Cookie。');
    elements.cookieInput.value = result.cookie;
    persistSession();
    log('验证码 Cookie 已填入。');
    return result.cookie;
  });
}

async function loginWithCaptchaCookie(options = {}) {
  const operation = async () => {
    const baseUrl = elements.baseUrlInput.value.trim();
    const username = elements.usernameInput.value.trim();
    const password = elements.passwordInput.value;
    if (!baseUrl) throw new Error('请填写 Base URL。');
    if (!username) throw new Error('请填写用户名。');
    if (!password) throw new Error('请填写密码。');
    const response = await fetch('/api/login/zfcaptcha', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ baseUrl, username, password, maxCaptchaAttempts: 3 })
    });
    const result = await readResponse(response, '/api/login/zfcaptcha');
    if (!result.cookie) throw new Error('登录接口未返回 Cookie。');
    elements.cookieInput.value = result.cookie;
    persistSession();
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
  group.name = elements.autoGroupNameInput.value.trim() || group.name;
  group.strategy = normalizeDraftGroupStrategy(elements.autoGroupStrategyInput.value);
  persistDraft();
  renderGroupTabs();
}

function clearActiveGroupTargets() {
  const group = activeGroup();
  if (!group.targets.length) return;
  if (!window.confirm(`清空 ${group.name} 的全部目标？`)) return;
  group.targets = [];
  persistDraft();
  renderAutoSelectionDraft();
  log(`${group.name} 已清空。`);
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
    allowAutoDrop: group.strategy !== 'equivalent' && group.targets.length > 0,
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

  const table = document.createElement('table');
  table.className = 'auto-target-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th></th>
        <th>优先级</th>
        <th>教学班</th>
        <th>上课时间/地点</th>
        <th>保底</th>
        <th>可退保升级</th>
        <th>状态</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  group.targets.forEach((target, index) => {
    const row = document.createElement('tr');
    row.draggable = true;
    row.dataset.autoTargetRow = String(index);
    row.innerHTML = `
      <td><button type="button" class="auto-drag-handle" aria-label="拖拽排序">☰</button></td>
      <td><input data-auto-target-index="${index}" data-auto-target-field="priority" type="number" value="${Number(target.priority) || 0}"></td>
      <td>
        <strong>${escapeHtml(target.label || target.classId)}</strong>
        <span>${escapeHtml(target.courseId)} · ${escapeHtml(target.submitClassId || target.classId)}</span>
      </td>
      <td>${renderTargetMeeting(target)}</td>
      <td><input data-auto-target-index="${index}" data-auto-target-field="isBackup" type="checkbox" ${target.isBackup ? 'checked' : ''}></td>
      <td><input data-auto-target-index="${index}" data-auto-target-field="allowAutoDrop" type="checkbox" ${target.allowAutoDrop ? 'checked' : ''}></td>
      <td><span class="tag ${target.status === 'selected' ? 'ok' : ''}">${escapeHtml(targetStatusText(target.status))}</span></td>
      <td>
        <div class="auto-row-actions">
          <button type="button" class="section-text-button" data-auto-move-target="${index}" data-direction="-1" title="上移">上</button>
          <button type="button" class="section-text-button" data-auto-move-target="${index}" data-direction="1" title="下移">下</button>
          <button type="button" class="section-text-button danger-text" data-auto-remove-target="${index}" title="移除">删</button>
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
  const moveButton = event.target.closest('[data-auto-move-target]');
  if (moveButton) {
    reorderTarget(Number(moveButton.dataset.autoMoveTarget), Number(moveButton.dataset.direction));
    return;
  }
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
    if (!elements.autoEnabledSwitch.checked) throw new Error('自动选课开关未启用。');
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

async function refreshAuthFromStatusPanel() {
  await loginWithCaptchaCookie();
  if (!state.client && elements.cookieInput.value.trim()) await initializeSession();
}

function buildAutoSelectionPayload(includeSecrets = false) {
  return {
    baseUrl: elements.baseUrlInput.value.trim(),
    username: elements.usernameInput.value.trim(),
    password: includeSecrets ? elements.passwordInput.value : undefined,
    cookie: includeSecrets ? elements.cookieInput.value.trim() : undefined,
    pagePath: elements.pagePathInput.value.trim() || DEFAULT_PAGE_PATH,
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
  elements.autoEnabledSwitch.nextElementSibling?.classList.toggle('off', !elements.autoEnabledSwitch.checked);
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
  downloadJson(`zfxk-auto-selection-${filenameTimestamp()}.json`, {
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
  elements.baseUrlInput.value = config.baseUrl || elements.baseUrlInput.value;
  elements.usernameInput.value = config.username || elements.usernameInput.value;
  elements.pagePathInput.value = config.pagePath || elements.pagePathInput.value || DEFAULT_PAGE_PATH;
  elements.autoIntervalInput.value = config.intervalMs || 1500;
  elements.autoMaxAttemptsInput.value = config.maxAttempts ?? '';
  elements.autoDeadlineInput.value = config.deadlineAt || '';
  state.draft = {
    groups: config.groups?.length ? config.groups.map((group) => ({
      name: group.name,
      strategy: normalizeDraftGroupStrategy(group.strategy),
      targets: group.targets ?? []
    })) : [defaultGroup('体育课')],
    activeGroupIndex: 0
  };
  persistSession();
  persistDraft();
  renderAutoSelectionDraft();
}

function activeGroup() {
  if (!state.draft.groups.length) {
    state.draft.groups.push(defaultGroup('体育课'));
    state.draft.activeGroupIndex = 0;
  }
  return state.draft.groups[state.draft.activeGroupIndex] ?? state.draft.groups[0];
}

function defaultGroup(name) {
  return { name, strategy: DEFAULT_GROUP_STRATEGY, targets: [] };
}

function normalizeDraftGroup(group) {
  return {
    name: group.name || '选课组',
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
      allowAutoDrop: Boolean(target.allowAutoDrop),
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
    if (button.id === 'autoHelpBtn' || button.id === 'autoCollapseBtn') return;
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

function toggleChromeCompactMode() {
  document.body.classList.toggle('auto-chrome-compact');
  elements.autoCollapseBtn.textContent = document.body.classList.contains('auto-chrome-compact') ? '⌄' : '⌃';
}

function restoreSession() {
  const saved = readStoredSession(AUTO_SESSION_STORAGE_KEY);
  const inherited = readStoredSession(MAIN_SESSION_STORAGE_KEY);
  elements.baseUrlInput.value = sessionValue(inherited.baseUrl, saved.baseUrl);
  elements.usernameInput.value = sessionValue(inherited.username, saved.username);
  elements.passwordInput.value = sessionValue(inherited.password);
  elements.pagePathInput.value = sessionValue(inherited.pagePath, saved.pagePath, DEFAULT_PAGE_PATH);
  elements.cookieInput.value = sessionValue(inherited.cookie, saved.cookie);
}

function persistSession() {
  try {
    localStorage.setItem(AUTO_SESSION_STORAGE_KEY, JSON.stringify({
      baseUrl: elements.baseUrlInput.value.trim(),
      username: elements.usernameInput.value.trim(),
      pagePath: elements.pagePathInput.value.trim() || DEFAULT_PAGE_PATH,
      cookie: elements.cookieInput.value.trim()
    }));
  } catch {
    // Storage can be unavailable in private contexts; inherited form values still work for the current page.
  }
}

function readStoredSession(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function sessionValue(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
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
