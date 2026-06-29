export const DEFAULT_PAGE_PATH = '/xsxk/zzxkyzb_cxZzxkYzbIndex.html?gnmkdm=N253512';
export const SESSION_STORAGE_KEY = 'zfxk.web.session.v1';

export function normalizeSessionConfig(config = {}) {
  return {
    baseUrl: stringValue(config.baseUrl),
    username: stringValue(config.username),
    password: typeof config.password === 'string' ? config.password : '',
    cookie: stringValue(config.cookie),
    pagePath: stringValue(config.pagePath) || DEFAULT_PAGE_PATH
  };
}

export function readSessionConfig() {
  try {
    return normalizeSessionConfig(JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) || '{}'));
  } catch {
    return normalizeSessionConfig();
  }
}

export function writeSessionConfig(config) {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalizeSessionConfig(config)));
    return true;
  } catch {
    return false;
  }
}

export function hasSavedSessionConfig(config = readSessionConfig()) {
  return Boolean(config.baseUrl && config.pagePath && config.cookie);
}

export function requireSessionConfig(nextPath = currentPath()) {
  const config = readSessionConfig();
  if (hasSavedSessionConfig(config)) return config;
  window.location.replace(setupUrl(nextPath));
  return null;
}

export function setupUrl(nextPath = currentPath()) {
  return `/setup?next=${encodeURIComponent(sanitizeNextPath(nextPath))}`;
}

export function sanitizeNextPath(nextPath) {
  const value = typeof nextPath === 'string' ? nextPath.trim() : '';
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/setup')) return '/';
  return value;
}

export function currentPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || '/';
}

export function sessionHost(config) {
  try {
    return new URL(config.baseUrl).host;
  } catch {
    return config.baseUrl || '未配置';
  }
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}
