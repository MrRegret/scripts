
(() => {
  const args = parseArgument($argument);

  let appRaw =
    args.tme_redirect || args.app || args.client || "telegram";
  let openMode = String(args.open_mode || "307").toLowerCase();

  if (openMode === "html") openMode = "307";
  if (!["302", "307"].includes(openMode)) openMode = "307";

  // 占位符未替换时兜底，避免死循环
  if (/\{.+\}/.test(String(appRaw))) appRaw = "telegram";

  const appMap = {
    telegram: "tg",
    swiftgram: "sg",
    turrit: "tt",
    ime: "ime",
    nicegram: "nicegram",
    lingogram: "lg",
    tg: "tg",
    sg: "sg",
    tt: "tt",
    ng: "nicegram",
    lg: "lg",
  };

  let scheme = appMap[String(appRaw).toLowerCase()] || String(appRaw).trim();
  if (!scheme) return $done({});
  if (scheme.includes("://")) scheme = scheme.split("://")[0];
  if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme)) scheme = "tg";

  const reqUrl = ($request && $request.url) ? $request.url : "";
  let url;
  try {
    url = new URL(reqUrl);
  } catch {
    return $done({});
  }

  // 防止中转页“浏览器打开原链接”再次进入重写
  if (url.searchParams.get("no_redirect") === "1") return $done({});

  const host = (url.hostname || "").toLowerCase();
  if (host !== "t.me" && host !== "telegram.me") return $done({});

  const target = buildTargetUrl(scheme, url);
  if (!target) return $done({});

  if (openMode === "307") {
    const browserUrl = appendNoRedirect(url.toString());
    return $done({
      response: {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
        body: buildHtml(target, browserUrl, appRaw, reqUrl),
      },
    });
  }

  return $done({
    response: {
      status: 302,
      headers: {
        Location: target,
        "Cache-Control": "no-store",
      },
      body: "",
    },
  });

  function parseArgument(input) {
    const obj = {};
    const s = String(input || "").trim();
    if (!s) return obj;
    if (typeof input === "object" && input) return input;

    // 1) key=value&key2=value2
    if (s.includes("=")) {
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

    // 2) [x,y] 或 x,y
    const raw = s.replace(/^\[|\]$/g, "");
    const arr = raw.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    if (arr[0]) obj.tme_redirect = arr[0];
    if (arr[1]) obj.open_mode = arr[1];
    return obj;
  }

  function isDigits(v) {
    return /^[0-9]+$/.test(String(v || ""));
  }

  function buildTargetUrl(scheme, urlObj) {
    const parts = String(urlObj.pathname || "/").split("/").filter(Boolean);
    if (!parts.length) return null;

    if (parts[0] === "s" && parts.length > 1) parts.shift();

    if (parts[0] === "joinchat" && parts[1]) {
      return `${scheme}://join?invite=${encodeURIComponent(parts[1])}`;
    }

    if (parts[0].startsWith("+") && parts[0].length > 1) {
      return `${scheme}://join?invite=${encodeURIComponent(parts[0].slice(1))}`;
    }

    if (parts[0] === "addstickers" && parts[1]) {
      return `${scheme}://addstickers?set=${encodeURIComponent(parts[1])}`;
    }

    if (parts[0] === "share" && parts[1] === "url") {
      const q = [];
      const u = urlObj.searchParams.get("url");
      const t = urlObj.searchParams.get("text");
      if (u) q.push(`url=${encodeURIComponent(u)}`);
      if (t) q.push(`text=${encodeURIComponent(t)}`);
      return `${scheme}://msg_url?${q.join("&")}`;
    }

    if (
      parts[0] === "c" &&
      parts[1] &&
      parts[2] &&
      isDigits(parts[1]) &&
      isDigits(parts[2])
    ) {
      return `${scheme}://privatepost?channel=${parts[1]}&post=${parts[2]}`;
    }

    const domain = parts[0];
    if (!domain) return null;

    const q = [`domain=${encodeURIComponent(domain)}`];
    if (parts[1] && isDigits(parts[1])) q.push(`post=${encodeURIComponent(parts[1])}`);

    urlObj.searchParams.forEach((v, k) => {
      if (k === "no_redirect") return;
      q.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    });

    return `${scheme}://resolve?${q.join("&")}`;
  }

  function appendNoRedirect(raw) {
    try {
      const u = new URL(raw);
      u.searchParams.set("no_redirect", "1");
      return u.toString();
    } catch {
      return raw + (raw.includes("?") ? "&" : "?") + "no_redirect=1";
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

  function buildHtml(target, browserUrl, appName, originalUrl) {
    const t = esc(target);
    const b = esc(browserUrl);
    const a = esc(appName);
    const o = esc(originalUrl);
    const j = JSON.stringify(target);

    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TG跳转</title></head>
<body style="font-family:-apple-system;padding:24px">
<h3>正在唤起 ${a}</h3>
<p><a href="${t}">立即打开客户端</a></p>
<p><a href="${b}">在浏览器打开原链接（不重定向）</a></p>
<p style="word-break:break-all;color:#666">目标：${t}</p>
<p style="word-break:break-all;color:#666">原始：${o}</p>
<script>setTimeout(function(){location.href=${j};},120);</script>
</body></html>`;
  }
})();
