# zfxk

`zfxk` is a small HTTP workflow SDK for the ZFXK/ZZXK course-selection pages. It does not automate page clicks or depend on DOM state. Callers provide an already-authenticated session cookie and the hidden-field runtime context from the course-selection page.

## Install

TypeDoc is installed as a development dependency for API documentation generation.

```bash
npm install
npm test
```

## Basic Usage

```js
import { createZfxkClient, loadRuntimeContext } from 'zfxk';

const context = loadRuntimeContext({
  baseUrl: 'https://example.edu.cn/jwglxt',
  html: initialSelectionPageHtml
});

const client = createZfxkClient({
  baseUrl: 'https://example.edu.cn/jwglxt',
  auth: { type: 'cookie', cookie: 'JSESSIONID=...' },
  context,
  mode: 'commit'
});

const courses = await client.catalog.searchCourses({
  keyword: '数据库',
  page: { start: 1, size: 20 }
});

const classes = await client.catalog.getTeachingClasses(courses[0].courseId);
const target = classes.find((item) => item.flags.canSelect);

const result = await client.selection.choose(
  { courseId: target.courseId, classId: target.classId },
  {
    confirm: async () => true,
    chooseTextbooks: async ({ requiredItems }) => requiredItems.map((item) => item.id)
  }
);

console.log(result.status);
```

If you already have a valid session cookie, the client can fetch the selection page and parse hidden fields automatically:

```js
const client = createZfxkClient({
  baseUrl: 'https://example.edu.cn/jwglxt',
  auth: { type: 'cookie', cookie: process.env.ZFXK_COOKIE },
  mode: 'commit'
});

await client.bootstrapFromPage({
  path: '/xsxk/zzxkyzb_cxZzxkYzbIndex.html?gnmkdm=N253512'
});
```

If the cookie is expired or the page is not a supported selection entry, `bootstrapFromPage()` throws `CONTEXT_NOT_FOUND`.
Some ZFXK entry pages leave `xkkz_id` and `kklxdm` blank until the browser runs page scripts; the parser also reads the original `firstXkkzId`, `firstKklxdm`, `firstKklxmc`, `firstXkkzXh`, `firstNjdmId`, and `firstZyhId` hidden fields used by those scripts.

## Captcha Cookie Helper

The SDK includes the `zfCaptcha` slider-captcha solver as an optional helper. It verifies the Zhengfang `zfcaptchaLogin` slider flow and returns the cookies observed during that captcha flow:

```js
import { formatCookieHeader, solveZfCaptcha } from 'zfxk';

const captcha = await solveZfCaptcha({
  baseUrl: 'https://example.edu.cn/jwglxt'
});

const cookie = formatCookieHeader(captcha.cookies);
```

This helper does not submit username/password credentials. Use the returned cookie as a bootstrap input only after confirming that your school deployment treats the captcha flow as sufficient for the page you are loading, or run any separate login workflow required by that deployment.

## Login With zfCaptcha

`loginWithZfCaptcha()` runs the login-page flow used by recent Zhengfang deployments: solve `zfcaptchaLogin`, fetch the RSA public key, encrypt the password, run the identity/lock guards, submit the timestamped login form, and return the authenticated cookies.

```js
import { createZfxkClient, loginWithZfCaptcha } from 'zfxk';

const login = await loginWithZfCaptcha({
  baseUrl: 'https://example.edu.cn/jwglxt',
  username: process.env.ZFXK_USERNAME,
  password: process.env.ZFXK_PASSWORD,
  maxCaptchaAttempts: 3
});

const client = createZfxkClient({
  baseUrl: 'https://example.edu.cn/jwglxt',
  auth: { type: 'cookie', cookie: login.cookieHeader },
  mode: 'commit'
});
```

The helper retries when the slider verification fails. Interactive second factors are reported explicitly: `SMS_LOGIN_REQUIRED` for SMS verification and `IDENTITY_CONFIRMATION_REQUIRED` for identity-confirmation dialogs.

## Implemented Surface

- `loadRuntimeContext()` parses hidden fields into a structured runtime context.
- `parseCourseTypeOptions()` reads the original entry-page tab calls and extracts selectable course-type contexts.
- `loginWithZfCaptcha()` solves the Zhengfang slider captcha, submits username/password login, and returns the authenticated cookie header.
- `client.bootstrapFromPage()` fetches a selection page with the configured cookie and parses hidden fields automatically.
- `client.catalog.searchCourses()` wraps `/xsxk/zzxkyzb_cxZzxkYzbPartDisplay.html`.
- `client.catalog.getTeachingClasses()` wraps `/xsxk/zzxkyzbjk_cxJxbWithKchZzxkYzb.html`.
- `client.chosen.snapshot()` wraps `/xsxk/zzxkyzb_cxZzxkYzbChoosedDisplay.html`.
- `client.selection.choose()` runs title checks, conflict checks, textbook check, save, and snapshot refresh.
- `client.selection.drop()` supports title-check, SMS-check, delete, and snapshot refresh.
- `client.selection.reorder()` saves ordinary wish ordering.
- Minimal textbook, waitlist, and listener helpers are exposed as direct endpoint wrappers.

The original `zzxkYzb*.js` files are kept at the repository root as reference material for endpoint names and flag semantics.

## Documentation

Generate the OpenAPI document and TypeDoc API reference:

```bash
npm run docs
```

Generated outputs:

- `docs/openapi.json`: OpenAPI 3.0.3 description of the SDK-facing operations.
- `docs/api/`: TypeDoc HTML API reference generated from `src/index.d.ts`.

You can also run each generator separately:

```bash
npm run openapi
npm run docs:api
```

## Web Frontend

Run the restored course-selection workspace:

```bash
npm run web
```

Open:

```text
http://127.0.0.1:4173/
```

Fill in:

- `Base URL`: the school system root, for example `https://example.edu.cn/jwglxt`.
- `Cookie`: the authenticated browser cookie copied from the school system, filled by `登录获取 Cookie`, or filled by the local captcha-only helper.
- `用户名` / `密码`: optional credentials used only by the local Node process when `登录获取 Cookie` is clicked.
- `Path`: the course-selection entry page used to parse hidden runtime fields.

The browser calls the local Node server under `/api/proxy/*`, `/api/captcha/solve`, and `/api/login/zfcaptcha`. The Node proxy then sends requests to the school system with the provided `Cookie` header, avoiding the browser restriction that blocks frontend JavaScript from setting raw cross-origin cookies. Cookies stay in the local browser/server process and are not written to project files.

After initialization, the Web frontend reads the real selection page and dictionary endpoints to render the course-type switch and advanced filter bar. The course-type switch is populated from the school's own entry-page tabs, so it can switch the current display between entries such as 主修课程, 跨专业个性化课程, 通识选修课, and 体育分项 when those contexts are present. The filter bar supports keyword search plus the school system's filter parameters such as opening college, grade, student college, major, course category, course nature, course ownership, teaching mode, weekday, period, teaching-class name, retake, capacity, and schedule-conflict flags. When the backend returns course ownership for general electives, the course cards and teaching-class cards show it directly.
