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

已选课程快照中的 `SelectedClass.canDrop` 会按原页面的退选按钮条件计算：除 `sfktk`/`zntgpk` 外，还会检查 `sfxkbj`、`isInxksj`、`yxzrs > tktjrs` 和正选控制标志。不可退时会附带 `dropRestriction`，Web 前端会像学校页面一样在操作列显示“已选”而不是退选按钮。

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

打开 `http://127.0.0.1:4173/` 使用完整选课工作台，或打开 `http://127.0.0.1:4173/auto-selection` 进入独立自动选课控制台。

工作台需要填写：

- `Base URL`：教务系统根地址，例如 `https://example.edu.cn/jwglxt`。
- `Cookie`：从浏览器复制的已登录 Cookie，或通过页面按钮获取。
- `用户名` / `密码`：仅在点击 `登录获取 Cookie` 时由本地 Node 进程使用。
- `Path`：用于解析隐藏运行时字段的选课入口路径。

浏览器会用 `localStorage` 缓存 Base URL、Cookie、用户名、密码和 Path，刷新页面后会自动回填，避免重复输入。浏览器只访问本地 `/api/proxy/*`、`/api/captcha/solve` 和 `/api/login/zfcaptcha`。本地 Node 代理再携带 Cookie 请求学校系统，以避开浏览器禁止前端脚本设置跨域原始 Cookie 的限制。缓存只保留在本地浏览器中，不会写入项目文件；请勿在共享设备上保存账号信息。

课程搜索会缓存当前课程类型和远程筛选条件下的完整课程列表。关键词、教学班名、是否重修和课程归属等可由已加载课程行判断的条件会在浏览器本地筛选；年级、学院、专业、容量和时间冲突等仍交给学校系统筛选，避免绕过后端范围和实时规则。

## 自动选课后台任务

`npm run web` 现在包含本地自动选课任务运行器。任务启动后可以关闭浏览器页面；只要本地 Node 进程仍在，后台会继续刷新目标教学班、校验状态并提交选课。独立页面位于 `/auto-selection`，提供任务配置、组选课配置、教学班加入、后台状态、暂停/恢复/取消、事件日志、配置导入导出等完整操作面。

- 使用教学班列表中已经解析出的明确目标，不做全量课程搜索式抢课。
- 主页面每个教学班都有 `加入抢课` 按钮，可直接选择要加入的选课组；独立页面也支持按课程 ID 和班级 ID 通过接口获取详情后添加目标。
- 目标按选课组管理；组策略可选 `优先级模式` 或 `等价模式`，前者按优先级升级，后者选中任一目标即视为本组满足。
- 低优先级目标可以先作为保底占位；高优先级目标出现余量后，后台会在允许自动退课时退保底并抢高优先级。
- 升级失败或容量满时会尝试恢复原保底；非容量业务失败默认跳过该目标。
- 自动任务优先使用用户名和密码续期登录；Cookie 只作为可选初始凭据。
- 导出文件不包含密码、Cookie、运行事件或已选快照；加载配置只回填草稿，不会自动启动任务。

第一版任务只保存在内存中。停止 `npm run web` 的 Node 进程会取消运行中的自动选课任务。

通识选修课会展示课程归属，例如人文情怀、国际视野、艺术修养等；如果课程列表接口没有直接返回归属字段，前端会用学校的 `kcgs_list` 字典和只读筛选查询补全当前结果。

课程列表栏和已选课程栏分别提供独立导出按钮：

- `导出课程`：导出当前已加载课程列表的完整 JSON 信息；重复课程行会按课程 ID 去重，并用 `来源课程行数量` 记录上游返回的行数。导出时会补拉每门课的教学班详情，详情请求最多重试 3 次并短延迟退避。已知字段会转换为中文可读字段，未映射的原始字段保留在 `额外原始字段`。
- `导出已选`：导出当前已选课程快照、汇总、课程与教学班明细，必要时用教学班详情补齐课程时间/地点；详情请求最多重试 3 次并短延迟退避。导出包含是否可退及不可退原因，跳过内部 `Map` 索引字段。
