import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CookieJar } from './cookies.js';
import { decodeImage, findGapByComparison, ImageMatcher } from './image.js';
import { fetchWithCookies, resolveAppBaseUrl } from './http.js';
import { buildVerifyPayload, generateMouseTrack } from './track.js';

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const DEFAULT_TEMPLATE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'templates');

export class CaptchaSolver {
  constructor(options = {}) {
    if (!options.baseUrl) throw new Error('baseUrl is required.');
    this.appBaseUrl = resolveAppBaseUrl(options.baseUrl, options.appPath);
    this.instanceId = options.instanceId ?? 'zfcaptchaLogin';
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.jar = options.cookieJar ?? new CookieJar();
    this.matcher = options.matcher;
    this.trackOptions = options.trackOptions ?? {};
    this.gapOptions = options.gapOptions ?? {};
  }

  static async fromTemplates(options = {}) {
    return new CaptchaSolver({
      ...options,
      matcher: options.matcher ?? await ImageMatcher.fromDirectory(options.templateDir ?? DEFAULT_TEMPLATE_DIR)
    });
  }

  async solve() {
    await this.getInitialSession();
    const rtk = await this.getRTK();
    const refresh = await this.refreshCaptcha(rtk);
    const background = await this.downloadImage(refresh.si, refresh.imtk, refresh.t);
    if (!this.matcher) throw new Error('ImageMatcher is required.');
    const template = this.matcher.findMatch(background).image;
    const distance = findGapByComparison(background, template, this.gapOptions);
    const mouseTrack = generateMouseTrack(distance, this.trackOptions);
    await this.submitVerification(rtk, mouseTrack);

    const cookies = this.jar.toObject(['JSESSIONID', 'route']);
    if (!cookies.JSESSIONID) {
      throw new Error('Verification succeeded but JSESSIONID was not captured.');
    }

    return {
      status: 'success',
      cookies,
      cookieHeader: this.jar.header(),
      distance
    };
  }

  async getInitialSession() {
    const response = await this.request(`${this.appBaseUrl}/`, {
      method: 'GET',
      headers: { 'user-agent': this.userAgent }
    });
    await assertOk(response, 'initial session');
    if (!this.jar.get('JSESSIONID')) {
      throw new Error('Could not obtain JSESSIONID from the login page.');
    }
  }

  async getRTK() {
    const url = this.captchaUrl({
      type: 'resource',
      instanceId: this.instanceId,
      name: 'zfdun_captcha.js'
    });
    const response = await this.request(url, {
      method: 'GET',
      headers: { 'user-agent': this.userAgent }
    });
    const body = await textOrThrow(response, 'captcha resource');
    const match = body.match(/rtk\s*:\s*['"]([a-f0-9-]+)['"]/i);
    if (!match) throw new Error('RTK token was not found in zfdun_captcha.js.');
    return match[1];
  }

  async refreshCaptcha(rtk) {
    const response = await this.request(this.captchaUrl({
      type: 'refresh',
      rtk,
      time: Date.now(),
      instanceId: this.instanceId
    }));
    return jsonOrThrow(response, 'captcha refresh');
  }

  async downloadImage(id, imtk, t) {
    const response = await this.request(this.captchaUrl({
      type: 'image',
      id,
      imtk,
      t,
      instanceId: this.instanceId
    }));
    await assertOk(response, `captcha image ${id}`);
    return decodeImage(Buffer.from(await response.arrayBuffer()), response.headers.get('content-type') ?? '');
  }

  async submitVerification(rtk, mouseTrack) {
    const body = buildVerifyPayload({
      rtk,
      instanceId: this.instanceId,
      mouseTrack,
      userAgent: this.userAgent
    });
    const response = await this.request(`${this.appBaseUrl}/zfcaptchaLogin`, {
      method: 'POST',
      headers: {
        'user-agent': this.userAgent,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body
    });
    const result = await jsonOrThrow(response, 'captcha verification');
    if (result.status !== 'success') {
      throw new Error(`Captcha verification failed: ${result.message ?? result.status ?? 'unknown error'}`);
    }
  }

  captchaUrl(params) {
    const url = new URL(`${this.appBaseUrl}/zfcaptchaLogin`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  request(url, init = {}) {
    return fetchWithCookies(url, init, {
      fetchImpl: this.fetchImpl,
      jar: this.jar
    });
  }
}

export async function solveZfCaptcha(options = {}) {
  const solver = await CaptchaSolver.fromTemplates(options);
  return solver.solve();
}

export function formatLegacySolveResponse(result) {
  const data = {
    jsessionid: result.cookies.JSESSIONID
  };
  if (result.cookies.route) data.route = result.cookies.route;
  return { status: 'success', data };
}

async function assertOk(response, label) {
  if (!response.ok) {
    throw new Error(`Failed to load ${label}: HTTP ${response.status} ${await response.text()}`);
  }
}

async function textOrThrow(response, label) {
  await assertOk(response, label);
  return response.text();
}

async function jsonOrThrow(response, label) {
  const text = await textOrThrow(response, label);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse ${label} JSON: ${error.message}`);
  }
}
