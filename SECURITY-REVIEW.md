# Hermes Bridge — 反检测安全分析报告

> 用于 Chrome Web Store 审核和风险自查。
> 版本: 1.0.0 | 日期: 2026-05-13

---

## 一、核心结论

| 检测项 | 状态 | 风险等级 | 说明 |
|--------|------|---------|------|
| `navigator.webdriver` | ✅ 安全 | 无风险 | 用户正常 Chrome 浏览器，非 `--enable-automation` 启动 |
| 合成事件 `isTrusted` | ⚠️ 有限制 | 低 | 所有程序化点击的 isTrusted=false，但用户登录态不受影响 |
| 行为节奏 | ✅ 已处理 | 无风险 | 随机延迟 + 非线性鼠标轨迹 + 逐字输入 |
| 扩展检测 | ⚠️ 部分网站 | 低 | `chrome.runtime` 存在但这是正常行为，不是反爬指标 |
| WebSocket 本地通信 | ✅ 安全 | 无风险 | 仅连接 127.0.0.1，无外部网络请求 |
| 截图功能 | ✅ 安全 | 无风险 | `chrome.tabs.captureVisibleTab` 需要用户已授权 activeTab |
| Cookie/登录态 | ✅ 继承 | 无风险 | 扩展不读取 cookie，直接继承浏览器现有的登录态 |

**总体评级：** 上传 Chrome Web Store 没问题，日常使用普通网站（含 ShotDeck）大概率不会被封。

---

## 二、各项详细分析

### 2.1 navigator.webdriver

**状态：** ✅ 安全
**风险等级：** 无

**分析：**
- `navigator.webdriver` 只在浏览器通过 `--enable-automation` 启动时设为 `true`
- 用户正常打开 Chrome，不是通过 Selenium/Puppeteer 启动
- 扩展的 content script 与页面共享同一个 `navigator` 对象，不会修改此属性
- 在用户正常浏览器中，此值始终为 `false` 或 `undefined`

### 2.2 合成事件信任度

**状态：** ⚠️ 有限制
**风险等级：** 低

**分析：**
- `element.click()` 和 `dispatchEvent(new MouseEvent('click'))` 产生的 `isTrusted=false`
- 这是浏览器安全模型的设计，无任何方法可以绕过
- 但是：**绝大多数网站不检查 `isTrusted`**。只有最高级别的反爬（银行、金融）会检测
- ShotDeck、普通内容网站 不会检查此属性
- 如果你遇到检查 `isTrusted` 的网站，唯一的解决方案是使用 `chrome.debugger` API（需要额外权限）

### 2.3 行为节奏模拟

**状态：** ✅ 已处理
**风险等级：** 无

**已实现的措施：**
- 点击前鼠标轨迹模拟（3-6步非线性路径）
- 随机延迟 200-600ms（模拟人类"看懂页面"的时间）
- 逐字输入的间隔 40-120ms（模拟真人类打字速度变化）
- 每3-5个字随机停顿 300ms（模拟思考）
- 滚动后 15% 概率微调 10px（模拟人类强迫症）
- 不每次滚动到正中央（位置随机）

### 2.4 数据隐私

**状态：** ✅ 安全
**风险等级：** 无

**审核关键点（提交到 Web Store 时会审查）：**
- 扩展**不收集任何用户数据**
- 所有 WebSocket 通信仅连接 `127.0.0.1:8642`（本地）
- 截图仅发送到本地桥接服务器，不经过外部网络
- 不需要 `cookies` 权限
- 不需要 `storage` 权限（仅限于保存配置偏好的 `localStorage`）

---

## 三、已知限制（不会修复，需用户知晓）

| 限制 | 说明 | 影响 |
|------|------|------|
| 无法通过 Cloudflare Challenge（Turnstile） | Cloudflare 的 JS Challenge 需要真正的浏览器渲染和 JavaScript 执行，扩展操作无法通过 | 如果目标网站有 Cloudflare 防护，需要手动操作 |
| 无法通过 reCAPTCHA v3 | Google 的 reCAPTCHA 基于用户行为评分，合成点击会降低分数 | 如果触发验证码，需要手动验证 |
| 无法自动登录需要OAuth的网站 | 需要用户在浏览器中已经登录 | 正常使用流程 |
| `chrome.tabs.captureVisibleTab` 需要用户交互 | 首次截图时 Chrome 会请求权限 | 用户点击同意即可 |
| Service Worker 可能被Chrome休眠 | MV3 的 Service Worker 在30秒无活动后可能被休眠，WebSocket会断开 | 已实现自动重连 |

---

## 四、Chrome Web Store 审核自查清单

- [x] **最小权限原则** — 只声明 `activeTab`、`tabs`、`scripting`、`storage`
- [x] **无外部请求** — WebSocket 仅连接 127.0.0.1（本地）
- [x] **无数据收集** — 不收集用户信息
- [x] **用途透明** — 扩展名称和描述明确说明为本地 AI Agent 的浏览器桥接
- [x] **Manifest V3** — 符合 Google 最新要求
- [x] **内容脚本注入** — 仅在 `<all_urls>` 注入，用途明确说明

---

## 五、上传前检查清单

- [ ] 测试页：打开 `test-detection.html`，确认所有检测项通过
- [ ] 桥接服务器：运行 `python3 bridge-server.py`，确认扩展能连接
- [ ] 导航测试：发一个 navigate 命令，确认页面跳转正常
- [ ] 截图测试：确认截图功能正常
- [ ] 隐私政策：Chrome Web Store 可能需要提交隐私说明 URL
- [ ] 扩展描述截图：至少准备 1 张 1280x800 截图用于商店展示
