/*
  TG链接重定向脚本 - 兼容数组参数格式
  修复内容:
  - 支持 Loon 的数组参数格式: ["Nicegram", "html"]
  - 修复 Nicegram: ng -> nicegram
  - 修复 Lingogram: lg -> lingogram
  - 兼容多种参数传递格式
*/

(function() {
  try {
    console.log('[TG Redirect] ========== 脚本开始执行 ==========');
    console.log('[TG Redirect] 原始参数:', JSON.stringify($argument));
    console.log('[TG Redirect] 参数类型:', typeof $argument);
    
    let redirectTarget = 'Nicegram';  // 默认使用 Nicegram
    let openMode = 'html';            // 默认使用 html 模式
    
    // 解析参数 - 支持多种格式
    if (Array.isArray($argument)) {
      // 格式1: 数组格式 ["Nicegram", "html"]
      console.log('[TG Redirect] 参数格式: 数组');
      redirectTarget = $argument[0] || 'Nicegram';
      openMode = $argument[1] || 'html';
    } else if (typeof $argument === 'object' && $argument !== null) {
      // 格式2: 对象格式 {tme_redirect: "Nicegram", open_mode: "html"}
      console.log('[TG Redirect] 参数格式: 对象');
      redirectTarget = $argument['tme_redirect'] || $argument['redirect'] || $argument['client'] || 'Nicegram';
      openMode = $argument['open_mode'] || 'html';
    } else if (typeof $argument === 'string') {
      // 格式3: 字符串格式 "tme_redirect=Nicegram&open_mode=html"
      console.log('[TG Redirect] 参数格式: 字符串');
      const params = parseQueryString($argument);
      redirectTarget = params['tme_redirect'] || params['redirect'] || params['client'] || 'Nicegram';
      openMode = params['open_mode'] || 'html';
    }
    
    // 转换为小写以兼容各种写法
    const targetClient = String(redirectTarget || 'Nicegram');
    const targetLower = targetClient.toLowerCase();
    const mode = String(openMode || 'html').toLowerCase();
    
    console.log('[TG Redirect] 目标客户端:', targetClient);
    console.log('[TG Redirect] 目标客户端(小写):', targetLower);
    console.log('[TG Redirect] 打开模式:', mode);
    
    // 客户端URL Scheme映射
    const CLIENT_SCHEMES = {
      'telegram': 'tg',
      'swiftgram': 'sg',
      'turrit': 'turrit',
      'ime': 'ime',
      'nicegram': 'nicegram',      // ✅ 修复: ng -> nicegram
      'lingogram': 'lingogram'      // ✅ 修复: lg -> lingogram
    };
    
    // 获取对应的URL Scheme
    let scheme = CLIENT_SCHEMES[targetLower];
    
    if (!scheme) {
      console.log('[TG Redirect] ⚠️ 未找到映射，尝试直接使用:', targetLower);
      scheme = targetLower;
    }
    
    console.log('[TG Redirect] 使用的 URL Scheme:', scheme);
    
    // 验证scheme有效性
    if (!scheme || scheme === '' || scheme.includes('{') || scheme.includes('}')) {
      console.log('[TG Redirect] ❌ 无效的 URL Scheme:', scheme);
      return $done({});
    }
    
    // 如果scheme包含://,提取scheme部分
    if (scheme.indexOf('://') >= 0) {
      scheme = scheme.split('://')[0];
    }
    
    // 获取请求URL
    const requestUrl = $request && $request.url ? $request.url : '';
    console.log('[TG Redirect] 请求 URL:', requestUrl);
    
    if (!requestUrl) {
      console.log('[TG Redirect] ❌ 无法获取请求 URL');
      return $done({});
    }
    
    // 解析URL
    let urlObj;
    try {
      urlObj = new URL(requestUrl);
    } catch (error) {
      console.log('[TG Redirect] ❌ URL 解析失败:', error);
      return $done({});
    }
    
    // 防止重定向循环
    if (urlObj.searchParams && urlObj.searchParams.get('tg') === '0') {
      console.log('[TG Redirect] ⚠️ 检测到重定向循环标记，跳过处理');
      return $done({});
    }
    
    // 验证域名
    const hostname = String(urlObj.hostname || '').toLowerCase();
    if (hostname !== 't.me' && hostname !== 'telegram.me') {
      console.log('[TG Redirect] ⚠️ 非 Telegram 域名:', hostname);
      return $done({});
    }
    
    // 构建重定向URL
    const redirectUrl = buildRedirectUrl(scheme, urlObj);
    
    if (!redirectUrl) {
      console.log('[TG Redirect] ❌ 无法构建重定向 URL');
      return $done({});
    }
    
    console.log('[TG Redirect] ✅ 重定向 URL:', redirectUrl);
    
    // 根据打开模式返回不同响应
    if (mode === 'html' || mode === 'd9' || mode === '302') {
      // HTML中转页模式
      const cleanUrl = markUrlAsProcessed(urlObj.toString());
      const htmlPage = generateHtmlPage(redirectUrl, cleanUrl, scheme, targetClient, requestUrl);
      
      console.log('[TG Redirect] 📄 使用 HTML 中转页模式');
      
      return $done({
        response: {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store'
          },
          body: htmlPage
        }
      });
    }
    
    // 默认: 307直接重定向模式
    console.log('[TG Redirect] 🔄 使用 307 直接重定向模式');
    
    return $done({
      response: {
        status: 307,
        headers: {
          'Location': redirectUrl,
          'Cache-Control': 'no-store'
        },
        body: ''
      }
    });
    
  } catch (error) {
    console.log('[TG Redirect] ❌ 脚本执行错误:', error);
    return $done({});
  }
  
  // ===== 辅助函数 =====
  
  function parseQueryString(str) {
    const result = {};
    const argString = String(str || '');
    
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
  
  function markUrlAsProcessed(url) {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set('tg', '0');
      return urlObj.toString();
    } catch (error) {
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'tg=0';
    }
  }
  
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
  
  function buildRedirectUrl(scheme, urlObj) {
    const pathParts = String(urlObj.pathname || '/').split('/');
    const parts = [];
    
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i]) {
        parts.push(pathParts[i]);
      }
    }
    
    if (!parts.length) {
      return null;
    }
    
    if (parts[0] === 's' && parts.length > 1) {
      parts.shift();
    }
    
    if (parts[0] === 'joinchat' && parts[1]) {
      return scheme + '://join?invite=' + encodeURIComponent(parts[1]);
    }
    
    if (parts[0].charAt(0) === '+' && parts[0].length > 1) {
      return scheme + '://join?invite=' + encodeURIComponent(parts[0].slice(1));
    }
    
    if (parts[0] === 'addstickers' && parts[1]) {
      return scheme + '://addstickers?set=' + encodeURIComponent(parts[1]);
    }
    
    if (parts[0] === 'share' && parts[1] === 'url') {
      const queryParams = [];
      const urlParam = urlObj.searchParams.get('url');
      const textParam = urlObj.searchParams.get('text');
      
      if (urlParam) {
        queryParams.push('url=' + encodeURIComponent(urlParam));
      }
      if (textParam) {
        queryParams.push('text=' + encodeURIComponent(textParam));
      }
      
      return scheme + '://msg_url?' + queryParams.join('&');
    }
    
    if (parts[0] === 'c' && parts[1] && parts[2] && 
        isNumericString(parts[1]) && isNumericString(parts[2])) {
      return scheme + '://privatepost?channel=' + parts[1] + '&post=' + parts[2];
    }
    
    const username = parts[0];
    if (!username) {
      return null;
    }
    
    const queryParams = [];
    queryParams.push('domain=' + encodeURIComponent(username));
    
    if (parts[1] && isNumericString(parts[1])) {
      queryParams.push('post=' + parts[1]);
    }
    
    urlObj.searchParams.forEach(function(value, key) {
      queryParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });
    
    return scheme + '://resolve?' + queryParams.join('&');
  }
  
  function htmlEscape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  function generateHtmlPage(redirectUrl, cleanUrl, scheme, client, originalUrl) {
    const escapedRedirectUrl = htmlEscape(redirectUrl);
    const escapedCleanUrl = htmlEscape(cleanUrl);
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
      <div class="info">原始链接: ${escapedOriginalUrl}</div>
    </section>
    <script>setTimeout(function(){window.location.href=${jsonRedirectUrl};},${timestamp});</script>
  </main>
</body>
</html>`;
  }
})();
