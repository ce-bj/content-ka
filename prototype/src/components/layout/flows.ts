// 主流程定义（静态配置）：页面在流程中的位置，用于顶部流程条
export interface FlowStep {
  key: string;
  label: string;
  to: string;
  owner: '自建' | '对接';
  match: string[]; // 命中这些路由前缀即视为当前步骤
}
export interface Flow {
  flowId: string;
  title: string;
  steps: FlowStep[];
}

export const FLOWS: Flow[] = [
  {
    flowId: 'content',
    title: '内容主流程',
    steps: [
      { key: 'topic', label: '选题', to: '/production/topics', owner: '自建', match: ['/production/topics'] },
      { key: 'produce', label: '生产', to: '/production/generate', owner: '自建', match: ['/production/generate', '/production/repurpose', '/production/translations'] },
      { key: 'edit', label: '内容管理', to: '/content', owner: '自建', match: ['/content/edit', '/content'] },
      { key: 'review', label: '审批', to: '/review', owner: '自建', match: ['/review'] },
      { key: 'release', label: '发布', to: '/content/releases', owner: '自建', match: ['/content/releases'] },
      { key: 'market', label: '内容市场', to: '/market', owner: '自建', match: ['/market'] },
      { key: 'deliver', label: '各方取用', to: '/market', owner: '对接', match: [] },
      { key: 'feedback', label: '效果回流', to: '/insights/usage', owner: '对接', match: ['/insights/usage'] },
    ],
  },
  {
    flowId: 'fact',
    title: '事实流程',
    steps: [
      { key: 'kdh', label: 'KDH 接入 / 引用时比对', to: '/integrations', owner: '对接', match: ['/integrations'] },
      { key: 'conflict', label: '冲突处理', to: '/facts/conflicts', owner: '自建', match: ['/facts/conflicts'] },
      { key: 'facts', label: '入事实库，后续引用', to: '/facts', owner: '自建', match: ['/facts'] },
      { key: 'approve', label: '事实发布审批', to: '/review', owner: '自建', match: [] },
      { key: 'writeback', label: '回写 KDH', to: '/integrations', owner: '对接', match: [] },
    ],
  },
];

// 不在主流程里的页面（数据表、资产、规范、设置等）只显示面包屑
const EXCLUDE = ['/content/tables', '/external'];

export function flowOfPath(pathname: string): { flow: Flow; currentKey: string } | null {
  if (EXCLUDE.some((p) => pathname.startsWith(p))) return null;
  for (const flow of FLOWS) {
    // 取最长匹配，避免 /facts 抢走 /facts/conflicts
    let best: { key: string; len: number } | null = null;
    for (const st of flow.steps) {
      for (const m of st.match) {
        if (pathname.startsWith(m) && (!best || m.length > best.len)) best = { key: st.key, len: m.length };
      }
    }
    if (best) return { flow, currentKey: best.key };
  }
  return null;
}
