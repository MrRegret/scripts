WidgetMetadata = {
  id: "tvbox_resource",
  title: "TVBox资源站解析",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.0.1",
  requiredVersion: "0.0.1",
  description: "解析TVBox配置并聚合资源站资源",
  author: "--",
  site: "https://github.com/2kuai/ForwardWidgets",
  modules: [
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      params: [
        { name: "configUrl", type: "string", required: true }
      ],
    }
  ],
};

// 需要过滤的播放源名称
const FILTERED_SOURCES = new Set(['qq', 'youku', 'mgtv', 'bilibili', 'qiyi', 'jsyun', 'dytt']);

function parseSourceNames(playFrom) {
  if (!playFrom) return ['默认源'];
  return playFrom.includes('$$$') ? playFrom.split('$$$') : [playFrom];
}

// 处理电影资源
function processMovieResource(item, siteTitle, cleanedVodName, resources) {
  const playUrl = item.vod_play_url;
  const playFrom = item.vod_play_from || '';
  const sourceNames = parseSourceNames(playFrom);

  const playSources = playUrl.includes('$$$') ? playUrl.split('$$$') : [playUrl];
  playSources.forEach((source, idx) => {
    const sourceName = sourceNames[idx] || `版本${idx + 1}`;
    if (FILTERED_SOURCES.has(sourceName.toLowerCase())) return;

    // 有些源会多集，用#分割
    const parts = source.split('#');
    parts.forEach(p => {
      if (!p) return;
      const seg = p.split('$');
      const url = seg[1]?.trim();
      const label = seg[0]?.trim();
      if (url) {
        resources.push({
          name: siteTitle,
          description: `${cleanedVodName}${label ? ` (${label})` : ''} [${sourceName}]`,
          url
        });
      }
    });
  });
}

// 处理电视剧资源
function processTVResource(item, siteTitle, cleanedVodName, targetEpisode, resources) {
  const playUrl = item.vod_play_url;
  const playFrom = item.vod_play_from || '';
  const sourceNames = parseSourceNames(playFrom);

  const playSources = playUrl.split('$$$');
  // 默认使用第2个（常见m3u8），否则第1个
  const idx = playSources.length > 1 ? 1 : 0;
  const sourceName = sourceNames[idx] || `版本${idx + 1}`;
  if (FILTERED_SOURCES.has(sourceName.toLowerCase())) return;

  const episodes = playSources[idx].split('#');

  if (!targetEpisode) {
    episodes.forEach(ep => {
      if (!ep || !ep.includes('$')) return;
      const [title, url] = ep.split('$');
      if (url?.trim()) {
        resources.push({
          name: siteTitle,
          description: `${cleanedVodName} ${title || ''} [${sourceName}]`,
          url: url.trim()
        });
      }
    });
  } else {
    const episodeStr = targetEpisode.toString().padStart(2, '0');
    const pattern = `第${episodeStr}集`;
    episodes.forEach(ep => {
      if (!ep || !ep.includes('$')) return;
      const [title, url] = ep.split('$');
      if (url?.trim() && title?.includes(pattern)) {
        resources.push({
          name: siteTitle,
          description: `${cleanedVodName} ${title} [${sourceName}]`,
          url: url.trim()
        });
      }
    });
  }
}

async function getTvboxSites(configUrl) {
  const res = await Widget.http.get(configUrl);
  if (!res.data) return [];

  let config = res.data;
  if (typeof config === "string") {
    try { config = JSON.parse(config); } catch { return []; }
  }

  // 只取可搜索的资源站
  return (config.sites || []).filter(s => s.api && s.searchable != 0);
}

async function loadResource(params) {
  const { seriesName, episode, type, configUrl } = params;
  if (!seriesName || !configUrl) return [];

  const cleanedSeriesName = seriesName.trim();
  let targetEpisode = episode ? parseInt(episode) : null;

  const sites = await getTvboxSites(configUrl);
  const resources = [];
  const queryParams = { ac: "detail", wd: cleanedSeriesName };

  await Promise.all(sites.map(async (site) => {
    try {
      const res = await Widget.http.get(site.api, { params: queryParams });
      const list = res.data?.list || [];
      list.forEach(item => {
        if (!item.vod_name || !item.vod_play_url) return;
        const cleanedVodName = item.vod_name.trim();

        // 简单匹配（可改为模糊/包含）
        if (cleanedVodName !== cleanedSeriesName) return;

        const resourceType = item.type_id_1;
        if (type === 'movie' && resourceType != 1) return;
        if (type === 'tv' && resourceType != 2) return;

        if (type === 'movie') processMovieResource(item, site.name, cleanedVodName, resources);
        if (type === 'tv') processTVResource(item, site.name, cleanedVodName, targetEpisode, resources);
      });
    } catch (e) {}
  }));

  return resources;
}
