/******************************
/******************************
  TG链接重定向 - QuantumultX 脚本
  功能：拦截 t.me / telegram.me 链接，跳转到指定 TG 客户端
  可选客户端：Telegram | Swiftgram | Nicegram | iMe | Turrit | Lingogram
  open_mode：307=静默直跳(推荐)  200=显示中间确认页
*************************
[rewrite_local]
^https?://(t\.me|telegram\.me)/ url script-request-header https://raw.githubusercontent.com/MrRegret/scripts/refs/heads/main/tg_redirect.js, tag=TG重定向
[MITM]
hostname = t.me, telegram.me
*************************

*****************************************/

// ─── 解析 $argument 参数 ───────────────────────────────────────────
function parseArgument(arg) {
  if (typeof arg === 'object' && arg) return arg;
  const result = {};
  const str = String(arg || '');
  if (!str) return result;
  for (const pair of str.split('&')) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx < 0) continue;
    const key = decodeURIComponent(pair.slice(0, eqIdx));
    const val = decodeURIComponent(pair.slice(eqIdx + 1));
    result[key] = val;
  }
  return result;
}

// ─── 判断字符串是否全为数字 ────────────────────────────────────────
function isAllDigits(str) {
  if (!str) return false;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 48 || c > 57) return false; // '0'~'9'
  }
  return true;
}

// ─── HTML 实体转义（用于 open_mode=307 时生成页面） ────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── 给 URL 追加 tgWebAppPlatform=ios 参数 ────────────────────────
function appendPlatformParam(href) {
  try {
    const u = new URL(href);
    u.searchParams.set('tgWebAppPlatform', '0');
    return u.toString();
  } catch {
    return href + (href.includes('?') ? '&' : '?') + 'tgWebAppPlatform=0';
  }
}

// ─── 根据路径片段构建目标协议 URL ──────────────────────────────────
// scheme: 'tg' | 'sg' | 'turrit' | 'iMe' | 'ng' | 'lg' 等
function buildTargetUrl(scheme, parsedUrl) {
  const rawPath = String(parsedUrl.pathname || '/');
  const segments = rawPath.split('/').filter(Boolean);

  if (!segments.length) return null;

  // /s/username → 频道预览
  if (segments[0] === 's' && segments.length > 1) {
    segments.shift();
  }

  const first = segments[0];

  // ── /username/postId  (频道文章)
  if (first && isAllDigits(first.slice(1)) && first[0] === '+' && first.length > 1) {
    // 邀请链接: /+hash
    return `${scheme}://join?invite=${encodeURIComponent(first.slice(1))}`;
  }

  // ── /addstickers/pack
  if (first === 'addstickers' && segments[1]) {
    return `${scheme}://addstickers?set=${encodeURIComponent(segments[1])}`;
  }

  // ── /share/url?url=...&text=...
  if (first === 'share' && segments[1] === 'url') {
    const parts = [];
    const urlParam = parsedUrl.searchParams.get('url');
    const textParam = parsedUrl.searchParams.get('text');
    if (urlParam) parts.push('url=' + encodeURIComponent(urlParam));
    if (textParam) parts.push('text=' + encodeURIComponent(textParam));
    return `${scheme}://msg_url?${parts.join('&')}`;
  }

  // ── /c/channelId/messageId  (私有频道消息)
  if (
    first === 'c' &&
    segments[1] && isAllDigits(segments[1]) &&
    segments[2] && isAllDigits(segments[2])
  ) {
    return `${scheme}://privatepost?channel=${segments[1]}&post=${segments[2]}`;
  }

  // ── /username  或  /username/messageId  (普通用户/频道)
  const username = first;
  if (!username) return null;

  const params = [`domain=${encodeURIComponent(username)}`];
  if (segments[1] && isAllDigits(segments[1])) {
    params.push(`post=${segments[1]}`);
  }

  // 把原始 search params 也透传
  parsedUrl.searchParams.forEach((v, k) => {
    params.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  });

  return `${scheme}://resolve?${params.join('&')}`;
}

// ─── 生成"中间跳转"HTML 页面（open_mode=307） ─────────────────────
function buildHtmlPage(targetUrl, webUrl, scheme, appName, originalUrl) {
  const safeTarget  = escapeHtml(targetUrl);
  const safeWebUrl  = escapeHtml(webUrl);
  const safeScheme  = escapeHtml(scheme);
  const safeApp     = escapeHtml(appName);
  const safeOrig    = escapeHtml(originalUrl);
  const jsonTarget  = JSON.stringify(targetUrl);
  const countdown   = new Date().getTime() + 3000;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>正在跳转...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #f2f2f7;
           display: flex; justify-content: center; align-items: center;
           min-height: 100vh; }
    main { background: #fff; border-radius: 16px; padding: 32px 24px;
           max-width: 360px; width: 90%; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    h1   { font-size: 18px; color: #1c1c1e; margin-bottom: 8px; }
    p    { font-size: 14px; color: #6c6c70; margin-bottom: 24px; }
    .btn { display: inline-block; padding: 12px 24px; border-radius: 12px;
           font-size: 15px; font-weight: 600; text-decoration: none;
           margin: 6px; transition: opacity .2s; }
    .btn:active { opacity: .7; }
    .btn-primary  { background: #007aff; color: #fff; }
    .btn-secondary{ background: #e5e5ea; color: #1c1c1e; }
    footer { margin-top: 20px; font-size: 12px; color: #aeaeb2; }
    #timer { font-weight: 700; color: #007aff; }
  </style>
</head>
<body>
  <main>
    <h1>正在跳转到 Telegram</h1>
    <p><span id="timer">3</span> 秒后自动在客户端内打开</p>
    <section>
      <div>
        <a class="btn btn-primary"  href="${safeTarget}">在客户端内打开</a>
        <a class="btn btn-secondary" href="${safeWebUrl}" data-orig="${safeOrig}">在浏览器中打开</a>
      </div>
    </section>
    <footer>
      <span>Powered by 李悦柠@liyuening</span>
    </footer>
  </main>
  <script>
    // 自动跳转
    setTimeout(function(){ window.location.href = ${jsonTarget}; }, ${countdown} - Date.now());

    // 倒计时显示
    const el = document.getElementById('timer');
    const iv = setInterval(function(){
      const s = Math.ceil((${countdown} - Date.now()) / 1000);
      if (s <= 0) { clearInterval(iv); return; }
      el.textContent = s;
    }, 200);
  </script>
</body>
</html>`;
}

// ─── 读取 BoxJs 持久化存储的配置 ──────────────────────────────────
// BoxJs 将用户选择存入 $persistentStore，key 为 setting id
// 若未安装 BoxJs 则 $persistentStore.read() 返回 null，自动降级到 $argument
function readBoxJs(key) {
  try {
    return $persistentStore.read(key) || null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
//  主逻辑
// ══════════════════════════════════════════════════════════════════
(function () {
  // 1. 优先读取 BoxJs 配置，没有再读 $argument，最后用默认值
  const args = parseArgument($argument);

  const appName = String(
    readBoxJs('tg_redirect_app')           // BoxJs 选择的客户端
    || args['tme_redirect']                // argument 兼容写法1
    || args['tg_redirect']                 // argument 兼容写法2
    || args['redirect']                    // argument 兼容写法3
    || 'Telegram'                          // 默认值
  );

  const openMode = String(
    readBoxJs('tg_redirect_mode')          // BoxJs 选择的跳转方式
    || args['open_mode']                   // argument 指定
    || '307'                               // 默认直跳
  ).toLowerCase();

  // 2. 应用名 → 协议 scheme 映射
  const schemeMap = {
    'Telegram':   'tg',
    'Swiftgram':  'sg',
    'Turrit':     'turrit',
    'iMe':        'iMe',
    'Nicegram':   'ng',
    'Lingogram':  'lg',
  };

  let scheme = schemeMap[appName] || String(appName || '');

  if (!scheme) return $done({});

  // 去掉协议前缀（如果传入的是 tg://）
  if (scheme.indexOf('://') >= 0) {
    scheme = scheme.split('://')[0];
  }

  // 3. 解析当前请求 URL
  const reqUrl = $request && $request.url ? $request.url : '';
  let parsedUrl;
  try {
    parsedUrl = new URL(reqUrl);
  } catch {
    return $done({});
  }

  // 4. 过滤：tgWebAppPlatform=0 的请求直接放行（避免循环）
  if (parsedUrl.searchParams && parsedUrl.searchParams.get('tgWebAppPlatform') === '0') {
    return $done({});
  }

  // 5. 只处理 t.me / telegram.me
  const host = String(parsedUrl.hostname || '').toLowerCase();
  if (host !== 't.me' && host !== 'telegram.me') return $done({});

  // 6. 构建目标协议 URL
  const targetUrl = buildTargetUrl(scheme, parsedUrl);
  if (!targetUrl) return $done({});

  // 7. 根据 open_mode 决定响应方式
  if (openMode === '200') {
    // 返回 HTML 中间页
    const webUrl  = appendPlatformParam(parsedUrl.toString());
    const htmlBody = buildHtmlPage(targetUrl, webUrl, scheme, appName, reqUrl);
    return $done({
      response: {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
        body: htmlBody,
      },
    });
  }

  // 默认：307 重定向
  return $done({
    response: {
      status: 307,
      headers: {
        'Location': targetUrl,
        'Cache-Control': 'no-store',
      },
      body: '',
    },
  });
})();
