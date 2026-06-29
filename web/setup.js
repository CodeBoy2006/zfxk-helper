import {
  DEFAULT_PAGE_PATH,
  hasSavedSessionConfig,
  normalizeSessionConfig,
  readSessionConfig,
  sanitizeNextPath,
  writeSessionConfig
} from './session-config.js';

const elements = {
  form: document.querySelector('#setupForm'),
  baseUrlInput: document.querySelector('#setupBaseUrlInput'),
  usernameInput: document.querySelector('#setupUsernameInput'),
  passwordInput: document.querySelector('#setupPasswordInput'),
  pagePathInput: document.querySelector('#setupPagePathInput'),
  cookieInput: document.querySelector('#setupCookieInput'),
  loginBtn: document.querySelector('#setupLoginBtn'),
  solveCaptchaBtn: document.querySelector('#setupSolveCaptchaBtn'),
  submitBtn: document.querySelector('#setupSubmitBtn'),
  message: document.querySelector('#setupMessage'),
  returnLink: document.querySelector('#setupReturnLink')
};

const nextPath = sanitizeNextPath(new URLSearchParams(window.location.search).get('next'));
const savedConfig = readSessionConfig();

restoreForm(savedConfig);
renderPreview();
bindEvents();

function bindEvents() {
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveAndContinue();
  });
  elements.loginBtn.addEventListener('click', () => loginWithCaptchaCookie());
  elements.solveCaptchaBtn.addEventListener('click', () => solveCaptchaCookie());
  for (const input of [elements.baseUrlInput, elements.usernameInput, elements.passwordInput, elements.pagePathInput, elements.cookieInput]) {
    input.addEventListener('input', renderPreview);
    input.addEventListener('change', renderPreview);
  }
}

function restoreForm(config) {
  elements.baseUrlInput.value = config.baseUrl;
  elements.usernameInput.value = config.username;
  elements.passwordInput.value = config.password;
  elements.pagePathInput.value = config.pagePath || DEFAULT_PAGE_PATH;
  elements.cookieInput.value = config.cookie;
  elements.returnLink.href = nextPath;
}

async function loginWithCaptchaCookie() {
  await runSetupTask('登录获取 Cookie', async () => {
    const config = formConfig();
    if (!config.baseUrl) throw new Error('请填写教务系统 Base URL。');
    if (!config.username) throw new Error('请填写用户名。');
    if (!config.password) throw new Error('请填写密码。');

    const response = await fetch('/api/login/zfcaptcha', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        baseUrl: config.baseUrl,
        username: config.username,
        password: config.password,
        maxCaptchaAttempts: 3
      })
    });
    const result = await readResponse(response, '/api/login/zfcaptcha');
    if (!result.cookie) throw new Error('登录接口未返回 Cookie。');
    elements.cookieInput.value = result.cookie;
    writeSessionConfig(formConfig());
    renderPreview();
    setMessage(`登录完成，验证码尝试 ${result.attempts || 1} 次，配置已保存。`);
  });
}

async function solveCaptchaCookie() {
  await runSetupTask('获取验证码 Cookie', async () => {
    const config = formConfig();
    if (!config.baseUrl) throw new Error('请填写教务系统 Base URL。');

    const response = await fetch('/api/captcha/solve', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ baseUrl: config.baseUrl })
    });
    const result = await readResponse(response, '/api/captcha/solve');
    if (!result.cookie) throw new Error('验证码接口未返回 Cookie。');
    elements.cookieInput.value = result.cookie;
    writeSessionConfig(formConfig());
    renderPreview();
    setMessage('验证码 Cookie 已填入，配置已保存。');
  });
}

function saveAndContinue() {
  const config = formConfig();
  if (!config.baseUrl) return setMessage('请填写教务系统 Base URL。', true);
  if (!config.pagePath) return setMessage('请填写选课入口 Path。', true);
  if (!config.cookie) return setMessage('请先登录获取 Cookie，或手动填写已登录 Cookie。', true);

  if (!writeSessionConfig(config)) {
    setMessage('保存失败：浏览器本地存储不可用。', true);
    return;
  }
  setMessage('配置已保存，正在进入页面。');
  window.location.assign(nextPath);
}

function formConfig() {
  return normalizeSessionConfig({
    baseUrl: elements.baseUrlInput.value,
    username: elements.usernameInput.value,
    password: elements.passwordInput.value,
    pagePath: elements.pagePathInput.value,
    cookie: elements.cookieInput.value
  });
}

function renderPreview() {
  const config = formConfig();
  elements.submitBtn.textContent = hasSavedSessionConfig(config) ? '保存并继续' : '保存配置';
}

async function runSetupTask(label, operation) {
  setButtonsDisabled(true);
  setMessage(`${label}中...`);
  try {
    await operation();
  } catch (error) {
    setMessage(`${label}失败：${error.message}`, true);
  } finally {
    setButtonsDisabled(false);
  }
}

function setButtonsDisabled(disabled) {
  for (const button of [elements.loginBtn, elements.solveCaptchaBtn, elements.submitBtn]) {
    button.disabled = disabled;
  }
}

function setMessage(message, isError = false) {
  elements.message.textContent = message;
  elements.message.classList.toggle('error', isError);
}

async function readResponse(response, label) {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === 'string' ? body : body.error || JSON.stringify(body);
    throw new Error(`${label} ${response.status}: ${message}`);
  }
  return body;
}
