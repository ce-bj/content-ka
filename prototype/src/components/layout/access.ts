// 角色 × 菜单可见性（静态配置，见 docs/02-产品PRD.md 第 6.7 节）
// 平台管理员可以看到并操作全部模块（便于演示）；其他角色按矩阵限制
// full ● 完整操作　scoped ◐ 本范围内操作　read ○ 只读　none — 不可见

export type AccessLevel = 'full' | 'scoped' | 'read' | 'none';
export type RoleId = 'platform_admin' | 'group_owner' | 'brand_admin' | 'editor' | 'fact_owner' | 'compliance';
export type ModuleKey =
  | 'workbench'
  | 'content'
  | 'production'
  | 'standards'
  | 'facts'
  | 'conflicts'
  | 'assets'
  | 'review'
  | 'market'
  | 'integrations'
  | 'insights'
  | 'settings'
  | 'rules';

export const ROLE_CONFIG: Record<RoleId, { label: string; person: string; scopeLabel: string }> = {
  platform_admin: { label: '平台管理员（全部权限）', person: '孙铭', scopeLabel: '全部' },
  group_owner: { label: '集团内容负责人', person: '陈立', scopeLabel: '全部' },
  brand_admin: { label: '品牌管理员', person: '周敏', scopeLabel: '北岭智造' },
  editor: { label: '内容编辑', person: '林悦', scopeLabel: '北岭智造 · 工业机器人事业部' },
  fact_owner: { label: '事实负责人', person: '王拓', scopeLabel: 'BL-R600 / BL-R800 产品线' },
  compliance: { label: '合规审核', person: '何静', scopeLabel: '全部' },
};

const F: AccessLevel = 'full';
const S: AccessLevel = 'scoped';
const R: AccessLevel = 'read';
const N: AccessLevel = 'none';

//                           平台管理员 集团负责人 品牌管理员 内容编辑 事实负责人 合规审核
const MATRIX: Record<ModuleKey, [AccessLevel, AccessLevel, AccessLevel, AccessLevel, AccessLevel, AccessLevel]> = {
  workbench: [F, F, F, F, F, F],
  content: [F, F, S, S, R, R],
  production: [F, F, S, S, N, N],
  standards: [F, F, S, R, N, R],
  facts: [F, R, R, R, S, R],
  conflicts: [F, R, R, N, S, R],
  assets: [F, F, S, S, R, R],
  review: [F, F, S, N, S, F], // 事实负责人：只看事实发布审批
  market: [F, F, S, R, R, R],
  integrations: [F, R, N, N, R, N],
  insights: [F, F, S, N, N, R],
  settings: [F, R, N, N, N, N],
  rules: [F, F, N, N, N, N], // 集团负责人：规则可改
};
const ROLE_INDEX: Record<RoleId, number> = { platform_admin: 0, group_owner: 1, brand_admin: 2, editor: 3, fact_owner: 4, compliance: 5 };

export function accessOf(role: RoleId, module: ModuleKey): AccessLevel {
  return MATRIX[module][ROLE_INDEX[role]];
}

// 路由 → 模块（越具体的放前面）
const ROUTE_MODULES: [string, ModuleKey][] = [
  ['/facts/conflicts', 'conflicts'],
  ['/facts', 'facts'],
  ['/production/standards', 'standards'],
  ['/production', 'production'],
  ['/content', 'content'],
  ['/assets', 'assets'],
  ['/external', 'assets'],
  ['/review', 'review'],
  ['/market', 'market'],
  ['/integrations', 'integrations'],
  ['/insights', 'insights'],
  ['/settings/rules', 'rules'],
  ['/settings', 'settings'],
];
export function moduleOfPath(pathname: string): ModuleKey {
  return ROUTE_MODULES.find(([p]) => pathname.startsWith(p))?.[1] ?? 'workbench';
}

export const LEVEL_LABEL: Record<AccessLevel, string> = { full: '完整操作', scoped: '本范围内操作', read: '只读', none: '不可见' };
