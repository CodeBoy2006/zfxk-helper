import { constants, createPublicKey, publicEncrypt } from 'node:crypto';

import { CaptchaSolver, DEFAULT_USER_AGENT } from '../captcha/solver.js';
import { CookieJar } from '../captcha/cookies.js';
import { fetchWithCookies, resolveAppBaseUrl } from '../captcha/http.js';

const DEFAULT_LOGIN_PATH = '/';
const DEFAULT_MAX_CAPTCHA_ATTEMPTS = 3;

export class ZfLoginError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'ZfLoginError';
    this.code = code;
    if (details.cause) this.cause = details.cause;
    for (const [key, value] of Object.entries(details)) {
      if (key !== 'cause' && value !== undefined) this[key] = value;
    }
  }
}

export async function loginWithZfCaptcha(options = {}) {
  const {
    baseUrl,
    username,
    password,
    appPath,
    maxCaptchaAttempts = DEFAULT_MAX_CAPTCHA_ATTEMPTS
  } = options;
  if (!baseUrl) throw new Error('baseUrl is required.');
  if (!username) throw new Error('username is required.');
  if (!password) throw new Error('password is required.');

  const appBaseUrl = resolveAppBaseUrl(baseUrl, appPath);
  const attempts = Math.max(1, Number(maxCaptchaAttempts) || DEFAULT_MAX_CAPTCHA_ATTEMPTS);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const cookieJar = options.cookieJar ?? new CookieJar();
    try {
      return await loginAttempt({
        ...options,
        appBaseUrl,
        cookieJar,
        attempt
      });
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isCaptchaRetryable(error)) throw error;
    }
  }

  throw lastError;
}

export function encryptZfPassword(password, publicKey) {
  if (!publicKey?.modulus || !publicKey?.exponent) {
    throw new ZfLoginError('PUBLIC_KEY_MISSING', 'RSA modulus/exponent are required.');
  }
  const key = createPublicKey({
    key: {
      kty: 'RSA',
      n: base64ToBase64Url(publicKey.modulus),
      e: base64ToBase64Url(publicKey.exponent)
    },
    format: 'jwk'
  });
  return publicEncrypt(
    { key, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(String(password), 'utf8')
  ).toString('base64');
}

async function loginAttempt(options) {
  const {
    appBaseUrl,
    username,
    password,
    cookieJar,
    attempt,
    fetchImpl = globalThis.fetch,
    now = Date.now,
    loginPath = DEFAULT_LOGIN_PATH,
    userAgent = DEFAULT_USER_AGENT,
    solveCaptcha = solveCaptchaWithBundledTemplates,
    checkIdentityConfirmation = true,
    checkLoginLock = true
  } = options;

  try {
    await solveCaptcha({
      ...options,
      baseUrl: appBaseUrl,
      cookieJar,
      fetchImpl,
      attempt
    });
  } catch (error) {
    throw new ZfLoginError('CAPTCHA_VERIFICATION_FAILED', error.message, { cause: error, attempt });
  }

  const loginPageUrl = resolveLoginUrl(appBaseUrl, loginPath);
  const loginPageResponse = await requestWithJar(loginPageUrl, {
    method: 'GET',
    headers: { 'user-agent': userAgent }
  }, { fetchImpl, cookieJar });
  const loginHtml = await textOrThrow(loginPageResponse, 'login page');
  const loginPage = parseLoginPage(loginHtml);

  if (valueOf(loginPage, 'dxsyrz', '0') === '1') {
    throw new ZfLoginError('SMS_LOGIN_REQUIRED', 'This login flow requires SMS verification and cannot be completed non-interactively.');
  }

  const encryptedPassword = await buildSubmittedPassword({
    appBaseUrl,
    password,
    loginPage,
    fetchImpl,
    cookieJar,
    now,
    userAgent,
    publicKey: options.publicKey
  });

  if (checkIdentityConfirmation) {
    await assertNoIdentityConfirmation({
      appBaseUrl,
      username,
      fetchImpl,
      cookieJar,
      userAgent
    });
  }

  if (checkLoginLock && valueOf(loginPage, 'mmsrddcshkzfs', '0') === '1') {
    await assertLoginLockAllowsAttempt({
      appBaseUrl,
      username,
      loginPage,
      fetchImpl,
      cookieJar,
      now,
      userAgent
    });
  }

  await logoutPreviousAccount({
    appBaseUrl,
    loginPage,
    fetchImpl,
    cookieJar,
    userAgent
  });

  const language = resolveLanguage(loginPage, loginHtml, options.language);
  const body = buildLoginBody(loginPage, {
    username,
    password: encryptedPassword,
    language
  });
  const actionUrl = appendTimestamp(resolveLoginUrl(appBaseUrl, loginPage.action), now());
  const response = await requestWithJar(actionUrl, {
    method: 'POST',
    headers: {
      'user-agent': userAgent,
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body
  }, { fetchImpl, cookieJar });
  const responseText = await cloneText(response);
  assertLoginSucceeded(response, responseText, actionUrl);

  return {
    status: 'success',
    cookies: cookieJar.toObject(),
    cookieHeader: cookieJar.header(),
    responseUrl: response.finalUrl ?? response.url ?? actionUrl,
    attempts: attempt
  };
}

async function solveCaptchaWithBundledTemplates(options) {
  const solver = await CaptchaSolver.fromTemplates(options);
  return solver.solve();
}

async function buildSubmittedPassword({ appBaseUrl, password, loginPage, fetchImpl, cookieJar, now, userAgent, publicKey }) {
  if (valueOf(loginPage, 'mmsfjm', '1') === '0') return password;
  const key = publicKey ?? await fetchPublicKey({ appBaseUrl, fetchImpl, cookieJar, now, userAgent });
  return encryptZfPassword(password, key);
}

async function fetchPublicKey({ appBaseUrl, fetchImpl, cookieJar, now, userAgent }) {
  const response = await requestWithJar(`${appEndpoint(appBaseUrl, 'xtgl/login_getPublicKey.html')}?time=${encodeURIComponent(now())}`, {
    method: 'GET',
    headers: { 'user-agent': userAgent }
  }, { fetchImpl, cookieJar });
  return jsonOrThrow(response, 'public key');
}

async function assertNoIdentityConfirmation({ appBaseUrl, username, fetchImpl, cookieJar, userAgent }) {
  const response = await postForm(appEndpoint(appBaseUrl, 'xtgl/yhgl_cxXxqrCheck.html'), {
    yhm: username
  }, { fetchImpl, cookieJar, userAgent });
  const data = await parseLooseJson(response, 'identity confirmation check');
  if (data === true || data === 'true') {
    throw new ZfLoginError('IDENTITY_CONFIRMATION_REQUIRED', 'This account requires interactive identity confirmation before login.');
  }
}

async function assertLoginLockAllowsAttempt({ appBaseUrl, username, loginPage, fetchImpl, cookieJar, now, userAgent }) {
  const response = await postForm(appEndpoint(appBaseUrl, 'xtgl/login_cxDlxgxx.html'), {
    yhm: username
  }, { fetchImpl, cookieJar, userAgent });
  const data = String(await parseLooseJson(response, 'login lock check'));
  if (data === '0') throw new ZfLoginError('USER_NOT_FOUND', 'The login page reported that this user does not exist.');

  const [countText, timestampText] = data.split('_');
  const maxFailures = Number(valueOf(loginPage, 'yzcskz', Number.POSITIVE_INFINITY));
  const lockMinutes = Number(valueOf(loginPage, 'dlsbsdsj', 0));
  const count = Number(countText);
  const lastFailureAt = Number(timestampText);
  if (Number.isFinite(count) && count >= maxFailures) {
    const unlockAt = lastFailureAt + lockMinutes * 60 * 1000;
    if (unlockAt > now()) {
      throw new ZfLoginError('LOGIN_LOCKED', 'The account is temporarily locked after too many failed login attempts.', {
        secondsRemaining: Math.ceil((unlockAt - now()) / 1000)
      });
    }
    await postForm(appEndpoint(appBaseUrl, 'xtgl/login_cxUpdateDlsbcs.html'), {
      yhm: username
    }, { fetchImpl, cookieJar, userAgent });
  }
}

async function logoutPreviousAccount({ appBaseUrl, loginPage, fetchImpl, cookieJar, userAgent }) {
  await postForm(appEndpoint(appBaseUrl, 'xtgl/login_logoutAccount.html'), {
    csrfTokenLogout: valueOf(loginPage, 'csrfTokenLogout', '')
  }, { fetchImpl, cookieJar, userAgent });
}

function buildLoginBody(loginPage, values) {
  const body = new URLSearchParams();
  for (const input of loginPage.inputs) {
    const name = input.name;
    if (!name || isIgnoredInputType(input.type)) continue;
    body.append(name, input.value ?? '');
  }
  body.set('yhm', values.username);
  body.set('mm', values.password);
  body.set('hidMm', values.password);
  body.set('language', values.language);
  return body;
}

function parseLoginPage(html) {
  const formMatch = String(html).match(/<form\b[^>]*>/i);
  if (!formMatch) throw new ZfLoginError('LOGIN_PAGE_PARSE_FAILED', 'No login form was found.');
  const formAttrs = parseAttributes(formMatch[0]);
  const inputs = [...String(html).matchAll(/<input\b[^>]*>/gi)].map((match) => parseAttributes(match[0]));
  return {
    action: formAttrs.action || '/xtgl/login_slogin.html',
    inputs,
    byId: indexBy(inputs, 'id'),
    byName: indexBy(inputs, 'name')
  };
}

function resolveLanguage(loginPage, html, language) {
  if (valueOf(loginPage, 'sfzywqh', '0') !== '1') return 'zh_CN';
  return language ?? parseEnabledLanguage(html) ?? 'zh_CN';
}

function parseEnabledLanguage(html) {
  const match = String(html).match(/class=["'][^"']*\bbtn-lang-enabled\b[^"']*["'][^>]*\bvalue=["']([^"']+)["']/i)
    ?? String(html).match(/\bvalue=["']([^"']+)["'][^>]*class=["'][^"']*\bbtn-lang-enabled\b[^"']*["']/i);
  return match ? decodeHtml(match[1]) : null;
}

function valueOf(loginPage, key, fallback) {
  return loginPage.byId.get(key)?.value
    ?? loginPage.byName.get(key)?.value
    ?? fallback;
}

function parseAttributes(tag) {
  const attrs = {};
  const attrPattern = /([:@A-Za-z_][:@\w.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of String(tag).matchAll(attrPattern)) {
    const name = match[1].toLowerCase();
    if (name === 'input' || name === 'form') continue;
    attrs[name] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

function decodeHtml(value) {
  return String(value)
    .replaceAll('&quot;', '"')
    .replaceAll('&#34;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function indexBy(items, key) {
  const map = new Map();
  for (const item of items) {
    if (item[key] && !map.has(item[key])) map.set(item[key], item);
  }
  return map;
}

function isIgnoredInputType(type) {
  return ['button', 'submit', 'reset', 'image'].includes(String(type ?? '').toLowerCase());
}

function appEndpoint(appBaseUrl, path) {
  return new URL(path.replace(/^\/+/, ''), `${appBaseUrl}/`).toString();
}

function resolveLoginUrl(appBaseUrl, value) {
  const href = String(value || DEFAULT_LOGIN_PATH);
  if (/^https?:\/\//i.test(href)) return new URL(href).toString();
  const appBase = new URL(`${appBaseUrl}/`);
  const appPath = appBase.pathname.replace(/\/$/, '');
  if (href.startsWith('/') && (href === appPath || href.startsWith(`${appPath}/`))) {
    return new URL(href, appBase.origin).toString();
  }
  return new URL(href.replace(/^\/+/, ''), `${appBaseUrl}/`).toString();
}

function appendTimestamp(url, timestamp) {
  const separator = String(url).includes('?') ? '&' : '?';
  return `${url}${separator}time=${encodeURIComponent(timestamp)}`;
}

async function postForm(url, data, { fetchImpl, cookieJar, userAgent }) {
  return requestWithJar(url, {
    method: 'POST',
    headers: {
      'user-agent': userAgent,
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: new URLSearchParams(data)
  }, { fetchImpl, cookieJar });
}

function requestWithJar(url, init, { fetchImpl, cookieJar }) {
  return fetchWithCookies(url, init, {
    fetchImpl,
    jar: cookieJar
  });
}

async function textOrThrow(response, label) {
  if (!response.ok) {
    throw new ZfLoginError('HTTP_ERROR', `Failed to load ${label}: HTTP ${response.status} ${await response.text()}`, {
      status: response.status
    });
  }
  return response.text();
}

async function jsonOrThrow(response, label) {
  const text = await textOrThrow(response, label);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ZfLoginError('JSON_PARSE_FAILED', `Failed to parse ${label} JSON: ${error.message}`, { cause: error });
  }
}

async function parseLooseJson(response, label) {
  const text = await textOrThrow(response, label);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function cloneText(response) {
  if (typeof response.clone === 'function') return response.clone().text();
  return '';
}

function assertLoginSucceeded(response, body, actionUrl) {
  if (!response.ok) {
    throw new ZfLoginError('LOGIN_FAILED', `Login submit failed: HTTP ${response.status}`, { status: response.status });
  }
  const finalUrl = response.finalUrl ?? response.url ?? actionUrl;
  if (looksLikeLoginFailure(finalUrl, body)) {
    const retryable = /验证码|滑块|captcha/i.test(body);
    throw new ZfLoginError(retryable ? 'CAPTCHA_REJECTED' : 'LOGIN_FAILED', 'The server returned the login page after submit.', {
      responseUrl: finalUrl
    });
  }
}

function looksLikeLoginFailure(finalUrl, body) {
  const url = String(finalUrl).toLowerCase();
  const text = String(body);
  return (url.includes('/xtgl/login_slogin') || url.includes('/xtgl/login')) &&
    (/<input\b[^>]*(id|name)=["']yhm["']/i.test(text) || /登录|login|用户名|密码/.test(text));
}

function isCaptchaRetryable(error) {
  return ['CAPTCHA_VERIFICATION_FAILED', 'CAPTCHA_REJECTED'].includes(error?.code);
}

function base64ToBase64Url(value) {
  const bytes = Buffer.from(normalizeBase64(value), 'base64');
  let offset = 0;
  while (offset < bytes.length - 1 && bytes[offset] === 0) offset += 1;
  return bytes.subarray(offset).toString('base64url');
}

function normalizeBase64(value) {
  const normalized = String(value).trim().replaceAll('-', '+').replaceAll('_', '/');
  return `${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`;
}
