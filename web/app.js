import { createZfxkClient } from '../src/index.js';

const elements = {
  sessionForm: document.querySelector('#sessionForm'),
  searchForm: document.querySelector('#searchForm'),
  baseUrlInput: document.querySelector('#baseUrlInput'),
  cookieInput: document.querySelector('#cookieInput'),
  pagePathInput: document.querySelector('#pagePathInput'),
  keywordInput: document.querySelector('#keywordInput'),
  hasCapacityInput: document.querySelector('#hasCapacityInput'),
  sessionSummary: document.querySelector('#sessionSummary'),
  courseList: document.querySelector('#courseList'),
  classList: document.querySelector('#classList'),
  classCountBadge: document.querySelector('#classCountBadge'),
  chosenList: document.querySelector('#chosenList'),
  chosenTotals: document.querySelector('#chosenTotals'),
  saveOrderBtn: document.querySelector('#saveOrderBtn'),
  refreshSnapshotBtn: document.querySelector('#refreshSnapshotBtn'),
  clearLogBtn: document.querySelector('#clearLogBtn'),
  activityLog: document.querySelector('#activityLog'),
  statusBadge: document.querySelector('#statusBadge')
};

const state = {
  client: null,
  courses: [],
  classes: [],
  selectedCourseId: null,
  snapshot: null,
  busy: false
};

elements.sessionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await initialize();
});

elements.searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await searchCourses();
});

elements.refreshSnapshotBtn.addEventListener('click', () => refreshSnapshot());
elements.saveOrderBtn.addEventListener('click', () => saveOrder());
elements.clearLogBtn.addEventListener('click', () => {
  elements.activityLog.replaceChildren();
  setStatus('idle');
});

renderCourses();
renderClasses();
renderChosen();

async function initialize() {
  await runTask('初始化会话', async () => {
    const baseUrl = elements.baseUrlInput.value.trim();
    const cookie = elements.cookieInput.value.trim();
    const path = elements.pagePathInput.value.trim();
    if (!baseUrl) throw new Error('请填写教务系统 Base URL。');
    if (!cookie) throw new Error('请填写 Cookie。');
    if (!path) throw new Error('请填写选课入口 Path。');

    state.client = createZfxkClient({
      baseUrl,
      mode: 'commit',
      transport: new ProxyTransport({ baseUrl, cookie })
    });
    await state.client.bootstrapFromPage({ path });
    log('会话已通过本地代理解析。');
    updateSessionSummary();
    await searchCoursesCore();
    await refreshSnapshotCore();
  });
}

async function searchCourses() {
  if (!state.client) {
    log('请先初始化会话。');
    return;
  }
  await runTask('搜索课程', searchCoursesCore);
}

async function searchCoursesCore() {
  state.courses = await state.client.catalog.searchCourses({
    keyword: elements.keywordInput.value.trim(),
    filters: { hasCapacity: elements.hasCapacityInput.checked },
    page: { start: 1, size: 20 }
  });
  state.selectedCourseId = state.courses[0]?.courseId ?? null;
  renderCourses();
  if (state.selectedCourseId) {
    await loadClassesCore(state.selectedCourseId);
  } else {
    state.classes = [];
    renderClasses();
  }
  log(`找到 ${state.courses.length} 门课程。`);
}

async function loadClasses(courseId) {
  if (!state.client) return;
  await runTask('加载教学班', () => loadClassesCore(courseId));
}

async function loadClassesCore(courseId) {
  state.selectedCourseId = courseId;
  renderCourses();
  state.classes = await state.client.catalog.getTeachingClasses(courseId);
  renderClasses();
  log(`课程 ${courseId} 加载 ${state.classes.length} 个教学班。`);
}

async function chooseClass(teachingClass) {
  await runTask('提交选课', async () => {
    const result = await state.client.selection.choose(
      { courseId: teachingClass.courseId, classId: teachingClass.classId },
      {
        confirm: async (event) => window.confirm(event.message || '后端要求确认，是否继续？'),
        chooseWeight: async () => window.prompt('请输入权重/积分', '1') || '1',
        chooseChildClasses: async () => [teachingClass.submitClassId],
        chooseTextbooks: async () => []
      }
    );
    log(`选课结果：${result.status}`);
    await refreshSnapshotCore();
    await loadClassesCore(teachingClass.courseId);
  });
}

async function dropClass(selection) {
  if (!window.confirm(`确认退选 ${selection.name}？`)) return;
  await runTask('提交退课', async () => {
    const result = await state.client.selection.drop(
      {
        courseId: selection.courseId,
        classId: selection.classId,
        submitClassId: selection.submitClassId
      },
      {
        confirm: async (event) => window.confirm(event.message || '确认退课？'),
        smsCode: async () => window.prompt('请输入短信验证码', '') || ''
      }
    );
    log(`退课结果：${result.status}`);
    await refreshSnapshotCore();
    if (state.selectedCourseId) await loadClassesCore(state.selectedCourseId);
  });
}

async function saveOrder() {
  if (!state.snapshot?.selectedClasses.length) return;
  await runTask('保存排序', async () => {
    const ordered = state.snapshot.selectedClasses.map((item) => item.classId);
    await state.client.selection.reorder({ classIds: ordered });
    await refreshSnapshotCore();
    log('排序已保存。');
  });
}

async function refreshSnapshot() {
  if (!state.client?.context) {
    log('请先初始化会话。');
    return;
  }
  await runTask('刷新已选', refreshSnapshotCore);
}

async function refreshSnapshotCore() {
  state.snapshot = await state.client.chosen.snapshot();
  renderChosen();
  renderClasses();
  updateSessionSummary();
}

function renderCourses() {
  elements.courseList.replaceChildren();
  if (!state.courses.length) {
    elements.courseList.append(empty('初始化后搜索课程'));
    return;
  }

  for (const course of state.courses) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `course-card ${course.courseId === state.selectedCourseId ? 'active' : ''}`;
    card.innerHTML = `
      <div class="card-title">
        <strong>${escapeHtml(course.name)}</strong>
        <span>${escapeHtml(course.credit)} 学分</span>
      </div>
      <div class="meta">
        <span>${escapeHtml(course.courseCode || course.courseId)}</span>
        <span>${escapeHtml(course.typeName || course.typeCode)}</span>
      </div>
      <div class="flags">
        ${course.recommended ? '<span class="tag ok">推荐</span>' : ''}
        ${course.hasPrerequisiteHint ? '<span class="tag warn">先行课</span>' : ''}
        ${course.retake ? '<span class="tag danger">重修</span>' : ''}
      </div>
    `;
    card.addEventListener('click', () => loadClasses(course.courseId));
    elements.courseList.append(card);
  }
}

function renderClasses() {
  elements.classList.replaceChildren();
  elements.classCountBadge.textContent = `${state.classes.length} 个`;
  if (!state.classes.length) {
    elements.classList.append(empty('选择课程后显示教学班'));
    return;
  }

  for (const item of state.classes) {
    const selected = state.snapshot?.byClassId?.has(item.classId) || state.snapshot?.byClassId?.has(item.submitClassId);
    const card = document.createElement('article');
    card.className = 'class-card';
    card.innerHTML = `
      <div class="card-title">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${item.selectedCount}/${item.capacity || '--'}</span>
      </div>
      <div class="meta">
        <span>${escapeHtml(item.teachers.map((teacher) => teacher.name).filter(Boolean).join('、') || '教师待定')}</span>
        <span>${escapeHtml(item.scheduleText || '时间待定')}</span>
        <span>${escapeHtml(item.locationText || '地点待定')}</span>
      </div>
      <div class="flags">
        <span class="tag ${item.flags.full ? 'danger' : 'ok'}">${item.flags.full ? '已满' : '可选'}</span>
        ${selected ? '<span class="tag ok">已在志愿</span>' : ''}
        ${item.childClassCount > 1 ? `<span class="tag warn">${item.childClassCount} 个子班</span>` : ''}
      </div>
    `;
    const actions = document.createElement('div');
    actions.className = 'class-actions';
    const chooseButton = document.createElement('button');
    chooseButton.type = 'button';
    chooseButton.textContent = selected ? '已选' : '选课';
    chooseButton.disabled = selected || item.flags.full || !item.flags.canSelect;
    chooseButton.addEventListener('click', () => chooseClass(item));
    actions.append(chooseButton);
    card.append(actions);
    elements.classList.append(card);
  }
}

function renderChosen() {
  elements.chosenList.replaceChildren();
  const snapshot = state.snapshot;
  const classes = snapshot?.selectedClasses ?? [];
  elements.chosenTotals.textContent = `${snapshot?.totals.courseCount ?? 0} 门 / ${snapshot?.totals.credit ?? 0} 学分`;

  if (!classes.length) {
    elements.chosenList.append(empty('暂无已选课程'));
    return;
  }

  classes.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'chosen-card';
    card.innerHTML = `
      <div class="card-title">
        <strong>${index + 1}. ${escapeHtml(item.name)}</strong>
        <span>${item.weight ? `权重 ${item.weight}` : '志愿'}</span>
      </div>
      <div class="meta">
        <span>${escapeHtml(item.teachers?.map((teacher) => teacher.name).filter(Boolean).join('、') || '教师待定')}</span>
        <span>${escapeHtml(item.scheduleText || '时间待定')}</span>
      </div>
      <div class="flags">
        <span class="tag ${item.selectedBySystem ? 'ok' : 'warn'}">${item.selectedBySystem ? '已选上' : '待筛选'}</span>
        <span class="tag">${item.selfSelected ? '自选' : '系统调整'}</span>
      </div>
    `;
    const actions = document.createElement('div');
    actions.className = 'chosen-actions';
    const dropButton = document.createElement('button');
    dropButton.type = 'button';
    dropButton.className = 'danger';
    dropButton.textContent = '退选';
    dropButton.disabled = !item.canDrop;
    dropButton.addEventListener('click', () => dropClass(item));
    actions.append(dropButton);
    card.append(actions);
    elements.chosenList.append(card);
  });
}

function updateSessionSummary() {
  const context = state.client?.context;
  if (!context) {
    elements.sessionSummary.textContent = '未初始化会话';
    return;
  }
  elements.sessionSummary.textContent = `代理会话 · ${context.term.xkxnm}-${context.term.xkxqm} · ${context.current.kklxdm} · ${context.current.xkkzId}`;
}

async function runTask(label, task) {
  if (state.busy) return;
  state.busy = true;
  setStatus(label);
  setButtonsDisabled(true);
  try {
    await task();
    setStatus('idle');
  } catch (error) {
    setStatus('error');
    log(`${label}失败：${error.message}`);
  } finally {
    state.busy = false;
    setButtonsDisabled(false);
  }
}

function setButtonsDisabled(disabled) {
  for (const button of document.querySelectorAll('.topbar-actions button, #sessionForm button, #searchForm button, #saveOrderBtn')) {
    button.disabled = disabled;
  }
}

function setStatus(status) {
  elements.statusBadge.textContent = status;
}

function log(message) {
  const item = document.createElement('li');
  item.textContent = `${new Date().toLocaleTimeString()} ${message}`;
  elements.activityLog.prepend(item);
}

function empty(text) {
  const box = document.createElement('div');
  box.className = 'empty';
  box.textContent = text;
  return box;
}

class ProxyTransport {
  constructor({ baseUrl, cookie }) {
    this.baseUrl = baseUrl;
    this.cookie = cookie;
  }

  async get(path, options = {}) {
    return this.proxy('/api/proxy/get', { path, options });
  }

  async post(path, data = {}, options = {}) {
    return this.proxy('/api/proxy/post', { path, data, options });
  }

  async proxy(endpoint, payload) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        baseUrl: this.baseUrl,
        cookie: this.cookie,
        ...payload
      })
    });
    return readResponse(response, endpoint);
  }
}

async function readResponse(response, path) {
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
