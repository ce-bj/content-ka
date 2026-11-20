// 发布设置（静态配置）：送审时一并确定「上架到哪些渠道、放进哪些内容集合」，审批通过后自动执行。
// 渠道标签的颜色、分组等完整配置在内容市场页；这里只放跨页面共用的名称和默认值。

export const CHANNEL_LABEL: Record<string, string> = {
  kdh: 'KDH 知识库',
  website: '官网',
  product_platform: '产品发布平台',
  ai_service: 'AI 客服 / GEO',
  sales: '销售助手',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  wechat: '微信公众号',
};

// 新内容按类型给出默认渠道；送审时可以改
export const DEFAULT_CHANNELS_BY_TYPE: Record<string, string[]> = {
  产品说明: ['website', 'product_platform', 'kdh'],
  '技术 FAQ': ['website', 'ai_service', 'kdh'],
  客户案例: ['website', 'linkedin', 'kdh'],
  社媒短帖: ['instagram', 'facebook', 'linkedin'],
  销售话术卡: ['sales'],
};
export const defaultChannelsOf = (contentTypeName: string): string[] => DEFAULT_CHANNELS_BY_TYPE[contentTypeName] ?? ['website'];
