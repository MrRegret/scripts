
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

function isAllDigits(str) {
  if (!str) return false;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 48 || c > 57) return false; // '0'~'9'
  }
  return true;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function appendPlatformParam(href) {
  try {
    const u = new URL(href);
    u.searchParams.set('tgWebAppPlatform', '0');
    return u.toString();
  } catch {
    return href + (href.includes('?') ? '&' : '?') + 'tgWebAppPlatform=0';
  }
}


function buildTargetUrl(scheme, parsedUrl) {
  const rawPath = String(parsedUrl.pathname || '/');
  const segments = rawPath.split('/').filter(Boolean);

  if (!segments.length) return null;


  if (segments[0] === 's' && segments.length > 1) {
    segments.shift();
  }

  const first = segments[0];

  if (first && isAllDigits(first.slice(1)) && first[0] === '+' && first.length > 1) {

    return `${scheme}://join?invite=${encodeURIComponent(first.slice(1))}`;
  }

  if (first === 'addstickers' && segments[1]) {
    return `${scheme}://addstickers?set=${encodeURIComponent(segments[1])}`;
  }


  if (first === 'share' && segments[1] === 'url') {
    const parts = [];
    const urlParam = parsedUrl.searchParams.get('url');
    const textParam = parsedUrl.searchParams.get('text');
    if (urlParam) parts.push('url=' + encodeURIComponent(urlParam));
    if (textParam) parts.push('text=' + encodeURIComponent(textParam));
    return `${scheme}://msg_url?${parts.join('&')}`;
  }


  if (
    first === 'c' &&
    segments[1] && isAllDigits(segments[1]) &&
    segments[2] && isAllDigits(segments[2])
  ) {
    return `${scheme}://privatepost?channel=${segments[1]}&post=${segments[2]}`;
  }


  const username = first;
  if (!username) return null;

  const params = [`domain=${encodeURIComponent(username)}`];
  if (segments[1] && isAllDigits(segments[1])) {
    params.push(`post=${segments[1]}`);
  }


  parsedUrl.searchParams.forEach((v, k) => {
    params.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  });

  return `${scheme}://resolve?${params.join('&')}`;
}


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


function readBoxJs(key) {
  try {
    return $persistentStore.read(key) || null;
  } catch {
    return null;
  }
}


(function () {
  const args = parseArgument($argument);

  const appName = String(
    readBoxJs('tg_redirect_app')          
    || args['tme_redirect']             
    || args['tg_redirect']                
    || args['redirect']                  
    || 'Telegram'                         
  );

  const openMode = String(
    readBoxJs('tg_redirect_mode')        
    || args['open_mode']                   
    || '307'                              
  ).toLowerCase();


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


  if (scheme.indexOf('://') >= 0) {
    scheme = scheme.split('://')[0];
  }

  const reqUrl = $request && $request.url ? $request.url : '';
  let parsedUrl;
  try {
    parsedUrl = new URL(reqUrl);
  } catch {
    return $done({});
  }


  if (parsedUrl.searchParams && parsedUrl.searchParams.get('tgWebAppPlatform') === '0') {
    return $done({});
  }


  const host = String(parsedUrl.hostname || '').toLowerCase();
  if (host !== 't.me' && host !== 'telegram.me') return $done({});


  const targetUrl = buildTargetUrl(scheme, parsedUrl);
  if (!targetUrl) return $done({});


  if (openMode === '200') {

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
