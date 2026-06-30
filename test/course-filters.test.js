import assert from 'node:assert/strict';
import test from 'node:test';

import { applyLocalCourseFilters, splitFilterPayload } from '../web/course-filters.js';
import * as courseGroups from '../web/course-groups.js';

test('web course filters split local and remote payloads by definition mode', () => {
  const result = splitFilterPayload([
    { key: 'cxbj_list', mode: 'local' },
    { key: 'kcgs_list', mode: 'hybrid' },
    { key: 'jg_id_list', mode: 'remote' },
    { key: 'zyh_id_list' }
  ], {
    cxbj_list: '0',
    kcgs_list: 'RW',
    jg_id_list: 'COLLEGE1',
    zyh_id_list: 'MAJOR1',
    empty_local: ''
  });

  assert.deepEqual(result.local, { cxbj_list: '0', kcgs_list: 'RW' });
  assert.deepEqual(result.remote, { jg_id_list: 'COLLEGE1', zyh_id_list: 'MAJOR1' });
});

test('web course filters apply keyword and local course fields without remote search', () => {
  const courses = [
    {
      courseId: 'KC1',
      courseCode: 'CS101',
      name: '数据库',
      ownershipCode: 'RW',
      ownershipName: '人文社科',
      retake: false,
      raw: { jxbmc: '数据库-0001' }
    },
    {
      courseId: 'KC2',
      courseCode: 'CS102',
      name: '算法',
      ownershipCode: 'YS',
      ownershipName: '艺术修养',
      retake: false,
      raw: { jxbmc: '算法-0001' }
    },
    {
      courseId: 'KC3',
      courseCode: 'CS103',
      name: '数据库重修',
      ownershipCode: 'RW',
      ownershipName: '人文社科',
      retake: true,
      raw: { jxbmc: '数据库-重修' }
    }
  ];

  const filtered = applyLocalCourseFilters(courses, {
    keyword: '数据',
    filters: {
      cxbj_list: '0',
      kcgs_list: 'RW'
    }
  });

  assert.deepEqual(filtered.map((course) => course.courseId), ['KC1']);
});

test('web teaching classes are constrained to filtered PE course rows', () => {
  const filteredCourseRows = [
    {
      courseId: '13861',
      courseCode: '413001',
      name: '体育',
      raw: {
        jxb_id: 'JXB-TENNIS',
        do_jxb_id: 'DO-TENNIS',
        jxbmc: '网球初级混-陈芳芳周一67屏'
      }
    }
  ];
  const classes = [
    { classId: 'JXB-TENNIS', submitClassId: 'DO-TENNIS', courseId: '13861', raw: { jxb_id: 'JXB-TENNIS' } },
    { classId: 'JXB-BASKETBALL', submitClassId: 'DO-BASKETBALL', courseId: '13861', raw: { jxb_id: 'JXB-BASKETBALL' } },
    { classId: 'JXB-BADMINTON', submitClassId: 'DO-BADMINTON', courseId: '13861', raw: { jxb_id: 'JXB-BADMINTON' } }
  ];

  assert.equal(typeof courseGroups.filterTeachingClassesByCourseRows, 'function');

  const filtered = courseGroups.filterTeachingClassesByCourseRows(classes, filteredCourseRows, ['13861']);

  assert.deepEqual(filtered.map((item) => item.classId), ['JXB-TENNIS']);
});
