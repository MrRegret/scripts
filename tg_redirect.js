/******************************
/******************************
*************************
[mitm]
hostname = t.me, telegram.me
[rewrite_local]
^https?:\/\/(t|telegram)\.me\/.* url script-response-body https://raw.githubusercontent.com/MrRegret/scripts/refs/heads/main/tg_redirect.js
*************************
*****************************************/

const app = $prefs.valueForKey("tg_redirect_app") || "Telegram"
const mode = $prefs.valueForKey("tg_redirect_mode") || "307"

const appMap = {
  "Telegram": "tg",
  "Swiftgram": "sg",
  "Nicegram": "ng",
  "iMe": "ime",
  "Turrit": "tt",
  "Lingogram": "lg"
}

const scheme = appMap[app] || "tg"

if (!$request || !$request.url) {
  $done({})
}

const url = new URL($request.url)
const host = url.hostname.toLowerCase()

if (host !== "t.me" && host !== "telegram.me") {
  $done({})
}

const pathParts = url.pathname.split("/").filter(Boolean)
if (pathParts.length === 0) {
  $done({})
}

let target = buildTarget(scheme, pathParts, url)
if (!target) {
  $done({})
}

// QX rewrite 返回
if (mode === "307") {
  $done({
    redirect: target
  })
} else {
  // 200 中间页
  const html = buildHTML(target, app)
  $done({
    body: html,
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  })
}

function buildTarget(scheme, parts, url) {
  if (parts[0] === "s" && parts[1]) parts.shift()
  if (parts[0] === "addstickers" && parts[1])
    return `${scheme}://addstickers?set=${encodeURIComponent(parts[1])}`
  if (parts[0] === "share" && parts[1] === "url") {
    const shareUrl = url.searchParams.get("url") || ""
    const text = url.searchParams.get("text") || ""
    return `${scheme}://msg_url?url=${encodeURIComponent(
      shareUrl
    )}&text=${encodeURIComponent(text)}`
  }
  if (parts[0] === "c" && parts[1] && parts[2])
    return `${scheme}://privatepost?channel=${parts[1]}&post=${parts[2]}`
  const domain = parts[0]
  if (!domain) return null
  let result = `${scheme}://resolve?domain=${encodeURIComponent(domain)}`
  if (parts[1] && /^\d+$/.test(parts[1])) result += `&post=${parts[1]}`
  return result
}

function buildHTML(target, app) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>正在打开 ${app}</title></head>
<body>
<p>正在打开 ${app}，如果未跳转请点击<a href="${target}">这里</a></p>
<script>setTimeout(()=>location.href="${target}",800)</script>
</body>
</html>`
}
