/**
 * @name TVBox自定义聚合资源
 * @id forward.vod.tvbox_custom_aggregator
 * @version 1.3.0
 * @author Developer
 * @module vod
 * @description 请在设置中填入TVBox配置链接。支持全源同步搜索。
 */

const Widget = {
    // 存储解析后的站点列表
    sites: [],

    // UI 配置项：用户必须在此处填入链接
    settings: [
        {
            key: "config_url",
            title: "TVBox配置链接",
            type: "string",
            default: "", // 初始为空
            description: "请输入有效的 TVBox JSON 配置链接（需包含 sites 数组）"
        }
    ],

    /**
     * 初始化：仅当配置链接存在时执行解析
     */
    async init() {
        const targetUrl = Widget.storage.get("config_url");
        
        // 如果用户没填链接，直接结束初始化
        if (!targetUrl || targetUrl.trim() === "") {
            console.warn("未检测到配置链接，请在插件设置中填入 URL");
            this.sites = [];
            return;
        }

        try {
            console.log("正在从自定义链接加载资源: " + targetUrl);
            const response = await fetch(targetUrl);
            const resText = await response.text();
            
            // 兼容性处理：移除 TVBox 配置文件中常见的 // 和 /* */ 注释
            const cleanJsonText = resText.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "");
            const json = JSON.parse(cleanJsonText);

            if (json && json.sites) {
                // 筛选 CMS 类型站点 (0: XML, 1: JSON)
                this.sites = json.sites.filter(s => s.type === 0 || s.type === 1);
                console.log(`成功解析到 ${this.sites.length} 个可用资源站`);
            }
        } catch (e) {
            console.error("解析配置失败，请检查链接是否有效: " + e.message);
            this.sites = [];
        }
    },

    vod: {
        /**
         * 分类列表
         */
        async categories() {
            // 每次打开分类尝试重新初始化（以防用户刚改了设置）
            if (Widget.sites.length === 0) await Widget.init();
            
            if (Widget.sites.length === 0) {
                return [{ id: "none", title: "请先在设置中配置链接" }];
            }

            return Widget.sites.map(site => ({
                id: site.key,
                title: site.name
            }));
        },

        /**
         * 获取具体站点的视频列表
         */
        async list(siteKey, page = 1) {
            if (siteKey === "none") return [];
            const site = Widget.sites.find(s => s.key === siteKey);
            if (!site) return [];

            return await Widget.methods.fetchFromCMS(site, `&pg=${page}`);
        },

        /**
         * 全源检索：同步搜索配置中的所有站点
         */
        async search(keyword, page = 1) {
            if (Widget.sites.length === 0) await Widget.init();
            if (Widget.sites.length === 0) return [];

            console.log(`全源检索中: ${keyword}`);

            // 并发请求所有站点
            const searchTasks = Widget.sites.map(async (site) => {
                try {
                    const results = await Widget.methods.fetchFromCMS(site, `&wd=${encodeURIComponent(keyword)}&pg=${page}`);
                    // 为搜索结果增加站名标识
                    return results.map(item => ({
                        ...item,
                        title: `[${site.name}] ${item.title}`
                    }));
                } catch (e) {
                    return []; 
                }
            });

            const allResults = await Promise.all(searchTasks);
            return allResults.flat(); // 合并所有站点的结果
        },

        /**
         * 详情与播放解析
         */
        async detail(combinedId) {
            const [siteKey, vodId] = combinedId.split('###');
            const site = Widget.sites.find(s => s.key === siteKey);
            if (!site) throw new Error("来源站失效");

            try {
                const connector = site.api.includes('?') ? '&' : '?';
                const resp = await fetch(`${site.api}${connector}ac=videolist&ids=${vodId}`);
                const data = await resp.json();
                const v = data.list[0];

                return {
                    title: v.vod_name,
                    desc: v.vod_content ? v.vod_content.replace(/<[^>]+>/g, '') : "暂无简介",
                    cover: v.vod_pic,
                    playlists: v.vod_play_url.split('$
```).map((line, i) => ({
                        title: v.vod_play_from.split('$
```)[i] || `线路${i+1}`,
                        episodes: line.split('#').map(ep => {
                            const parts = ep.split('
```);
                            return { 
                                title: parts[0] || "播放", 
                                url: parts[1] || parts[0] 
                            };
                        })
                    }))
                };
            } catch (e) {
                console.error("详情解析失败: " + e.message);
                return null;
            }
        }
    },

    // 内部公共方法
    methods: {
        async fetchFromCMS(site, params) {
            try {
                const connector = site.api.includes('?') ? '&' : '?';
                const url = `${site.api}${connector}ac=videolist${params}`;
                const resp = await fetch(url);
                const data = await resp.json();
                
                return (data.list || []).map(item => ({
                    id: `${site.key}###${item.vod_id}`,
                    title: item.vod_name,
                    cover: item.vod_pic,
                    subtitle: item.vod_remarks
                }));
            } catch (e) {
                return [];
            }
        }
    }
};

export default Widget;
