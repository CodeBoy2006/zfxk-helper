import { buildFormBody } from './utils.js';

export class HttpTransport {
  constructor({ baseUrl, auth, fetchImpl = globalThis.fetch } = {}) {
    if (!fetchImpl) throw new Error('No fetch implementation available.');
    this.baseUrl = String(baseUrl ?? '').replace(/\/$/, '');
    this.auth = auth;
    this.fetchImpl = fetchImpl;
  }

  async post(path, data = {}, options = {}) {
    const response = await this.fetchImpl(this.url(path), {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        ...this.authHeaders(),
        ...(options.headers ?? {})
      },
      body: buildFormBody(data)
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`POST ${path} failed with HTTP ${response.status}: ${text}`);
    }
    return parseResponse(text, response.headers.get('content-type'));
  }

  url(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.baseUrl}${path}`;
  }

  authHeaders() {
    if (this.auth?.type === 'cookie' && this.auth.cookie) {
      return { cookie: this.auth.cookie };
    }
    return {};
  }
}

export class MemoryTransport {
  constructor(routes = {}) {
    this.routes = new Map(Object.entries(routes));
    this.queues = new Map();
    this.calls = [];
  }

  queue(path, response) {
    const queue = this.queues.get(path) ?? [];
    queue.push(response);
    this.queues.set(path, queue);
  }

  async post(path, data = {}, options = {}) {
    this.calls.push({ method: 'POST', path, data, options });
    const queue = this.queues.get(path);
    if (queue?.length) return clone(queue.shift());
    if (!this.routes.has(path)) throw new Error(`No memory route for ${path}`);
    const route = this.routes.get(path);
    return clone(typeof route === 'function' ? await route({ path, data, options, calls: this.calls }) : route);
  }
}

function parseResponse(text, contentType = '') {
  if (contentType?.includes('json')) return JSON.parse(text);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function clone(value) {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}
