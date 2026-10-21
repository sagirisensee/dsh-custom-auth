import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

function resolvePackageEntry(pkgName) {
  for (const basePath of [process.execPath, ...process.argv, process.cwd()]) {
    if (!basePath) continue
    try {
      const req = createRequire(basePath)
      const res = req.resolve(pkgName)
      if (res) return res
    } catch {}
  }
  return null
}

function ensurePatches() {
  try {
    const connFile = resolvePackageEntry('@deepseek-ai/dsh-client-connection')
    const staticFile = resolvePackageEntry('@deepseek-ai/dsh-host-frontend-static')

    if (!connFile || !staticFile || !fs.existsSync(connFile) || !fs.existsSync(staticFile)) return

    // 1. 检查并修补 dsh-host-frontend-static
    let staticSrc = fs.readFileSync(staticFile, 'utf8')
    if (!staticSrc.includes('rawPath === "/login"')) {
      const targetStr = 'ctx.effect(() => ctx.webServer.registerFallback(async (req, res) => {'
      const replacement = `ctx.effect(() => ctx.webServer.registerFallback(async (req, res) => {
\t\tconst rawPath = new URL(req.url ?? "/", "http://x").pathname;
\t\tif (req.method === "POST" && rawPath === "/login") {
\t\t\tctx.connection.authorizeIndex(req, res);
\t\t\treturn;
\t\t}`
      if (staticSrc.includes(targetStr)) {
        staticSrc = staticSrc.replace(targetStr, replacement)
        fs.writeFileSync(staticFile, staticSrc, 'utf8')
        console.log('[dsh-custom-auth] Injected /login route into dsh-host-frontend-static')
      }
    }

    // 2. 检查并修补 dsh-client-connection
    let connSrc = fs.readFileSync(connFile, 'utf8')
    if (!connSrc.includes('renderAuthLoginPage')) {
      // 注入 renderAuthLoginPage 和 parsePostData 以及 processLaunchToken
      const loginPageFuncs = `
function renderAuthLoginPage(errorMsg = "") {
\treturn \`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>DeepSeek Harness 登录</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0f172a;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 20px;
  }
  .card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 16px;
    padding: 32px 24px;
    width: 100%;
    max-width: 380px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  }
  .logo {
    text-align: center;
    margin-bottom: 24px;
  }
  .logo h1 {
    font-size: 22px;
    font-weight: 700;
    color: #38bdf8;
    margin-bottom: 6px;
  }
  .logo p {
    font-size: 13px;
    color: #94a3b8;
  }
  .form-group {
    margin-bottom: 18px;
  }
  label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #cbd5e1;
    margin-bottom: 6px;
  }
  input[type="text"], input[type="password"] {
    width: 100%;
    background: #0f172a;
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 12px 14px;
    color: #fff;
    font-size: 15px;
    outline: none;
    transition: border-color 0.2s;
  }
  input[type="text"]:focus, input[type="password"]:focus {
    border-color: #38bdf8;
  }
  .btn {
    width: 100%;
    background: #0284c7;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 12px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    margin-top: 8px;
  }
  .btn:hover { background: #0369a1; }
  .btn:active { transform: scale(0.98); }
  .error {
    background: #7f1d1d;
    border: 1px solid #991b1b;
    color: #fecaca;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
    text-align: center;
  }
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <h1>DeepSeek Harness</h1>
    <p>请输入管理员身份凭据</p>
  </div>
  \${errorMsg ? \`<div class="error">\${errorMsg}</div>\` : ""}
  <form method="POST" action="/login">
    <div class="form-group">
      <label>用户名</label>
      <input type="text" name="username" placeholder="请输入用户名" required autofocus autocomplete="username">
    </div>
    <div class="form-group">
      <label>密码</label>
      <input type="password" name="password" placeholder="请输入密码" required autocomplete="current-password">
    </div>
    <button type="submit" class="btn">登 录</button>
  </form>
</div>
</body>
</html>\`;
}

function parsePostData(req) {
\treturn new Promise((resolve) => {
\t\tconst chunks = [];
\t\treq.on("data", (chunk) => chunks.push(chunk));
\t\treq.on("end", () => {
\t\t\tconst body = Buffer.concat(chunks).toString("utf8");
\t\t\ttry {
\t\t\t\tconst params = new URLSearchParams(body);
\t\t\t\tresolve(Object.fromEntries(params.entries()));
\t\t\t} catch {
\t\t\t\tresolve({});
\t\t\t}
\t\t});
\t\treq.on("error", () => resolve({}));
\t});
}
`
      // 注入到 processLaunchToken 前面
      connSrc = connSrc.replace('function processLaunchToken(owner) {', loginPageFuncs + '\nfunction processLaunchToken(owner) {\n\tif (process.env.DSH_WEB_TOKEN) return process.env.DSH_WEB_TOKEN;')
      
      // 注入 writeUnauthorized
      connSrc = connSrc.replace(`writeUnauthorized(req, res) {
\t\tres.writeHead(401, {
\t\t\t"cache-control": "no-store",
\t\t\t"content-type": "text/plain; charset=utf-8"
\t\t});
\t\tres.end(req.method === "HEAD" ? void 0 : "dsh web authentication required; reopen the URL printed by dsh web.\\n");
\t}`, `writeUnauthorized(req, res) {
\t\tres.writeHead(401, {
\t\t\t"cache-control": "no-store",
\t\t\t"content-type": "text/html; charset=utf-8"
\t\t});
\t\tres.end(renderAuthLoginPage());
\t}`)

      // 注入 authorizeIndex 中的 POST /login
      const authIndexOld = `\tauthorizeIndex(req, res, secure = false) {
\t\t/* v8 ignore next -- node:http always supplies url on server requests. */
\t\tconst url = new URL(req.url ?? "/", "http://dsh.invalid");
\t\tconst tokens = url.searchParams.getAll(TOKEN_QUERY);`

      const authIndexNew = `\tauthorizeIndex(req, res, secure = false) {
\t\t/* v8 ignore next -- node:http always supplies url on server requests. */
\t\tconst url = new URL(req.url ?? "/", "http://dsh.invalid");
\t\tif (req.method === "POST" && url.pathname === "/login") {
\t\t\tconst authority = requestAudience(req.headers, secure);
\t\t\tparsePostData(req).then((data) => {
\t\t\t\tconst expectedUser = process.env.DSH_AUTH_USERNAME;
\t\t\t\tconst expectedPass = process.env.DSH_AUTH_PASSWORD;
\t\t\t\tif (!expectedUser || !expectedPass) {
\t\t\t\t\tres.writeHead(500, {
\t\t\t\t\t\t"cache-control": "no-store",
\t\t\t\t\t\t"content-type": "text/html; charset=utf-8"
\t\t\t\t\t});
\t\t\t\t\tres.end(renderAuthLoginPage("服务端未配置 DSH_AUTH_USERNAME 或 DSH_AUTH_PASSWORD 环境变量"));
\t\t\t\t\treturn;
\t\t\t\t}
\t\t\t\tif (data.username === expectedUser && data.password === expectedPass && authority !== void 0) {
\t\t\t\t\tconst issuedAt = Date.now();
\t\t\t\t\tconst expiresAt = issuedAt + this.maxAgeMilliseconds;
\t\t\t\t\tconst value = encodeCookie({
\t\t\t\t\t\tversion: COOKIE_PAYLOAD_VERSION,
\t\t\t\t\t\tauthority,
\t\t\t\t\t\tissuedAt,
\t\t\t\t\t\texpiresAt
\t\t\t\t\t}, this.secret);
\t\t\t\t\tres.writeHead(303, {
\t\t\t\t\t\t"cache-control": "no-store",
\t\t\t\t\t\t"location": "./",
\t\t\t\t\t\t"referrer-policy": "no-referrer",
\t\t\t\t\t\t"set-cookie": sessionCookie(cookieName(authority), value, expiresAt, Math.floor(this.maxAgeMilliseconds / 1e3), secure)
\t\t\t\t\t});
\t\t\t\t\tres.end();
\t\t\t\t\treturn;
\t\t\t\t}
\t\t\t\tres.writeHead(401, {
\t\t\t\t\t"cache-control": "no-store",
\t\t\t\t\t"content-type": "text/html; charset=utf-8"
\t\t\t\t});
\t\t\t\tres.end(renderAuthLoginPage("用户名或密码错误，请重试"));
\t\t\t});
\t\t\treturn false;
\t\t}
\t\tconst tokens = url.searchParams.getAll(TOKEN_QUERY);`

      if (connSrc.includes(authIndexOld)) {
        connSrc = connSrc.replace(authIndexOld, authIndexNew)
        fs.writeFileSync(connFile, connSrc, 'utf8')
        console.log('[dsh-custom-auth] Injected login authentication logic into dsh-client-connection')
      }
    }
  } catch (err) {
    console.error('[dsh-custom-auth] Error checking/applying patches:', err)
  }
}

// 模块加载时执行一次自愈检查
ensurePatches()

export default {
  name: 'dsh-custom-auth',
  inject: ['webServer'],
  apply(ctx) {
    // 每次 DSH 启动服务时再次校验补丁，如果发现被升级覆盖了，立即自动打补丁自愈！
    ensurePatches()
  }
}
