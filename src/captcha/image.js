import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const DEFAULT_GAP_OPTIONS = Object.freeze({
  scanStartX: 60,
  scanEndPadding: 20,
  minMaxDiff: 10000,
  thresholdRatio: 0.35
});

export class ImageMatcher {
  constructor(entries = []) {
    this.templates = new Map();
    for (const entry of entries) {
      this.add(entry.name, entry.image);
    }
  }

  static async fromDirectory(templateDir) {
    const matcher = new ImageMatcher();
    for (const path of await listImageFiles(templateDir)) {
      const image = decodeImage(await readFile(path), extname(path));
      matcher.add(path, image);
    }
    if (matcher.templates.size === 0) {
      throw new Error(`Template directory is empty or contains no supported images: ${templateDir}`);
    }
    return matcher;
  }

  add(name, image) {
    const fingerprint = generateFingerprint(image);
    this.templates.set(fingerprint, { name, image, fingerprint });
  }

  findMatch(image) {
    const fingerprint = generateFingerprint(image);
    const match = this.templates.get(fingerprint);
    if (!match) {
      throw new Error(`No template matched fingerprint ${fingerprint}`);
    }
    return match;
  }
}

export function decodeImage(buffer, contentTypeOrExtension = '') {
  const hint = String(contentTypeOrExtension).toLowerCase();
  if (hint.includes('jpeg') || hint.includes('jpg')) {
    return jpeg.decode(Buffer.from(buffer), { useTArray: true });
  }
  if (hint.includes('png') || hint === '' || hint === '.png') {
    const png = PNG.sync.read(Buffer.from(buffer));
    return { width: png.width, height: png.height, data: png.data };
  }
  throw new Error(`Unsupported image type: ${contentTypeOrExtension}`);
}

export function generateFingerprint(image) {
  assertImage(image);
  const points = [
    [0, 0],
    [image.width - 1, 0],
    [0, image.height - 1],
    [image.width - 1, image.height - 1]
  ];
  return points.map(([x, y]) => {
    const [r, g, b] = pixelAt(image, x, y);
    return `${r}-${g}-${b}`;
  }).join('_');
}

export function findGapByComparison(background, template, options = {}) {
  assertSameSize(background, template);
  const settings = { ...DEFAULT_GAP_OPTIONS, ...options };
  const scanStartX = clamp(settings.scanStartX, 0, background.width - 1);
  const scanEndX = clamp(background.width - settings.scanEndPadding, scanStartX + 1, background.width);
  const diffs = new Array(background.width).fill(0);

  for (let x = scanStartX; x < scanEndX; x += 1) {
    let columnDiff = 0;
    for (let y = 0; y < background.height; y += 1) {
      const bg = pixelAt(background, x, y);
      const tpl = pixelAt(template, x, y);
      columnDiff += Math.abs(bg[0] - tpl[0]) + Math.abs(bg[1] - tpl[1]) + Math.abs(bg[2] - tpl[2]);
    }
    diffs[x] = columnDiff;
  }

  let maxDiff = 0;
  for (let x = scanStartX; x < scanEndX; x += 1) {
    if (diffs[x] > maxDiff) maxDiff = diffs[x];
  }
  if (maxDiff < settings.minMaxDiff) {
    throw new Error('Image difference is too small to locate a slider gap.');
  }

  const threshold = Math.floor(maxDiff * settings.thresholdRatio);
  for (let x = scanStartX; x < scanEndX; x += 1) {
    if (diffs[x] > threshold) return x;
  }

  throw new Error('No column crossed the slider-gap threshold.');
}

function pixelAt(image, x, y) {
  const offset = (y * image.width + x) * 4;
  return [
    image.data[offset],
    image.data[offset + 1],
    image.data[offset + 2],
    image.data[offset + 3]
  ];
}

async function listImageFiles(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...await listImageFiles(path));
    } else if (/\.(png|jpe?g)$/i.test(entry.name)) {
      result.push(path);
    }
  }
  return result;
}

function assertSameSize(a, b) {
  assertImage(a);
  assertImage(b);
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`Image dimensions differ: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
}

function assertImage(image) {
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) || !image.data) {
    throw new Error('Expected an image with width, height, and RGBA data.');
  }
  if (image.width <= 0 || image.height <= 0 || image.data.length < image.width * image.height * 4) {
    throw new Error('Image dimensions do not match RGBA data length.');
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
