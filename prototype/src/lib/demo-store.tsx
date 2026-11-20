import { createContext, useContext, useEffect, useReducer } from 'react';
import type { RoleId } from '@/components/layout/access';

// 原型演示状态：让跨页面的操作能接得上（处理冲突 → 编辑器可送审 → 审核逐级推进 → 生效）。
// 只存在浏览器会话里；正式产品由后端接口承担，这里不属于任何页面的 DataSlot。

export type ConflictAction = 'adopt' | 'split_scope' | 'pause_all' | 'request_source_fix';
export interface ConflictResolution {
  conflictId: string;
  action: ConflictAction;
  adoptedValue: string | null;
  note: string;
  resolvedBy: string;
  resolvedAt: string;
}
export type ReviewDecision = 'submit' | 'approve' | 'reject' | 'add_approver' | 'emergency' | 'resubmit';
export interface ReviewHistoryItem {
  stageName: string;
  actor: string;
  decision: ReviewDecision;
  comment: string;
  at: string;
}
export interface ReviewProgress {
  taskId: string;
  stageIndex: number; // 1 起，当前所在审批节点
  status: 'in_review' | 'approved' | 'rejected';
  history: ReviewHistoryItem[];
  inserted?: { afterIndex: number; stageName: string; approverLabel: string }[];
}
// 统一审批：各类“发布”都走同一套审批（内容发布 / 事实发布回写 KDH / 批次发布 / 市场上架与推送）
export type ApprovalKind = 'content' | 'fact' | 'batch' | 'market';
export interface PublishSettings {
  channels: string[]; // 上架内容市场的适用渠道
  collections: { collectionId: string; collectionName: string }[]; // 手动加入的内容集合
  smartCollections: string[]; // 按规则自动进入的智能集合（只读提示）
}
export interface SubmittedTask {
  taskId: string;
  kind?: ApprovalKind; // 缺省为内容发布
  targetRef?: string; // 事实发布 = 冲突编号；批次 = 批次编号；市场 = 内容编号
  lines?: { label: string; before: string; after: string }[];
  effect?: string; // 通过后执行什么
  publish?: PublishSettings; // 内容发布：送审时确定的发布设置，审批通过后执行
  contentId: string;
  title: string;
  contentTypeName: string;
  brandName: string;
  locale: string;
  version: number;
  submittedBy: string;
  submittedAt: string;
  stages: { stageName: string; approverLabel: string; rule: string }[];
}

// 生产环节产出的内容（AI 生成 / 一稿多用 / 翻译），保存后进入「全部内容」，并带着来源
export type SourceKind = 'ai_generate' | 'repurpose' | 'translation' | 'manual' | 'import';
export interface SourceRef {
  refKind: 'fact' | 'content' | 'kdh' | 'asset' | 'external';
  refId: string;
  label: string;
}
export interface ContentSource {
  kind: SourceKind;
  topicId: string | null;
  taskId: string | null;
  templateId: string | null;
  templateName: string | null;
  sourceContentId: string | null;
  refs: SourceRef[];
}
// 生成时遇到冲突，作者选用了其中一个取值继续生成；送审后由审批确认，通过即裁定
export interface ConflictChoice {
  conflictId: string;
  attributeName: string;
  localFactId: string;
  chosenValue: string;
  chosenSource: string;
  otherValue: string;
  otherSource: string;
}
export interface CreatedContent {
  contentId: string;
  title: string;
  summary: string;
  contentTypeName: string;
  brandName: string;
  regionLabel: string;
  locale: string;
  sections: { heading: string; body: string }[];
  source: ContentSource;
  conflictChoices?: ConflictChoice[];
  ownerName: string;
  createdAt: string;
}
// 生产规范里新建的模板：生成模板（按内容类型）/ 目标格式模板（一稿多用，按渠道）
export interface CustomTemplate {
  templateId: string;
  templateKind: 'generate' | 'repurpose';
  templateName: string;
  contentTypeName: string;
  channelLabel: string;
  structure: string;
  enabled: boolean;
}

// 使用中发现的冲突：「用到才存」的外部内容事先不知道冲不冲突，被引用时与事实库比对才发现
export interface DiscoveredConflict {
  conflictId: string;
  subjectName: string;
  attributeName: string;
  localFactId: string;
  localValue: string;
  localSource: string;
  externalId: string;
  externalValue: string;
  externalSource: string;
  recommendExternal: boolean;
  discoveredIn: string;
  discoveredBy: string;
  discoveredAt: string;
}

interface DemoState {
  role: RoleId;
  discovered: DiscoveredConflict[];
  created: CreatedContent[];
  templates: CustomTemplate[];
  conflicts: Record<string, ConflictResolution>;
  reviews: Record<string, ReviewProgress>;
  submitted: SubmittedTask[];
  removedRefs: Record<string, string[]>; // 内容 → 已在本内容中移除的事实引用
}

type Action =
  | { type: 'setRole'; role: RoleId }
  | { type: 'resolveConflict'; resolution: ConflictResolution }
  | { type: 'setReview'; progress: ReviewProgress }
  | { type: 'submitTask'; task: SubmittedTask; progress: ReviewProgress }
  | { type: 'removeRef'; contentId: string; factId: string }
  | { type: 'createContent'; content: CreatedContent }
  | { type: 'addTemplate'; template: CustomTemplate }
  | { type: 'discoverConflict'; conflict: DiscoveredConflict }
  | { type: 'reset' };

const INITIAL: DemoState = { role: 'platform_admin', discovered: [], created: [], templates: [], conflicts: {}, reviews: {}, submitted: [], removedRefs: {} };
const KEY = 'cms-prototype-demo-v4';

function load(): DemoState {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? { ...INITIAL, ...JSON.parse(raw) } : INITIAL;
  } catch {
    return INITIAL;
  }
}

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case 'setRole':
      return { ...state, role: action.role };
    case 'resolveConflict':
      return { ...state, conflicts: { ...state.conflicts, [action.resolution.conflictId]: action.resolution } };
    case 'setReview':
      return { ...state, reviews: { ...state.reviews, [action.progress.taskId]: action.progress } };
    case 'submitTask':
      return {
        ...state,
        submitted: [action.task, ...state.submitted.filter((t) => t.taskId !== action.task.taskId)],
        reviews: { ...state.reviews, [action.progress.taskId]: action.progress },
      };
    case 'removeRef':
      return { ...state, removedRefs: { ...state.removedRefs, [action.contentId]: [...(state.removedRefs[action.contentId] ?? []), action.factId] } };
    case 'createContent':
      return { ...state, created: [action.content, ...state.created.filter((c) => c.contentId !== action.content.contentId)] };
    case 'addTemplate':
      return { ...state, templates: [...state.templates, action.template] };
    case 'discoverConflict':
      return { ...state, discovered: [action.conflict, ...state.discovered.filter((c) => c.conflictId !== action.conflict.conflictId)] };
    case 'reset':
      return { ...INITIAL, role: state.role };
  }
}

const Ctx = createContext<{ state: DemoState; dispatch: React.Dispatch<Action> } | null>(null);

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* 会话存储不可用时只在内存中保留 */
    }
  }, [state]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDemo 需要在 DemoStoreProvider 内使用');
  return v;
}

export const nowLabel = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 演示中 C-1002 引用的冲突：防护等级 IP66 / IP65
export const EDITOR_CONFLICT_ID = 'CF-018';

// CF-018 影响的内容；采纳 / 拆分后这些内容的“无冲突”检查通过；C-1002 也可以只在本内容中移除该引用
export const CF018_CONTENTS = ['C-1002', 'C-1015'];
export function conflictClearedFor(state: DemoState, contentId: string): boolean {
  const r = state.conflicts[EDITOR_CONFLICT_ID];
  if (r && (r.action === 'adopt' || r.action === 'split_scope')) return true;
  return (state.removedRefs[contentId] ?? []).includes('F-002');
}
export type { DemoState };

// 新内容编号：C-1071 起递增（C-1070 留给编辑器里手动新建的演示内容）
export const nextContentId = (state: DemoState) => `C-${1071 + state.created.length}`;

// ── 统一审批的辅助 ─────────────────────────────────────────
export const nextApprovalId = (state: DemoState) => `AP-${610 + state.submitted.length}`;

export function approvalOf(state: DemoState, kind: ApprovalKind, targetRef: string): { taskId: string; status: 'in_review' | 'approved' | 'rejected' } | null {
  const t = state.submitted.find((x) => x.kind === kind && x.targetRef === targetRef);
  if (!t) return null;
  return { taskId: t.taskId, status: state.reviews[t.taskId]?.status ?? 'in_review' };
}

// 冲突裁定后的事实取值：进入事实库，后续引用取这个值
export function factOverrides(state: DemoState): Record<string, { value: string; conflictId: string }> {
  const out: Record<string, { value: string; conflictId: string }> = {};
  state.discovered.forEach((d) => {
    const r = state.conflicts[d.conflictId];
    if (r && r.action === 'adopt' && r.adoptedValue) out[d.localFactId] = { value: r.adoptedValue, conflictId: d.conflictId };
  });
  return out;
}

// 冲突裁定后，新取值在事实库立即可用；回写 KDH 属于“事实发布”，生成一条审批
export function factPublishAction(
  state: DemoState,
  a: { conflictId: string; subjectName: string; attributeName: string; before: string; after: string; person: string; redLine: boolean },
): { taskId: string; action: Action } {
  const taskId = nextApprovalId(state);
  const at = `今天 ${nowLabel()}`;
  return {
    taskId,
    action: {
      type: 'submitTask',
      task: {
        taskId, kind: 'fact', targetRef: a.conflictId, contentId: a.conflictId, title: `${a.subjectName} · ${a.attributeName} 回写 KDH`, contentTypeName: '事实发布', brandName: '北岭智造', locale: '—', version: 1,
        submittedBy: a.person, submittedAt: at,
        lines: [{ label: a.attributeName, before: a.before, after: a.after }],
        effect: '新取值写回 KDH，KDH 侧条目更新并记录来源；事实库同步状态变为「已同步」',
        stages: [
          { stageName: '事实负责人确认', approverLabel: '王拓（事实负责人）', rule: '事实回写 KDH' },
          ...(a.redLine ? [{ stageName: '红线确认', approverLabel: '赵启（事业部负责人）', rule: '红线字段（价格 / 交期 / 承诺）' }] : []),
        ],
      },
      progress: { taskId, stageIndex: 1, status: 'in_review', history: [{ stageName: '提交', actor: a.person, decision: 'submit', comment: `冲突 ${a.conflictId} 裁定`, at }] },
    },
  };
}
export const RED_LINE_ATTRIBUTES = ['标准交付周期', '价格', '交付周期'];
