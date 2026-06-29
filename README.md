# zfxk

`zfxk` 是面向正方 ZFXK/ZZXK 选课页的 HTTP 工作流 SDK。它不自动点击页面，也不依赖浏览器 DOM；调用方只需要提供已登录 Cookie，以及选课入口页里的运行时隐藏字段。

## 安装

```bash
npm install
npm test
```

项目要求 Node.js 20 或更高版本。

## 快速开始

```js
import { createZfxkClient, loadRuntimeContext } from 'zfxk';

const context = loadRuntimeContext({
  baseUrl: 'https://example.edu.cn/jwglxt',
  html: initialSelectionPageHtml
});

const client = createZfxkClient({
  baseUrl: 'https://example.edu.cn/jwglxt',
  auth: { type: 'cookie', cookie: 'JSESSIONID=...' },
  context,
  mode: 'commit'
});

const courses = await client.catalog.searchCourses({
  keyword: '数据库',
  page: { start: 1, size: 20 }
});

const classes = await client.catalog.getTeachingClasses(courses[0].courseId);
const target = classes.find((item) => item.flags.canSelect);

const result = await client.selection.choose(
  { courseId: target.courseId, classId: target.classId },
  {
    confirm: async () => true,
    chooseTextbooks: async ({ requiredItems }) => requiredItems.map((item) => item.id)
  }
);

console.log(result.status);
```

已有有效 Cookie 时，也可以让客户端自行拉取选课入口页并解析隐藏字段：

```js
const client = createZfxkClient({
  baseUrl: 'https://example.edu.cn/jwglxt',
  auth: { type: 'cookie', cookie: process.env.ZFXK_COOKIE },
  mode: 'commit'
});

await client.bootstrapFromPage({
  path: '/xsxk/zzxkyzb_cxZzxkYzbIndex.html?gnmkdm=N253512'
});
```

如果 Cookie 失效，或页面不是受支持的选课入口，`bootstrapFromPage()` 会抛出 `CONTEXT_NOT_FOUND`。

## 登录与 Cookie

`loginWithZfCaptcha()` 会执行新版正方常见登录流程：滑块验证、获取 RSA 公钥、加密密码、身份/锁定检查、提交登录表单，并返回已认证 Cookie。

```js
import { createZfxkClient, loginWithZfCaptcha } from 'zfxk';

const login = await loginWithZfCaptcha({
  baseUrl: 'https://example.edu.cn/jwglxt',
  username: process.env.ZFXK_USERNAME,
  password: process.env.ZFXK_PASSWORD,
  maxCaptchaAttempts: 3
});

const client = createZfxkClient({
  baseUrl: 'https://example.edu.cn/jwglxt',
  auth: { type: 'cookie', cookie: login.cookieHeader },
  mode: 'commit'
});
```

仅需要滑块流程 Cookie 时，可使用 `solveZfCaptcha()` 和 `formatCookieHeader()`。该辅助函数不会提交账号密码；是否能直接访问目标页面取决于学校部署。

遇到交互式二次验证时，登录辅助函数会返回明确错误码，例如 `SMS_LOGIN_REQUIRED` 或 `IDENTITY_CONFIRMATION_REQUIRED`。

## 已支持能力

- 解析选课入口隐藏字段和课程类型标签。
- 自动从入口页初始化运行时上下文。
- 查询课程、教学班和已选课程快照。
- 执行选课、退课、志愿排序，以及教材、候补、监听等端点包装。
- 暴露 `loginWithZfCaptcha()` 和 `solveZfCaptcha()` 登录/Cookie 辅助能力。

仓库根目录下的 `zzxkYzb*.js` 是原始页面脚本参考，用于核对端点名称和标志位含义。

## 文档

```bash
npm run docs
```

生成内容：

- `docs/openapi.json`：SDK 操作的 OpenAPI 3.0.3 描述。
- `docs/api/`：由 `src/index.d.ts` 生成的 TypeDoc API 文档。

也可以分别运行：

```bash
npm run openapi
npm run docs:api
```

## Web 前端

```bash
npm run web
```

打开 `http://127.0.0.1:4173/`，填写：

- `Base URL`：教务系统根地址，例如 `https://example.edu.cn/jwglxt`。
- `Cookie`：从浏览器复制的已登录 Cookie，或通过页面按钮获取。
- `用户名` / `密码`：仅在点击 `登录获取 Cookie` 时由本地 Node 进程使用。
- `Path`：用于解析隐藏运行时字段的选课入口路径。

浏览器会用 `localStorage` 缓存 Base URL、Cookie、用户名、密码和 Path，刷新页面后会自动回填，避免重复输入。浏览器只访问本地 `/api/proxy/*`、`/api/captcha/solve` 和 `/api/login/zfcaptcha`。本地 Node 代理再携带 Cookie 请求学校系统，以避开浏览器禁止前端脚本设置跨域原始 Cookie 的限制。缓存只保留在本地浏览器中，不会写入项目文件；请勿在共享设备上保存账号信息。
