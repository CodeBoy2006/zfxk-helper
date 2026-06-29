import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { URLSearchParams } from 'node:url';

import { AutoSelectionTaskManager } from '../src/auto-selection/index.js';
import { formatCookieHeader, loginWithZfCaptcha, solveZfCaptcha } from '../src/index.js';

const root = resolve('.');
const captchaTemplateDir = resolve(root, 'src/captcha/templates');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const autoSelectionManager = new AutoSelectionTaskManager({
  login: (input) => loginWithZfCaptcha({ ...input, templateDir: captchaTemplateDir })
});

const mime = {
  '.css': 'text/css; charset=UTF-8',
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml'
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  if (url.pathname === '/api/proxy/get' || url.pathname === '/api/proxy/post') {
    await handleProxy(request, response, url.pathname);
    return;
  }
  if (url.pathname === '/api/captcha/solve') {
    await handleCaptchaSolve(request, response);
    return;
  }
  if (url.pathname === '/api/login/zfcaptcha') {
    await handleZfCaptchaLogin(request, response);
    return;
  }
  if (url.pathname.startsWith('/api/auto-selection/')) {
    await handleAutoSelection(request, response, url);
    return;
  }

  const pathname = url.pathname === '/' ? '/web/index.html' : url.pathname;
  const requestPath = normalize(pathname).replace(/^[/\\]+/, '').replace(/^(\.\.[/\\])+/, '');
  const filePath = resolve(root, requestPath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const file = await stat(filePath);
    if (file.isDirectory()) {
      response.writeHead(302, { location: join(url.pathname, 'index.html') });
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': mime[extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=UTF-8' });
    response.end('Not found');
  }
});

async function handleProxy(request, response, endpoint) {
  if (request.method !== 'POST') {
    writeText(response, 405, 'Method not allowed');
    return;
  }

  try {
    const payload = await readJson(request);
    const method = endpoint === '/api/proxy/get' ? 'GET' : 'POST';
    const targetUrl = buildTargetUrl(payload.baseUrl, payload.path);
    const upstream = await fetch(targetUrl, {
      method,
      headers: proxyHeaders(payload, method),
      body: method === 'POST' ? buildProxyBody(payload.data || {}) : undefined,
      redirect: 'follow'
    });
    const text = await upstream.text();
    response.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'text/plain; charset=UTF-8'
    });
    response.end(text);
  } catch (error) {
    writeText(response, 400, error.message);
  }
}

async function handleCaptchaSolve(request, response) {
  if (request.method !== 'POST') {
    writeText(response, 405, 'Method not allowed');
    return;
  }

  try {
    const payload = await readJson(request);
    const result = await solveZfCaptcha({
      baseUrl: payload.baseUrl,
      templateDir: captchaTemplateDir
    });
    writeJson(response, 200, {
      status: result.status,
      cookies: result.cookies,
      cookie: formatCookieHeader(result.cookies),
      distance: result.distance
    });
  } catch (error) {
    writeJson(response, 500, { error: error.message });
  }
}

async function handleZfCaptchaLogin(request, response) {
  if (request.method !== 'POST') {
    writeText(response, 405, 'Method not allowed');
    return;
  }

  try {
    const payload = await readJson(request);
    const result = await loginWithZfCaptcha({
      baseUrl: payload.baseUrl,
      username: payload.username,
      password: payload.password,
      maxCaptchaAttempts: payload.maxCaptchaAttempts,
      templateDir: captchaTemplateDir
    });
    writeJson(response, 200, {
      status: result.status,
      cookies: result.cookies,
      cookie: result.cookieHeader,
      responseUrl: result.responseUrl,
      attempts: result.attempts
    });
  } catch (error) {
    writeJson(response, 500, {
      error: error.message,
      code: error.code
    });
  }
}

async function handleAutoSelection(request, response, url) {
  try {
    if (url.pathname === '/api/auto-selection/tasks' && request.method === 'POST') {
      writeJson(response, 200, await autoSelectionManager.createTask(await readJson(request)));
      return;
    }
    if (url.pathname === '/api/auto-selection/tasks' && request.method === 'GET') {
      writeJson(response, 200, { tasks: autoSelectionManager.listTasks() });
      return;
    }

    const taskMatch = url.pathname.match(/^\/api\/auto-selection\/tasks\/([^/]+)(?:\/([^/]+))?$/);
    if (taskMatch) {
      const [, id, action] = taskMatch;
      if (!action && request.method === 'GET') return writeFoundTask(response, autoSelectionManager.getTask(id));
      if (action === 'events' && request.method === 'GET') return writeFoundEvents(response, autoSelectionManager.getTaskEvents(id));
      if (action === 'cancel' && request.method === 'POST') return writeFoundTask(response, autoSelectionManager.cancelTask(id));
      if (action === 'resume' && request.method === 'POST') return writeFoundTask(response, autoSelectionManager.resumeTask(id));
    }

    if (url.pathname === '/api/auto-selection/config/validate' && request.method === 'POST') {
      writeJson(response, 200, autoSelectionManager.validateConfig(await readJson(request)));
      return;
    }
    if (url.pathname === '/api/auto-selection/config/import' && request.method === 'POST') {
      writeJson(response, 200, autoSelectionManager.importConfig(await readJson(request)));
      return;
    }

    writeText(response, 404, 'Not found');
  } catch (error) {
    writeJson(response, error.code === 'AUTO_SELECTION_CONFIG_INVALID' ? 400 : 500, {
      error: error.message,
      code: error.code,
      errors: error.errors
    });
  }
}

function writeFoundTask(response, task) {
  if (!task) return writeText(response, 404, 'Task not found');
  return writeJson(response, 200, task);
}

function writeFoundEvents(response, events) {
  if (!events) return writeText(response, 404, 'Task not found');
  return writeJson(response, 200, { events });
}

function proxyHeaders(payload, method) {
  return {
    accept: method === 'GET' ? 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8' : 'application/json,text/javascript,*/*;q=0.8',
    cookie: payload.cookie || '',
    ...(method === 'POST'
      ? {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest'
        }
      : {})
  };
}

function buildTargetUrl(baseUrl, path) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  const targetPath = String(path || '');
  if (!base) throw new Error('baseUrl is required');
  if (!targetPath) throw new Error('path is required');
  const baseParsed = new URL(base);
  if (!['http:', 'https:'].includes(baseParsed.protocol)) throw new Error('baseUrl must be http or https');
  if (/^https?:\/\//i.test(targetPath)) return targetPath;
  return `${base}${targetPath.startsWith('/') ? targetPath : `/${targetPath}`}`;
}

function buildProxyBody(data) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    body.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return body;
}

async function readJson(request) {
  let text = '';
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 2_000_000) throw new Error('Request body too large');
  }
  return text ? JSON.parse(text) : {};
}

function writeText(response, status, text) {
  response.writeHead(status, { 'content-type': 'text/plain; charset=UTF-8' });
  response.end(text);
}

function writeJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=UTF-8' });
  response.end(JSON.stringify(payload));
}

server.listen(port, host, () => {
  console.log(`zfxk web frontend: http://${host}:${port}/`);
});
