**Source Visual Truth**
- Source: `/Users/codeboy/.codex/attachments/074cf68a-41b5-41a5-8385-f2cb6ca7dea2/image-1.png`
- Implementation: `http://127.0.0.1:4175/auto-selection`
- Desktop screenshot: `/Users/codeboy/Downloads/auto-selection-desktop-populated-final-2026-06-29T14-40-41-903Z.png`
- Mobile screenshot: `/Users/codeboy/Downloads/auto-selection-mobile-populated-final-2026-06-29T14-42-32-524Z.png`
- Full-view comparison: `/private/tmp/auto-selection-design-comparison-final-verified.png`
- Viewport: desktop 1536x900, mobile 390x844
- State: populated local draft with three target rows; no live school account or running task. Top course-type navigation is intentionally removed per follow-up request and replaced with a main-page return button.

**Findings**
- No actionable P0/P1/P2 findings remain.

**Fidelity Surfaces**
- Fonts and typography: system UI stack matches the existing app and keeps the dense administrative tone. Small table labels, badges, and form labels remain readable at desktop and mobile widths.
- Spacing and layout rhythm: the standalone page keeps the reference structure: dark top bar, left task config, center group/target/teaching-class area, and right task status/events. The top course-type tabs are intentionally omitted and replaced by a main-page return affordance.
- Colors and tokens: dark navy topbar, white cards, blue primary actions, green/orange/red state badges, and pale dividers align with the reference palette and existing project tokens.
- Image quality and assets: the reference screen has no photographic or illustrative image assets. UI icons are represented with native controls/text buttons because the project has no installed icon library.
- Copy and content: page copy is localized and task-specific. Export/import copy explicitly avoids saving password or Cookie.
- Responsiveness: desktop has no body-level horizontal overflow. Mobile stacks the three panes and keeps the wide target table inside its own horizontal scroll region.
- Interactions: help dialog, topbar collapse, draft group switching, target-row drag/drop wiring, target add/remove/reorder, task start/pause/resume/cancel, event polling, import, and export are implemented.

**Patches Made Since QA**
- Fixed hidden auto-selection switch causing desktop horizontal overflow.
- Removed the standalone page course-type navigation and added a `返回主页面` button.
- Compressed the left task configuration so start/pause/cancel controls are visible in the first desktop viewport.
- Replaced long English target statuses with short Chinese status labels.
- Reduced target-row action button width.
- Prevented populated target tables from widening the mobile page.

**Follow-up Polish**
- P3: When an icon library is added to the project, replace compact text actions like `上`/`下`/`删` with consistent icon buttons and tooltips.
- P3: A live authenticated task would allow a final pass on real event density and real selected-placement status text.

final result: passed
