/**
 * TG链接重定向 - 修复版 2.0
 * 1. 修复 ReferenceError 异常
 * 2. 修复 + 号加群链接逻辑
 * 3. 过滤 /v/, /iv/ 等 App 无法解析的网页专用链接
 */

// --- 1. 参数解析 ---
const argString = $argument || "";
const [argTarget, argMode] = argString.split(",");
const targetApp = argTarget || "Telegram";
const openMode = (argMode || "307").toLowerCase();

// --- 2. 协议头映射 ---
const schemes = {
    "Telegram": "tg",
    "Swiftgram": "sg",
    "Turrit": "tr",
    "iMe": "ime",
    "Nicegram": "nicegram",
    "Lingogram": "lg"
};
const scheme = schemes[targetApp] || "tg";

// 准备退出函数
const close = () => $done({});

if (!$request || !$request.url) close();

try {
    const url = new URL($request.url);
    const path = url.pathname;
    const pathParts = path.split("/").filter(x => x);

    // 如果没有路径（只是 t.me/），不执行
    if (pathParts.length === 0) close();

    const first = pathParts[0];

    // --- 3. 过滤掉 App 无法处理的网页专用路径 ---
    // /v/ 是视图统计, /iv/ 是即时预览, /invoice/ 是账单, /boost/ 是频道助力
    if (["v", "iv", "invoice", "boost"].includes(first)) {
        close();
    }

    let tgUrl = null;

    // --- 4. 链接转换逻辑 ---
    if (first === "s" && pathParts.length > 1) {
        // 频道预览链接 t.me/s/username
        tgUrl = `${scheme}://resolve?domain=${pathParts[1]}`;
    } else if (first === "c" && pathParts.length > 1) {
        // 私密频道内容 t.me/c/123456/789
        tgUrl = `${scheme}://privatepost?channel=${pathParts[1]}&post=${pathParts[2] || ""}`;
    } else if (first === "addstickers") {
        tgUrl = `${scheme}://addstickers?set=${pathParts[1]}`;
    } else if (first === "joinchat" && pathParts.length > 1) {
        // 旧版加群 t.me/joinchat/ABC
        tgUrl = `${scheme}://join?invite=${pathParts[1]}`;
    } else if (first.startsWith("+")) {
        // 新版加群 t.me/+ABC
        tgUrl = `${scheme}://join?invite=${first.substring(1)}`;
    } else if (first === "proxy" || first === "socks") {
        tgUrl = `${scheme}://proxy${url.search}`;
    } else {
        // 普通用户/频道/机器人 t.me/username
        // 将原 URL 的参数带入，比如 t.me/username?start=xxx
        const search = url.search ? url.search.replace("?", "&") : "";
        tgUrl = `${scheme}://resolve?domain=${first}${search}`;
    }

    if (!tgUrl) close();

    // --- 5. 执行跳转 ---
    if (openMode === "html") {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Redirecting...</title>
    <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #fff; font-family: -apple-system, sans-serif; }
        .icon { width: 80px; height: 80px; margin-bottom: 20px; background: url('https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Telegram.png') no-repeat center/cover; }
        .title { font-size: 18px; font-weight: 600; color: #222; margin-bottom: 30px; }
        .btn { background: #248bcf; color: #fff; padding: 12px 40px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: 500; }
    </style>
</head>
<body>
    <div class="icon"></div>
    <div class="title">正在打开 ${targetApp}</div>
    <a href="${tgUrl}" class="btn">立即打开</a>
    <script>
        setTimeout(function() { window.location.href = "${tgUrl}"; }, 500);
    </script>
</body>
</html>`;
        $done({ response: { status: 200, headers: { "Content-Type": "text/html;charset=UTF-8" }, body: html } });
    } else {
        $done({ response: { status: 307, headers: { "Location": tgUrl, "Cache-Control": "no-store" } } });
    }

} catch (e) {
    console.log("TG重定向脚本错误: " + e);
    close();
}
