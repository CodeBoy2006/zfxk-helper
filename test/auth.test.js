import assert from 'node:assert/strict';
import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import test from 'node:test';

import { CookieJar, encryptZfPassword, loginWithZfCaptcha } from '../src/index.js';

test('encryptZfPassword uses Zhengfang RSA public-key inputs', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
  const publicJwk = publicKey.export({ format: 'jwk' });

  const encrypted = encryptZfPassword('secret', {
    modulus: base64UrlToBase64(publicJwk.n),
    exponent: base64UrlToBase64(publicJwk.e)
  });
  const decrypted = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(encrypted, 'base64')
  );

  assert.equal(decrypted.toString('utf8'), 'secret');
});

test('loginWithZfCaptcha retries captcha verification and returns authenticated cookies', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const calls = [];
  let captchaAttempts = 0;

  const result = await loginWithZfCaptcha({
    baseUrl: 'https://example.edu.cn/jwglxt',
    username: 'student',
    password: 'secret',
    now: () => 123,
    maxCaptchaAttempts: 2,
    solveCaptcha: async ({ cookieJar }) => {
      captchaAttempts += 1;
      if (captchaAttempts === 1) throw new Error('captcha mismatch');
      cookieJar.storeFromHeaders(['JSESSIONID=CAPTCHA; Path=/jwglxt']);
      return { status: 'success', distance: 28 };
    },
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      if (url === 'https://example.edu.cn/jwglxt/') {
        return htmlResponse(`
          <form action="/jwglxt/xtgl/login_slogin.html">
            <input id="mmsfjm" value="1">
            <input id="csrfTokenLogout" name="csrfTokenLogout" value="LOGOUT">
            <input id="dxsyrz" value="0">
            <input id="mmsrddcshkzfs" value="0">
            <input id="sfzywqh" value="0">
            <input id="language" name="language" value="">
          </form>
        `);
      }
      if (url === 'https://example.edu.cn/jwglxt/xtgl/login_getPublicKey.html?time=123') {
        return jsonResponse({
          modulus: base64UrlToBase64(publicJwk.n),
          exponent: base64UrlToBase64(publicJwk.e)
        });
      }
      if (url === 'https://example.edu.cn/jwglxt/xtgl/yhgl_cxXxqrCheck.html') {
        assert.equal(init.headers.cookie, 'JSESSIONID=CAPTCHA');
        assert.equal(new URLSearchParams(init.body).get('yhm'), 'student');
        return jsonResponse(false);
      }
      if (url === 'https://example.edu.cn/jwglxt/xtgl/login_logoutAccount.html') {
        assert.equal(init.headers.cookie, 'JSESSIONID=CAPTCHA');
        assert.equal(new URLSearchParams(init.body).get('csrfTokenLogout'), 'LOGOUT');
        return textResponse('ok');
      }
      if (url === 'https://example.edu.cn/jwglxt/xtgl/login_slogin.html?time=123') {
        const body = new URLSearchParams(init.body);
        assert.equal(init.headers.cookie, 'JSESSIONID=CAPTCHA');
        assert.equal(body.get('yhm'), 'student');
        assert.equal(body.get('language'), 'zh_CN');
        assert.equal(body.get('hidMm'), body.get('mm'));
        assert.equal(decryptPassword(body.get('mm'), privateKey), 'secret');
        return textResponse('', {
          status: 302,
          headers: {
            location: '/jwglxt/xtgl/index_initMenu.html',
            'set-cookie': 'JSESSIONID=LOGIN; Path=/jwglxt'
          }
        });
      }
      if (url === 'https://example.edu.cn/jwglxt/xtgl/index_initMenu.html') {
        assert.equal(init.headers.cookie, 'JSESSIONID=LOGIN');
        return htmlResponse('<main id="indexMenu">ok</main>');
      }
      throw new Error(`unexpected request: ${url}`);
    }
  });

  assert.equal(captchaAttempts, 2);
  assert.equal(result.status, 'success');
  assert.equal(result.cookies.JSESSIONID, 'LOGIN');
  assert.equal(result.cookieHeader, 'JSESSIONID=LOGIN');
  assert.equal(result.responseUrl, 'https://example.edu.cn/jwglxt/xtgl/index_initMenu.html');
  assert.deepEqual(calls.map((call) => [call.init.method ?? 'GET', call.url]), [
    ['GET', 'https://example.edu.cn/jwglxt/'],
    ['GET', 'https://example.edu.cn/jwglxt/xtgl/login_getPublicKey.html?time=123'],
    ['POST', 'https://example.edu.cn/jwglxt/xtgl/yhgl_cxXxqrCheck.html'],
    ['POST', 'https://example.edu.cn/jwglxt/xtgl/login_logoutAccount.html'],
    ['POST', 'https://example.edu.cn/jwglxt/xtgl/login_slogin.html?time=123'],
    ['GET', 'https://example.edu.cn/jwglxt/xtgl/index_initMenu.html']
  ]);
});

test('loginWithZfCaptcha rejects SMS verification login flows explicitly', async () => {
  await assert.rejects(
    () => loginWithZfCaptcha({
      baseUrl: 'https://example.edu.cn/jwglxt',
      username: 'student',
      password: 'secret',
      solveCaptcha: async ({ cookieJar }) => {
        cookieJar.storeFromHeaders(['JSESSIONID=CAPTCHA; Path=/jwglxt']);
        return { status: 'success' };
      },
      fetchImpl: async (url) => {
        if (url === 'https://example.edu.cn/jwglxt/') {
          return htmlResponse(`
            <form action="/jwglxt/xtgl/login_slogin.html">
              <input id="mmsfjm" value="0">
              <input id="dxsyrz" value="1">
              <input id="mmsrddcshkzfs" value="0">
            </form>
          `);
        }
        throw new Error(`unexpected request: ${url}`);
      }
    }),
    /SMS_LOGIN_REQUIRED/
  );
});

function decryptPassword(value, privateKey) {
  return privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(value, 'base64')
  ).toString('utf8');
}

function base64UrlToBase64(value) {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  return padded.replaceAll('-', '+').replaceAll('_', '/');
}

function textResponse(body, init = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: init.headers
  });
}

function htmlResponse(body) {
  return textResponse(body, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
}

function jsonResponse(body) {
  return textResponse(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}
