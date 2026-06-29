import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CaptchaSolver,
  buildVerifyPayload,
  formatCookieHeader,
  generateFingerprint,
  generateMouseTrack,
  ImageMatcher,
  findGapByComparison,
  resolveAppBaseUrl
} from '../src/captcha/index.js';

test('captcha helpers normalize base URLs and cookie headers', () => {
  assert.equal(resolveAppBaseUrl('https://example.edu.cn'), 'https://example.edu.cn/jwglxt');
  assert.equal(resolveAppBaseUrl('https://example.edu.cn/jwglxt/'), 'https://example.edu.cn/jwglxt');
  assert.equal(formatCookieHeader({ JSESSIONID: 'SID', route: 'R1' }), 'JSESSIONID=SID; route=R1');
});

test('captcha image matcher finds a template and slider distance', () => {
  const template = makeImage(90, 6, () => [20, 30, 40]);
  const background = makeImage(90, 6, (x) => (x >= 28 && x <= 33 ? [220, 230, 240] : [20, 30, 40]));
  const matcher = new ImageMatcher([{ name: 'fixture', image: template }]);

  assert.equal(generateFingerprint(template), generateFingerprint(background));
  assert.equal(matcher.findMatch(background).name, 'fixture');
  assert.equal(findGapByComparison(background, template, { scanStartX: 5, scanEndPadding: 5, minMaxDiff: 1 }), 28);
});

test('captcha verify payload encodes mouse track and browser metadata', () => {
  const track = generateMouseTrack(30, {
    now: () => 1000,
    random: () => 0,
    startX: 100,
    startYBase: 50,
    startYRange: 1,
    minDuration: 300,
    durationRange: 1,
    minStep: 5,
    stepRange: 1
  });
  const payload = buildVerifyPayload({
    rtk: 'abc-123',
    instanceId: 'zfcaptchaLogin',
    mouseTrack: track,
    userAgent: 'UA',
    now: () => 456
  });

  assert.equal(payload.get('type'), 'verify');
  assert.equal(payload.get('rtk'), 'abc-123');
  assert.deepEqual(JSON.parse(Buffer.from(payload.get('mt'), 'base64').toString('utf8')).at(-1), { x: 130, y: 50, t: 1300 });
  assert.deepEqual(JSON.parse(Buffer.from(payload.get('extend'), 'base64').toString('utf8')), {
    appName: 'Netscape',
    userAgent: 'UA',
    appVersion: 'UA'
  });
});

test('captcha solver loads bundled templates by default', async () => {
  const solver = await CaptchaSolver.fromTemplates({ baseUrl: 'https://example.edu.cn/jwglxt' });

  assert.equal(solver.matcher.templates.size, 10);
});

function makeImage(width, height, pixel) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [r, g, b, a = 255] = pixel(x, y);
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
  }
  return { width, height, data };
}
