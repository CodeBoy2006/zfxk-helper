import { CookieJar } from './cookies.js';

export function resolveAppBaseUrl(baseUrl, appPath = '/jwglxt') {
  const url = new URL(String(baseUrl || '').trim());
  const normalizedPath = url.pathname.replace(/\/$/, '');
  const normalizedAppPath = appPath.startsWith('/') ? appPath : `/${appPath}`;
  if (normalizedPath.endsWith(normalizedAppPath)) {
    url.pathname = normalizedPath;
  } else {
    url.pathname = `${normalizedPath}${normalizedAppPath}`.replace(/\/{2,}/g, '/');
  }
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export async function fetchWithCookies(url, init = {}, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) throw new Error('No fetch implementation is available.');
  const jar = options.jar ?? new CookieJar();
  const maxRedirects = options.maxRedirects ?? 5;
  let currentUrl = String(url);
  let currentInit = { ...init };

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const headers = normalizeHeaders(currentInit.headers);
    const cookie = jar.header();
    if (cookie) headers.cookie = cookie;

    const response = await fetchImpl(currentUrl, {
      ...currentInit,
      headers,
      redirect: 'manual'
    });
    jar.storeFromHeaders(response.headers);

    if (!isRedirect(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;

    currentUrl = new URL(location, currentUrl).toString();
    currentInit = redirectInit(currentInit, response.status);
  }

  throw new Error(`Too many redirects while requesting ${url}`);
}

function normalizeHeaders(headers = {}) {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

function redirectInit(init, status) {
  if (status === 303 || ((status === 301 || status === 302) && String(init.method || 'GET').toUpperCase() === 'POST')) {
    const { body, ...rest } = init;
    return { ...rest, method: 'GET' };
  }
  return init;
}
