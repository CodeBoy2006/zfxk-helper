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
