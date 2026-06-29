import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { courseIdsForDisplayKey, groupCoursesForDisplay, teachingClassNamesById } from '../web/course-groups.js';
import { loadAllCoursePages } from '../web/course-pages.js';
import { buildScheduleBlocks, colorScheduleEntries, scheduleSlotKey } from '../web/schedule-layout.js';
import packageJson from '../package.json' with { type: 'json' };

test('web frontend files expose the restored course-selection workspace', async () => {
  const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../web/styles.css', import.meta.url), 'utf8');

  assert.match(html, /id="sessionForm"/);
  assert.match(html, /id="cookieInput"/);
  assert.match(html, /id="usernameInput"/);
  assert.match(html, /id="passwordInput"/);
  assert.match(html, /id="loginWithCaptchaBtn"/);
  assert.match(html, /id="solveCaptchaBtn"/);
  assert.match(html, /id="filterPanel"/);
  assert.match(html, /id="filterRows"/);
  assert.match(html, /id="courseTypeTabs"/);
  assert.match(html, /当前显示/);
  assert.match(html, /id="resetFiltersBtn"/);
  assert.match(html, /id="courseList"/);
  assert.match(html, /id="courseTotalBadge"/);
  assert.match(html, /id="catalogSearchBtn"/);
  assert.match(html, /id="classSortBtn"/);
  assert.match(html, /id="chosenPanel"/);
  assert.match(html, /id="selectedScheduleBody"/);
  assert.match(html, /当前已选课程时间分布/);
  assert.match(html, /id="activityLog"/);
  assert.doesNotMatch(html, /Demo 回放/);
  assert.match(app, /createZfxkClient/);
  assert.match(app, /parseCourseTypeOptions/);
  assert.doesNotMatch(app, /from '..\/src\/index\.js'/);
  assert.doesNotMatch(app, /node:/);
  assert.match(app, /groupCoursesForDisplay/);
  assert.match(app, /courseIdsForDisplayKey/);
  assert.match(app, /teachingClassNamesById/);
  assert.match(app, /groupCoursesForDisplay\(state\.courses\)/);
  assert.match(app, /courseIdsForDisplayKey\(state\.courses, courseKey\)/);
  assert.match(app, /bootstrap\(\{ html: state\.entryHtml, raw:/);
  assert.match(app, /ProxyTransport/);
  assert.match(app, /loginWithCaptchaCookie/);
  assert.match(app, /\/api\/login\/zfcaptcha/);
  assert.match(app, /solveCaptchaCookie/);
  assert.match(app, /\/api\/captcha\/solve/);
  assert.match(app, /SESSION_STORAGE_KEY/);
  assert.match(app, /restoreSessionCache/);
  assert.match(app, /persistSessionCache/);
  assert.match(app, /localStorage/);
  assert.match(app, /switchCourseType/);
  assert.match(app, /renderCourseTypeTabs/);
  assert.match(app, /\/api\/proxy\/post/);
  assert.match(app, /loadFilterGroups/);
  assert.match(app, /enrichCourseOwnerships/);
  assert.match(app, /inheritCourseOwnership/);
  assert.match(app, /课程归属：/);
  assert.match(app, /renderMeetingList/);
  assert.match(app, /raw\?\.jxbmc/);
  assert.match(app, /class-name-value/);
  assert.doesNotMatch(app, /教学班待定/);
  assert.doesNotMatch(app, /detail-label/);
  assert.doesNotMatch(app, /renderClassTitle/);
  assert.match(app, /parseMeetingTime/);
  assert.match(app, /renderSelectedSchedule/);
  assert.match(app, /buildSelectedScheduleLayout/);
  assert.match(app, /selectedScheduleEntries/);
  assert.match(app, /colorScheduleEntries/);
  assert.match(app, /buildScheduleBlocks/);
  assert.match(app, /parsePeriodNumbers/);
  assert.match(app, /splitHtmlLines/);
  assert.match(app, /kkbm_id_list/);
  assert.match(app, /kcgs_list/);
  assert.match(app, /skjc_list/);
  assert.match(app, /cxbj_list/);
  assert.match(app, /yl_list/);
  assert.match(app, /queryModel\.showCount/);
  assert.match(app, /\/xkgl\/common_queryKkbmPaged\.html/);
  assert.match(app, /\/xtgl\/comm_cxJcsjList\.html\?lxdm=0036/);
  assert.match(app, /selection\.choose/);
  assert.match(app, /selection\.drop/);
  assert.match(app, /selection\.reorder/);
  assert.match(app, /draggable = true/);
  assert.match(app, /dragstart/);
  assert.match(app, /moveSelectedClass/);
  assert.match(app, /拖动调整顺序/);
  assert.doesNotMatch(app, /moveSelectedClassByOffset/);
  assert.doesNotMatch(app, /上移一位|下移一位/);
  assert.doesNotMatch(css, /reorder-button/);
  assert.match(css, /chosen-card\.dragging/);
  assert.doesNotMatch(app, /MemoryTransport/);
  assert.doesNotMatch(app, /createDemoClient/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /course-type-tabs/);
  assert.match(css, /class-card-main/);
  assert.match(css, /class-card-action/);
  assert.match(css, /schedule-grid/);
  assert.match(css, /course-ownership-value/);
  assert.match(css, /schedule-course/);
  assert.match(css, /meeting-list/);
  assert.match(css, /meeting-location/);
  assert.match(css, /\.catalog-pane,\s*\.detail-pane,\s*\.chosen-pane\s*\{[^}]*height:\s*100vh/s);
  assert.match(css, /\.catalog-pane,\s*\.detail-pane,\s*\.chosen-pane\s*\{[^}]*max-height:\s*100vh/s);
  assert.match(css, /\.course-list,\s*\.class-list,\s*\.chosen-list\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.course-list,\s*\.class-list,\s*\.chosen-list\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(css, /\.course-list,\s*\.class-list,\s*\.chosen-list\s*\{[^}]*flex:\s*1 1 auto/s);
  assert.match(css, /\.course-list,\s*\.class-list,\s*\.chosen-list\s*\{[^}]*max-height:\s*none/s);
  assert.match(css, /\.course-list,\s*\.class-list,\s*\.chosen-list\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.course-card,\s*\.class-card,\s*\.chosen-card\s*\{[^}]*flex:\s*0 0 auto/s);
  assert.doesNotMatch(css, /class-title-row/);
});

test('selected schedule layout merges continuous periods and avoids adjacent duplicate colors', () => {
  const colored = colorScheduleEntries([
    { courseKey: 'A', day: '星期一', periods: [1, 2], courseName: '数据结构', periodText: '第1-2节' },
    { courseKey: 'B', day: '星期一', periods: [3, 4], courseName: '概率论', periodText: '第3-4节' },
    { courseKey: 'A', day: '星期三', periods: [1, 2], courseName: '数据结构', periodText: '第1-2节' }
  ]);

  assert.notEqual(colored[0].colorIndex, colored[1].colorIndex);
  assert.equal(colored[0].colorIndex, colored[2].colorIndex);

  const layout = buildScheduleBlocks(colored, {
    weekdays: ['星期一', '星期三'],
    periods: [1, 2, 3, 4]
  });
  const firstBlock = layout.blocksByStart.get(scheduleSlotKey('星期一', 1));
  const secondBlock = layout.blocksByStart.get(scheduleSlotKey('星期一', 3));

  assert.equal(firstBlock.rowSpan, 2);
  assert.equal(firstBlock.entries[0].courseName, '数据结构');
  assert.equal(secondBlock.rowSpan, 2);
  assert.equal(layout.coveredKeys.has(scheduleSlotKey('星期一', 2)), true);
  assert.equal(layout.coveredKeys.has(scheduleSlotKey('星期一', 4)), true);

  const splitSinglePeriodLayout = buildScheduleBlocks(colorScheduleEntries([
    { courseKey: 'C', day: '星期二', periods: [1], courseName: '嵌入式', periodText: '第1节', location: 'A101' },
    { courseKey: 'C', day: '星期二', periods: [2], courseName: '嵌入式', periodText: '第2节', location: 'A101' }
  ]), {
    weekdays: ['星期二'],
    periods: [1, 2]
  });
  assert.equal(splitSinglePeriodLayout.blocksByStart.get(scheduleSlotKey('星期二', 1)).rowSpan, 2);
});

test('web course list groups rows with the same course code', () => {
  const groups = groupCoursesForDisplay([
    { courseId: 'KC1-A', courseCode: 'CS101', name: '数据库', credit: 3, typeCode: '01', ownershipName: '人文社科' },
    { courseId: 'KC1-B', courseCode: 'CS101', name: '数据库', credit: 3, typeCode: '01', ownershipName: '自然科学' },
    { courseId: 'KC2', courseCode: 'CS102', name: '算法', credit: 2, typeCode: '01' }
  ]);

  assert.deepEqual(groups.map((group) => [group.key, group.courseIds]), [
    ['CS101', ['KC1-A', 'KC1-B']],
    ['CS102', ['KC2']]
  ]);
  assert.equal(groups[0].ownershipName, '人文社科、自然科学');
  assert.deepEqual(courseIdsForDisplayKey(groups.flatMap((group) => group.courses), 'CS101'), ['KC1-A', 'KC1-B']);
});

test('web teaching-class names are restored from course-list jxbmc rows', () => {
  const names = teachingClassNamesById([
    { courseId: 'KC1', raw: { jxb_id: 'JXB1', jxbmc: '数据库-0001' } },
    { courseId: 'KC1', raw: { do_jxb_id: 'DO2', jxbmc: '数据库-0002' } },
    { courseId: 'KC2', raw: { jxb_id: 'JXB3', jxbmc: '算法-0001' } }
  ], ['KC1']);

  assert.equal(names.get('JXB1'), '数据库-0001');
  assert.equal(names.get('DO2'), '数据库-0002');
  assert.equal(names.has('JXB3'), false);
});

test('web course search loads broad source row ranges until exhausted', async () => {
  const calls = [];
  const catalog = {
    async searchCourses(query) {
      calls.push(query.page);
      if (calls.length === 1) {
        return [
          { courseId: 'KC1', raw: { kcrow: '1' } },
          { courseId: 'KC1000', raw: { kcrow: '1000' } }
        ];
      }
      if (calls.length === 2) {
        return [
          { courseId: 'KC1001', raw: { kcrow: '1001' } },
          { courseId: 'KC1200', raw: { kcrow: '1200' } }
        ];
      }
      throw new Error('unexpected extra course page');
    }
  };

  const courses = await loadAllCoursePages(catalog, {
    keyword: '数据库',
    extra: { yl_list: '1' }
  });

  assert.deepEqual(calls, [
    { start: 1, size: 1000 },
    { start: 1001, size: 2000 }
  ]);
  assert.deepEqual(courses.map((course) => course.courseId), ['KC1', 'KC1000', 'KC1001', 'KC1200']);
});

test('web script and static server are wired in package.json', async () => {
  const server = await readFile(new URL('../scripts/serve-web.js', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts.web, 'node scripts/serve-web.js');
  assert.match(server, /createServer/);
  assert.match(server, /web\/index\.html/);
  assert.match(server, /\/api\/proxy\/get/);
  assert.match(server, /\/api\/proxy\/post/);
  assert.match(server, /\/api\/captcha\/solve/);
  assert.match(server, /\/api\/login\/zfcaptcha/);
  assert.match(server, /loginWithZfCaptcha/);
  assert.match(server, /solveZfCaptcha/);
});
