import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import packageJson from '../package.json' with { type: 'json' };

test('web frontend files expose the restored course-selection workspace', async () => {
  const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../web/styles.css', import.meta.url), 'utf8');

  assert.match(html, /id="sessionForm"/);
  assert.match(html, /id="cookieInput"/);
  assert.match(html, /id="filterPanel"/);
  assert.match(html, /id="filterRows"/);
  assert.match(html, /id="courseTypeTabs"/);
  assert.match(html, /当前显示/);
  assert.match(html, /id="resetFiltersBtn"/);
  assert.match(html, /id="courseList"/);
  assert.match(html, /id="chosenPanel"/);
  assert.match(html, /id="activityLog"/);
  assert.doesNotMatch(html, /Demo 回放/);
  assert.match(app, /createZfxkClient/);
  assert.match(app, /parseCourseTypeOptions/);
  assert.match(app, /bootstrap\(\{ html: state\.entryHtml, raw:/);
  assert.match(app, /ProxyTransport/);
  assert.match(app, /switchCourseType/);
  assert.match(app, /renderCourseTypeTabs/);
  assert.match(app, /\/api\/proxy\/post/);
  assert.match(app, /loadFilterGroups/);
  assert.match(app, /renderMeetingList/);
  assert.match(app, /parseMeetingTime/);
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
  assert.match(css, /meeting-list/);
  assert.match(css, /meeting-location/);
});

test('web script and static server are wired in package.json', async () => {
  const server = await readFile(new URL('../scripts/serve-web.js', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts.web, 'node scripts/serve-web.js');
  assert.match(server, /createServer/);
  assert.match(server, /web\/index\.html/);
  assert.match(server, /\/api\/proxy\/get/);
  assert.match(server, /\/api\/proxy\/post/);
});
