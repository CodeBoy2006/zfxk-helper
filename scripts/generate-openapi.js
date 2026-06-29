import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { writeOpenApiDocument } from '../src/docs/openapi.js';
import packageJson from '../package.json' with { type: 'json' };

const outputPath = resolve('docs/openapi.json');

await mkdir(dirname(outputPath), { recursive: true });
await writeOpenApiDocument(outputPath, { version: packageJson.version });
