export class CookieJar {
  constructor(initialCookies = {}) {
    this.cookies = new Map(Object.entries(initialCookies));
  }

  storeFromHeaders(headers) {
    for (const header of setCookieHeaders(headers)) {
      const parsed = parseSetCookie(header);
      if (parsed) this.cookies.set(parsed.name, parsed.value);
    }
  }

  get(name) {
    return this.cookies.get(name);
  }

  entries() {
    return [...this.cookies.entries()];
  }

  toObject(names) {
    const result = {};
    for (const [name, value] of this.cookies) {
      if (!names || names.includes(name)) result[name] = value;
    }
    return result;
  }

  header() {
    return formatCookieHeader(Object.fromEntries(this.cookies));
  }
}

export function formatCookieHeader(cookies = {}) {
  return Object.entries(cookies)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

export function setCookieHeaders(headers) {
  if (!headers) return [];
  if (Array.isArray(headers)) return headers;
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const value = typeof headers.get === 'function' ? headers.get('set-cookie') : headers['set-cookie'];
  return splitSetCookieHeader(value);
}

function parseSetCookie(header) {
  const pair = String(header ?? '').split(';', 1)[0];
  const index = pair.indexOf('=');
  if (index <= 0) return null;
  return {
    name: pair.slice(0, index).trim(),
    value: pair.slice(index + 1).trim()
  };
}

function splitSetCookieHeader(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value).split(/,(?=\s*[^;,\s]+=)/g).map((item) => item.trim()).filter(Boolean);
}
