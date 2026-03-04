/******************************
/******************************
*************************
[mitm]
hostname = t.me, telegram.me
[rewrite_local]
^https?://(t\.me|telegram\.me)/ url script-request-header https://raw.githubusercontent.com/MrRegret/scripts/refs/heads/main/tg_redirect.js
*************************
*****************************************/
function parseArgument(arg) {
  var result = {};
  if (!arg || typeof arg !== 'string') return result;
  arg.split('&').forEach(function(pair) {
    var idx = pair.indexOf('=');
    if (idx < 0) return;
    var k = decodeURIComponent(pair.slice(0, idx));
    var v = decodeURIComponent(pair.slice(idx + 1));
    result[k] = v;
  });
  return result;
}

/**
 * 读取持久化存储
 * QuantumultX 用 $prefs.valueForKey()
 */
function readPref(key) {
  try {
    return $prefs.valueForKey(key) || null;
  } catch(e) {
    return null;
  }
}

/** HTML 实体转义 */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 判断字符串是否为纯数字（消息 ID 用） */
function isDigits(s) {
  return s && /^\d+$/.test(s);
}

// ─── 核心：将 t.me URL 转换为客户端深链 ─────────────────────────

/**
 * @param {string} scheme  如 'tg'、'sg' 等
 * @param {URL}    u       已解析的请求 URL 对象
 * @returns {string|null}
 */
function buildDeepLink(scheme, u) {
  var parts = u.pathname.split('/').filter(Boolean);

  // /s/username → 去掉频道预览前缀 's'
  if (parts[0] === 's' && parts.length > 1) parts.shift();

  if (!parts.length) return null;

  var p0 = parts[0];

  // ── 邀请链接：/+xxxxxxxx（hash 含字母，非纯数字）
  if (p0.charAt(0) === '+' && p0.length > 1 && !isDigits(p0.slice(1))) {
    return scheme + '://join?invite=' + encodeURIComponent(p0.slice(1));
  }

  // ── 电话号码：/+1234567890（纯数字）
  if (p0.charAt(0) === '+' && isDigits(p0.slice(1))) {
    return scheme + '://resolve?phone=' + encodeURIComponent(p0.slice(1));
  }

  // ── 贴纸包：/addstickers/PackName
  if (p0 === 'addstickers' && parts[1]) {
    return scheme + '://addstickers?set=' + encodeURIComponent(parts[1]);
  }

  // ── 表情包：/addemoji/PackName
  if (p0 === 'addemoji' && parts[1]) {
    return scheme + '://addemoji?set=' + encodeURIComponent(parts[1]);
  }

  // ── 分享：/share/url?url=...&text=...
  if (p0 === 'share' && parts[1] === 'url') {
    var urlParam  = u.searchParams.get('url');
    var textParam = u.searchParams.get('text');
    var q = [];
    if (urlParam)  q.push('url='  + encodeURIComponent(urlParam));
    if (textParam) q.push('text=' + encodeURIComponent(textParam));
    return scheme + '://msg_url?' + q.join('&');
  }

  // ── 私有频道消息：/c/channelId/msgId
  if (p0 === 'c' && isDigits(parts[1]) && isDigits(parts[2])) {
    return scheme + '://privatepost?channel=' + parts[1] + '&post=' + parts[2];
  }

  // ── 普通用户名 / 公开频道（可选消息 ID、评论 ID）
  var q2 = ['domain=' + encodeURIComponent(p0)];
  if (isDigits(parts[1])) {
    q2.push('post=' + parts[1]);
    if (isDigits(parts[2])) q2.push('comment=' + parts[2]);
  }

  // 透传常见查询参数
  ['start', 'startgroup', 'game', 'voicechat', 'boost'].forEach(function(key) {
    var v = u.searchParams.get(key);
    if (v) q2.push(key + '=' + encodeURIComponent(v));
  });

  return scheme + '://resolve?' + q2.join('&');
}

// ─── 生成中间确认页 HTML ─────────────────────────────────────────

function buildHtmlPage(deepLink, appName) {
  var safeLink = esc(deepLink);
  var safeApp  = esc(appName);
  var ts       = Date.now() + 3000;

  return '<!DOCTYPE html><html lang="zh-CN"><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>正在跳转…</title>'
    + '<style>'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:-apple-system,sans-serif;background:#f2f2f7;'
    + 'display:flex;align-items:center;justify-content:center;min-height:100vh}'
    + '.card{background:#fff;border-radius:18px;padding:36px 24px;'
    + 'max-width:340px;width:92%;text-align:center;'
    + 'box-shadow:0 4px 24px rgba(0,0,0,.09)}'
    + 'h1{font-size:19px;color:#1c1c1e;margin-bottom:10px}'
    + 'p{font-size:14px;color:#636366;margin-bottom:28px}'
    + '#n{font-weight:700;color:#007aff}'
    + '.btn{display:block;padding:13px;border-radius:12px;'
    + 'font-size:15px;font-weight:600;text-decoration:none;margin-top:12px}'
    + '.p{background:#007aff;color:#fff}'
    + '.s{background:#e5e5ea;color:#1c1c1e}'
    + '</style></head><body>'
    + '<div class="card">'
    + '<h1>即将在 ' + safeApp + ' 中打开</h1>'
    + '<p><span id="n">3</span> 秒后自动跳转</p>'
    + '<a class="btn p" href="' + safeLink + '">立即打开</a>'
    + '<a class="btn s" id="cancel">取消自动跳转</a>'
    + '</div>'
    + '<script>'
    + 'var t=' + ts + ',iv;'
    + 'function tick(){'
    + 'var s=Math.ceil((t-Date.now())/1000);'
    + 'document.getElementById("n").textContent=s>0?s:0;'
    + 'if(s<=0){clearInterval(iv);location.href=' + JSON.stringify(deepLink) + ';}}'
    + 'iv=setInterval(tick,250);tick();'
    + 'document.getElementById("cancel").onclick=function(){clearInterval(iv);};'
    + '</script></body></html>';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  主逻辑
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function() {

  // 1. 读取配置（BoxJs $prefs 优先 → $argument → 默认值）
  var args     = parseArgument($argument);
  var appName  = readPref('tg_redirect_app')
              || args['tme_redirect']
              || args['tg_redirect']
              || args['redirect']
              || 'Telegram';
  var openMode = readPref('tg_redirect_mode')
              || args['open_mode']
              || '307';

  // 2. 应用名 → URL scheme
  var schemeMap = {
    'Telegram':  'tg',
    'Swiftgram': 'sg',
    'Nicegram':  'nicegram',
    'iMe':       'iMe',
    'Turrit':    'turrit',
    'Lingogram': 'lingogram'
  };
  var scheme = schemeMap[appName] || appName;
  scheme = scheme.split('://')[0]; // 容错带 :// 的写法
  if (!scheme) { $done({}); return; }

  // 3. 解析请求 URL
  var reqUrl = ($request && $request.url) ? $request.url : '';
  var u;
  try { u = new URL(reqUrl); } catch(e) { $done({}); return; }

  // 4. 防循环：已处理过的请求（带 tgWebAppPlatform 参数）直接放行
  if (u.searchParams.get('tgWebAppPlatform') !== null) {
    $done({});
    return;
  }

  // 5. 只处理 t.me / telegram.me
  var host = (u.hostname || '').toLowerCase();
  if (host !== 't.me' && host !== 'telegram.me') {
    $done({});
    return;
  }

  // 6. 构建深链
  var deepLink = buildDeepLink(scheme, u);
  if (!deepLink) { $done({}); return; }

  // 7. 返回响应
  //    script-echo-response 下 $done 的格式：
  //    { status, headers, body }
  if (openMode === '200') {
    $done({
      status: 'HTTP/1.1 200 OK',
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache'
      },
      body: buildHtmlPage(deepLink, appName)
    });
  } else {
    // 301 让浏览器/WebView 跳转到 custom scheme
    $done({
      status: 'HTTP/1.1 301 Moved Permanently',
      headers: {
        'Location': deepLink,
        'Cache-Control': 'no-store, no-cache',
        'Content-Type': 'text/plain'
      },
      body: ''
    });
  }

})();
