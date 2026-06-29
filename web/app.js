import { createZfxkClient, endpoints, loadRuntimeContext, MemoryTransport } from '../src/index.js';

const elements = {
  sessionForm: document.querySelector('#sessionForm'),
  searchForm: document.querySelector('#searchForm'),
  modeInputs: [...document.querySelectorAll('input[name="mode"]')],
  baseUrlInput: document.querySelector('#baseUrlInput'),
  pagePathInput: document.querySelector('#pagePathInput'),
  keywordInput: document.querySelector('#keywordInput'),
  hasCapacityInput: document.querySelector('#hasCapacityInput'),
  sessionSummary: document.querySelector('#sessionSummary'),
  courseList: document.querySelector('#courseList'),
  classList: document.querySelector('#classList'),
  classCountBadge: document.querySelector('#classCountBadge'),
  chosenPanel: document.querySelector('#chosenPanel'),
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
  mode: 'demo',
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

async function initialize() {
  await runTask('初始化会话', async () => {
    state.mode = elements.modeInputs.find((input) => input.checked)?.value || 'demo';
    if (state.mode === 'demo') {
      state.client = createDemoClient();
      await state.client.bootstrap({ html: demoPageHtml });
      log('Demo 会话已加载，可直接搜索、选课、退课。');
    } else {
      state.client = createBrowserClient(elements.baseUrlInput.value.trim());
      await state.client.bootstrapFromPage({ path: elements.pagePathInput.value.trim() });
      log('浏览器会话已解析。后续请求将使用 credentials=include。');
    }
    updateSessionSummary();
    await searchCoursesCore();
    await refreshSnapshotCore();
  });
}

async function searchCourses() {
  if (!state.client) return;
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
  state.selectedCourseId = courseId;
  renderCourses();
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
        confirm: async (event) => confirmAction(event.message || '后端要求确认，是否继续？'),
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
  const confirmed = await confirmAction(`确认退选 ${selection.name}？`);
  if (!confirmed) return;
  await runTask('提交退课', async () => {
    const result = await state.client.selection.drop(
      {
        courseId: selection.courseId,
        classId: selection.classId,
        submitClassId: selection.submitClassId
      },
      {
        confirm: async (event) => confirmAction(event.message || '确认退课？'),
        smsCode: async () => window.prompt('请输入短信验证码', '') || ''
      }
    );
    log(`退课结果：${result.status}`);
    await refreshSnapshotCore();
    if (state.selectedCourseId) await loadClassesCore(state.selectedCourseId);
  });
}

function confirmAction(message) {
  if (state.mode === 'demo') return Promise.resolve(true);
  return Promise.resolve(window.confirm(message));
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
  if (!state.client?.context) return;
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
    elements.courseList.append(empty('暂无课程'));
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
  elements.sessionSummary.textContent = `${state.mode === 'demo' ? 'Demo' : '浏览器会话'} · ${context.term.xkxnm}-${context.term.xkxqm} · ${context.current.kklxdm} · ${context.current.xkkzId}`;
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

function createBrowserClient(baseUrl) {
  return createZfxkClient({
    baseUrl,
    mode: 'commit',
    transport: new BrowserSessionTransport(baseUrl)
  });
}

class BrowserSessionTransport {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async get(path, options = {}) {
    const response = await fetch(this.url(path), {
      method: 'GET',
      credentials: 'include',
      headers: options.headers || {}
    });
    return readResponse(response, path);
  }

  async post(path, data = {}, options = {}) {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) body.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    const response = await fetch(this.url(path), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        ...(options.headers || {})
      },
      body
    });
    return readResponse(response, path);
  }

  url(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.baseUrl}${path}`;
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

function createDemoClient() {
  const fixture = createDemoFixture();
  const transport = new MemoryTransport({
    '/xsxk/zzxkyzb_cxZzxkYzbIndex.html?gnmkdm=N253512': demoPageHtml,
    [endpoints.coursePage]: ({ data }) => ({
      tmpList: fixture.courses.filter((course) => {
        const keyword = String(data.searchInput || '').trim();
        const matchesKeyword = !keyword || `${course.kch}${course.kcmc}`.includes(keyword);
        const hasCapacity = data.yl_list === '1'
          ? fixture.classes[course.kch_id].some((item) => Number(item.yxzrs) < Number(item.jxbrl))
          : true;
        return matchesKeyword && hasCapacity;
      }),
      sfxsjc: '0'
    }),
    [endpoints.teachingClasses]: ({ data }) => fixture.classes[data.kch_id] || [],
    [endpoints.chosenDisplay]: () => fixture.selected.map((item, index) => ({ ...item, zypx: String(index + 1) })),
    [endpoints.titleCheck]: { flag: '1' },
    [endpoints.conflictCheck]: { flag: '1' },
    [endpoints.textbookCheck]: '0',
    [endpoints.saveSelection]: ({ data }) => {
      const row = findClassBySubmitId(fixture, data.jxb_ids);
      if (!row) return { flag: '0', msg: '教学班不存在' };
      if (fixture.selected.some((item) => item.do_jxb_id === row.do_jxb_id)) return { flag: '6' };
      if (Number(row.yxzrs) >= Number(row.jxbrl)) return { flag: '-1', msg: `0,${row.jxb_id},${row.yxzrs},${row.yxzrs}` };
      row.yxzrs = String(Number(row.yxzrs) + 1);
      fixture.selected.push(toSelectedRow(fixture, row, data.qz));
      return { flag: '1' };
    },
    [endpoints.dropSelection]: ({ data }) => {
      const before = fixture.selected.length;
      fixture.selected = fixture.selected.filter((item) => item.do_jxb_id !== data.jxb_ids);
      const row = findClassBySubmitId(fixture, data.jxb_ids);
      if (row && before !== fixture.selected.length) row.yxzrs = String(Math.max(0, Number(row.yxzrs) - 1));
      return '1';
    },
    [endpoints.saveOrder]: ({ data }) => {
      const ids = String(data.jxb_ids || '').split(',').filter(Boolean);
      fixture.selected.sort((a, b) => ids.indexOf(a.jxb_id) - ids.indexOf(b.jxb_id));
      return 'success';
    }
  });

  return createZfxkClient({
    baseUrl: 'https://demo.local/jwglxt',
    auth: { type: 'cookie', cookie: 'demo=1' },
    transport,
    context: loadRuntimeContext({ baseUrl: 'https://demo.local/jwglxt', html: demoPageHtml })
  });
}

function createDemoFixture() {
  const courses = [
    { kch_id: 'KC_DB', kch: 'CS301', kcmc: '数据库系统', xf: '3', kklxdm: '10', kklxmc: '专业选修', cxbj: '0', xxkbj: '0', sftj: '1' },
    { kch_id: 'KC_OS', kch: 'CS302', kcmc: '操作系统', xf: '4', kklxdm: '10', kklxmc: '专业核心', cxbj: '0', xxkbj: '1', sftj: '0' },
    { kch_id: 'KC_AI', kch: 'CS408', kcmc: '人工智能导论', xf: '2', kklxdm: '10', kklxmc: '通识拓展', cxbj: '0', xxkbj: '0', sftj: '1' }
  ];
  const classes = {
    KC_DB: [
      { jxb_id: 'JXB_DB_01', do_jxb_id: 'DO_DB_01', kch_id: 'KC_DB', jxbmc: '数据库系统-01', jxbzls: '1', xf: '3', yxzrs: '28', jxbrl: '35', blzyl: '7', blyxrs: '28', sksj: '周一 1-2', jxdd: '一教 101', jsxx: 'T001/陈敏/教授' },
      { jxb_id: 'JXB_DB_02', do_jxb_id: 'DO_DB_02', kch_id: 'KC_DB', jxbmc: '数据库系统-02', jxbzls: '1', xf: '3', yxzrs: '35', jxbrl: '35', blzyl: '0', blyxrs: '35', sksj: '周三 5-6', jxdd: '二教 204', jsxx: 'T002/周航/副教授' }
    ],
    KC_OS: [
      { jxb_id: 'JXB_OS_01', do_jxb_id: 'DO_OS_01', kch_id: 'KC_OS', jxbmc: '操作系统-01', jxbzls: '1', xf: '4', yxzrs: '42', jxbrl: '60', blzyl: '18', blyxrs: '42', sksj: '周二 3-4', jxdd: '三教 305', jsxx: 'T003/李宁/讲师', xxkbj: '1' }
    ],
    KC_AI: [
      { jxb_id: 'JXB_AI_01', do_jxb_id: 'DO_AI_01', kch_id: 'KC_AI', jxbmc: '人工智能导论-01', jxbzls: '2', xf: '2', yxzrs: '20', jxbrl: '50', blzyl: '30', blyxrs: '20', sksj: '周五 7-8', jxdd: '实验楼 B201', jsxx: 'T004/王青/教授' }
    ]
  };
  return {
    courses,
    classes,
    selected: [toSelectedRow({ courses }, classes.KC_OS[0], '0')]
  };
}

function findClassBySubmitId(fixture, submitId) {
  return Object.values(fixture.classes).flat().find((item) => item.do_jxb_id === submitId || item.jxb_id === submitId);
}

function toSelectedRow(fixture, row, qz = '0') {
  const course = fixture.courses.find((item) => item.kch_id === row.kch_id) || {};
  return {
    t_kch_id: row.kch_id,
    kch_id: row.kch_id,
    kch: course.kch,
    kcmc: course.kcmc,
    xf: course.xf || row.xf,
    kklxdm: course.kklxdm || '10',
    cxbj: course.cxbj || '0',
    xxkbj: course.xxkbj || '0',
    jxb_id: row.jxb_id,
    do_jxb_id: row.do_jxb_id,
    jxbmc: row.jxbmc,
    qz,
    sxbj: '0',
    zixf: '1',
    jxbxf: row.xf,
    jsxx: row.jsxx,
    sksj: row.sksj,
    jxdd: row.jxdd,
    sfktk: '1'
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const demoPageHtml = `
  <input id="xkxnm" value="2025">
  <input id="xkxqm" value="12">
  <input id="xkkz_id" value="DEMO_KZ">
  <input id="kklxdm" value="10">
  <input id="kklxmc" value="自主选课">
  <input id="xklc" value="DEMO_LC">
  <input id="njdm_id" value="2024">
  <input id="zyh_id" value="CS">
  <input id="jg_id_1" value="JG">
  <input id="zyfx_id" value="FX">
  <input id="bh_id" value="BH">
  <input id="xz" value="4">
  <input id="ccdm" value="3">
  <input id="xqh_id" value="MAIN">
  <input id="iskxk" value="1">
  <input id="isinxksj" value="1">
  <input id="sfqzxk" value="0">
  <input id="sfyxsksjct" value="1">
  <input id="xkpksjctqrkg" value="1">
  <input id="xksdxjckg" value="0">
`;

await initialize();
