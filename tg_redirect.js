/**
 * by：
 * 作用：
 * 先登录

[rewrite_local]
^https?:\/\/(t|telegram)\.me\/.* url script-response-body https://raw.githubusercontent.com/MrRegret/scripts/refs/heads/main/tg_redirect.js

[mitm]
hostname = t.me, telegram.me
 */
const app = $prefs.valueForKey("tg_redirect_app") || "Nicegram"; // 目标客户端
const mode = $prefs.valueForKey("tg_redirect_mode") || "307";  // 跳转方式

// 解析请求 URL
let url = $request.url;
if (!url.startsWith("https://t.me/")) {
    $done({}); // 非 t.me 链接直接放行
}

// 构造客户端跳转 URL
let redirectUrl;
switch (app) {
    case "Nicegram":
        redirectUrl = url.replace("https://t.me/", "nicegram://user?url=");
        break;
    case "Telegram":
        redirectUrl = url.replace("https://t.me/", "tg://resolve?domain=");
        break;
    case "Swiftgram":
        redirectUrl = url.replace("https://t.me/", "swiftgram://resolve?domain=");
        break;
    case "iMe":
        redirectUrl = url.replace("https://t.me/", "ime://resolve?domain=");
        break;
    case "Turrit":
        redirectUrl = url.replace("https://t.me/", "turrit://resolve?domain=");
        break;
    case "Lingogram":
        redirectUrl = url.replace("https://t.me/", "lingogram://resolve?domain=");
        break;
    default:
        redirectUrl = url;
}

// 直接返回 307 或 302 重定向
$done({
    response: {
        status: parseInt(mode),
        headers: {
            "Location": redirectUrl,
            "Cache-Control": "no-store"
        },
        body: ""
    }
});
