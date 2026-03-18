// Forward 播放器跳转（通知推送版）
// 访问详情页时自动推送通知，点击通知即可跳转

const url = $request.url;
let urlScheme = '';
let notificationTitle = '🎬 Forward';
let notificationSubtitle = '';
let notificationBody = '点击跳转到播放器';

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

// 豆瓣处理（需要获取页面内容）
else if (url.includes('douban.com')) {
    const match = url.match(/\/subject\/(\d+)/);
    if (match) {
        notificationSubtitle = '豆瓣影片';
        // 豆瓣需要从响应中获取标题
        if ($response && $response.body) {
            const html = $response.body;
            const titleMatch = html.match(/<span property="v:itemreviewed">(.*?)<\/span>/) || 
                              html.match(/<title>(.*?)<\/title>/);
            
            if (titleMatch) {
                let title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
                title = title.replace(/\s*\(\d{4}\).*$/, '').replace(/\s*-\s*豆瓣.*$/, '');
                urlScheme = `forward://search?q=${encodeURIComponent(title)}`;
                notificationBody = `搜索: ${title}`;
            }
        }
    }
}

// 发送通知
if (urlScheme) {
    $notification.post(
        notificationTitle,
        notificationSubtitle,
        notificationBody,
        { url: urlScheme }
    );
}

$done({});
