## [2026-06-29 14:55] zfxk SDK MVP
- **Changes:** Added a dependency-free Node ESM SDK in `src/`, package metadata, README usage notes, and Node test coverage for context loading, endpoint constants, mappers, catalog/chosen services, choose/drop/reorder workflows, and save flag normalization.
- **Status:** Completed
- **Next Steps:** Run against a real authenticated school session fixture before publishing or expanding optional flows.
- **Context:** Original `zzxkYzb*.js` files remain at the repository root as reference inputs; the SDK intentionally avoids DOM automation, rate limiting, and anti-scraping behavior.

## [2026-06-29 15:16] Documentation Generators
- **Changes:** Added OpenAPI generation, TypeDoc configuration, docs scripts, generated docs artifacts, TypeDoc dev dependency lockfile, README documentation instructions, and tests for docs generation contracts.
- **Status:** Completed
- **Next Steps:** Configure a git remote if source links in generated TypeDoc output should point to hosted code.
- **Context:** `npm run docs` currently emits one TypeDoc warning because the repository has no valid `origin` remote; generated API docs are still produced.

## [2026-06-29 15:32] Page Bootstrap Auth Flow
- **Changes:** Added `bootstrapFromPage()` to fetch a selection page with the configured Cookie, parse hidden-field context automatically, reject non-selection/login pages with `CONTEXT_NOT_FOUND`, and documented the flow in README/OpenAPI/TypeDoc.
- **Status:** Completed
- **Next Steps:** Verify the default entry path against a real school deployment before hard-coding any convenience alias.
- **Context:** The method intentionally requires callers to pass the page path because selection entry URLs vary by school/menu code.

## [2026-06-29 16:01] Web Selection Workspace
- **Changes:** Added a static Web frontend with Demo and browser-session modes, course search, teaching-class display, choose/drop/order actions, activity log, local static server, README usage notes, and frontend contract tests.
- **Status:** Completed
- **Next Steps:** Add a local same-origin proxy if the frontend must drive a real cross-origin school deployment from localhost.
- **Context:** Browser-session mode relies on existing browser cookies via `credentials: include`; raw Cookie headers cannot be set from browser JavaScript.

## [2026-06-29 16:18] Proxy Web Frontend
- **Changes:** Removed the Web Demo/browser-session mode switch, added Cookie/Base URL inputs, routed frontend SDK calls through local Node proxy endpoints, and updated README/TypeDoc/tests.
- **Status:** Completed
- **Next Steps:** Test the proxy against a real authenticated school session.
- **Context:** Browser JavaScript still does not set raw Cookie headers directly; the local Node proxy attaches the provided Cookie server-side.

## [2026-06-29 16:24] Initial Hidden Field Fallback
- **Changes:** Updated runtime-context parsing to read `firstXkkzId`, `firstKklxdm`, `firstKklxmc`, `firstXkkzXh`, `firstNjdmId`, and `firstZyhId` when the active hidden fields are still blank; added regression coverage and README/TypeDoc notes.
- **Status:** Completed
- **Next Steps:** Retry the Web initialization with the same Cookie/Base URL/Path.
- **Context:** The original ZFXK page scripts copy these `first*` values into `xkkz_id` and `kklxdm` after load; the SDK parses static HTML and must mirror that setup.

## [2026-06-29 16:33] Read-Only Live Interface Check
- **Changes:** Verified authenticated read-only bootstrap, course search, teaching-class lookup, chosen snapshot, and local proxy GET against the live school system; fixed SDK teaching-class mapping when the upstream row omits `kch_id`/`jxbmc`.
- **Status:** Completed
- **Next Steps:** Use the Web frontend for manual read-only browsing first, then only test mutating operations with explicit confirmation.
- **Context:** No choose/drop/reorder/save endpoint was called during the live check; the local fix prevents literal `"undefined"` values in mapped teaching-class fields.

## [2026-06-29 16:55] Advanced Filter Bar
- **Changes:** Recreated the school-system advanced filter bar in the Web frontend, loading filter rows and options from the live selection page/dictionary endpoints, wiring selected filters into course search, and updating README/TypeDoc/tests.
- **Status:** Completed
- **Next Steps:** Use the filter bar for read-only browsing before trying any mutating action.
- **Context:** Browser verification loaded 14 real filter rows, including opening college, grade, college, major, course category, course nature, ownership, teaching mode, weekday, period, teaching class, retake, capacity, and schedule-conflict filters.

## [2026-06-29 17:02] Teaching Class Schedule Display
- **Changes:** Parsed plain teacher names and rendered `<br/>` separated teaching-class schedule/location fields as paired meeting rows in the Web frontend.
- **Status:** Completed
- **Next Steps:** Re-check with live course data if the school system returns additional schedule formats.
- **Context:** The sample `星期二第8-9节{5-16周}<br/>星期三第6-7节{5-16周}` format now displays as two readable meeting rows with matching `健B105` locations.

## [2026-06-29 17:15] Course Type Switcher
- **Changes:** Added SDK parsing for entry-page course-type tabs and a Web frontend switcher that refreshes context/search for 主修课程, 跨专业个性化课程, 通识选修课, 体育分项, or any other tab discovered on the real page.
- **Status:** Completed
- **Next Steps:** Use the Web frontend against a live session to confirm every discovered type has an active `xkkz_id`.
- **Context:** Switching updates `kklxdm`, `kklxmc`, `xkkz_id`, `njdm_id`, `zyh_id`, and `xkkz_xh`, then reloads filters, course results, teaching classes, and selected-course snapshot.

## [2026-06-29 17:20] Compact Teaching-Class Cards
- **Changes:** Tightened Web frontend teaching-class and selected-class card spacing, restyled capacity badges, compressed meeting rows, and aligned status tags with action buttons.
- **Status:** Completed
- **Next Steps:** Re-check live data with unusually long teacher names or classroom names.
- **Context:** This is a CSS-only visual refinement; SDK behavior and proxy requests are unchanged.

## [2026-06-29 17:28] Full Teaching-Class Selection
- **Changes:** Decoupled `flags.full` from `flags.canSelect`, allowed full teaching classes to reach the save endpoint when `sfxkbj` permits selection, and updated Web button disabling plus README/TypeDoc.
- **Status:** Completed
- **Next Steps:** Validate against live first-round and second-round sessions to confirm `sfxkbj` and save response flags match the school workflow.
- **Context:** Fullness comes from `yxzrs >= jxbrl`; eligibility comes from `sfxkbj` and the server-side save result. Capacity overflow remains represented by save flag `-1`.

## [2026-06-29 17:39] Split Teaching-Class Card Layout
- **Changes:** Reworked Web teaching-class cards to match the split reference design, with left-side teacher/status/meeting content and a right-side action column separated by a vertical divider.
- **Status:** Completed
- **Next Steps:** Compare against live data with multiple meeting rows and long classroom names.
- **Context:** This is a frontend layout/style change only; SDK requests and selection logic are unchanged.

## [2026-06-29 17:47] Course Code Grouping
- **Changes:** Grouped left-column course results by course code and loaded teaching classes for every original `courseId` under the selected code.
- **Status:** Completed
- **Next Steps:** Validate with live search results where one course code maps to multiple backend course IDs.
- **Context:** The selection payload still uses each teaching class's original `courseId`; only the left course display is merged.

## [2026-06-29 18:13] zfCaptcha Integration
- **Changes:** Added the Node.js `zfCaptcha` solver under `src/captcha/`, bundled template images, exported captcha helper APIs, added `/api/captcha/solve` to the local Web server, and wired a Web button that fills the existing Cookie field.
- **Status:** Completed
- **Next Steps:** Validate `/api/captcha/solve` against a live Zhengfang deployment and confirm whether that cookie is sufficient or must be followed by a separate username/password login flow.
- **Context:** The helper solves the `zfcaptchaLogin` slider flow only; it intentionally does not submit account credentials.

## [2026-06-29 18:23] Selected Schedule Grid
- **Changes:** Added a compact selected-course timetable panel in the Web frontend, filling weekday/period cells from the current chosen snapshot and showing course names plus overlap states.
- **Status:** Completed
- **Next Steps:** Verify against live selected-course data with multi-week, weekend, or overlapping classes.
- **Context:** The grid reuses existing `<br/>` schedule parsing and falls back to raw course names from the snapshot when course IDs differ across chosen rows.

## [2026-06-29 18:38] zfCaptcha Login Flow
- **Changes:** Added `loginWithZfCaptcha()` and RSA password encryption helpers, reused the zfCaptcha solver with retry, submitted the timestamped Zhengfang login form, returned authenticated cookies, exposed `/api/login/zfcaptcha`, and added Web controls/tests/docs.
- **Status:** Completed
- **Next Steps:** Validate the full login flow against the live deployment, especially deployments that require SMS or identity-confirmation dialogs.
- **Context:** Non-interactive blockers are surfaced as explicit error codes such as `SMS_LOGIN_REQUIRED` and `IDENTITY_CONFIRMATION_REQUIRED`.

## [2026-06-29 18:42] Browser-Safe Web Imports
- **Changes:** Updated the Web frontend to import browser-safe SDK modules directly instead of the Node package root, and added regression coverage preventing `node:` imports from the browser script.
- **Status:** Completed
- **Next Steps:** Hard-refresh the Web frontend if the browser cached the old module graph.
- **Context:** `loginWithZfCaptcha()` remains available through the local Node endpoint; browser code must not load `src/auth/login.js` because it imports `node:crypto`.

## [2026-06-29 18:51] Merged Selected Schedule Blocks
- **Changes:** Added reusable schedule layout helpers, merged continuous selected-course periods into single timetable blocks, applied course-colored backgrounds with adjacent color de-duplication, and added regression coverage.
- **Status:** Completed
- **Next Steps:** Visually confirm with live selected-course data after refreshing the Web frontend.
- **Context:** Adjacent same-day course blocks avoid reusing the same palette color when possible; identical continuous course slots now render through one row-spanning cell.

## [2026-06-29 18:56] General Elective Course Ownership
- **Changes:** Exposed `ownershipCode`/`ownershipName` on course, teaching-class, and selected-course models; displayed course ownership on Web course and teaching-class cards; regenerated OpenAPI/TypeDoc docs and added regression tests.
- **Status:** Completed
- **Next Steps:** Verify against live 通识选修课 data where the backend returns `kcgsmc`.
- **Context:** Grouped course cards aggregate multiple ownership names with `、` when the same course code maps to multiple backend course IDs.

## [2026-06-29 18:57] README Chinese Simplification
- **Changes:** Rewrote `README.md` in concise Chinese while preserving install, SDK usage, login/Cookie helpers, supported surface, docs, and Web frontend instructions.
- **Status:** Completed
- **Next Steps:** None.
- **Context:** Documentation-only change; no SDK or Web runtime behavior changed.

## [2026-06-29 19:03] Web Session Cache
- **Changes:** Cached Web frontend Base URL, Cookie, username, password, and entry Path in browser `localStorage`, restored them on page load, and documented the local persistence behavior.
- **Status:** Completed
- **Next Steps:** Avoid using the Web frontend on shared devices when credentials are cached.
- **Context:** Persistence is browser-local only and gracefully no-ops if `localStorage` is unavailable.

## [2026-06-29 19:08] Compact Selected Pane Layout
- **Changes:** Tightened Web workspace spacing, widened the usable shell, reduced teaching/meeting card padding, and gave selected-course cards narrower action columns with stacked metadata to prevent right-pane overflow.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and verify against live selected-course data with long course names or classroom labels.
- **Context:** CSS-only layout change; SDK requests and selection/drop behavior are unchanged.

## [2026-06-29 19:26] Reference Course Workspace Design
- **Changes:** Reworked the Web workspace toward the provided three-column reference: added list counts/search/sort header controls, reshaped course/teaching/selected cards, tightened metadata rows, and restyled status tags plus selected-course drop buttons.
- **Status:** Completed
- **Next Steps:** Refresh a live initialized session to compare populated course and selected-course cards against the reference screenshot.
- **Context:** Existing search, select, drop, snapshot refresh, and save-order logic remain in place; visual verification used the available local page state because fixture data URLs were blocked by browser policy.

## [2026-06-29 19:31] Minimal Teaching-Class Card
- **Changes:** Removed the teaching-class course title, course-code metadata, and ownership row from Web teaching-class cards, leaving only teacher, status/capacity, schedule/location, and the choose action.
- **Status:** Completed
- **Next Steps:** Refresh the live Web frontend and confirm the teaching-class card matches the latest reference crop.
- **Context:** This also avoids showing fallback internal course IDs such as long backend UUID-like identifiers in the teaching-class card header.

## [2026-06-29 19:34] Selected-Course Reordering
- **Changes:** Added drag-and-drop plus up/down controls for Web selected-course cards, updating the in-memory selected-class order before the existing save-order request.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and drag or move selected courses, then click 保存排序 to persist the new order.
- **Context:** The save endpoint is unchanged; this only makes the selected list reorderable before submission.

## [2026-06-29 19:37] Remove Selected-Course Move Buttons
- **Changes:** Removed the 上/下 selected-course reorder buttons and their helper/styles while keeping drag-and-drop ordering and save-order behavior.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and use drag-and-drop to adjust selected-course order.
- **Context:** The selected-course action column is back to the single 退选 button.

## [2026-06-29 19:42] Teaching-Class Label Placement
- **Changes:** Updated Web teaching-class cards to show the teaching-class name immediately before the teacher field, and added wrapping styles for long class or teacher names.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and confirm populated teaching-class cards match the requested order.
- **Context:** Selected-course cards still keep the teaching-class name in their existing title row to avoid duplicate labels.

## [2026-06-29 19:45] Teaching-Class jxbmc Source
- **Changes:** Changed the Web teaching-class label to read only `raw.jxbmc` and added a regression assertion preventing the old placeholder from returning.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and reload teaching classes so the updated script displays backend `jxbmc` values.
- **Context:** The previous `item.name` fallback could show `教学班待定` even when the backend field to display is `jxbmc`.

## [2026-06-29 19:51] Restore jxbmc From Course Rows
- **Changes:** Added a Web helper that maps course-list `raw.jxbmc` values by `jxb_id`/`do_jxb_id`, then merges the name into teaching-class detail rows before rendering.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend, rerun course search, and open a course so class cards rebuild from fresh rows.
- **Context:** Live read-only inspection showed `/xsxk/zzxkyzbjk_cxJxbWithKchZzxkYzb.html` does not return `jxbmc`; the field is present on the course-list rows from the course page endpoint.

## [2026-06-29 19:54] Teaching-Class Compact Labels
- **Changes:** Removed the visible `教学班` and `教师` labels from Web class detail rows, made the teaching-class name bold/dark, and kept teacher names as secondary text.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and reopen a course to rebuild the class cards.
- **Context:** Selected-course teacher rows reuse the same label-free teacher rendering.

## [2026-06-29 20:05] General Elective Ownership Inference
- **Changes:** Updated the Web frontend to infer 通识选修课 course ownership from the live `kcgs_list` dictionary and read-only filtered searches when result rows do not include direct ownership fields; inherited that ownership onto teaching-class cards and documented the behavior.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and search 通识选修课 to confirm labels such as 艺术修养 and 国际视野 appear on course/class cards.
- **Context:** Live inspection showed the course and teaching-class row payloads omit `kcgsmc`, while `/xkgl/common_queryKcgsPaged.html` returns the category dictionary and `kcgs_list` filtering identifies each course's category.

## [2026-06-29 20:19] Broad Course Page Loading
- **Changes:** Added a reusable Web course-page loader that fetches 1000 source rows at a time until the upstream `kcrow` range is exhausted, then wired course search to use it.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and search courses; the list should load all available rows without manual pagination.
- **Context:** Read-only live verification against the provided session loaded 1421 主修课程 rows in one broad request.

## [2026-06-29 20:22] Course List Scroll Constraint
- **Changes:** Capped the Web course list height and kept overflow inside the course-list pane; added regression coverage for the scroll constraint.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and search a large course set to confirm the left list scrolls internally.
- **Context:** The cap uses a viewport-relative clamp so the list stays usable on both compact and large screens.

## [2026-06-29 20:27] Course Card Scroll Layout
- **Changes:** Changed the scrollable Web course list to a non-shrinking flex column so each course card keeps its internal metadata layout while the list itself scrolls.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and confirm course cards no longer overlap or expose inner metadata between rows.
- **Context:** The prior scroll cap could compress grid rows visually when many courses were loaded.

## [2026-06-29 20:31] Course List Fill Height
- **Changes:** Gave the Web catalog pane a viewport-aware height and let the course list flex to fill the remaining pane space while preserving internal scrolling.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and confirm the left course list fills the blank area before scrolling.
- **Context:** Narrow layouts keep a separate viewport-relative list cap to avoid excessive page height.

## [2026-06-29 20:34] Three-Pane Internal Scrolling
- **Changes:** Applied the viewport-height pane constraint to catalog, teaching-class, and chosen-course columns, and made class/chosen lists flex-fill their panes with internal scrolling.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and confirm all three columns scroll inside their panes without exceeding one screen height.

## [2026-06-29 20:48] Web JSON Export
- **Changes:** Added separate Web exports for loaded course-list details and current selected-course snapshots, with mapped Chinese field names, preserved unmapped raw fields, topbar buttons, README notes, and regression tests.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend, initialize a live session, then use `导出课程` and `导出已选` to inspect the generated JSON files.
- **Context:** Course export uses the currently loaded/search result set; selected export uses the current chosen snapshot and omits internal `Map` indexes.

## [2026-06-29 20:54] Export Button Placement
- **Changes:** Moved `导出课程` into the course-list pane header and `导出已选` into the selected-course pane header; updated disabled-state handling, README wording, and Web placement tests.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and confirm both export actions appear in their corresponding columns.
- **Context:** The topbar now only keeps global actions such as refresh and log clearing.

## [2026-06-29 21:43] Export Schedule Completion
- **Changes:** Updated Web course export to fetch teaching-class details before writing JSON, embedded teaching-class time/location under each course, and enriched selected-course export from teaching-class details when snapshot rows omit time/location.
- **Status:** Completed
- **Next Steps:** Re-export courses from an initialized session; large course lists may take longer because the export now queries teaching-class details.
- **Context:** Course search rows do not reliably include `sksj`/`jxdd`; those fields usually live on the teaching-class detail endpoint.

## [2026-06-29 21:46] Export Detail Retry
- **Changes:** Added a reusable Web retry helper and applied it to teaching-class detail fetches for both course and selected-course exports, with up to 3 retries and short backoff delays.
- **Status:** Completed
- **Next Steps:** Re-export from a live session if transient detail requests previously produced `教学班加载错误`.
- **Context:** Retry keeps the existing 5-request concurrency cap; a detail fetch still records failure only after the retry budget is exhausted.
- **Context:** The shared pane height now caps at `100vh`; narrow layouts still switch back to auto pane height.

## [2026-06-29 20:40] Full-Height Workspace Panes
- **Changes:** Increased all three Web workspace panes to a full viewport-height cap, made course/class/chosen lists share the same flex scrolling layout, and prevented cards from shrinking inside those scrollers.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend and confirm the three lists use the full available column height without changing card styling.
- **Context:** Narrow layouts still use viewport-relative list caps so stacked columns do not become unbounded.

## [2026-06-29 21:01] Selected-Course Drop Eligibility
- **Changes:** Matched selected-course `canDrop` to the original ZZXK page predicate, added structured `dropRestriction`, rendered non-droppable Web rows as `已选`, exported drop restrictions, and regenerated API docs.
- **Status:** Completed
- **Next Steps:** Refresh the Web frontend with a live session and confirm non-droppable selected courses show `已选` while droppable rows still show `退选`.
- **Context:** Read-only live inspection showed the screenshot difference is caused by row-level `sfxkbj`: rows with `sfxkbj=0` are hidden behind `已选`; the droppable `嵌入式系统` row had `sfxkbj=1`.

## [2026-06-29 21:21] Auto Selection Design
- **Changes:** Added `docs/superpowers/specs/2026-06-29-auto-selection-design.md` covering background Node tasks, selection groups, priority upgrades, backup recovery, account-password auth renewal, Web APIs, UI, import/export, errors, and tests.
- **Status:** Completed
- **Next Steps:** Review the design document, then turn it into an implementation plan before coding.
- **Context:** The design keeps passwords and cookies in Node memory only; exported task configs intentionally omit credentials and runtime state.

## [2026-06-29 21:34] Auto Selection Review Update
- **Changes:** Revised the auto-selection design with stricter group states, task-level write locking, snapshot reconciliation, target ID matching, outcome normalization, upgrade recovery handling, config validation APIs, and expanded tests.
- **Status:** Completed
- **Next Steps:** Review the updated design, then write the implementation plan around contracts, core runners, API, UI, import/export, and docs.
- **Context:** `HOLDING` now means a group has a lower-priority placement and continues watching; only `SUCCEEDED` means the top active target is selected.
