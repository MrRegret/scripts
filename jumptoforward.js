const url = $request.url || ($response && $response.url);
let urlScheme = '';
let notificationTitle = 'Forward';
let notificationSubtitle = '';
let notificationBody = '点击跳转到 🎬 Forward 观看';

// 辅助函数：解码 HTML 实体
function decodeHtmlEntities(str) {
    return str.replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
}

// ---------- TMDB ----------
if (url.includes('themoviedb.org')) {
    const match = url.match(/\/(movie|tv)\/(\d+)/);
    if (match) {
        const mediaType = match[1]; // 'movie' 或 'tv'
        const id = match[2];
        urlScheme = `forward://tmdb?id=${id}&type=${mediaType}`;
        notificationSubtitle = `TMDB ${mediaType === 'movie' ? '电影' : '剧集'}`;
    }
}

// ---------- IMDb ----------
else if (url.includes('imdb.com')) {
    const match = url.match(/\/title\/(tt\d+)/);
    if (match) {
        urlScheme = `forward://imdb?id=${match[1]}`;
        notificationSubtitle = `IMDb: ${match[1]}`;
    }
}

// ---------- 豆瓣 ----------
else if (url.includes('douban.com')) {
    const match = url.match(/subject\/(\d+)/);
    if (match) {
        notificationSubtitle = '豆瓣影片';
        const doubanId = match[1];

        // 只有响应阶段才能拿到 body
        if ($response && $response.body) {
            const html = $response.body;
            const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

            if (titleMatch) {
                // 原始标题并解码
                let rawTitle = decodeHtmlEntities(titleMatch[1]);

                // 清理豆瓣后缀，保留年份部分
                // 常见格式: "电影名称 (年份) - 电影 - 豆瓣"
                let cleanTitle = rawTitle
                    .replace(/\s*[-\u2014]\s*[^-\u2014]+?\s*[-\u2014]\s*豆瓣\s*$/i, '') // 移除 " - 电影 - 豆瓣"
                    .replace(/\s+/g, ' ')                                            // 合并空格
                    .trim();

                if (cleanTitle) {
                    urlScheme = `forward://search?q=${encodeURIComponent(cleanTitle)}`;
                    notificationBody = `搜索: ${cleanTitle}`;
                } else {
                    // 标题清理后为空，回退使用豆瓣 ID（至少能跳转）
                    urlScheme = `forward://search?q=${doubanId}`;
                    notificationBody = `豆瓣 ID: ${doubanId}`;
                }
            } else {
                // 未找到 title 标签（极少数情况），使用豆瓣 ID
                urlScheme = `forward://search?q=${doubanId}`;
                notificationBody = `豆瓣 ID: ${doubanId}`;
            }
        } else {
            // 没有响应体，说明配置错误（豆瓣必须用 http-response）
            notificationSubtitle = '配置错误';
            notificationBody = '豆瓣需使用 http-response 并开启 requires-body';
        }
    }
}

// 发送通知
if (urlScheme) {
    $notification.post(notificationTitle, notificationSubtitle, notificationBody, { "openUrl": urlScheme });
}

$done({});
