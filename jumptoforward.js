
const url = $request.url || ($response && $response.url);
let urlScheme = '';
let notificationTitle = 'Forward';
let notificationSubtitle = '';
let notificationBody = '点击跳转到 🎬 Forward 观看';

console.log('触发 URL:', url); // 调试日志

// TMDB 处理
if (url.includes('themoviedb.org')) {
    const movieMatch = url.match(/\/movie\/(\d+)/);
    const tvMatch = url.match(/\/tv\/(\d+)/);
    
    if (movieMatch) {
        const id = movieMatch[1];
        urlScheme = `forward://tmdb?id=${id}&type=movie`;
        notificationSubtitle = 'TMDB 电影';
    } else if (tvMatch) {
        const id = tvMatch[1];
        urlScheme = `forward://tmdb?id=${id}&type=tv`;
        notificationSubtitle = 'TMDB 剧集';
    }
}

// IMDb 处理
else if (url.includes('imdb.com')) {
    const match = url.match(/\/title\/(tt\d+)/);
    if (match) {
        const id = match[1];
        urlScheme = `forward://imdb?id=${id}`;
        notificationSubtitle = `IMDb: ${id}`;
    }
}

// 豆瓣处理（支持移动版和桌面版）
else if (url.includes('douban.com')) {
    console.log('检测到豆瓣页面'); // 调试日志
    
    // 匹配各种豆瓣 URL 格式
    // https://movie.douban.com/subject/123/
    // https://m.douban.com/movie/subject/123/
    const match = url.match(/\/subject\/(\d+)/);
    
    if (match) {
        console.log('匹配到豆瓣 ID:', match[1]); // 调试日志
        notificationSubtitle = '豆瓣影片';
        
        if ($response && $response.body) {
            const html = $response.body;
            console.log('获取到响应体，长度:', html.length); // 调试日志
            
            // 多种方式提取标题
            const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i) ||
                              html.match(/<span[^>]*property="v:itemreviewed"[^>]*>(.*?)<\/span>/i) ||
                              html.match(/<h1[^>]*>(.*?)<\/h1>/i);
            
            if (titleMatch) {
                let title = titleMatch[1]
                    .replace(/<[^>]+>/g, '')  // 移除 HTML 标签
                    .replace(/\s*\([^)]*\)/g, '')  // 移除括号内容（包括年份）
                    .replace(/\s*-\s*豆瓣.*$/, '')  // 移除 "- 豆瓣电影" 等后缀
                    .replace(/^\s+|\s+$/g, '');  // 去除首尾空格
                
                console.log('提取到标题:', title); // 调试日志
                
                if (title) {
                    urlScheme = `forward://search?q=${encodeURIComponent(title)}`;
                    notificationBody = `搜索: ${title}`;
                }
            } else {
                console.log('未能提取标题，HTML 片段:', html.substring(0, 500)); // 调试日志
            }
        } else {
            console.log('未获取到响应体'); // 调试日志
        }
    }
}

// 发送通知
if (urlScheme) {
    console.log('发送通知，URL Scheme:', urlScheme); // 调试日志
    $notification.post(
        notificationTitle,
        notificationSubtitle,
        notificationBody,
        { "openUrl": urlScheme }
    );
} else {
    console.log('未生成 URL Scheme'); // 调试日志
}

$done({});
