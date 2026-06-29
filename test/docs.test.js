import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import packageJson from '../package.json' with { type: 'json' };
import typedocConfig from '../typedoc.json' with { type: 'json' };
import { buildOpenApiDocument, writeOpenApiDocument } from '../src/docs/openapi.js';

test('buildOpenApiDocument exposes SDK schemas and workflow-oriented paths', () => {
  const document = buildOpenApiDocument({ version: '9.9.9' });

  assert.equal(document.openapi, '3.0.3');
  assert.equal(document.info.title, 'zfxk SDK API');
  assert.equal(document.info.version, '9.9.9');
  assert.equal(document.components.schemas.Course.type, 'object');
  assert.equal(document.components.schemas.TeachingClass.required.includes('submitClassId'), true);
  assert.equal(document.components.schemas.SelectionSnapshot.properties.selectedClasses.type, 'array');
  assert.equal(document.paths['/sdk/context/bootstrap-from-page'].post.operationId, 'bootstrapFromPage');
  assert.equal(document.paths['/sdk/catalog/courses'].post.operationId, 'searchCourses');
  assert.equal(document.paths['/sdk/selection/choose'].post.operationId, 'chooseCourse');
  assert.equal(document.paths['/sdk/selection/drop'].post.responses['200'].description, 'Drop result');
});

test('writeOpenApiDocument writes stable JSON output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'zfxk-openapi-'));
  const outputPath = join(dir, 'openapi.json');

  await writeOpenApiDocument(outputPath, { version: '1.2.3' });
  const document = JSON.parse(await readFile(outputPath, 'utf8'));

  assert.equal(document.info.version, '1.2.3');
  assert.ok(document.paths['/sdk/chosen/snapshot']);
});

test('package scripts wire OpenAPI and TypeDoc generation', () => {
  assert.equal(packageJson.scripts.openapi, 'node scripts/generate-openapi.js');
  assert.equal(packageJson.scripts['docs:api'], 'typedoc');
  assert.equal(packageJson.scripts.docs, 'npm run openapi && npm run docs:api');
  assert.equal(packageJson.devDependencies.typedoc.length > 0, true);
});

test('typedoc config targets public declarations and docs/api output', () => {
  assert.deepEqual(typedocConfig.entryPoints, ['src/index.d.ts']);
  assert.equal(typedocConfig.out, 'docs/api');
  assert.equal(typedocConfig.readme, 'README.md');
  assert.equal(typedocConfig.excludePrivate, true);
  assert.equal(typedocConfig.excludeInternal, true);
});
