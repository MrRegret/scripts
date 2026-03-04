/**
 * by：
 * 作用：
 * 先登录

[rewrite_local]
^https?:\/\/(t|telegram)\.me\/.* url script-response-body https://raw.githubusercontent.com/MrRegret/scripts/refs/heads/main/tg_redirect.js

[mitm]
hostname = t.me, telegram.me
 */


let apps = {
  "Telegram": "tg://resolve?domain=",
  "Swiftgram": "swiftgram://resolve?domain=",
  "Nicegram": "nicegram://resolve?domain=",
  "iMe": "ime://resolve?domain=",
  "Turrit": "turrit://resolve?domain=",
  "Lingogram": "lingo://resolve?domain="
};

// 获取 BoxJS 配置的目标客户端
let targetApp = $prefs.valueForKey("tg_redirect_app") || "Telegram";

let url = $request.url;

if (!url.includes("t.me")) {
  $done({});
} else {
  // 提取 t.me 的路径部分
  let pathMatch = url.match(/t\.me\/(.+)/);
  if (!pathMatch) {
    $done({});
  } else {
    let path = pathMatch[1];

    // 生成中间页 HTML
    let deepLink = apps[targetApp] + path;
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>正在跳转 ${targetApp}</title>
<meta http-equiv="refresh" content="0; url=${deepLink}">
<style>
body { display:flex; justify-content:center; align-items:center; height:100vh; font-family:Arial; }
p { font-size:18px; }
</style>
</head>
<body>
<p>正在打开 ${targetApp} …</p>
<script>
window.location.href='${deepLink}';
</script>
</body>
</html>`;

    $done({
      response: {
        status: 200,
        headers: { "Content-Type": "text/html" },
        body: html
      }
    });
  }
}
