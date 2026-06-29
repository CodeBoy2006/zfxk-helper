# zfxk

`zfxk` is a small HTTP workflow SDK for the ZFXK/ZZXK course-selection pages. It does not automate page clicks or depend on DOM state. Callers provide an already-authenticated session cookie and the hidden-field runtime context from the course-selection page.

## Install

This repository has no runtime dependencies. TypeDoc is installed as a development dependency for API documentation generation.

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
const target = classes.find((item) => item.flags.canSelect && !item.flags.full);

const result = await client.selection.choose(
  { courseId: target.courseId, classId: target.classId },
  {
    confirm: async () => true,
    chooseTextbooks: async ({ requiredItems }) => requiredItems.map((item) => item.id)
  }
);

console.log(result.status);
```

## Implemented Surface

- `loadRuntimeContext()` parses hidden fields into a structured runtime context.
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
