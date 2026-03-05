/*
  TG链接重定向脚本 (反混淆并修复版)
  作者: 李悦柠
  修复: Nicegram 和 Lingogram 的 URL Scheme
  
  使用方法:
  1. 在 Surge/Loon/Quantumult X 中添加此脚本
  2. 配置参数: tme_redirect=Nicegram (或其他客户端名称)
  3. 访问 t.me 链接时会自动重定向到指定客户端
*/

// ===== 主函数 =====
(function() {
  // 解析脚本参数
  const params = parseArgument($argument);
  
  // 获取重定向目标客户端 (支持多种参数名)
  const redirectTarget = params['tme_redirect'] || 
                        params['redirect'] || 
                        params['client'] || 
                        'Telegram';
  
  const targetClient = String(redirectTarget || 'Telegram');
  
  // 获取打开模式 (307重定向 或 HTML页面)
  const openMode = String(params['open_mode'] || '307').toLowerCase();
  
  // 客户端URL Scheme映射 (✅ 已修复)
  const CLIENT_SCHEMES = {
    'Telegram': 'tg',
    'Swiftgram': 'sg',
    'Turrit': 'turrit',
    'iMe': 'ime',
    'Nicegram': 'nicegram',      // ✅ 修复: ng -> nicegram
    'Lingogram': 'lingogram'      // ✅ 修复: lg -> lingogram
  };
  
  // 获取目标客户端的URL Scheme
  let scheme = CLIENT_SCHEMES[redirectTarget] || String(redirectTarget || '');
  
  if (!scheme) {
    return $done({});
  }
  
  // 如果scheme包含://，提取scheme部分
  if (scheme.indexOf('://') >= 0) {
    scheme = scheme.split('://')[1];
  }
  
  // 获取请求URL
  const requestUrl = $request && $request['url'] ? $request['url'] : '';
  
  let urlObj;
  try {
    urlObj = new URL(requestUrl);
  } catch (error) {
    return $done({});
  }
  
  // 检查是否已经处理过 (避免重复重定向)
  if (urlObj['search'] && urlObj['searchParams']['get']('tg') === '0') {
    return $done({});
  }
  
  // 检查域名是否为 t.me 或 telegram.me
  const hostname = String(urlObj['hostname'] || '').toLowerCase();
  if (hostname !== 't.me' && hostname !== 'telegram.me') {
    return $done({});
  }
  
  // 构建重定向URL
  const redirectUrl = buildRedirectUrl(scheme, urlObj);
  
  if (!redirectUrl) {
    return $done({});
  }
  
  // 根据打开模式返回不同响应
  if (openMode === 'd9') {
    // HTML页面模式 - 显示按钮和自动跳转
    const cleanUrl = markUrlAsProcessed(urlObj['toString']());
    const htmlPage = generateHtmlPage(redirectUrl, cleanUrl, scheme, targetClient, requestUrl);
    
    return $done({
      'response': {
        'status': 200,
        'headers': {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store'
        },
        'body': htmlPage
      }
    });
  }
  
  // 默认: 307重定向模式
  return $done({
    'response': {
      'status': 307,
      'headers': {
        'Location': redirectUrl,
        'Cache-Control': 'no-store'
      },
      'body': ''
    }
  });
  
  // ===== 辅助函数 =====
  
  // 解析脚本参数
  function parseArgument(arg) {
    if (typeof arg === 'object' && arg) {
      return arg;
    }
    
    const result = {};
    const argString = String(arg || '');
    
    if (!argString) {
      return result;
    }
    
    const pairs = argString.split('&');
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      if (!pair) continue;
      
      const equalIndex = pair.indexOf('=');
      if (equalIndex < 0) continue;
      
      const key = decodeURIComponent(pair.slice(0, equalIndex));
      const value = decodeURIComponent(pair.slice(equalIndex + 1));
      result[key] = value;
    }
    
    return result;
  }
  
  // 标记URL为已处理 (添加 tg=0 参数)
  function markUrlAsProcessed(url) {
    try {
      const urlObj = new URL(url);
      urlObj['searchParams']['set']('tg', '0');
      return urlObj['toString']();
    } catch (error) {
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'tg=0';
    }
  }
  
  // 检查字符串是否只包含数字
  function isNumericString(str) {
    if (!str) return false;
    
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      if (charCode < 48 || charCode > 57) {
        return false;
      }
    }
    
    return true;
  }
  
  // 构建重定向URL
  function buildRedirectUrl(scheme, urlObj) {
    const pathParts = String(urlObj['pathname'] || '/').split('/');
    const parts = [];
    
    // 收集非空路径部分
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i]) {
        parts.push(pathParts[i]);
      }
    }
    
    if (!parts.length) {
      return null;
    }
    
    // 处理 /s/ 短链接
    if (parts[0] === 's' && parts.length > 1) {
      parts.shift();
    }
    
    // 1. 处理 /joinchat/ 链接
    if (parts[0] === 'joinchat' && parts[1]) {
      return scheme + '://join?invite=' + encodeURIComponent(parts[1]);
    }
    
    // 2. 处理 /+invite 链接
    if (parts[0].charAt(0) === '+' && parts[0].length > 1) {
      return scheme + '://join?invite=' + encodeURIComponent(parts[0].slice(1));
    }
    
    // 3. 处理 /addstickers/ 链接
    if (parts[0] === 'addstickers' && parts[1]) {
      return scheme + '://addstickers?set=' + encodeURIComponent(parts[1]);
    }
    
    // 4. 处理 /share/url 链接
    if (parts[0] === 'share' && parts[1] === 'url') {
      const queryParams = [];
      const urlParam = urlObj['searchParams']['get']('url');
      const textParam = urlObj['searchParams']['get']('text');
      
      if (urlParam) {
        queryParams.push('url=' + encodeURIComponent(urlParam));
      }
      if (textParam) {
        queryParams.push('text=' + encodeURIComponent(textParam));
      }
      
      return scheme + '://msg_url?' + queryParams.join('&');
    }
    
    // 5. 处理 /c/channelId/postId 私密频道链接
    if (parts[0] === 'c' && parts[1] && parts[2] && 
        isNumericString(parts[1]) && isNumericString(parts[2])) {
      return scheme + '://privatepost?channel=' + parts[1] + '&post=' + parts[2];
    }
    
    // 6. 处理普通用户名/频道链接
    const username = parts[0];
    if (!username) {
      return null;
    }
    
    const queryParams = [];
    queryParams.push('domain=' + encodeURIComponent(username));
    
    // 如果有消息ID，添加post参数
    if (parts[1] && isNumericString(parts[1])) {
      queryParams.push('post=' + parts[1]);
    }
    
    // 添加URL中的其他查询参数
    urlObj['searchParams']['forEach'](function(value, key) {
      queryParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });
    
    return scheme + '://resolve?' + queryParams.join('&');
  }
  
  // HTML实体编码
  function htmlEscape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  // 生成HTML页面
  function generateHtmlPage(redirectUrl, cleanUrl, scheme, client, originalUrl) {
    const escapedRedirectUrl = htmlEscape(redirectUrl);
    const escapedCleanUrl = htmlEscape(cleanUrl);
    const escapedScheme = htmlEscape(scheme);
    const escapedClient = htmlEscape(client);
    const escapedOriginalUrl = htmlEscape(originalUrl);
    const jsonRedirectUrl = JSON.stringify(redirectUrl);
    const timestamp = new Date().getTime() + 3000;
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedClient} - Telegram重定向</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .container { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
    h1 { color: #333; margin-bottom: 1rem; }
    .btn { display: inline-block; padding: 12px 24px; margin: 10px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; transition: background 0.3s; }
    .btn:hover { background: #5568d3; }
    .info { color: #666; font-size: 14px; margin-top: 1rem; }
  </style>
</head>
<body>
  <main>
    <section class="container">
      <h1>正在跳转到 ${escapedClient}</h1>
      <div>
        <a class="btn" href="${escapedRedirectUrl}">在客户端内打开</a>
        <a class="btn" href="${escapedCleanUrl}">在浏览器中打开</a>
      </div>
      <div class="info">
        原始链接: ${escapedOriginalUrl}
      </div>
    </section>

    <script>
      setTimeout(function(){window.location.href=${jsonRedirectUrl};},${timestamp});
    </script>
    
    <footer style="position: fixed; bottom: 10px; width: 100%; text-align: center; color: white; font-size: 12px;">
      <span>脚本作者: <a href="https://t.me/liyuening" target="_blank" rel="noopener noreferrer" style="color: white;">李悦柠</a></span>
      <span>Powered by 李悦柠@liyuening</span>
    </footer>
  </main>
</body>
</html>`;
  }
})();
