/*
TG 链接重定向（可维护版）
author: 李悦柠（原作者） / ChatGPT（整理版）

参数示例（$argument）：
tme_redirect=nicegram&open_mode=307

可选参数：
- tme_redirect / app / client: 目标客户端（telegram/swiftgram/turrit/ime/nicegram/lingogram）或自定义scheme
- open_mode:
    - 302: 直接 302/307 跳转（更快）
    - 307: 返回中转页，自动唤起（更稳，推荐）
*/

(() => {
  const args = parseArgs($argument);

  // 兼容多个字段名
  const appRaw =
    args.tme_redirect ||
    args.app ||
    args.client ||
    "telegram";

  const openMode = String(args.open_mode || "307").toLowerCase();

  // 目标客户端 scheme 映射（已修正 Nicegram）
  const appMap = {
    telegram: "tg",
    swiftgram: "sg",
    turrit: "tt",
    ime: "ime",
    nicegram: "nicegram", // 关键修正
    lingogram: "lg",
  };

  let scheme = appMap[String(appRaw).toLowerCase()] || String(appRaw || "").trim();
  if (!scheme) return $done({});

  // 若传的是 "tg://..." 这种，提取 scheme
  if (scheme.includes("://")) {
    scheme = scheme.split("://")[0];
  }

  const reqUrl = ($request && $request.url) ? $request.url : "";
  let url;
  try {
    url = new URL(reqUrl);
  } catch {
    return $done({});
  }

  // 防止循环（可按需保留）
  if (url.searchParams.get("no_redirect") === "0") return $done({});

  const host = (url.hostname || "").toLowerCase();
  if (host !== "t.me" && host !== "telegram.me") return $done({});

  const target = buildTargetUrl(scheme, url);
  if (!target) return $done({});

  // 用于“在浏览器打开原链接”
  const browserUrl = appendNoRedirect(url.toString());

  if (openMode === "307") {
    const html = buildHtml({
      target,
      browserUrl,
      appName: String(appRaw),
      originalUrl: reqUrl,
    });
    return $done({
      response: {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
        body: html,
      },
    });
  }

  // 默认直接重定向
  return $done({
    response: {
      status: 307,
      headers: {
        Location: target,
        "Cache-Control": "no-store",
      },
      body: "",
    },
  });

  // ---------- functions ----------

  function parseArgs(input) {
    if (typeof input === "object" && input) return input;
    const obj = {};
    const s = String(input || "");
    if (!s) return obj;
    for (const seg of s.split("&")) {
      if (!seg) continue;
      const i = seg.indexOf("=");
      if (i < 0) continue;
      const k = decodeURIComponent(seg.slice(0, i));
      const v = decodeURIComponent(seg.slice(i + 1));
      obj[k] = v;
    }
    return obj;
  }

  function isDigits(str) {
    return /^[0-9]+$/.test(str || "");
  }

  function buildTargetUrl(scheme, urlObj) {
    const parts = (urlObj.pathname || "/").split("/").filter(Boolean);
    if (!parts.length) return null;

    // /s/xxx -> /xxx
    if (parts[0] === "s" && parts.length > 1) parts.shift();

    // /joinchat/xxxx
    if (parts[0] === "joinchat" && parts[1]) {
      return `${scheme}://join?invite=${encodeURIComponent(parts[1])}`;
    }

    // /+xxxx (新邀请格式)
    if (parts[0].startsWith("+") && parts[0].length > 1) {
      return `${scheme}://join?invite=${encodeURIComponent(parts[0].slice(1))}`;
    }

    // /addstickers/packname
    if (parts[0] === "addstickers" && parts[1]) {
      return `${scheme}://addstickers?set=${encodeURIComponent(parts[1])}`;
    }

    // /share/url?url=...&text=...
    if (parts[0] === "share" && parts[1] === "url") {
      const q = [];
      const u = urlObj.searchParams.get("url");
      const t = urlObj.searchParams.get("text");
      if (u) q.push(`url=${encodeURIComponent(u)}`);
      if (t) q.push(`text=${encodeURIComponent(t)}`);
      return `${scheme}://msg_url?${q.join("&")}`;
    }

    // /c/<channel>/<msgId>  私有频道消息
    if (
      parts[0] === "c" &&
      parts[1] &&
      parts[2] &&
      isDigits(parts[1]) &&
      isDigits(parts[2])
    ) {
      return `${scheme}://privatepost?channel=${parts[1]}&post=${parts[2]}`;
    }

    // 默认：用户名或机器人
    // /username 或 /username/123
    const domain = parts[0];
    const q = [`domain=${encodeURIComponent(domain)}`];

    if (parts[1] && isDigits(parts[1])) {
      q.push(`post=${parts[1]}`);
    }

    // 保留原 query 参数
    urlObj.searchParams.forEach((v, k) => {
      q.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    });

    return `${scheme}://resolve?${q.join("&")}`;
  }

  function appendNoRedirect(raw) {
    try {
      const u = new URL(raw);
      u.searchParams.set("no_redirect", "0");
      return u.toString();
    } catch {
      return raw + (raw.includes("?") ? "&" : "?") + "no_redirect=0";
    }
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildHtml({ target, browserUrl, appName, originalUrl }) {
    const t = esc(target);
    const b = esc(browserUrl);
    const a = esc(appName);
    const o = esc(originalUrl);
    const j = JSON.stringify(target);

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>TG 跳转中</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Noto Sans CJK SC",sans-serif;margin:0;background:#f7f8fa;color:#111}
    .box{max-width:720px;margin:48px auto;padding:20px}
    .card{background:#fff;border-radius:14px;padding:18px;box-shadow:0 4px 16px rgba(0,0,0,.06)}
    .btn{display:block;margin-top:12px;text-align:center;padding:12px 14px;border-radius:10px;text-decoration:none}
    .primary{background:#1677ff;color:#fff}
    .ghost{background:#f1f3f5;color:#111}
    .muted{color:#666;font-size:13px;word-break:break-all}
  </style>
</head>
<body>
  <div class="box">
    <div class="card">
      <h3 style="margin:0 0 10px;">正在唤起 ${a}</h3>
      <a class="btn primary" href="${t}">立即打开客户端</a>
      <a class="btn ghost" href="${b}">在浏览器打开原链接</a>
      <p class="muted">目标：${t}</p>
      <p class="muted">原始：${o}</p>
    </div>
  </div>
  <script>
    setTimeout(function(){ window.location.href = ${j}; }, 150);
  </script>
</body>
</html>`;
  }
})();
