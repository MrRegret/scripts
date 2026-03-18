
const url = $request.url || ($response && $response.url);
let urlScheme = '';
let notificationTitle = 'Forward';
let notificationSubtitle = '';
let notificationBody = '点击跳转到 🎬 Forward 观看';

// TMDB 处理
if (url.includes('themoviedb.org')) {
    const movieMatch = url.match(/\/movie\/(\d+)/);
    const tvMatch = url.match(/\/tv\/(\d+)/);
    
    if (movieMatch) {
        urlScheme = `forward://tmdb?id=${movieMatch[1]}&type=movie`;
        subtitle = 'TMDB 电影';
    } else if (tvMatch) {
        urlScheme = `forward://tmdb?id=${tvMatch[1]}&type=tv`;
        subtitle = 'TMDB 剧集';
    }
}

// IMDb 处理
else if (url.includes('imdb.com')) {
    const match = url.match(/\/title\/(tt\d+)/);
    if (match) {
        urlScheme = `forward://imdb?id=${match[1]}`;
        subtitle = `IMDb: ${match[1]}`;
    }
}

// 豆瓣处理
else if (url.includes('douban.com')) {
    const match = url.match(/subject\/(\d+)/);
    if (match) {
        subtitle = '豆瓣影片';
        
        if ($response && $response.body) {
            const html = $response.body;
            
            // 修改：使用 [\s\S] 匹配包括换行在内的所有字符
            const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            
            if (titleMatch) {
                let movieTitle = titleMatch[1]
                    .replace(/\s*-\s*电影\s*-\s*豆瓣\s*/g, '')  // 移除 "- 电影 - 豆瓣"
                    .replace(/\s*-\s*豆瓣.*$/g, '')  // 移除其他豆瓣后缀
                    .replace(/\(\d{4}\)/g, '')  // 移除年份
                    .replace(/\s+/g, ' ')  // 将多个空白字符替换为单个空格
                    .trim();  // 去除首尾空格
                
                if (movieTitle) {
                    urlScheme = `forward://search?q=${encodeURIComponent(movieTitle)}`;
                    body = `搜索: ${movieTitle}`;
                }
            }
        }
    }
}

// 发送通知
if (urlScheme) {
    $notification.post(title, subtitle, body, { "openUrl": urlScheme });
}

$done({});
