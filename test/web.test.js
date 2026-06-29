import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { courseIdsForDisplayKey, groupCoursesForDisplay } from '../web/course-groups.js';
import packageJson from '../package.json' with { type: 'json' };

test('web frontend files expose the restored course-selection workspace', async () => {
  const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../web/styles.css', import.meta.url), 'utf8');

  assert.match(html, /id="sessionForm"/);
  assert.match(html, /id="cookieInput"/);
  assert.match(html, /id="solveCaptchaBtn"/);
  assert.match(html, /id="filterPanel"/);
  assert.match(html, /id="filterRows"/);
  assert.match(html, /id="courseTypeTabs"/);
  assert.match(html, /当前显示/);
  assert.match(html, /id="resetFiltersBtn"/);
  assert.match(html, /id="courseList"/);
  assert.match(html, /id="chosenPanel"/);
  assert.match(html, /id="selectedScheduleBody"/);
  assert.match(html, /当前已选课程时间分布/);
  assert.match(html, /id="activityLog"/);
  assert.doesNotMatch(html, /Demo 回放/);
  assert.match(app, /createZfxkClient/);
  assert.match(app, /parseCourseTypeOptions/);
  assert.match(app, /groupCoursesForDisplay/);
  assert.match(app, /courseIdsForDisplayKey/);
  assert.match(app, /groupCoursesForDisplay\(state\.courses\)/);
  assert.match(app, /courseIdsForDisplayKey\(state\.courses, courseKey\)/);
  assert.match(app, /bootstrap\(\{ html: state\.entryHtml, raw:/);
  assert.match(app, /ProxyTransport/);
  assert.match(app, /solveCaptchaCookie/);
  assert.match(app, /\/api\/captcha\/solve/);
  assert.match(app, /switchCourseType/);
  assert.match(app, /renderCourseTypeTabs/);
  assert.match(app, /\/api\/proxy\/post/);
  assert.match(app, /loadFilterGroups/);
  assert.match(app, /renderMeetingList/);
  assert.match(app, /parseMeetingTime/);
  assert.match(app, /renderSelectedSchedule/);
  assert.match(app, /selectedScheduleEntries/);
  assert.match(app, /parsePeriodNumbers/);
  assert.match(app, /splitHtmlLines/);
  assert.match(app, /kkbm_id_list/);
  assert.match(app, /skjc_list/);
  assert.match(app, /cxbj_list/);
  assert.match(app, /yl_list/);
  assert.match(app, /queryModel\.showCount/);
  assert.match(app, /\/xkgl\/common_queryKkbmPaged\.html/);
  assert.match(app, /\/xtgl\/comm_cxJcsjList\.html\?lxdm=0036/);
  assert.match(app, /selection\.choose/);
  assert.match(app, /selection\.drop/);
  assert.match(app, /selection\.reorder/);
  assert.doesNotMatch(app, /MemoryTransport/);
  assert.doesNotMatch(app, /createDemoClient/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /course-type-tabs/);
  assert.match(css, /class-card-main/);
  assert.match(css, /class-card-action/);
  assert.match(css, /schedule-grid/);
  assert.match(css, /schedule-course/);
  assert.match(css, /meeting-list/);
  assert.match(css, /meeting-location/);
});

test('web course list groups rows with the same course code', () => {
  const groups = groupCoursesForDisplay([
    { courseId: 'KC1-A', courseCode: 'CS101', name: '数据库', credit: 3, typeCode: '01' },
    { courseId: 'KC1-B', courseCode: 'CS101', name: '数据库', credit: 3, typeCode: '01' },
    { courseId: 'KC2', courseCode: 'CS102', name: '算法', credit: 2, typeCode: '01' }
  ]);

  assert.deepEqual(groups.map((group) => [group.key, group.courseIds]), [
    ['CS101', ['KC1-A', 'KC1-B']],
    ['CS102', ['KC2']]
  ]);
  assert.deepEqual(courseIdsForDisplayKey(groups.flatMap((group) => group.courses), 'CS101'), ['KC1-A', 'KC1-B']);
});

test('web script and static server are wired in package.json', async () => {
  const server = await readFile(new URL('../scripts/serve-web.js', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts.web, 'node scripts/serve-web.js');
  assert.match(server, /createServer/);
  assert.match(server, /web\/index\.html/);
  assert.match(server, /\/api\/proxy\/get/);
  assert.match(server, /\/api\/proxy\/post/);
  assert.match(server, /\/api\/captcha\/solve/);
  assert.match(server, /solveZfCaptcha/);
});
