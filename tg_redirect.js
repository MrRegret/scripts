/**
 * by：
 * 作用：
 * 先登录

[rewrite_local]
^https?:\/\/(t|telegram)\.me\/.* url script-response-body https://raw.githubusercontent.com/MrRegret/scripts/refs/heads/main/tg_redirect.js

[mitm]
hostname = t.me, telegram.me
 */


(function() {
    const path = $request.url.match(/^https?:\/\/t\.me\/(.+)$/);
    if (!path) {
        $done({ status: 404, body: "Invalid t.me link" });
        return;
    }

    // BoxJS 配置 Key
    const appKey = "tg_redirect_app";
    let client = $prefs.valueForKey(appKey) || "Nicegram";

    // Scheme 对应表
    const schemeMap = {
        "Telegram": "tg://resolve?domain=",
        "Swiftgram": "swiftgram://resolve?domain=",
        "Nicegram": "nicegram://resolve?domain=",
        "iMe": "ime://resolve?domain=",
        "Turrit": "turrit://resolve?domain=",
        "Lingogram": "lingogram://resolve?domain="
    };

    const redirectURL = (schemeMap[client] || schemeMap["Nicegram"]) + path[1];

    // 返回极简 HTML 自动跳转
    const body = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Redirecting…</title>
<script>window.location.href="${redirectURL}";</script>
</head>
<body>Redirecting to ${client}...</body>
</html>
`;

    $done({
        status: 200,
        headers: { "Content-Type": "text/html" },
        body: body
    });
})();
