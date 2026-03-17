// 需要过滤的播放源名称
const FILTERED_SOURCES = new Set(['qq', 'youku', 'mgtv', 'bilibili', 'qiyi', 'jsyun', 'dytt']);
WidgetMetadata = {
  id: "tvbox_aggregator",
  title: "TVBox资源聚合器",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  description: "从TVBox配置链接解析资源站点并聚合视频资源",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
  modules: [
    {
      id: "loadResource",
      title: "加载资源",
      description: "从TVBox配置的站点加载视频资源",
      functionName: "loadResource",
      type: "stream",
      params: [
        {
          id: "configUrl",
          title: "配置链接",
          type: "input",
          placeholder: "请输入TVBox配置链接",
          required: true
        }
      ]
    }
  ],
  search: {
    title: "搜索资源",
    functionName: "searchResources",
    params: [
      {
        id: "configUrl",
        title: "配置链接",
        type: "input",
        placeholder: "请输入TVBox配置链接",
        required: true
      },
      {
        id: "keyword",
        title: "搜索关键词",
        type: "input",
        placeholder: "请输入影片名称",
        required: true
      }
    ]
  }
};

/**
 * 加载并解析TVBox配置
 */
async function loadConfig(configUrl) {
  try {
    const response = await Widget.http.get(configUrl);
    if (!response.data || !response.data.sites) {
      throw new Error("配置格式错误");
    }
    
    // 过滤出支持搜索的站点
    const sites = response.data.sites.filter(site => site.searchable === 1);
    console.log(`成功加载配置，找到 ${sites.length} 个可搜索站点`);
    return sites;
  } catch (error) {
    console.error("加载配置失败:", error);
    throw error;
  }
}

/**
 * 解析播放源名称
 */
function parseSourceNames(playFrom) {
  if (!playFrom) return ['默认源'];
  return playFrom.includes('$$$') ? playFrom.split('$$$') : [playFrom];
}

/**
 * 处理电影资源
 */
function processMovieResource(item, siteName, cleanedVodName, resources, filteredSources) {
  const playUrl = item.vod_play_url;
  const playFrom = item.vod_play_from || '';
  const sourceNames = parseSourceNames(playFrom);
  
  if (playUrl.includes('$$$')) {
    const playSources = playUrl.split('$$$');
    playSources.forEach((source, sourceIndex) => {
      const sourceName = sourceNames[sourceIndex] || `版本${sourceIndex + 1}`;
      if (filteredSources.has(sourceName)) return;
      
      if (source && source.includes('$')) {
        const parts = source.split('$');
        if (parts.length >= 2) {
          const qualityLabel = parts[0] || '';
          const url = parts[1].trim();
          if (url) {
            resources.push({
              name: siteName,
              description: `${cleanedVodName}${qualityLabel ? ` (${qualityLabel})` : ''} [${sourceName}]`,
              url: url
            });
          }
        }
      } else if (source && source.trim()) {
        resources.push({
          name: siteName,
          description: `${cleanedVodName} [${sourceName}]`,
          url: source.trim()
        });
      }
    });
  } else {
    const sourceName = sourceNames[0] || '默认版本';
    if (filteredSources.has(sourceName)) return;
    
    if (playUrl.includes('$')) {
      const parts = playUrl.split('$');
      if (parts.length >= 2) {
        const qualityLabel = parts[0] || '';
        const url = parts[1].trim();
        if (url) {
          resources.push({
            name: siteName,
            description: `${cleanedVodName}${qualityLabel ? ` (${qualityLabel})` : ''} [${sourceName}]`,
            url: url
          });
        }
      }
    } else if (playUrl.trim()) {
      resources.push({
        name: siteName,
        description: `${cleanedVodName} [${sourceName}]`,
        url: playUrl.trim()
      });
    }
  }
}

/**
 * 处理电视剧资源
 */
function processTVResource(item, siteName, cleanedVodName, targetEpisode, resources, filteredSources) {
  const playUrl = item.vod_play_url;
  const playFrom = item.vod_play_from || '';
  const sourceNames = parseSourceNames(playFrom);
  
  const playSources = playUrl.split('$$$');
  let playSourceIndex = playSources.length >= 2 ? 1 : 0;
  const playSource = playSources[playSourceIndex];
  const sourceName = sourceNames[playSourceIndex] || `版本${playSourceIndex + 1}`;
  
  if (filteredSources.has(sourceName)) return;
  
  const episodes = playSource.split('#');
  
  if (!targetEpisode) {
    episodes.forEach((ep) => {
      if (!ep || !ep.includes('$')) return;
      const [episodeTitle, episodeUrl] = ep.split('$');
      const url = episodeUrl?.trim();
      if (url) {
        resources.push({
          name: siteName,
          description: `${cleanedVodName} ${episodeTitle || ''} [${sourceName}]`,
          url: url
        });
      }
    });
  } else {
    const episodeStr = targetEpisode.toString().padStart(2, '0');
    const episodePattern = `第${episodeStr}集`;
    episodes.forEach((ep) => {
      if (!ep || !ep.includes('$')) return;
      const [episodeTitle, episodeUrl] = ep.split('$');
      const url = episodeUrl?.trim();
      if (url && episodeTitle && episodeTitle.includes(episodePattern)) {
        resources.push({
          name: siteName,
          description: `${cleanedVodName} ${episodeTitle} [${sourceName}]`,
          url: url
        });
      }
    });
  }
}

/**
 * 从配置的站点搜索资源（用于搜索功能）
 */
async function searchResources(params) {
  const { configUrl, keyword } = params;
  
  if (!configUrl) {
    console.error("配置链接不能为空");
    return [];
  }
  
  if (!keyword) {
    console.error("搜索关键词不能为空");
    return [];
  }
  
  try {
    // 加载配置
    const sites = await loadConfig(configUrl);
    
    console.log(`开始搜索: "${keyword}"`);
    
    const queryParams = { ac: "detail", wd: keyword.trim() };
    
    // 并行请求所有站点
    const sitePromises = sites.map(async (site) => {
      try {
        const response = await Widget.http.get(site.api, { params: queryParams });
        if (response.data?.code === 1 && response.data.list?.length > 0) {
          return {
            siteName: site.name,
            data: response.data.list
          };
        }
      } catch (error) {
        // 静默处理错误
      }
      return null;
    });
    
    const responses = await Promise.all(sitePromises);
    
    // 用于去重的Map
    const uniqueResults = new Map();
    
    responses.forEach((result) => {
      if (!result || !result.data) return;
      
      result.data.forEach((item) => {
        if (!item.vod_name) return;
        
        const title = item.vod_name.trim();
        
        // 去重：如果已存在相同标题，跳过
        if (uniqueResults.has(title)) return;
        
        uniqueResults.set(title, {
          id: item.vod_id || title,
          type: "url",
          title: title,
          posterPath: item.vod_pic || "",
          releaseDate: item.vod_year || "",
          mediaType: item.type_id_1 == 1 ? "movie" : "tv",
          rating: item.vod_score || "",
          description: item.vod_blurb || item.vod_content || "",
          link: item.vod_play_url || ""
        });
      });
    });
    
    const results = Array.from(uniqueResults.values());
    console.log(`搜索完成，找到 ${results.length} 个结果`);
    return results;
    
  } catch (error) {
    console.error("搜索资源时发生错误:", error);
    return [];
  }
}

/**
 * 加载资源（用于Stream加载）
 */
async function loadResource(params) {
  const { configUrl, seriesName, episode, type } = params;
  
  if (!configUrl) {
    console.error("配置链接不能为空");
    return [];
  }
  
  if (!seriesName) {
    console.error("搜索词不能为空");
    return [];
  }
  
  try {
    // 加载配置
    const sites = await loadConfig(configUrl);
    
    const cleanedSeriesName = seriesName.trim();
    console.log(`开始搜索: "${cleanedSeriesName}", 类型: ${type}, 集数: ${episode}`);
    
    let targetEpisode = null;
    if (episode) {
      targetEpisode = typeof episode === 'string' && !isNaN(parseInt(episode))
        ? parseInt(episode)
        : episode;
    }
    
    const queryParams = { ac: "detail", wd: cleanedSeriesName };
    
    // 并行请求所有站点
    const sitePromises = sites.map(async (site) => {
      try {
        const response = await Widget.http.get(site.api, { params: queryParams });
        if (response.data?.code === 1 && response.data.list?.length > 0) {
          return {
            siteName: site.name,
            data: response.data.list
          };
        }
      } catch (error) {
        // 静默处理错误
      }
      return null;
    });
    
    const responses = await Promise.all(sitePromises);
    const resources = [];
    
    // 处理每个站点的响应
    responses.forEach((result) => {
      if (!result || !result.data) return;
      
      result.data.forEach((item) => {
        if (!item.vod_name || !item.vod_play_url) return;
        
        const cleanedVodName = item.vod_name.trim();
        if (cleanedVodName !== cleanedSeriesName) return;
        
        const resourceType = item.type_id_1;
        if ((type === 'movie' && resourceType != 1) ||
            (type === 'tv' && resourceType != 2)) {
          return;
        }
        
        if (type === 'movie') {
          processMovieResource(item, result.siteName, cleanedVodName, resources, FILTERED_SOURCES);
        } else if (type === 'tv') {
          processTVResource(item, result.siteName, cleanedVodName, targetEpisode, resources, FILTERED_SOURCES);
        }
      });
    });
    
    console.log(`搜索完成，找到 ${resources.length} 个资源`);
    return resources;
    
  } catch (error) {
    console.error("加载资源时发生错误:", error);
    return [];
  }
}
