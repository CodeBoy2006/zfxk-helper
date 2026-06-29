import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import packageJson from '../package.json' with { type: 'json' };

test('web frontend files expose the restored course-selection workspace', async () => {
  const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../web/styles.css', import.meta.url), 'utf8');

  assert.match(html, /id="sessionForm"/);
  assert.match(html, /id="courseList"/);
  assert.match(html, /id="chosenPanel"/);
  assert.match(html, /id="activityLog"/);
  assert.match(app, /createZfxkClient/);
  assert.match(app, /bootstrapFromPage/);
  assert.match(app, /selection\.choose/);
  assert.match(app, /selection\.drop/);
  assert.match(app, /selection\.reorder/);
  assert.match(css, /grid-template-columns/);
});

test('web script and static server are wired in package.json', async () => {
  const server = await readFile(new URL('../scripts/serve-web.js', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts.web, 'node scripts/serve-web.js');
  assert.match(server, /createServer/);
  assert.match(server, /web\/index\.html/);
});
