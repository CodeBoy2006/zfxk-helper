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
