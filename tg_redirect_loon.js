const argString = $argument || "";
let tgUrl = null;
const first = pathParts[0];

if (first === "s" && pathParts.length > 1) {
    tgUrl = `${scheme}://resolve?domain=${pathParts[1]}`;
} else if (first === "c" && pathParts.length > 1) {
    tgUrl = `${scheme}://privatepost?channel=${pathParts[1]}&post=${pathParts[2] || ""}`;
} else if (first === "addstickers") {
    tgUrl = `${scheme}://addstickers?set=${pathParts[1]}`;
} else if (first === "joinchat" || first === "+") {
    const code = first === "+" ? pathParts[0].substring(1) : pathParts[1];
    tgUrl = `${scheme}://join?invite=${code}`;
} else if (first === "proxy" || first === "socks") {
    tgUrl = `${scheme}://proxy${url.search}`;
} else if (["iv", "invoice", "boost"].includes(first)) {
    $done({}); 
} else {
    tgUrl = `${scheme}://resolve?domain=${first}${url.search.replace("?", "&")}`;
}

if (!tgUrl) $done({});

// --- 4. 视觉还原 (保持原版 UI，移除署名) ---
if (openMode === "html") {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Telegram Redirect</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background-color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .icon {
            width: 80px;
            height: 80px;
            margin-bottom: 20px;
            background-image: url('https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Telegram.png');
            background-size: cover;
        }
        .title {
            font-size: 18px;
            font-weight: 600;
            color: #222222;
            margin-bottom: 10px;
        }
        .desc {
            font-size: 14px;
            color: #888888;
            margin-bottom: 30px;
        }
        .btn {
            background-color: #248bcf;
            color: #ffffff;
            padding: 12px 40px;
            border-radius: 25px;
            text-decoration: none;
            font-size: 16px;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        .btn:active {
            background-color: #1d72aa;
        }
    </style>
</head>
<body>
    <div class="icon"></div>
    <div class="title">正在跳转至 ${targetApp}</div>
    <div class="desc">如果未自动跳转，请点击下方按钮</div>
    <a href="${tgUrl}" class="btn">在客户端内打开</a>

    <script>
        // 自动跳转逻辑
        setTimeout(function() {
            window.location.href = "${tgUrl}";
        }, 600);
    </script>
</body>
</html>`;

    $done({
        response: {
            status: 200,
            headers: { "Content-Type": "text/html;charset=UTF-8" },
            body: html
        }
    });
} else {
    // 307 静默重定向
    $done({
        response: {
            status: 307,
            headers: { "Location": tgUrl, "Cache-Control": "no-store" }
        }
    });
}
