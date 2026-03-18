

(function() {
    'use strict';

    // 配置
    const CONFIG = {
        buttonText: '📱 Forward',
        buttonStyle: {
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '25px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: '9999',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
            transition: 'all 0.3s ease',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }
    };

    let currentButton = null;

    // 创建跳转按钮
    function createButton(urlScheme) {
        // 移除旧按钮
        if (currentButton) {
            currentButton.remove();
        }

        const button = document.createElement('button');
        button.textContent = CONFIG.buttonText;
        
        // 应用样式
        Object.assign(button.style, CONFIG.buttonStyle);

        // 悬停效果
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-3px)';
            button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
        });

        // 点击跳转
        button.addEventListener('click', () => {
            window.location.href = urlScheme;
        });

        document.body.appendChild(button);
        currentButton = button;
        
        console.log('Forward 按钮已创建，URL Scheme:', urlScheme);
    }

    // TMDB 处理
    function handleTMDB() {
        const url = window.location.pathname;
        const movieMatch = url.match(/\/movie\/(\d+)/);
        const tvMatch = url.match(/\/tv\/(\d+)/);

        if (movieMatch) {
            const id = movieMatch[1];
            const urlScheme = `forward://tmdb?id=${id}&type=movie`;
            createButton(urlScheme);
        } else if (tvMatch) {
            const id = tvMatch[1];
            const urlScheme = `forward://tmdb?id=${id}&type=tv`;
            createButton(urlScheme);
        }
    }

    // IMDb 处理
    function handleIMDb() {
        const url = window.location.pathname;
        const match = url.match(/\/title\/(tt\d+)/);

        if (match) {
            const id = match[1];
            const urlScheme = `forward://imdb?id=${id}`;
            createButton(urlScheme);
        }
    }

    // 豆瓣处理
    function handleDouban() {
        const url = window.location.pathname;
        
        // 匹配电影或剧集详情页
        if (url.match(/\/subject\/\d+/)) {
            // 尝试获取标题
            let title = '';
            
            // 电影页面标题
            const titleElement = document.querySelector('h1 span[property="v:itemreviewed"]') || 
                                document.querySelector('h1 span') ||
                                document.querySelector('#content h1');
            
            if (titleElement) {
                title = titleElement.textContent.trim();
                // 移除年份等额外信息
                title = title.replace(/\s*\(\d{4}\).*$/, '');
                
                const urlScheme = `forward://search?q=${encodeURIComponent(title)}`;
                createButton(urlScheme);
            }
        }
    }

    // 检测当前网站
    function detectAndHandle() {
        const hostname = window.location.hostname;

        if (hostname.includes('themoviedb.org')) {
            handleTMDB();
        } else if (hostname.includes('imdb.com')) {
            handleIMDb();
        } else if (hostname.includes('douban.com')) {
            handleDouban();
        }
    }

    // 初始化
    function init() {
        // 首次检测
        detectAndHandle();

        // 监听 URL 变化（适用于单页应用）
        let lastUrl = location.href;
        new MutationObserver(() => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                setTimeout(detectAndHandle, 500); // 延迟检测，等待页面更新
            }
        }).observe(document.body, { 
            subtree: true, 
            childList: true 
        });
    }

    // 等待页面加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 对于豆瓣等动态加载内容的网站，延迟初始化
    setTimeout(detectAndHandle, 1000);
})();
