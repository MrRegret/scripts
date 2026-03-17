/**
 * WidgetMetadata 定义
 * 类型为 stream，用于在播放详情页点击“加载资源”时触发
 */
const WidgetMetadata = {
  id: "vod_stream_custom_dynamic",
  title: "自定义全源资源加载器",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.0.4",
  requiredVersion: "0.0.1",
  description: "完全基于自定义配置链接解析资源，支持电影及电视剧剧集提取",
  author: "AI",
  site: "https://github.com/InchStudio/ForwardWidgets",
  modules: [
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      params: [],
    }
  ],
};

// 需要排除的播放源标签
const FILTERED_SOURCES = new Set(['qq', 'youku', 'mgtv', 'bilibili', 'qiyi', 'jsyun', 'dytt', 'tencent', 'iqiyi', 'letv', 'sohu']);

const Widget = {
  /**
   * UI 配置项
   */
  settings: [
    {
      key: "config_url",
      title: "资源配置链接 (TVBox格式)",
      type: "string",
      default: "",
      description: "请填入包含 sites 列表的 JSON 链接"
    }
  ],

  /**
   * 核心函数：由 Forward 客户端调用
   */
  async loadResource(params) {
    const { seriesName, episode, type } = params;
    if (!seriesName) return [];

    // 1. 获取用户填写的配置链接
    const configUrl = Widget.storage.get("config_url");
    if (!configUrl) {
      console.error("未配置资源链接，请在插件设置中填写");
      return [];
    }

    const cleanedSeriesName = seriesName.trim();
    console.log(`[搜索开始] 关键词: ${cleanedSeriesName}, 类型: ${type}, 目标集数: ${episode || '全集'}`);

    // 2. 动态解析配置链接获取站点列表
    let targetSites = [];
    try {
      const resp = await fetch(configUrl);
      const text = await resp.text();
      // 清理 JSON 注释
      const cleanJson = JSON.parse(text.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, ""));
      if (cleanJson && cleanJson.sites) {
        // 只筛选 CMS 类型的站点 (type 0 或 1)
        targetSites = cleanJson.sites.filter(s => s.type === 0 || s.type === 1);
      }
    } catch (e) {
      console.error("解析配置链接失败: " + e.message);
      return [];
    }

    if (targetSites.length === 0) return [];

    const resources = [];
    
    // 3. 并发请求所有解析出来的站点
    const searchTasks = targetSites.map(async (site) => {
      try {
        const connector = site.api.includes('?') ? '&' : '?';
        const url = `${site.api}${connector}ac=detail&wd=${encodeURIComponent(cleanedSeriesName)}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data && data.list) {
          data.list.forEach(item => {
            // 严格匹配名称，防止搜到关联词
            if (item.vod_name.trim() !== cleanedSeriesName) return;

            // 根据类型分流处理
            if (type === 'movie' || item.type_id_1 == 1) {
              this.methods.processMovie(item, site.name, resources);
            } else {
              this.methods.processTV(item, site.name, episode, resources);
            }
          });
        }
      } catch (e) {
        // 忽略单站错误
      }
    });

    await Promise.all(searchTasks);
    console.log(`[搜索完成] 共从 ${targetSites.length} 个源中找到 ${resources.length} 条有效线路`);
    return resources;
  },

  methods: {
    /**
     * 处理电影（提取所有非过滤源的直链）
     */
    processMovie(item, siteTitle, resources) {
      const playSources = (item.vod_play_from || "").split('$$$');
      const playUrls = (item.vod_play_url || "").split('$$$');

      playSources.forEach((sourceName, idx) => {
        // 过滤掉不需要的源
        if (FILTERED_SOURCES.has(sourceName.toLowerCase())) return;

        const episodes = (playUrls[idx] || "").split('#');
        episodes.forEach(ep => {
          if (!ep.includes('$')) return;
          const [name, url] = ep.split('$');
          if (url && url.startsWith('http')) {
            resources.push({
              name: `[${siteTitle}]`,
              description: `${item.vod_name} - ${name} (${sourceName})`,
              url: url.trim()
            });
          }
        });
      });
    },

    /**
     * 处理电视剧（根据 episode 匹配集数）
     */
    processTV(item, siteTitle, targetEpisode, resources) {
      const playSources = (item.vod_play_from || "").split('$$$');
      const playUrls = (item.vod_play_url || "").split('$$$');

      playSources.forEach((sourceName, idx) => {
        if (FILTERED_SOURCES.has(sourceName.toLowerCase())) return;

        const episodes = (playUrls[idx] || "").split('#');
        // 格式化目标集数，例如 1 -> 第01集
        const episodePattern = targetEpisode ? `第${targetEpisode.toString().padStart(2, '0')}集` : null;

        episodes.forEach(ep => {
          const [name, url] = ep.split('$');
          if (!url) return;

          // 如果指定了集数，则检查标题是否包含
          if (episodePattern && !name.includes(episodePattern)) return;

          resources.push({
            name: `[${siteTitle}]`,
            description: `${item.vod_name} ${name} (${sourceName})`,
            url: url.trim()
          });
        });
      });
    }
  }
};

export default Widget;
