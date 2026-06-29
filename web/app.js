import { createZfxkClient } from '../src/client.js';
import { parseCourseTypeOptions } from '../src/course-types.js';
import { courseIdsForDisplayKey, groupCoursesForDisplay, teachingClassNamesById } from './course-groups.js';
import { loadAllCoursePages } from './course-pages.js';
import { buildScheduleBlocks, colorScheduleEntries, scheduleSlotKey } from './schedule-layout.js';

const elements = {
  sessionForm: document.querySelector('#sessionForm'),
  searchForm: document.querySelector('#searchForm'),
  baseUrlInput: document.querySelector('#baseUrlInput'),
  cookieInput: document.querySelector('#cookieInput'),
  pagePathInput: document.querySelector('#pagePathInput'),
  usernameInput: document.querySelector('#usernameInput'),
  passwordInput: document.querySelector('#passwordInput'),
  loginWithCaptchaBtn: document.querySelector('#loginWithCaptchaBtn'),
  solveCaptchaBtn: document.querySelector('#solveCaptchaBtn'),
  keywordInput: document.querySelector('#keywordInput'),
  courseTypeTabs: document.querySelector('#courseTypeTabs'),
  filterPanel: document.querySelector('#filterPanel'),
  filterRows: document.querySelector('#filterRows'),
  resetFiltersBtn: document.querySelector('#resetFiltersBtn'),
  toggleFiltersBtn: document.querySelector('#toggleFiltersBtn'),
  sessionSummary: document.querySelector('#sessionSummary'),
  courseList: document.querySelector('#courseList'),
  courseTotalBadge: document.querySelector('#courseTotalBadge'),
  catalogSearchBtn: document.querySelector('#catalogSearchBtn'),
  classList: document.querySelector('#classList'),
  classCountBadge: document.querySelector('#classCountBadge'),
  classSortBtn: document.querySelector('#classSortBtn'),
  chosenList: document.querySelector('#chosenList'),
  chosenTotals: document.querySelector('#chosenTotals'),
  scheduleStatus: document.querySelector('#scheduleStatus'),
  selectedScheduleBody: document.querySelector('#selectedScheduleBody'),
  saveOrderBtn: document.querySelector('#saveOrderBtn'),
  refreshSnapshotBtn: document.querySelector('#refreshSnapshotBtn'),
  clearLogBtn: document.querySelector('#clearLogBtn'),
  activityLog: document.querySelector('#activityLog'),
  statusBadge: document.querySelector('#statusBadge')
};

const WEEKDAYS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
const PERIODS = Array.from({ length: 12 }, (_, index) => index + 1);
const SESSION_STORAGE_KEY = 'zfxk.web.session.v1';
const SESSION_CACHE_FIELDS = [
  ['baseUrl', elements.baseUrlInput],
  ['cookie', elements.cookieInput],
  ['pagePath', elements.pagePathInput],
  ['username', elements.usernameInput],
  ['password', elements.passwordInput]
];

const state = {
  client: null,
  transport: null,
  courses: [],
  classes: [],
  selectedCourseId: null,
  snapshot: null,
  entryHtml: '',
  courseTypes: [],
  activeCourseTypeKey: '',
  filterGroups: [],
  filters: {},
  expandedFilterRows: new Set(),
  filtersCollapsed: false,
  draggedSelectedClassId: null,
  busy: false
};

restoreSessionCache();

for (const [, element] of SESSION_CACHE_FIELDS) {
  element.addEventListener('input', persistSessionCache);
  element.addEventListener('change', persistSessionCache);
}

elements.sessionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await initialize();
});

elements.loginWithCaptchaBtn.addEventListener('click', () => loginWithCaptchaCookie());
elements.solveCaptchaBtn.addEventListener('click', () => solveCaptchaCookie());

elements.searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await searchCourses();
});

elements.resetFiltersBtn.addEventListener('click', async () => {
  elements.keywordInput.value = '';
  state.filters = {};
  renderFilterPanel();
  await searchCourses();
});

elements.toggleFiltersBtn.addEventListener('click', () => {
  state.filtersCollapsed = !state.filtersCollapsed;
  renderFilterPanel();
});

elements.filterRows.addEventListener('click', async (event) => {
  const expandButton = event.target.closest('[data-expand-filter]');
  if (expandButton) {
    const key = expandButton.dataset.expandFilter;
    if (state.expandedFilterRows.has(key)) state.expandedFilterRows.delete(key);
    else state.expandedFilterRows.add(key);
    renderFilterPanel();
    return;
  }

  const optionButton = event.target.closest('[data-filter-option]');
  if (optionButton) {
    const { key, value } = optionButton.dataset;
    if (state.filters[key] === value) delete state.filters[key];
    else state.filters[key] = value;
    renderFilterPanel();
    await searchCourses();
    return;
  }

  const applyButton = event.target.closest('[data-apply-text-filter]');
  if (applyButton) {
    const key = applyButton.dataset.applyTextFilter;
    const input = elements.filterRows.querySelector(`[data-text-filter="${key}"]`);
    const value = input?.value.trim() ?? '';
    if (value) state.filters[key] = value;
    else delete state.filters[key];
    renderFilterPanel();
    await searchCourses();
  }
});

elements.courseTypeTabs.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-course-type-key]');
  if (!button) return;
  await switchCourseType(button.dataset.courseTypeKey);
});

elements.refreshSnapshotBtn.addEventListener('click', () => refreshSnapshot());
elements.saveOrderBtn.addEventListener('click', () => saveOrder());
elements.catalogSearchBtn.addEventListener('click', () => {
  elements.keywordInput.focus();
  elements.filterPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
elements.classSortBtn.addEventListener('click', () => {
  state.classes = [...state.classes].sort((a, b) => {
    const aFull = Number(Boolean(a.flags.full));
    const bFull = Number(Boolean(b.flags.full));
    if (aFull !== bFull) return aFull - bFull;
    return (b.capacity - b.selectedCount) - (a.capacity - a.selectedCount);
  });
  renderClasses();
});
elements.clearLogBtn.addEventListener('click', () => {
  elements.activityLog.replaceChildren();
  setStatus('idle');
});

renderCourses();
renderClasses();
renderChosen();
renderCourseTypeTabs();
renderFilterPanel();

async function initialize() {
  await runTask('初始化会话', async () => {
    const baseUrl = elements.baseUrlInput.value.trim();
    const cookie = elements.cookieInput.value.trim();
    const path = elements.pagePathInput.value.trim();
    if (!baseUrl) throw new Error('请填写教务系统 Base URL。');
    if (!cookie) throw new Error('请填写 Cookie。');
    if (!path) throw new Error('请填写选课入口 Path。');
    persistSessionCache();

    const transport = new ProxyTransport({ baseUrl, cookie });
    state.client = createZfxkClient({
      baseUrl,
      mode: 'commit',
      transport
    });
    state.transport = transport;
    const html = await transport.get(path);
    state.entryHtml = typeof html === 'string' ? html : '';
    state.courseTypes = parseCourseTypeOptions(state.entryHtml);
    const activeType = state.courseTypes.find((option) => option.active) ?? state.courseTypes[0];
    state.activeCourseTypeKey = activeType ? courseTypeKey(activeType) : '';
    await state.client.bootstrap({ html: state.entryHtml, raw: activeType ? courseTypeRaw(activeType) : undefined });
    state.filters = {};
    state.expandedFilterRows = new Set();
    state.filtersCollapsed = false;
    state.filterGroups = await loadFilterGroups(transport, state.client.context);
    renderCourseTypeTabs();
    renderFilterPanel();
    log('会话已通过本地代理解析。');
    updateSessionSummary();
    await searchCoursesCore();
    await refreshSnapshotCore();
  });
}

async function solveCaptchaCookie() {
  await runTask('获取验证码 Cookie', async () => {
    const baseUrl = elements.baseUrlInput.value.trim();
    if (!baseUrl) throw new Error('请填写教务系统 Base URL。');

    const response = await fetch('/api/captcha/solve', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ baseUrl })
    });
    const result = await readResponse(response, '/api/captcha/solve');
    if (!result.cookie) throw new Error('验证码接口未返回 Cookie。');
    elements.cookieInput.value = result.cookie;
    persistSessionCache();
    log('验证码 Cookie 已填入。');
  });
}

async function loginWithCaptchaCookie() {
  await runTask('登录获取 Cookie', async () => {
    const baseUrl = elements.baseUrlInput.value.trim();
    const username = elements.usernameInput.value.trim();
    const password = elements.passwordInput.value;
    if (!baseUrl) throw new Error('请填写教务系统 Base URL。');
    if (!username) throw new Error('请填写用户名。');
    if (!password) throw new Error('请填写密码。');
    persistSessionCache();

    const response = await fetch('/api/login/zfcaptcha', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ baseUrl, username, password, maxCaptchaAttempts: 3 })
    });
    const result = await readResponse(response, '/api/login/zfcaptcha');
    if (!result.cookie) throw new Error('登录接口未返回 Cookie。');
    elements.cookieInput.value = result.cookie;
    persistSessionCache();
    log(`登录 Cookie 已填入，验证码尝试 ${result.attempts || 1} 次。`);
  });
}

async function switchCourseType(key) {
  if (!state.client) {
    log('请先初始化会话。');
    return;
  }
  if (!key || key === state.activeCourseTypeKey) return;
  const courseType = state.courseTypes.find((option) => courseTypeKey(option) === key);
  if (!courseType) return;

  await runTask(`切换到${courseType.label}`, async () => {
    state.activeCourseTypeKey = key;
    state.filters = {};
    state.expandedFilterRows = new Set();
    state.courses = [];
    state.classes = [];
    state.selectedCourseId = null;
    await state.client.refreshContext({ html: state.entryHtml, raw: courseTypeRaw(courseType) });
    state.filterGroups = await loadFilterGroups(state.transport, state.client.context);
    renderCourseTypeTabs();
    renderFilterPanel();
    renderCourses();
    renderClasses();
    updateSessionSummary();
    await searchCoursesCore();
    await refreshSnapshotCore();
    log(`当前显示：${courseType.label}`);
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
  const query = {
    keyword: elements.keywordInput.value.trim(),
    extra: selectedFilterPayload()
  };
  state.courses = await loadAllCoursePages(state.client.catalog, query);
  await enrichCourseOwnerships(query);
  state.selectedCourseId = groupCoursesForDisplay(state.courses)[0]?.key ?? null;
  renderCourses();
  if (state.selectedCourseId) {
    await loadClassesCore(state.selectedCourseId);
  } else {
    state.classes = [];
    renderClasses();
  }
  log(`找到 ${state.courses.length} 门课程。`);
}

async function loadClasses(courseKey) {
  if (!state.client) return;
  await runTask('加载教学班', () => loadClassesCore(courseKey));
}

async function loadClassesCore(courseKey) {
  state.selectedCourseId = courseKey;
  renderCourses();
  const courseIds = courseIdsForDisplayKey(state.courses, courseKey);
  const classGroups = await Promise.all(courseIds.map((courseId) => state.client.catalog.getTeachingClasses(courseId)));
  const classNames = teachingClassNamesById(state.courses, courseIds);
  state.classes = classGroups.flat().map((item) => inheritCourseOwnership(mergeTeachingClassName(item, classNames)));
  renderClasses();
  log(`课程 ${courseKey} 加载 ${state.classes.length} 个教学班。`);
}

async function enrichCourseOwnerships(query) {
  const ownershipGroup = state.filterGroups.find((group) => group.key === 'kcgs_list');
  if (!ownershipGroup?.options?.length || !state.courses.some(needsCourseOwnership)) return;

  const selectedOwnership = state.filters.kcgs_list;
  if (selectedOwnership) {
    const option = ownershipGroup.options.find((item) => item.value === selectedOwnership);
    if (option) state.courses.forEach((course) => applyOwnershipOptions(course, [option]));
    return;
  }

  if (!isGeneralElectiveContext()) return;

  const targets = new Map();
  for (const course of state.courses) {
    for (const key of courseMatchKeys(course)) {
      const courses = targets.get(key) ?? [];
      courses.push(course);
      targets.set(key, courses);
    }
  }

  const ownershipByCourse = new Map(state.courses.map((course) => [course, []]));
  const extra = { ...(query.extra ?? {}) };
  delete extra.kcgs_list;

  await Promise.all(ownershipGroup.options.map(async (option) => {
    try {
      const matches = await state.client.catalog.searchCourses({
        keyword: query.keyword,
        extra: { ...extra, kcgs_list: option.value },
        page: { start: 1, size: ownershipLookupPageSize(ownershipGroup.options.length) }
      });
      for (const match of matches) {
        for (const key of courseMatchKeys(match)) {
          for (const course of targets.get(key) ?? []) {
            const options = ownershipByCourse.get(course);
            if (options && !options.some((item) => item.value === option.value)) options.push(option);
          }
        }
      }
    } catch {
      // The base course result is still valid if an ownership lookup is rejected or unavailable.
    }
  }));

  for (const [course, options] of ownershipByCourse) {
    applyOwnershipOptions(course, options);
  }
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
    await loadClassesCore(state.selectedCourseId || teachingClass.courseId);
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

function renderFilterPanel() {
  elements.filterRows.replaceChildren();
  elements.filterPanel.classList.toggle('collapsed', state.filtersCollapsed);
  elements.toggleFiltersBtn.textContent = state.filtersCollapsed ? '展开' : '收起';

  if (!state.filterGroups.length) {
    const row = document.createElement('div');
    row.className = 'filter-empty';
    row.textContent = '初始化后从实际选课页读取筛选条件';
    elements.filterRows.append(row);
    return;
  }

  for (const group of state.filterGroups) {
    const row = document.createElement('div');
    row.className = 'filter-row';
    row.dataset.filterRow = group.key;

    const label = document.createElement('div');
    label.className = 'filter-label';
    label.textContent = `${group.label}:`;
    row.append(label);

    const options = document.createElement('div');
    options.className = 'filter-options';

    if (group.type === 'text') {
      const input = document.createElement('input');
      input.dataset.textFilter = group.key;
      input.value = state.filters[group.key] ?? '';
      input.autocomplete = 'off';
      input.className = 'filter-text-input';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-apply';
      button.dataset.applyTextFilter = group.key;
      button.textContent = '确定';
      options.append(input, button);
    } else {
      const expanded = state.expandedFilterRows.has(group.key);
      const visible = expanded ? group.options : group.options.slice(0, group.showSize);
      for (const option of visible) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `filter-option ${state.filters[group.key] === option.value ? 'active' : ''}`;
        button.dataset.filterOption = '';
        button.dataset.key = group.key;
        button.dataset.value = option.value;
        button.textContent = option.text;
        options.append(button);
      }
      if (group.options.length > group.showSize) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'filter-more';
        more.dataset.expandFilter = group.key;
        more.textContent = expanded ? '收起' : '更多';
        options.append(more);
      }
    }

    row.append(options);
    elements.filterRows.append(row);
  }
}

function renderCourses() {
  elements.courseList.replaceChildren();
  const displayCourses = groupCoursesForDisplay(state.courses);
  elements.courseTotalBadge.textContent = `共 ${displayCourses.length} 门`;
  if (!displayCourses.length) {
    elements.courseList.append(empty('初始化后搜索课程'));
    return;
  }

  for (const course of displayCourses) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `course-card ${course.key === state.selectedCourseId ? 'active' : ''}`;
    card.innerHTML = `
      <div class="card-title">
        <strong>${escapeHtml(course.name)}</strong>
        <span>${escapeHtml(course.credit)} 学分</span>
      </div>
      <div class="meta course-card-meta">
        <span>${escapeHtml(course.courseCode || course.courseId)}</span>
        ${renderCourseTypeTag(course.typeName || course.typeCode)}
        ${course.ownershipName ? `<span>课程归属：${escapeHtml(course.ownershipName)}</span>` : ''}
      </div>
      <div class="flags">
        ${course.recommended ? '<span class="tag ok">推荐</span>' : ''}
        ${course.hasPrerequisiteHint ? '<span class="tag warn">先行课</span>' : ''}
        ${course.retake ? '<span class="tag danger">重修</span>' : ''}
        ${course.courseIds.length > 1 ? `<span class="tag">${course.courseIds.length} 组</span>` : ''}
      </div>
    `;
    card.addEventListener('click', () => loadClasses(course.key));
    elements.courseList.append(card);
  }
}

function renderClasses() {
  elements.classList.replaceChildren();
  elements.classCountBadge.textContent = `共 ${state.classes.length} 个教学班`;
  if (!state.classes.length) {
    elements.classList.append(empty('选择课程后显示教学班'));
    return;
  }

  for (const item of state.classes) {
    const selected = state.snapshot?.byClassId?.has(item.classId) || state.snapshot?.byClassId?.has(item.submitClassId);
    const card = document.createElement('article');
    card.className = 'class-card';
    card.innerHTML = `
      <div class="class-card-content">
        <div class="class-card-main">
          <div class="class-card-top">
            ${renderClassSummaryLine(item)}
            <div class="class-card-badges">
              <span class="tag ${item.flags.full ? 'danger' : 'ok'}">${item.flags.full ? '已满' : '可选'}</span>
              ${selected ? '<span class="tag ok">已在志愿</span>' : ''}
              ${item.childClassCount > 1 ? `<span class="tag warn">${item.childClassCount} 个子班</span>` : ''}
              <span class="capacity-pill">${item.selectedCount}/${item.capacity || '--'}</span>
            </div>
          </div>
          ${renderMeetingList(item.scheduleText, item.locationText)}
        </div>
      </div>
    `;
    const actions = document.createElement('div');
    actions.className = 'class-actions class-card-action';
    const chooseButton = document.createElement('button');
    chooseButton.type = 'button';
    chooseButton.textContent = selected ? '已选' : '选课';
    chooseButton.disabled = selected || !item.flags.canSelect;
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
  renderSelectedSchedule(snapshot);

  if (!classes.length) {
    elements.chosenList.append(empty('暂无已选课程'));
    return;
  }

  classes.forEach((item, index) => {
    const classId = String(item.classId);
    const card = document.createElement('article');
    card.className = 'chosen-card';
    card.draggable = true;
    card.dataset.classId = classId;
    card.title = '拖动调整顺序，保存排序后生效';
    card.setAttribute('aria-label', `${index + 1}. ${item.name}，拖动调整顺序`);
    card.innerHTML = `
      <div class="class-card-content">
        <div class="card-title">
          <strong>${index + 1}. ${escapeHtml(item.name)}</strong>
          <span>${item.weight ? `权重 ${item.weight}` : '志愿'}</span>
        </div>
        <div class="class-card-main">
          <div class="class-card-top">
            ${renderTeacherLine(item)}
            <div class="class-card-badges">
              <span class="tag ${item.selectedBySystem ? 'ok' : 'warn'}">${item.selectedBySystem ? '已选上' : '待筛选'}</span>
              <span class="tag">${item.selfSelected ? '自选' : '系统调整'}</span>
            </div>
          </div>
          ${renderMeetingList(item.scheduleText, item.locationText)}
        </div>
      </div>
    `;
    card.addEventListener('dragstart', (event) => {
      state.draggedSelectedClassId = classId;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', classId);
      card.classList.add('dragging');
    });
    card.addEventListener('dragover', (event) => {
      if (!state.draggedSelectedClassId || state.draggedSelectedClassId === classId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', (event) => {
      if (!card.contains(event.relatedTarget)) card.classList.remove('drag-over');
    });
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      const sourceClassId = event.dataTransfer.getData('text/plain') || state.draggedSelectedClassId;
      const rect = card.getBoundingClientRect();
      const placement = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
      card.classList.remove('drag-over');
      moveSelectedClass(sourceClassId, classId, placement);
    });
    card.addEventListener('dragend', clearSelectedClassDragState);

    const actions = document.createElement('div');
    actions.className = 'chosen-actions class-card-action';
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

function moveSelectedClass(sourceClassId, targetClassId, placement = 'before') {
  if (!state.snapshot?.selectedClasses.length || !sourceClassId || !targetClassId || sourceClassId === targetClassId) return false;
  const classes = [...state.snapshot.selectedClasses];
  const sourceIndex = classes.findIndex((item) => String(item.classId) === String(sourceClassId));
  if (sourceIndex < 0) return false;
  const [moved] = classes.splice(sourceIndex, 1);
  const targetIndex = classes.findIndex((item) => String(item.classId) === String(targetClassId));
  if (targetIndex < 0) return false;
  classes.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, moved);
  updateSelectedClassOrder(classes);
  return true;
}

function updateSelectedClassOrder(selectedClasses) {
  state.snapshot = { ...state.snapshot, selectedClasses };
  renderChosen();
}

function clearSelectedClassDragState() {
  state.draggedSelectedClassId = null;
  elements.chosenList.querySelectorAll('.dragging, .drag-over').forEach((card) => {
    card.classList.remove('dragging', 'drag-over');
  });
}

function renderSelectedSchedule(snapshot = state.snapshot) {
  elements.selectedScheduleBody.replaceChildren();
  const classes = snapshot?.selectedClasses ?? [];
  const { blocksByStart, coveredKeys, timedCourseKeys } = buildSelectedScheduleLayout(snapshot);
  const courseCount = snapshot?.totals.courseCount ?? classes.length;
  elements.scheduleStatus.textContent = classes.length
    ? `${timedCourseKeys.size}/${courseCount} 门有时间 · ${classes.length} 个教学班`
    : '暂无课程';

  for (const period of PERIODS) {
    const row = document.createElement('tr');
    const header = document.createElement('th');
    header.scope = 'row';
    header.textContent = String(period);
    row.append(header);

    for (const day of WEEKDAYS) {
      const key = scheduleSlotKey(day, period);
      if (coveredKeys.has(key)) continue;

      const block = blocksByStart.get(key);
      const cell = document.createElement('td');
      const entries = block?.entries ?? [];
      cell.className = `schedule-cell ${entries.length > 1 ? 'conflict' : entries.length ? 'busy' : 'free'} ${block?.rowSpan > 1 ? 'merged' : ''}`;

      if (block) {
        cell.rowSpan = block.rowSpan;
        cell.style.setProperty('--course-span', String(block.rowSpan));
        cell.title = entries.map(formatScheduleTitle).join('\n');
        const stack = document.createElement('div');
        stack.className = 'schedule-cell-stack';
        for (const entry of entries.slice(0, 2)) {
          const label = document.createElement('span');
          label.className = 'schedule-course';
          setScheduleCourseColor(label, entry.color);
          const name = document.createElement('span');
          name.className = 'schedule-course-name';
          name.textContent = entry.courseName;
          label.append(name);

          if (block.rowSpan > 1 && entry.location) {
            const meta = document.createElement('span');
            meta.className = 'schedule-course-meta';
            meta.textContent = entry.location;
            label.append(meta);
          }
          stack.append(label);
        }
        if (entries.length > 2) {
          const more = document.createElement('span');
          more.className = 'schedule-more';
          more.textContent = `+${entries.length - 2}`;
          stack.append(more);
        }
        cell.append(stack);
      }
      row.append(cell);
    }
    elements.selectedScheduleBody.append(row);
  }
}

function setScheduleCourseColor(element, color) {
  if (!color) return;
  element.style.setProperty('--course-bg', color.bg);
  element.style.setProperty('--course-border', color.border);
  element.style.setProperty('--course-fg', color.fg);
}

function buildSelectedScheduleLayout(snapshot = state.snapshot) {
  const timedCourseKeys = new Set();
  const entries = [];
  const selectedCourses = snapshot?.selectedCourses ?? [];
  const courseNameMap = new Map(selectedCourses.map((course) => [String(course.courseId), course.name]));

  (snapshot?.selectedClasses ?? []).forEach((item, index) => {
    for (const entry of selectedScheduleEntries(item, index, courseNameMap)) {
      if (!entry.periods.length || !entry.day) continue;
      timedCourseKeys.add(entry.courseKey);
      entries.push(entry);
    }
  });

  return {
    ...buildScheduleBlocks(colorScheduleEntries(entries), { weekdays: WEEKDAYS, periods: PERIODS }),
    timedCourseKeys
  };
}

function selectedScheduleEntries(item, index, courseNameMap) {
  const courseKey = String(item.raw?.t_kch_id ?? item.courseId ?? item.classId ?? index);
  const courseName = String(
    courseNameMap.get(courseKey)
      ?? courseNameMap.get(String(item.courseId ?? ''))
      ?? item.raw?.kcmc
      ?? item.name
      ?? '未命名课程'
  );
  const className = item.name && item.name !== courseName ? item.name : '';

  return parseMeetingLines(item.scheduleText, item.locationText).map((meeting) => {
    const day = meetingWeekday(meeting);
    return {
      courseKey,
      courseName,
      className,
      day,
      periods: parsePeriodNumbers(meeting.period, meeting.raw),
      periodText: meeting.period || '',
      weeks: meeting.weeks || '',
      location: meeting.location || '',
      teachers: item.teachers?.map((teacher) => teacher.name).filter(Boolean).join('、') || ''
    };
  });
}

function meetingWeekday(meeting) {
  const source = meeting.day || meeting.raw || '';
  const match = normalizeWeekday(source.match(/(?:星期|周)?[一二三四五六日天1-7]/u)?.[0] || source);
  return WEEKDAYS.includes(match) ? match : '';
}

function parsePeriodNumbers(period, raw) {
  const source = `${period || ''} ${raw || ''}`;
  const match = source.match(/(\d+)(?:\s*(?:-|~|至)\s*(\d+))?/u);
  if (!match) return [];
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  const first = Math.max(1, Math.min(start, end));
  const last = Math.min(12, Math.max(start, end));
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function formatScheduleTitle(entry) {
  return [
    entry.courseName,
    entry.className,
    [entry.day, entry.periodText, entry.weeks].filter(Boolean).join(' '),
    entry.location,
    entry.teachers ? `教师：${entry.teachers}` : ''
  ].filter(Boolean).join(' · ');
}

function renderCourseTypeTabs() {
  elements.courseTypeTabs.replaceChildren();
  if (!state.courseTypes.length) {
    const placeholder = document.createElement('span');
    placeholder.className = 'course-type-placeholder';
    placeholder.textContent = '初始化后显示可切换类型';
    elements.courseTypeTabs.append(placeholder);
    return;
  }

  for (const option of state.courseTypes) {
    const key = courseTypeKey(option);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `course-type-tab ${key === state.activeCourseTypeKey ? 'active' : ''}`;
    button.dataset.courseTypeKey = key;
    button.textContent = option.label;
    button.title = `${option.kklxdm} · ${option.xkkzId}`;
    elements.courseTypeTabs.append(button);
  }
}

function mergeTeachingClassName(item, classNames) {
  const className = classNames.get(String(item.classId)) ?? classNames.get(String(item.submitClassId));
  if (!className) return item;
  return {
    ...item,
    raw: {
      ...item.raw,
      jxbmc: className
    }
  };
}

function inheritCourseOwnership(item) {
  if (item.ownershipName || item.ownershipCode) return item;
  const course = state.courses.find((candidate) => String(candidate.courseId) === String(item.courseId));
  if (!course?.ownershipName && !course?.ownershipCode) return item;
  return {
    ...item,
    ownershipName: course.ownershipName,
    ownershipCode: course.ownershipCode
  };
}

function needsCourseOwnership(course) {
  return !course.ownershipName && !course.ownershipCode;
}

function isGeneralElectiveContext() {
  const context = state.client?.context;
  const label = context?.current?.kklxmc || '';
  return context?.current?.kklxdm === '10' || label.includes('通识选修');
}

function courseMatchKeys(course = {}) {
  return [
    course.courseId ? `id:${course.courseId}` : '',
    course.courseCode ? `code:${course.courseCode}` : ''
  ].filter(Boolean);
}

function ownershipLookupPageSize(optionCount) {
  return Math.max(120, Math.min(500, state.courses.length * Math.max(optionCount, 1) * 2));
}

function applyOwnershipOptions(course, options) {
  const names = [];
  const codes = [];
  for (const option of options) {
    addUnique(names, option.text);
    addUnique(codes, option.value);
  }
  if (names.length) course.ownershipName = names.join('、');
  if (codes.length) course.ownershipCode = codes.join(',');
}

function addUnique(values, value) {
  const normalized = String(value || '').trim();
  if (normalized && !values.includes(normalized)) values.push(normalized);
}

function renderTeacherLine(item) {
  const teachers = item.teachers?.map((teacher) => teacher.name).filter(Boolean).join('、') || '教师待定';
  return `
    <div class="class-detail-line">
      <span class="detail-value teacher-value">${escapeHtml(teachers)}</span>
    </div>
  `;
}

function renderClassSummaryLine(item) {
  const className = String(item.raw?.jxbmc ?? '').trim();
  const teachers = item.teachers?.map((teacher) => teacher.name).filter(Boolean).join('、') || '教师待定';
  const ownership = item.ownershipName || item.ownershipCode;
  return `
    <div class="class-detail-line class-summary-line">
      <span class="class-name-value">${escapeHtml(className)}</span>
      ${ownership ? `<span class="detail-value course-ownership-value">课程归属：${escapeHtml(ownership)}</span>` : ''}
      <span class="detail-value teacher-value">${escapeHtml(teachers)}</span>
    </div>
  `;
}

function renderCourseTypeTag(label) {
  return label ? `<span class="course-type-pill">${escapeHtml(label)}</span>` : '';
}

function renderMeetingList(scheduleText, locationText) {
  const meetings = parseMeetingLines(scheduleText, locationText);
  if (!meetings.length) {
    return `
      <div class="meeting-list">
        <div class="meeting-item">
          <div class="meeting-time"><span>时间待定</span></div>
          <span class="meeting-location">地点待定</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="meeting-list">
      ${meetings.map((meeting) => {
        const timeParts = [];
        if (meeting.day) timeParts.push(`<span class="meeting-day">${escapeHtml(meeting.day)}</span>`);
        if (meeting.period) timeParts.push(`<span class="meeting-period">${escapeHtml(meeting.period)}</span>`);
        if (meeting.weeks) timeParts.push(`<span class="meeting-weeks">${escapeHtml(meeting.weeks)}</span>`);
        if (!timeParts.length && meeting.raw) timeParts.push(`<span>${escapeHtml(meeting.raw)}</span>`);
        if (!timeParts.length) timeParts.push('<span>时间待定</span>');
        return `
          <div class="meeting-item">
            <div class="meeting-time">${timeParts.join('')}</div>
            <span class="meeting-location">${escapeHtml(meeting.location || '地点待定')}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function parseMeetingLines(scheduleText, locationText) {
  const scheduleLines = splitHtmlLines(scheduleText);
  const locationLines = splitHtmlLines(locationText);
  const count = Math.max(scheduleLines.length, locationLines.length);
  if (!count) return [];

  return Array.from({ length: count }, (_, index) => ({
    ...parseMeetingTime(scheduleLines[index] ?? ''),
    location: locationLines[index] ?? (locationLines.length === 1 ? locationLines[0] : '')
  }));
}

function parseMeetingTime(line) {
  const raw = line.trim();
  if (!raw) return { raw: '' };

  const match = raw.match(/^(?:(?<day>(?:星期|周)?[一二三四五六日天]|(?:星期|周)?[1-7])\s*)?(?:第)?(?<period>\d+(?:\s*(?:-|~|至)\s*\d+)?)?\s*节?\s*(?:\{(?<weeks>[^}]+)\})?$/u);
  if (!match?.groups || (!match.groups.day && !match.groups.period && !match.groups.weeks)) {
    return { raw };
  }

  return {
    raw,
    day: normalizeWeekday(match.groups.day),
    period: normalizePeriod(match.groups.period),
    weeks: match.groups.weeks?.trim() || ''
  };
}

function splitHtmlLines(value) {
  if (!value) return [];
  const template = document.createElement('template');
  template.innerHTML = String(value).replace(/<br\s*\/?>/gi, '\n');
  return (template.content.textContent ?? '')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeWeekday(day) {
  if (!day) return '';
  const key = String(day).match(/[一二三四五六日天1-7]$/u)?.[0];
  const weekdays = {
    一: '星期一',
    二: '星期二',
    三: '星期三',
    四: '星期四',
    五: '星期五',
    六: '星期六',
    日: '星期日',
    天: '星期日',
    1: '星期一',
    2: '星期二',
    3: '星期三',
    4: '星期四',
    5: '星期五',
    6: '星期六',
    7: '星期日'
  };
  return weekdays[key] ?? day;
}

function normalizePeriod(period) {
  if (!period) return '';
  return `第${String(period).replace(/\s+/g, '').replace(/[~至]/g, '-')}节`;
}

function updateSessionSummary() {
  const context = state.client?.context;
  if (!context) {
    elements.sessionSummary.textContent = '未初始化会话';
    return;
  }
  const typeName = context.current.kklxmc || state.courseTypes.find((option) => courseTypeKey(option) === state.activeCourseTypeKey)?.label || context.current.kklxdm;
  elements.sessionSummary.textContent = `代理会话 · ${context.term.xkxnm}-${context.term.xkxqm} · ${typeName} · ${context.current.kklxdm} · ${context.current.xkkzId}`;
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
  for (const button of document.querySelectorAll('.topbar-actions button, #sessionForm button, #courseTypeTabs button, #searchForm button, #saveOrderBtn, #catalogSearchBtn, #classSortBtn')) {
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

function restoreSessionCache() {
  const cache = readSessionCache();
  if (!cache) return;
  for (const [key, element] of SESSION_CACHE_FIELDS) {
    if (typeof cache[key] === 'string') element.value = cache[key];
  }
}

function persistSessionCache() {
  writeSessionCache(Object.fromEntries(SESSION_CACHE_FIELDS.map(([key, element]) => [
    key,
    key === 'password' ? element.value : element.value.trim()
  ])));
}

function readSessionCache() {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSessionCache(cache) {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Some privacy modes disable localStorage; the form still works without persistence.
  }
}

function empty(text) {
  const box = document.createElement('div');
  box.className = 'empty';
  box.textContent = text;
  return box;
}

function selectedFilterPayload() {
  return Object.fromEntries(Object.entries(state.filters).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function courseTypeKey(option) {
  return [option.kklxdm, option.xkkzId, option.xkkzXh].join('::');
}

function courseTypeRaw(option) {
  return {
    kklxdm: option.kklxdm,
    kklxmc: option.label,
    xkkz_id: option.xkkzId,
    njdm_id: option.njdmId,
    zyh_id: option.zyhId,
    xkkz_xh: option.xkkzXh
  };
}

async function loadFilterGroups(transport, context) {
  const loaders = filterDefinitions(context).map(async (definition) => {
    if (!definition.enabled) return null;
    if (definition.type === 'text') {
      return { ...definition, options: [] };
    }
    if (definition.options) {
      return { ...definition, options: definition.options };
    }
    try {
      const options = await loadRemoteOptions(transport, definition);
      return options.length ? { ...definition, options } : null;
    } catch {
      return null;
    }
  });
  return (await Promise.all(loaders)).filter(Boolean);
}

function filterDefinitions(context) {
  const raw = context.raw ?? {};
  const locale = encodeURIComponent(raw.localeKey || 'zh_CN');
  const sameMajor = raw.zzxkgjcxkg_tjbj === '1';
  return [
    remoteFilter('kkbm_id_list', '开课学院', raw.zzxkgjcxkg_kkxy, `/xkgl/common_queryKkbmPaged.html?localeKey=${locale}`, 'jg_id', 'jgmc', 'jgxh', 'asc', 6),
    remoteFilter('njdm_id_list', '年级', raw.zzxkgjcxkg_nj, `/xkgl/common_queryNjPaged.html?njdm_id=${sameMajor ? encodeURIComponent(context.student.njdmId || '') : 'w'}`, 'njdm_id', 'njmc', 'njxh', 'desc', 10),
    remoteFilter('jg_id_list', '学院', raw.zzxkgjcxkg_xy, `/xkgl/common_queryXyPaged.html?localeKey=${locale}&jg_id=${sameMajor ? encodeURIComponent(context.student.jgId || '') : 'w'}`, 'jg_id', 'jgmc', 'jgxh', 'asc', 6),
    remoteFilter('zyh_id_list', '专业', raw.zzxkgjcxkg_zy, `/xkgl/common_queryZyPaged.html?localeKey=${locale}&zyh_id=${sameMajor ? encodeURIComponent(context.student.zyhId || '') : 'w'}`, 'zyh_id', 'zymc', 'zyxh', 'asc', 6),
    remoteFilter('kclb_id_list', '课程类别', raw.zzxkgjcxkg_kclb, '/xkgl/common_queryKclbListPaged.html', 'kclbdm', 'kclbmc', 'kclbdm', 'asc', 6),
    remoteFilter('kcxzdm_list', '课程性质', raw.zzxkgjcxkg_kcxz, '/xkgl/common_queryKcxzPaged.html', 'dm', 'mc', 'dm', 'asc', 6),
    remoteFilter('kcgs_list', '课程归属', raw.zzxkgjcxkg_kcgs, '/xkgl/common_queryKcgsPaged.html', 'kcgsdm', 'kcgsmc', 'px,kcgsdm', 'asc', 7),
    remoteFilter('jxms_list', '教学模式', raw.zzxkgjcxkg_jxms, '/xtgl/comm_cxJcsjList.html?lxdm=0032', 'dm', 'mc', undefined, undefined, 7),
    remoteFilter('sksj_list', '上课星期', raw.zzxkgjcxkg_skxq, '/xtgl/comm_cxJcsjList.html?lxdm=0036', 'dm', 'mc', undefined, undefined, 7),
    remoteFilter('skjc_list', '上课节次', raw.zzxkgjcxkg_skjc, '/xkgl/common_querySkjcList.html', 'dm', 'dm', 'dm', 'asc', 15),
    { key: 'jxbmc_list', label: '教学班', type: 'text', enabled: raw.zzxkgjcxkg_jxb === '1', showSize: 1 },
    fixedFilter('cxbj_list', '是否重修', raw.zzxkgjcxkg_sfcx, [{ value: '1', text: '是' }, { value: '0', text: '否' }]),
    fixedFilter('yl_list', '有无余量', raw.zzxkgjcxkg_ywyl, [{ value: '1', text: '有' }, { value: '0', text: '无' }]),
    fixedFilter('sksjct_list', '上课时间冲突', raw.zzxkgjcxkg_sksjct, [{ value: '1', text: '是' }, { value: '0', text: '否' }])
  ];
}

function remoteFilter(key, label, flag, path, valueField, textField, sortName, sortOrder, showSize) {
  return {
    key,
    label,
    enabled: flag === '1',
    path,
    valueField,
    textField,
    sortName,
    sortOrder,
    showSize,
    limit: Math.max(showSize * 8, 60)
  };
}

function fixedFilter(key, label, flag, options) {
  return { key, label, enabled: flag === '1', options, showSize: options.length };
}

async function loadRemoteOptions(transport, definition) {
  const response = await transport.post(definition.path, queryModelData(definition));
  return uniqueOptions(rowsFromResponse(response).map((row) => ({
    value: String(row?.[definition.valueField] ?? ''),
    text: String(row?.[definition.textField] ?? '')
  })).filter((option) => option.value && option.text));
}

function queryModelData(definition) {
  return {
    'queryModel.showCount': String(definition.limit ?? 60),
    'queryModel.currentPage': '1',
    ...(definition.sortName ? { 'queryModel.sortName': definition.sortName } : {}),
    ...(definition.sortOrder ? { 'queryModel.sortOrder': definition.sortOrder } : {})
  };
}

function rowsFromResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.rows)) return response.rows;
  if (Array.isArray(response?.tmpList)) return response.tmpList;
  return [];
}

function uniqueOptions(options) {
  const seen = new Map();
  for (const option of options) {
    const key = `${option.value}::${option.text}`;
    if (!seen.has(key)) seen.set(key, option);
  }
  return [...seen.values()];
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
