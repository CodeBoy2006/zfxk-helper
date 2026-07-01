# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`zfxk` (正方选课助手) is a Node.js ESM SDK and local Web workbench for the Zhengfang (ZFXK/ZZXK) course selection system. It interfaces directly with course selection HTTP APIs — not via browser DOM automation — supporting course search, teaching-class lookup, choose/drop/reorder, and automated background selection tasks.

## Commands

| Command | Description |
|---|---|
| `npm test` | Run all tests via Node.js built-in test runner (`node --test`) |
| `npm run web` | Start the local web server on port 4173 (`node scripts/serve-web.js`) |
| `npm run docs` | Generate OpenAPI spec + TypeDoc API HTML docs |
| `npm run openapi` | Generate OpenAPI 3.0.3 spec only |

No build step — plain ESM JavaScript runs directly on Node 20+.

## Architecture

### Transport abstraction

`ZfxkClient` accepts a `Transport` interface with `get()`/`post()`. Two implementations:
- **`HttpTransport`** — real HTTP via `fetch()`, sends `application/x-www-form-urlencoded` POST, attaches cookies via headers
- **`MemoryTransport`** — in-memory mock for tests, register routes and queue responses

All services use `client.transport.post()` for API calls, making the SDK fully testable without network.

### Service composition

`ZfxkClient` composes services exposed as properties: `catalog`, `chosen`, `selection`, `textbook`, `waitlist`, `listener`. Each receives the client instance and calls its transport.

### Runtime context

`RuntimeContext` encapsulates the session state parsed from hidden `<input>` fields on the ZFXK entry page: term, student IDs, active course type (`xkkzId`, `kklxdm`), feature switches (`canSelect`, `canDrop`, `useWeight`, etc.), and raw field values. Context is loaded via `loadRuntimeContext()` and used by `buildContextRequest()` for form payloads.

Two context sources exist:
1. **Entry page HTML** — `loadRuntimeContext()` parses hidden fields; falls back to `first*` prefixed fields when active ones are blank
2. **Display page** — `loadCourseTypeDisplayContext()` loads additional hidden fields (`rwlx`, `xklc`, capacity controls) needed for save operations; may be rejected (HTTP 911) and has an `allowFallback` option

### Interactive policy callbacks

`selection.choose()` and `selection.drop()` accept a `policy` object with async callbacks: `confirm()`, `chooseTextbooks()`, `chooseChildClasses()`, `chooseWeight()`, `smsCode()`. This lets both the interactive Web UI and automated background tasks use the same selection workflow.

### Auto-selection state machines

Background tasks use explicit state machines:
- **Task states:** `queued → running → paused/succeeded/failed/cancelled`
- **Group states:** `WATCHING → PRECHECK → DROP_BACKUP → CHOOSE_TARGET → RECOVER_BACKUP → SELECTED`
- `group-runner.js` — per-group state machine
- `upgrade-runner.js` — drop low-priority → choose high-priority → recover on failure
- `task-runner.js` — per-task polling loop with exponential backoff on errors

### Web server

`scripts/serve-web.js` is a `node:http` server (no Express). Routes:
- Serves static files from `web/`
- `POST /api/proxy/get` and `/api/proxy/post` — proxy to school system
- `POST /api/captcha/solve` — slider captcha solver
- `POST /api/login/zfcaptcha` — login flow
- `/api/auto-selection/*` — task CRUD

### Directory layout

```
src/           — SDK: client, services, transport, auth, captcha, auto-selection
web/           — Static frontend: index.html, setup.html, auto-selection.html + JS/CSS
scripts/       — serve-web.js (dev server), generate-openapi.js
test/          — Node test runner tests
docs/          — Generated API docs, OpenAPI spec, screenshots, design docs
```

## Testing

Uses Node.js built-in `node:test` + `node:assert/strict`. Test files:
- `test/sdk.test.js` — core client, context, mappers, services
- `test/auth.test.js` — login flow
- `test/captcha.test.js` — captcha solving
- `test/auto-selection.test.js` — task lifecycle, groups, upgrade flow
- `test/course-filters.test.js` — client-side filtering
- `test/web.test.js` — frontend contract tests
- `test/docs.test.js` — documentation generation assertions

`MemoryTransport` is used extensively in tests to avoid real network calls.

## Key constraints

- **Node.js ≥ 20** required (ESM, `node:test`)
- **No bundler or TypeScript compilation** — `.js` runs directly; `.d.ts` is for editor hints and TypeDoc only
- **Browser code must not import `node:` modules** — `web/` files import browser-safe modules only; `src/auth/login.js` uses `node:crypto` and must stay server-side
- **Credentials never persisted to disk** — exported auto-selection configs omit passwords and cookies
- **Only 2 runtime dependencies** — `jpeg-js` and `pngjs` (captcha image decoding) — keep it that way
- **`gnmkdm` function code** must be preserved from entry page through Display and save requests, otherwise operations return `无操作权限！`
