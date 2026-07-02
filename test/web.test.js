import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { courseIdsForDisplayKey, groupCoursesForDisplay, teachingClassCourseNamesById, teachingClassNamesById } from '../web/course-groups.js';
import { buildCoursesForExport } from '../web/export-builders.js';
import { buildCourseExport, buildSelectedCoursesExport } from '../web/export-data.js';
import { loadAllCoursePages } from '../web/course-pages.js';
import { withRetry } from '../web/retry.js';
import { buildScheduleBlocks, colorScheduleEntries, scheduleSlotKey } from '../web/schedule-layout.js';
import packageJson from '../package.json' with { type: 'json' };

test('web frontend files expose the restored course-selection workspace', async () => {
  const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  const sessionConfig = await readFile(new URL('../web/session-config.js', import.meta.url), 'utf8');
  const exportBuilders = await readFile(new URL('../web/export-builders.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../web/styles.css', import.meta.url), 'utf8');
  const server = await readFile(new URL('../scripts/serve-web.js', import.meta.url), 'utf8');

  assert.match(html, /<title>正方选课助手<\/title>/);
  assert.match(html, /<h1>正方选课助手<\/h1>/);
  assert.doesNotMatch(html, /id="sessionForm"/);
  assert.doesNotMatch(html, /id="cookieInput"/);
  assert.doesNotMatch(html, /id="usernameInput"/);
  assert.doesNotMatch(html, /id="passwordInput"/);
  assert.doesNotMatch(html, /id="loginWithCaptchaBtn"/);
  assert.doesNotMatch(html, /id="solveCaptchaBtn"/);
  assert.match(html, /id="configLink"/);
  assert.match(html, /href="\/setup\?next=\/"/);
  assert.doesNotMatch(html, /session-config-link/);
  assert.doesNotMatch(html, />修改配置</);
  assert.match(html, /当前配置/);
  assert.doesNotMatch(html, /保存配置/);
  assert.doesNotMatch(html, /主页面会自动使用保存的 Base URL/);
  assert.match(html, /id="sessionConfigSummary"/);
  assert.match(html, /id="reinitializeSessionBtn"/);
  assert.match(html, /id="filterPanel"/);
  assert.match(html, /id="filterRows"/);
  assert.match(html, /id="courseTypeTabs"/);
  assert.match(html, /当前显示/);
  assert.doesNotMatch(html, /初始化后显示可切换类型/);
  assert.match(html, /id="resetFiltersBtn"/);
  assert.match(html, /id="courseList"/);
  assert.match(html, /id="courseTotalBadge"/);
  assert.match(html, /id="catalogSearchBtn"/);
  assert.match(html, /id="classSortSelect"/);
  assert.match(html, /已选人数排序/);
  assert.match(html, /时间（每日）排序/);
  assert.match(html, /星期排序/);
  assert.match(html, /id="chosenPanel"/);
  assert.match(html, /id="selectedScheduleBody"/);
  assert.match(html, /当前已选课程时间分布/);
  assert.match(html, /id="exportCoursesBtn"/);
  assert.match(html, /id="exportSelectedBtn"/);
  assert.match(html, /<aside class="catalog-pane"[\s\S]*id="exportCoursesBtn"/);
  assert.match(html, /<aside id="chosenPanel"[\s\S]*id="exportSelectedBtn"/);
  assert.doesNotMatch(html.match(/<div class="topbar-actions">([\s\S]*?)<\/div>/)?.[1] ?? '', /exportCoursesBtn|exportSelectedBtn/);
  assert.match(html, /id="activityLog"/);
  assert.match(html, /id="autoSelectionLink"/);
  assert.match(html, /href="\/auto-selection"/);
  assert.match(html, /自动抢课页面/);
  assert.doesNotMatch(html, /id="autoSelectionPanel"/);
  assert.doesNotMatch(html, /id="autoGroupTabs"/);
  assert.doesNotMatch(html, /id="autoTargetList"/);
  assert.doesNotMatch(html, /id="autoTaskStatusPanel"/);
  assert.doesNotMatch(html, /id="autoEventLog"/);
  assert.doesNotMatch(html, /id="autoExportConfigBtn"/);
  assert.doesNotMatch(html, /id="autoImportConfigInput"/);
  assert.doesNotMatch(html, /Demo 回放/);
  assert.match(server, /AutoSelectionTaskManager/);
  assert.match(server, /正方选课助手 web frontend/);
  assert.match(server, /\/api\/auto-selection\/tasks/);
  assert.match(server, /\/api\/auto-selection\/config\/validate/);
  assert.match(server, /\/api\/auto-selection\/config\/import/);
  assert.match(server, /handleAutoSelection/);
  assert.match(app, /createZfxkClient/);
  assert.doesNotMatch(app, /autoSelectionDraft/);
  assert.doesNotMatch(app, /addClassToAutoSelection/);
  assert.doesNotMatch(app, /pollAutoSelectionTasks/);
  assert.doesNotMatch(app, /\/api\/auto-selection\/tasks/);
  assert.doesNotMatch(app, /\/api\/auto-selection\/config\/import/);
  assert.doesNotMatch(app, /textContent = '加入自动选课'/);
  assert.match(app, /buildCourseExport/);
  assert.match(app, /buildSelectedCoursesExport/);
  assert.match(app, /buildCoursesForExport/);
  assert.match(app, /downloadJson/);
  assert.match(app, /zhengfang-selection-assistant-courses/);
  assert.match(app, /zhengfang-selection-assistant-selected/);
  assert.match(exportBuilders, /withRetry/);
  assert.match(exportBuilders, /sourceCourseRowCount/);
  assert.match(app, /parseCourseTypeOptions/);
  assert.doesNotMatch(app, /from '..\/src\/index\.js'/);
  assert.doesNotMatch(app, /node:/);
  assert.match(app, /groupCoursesForDisplay/);
  assert.match(app, /courseIdsForDisplayKey/);
  assert.match(app, /teachingClassNamesById/);
  assert.match(app, /teachingClassCourseNamesById/);
  assert.match(app, /groupCoursesForDisplay\(state\.courses\)/);
  assert.match(app, /courseIdsForDisplayKey\(state\.courses, courseKey\)/);
  assert.match(app, /loadCourseTypeDisplayContext\(\{ html: state\.entryHtml, raw:/);
  assert.match(app, /allowFallback:\s*true/);
  assert.match(app, /ProxyTransport/);
  assert.match(app, /requireSessionConfig\('\/'\)/);
  assert.match(app, /ensureSessionCookie/);
  assert.match(app, /\/api\/login\/zfcaptcha/);
  assert.match(app, /writeSessionConfig/);
  assert.match(app, /state\.sessionConfig/);
  assert.doesNotMatch(app, /loginWithCaptchaCookie/);
  assert.doesNotMatch(app, /solveCaptchaCookie/);
  assert.doesNotMatch(app, /restoreSessionCache/);
  assert.doesNotMatch(app, /persistSessionCache/);
  assert.doesNotMatch(app, /course-type-placeholder/);
  assert.doesNotMatch(app, /初始化后显示可切换类型/);
  assert.match(sessionConfig, /SESSION_STORAGE_KEY/);
  assert.match(sessionConfig, /zfxk\.web\.session\.v1/);
  assert.match(sessionConfig, /requireSessionConfig/);
  assert.match(sessionConfig, /\/setup\?next=/);
  assert.match(app, /AUTO_SELECTION_DRAFT_STORAGE_KEY/);
  assert.match(app, /DEFAULT_AUTO_GROUP_NAME = '默认'/);
  assert.match(app, /renderAutoClassMenu/);
  assert.match(app, /addTeachingClassToAutoGroup/);
  assert.match(app, /courseType:\s*currentCourseTypeContext\(\)/);
  assert.match(app, /auto-class-button/);
  assert.match(app, /textContent = '加入抢课'/);
  assert.match(app, /auto-class-menu-heading/);
  assert.match(app, /switchCourseType/);
  assert.match(app, /loadCourseTypeDisplayContext/);
  assert.match(app, /allowFallback:\s*true/);
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
  assert.match(app, /sortClasses/);
  assert.match(app, /compareClasses/);
  assert.match(app, /selected-count/);
  assert.match(app, /daily-time/);
  assert.match(app, /weekday/);
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
  assert.match(app, /teachingClass:\s*teachingClass/);
  assert.match(app, /confirmChooseSnapshot/);
  assert.match(app, /保存接口已返回成功/);
  assert.match(app, /state\.busy \|\| selected/);
  assert.match(app, /selection\.drop/);
  assert.match(app, /formatDropRestriction/);
  assert.match(app, /dropRestriction/);
  assert.match(app, /chosen-state/);
  assert.match(app, /sfxkbj=0/);
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
  assert.match(css, /button\.danger\s*\{[^}]*color:\s*#fff/s);
  assert.match(css, /course-type-tabs/);
  assert.doesNotMatch(css, /course-type-placeholder/);
  assert.match(css, /section-sort-select/);
  assert.match(css, /class-card-main/);
  assert.match(css, /class-card-action/);
  assert.match(css, /schedule-grid/);
  assert.match(css, /course-ownership-value/);
  assert.match(css, /schedule-course/);
  assert.match(css, /\.chosen-state/);
  assert.match(css, /meeting-list/);
  assert.match(css, /meeting-location/);
  assert.match(css, /topbar-link-button/);
  assert.match(css, /session-status-card/);
  assert.match(css, /\.topbar-link-button\s*\{[^}]*background:\s*#0f9f6e/s);
  assert.match(css, /auto-class-menu/);
  assert.match(css, /\.class-card \.class-actions \.auto-class-button\s*\{[^}]*background:\s*#effaf5/s);
  assert.match(css, /\.class-card \.class-actions \.auto-class-button\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.auto-class-menu\s*\{[^}]*max-height:\s*min\(240px,\s*48vh\)/s);
  assert.match(css, /auto-class-menu-heading/);
  assert.match(css, /\.class-card \.class-actions \.auto-class-menu-item/);
  assert.match(css, /\.section-heading \.step-badge\s*\{[^}]*color:\s*#fff/s);
  assert.doesNotMatch(css, /auto-selection-workspace/);
  assert.match(css, /auto-config-pane/);
  assert.match(css, /auto-groups-pane/);
  assert.match(css, /auto-status-pane/);
  assert.match(css, /step-badge/);
  assert.match(css, /auto-target-table/);
  assert.match(css, /\.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(300px,\s*0\.88fr\)\s*minmax\(460px,\s*1\.22fr\)\s*minmax\(360px,\s*1fr\)/s);
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

test('standalone auto-selection page implements the reference workflow surface', async () => {
  const html = await readFile(new URL('../web/auto-selection.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../web/auto-selection.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../web/styles.css', import.meta.url), 'utf8');
  const server = await readFile(new URL('../scripts/serve-web.js', import.meta.url), 'utf8');

  assert.match(html, /<body[^>]*data-page="auto-selection"/);
  assert.match(html, /正方选课助手 · 自动选课控制台/);
  assert.match(html, /自动选课控制台/);
  assert.match(html, /id="autoReturnHomeBtn"/);
  assert.match(html, /href="\/"/);
  assert.match(html, /返回主页面/);
  assert.doesNotMatch(html, /id="autoCourseTypeTabs"/);
  assert.doesNotMatch(html, /当前显示/);
  assert.doesNotMatch(html, /id="autoEnabledSwitch"/);
  assert.doesNotMatch(html, /class="auto-switch"/);
  assert.doesNotMatch(html, /已启用/);
  assert.match(html, /id="autoHelpBtn"/);
  assert.match(html, /id="autoHelpDialog"/);
  assert.doesNotMatch(html, /id="autoCollapseBtn"/);
  assert.doesNotMatch(html, /id="sessionForm"/);
  assert.doesNotMatch(html, /id="baseUrlInput"/);
  assert.doesNotMatch(html, /id="usernameInput"/);
  assert.doesNotMatch(html, /id="passwordInput"/);
  assert.doesNotMatch(html, /id="pagePathInput"/);
  assert.doesNotMatch(html, /id="cookieInput"/);
  assert.match(html, /当前配置/);
  assert.doesNotMatch(html, /保存配置/);
  assert.doesNotMatch(html, /自动选课会复用初始化配置/);
  assert.match(html, /id="autoSessionSummary"/);
  assert.doesNotMatch(html, /id="autoSessionDetail"/);
  assert.match(html, /id="autoConfigLink"/);
  assert.match(html, /<a id="autoConfigLink" class="setup-link-button"/);
  assert.match(html, /href="\/setup\?next=\/auto-selection"/);
  assert.match(html, /id="autoInitBtn"/);
  assert.match(html, /id="autoIntervalInput"/);
  assert.match(html, /id="autoMaxAttemptsInput"/);
  assert.match(html, /id="autoDeadlineInput"/);
  assert.match(html, /id="autoFailureStrategySelect"/);
  assert.match(html, /id="autoPrecheckBtn"/);
  assert.match(html, /预检查/);
  assert.match(html, /id="autoStartBtn"/);
  assert.match(html, /id="autoPauseBtn"/);
  assert.match(html, /id="autoResumeBtn"/);
  assert.match(html, /id="autoCancelBtn"/);
  assert.match(html, /id="autoAddGroupBtn"/);
  assert.match(html, /id="autoGroupTabs"/);
  assert.match(html, /id="autoGroupNameInput"/);
  assert.match(html, /id="autoGroupStrategyInput"/);
  assert.match(html, /<select id="autoGroupStrategyInput"/);
  assert.match(html, /value="priority">优先级模式/);
  assert.match(html, /value="equivalent">等价模式/);
  assert.doesNotMatch(html, /id="autoClearGroupBtn"/);
  assert.match(html, /id="autoDeleteGroupBtn"/);
  assert.match(html, /删除组/);
  assert.match(html, /id="autoTargetList"/);
  assert.match(html, /<details class="auto-id-source"/);
  assert.match(html, /id="autoIdTargetForm"/);
  assert.match(app, /允许自动退课升级/);
  assert.match(app, /选中后，如果更高优先级目标出现余量，系统可以先退掉该教学班，再尝试抢更高优先级目标。/);
  assert.doesNotMatch(app, /可退课后升级/);
  assert.doesNotMatch(app, /<th>保底<\/th>/);
  assert.doesNotMatch(app, /data-auto-target-field="isBackup"/);
  assert.match(app, /allowAutoDrop: true/);
  assert.match(html, /id="autoCourseIdInput"/);
  assert.match(html, /id="autoClassIdInput"/);
  assert.match(html, /id="autoTeacherNameInput"/);
  assert.match(html, /获取详情并加入当前组/);
  assert.doesNotMatch(html, /id="autoSubmitClassIdInput"/);
  assert.doesNotMatch(html, /id="autoTargetLabelInput"/);
  assert.doesNotMatch(html, /id="autoTeachingClassList"/);
  assert.doesNotMatch(html, /id="autoSearchForm"/);
  assert.doesNotMatch(html, /id="autoKeywordInput"/);
  assert.doesNotMatch(html, /id="autoCollegeFilter"/);
  assert.doesNotMatch(html, /id="autoCourseFilter"/);
  assert.doesNotMatch(html, /id="autoRefreshClassesBtn"/);
  assert.match(html, /id="autoTaskStatusPanel"/);
  assert.match(html, /id="autoTaskSummary"/);
  assert.doesNotMatch(html, /id="autoAuthRefreshBtn"/);
  assert.doesNotMatch(html, /重新登录/);
  assert.match(html, /id="autoGroupStatusList"/);
  assert.match(html, /id="autoEventLog"/);
  assert.match(html, /id="autoCopyEventsBtn"/);
  assert.match(html, /id="autoExportEventsBtn"/);
  assert.match(html, /id="autoClearEventsBtn"/);
  assert.match(html, /id="autoExportConfigBtn"/);
  assert.match(html, /id="autoImportConfigInput"/);
  assert.match(html, /<script type="module" src="\/web\/auto-selection\.js"><\/script>/);

  assert.match(app, /createZfxkClient/);
  assert.match(app, /parseCourseTypeOptions/);
  assert.match(app, /loadCourseTypeDisplayContext/);
  assert.doesNotMatch(app, /loadAllCoursePages/);
  assert.match(app, /requireSessionConfig\('\/auto-selection'\)/);
  assert.match(app, /state\.sessionConfig/);
  assert.match(app, /writeSessionConfig/);
  assert.match(app, /renderSessionOverview/);
  assert.doesNotMatch(app, /MAIN_SESSION_STORAGE_KEY/);
  assert.doesNotMatch(app, /AUTO_SESSION_STORAGE_KEY/);
  assert.doesNotMatch(app, /readStoredSession/);
  assert.doesNotMatch(app, /sessionValue/);
  assert.match(app, /AUTO_SELECTION_DRAFT_STORAGE_KEY/);
  assert.doesNotMatch(app, /renderCourseTypeTabs/);
  assert.doesNotMatch(app, /switchCourseType/);
  assert.doesNotMatch(app, /renderTeachingClasses/);
  assert.match(app, /addIdTargetToAutoSelection/);
  assert.match(app, /resolveIdTeachingClass/);
  assert.match(app, /courseType:\s*teachingClass\.courseType/);
  assert.match(app, /state\.client\.catalog\.getTeachingClasses\(courseId\)/);
  assert.match(app, /resolvedClassLabel/);
  assert.doesNotMatch(app, /autoSubmitClassIdInput/);
  assert.doesNotMatch(app, /autoTargetLabelInput/);
  assert.match(app, /precheckAutoSelectionTask/);
  assert.match(app, /检查目标是否存在/);
  assert.match(app, /检查是否能拉到教学班详情/);
  assert.match(app, /检查是否已选同组课程/);
  assert.match(app, /检查是否存在时间冲突/);
  assert.match(app, /检查 allowAutoDrop 是否安全/);
  assert.match(app, /检查用户名密码是否可用于续期/);
  assert.match(app, /auto-target-id-line/);
  assert.match(app, /title="\$\{escapeHtml\(targetIds\)\}"/);
  assert.match(app, /showPriorityColumn/);
  assert.match(app, /showPriorityColumn \? '<th>优先级<\/th>' : ''/);
  assert.match(app, /showPriorityColumn \? `\s*<td><input data-auto-target-index="\$\{index\}" data-auto-target-field="priority"/s);
  assert.doesNotMatch(app, /data-auto-move-target/);
  assert.match(app, /reorderTarget/);
  assert.match(app, /normalizeDraftGroupStrategy/);
  assert.match(app, /strategy: normalizeDraftGroupStrategy/);
  assert.match(app, /startAutoSelectionTask/);
  assert.doesNotMatch(app, /autoEnabledSwitch/);
  assert.doesNotMatch(app, /自动选课开关未启用/);
  assert.match(app, /pauseCurrentAutoTask/);
  assert.match(app, /resumeCurrentAutoTask/);
  assert.match(app, /cancelCurrentAutoTask/);
  assert.match(app, /updateAutoActionButtons/);
  assert.match(app, /canPauseAutoTask/);
  assert.match(app, /canResumeAutoTask/);
  assert.match(app, /canCancelAutoTask/);
  assert.match(app, /配置 Cookie/);
  assert.match(app, /任务会话/);
  assert.match(app, /续期登录/);
  assert.match(app, /等待任务启动后验证/);
  assert.match(app, /targetLastFailureText/);
  assert.match(app, /最近原因/);
  assert.match(app, /最高目标/);
  assert.match(app, /下一步/);
  assert.match(app, /buildStartSummaryText/);
  assert.match(app, /即将启动：/);
  assert.match(app, /copyAutoSelectionEvents/);
  assert.match(app, /exportAutoSelectionEvents/);
  assert.match(app, /exportAutoSelectionDraft/);
  assert.match(app, /importAutoSelectionDraft/);
  assert.match(app, /zhengfang-selection-assistant-auto-selection/);
  assert.match(app, /DEFAULT_GROUP_NAME = '默认'/);
  assert.match(app, /deleteActiveGroup/);
  assert.match(app, /\/api\/auto-selection\/tasks\/.+\/pause/);
  assert.match(app, /\/api\/auto-selection\/tasks\/.+\/resume/);
  assert.match(app, /\/api\/auto-selection\/tasks\/.+\/events/);
  assert.doesNotMatch(app, /refreshAuthFromStatusPanel/);
  assert.match(app, /showHelpDialog/);
  assert.doesNotMatch(app, /toggleChromeCompactMode/);
  assert.match(css, /auto-session-summary/);
  assert.match(css, /auto-page-shell/);
  assert.match(css, /auto-page-topbar/);
  assert.doesNotMatch(css, /auto-top-icon/);
  assert.doesNotMatch(css, /auto-switch/);
  assert.doesNotMatch(css, /auto-auth-refresh/);
  assert.match(css, /auto-page-workspace/);
  assert.match(css, /auto-log-actions/);
  assert.match(css, /auto-target-status-list/);
  assert.match(css, /auto-id-source\s*>\s*summary/);
  assert.match(css, /auto-id-target-form/);
  assert.doesNotMatch(css, /auto-teaching-table/);
  assert.match(css, /auto-state-grid/);
  assert.match(css, /table-layout:\s*fixed/);
  assert.match(css, /auto-target-id-line/);
  assert.match(css, /text-overflow:\s*ellipsis/);
  assert.match(css, /\.auto-import-export\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /\.auto-primary-actions button,\s*\.auto-import-export button,\s*\.auto-import-export \.file-button\s*\{[^}]*width:\s*100%/s);
  assert.match(css, /grid-template-columns:\s*minmax\(300px,\s*0\.82fr\)\s*minmax\(560px,\s*1\.5fr\)\s*minmax\(360px,\s*0\.96fr\)/);
  assert.match(server, /action === 'pause'/);
});

test('standalone auto-selection auto-initializes after proxy transport is available', async () => {
  class FakeElement {
    constructor(id = '') {
      this.id = id;
      this.children = [];
      this.dataset = {};
      this.style = {};
      this.value = '';
      this.textContent = '';
      this.disabled = false;
      this.files = [];
      this.selectedOptions = [];
    }

    addEventListener() {}

    append(...children) {
      this.children.push(...children);
    }

    replaceChildren(...children) {
      this.children = children;
    }

    setAttribute(name, value) {
      this[name] = String(value);
    }

    get innerHTML() {
      return this.html || '';
    }

    set innerHTML(value) {
      this.html = String(value);
    }
  }

  const elements = new Map();
  const elementFor = (selector) => {
    const id = selector.startsWith('#') ? selector.slice(1) : selector;
    if (!elements.has(id)) elements.set(id, new FakeElement(id));
    return elements.get(id);
  };
  const storage = new Map([
    ['zfxk.web.session.v1', JSON.stringify({
      baseUrl: 'https://example.edu',
      pagePath: '/xsxk/zzxkyzb_cxZzxkYzbIndex.html?gnmkdm=N253512',
      cookie: 'JSESSIONID=test'
    })]
  ]);
  let proxyGetCalls = 0;

  const globals = ['window', 'document', 'localStorage', 'fetch', 'setTimeout', 'clearTimeout']
    .map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const setGlobal = (name, value) => Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value
  });

  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
  };
  const document = {
    querySelector: elementFor,
    querySelectorAll: () => [...elements.values()],
    createElement: (tagName) => new FakeElement(tagName)
  };
  const response = (body, contentType = 'application/json; charset=UTF-8') => ({
    ok: true,
    status: 200,
    headers: {
      get: (name) => name.toLowerCase() === 'content-type' ? contentType : ''
    },
    text: () => typeof body === 'string' ? body : JSON.stringify(body),
    json: () => body
  });

  try {
    setGlobal('localStorage', localStorage);
    setGlobal('document', document);
    setGlobal('window', {
      localStorage,
      location: {
        pathname: '/auto-selection',
        search: '',
        hash: '',
        replace() {}
      }
    });
    setGlobal('setTimeout', () => 0);
    setGlobal('clearTimeout', () => {});
    setGlobal('fetch', async (url) => {
      if (url === '/api/proxy/get') {
        proxyGetCalls += 1;
        return response('<html></html>', 'text/html; charset=UTF-8');
      }
      if (url === '/api/auto-selection/tasks') {
        return response({ tasks: [] });
      }
      return response({});
    });

    const moduleUrl = new URL('../web/auto-selection.js', import.meta.url);
    moduleUrl.search = `?auto-init=${Date.now()}`;
    await import(moduleUrl.href);
    for (let index = 0; index < 20; index += 1) await Promise.resolve();

    assert.equal(proxyGetCalls, 1);
  } finally {
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});

test('setup page owns saved login configuration for web pages', async () => {
  const html = await readFile(new URL('../web/setup.html', import.meta.url), 'utf8');
  const setup = await readFile(new URL('../web/setup.js', import.meta.url), 'utf8');
  const sessionConfig = await readFile(new URL('../web/session-config.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../web/styles.css', import.meta.url), 'utf8');
  const server = await readFile(new URL('../scripts/serve-web.js', import.meta.url), 'utf8');

  assert.match(html, /<body[^>]*data-page="setup"/);
  assert.match(html, /正方选课助手 · 初始化配置/);
  assert.match(html, /初始化配置/);
  assert.doesNotMatch(html, /setup-hero/);
  assert.doesNotMatch(html, /setup-status-grid/);
  assert.match(html, /id="setupForm"/);
  assert.match(html, /id="setupBaseUrlInput"/);
  assert.match(html, /id="setupUsernameInput"/);
  assert.match(html, /id="setupPasswordInput"/);
  assert.match(html, /id="setupPagePathInput"/);
  assert.match(html, /id="setupCookieInput"/);
  assert.match(html, /id="setupLoginBtn"/);
  assert.match(html, /id="setupSolveCaptchaBtn"/);
  assert.match(html, /id="setupSubmitBtn"/);
  assert.match(html, /<script type="module" src="\/web\/setup\.js"><\/script>/);

  assert.match(setup, /readSessionConfig/);
  assert.match(setup, /writeSessionConfig/);
  assert.match(setup, /正在自动初始化/);
  assert.match(setup, /填写账号密码用于自动初始化/);
  assert.match(setup, /sanitizeNextPath/);
  assert.match(setup, /\/api\/login\/zfcaptcha/);
  assert.match(setup, /\/api\/captcha\/solve/);
  assert.match(setup, /window\.location\.assign\(nextPath\)/);
  assert.match(sessionConfig, /hasSavedSessionConfig/);
  assert.match(sessionConfig, /config\.cookie \|\| \(config\.username && config\.password\)/);
  assert.match(sessionConfig, /window\.location\.replace\(setupUrl\(nextPath\)\)/);
  assert.match(css, /setup-shell/);
  assert.match(css, /setup-panel/);
  assert.doesNotMatch(css, /setup-status-grid/);
  assert.doesNotMatch(css, /setup-hero/);
  assert.match(server, /url\.pathname === '\/setup'/);
  assert.match(server, /web\/setup\.html/);
});

test('web retry helper retries transient failures with short backoff delays', async () => {
  const delays = [];
  let attempts = 0;
  const result = await withRetry(async () => {
    attempts += 1;
    if (attempts < 4) throw new Error(`fail ${attempts}`);
    return 'ok';
  }, {
    retries: 3,
    delays: [100, 200, 400],
    wait: async (delay) => delays.push(delay)
  });

  assert.equal(result, 'ok');
  assert.equal(attempts, 4);
  assert.deepEqual(delays, [100, 200, 400]);
});

test('web retry helper rethrows after the retry budget is exhausted', async () => {
  const delays = [];
  let attempts = 0;
  await assert.rejects(
    withRetry(async () => {
      attempts += 1;
      throw new Error(`still failing ${attempts}`);
    }, {
      retries: 3,
      delays: [100, 200, 400],
      wait: async (delay) => delays.push(delay)
    }),
    /still failing 4/
  );

  assert.equal(attempts, 4);
  assert.deepEqual(delays, [100, 200, 400]);
});

test('main page automatically refreshes the visible teaching-class list while idle', async () => {
  const app = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');

  assert.match(app, /VISIBLE_CLASS_REFRESH_INTERVAL_MS\s*=\s*30_000/);
  assert.match(app, /autoRefreshingClasses:\s*false/);
  assert.match(app, /startVisibleClassAutoRefresh\(\)/);
  assert.match(app, /setInterval\(\(\) => refreshVisibleClasses\(\),\s*VISIBLE_CLASS_REFRESH_INTERVAL_MS\)/);
  assert.match(app, /async function refreshVisibleClasses\(\)/);
  assert.match(app, /if \(!shouldRefreshVisibleClasses\(state\)\) return/);
  assert.match(app, /fetchClassItemsForCourseKey\(courseKey\)/);
  assert.match(app, /state\.client\.chosen\.snapshot\(\)/);
  assert.match(app, /shouldApplyVisibleClassRefresh\(state,\s*courseKey,\s*actionVersion\)/);
  assert.match(app, /自动刷新教学班失败/);
});

test('course export builder deduplicates repeated course rows before attaching teaching classes', async () => {
  const courses = [
    { courseId: '13861', courseCode: '413001', name: '体育', raw: { jxb_id: 'JXB1', jxbmc: '体育-01' } },
    { courseId: '13861', courseCode: '413001', name: '体育', raw: { jxb_id: 'JXB2', jxbmc: '体育-02' } },
    { courseId: '13861', courseCode: '413001', name: '体育', raw: { jxb_id: 'JXB3', jxbmc: '体育-03' } }
  ];
  const exportCourses = await buildCoursesForExport(courses, {
    wait: async () => {},
    async getTeachingClasses(courseId) {
      assert.equal(courseId, '13861');
      return [
        { classId: 'JXB1', submitClassId: 'JXB1', courseId, raw: { jxb_id: 'JXB1' } },
        { classId: 'JXB2', submitClassId: 'JXB2', courseId, raw: { jxb_id: 'JXB2' } },
        { classId: 'JXB3', submitClassId: 'JXB3', courseId, raw: { jxb_id: 'JXB3' } }
      ];
    }
  });

  assert.equal(exportCourses.length, 1);
  assert.equal(exportCourses[0].sourceCourseRowCount, 3);
  assert.equal(exportCourses[0].teachingClasses.length, 3);
  assert.deepEqual(exportCourses[0].teachingClasses.map((item) => item.raw.jxbmc), ['体育-01', '体育-02', '体育-03']);

  const payload = buildCourseExport(exportCourses, {
    now: () => new Date('2026-06-29T12:00:00.000Z')
  });
  assert.equal(payload.课程数量, 1);
  assert.equal(payload.课程[0].来源课程行数量, 3);
  assert.equal(payload.课程[0].教学班.length, 3);
});

test('course export uses readable mapped fields and preserves unmapped raw details', () => {
  const exportData = buildCourseExport([
    {
      courseId: 'KC1',
      courseCode: 'CS101',
      name: '数据库',
      credit: 3,
      typeCode: '01',
      typeName: '主修课程',
      ownershipCode: 'A',
      ownershipName: '自然科学',
      retake: false,
      hasPrerequisiteHint: true,
      recommended: true,
      teachingClasses: [{
        classId: 'JXB1',
        submitClassId: 'DO1',
        courseId: 'KC1',
        name: '数据库-0001',
        childClassCount: 1,
        credit: 3,
        selectedCount: 18,
        capacity: 30,
        currentRound: { capacity: 20, selected: 12 },
        teachers: [{ name: '李老师', raw: '李老师' }],
        scheduleText: '星期一第1-2节{1-16周}',
        locationText: 'A101',
        examText: '第18周',
        flags: { selected: false, full: false, canSelect: true },
        raw: {
          jxb_id: 'JXB1',
          do_jxb_id: 'DO1',
          sksj: '星期一第1-2节{1-16周}',
          jxdd: 'A101'
        }
      }],
      raw: {
        kch_id: 'KC1',
        kch: 'CS101',
        kcmc: '数据库',
        jxbmc: '数据库-0001',
        kcrow: '1',
        custom_raw_flag: 'keep'
      }
    }
  ], {
    metadata: { term: '2026-2027-1', courseTypeName: '主修课程', keyword: '数据' },
    now: () => new Date('2026-06-29T12:00:00.000Z')
  });

  assert.equal(exportData.导出类型, '课程完整信息');
  assert.equal(exportData.导出时间, '2026-06-29T12:00:00.000Z');
  assert.equal(exportData.课程数量, 1);
  assert.equal(exportData.元信息.学年学期, '2026-2027-1');
  assert.equal(exportData.课程[0].课程ID, 'KC1');
  assert.equal(exportData.课程[0].课程号, 'CS101');
  assert.equal(exportData.课程[0].课程名称, '数据库');
  assert.equal(exportData.课程[0].教学班名称, '数据库-0001');
  assert.equal(exportData.课程[0].教学班[0].上课时间, '星期一第1-2节{1-16周}');
  assert.equal(exportData.课程[0].教学班[0].上课地点, 'A101');
  assert.equal(exportData.课程[0].教学班[0].本轮容量, 20);
  assert.equal(exportData.课程[0].教学班[0].标志.是否可选, true);
  assert.equal(exportData.课程[0].源序号, '1');
  assert.equal(exportData.课程[0].额外原始字段.custom_raw_flag, 'keep');
  assert.doesNotMatch(JSON.stringify(exportData.课程[0]), /"kch_id"|"kch"|"kcmc"|"jxbmc"/);
});

test('selected-course export separates current selection details without Map fields', () => {
  const selectedClass = {
    classId: 'JXB1',
    submitClassId: 'DO1',
    courseId: 'KC1',
    name: '数据库-0001',
    order: 1,
    weight: 2,
    selectedBySystem: true,
    selfSelected: false,
    canDrop: false,
    dropRestriction: { code: 'SELECT_FLAG_DISABLED', message: 'sfxkbj=0' },
    credit: 3,
    teachers: [{ id: 'T1', name: '李老师', title: '教授', raw: 'T1/李老师/教授' }],
    scheduleText: '星期一第1-2节{1-16周}',
    locationText: 'A101',
    ownershipName: '自然科学',
    raw: {
      jxb_id: 'JXB1',
      do_jxb_id: 'DO1',
      t_kch_id: 'KC1',
      zypx: '1',
      qz: '2',
      jsxx: 'T1/李老师/教授',
      extra_selected_field: 'keep'
    }
  };
  const exportData = buildSelectedCoursesExport({
    selectedCourses: [{
      courseId: 'KC1',
      courseCode: 'CS101',
      name: '数据库',
      credit: 3,
      typeCode: '01',
      ownershipName: '自然科学',
      retake: false,
      classes: [selectedClass],
      raw: { t_kch_id: 'KC1', kch: 'CS101', kcmc: '数据库' }
    }],
    selectedClasses: [selectedClass],
    totals: { courseCount: 1, credit: 3, teachingClassCredit: 3 },
    byCourseId: new Map(),
    byClassId: new Map(),
    version: 'snapshot-1',
    fetchedAt: new Date('2026-06-29T11:00:00.000Z')
  }, {
    metadata: { courseTypeName: '主修课程' },
    now: () => new Date('2026-06-29T12:00:00.000Z')
  });

  assert.equal(exportData.导出类型, '当前选课详细信息');
  assert.deepEqual(exportData.汇总, { 课程数: 1, 总学分: 3, 教学班学分: 3 });
  assert.equal(exportData.快照时间, '2026-06-29T11:00:00.000Z');
  assert.equal(exportData.已选课程[0].课程名称, '数据库');
  assert.equal(exportData.已选课程[0].教学班[0].志愿顺序, 1);
  assert.equal(exportData.已选教学班[0].教师[0].姓名, '李老师');
  assert.equal(exportData.已选教学班[0].标志.是否可退, false);
  assert.deepEqual(exportData.已选教学班[0].标志.不可退原因, { code: 'SELECT_FLAG_DISABLED', message: 'sfxkbj=0' });
  assert.equal(exportData.已选教学班[0].额外原始字段.extra_selected_field, 'keep');
  assert.doesNotMatch(JSON.stringify(exportData), /"byClassId"|"byCourseId"|"jxb_id"|"do_jxb_id"|"t_kch_id"|"jsxx"/);
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

test('web teaching-class course names are restored for selection save payloads', () => {
  const names = teachingClassCourseNamesById([
    { courseId: '13861', name: '体育', raw: { jxb_id: 'JXB-PE', jxbmc: '跆拳道初级混-唐文兵周一67屏峰' } },
    { courseId: '13861', name: '体育', raw: { do_jxb_id: 'DO-PE', jxbmc: '网球初级混-陈芳芳周一67屏' } },
    { courseId: 'KC2', name: '算法', raw: { jxb_id: 'JXB-CS', jxbmc: '算法-0001' } }
  ], ['13861']);

  assert.equal(names.get('JXB-PE'), '体育');
  assert.equal(names.get('DO-PE'), '体育');
  assert.equal(names.has('JXB-CS'), false);
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
  assert.match(server, /web\/setup\.html/);
  assert.match(server, /\/api\/proxy\/get/);
  assert.match(server, /\/api\/proxy\/post/);
  assert.match(server, /\/api\/captcha\/solve/);
  assert.match(server, /\/api\/login\/zfcaptcha/);
  assert.match(server, /loginWithZfCaptcha/);
  assert.match(server, /solveZfCaptcha/);
});
