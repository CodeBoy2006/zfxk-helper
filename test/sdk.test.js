import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createZfxkClient,
  endpoints,
  loadRuntimeContext,
  mapCourse,
  mapTeachingClass,
  normalizeSaveSelection,
  HttpTransport,
  MemoryTransport
} from '../src/index.js';

const html = `
  <input id="xkxnm" value="2025"/>
  <input id="xkxqm" value="12"/>
  <input id="xkkz_id" value="KZ1"/>
  <input id="kklxdm" value="10"/>
  <input id="kklxmc" value="公选课"/>
  <input id="xklc" value="LC1"/>
  <input id="njdm_id" value="2024"/>
  <input id="zyh_id" value="CS"/>
  <input id="jg_id_1" value="JG"/>
  <input id="zyfx_id" value="FX"/>
  <input id="bh_id" value="BH"/>
  <input id="xz" value="4"/>
  <input id="ccdm" value="3"/>
  <input id="xqh_id" value="XQ1"/>
  <input id="iskxk" value="1"/>
  <input id="isinxksj" value="1"/>
  <input id="sfqzxk" value="0"/>
  <input id="sfyxsksjct" value="1"/>
  <input id="xkpksjctqrkg" value="1"/>
  <input id="xksdxjckg" value="1"/>
  <input id="xkydjc" value="1"/>
`;

function makeClient(routes) {
  const transport = new MemoryTransport(routes);
  const client = createZfxkClient({
    baseUrl: 'https://example.edu.cn/jwglxt',
    auth: { type: 'cookie', cookie: 'JSESSIONID=test' },
    transport,
    context: loadRuntimeContext({ baseUrl: 'https://example.edu.cn/jwglxt', html })
  });
  return { client, transport };
}

test('exports endpoint paths matching the original JS workflow', () => {
  assert.equal(endpoints.coursePage, '/xsxk/zzxkyzb_cxZzxkYzbPartDisplay.html');
  assert.equal(endpoints.teachingClasses, '/xsxk/zzxkyzbjk_cxJxbWithKchZzxkYzb.html');
  assert.equal(endpoints.titleCheck, '/xsxk/zzxkyzb_cxXkTitleMsg.html');
  assert.equal(endpoints.conflictCheck, '/xsxk/zzxkyzb_cxCtKcZyZzxkYzb.html');
  assert.equal(endpoints.saveSelection, '/xsxk/zzxkyzbjk_xkBcZyZzxkYzb.html');
  assert.equal(endpoints.dropSelection, '/xsxk/zzxkyzb_tuikBcZzxkYzb.html');
});

test('loads runtime context from hidden fields', () => {
  const ctx = loadRuntimeContext({ baseUrl: 'https://example.edu.cn/jwglxt', html });

  assert.equal(ctx.term.xkxnm, '2025');
  assert.equal(ctx.term.xkxqm, '12');
  assert.equal(ctx.current.xkkzId, 'KZ1');
  assert.equal(ctx.current.kklxdm, '10');
  assert.equal(ctx.student.zyhId, 'CS');
  assert.equal(ctx.student.njdmId, '2024');
  assert.equal(ctx.switches.canSelect, true);
  assert.equal(ctx.switches.useWeight, false);
  assert.equal(ctx.switches.enableTextbook, true);
});

test('loads initial course-type context from first hidden fields before page scripts run', () => {
  const initialPageHtml = `
    <input id="xkxnm" value="2025"/>
    <input id="xkxqm" value="12"/>
    <input id="xkkz_id" value=""/>
    <input id="kklxdm" value=""/>
    <input id="kklxmc" value=""/>
    <input id="xkkz_xh" value=""/>
    <input id="njdm_id" value=""/>
    <input id="zyh_id" value=""/>
    <input id="firstXkkzId" value="KZ_FIRST"/>
    <input id="firstKklxdm" value="10"/>
    <input id="firstKklxmc" value="自主选课"/>
    <input id="firstXkkzXh" value="3"/>
    <input id="firstNjdmId" value="2024"/>
    <input id="firstZyhId" value="CS"/>
  `;

  const ctx = loadRuntimeContext({ baseUrl: 'https://example.edu.cn/jwglxt', html: initialPageHtml });

  assert.equal(ctx.current.xkkzId, 'KZ_FIRST');
  assert.equal(ctx.current.kklxdm, '10');
  assert.equal(ctx.current.kklxmc, '自主选课');
  assert.equal(ctx.current.xkkzXh, '3');
  assert.equal(ctx.student.njdmId, '2024');
  assert.equal(ctx.student.zyhId, 'CS');
});

test('bootstrapFromPage fetches an authenticated page and parses hidden context', async () => {
  const transport = new MemoryTransport({
    '/xsxk/index.html': html
  });
  const client = createZfxkClient({
    baseUrl: 'https://example.edu.cn/jwglxt',
    auth: { type: 'cookie', cookie: 'JSESSIONID=test' },
    transport
  });

  const context = await client.bootstrapFromPage({ path: '/xsxk/index.html' });

  assert.equal(context.current.xkkzId, 'KZ1');
  assert.equal(context.term.xkxnm, '2025');
  assert.equal(context.student.zyhId, 'CS');
  assert.equal(transport.calls[0].method, 'GET');
  assert.equal(transport.calls[0].path, '/xsxk/index.html');
});

test('bootstrapFromPage rejects pages that do not contain selection context', async () => {
  const transport = new MemoryTransport({
    '/xsxk/index.html': '<html><title>login</title></html>'
  });
  const client = createZfxkClient({
    baseUrl: 'https://example.edu.cn/jwglxt',
    auth: { type: 'cookie', cookie: 'JSESSIONID=expired' },
    transport
  });

  await assert.rejects(
    () => client.bootstrapFromPage({ path: '/xsxk/index.html' }),
    /CONTEXT_NOT_FOUND/
  );
});

test('HttpTransport.get sends cookie auth and returns page HTML', async () => {
  const calls = [];
  const transport = new HttpTransport({
    baseUrl: 'https://example.edu.cn/jwglxt',
    auth: { type: 'cookie', cookie: 'JSESSIONID=test' },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response('<input id="xkxnm" value="2025">', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=UTF-8' }
      });
    }
  });

  const page = await transport.get('/xsxk/index.html');

  assert.equal(page, '<input id="xkxnm" value="2025">');
  assert.equal(calls[0].url, 'https://example.edu.cn/jwglxt/xsxk/index.html');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers.cookie, 'JSESSIONID=test');
});

test('maps course and teaching-class rows into SDK models', () => {
  const course = mapCourse({
    kch_id: 'KC1',
    kch: 'CS101',
    kcmc: '数据库',
    xf: '3.0',
    kklxdm: '10',
    kklxmc: '公选课',
    cxbj: '0',
    xxkbj: '1',
    sftj: '1'
  });
  const teachingClass = mapTeachingClass({
    jxb_id: 'JXB1',
    do_jxb_id: 'DO1',
    kch_id: 'KC1',
    jxbmc: '数据库-01',
    jxbzls: '1',
    xf: '3.0',
    yxzrs: '29',
    jxbrl: '30',
    blzyl: '10',
    blyxrs: '3',
    sksj: '周一1-2',
    jxdd: '一教101',
    jsxx: 'T1/张三/教授;T2/李四/讲师'
  });

  assert.deepEqual(
    {
      courseId: course.courseId,
      name: course.name,
      credit: course.credit,
      hasPrerequisiteHint: course.hasPrerequisiteHint,
      recommended: course.recommended
    },
    {
      courseId: 'KC1',
      name: '数据库',
      credit: 3,
      hasPrerequisiteHint: true,
      recommended: true
    }
  );
  assert.equal(teachingClass.classId, 'JXB1');
  assert.equal(teachingClass.submitClassId, 'DO1');
  assert.equal(teachingClass.selectedCount, 29);
  assert.equal(teachingClass.capacity, 30);
  assert.equal(teachingClass.flags.full, false);
  assert.equal(teachingClass.teachers[1].name, '李四');
});

test('searchCourses and getTeachingClasses post context-rich requests', async () => {
  const { client, transport } = makeClient({
    [endpoints.coursePage]: {
      tmpList: [
        { kch_id: 'KC1', kch: 'CS101', kcmc: '数据库', xf: '3', kklxdm: '10', cxbj: '0', xxkbj: '0' }
      ],
      sfxsjc: '0'
    },
    [endpoints.teachingClasses]: [
      { jxb_id: 'JXB1', do_jxb_id: 'DO1', kch_id: 'KC1', jxbmc: '数据库-01', jxbzls: '1', xf: '3', yxzrs: '5', jxbrl: '10' }
    ]
  });

  const courses = await client.catalog.searchCourses({ keyword: '数据库', page: { start: 1, size: 20 } });
  const classes = await client.catalog.getTeachingClasses('KC1');

  assert.equal(courses[0].courseId, 'KC1');
  assert.equal(classes[0].submitClassId, 'DO1');
  assert.equal(transport.calls[0].path, endpoints.coursePage);
  assert.equal(transport.calls[0].data.xkkz_id, 'KZ1');
  assert.equal(transport.calls[0].data.kklxdm, '10');
  assert.equal(transport.calls[0].data.xkxnm, '2025');
  assert.equal(transport.calls[0].data.kspage, 1);
  assert.equal(transport.calls[0].data.jspage, 20);
  assert.equal(transport.calls[0].data.searchInput, '数据库');
  assert.equal(transport.calls[1].path, endpoints.teachingClasses);
  assert.equal(transport.calls[1].data.kch_id, 'KC1');
});

test('chosen.snapshot groups selected classes by course and builds indexes', async () => {
  const { client } = makeClient({
    [endpoints.chosenDisplay]: [
      {
        t_kch_id: 'KC1',
        kch_id: 'KC1',
        kch: 'CS101',
        kcmc: '数据库',
        xf: '3',
        kklxdm: '10',
        cxbj: '0',
        jxb_id: 'JXB1',
        do_jxb_id: 'DO1',
        jxbmc: '数据库-01',
        qz: '0',
        sxbj: '1',
        zixf: '1',
        jxbxf: '3',
        jsxx: 'T1/张三/教授',
        sksj: '周一1-2',
        jxdd: '一教101'
      }
    ]
  });

  const snapshot = await client.chosen.snapshot();

  assert.equal(snapshot.selectedCourses.length, 1);
  assert.equal(snapshot.selectedClasses.length, 1);
  assert.equal(snapshot.totals.courseCount, 1);
  assert.equal(snapshot.totals.credit, 3);
  assert.equal(snapshot.byCourseId.get('KC1').classes[0].classId, 'JXB1');
  assert.equal(snapshot.byClassId.get('JXB1').submitClassId, 'DO1');
});

test('selection.choose runs title, conflict, textbook, save, and snapshot refresh', async () => {
  const { client, transport } = makeClient({
    [endpoints.teachingClasses]: [
      { jxb_id: 'JXB1', do_jxb_id: 'DO1', kch_id: 'KC1', jxbmc: '数据库-01', jxbzls: '1', xf: '3', yxzrs: '1', jxbrl: '20' }
    ],
    [endpoints.chosenDisplay]: [
      {
        t_kch_id: 'KC1',
        kch_id: 'KC1',
        kch: 'CS101',
        kcmc: '数据库',
        xf: '3',
        kklxdm: '10',
        cxbj: '0',
        jxb_id: 'JXB1',
        do_jxb_id: 'DO1',
        jxbmc: '数据库-01',
        qz: '0',
        sxbj: '1',
        zixf: '1',
        jxbxf: '3'
      }
    ]
  });
  transport.queue(endpoints.titleCheck, { flag: '1' });
  transport.queue(endpoints.titleCheck, { flag: '2', msg: '排考冲突，是否继续？' });
  transport.queue(endpoints.conflictCheck, { flag: '1' });
  transport.queue(endpoints.textbookCheck, '1');
  transport.queue(endpoints.saveSelection, { flag: '1' });

  const result = await client.selection.choose(
    { courseId: 'KC1', classId: 'JXB1' },
    {
      confirm: async () => true,
      chooseTextbooks: async () => ['JC1', 'JC2']
    }
  );

  assert.equal(result.status, 'selected');
  assert.equal(result.snapshot.byClassId.has('JXB1'), true);
  assert.deepEqual(
    transport.calls.map((call) => call.path),
    [
      endpoints.teachingClasses,
      endpoints.titleCheck,
      endpoints.titleCheck,
      endpoints.conflictCheck,
      endpoints.textbookCheck,
      endpoints.saveSelection,
      endpoints.chosenDisplay
    ]
  );
  assert.equal(transport.calls[1].data.bj, '7');
  assert.equal(transport.calls[2].data.bj, '9');
  assert.equal(transport.calls[5].data.jxb_ids, 'DO1');
  assert.equal(transport.calls[5].data.jcxx_id, 'JC1,JC2');
});

test('selection.choose returns capacity-full from save flag -1', async () => {
  const { client, transport } = makeClient({
    [endpoints.teachingClasses]: [
      { jxb_id: 'JXB1', do_jxb_id: 'DO1', kch_id: 'KC1', jxbmc: '数据库-01', jxbzls: '1', xf: '3', yxzrs: '1', jxbrl: '20' }
    ]
  });
  transport.queue(endpoints.titleCheck, { flag: '1' });
  transport.queue(endpoints.titleCheck, { flag: '1' });
  transport.queue(endpoints.conflictCheck, { flag: '1' });
  transport.queue(endpoints.textbookCheck, '0');
  transport.queue(endpoints.saveSelection, { flag: '-1', msg: '0,JXB1,20,20' });

  const result = await client.selection.choose({ courseId: 'KC1', classId: 'JXB1' });

  assert.equal(result.status, 'capacity-full');
  assert.equal(result.waitlistAvailable, true);
});

test('selection.drop supports confirm and SMS flows before refreshing snapshot', async () => {
  const { client, transport } = makeClient({
    [endpoints.chosenDisplay]: []
  });
  client.context.raw.tkzgcs_jb = '1';
  client.context.raw.tkdxyzms = '1';
  transport.queue(endpoints.cancelTitleCheck, { flag: '1', msg: '确认退课？' });
  transport.queue(endpoints.cancelInTimeCheck, '1');
  transport.queue(endpoints.smsVerify, '1');
  transport.queue(endpoints.dropSelection, '1');

  const result = await client.selection.drop(
    { courseId: 'KC1', classId: 'JXB1', submitClassId: 'DO1', controlId: 'KZ1' },
    {
      confirm: async () => true,
      smsCode: async () => '123456'
    }
  );

  assert.equal(result.status, 'dropped');
  assert.equal(transport.calls[0].path, endpoints.cancelTitleCheck);
  assert.equal(transport.calls[0].data.jxb_id, 'DO1');
  assert.equal(transport.calls[2].data.dxyzm, '123456');
  assert.equal(transport.calls[3].data.jxb_ids, 'DO1');
});

test('reorder posts ordinary wish order and refreshes snapshot', async () => {
  const { client, transport } = makeClient({
    [endpoints.saveOrder]: 'success',
    [endpoints.chosenDisplay]: []
  });

  const snapshot = await client.selection.reorder({ classIds: ['JXB2', 'JXB1'] });

  assert.equal(snapshot.selectedClasses.length, 0);
  assert.equal(transport.calls[0].data.zypxs, '1,2');
  assert.equal(transport.calls[0].data.jxb_ids, 'JXB2,JXB1');
});

test('normalizes save-selection flags into SDK-readable results', () => {
  assert.deepEqual(normalizeSaveSelection({ flag: '1' }), { ok: true, status: 'selected', raw: { flag: '1' } });
  assert.equal(normalizeSaveSelection({ flag: '-1', msg: 'full' }).code, 'CAPACITY_FULL');
  assert.equal(normalizeSaveSelection({ flag: '2', msg: 'conflict' }).code, 'CONFLICT');
});
