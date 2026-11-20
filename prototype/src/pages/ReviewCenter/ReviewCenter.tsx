import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, CircleDot, Clock, GitCompareArrows, ShieldAlert, UserPlus, XCircle, Zap } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { AiMark, ToneBadge, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';
import { notify } from '@/components/shared/toast';
import { CF018_CONTENTS, conflictClearedFor, factPublishAction, nowLabel, RED_LINE_ATTRIBUTES, useDemo, type ApprovalKind, type PublishSettings, type ReviewProgress, type SubmittedTask } from '@/lib/demo-store';
import { CHANNEL_LABEL } from '@/lib/publish-config';
import { Badge } from '@/components/ui/badge';

// ── 配置常量 ──────────────────────────────────────────────
// 审批事项类型：各类“发布”统一走这里（审批引擎可切换为外部标准化审批产品，见「设置 → 审批流程」）
const KIND_CONFIG: Record<ApprovalKind, { label: string; tone: Tone; done: string; openLabel: string }> = {
  content: { label: '内容发布', tone: 'blue', done: '内容已生效，自动上架内容市场', openLabel: '打开内容' },
  fact: { label: '事实发布', tone: 'violet', done: '新取值已回写 KDH，事实库同步状态为已同步', openLabel: '查看事实' },
  batch: { label: '批次发布', tone: 'teal', done: '批次已排期，到点自动执行', openLabel: '查看批次' },
  market: { label: '上架与推送', tone: 'amber', done: '已上架到新渠道，对接方可以取用', openLabel: '查看内容市场' },
};
const RECHECK_REASON_CONFIG = {
  fact_changed: { label: '事实变更', tone: 'blue' as Tone },
  asset_changed: { label: '资产变更', tone: 'teal' as Tone },
  expired: { label: '事实过期', tone: 'amber' as Tone },
  conflict_resolved: { label: '冲突处理', tone: 'violet' as Tone },
  rights_expired: { label: '授权到期', tone: 'red' as Tone },
} as const;
type RecheckReason = keyof typeof RECHECK_REASON_CONFIG;
type CheckResult = 'pass' | 'fail' | 'warn';
const CHECK_ICON: Record<CheckResult, React.ReactNode> = {
  pass: <CheckCircle2 className="size-4 text-emerald-600" />,
  fail: <XCircle className="size-4 text-red-600" />,
  warn: <CircleAlert className="size-4 text-amber-600" />,
};

// ── 类型 ──────────────────────────────────────────────────
interface ReviewTask {
  taskId: string;
  kind: ApprovalKind;
  targetRef: string | null;
  lines: { label: string; before: string; after: string }[];
  effect: string | null;
  publish: PublishSettings | null; // 内容发布：送审时定好的上架渠道与内容集合
  contentId: string;
  title: string;
  contentTypeName: string;
  brandName: string;
  locale: string;
  version: number;
  submittedBy: string;
  submittedAt: string;
  stageName: string;
  stageIndex: number;
  stageTotal: number;
  failedCheckCount: number;
  aiSectionCount: number;
  redLineFields: string[];
  submittedByAgent: string | null;
}
interface ReviewDetail {
  taskId: string;
  approvalChain: { stageName: string; approverLabel: string; rule: string; status: 'done' | 'current' | 'pending'; actedAt: string | null }[];
  checks: { checkLabel: string; result: CheckResult; detail: string }[];
  changes: { fieldLabel: string; before: string; after: string; aiGenerated: boolean }[];
  redLineChanges: { fieldLabel: string; before: string; after: string }[];
}
interface AgentSuggestion {
  suggestionId: string;
  agentName: string;
  contentId: string;
  title: string;
  locale: string;
  kind: 'seo' | 'geo' | 'sdr';
  suggestion: string;
  before: string;
  after: string;
  touchesFacts: boolean;
  receivedAt: string;
}
interface RecheckTask {
  taskId: string;
  contentId: string;
  title: string;
  locale: string;
  reason: RecheckReason;
  triggerRef: string;
  changeBefore: string;
  changeAfter: string;
  refMode: 'inline' | 'slot';
  contentStatus: string;
  createdAt: string;
}
interface ReviewRecord {
  recordId: string;
  contentId: string;
  title: string;
  decision: 'approved' | 'rejected' | 'emergency_released';
  reviewerName: string;
  stageName: string;
  comment: string;
  decidedAt: string;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockReviewTasksData: ReviewTask[] = [
  { taskId: 'RV-551', kind: 'content', targetRef: null, lines: [], effect: null, publish: { channels: ['website', 'product_platform', 'kdh'], collections: [{ collectionId: 'COL-11', collectionName: '汉诺威工业展专题' }], smartCollections: ['SDR 知识集 · 欧盟'] }, contentId: 'C-1002', title: 'BL-R600 Product Brief', contentTypeName: '产品说明', brandName: '北岭智造', locale: 'en-US', version: 3, submittedBy: '林悦', submittedAt: '2026-11-19 08:12', stageName: '合规审核', stageIndex: 2, stageTotal: 3, failedCheckCount: 1, aiSectionCount: 2, redLineFields: [], submittedByAgent: null },
  { taskId: 'RV-552', kind: 'content', targetRef: null, lines: [], effect: null, publish: { channels: ['website', 'ai_service', 'kdh'], collections: [], smartCollections: [] }, contentId: 'C-1011', title: 'HC-RV200 Technical FAQ', contentTypeName: '技术 FAQ', brandName: '汉川传动', locale: 'de-DE', version: 1, submittedBy: 'Sophie Wei', submittedAt: '2026-11-18 16:20', stageName: '区域审核', stageIndex: 1, stageTotal: 3, failedCheckCount: 0, aiSectionCount: 5, redLineFields: [], submittedByAgent: '翻译 Agent' },
  { taskId: 'RV-553', kind: 'content', targetRef: null, lines: [], effect: null, publish: { channels: ['sales'], collections: [{ collectionId: 'COL-12', collectionName: '经销商季度内容包 · 2026Q4' }], smartCollections: [] }, contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', contentTypeName: '销售资料', brandName: '北岭智造', locale: 'en-US', version: 3, submittedBy: '林悦', submittedAt: '2026-11-19 09:30', stageName: '品牌审核', stageIndex: 1, stageTotal: 2, failedCheckCount: 0, aiSectionCount: 0, redLineFields: ['交付周期'], submittedByAgent: null },
  { taskId: 'AP-601', kind: 'fact', targetRef: 'F-032', lines: [{ label: '背隙', before: 'KDH 无此属性', after: '≤ 1 arcmin（文档解析 F-032，证据 A）' }], effect: '写入 KDH 作为 HC-RV200 的新属性，KDH 侧可被其他系统使用', publish: null, contentId: 'F-032', title: 'HC-RV200 · 背隙 回写 KDH', contentTypeName: '事实发布', brandName: '汉川传动', locale: '—', version: 1, submittedBy: '王拓', submittedAt: '2026-11-19 10:05', stageName: '事实负责人确认', stageIndex: 1, stageTotal: 1, failedCheckCount: 0, aiSectionCount: 0, redLineFields: [], submittedByAgent: null },
  { taskId: 'AP-602', kind: 'batch', targetRef: 'RB-032', lines: [{ label: '执行时间', before: '—', after: '12-01 08:00（Europe/Berlin）' }, { label: '条目', before: '—', after: '4 条更新版本，均已通过内容审批' }], effect: '批次排期，到点一起发布；执行前 30 分钟再检查一次', publish: null, contentId: 'RB-032', title: '发布批次 RB-032 欧盟官网 12 月更新', contentTypeName: '批次发布', brandName: '北岭智造', locale: '—', version: 1, submittedBy: '周敏', submittedAt: '2026-11-19 11:20', stageName: '品牌审核', stageIndex: 1, stageTotal: 1, failedCheckCount: 0, aiSectionCount: 0, redLineFields: [], submittedByAgent: null },
  { taskId: 'AP-603', kind: 'market', targetRef: 'C-1003', lines: [{ label: '适用渠道', before: '销售助手', after: '销售助手、KDH 知识库' }], effect: '上架到 KDH 知识库渠道，KDH 订阅后自动导入', publish: null, contentId: 'C-1003', title: 'C-1003 销售资料 上架到 KDH 知识库', contentTypeName: '上架与推送', brandName: '北岭智造', locale: 'en-US', version: 2, submittedBy: '林悦', submittedAt: '2026-11-19 11:40', stageName: '品牌审核', stageIndex: 1, stageTotal: 1, failedCheckCount: 0, aiSectionCount: 0, redLineFields: [], submittedByAgent: null },
  { taskId: 'RV-554', kind: 'content', targetRef: null, lines: [], effect: null, publish: { channels: ['website', 'ai_service', 'kdh'], collections: [], smartCollections: ['SDR 知识集 · 欧盟'] }, contentId: 'C-1015', title: 'BL-R600 FAQ: IP rating', contentTypeName: '技术 FAQ', brandName: '北岭智造', locale: 'en-US', version: 1, submittedBy: '林悦', submittedAt: '2026-11-19 08:55', stageName: '品牌审核', stageIndex: 1, stageTotal: 3, failedCheckCount: 1, aiSectionCount: 4, redLineFields: [], submittedByAgent: 'GEO Agent（经 MCP）' },
];

const mockReviewDetailData: ReviewDetail = {
  taskId: 'RV-553',
  approvalChain: [
    { stageName: '提交', approverLabel: '林悦', rule: '—', status: 'done', actedAt: '2026-11-19 09:30' },
    { stageName: '品牌审核', approverLabel: '周敏（北岭智造品牌管理员）', rule: '任一人通过', status: 'current', actedAt: null },
    { stageName: '红线确认', approverLabel: '赵启（事业部负责人）', rule: '交期变更强制人工 · 不可由 Agent 推进', status: 'pending', actedAt: null },
  ],
  checks: [
    { checkLabel: '事实引用完整', result: 'pass', detail: '引用 5 条事实' },
    { checkLabel: '无冲突事实', result: 'pass', detail: '交付周期冲突已处理（采纳 12 周）' },
    { checkLabel: '资产授权有效', result: 'warn', detail: 'A-2207 授权 2026-12-01 到期' },
    { checkLabel: 'AI 生成标识', result: 'pass', detail: '本版本无 AI 生成内容' },
  ],
  changes: [
    { fieldLabel: '正文 · Delivery', before: 'Standard lead time is 10 weeks for EU orders.', after: 'Standard lead time is 12 weeks for EU orders.', aiGenerated: false },
    { fieldLabel: '参数表 · 标准交付周期', before: '10 周', after: '12 周（自动刷新）', aiGenerated: false },
  ],
  redLineChanges: [{ fieldLabel: '交付周期', before: '10 周', after: '12 周' }],
};

// 审批节点与处理人（静态配置：来自「设置 → 审批流程」匹配结果）
const APPROVER_LABEL: Record<string, string> = {
  品牌审核: '周敏（北岭智造品牌管理员）',
  合规审核: '何静（合规审核）',
  '区域审核（欧盟）': 'Anna K.（欧盟区域）',
  '区域审核（德语）': 'Anna K.（德语区域）',
  红线确认: '赵启（事业部负责人）',
  'GEO 内容复核': '陈立（集团内容负责人）',
  事实负责人确认: '王拓（事实负责人）',
  法务加签: '刘洋（法务）',
};
const STAGE_PLAN: Record<string, string[]> = {
  'RV-551': ['品牌审核', '合规审核', '区域审核（欧盟）'],
  'RV-552': ['区域审核（德语）', '品牌审核', '合规审核'],
  'RV-553': ['品牌审核', '红线确认'],
  'RV-554': ['品牌审核', '合规审核', 'GEO 内容复核'],
  'AP-601': ['事实负责人确认'],
  'AP-602': ['品牌审核'],
  'AP-603': ['品牌审核'],
};
const DECISION_LABEL = { submit: '提交', approve: '通过', reject: '驳回', add_approver: '加签', emergency: '紧急放行', resubmit: '重新送审' } as const;

// 原型：详情接口只给了 RV-553 一份样例，其余任务按列表字段拼出审批链与检查结果
function reviewDetailOf(t: ReviewTask): ReviewDetail {
  if (t.taskId === mockReviewDetailData.taskId) return mockReviewDetailData;
  const stages = Array.from({ length: t.stageTotal }, (_, i) => {
    const idx = i + 1;
    return {
      stageName: idx === t.stageIndex ? t.stageName : idx < t.stageIndex ? `第 ${idx} 级审核` : `第 ${idx} 级审核`,
      approverLabel: idx === t.stageIndex ? '当前审核人' : '按审批流程分配',
      rule: '任一人通过',
      status: (idx < t.stageIndex ? 'done' : idx === t.stageIndex ? 'current' : 'pending') as 'done' | 'current' | 'pending',
      actedAt: idx < t.stageIndex ? t.submittedAt : null,
    };
  });
  return {
    taskId: t.taskId,
    approvalChain: [{ stageName: '提交', approverLabel: t.submittedByAgent ?? t.submittedBy, rule: '—', status: 'done', actedAt: t.submittedAt }, ...stages],
    checks: [
      { checkLabel: '发布检查', result: t.failedCheckCount > 0 ? 'fail' : 'pass', detail: t.failedCheckCount > 0 ? `${t.failedCheckCount} 项未通过，需回到内容处理` : '全部通过' },
      { checkLabel: 'AI 生成标识', result: t.aiSectionCount > 0 ? 'warn' : 'pass', detail: t.aiSectionCount > 0 ? `${t.aiSectionCount} 段 AI 生成，需逐段确认` : '本版本无 AI 生成内容' },
    ],
    changes: [],
    redLineChanges: t.redLineFields.map((f) => ({ fieldLabel: f, before: '上一生效版本', after: '本版本' })),
  };
}

const mockAgentSuggestionsData: AgentSuggestion[] = [
  { suggestionId: 'AS-31', agentName: 'GEO Agent', contentId: 'C-1015', title: 'BL-R600 FAQ: IP rating', locale: 'en-US', kind: 'geo', suggestion: '答案首句改为可独立引用的完整陈述，便于 AI 引擎摘录', before: 'Yes, it is.', after: 'Yes. The BL-R600 is rated IP66 (TÜV report TÜV-2026-1188), so it runs reliably in dusty welding cells.', touchesFacts: true, receivedAt: '09:12' },
  { suggestionId: 'AS-30', agentName: 'SEO Agent', contentId: 'C-1012', title: 'BL-R600 汉诺威展专题落地页', locale: 'en-US', kind: 'seo', suggestion: '标题加入高频检索词 “welding robot”', before: 'BL-R600 at Hannover Messe', after: 'BL-R600 Welding Robot at Hannover Messe 2026', touchesFacts: false, receivedAt: '昨天' },
  { suggestionId: 'AS-29', agentName: 'SDR Agent', contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', locale: 'en-US', kind: 'sdr', suggestion: '买家常问备件供应，建议增加一问一答', before: '—', after: 'Q: Are spare parts stocked in the EU? A: …（需引用事实，KDH 暂无该属性）', touchesFacts: true, receivedAt: '昨天' },
];

const mockRecheckTasksData: RecheckTask[] = [
  { taskId: 'RC-310', contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', locale: 'en-US', reason: 'conflict_resolved', triggerRef: 'CF-021 交付周期', changeBefore: '10 周', changeAfter: '12 周', refMode: 'inline', contentStatus: '已生效 v2', createdAt: '2026-11-19 08:31' },
  { taskId: 'RC-311', contentId: 'C-1009', title: '汽车焊装线改造：BL-R600 客户案例', locale: 'en-US', reason: 'fact_changed', triggerRef: 'F-001 重复定位精度', changeBefore: '±0.03 mm', changeAfter: '±0.02 mm', refMode: 'inline', contentStatus: '已生效 v4', createdAt: '2026-11-18 11:00' },
  { taskId: 'RC-312', contentId: 'C-0877', title: 'HC-SD75 Servo Drive Datasheet', locale: 'en-US', reason: 'expired', triggerRef: 'F-014 UL 认证', changeBefore: '有效至 2026-09-30', changeAfter: '已过期', refMode: 'slot', contentStatus: '已生效 v3', createdAt: '2026-10-01 08:00' },
  { taskId: 'RC-313', contentId: 'C-1021', title: '东南亚经销商大会回顾', locale: 'en-US', reason: 'rights_expired', triggerRef: 'A-2050 活动照片', changeBefore: '授权有效', changeAfter: '2026-08-31 到期，源已删除', refMode: 'inline', contentStatus: '已生效 v1', createdAt: '2026-09-01 00:00' },
];

const mockReviewRecordsData: ReviewRecord[] = [
  { recordId: 'RR-901', contentId: 'C-1004', title: 'HC-RV200 精密减速机产品说明', decision: 'approved', reviewerName: '何静', stageName: '合规审核', comment: '证据齐全', decidedAt: '2026-11-19 09:12' },
  { recordId: 'RR-899', contentId: 'C-1005', title: 'HC-SD75 伺服驱动器技术 FAQ', decision: 'rejected', reviewerName: '周敏', stageName: '品牌审核', comment: 'Q3 答案引用了过期 UL 认证', decidedAt: '2026-11-18 17:50' },
  { recordId: 'RR-870', contentId: 'C-0990', title: '召回声明（紧急）', decision: 'emergency_released', reviewerName: '陈立', stageName: '全部', comment: '法务要求 2 小时内上线，事后补审', decidedAt: '2026-11-10 21:04' },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 处理 Agent 建议 [POST] /api/v1/agent-suggestions/{id}/resolve
function handleResolveSuggestion(suggestionId: string, decision: 'draft' | 'dismiss') {
  alert(decision === 'draft' ? '已生成修改草稿，按正常流程检查与审核' : '已忽略，Agent 会收到反馈');
}

// ACTION: 获取待审任务 [GET] /api/v1/review-tasks
function handleFetchReviewTasks(params: { assignee: 'me'; status: 'pending' }) {
  console.log('fetch review tasks', params);
}

// ACTION: 获取审核详情 [GET] /api/v1/review-tasks/{id}
function handleFetchReviewDetail(taskId: string) {
  console.log('fetch review detail', taskId);
}

// ACTION: 审核通过 [POST] /api/v1/review-tasks/{id}/approve
function handleApproveReview(taskId: string, body: { comment: string; aiConfirmed: boolean; redLineConfirmed: boolean }) {
  console.log('approve', taskId, body);
}

// ACTION: 驳回 [POST] /api/v1/review-tasks/{id}/reject
function handleRejectReview(taskId: string, body: { comment: string }) {
  console.log('reject', taskId, body);
}

// ACTION: 加签 [POST] /api/v1/review-tasks/{id}/approvers
function handleAddApprover(taskId: string, approverId: string) {
  console.log('add approver', taskId, approverId);
}

// ACTION: 紧急放行 [POST] /api/v1/review-tasks/{id}/emergency-release
function handleEmergencyRelease(taskId: string, reason: string) {
  console.log('emergency release', taskId, reason);
}

// ACTION: 处理复核任务 [POST] /api/v1/recheck-tasks/{id}/resolve
function handleResolveRecheck(taskId: string, action: 'no_change' | 'create_revision' | 'unpublish') {
  console.log('resolve recheck', taskId, action);
}

// ── 主组件 ────────────────────────────────────────────────
export default function ReviewCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: demo, dispatch } = useDemo();
  const [selected, setSelected] = useState<string>((location.state as { taskId?: string } | null)?.taskId ?? 'RV-551');
  const [comment, setComment] = useState('');
  const [aiConfirmed, setAiConfirmed] = useState(false);
  const [redLineConfirmed, setRedLineConfirmed] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [handled, setHandled] = useState<string[]>([]);
  const [kindFilter, setKindFilter] = useState<ApprovalKind | 'all'>('all');

  // 列表 = 本次演示中新送审的任务 + 接口返回的待审任务
  const submittedAsTasks: ReviewTask[] = demo.submitted.map((x: SubmittedTask) => ({
    taskId: x.taskId, kind: x.kind ?? 'content', targetRef: x.targetRef ?? null, lines: x.lines ?? [], effect: x.effect ?? null, publish: x.publish ?? null, contentId: x.contentId, title: x.title, contentTypeName: x.contentTypeName, brandName: x.brandName, locale: x.locale,
    version: x.version, submittedBy: x.submittedBy, submittedAt: x.submittedAt, stageName: x.stages[0].stageName, stageIndex: 1,
    stageTotal: x.stages.length, failedCheckCount: 0, aiSectionCount: 0, redLineFields: [], submittedByAgent: null,
  }));
  // 事实负责人只处理事实发布（回写 KDH）这一类审批
  const factOnly = demo.role === 'fact_owner';
  const tasks: ReviewTask[] = [...submittedAsTasks, ...mockReviewTasksData]
    .filter((t) => !factOnly || t.kind === 'fact')
    .map((t) => (CF018_CONTENTS.includes(t.contentId) && conflictClearedFor(demo, t.contentId) ? { ...t, failedCheckCount: 0 } : t));
  const baseStages = (t: ReviewTask): string[] => demo.submitted.find((x) => x.taskId === t.taskId)?.stages.map((x) => x.stageName) ?? STAGE_PLAN[t.taskId] ?? [t.stageName];
  const progressOf = (t: ReviewTask): ReviewProgress => {
    const saved = demo.reviews[t.taskId];
    if (saved) return saved;
    const names = baseStages(t);
    return {
      taskId: t.taskId,
      stageIndex: t.stageIndex,
      status: 'in_review',
      history: [
        { stageName: '提交', actor: t.submittedByAgent ?? t.submittedBy, decision: 'submit', comment: '', at: t.submittedAt },
        ...names.slice(0, t.stageIndex - 1).map((n) => ({ stageName: n, actor: APPROVER_LABEL[n] ?? n, decision: 'approve' as const, comment: '', at: t.submittedAt })),
      ],
    };
  };
  const stagesOf = (t: ReviewTask, p: ReviewProgress): string[] => {
    const names = [...baseStages(t)];
    (p.inserted ?? []).forEach((ins) => names.splice(ins.afterIndex, 0, ins.stageName));
    return names;
  };

  const shownTasks = tasks.filter((t) => kindFilter === 'all' || t.kind === kindFilter);
  const task = tasks.find((t) => t.taskId === selected) ?? tasks[0];
  const isContent = task.kind === 'content';
  // 生成时选用的冲突取值（随内容审批确认，通过即裁定）
  const choices = isContent ? (demo.created.find((c) => c.contentId === task.contentId)?.conflictChoices ?? []).filter((c) => !demo.conflicts[c.conflictId]) : [];
  const openTarget = () => {
    if (task.kind === 'content') navigate(`/content/edit/${task.contentId}`);
    else if (task.kind === 'fact') navigate(task.targetRef?.startsWith('CF-') ? '/facts/conflicts' : '/facts', { state: { conflictId: task.targetRef } });
    else if (task.kind === 'batch') navigate('/content/releases');
    else navigate('/market');
  };
  const progress = progressOf(task);
  const stages = stagesOf(task, progress);
  const currentStage = stages[progress.stageIndex - 1];
  const finished = progress.status !== 'in_review';
  const d = reviewDetailOf(task);
  const blocked = task.failedCheckCount > 0;
  const needAi = task.aiSectionCount > 0;
  const needRedLine = task.redLineFields.length > 0;

  const decide = (decision: 'approve' | 'reject' | 'add_approver' | 'emergency', reason?: string) => {
    const at = `今天 ${nowLabel()}`;
    const actor = APPROVER_LABEL[currentStage] ?? currentStage;
    const history = [...progress.history, { stageName: decision === 'emergency' ? '紧急放行' : currentStage, actor: decision === 'emergency' ? '陈立（集团内容负责人）' : actor, decision, comment: reason ?? comment, at }];
    let next: ReviewProgress = { ...progress, history };
    if (decision === 'approve') {
      handleApproveReview(task.taskId, { comment, aiConfirmed, redLineConfirmed });
      next = progress.stageIndex < stages.length ? { ...next, stageIndex: progress.stageIndex + 1 } : { ...next, status: 'approved' };
    } else if (decision === 'reject') {
      handleRejectReview(task.taskId, { comment });
      next = { ...next, status: 'rejected' };
    } else if (decision === 'add_approver') {
      handleAddApprover(task.taskId, 'U-legal-01');
      next = { ...next, inserted: [...(progress.inserted ?? []), { afterIndex: progress.stageIndex, stageName: '法务加签', approverLabel: APPROVER_LABEL['法务加签'] }] };
    } else {
      next = { ...next, status: 'approved' };
    }
    dispatch({ type: 'setReview', progress: next });
    const done = next.status === 'approved' && progress.status !== 'approved';
    // 内容审批通过 = 确认生成时选用的冲突取值：裁定入事实库，并生成回写 KDH 的事实发布申请
    let extra = '';
    if (done && isContent && choices.length > 0) {
      let tmp = demo;
      choices.forEach((c) => {
        dispatch({ type: 'resolveConflict', resolution: { conflictId: c.conflictId, action: 'adopt', adoptedValue: c.chosenValue, note: `随 ${task.contentId} 内容审批确认`, resolvedBy: actor, resolvedAt: at } });
        const fp = factPublishAction(tmp, { conflictId: c.conflictId, subjectName: 'BL-R600', attributeName: c.attributeName, before: c.otherValue, after: c.chosenValue, person: actor, redLine: RED_LINE_ATTRIBUTES.includes(c.attributeName) });
        dispatch(fp.action);
        tmp = { ...tmp, submitted: [...tmp.submitted, fp.action.type === 'submitTask' ? fp.action.task : tmp.submitted[0]] };
        extra += `；${c.conflictId} 按审批裁定为 ${c.chosenValue}，已入事实库，回写 KDH 申请 ${fp.taskId} 已提交`;
      });
    }
    if (decision === 'approve') notify(next.status === 'approved' ? `${currentStage}通过，全部节点完成：${KIND_CONFIG[task.kind].done}${extra}` : `${currentStage}已通过，已转给「${stages[progress.stageIndex]}」${APPROVER_LABEL[stages[progress.stageIndex]] ?? ''}`);
    if (decision === 'reject') notify(`已驳回，「${task.title}」退回草稿`);
    if (decision === 'add_approver') notify('已在当前节点后加签：法务加签 · 刘洋');
    if (decision === 'emergency') notify('已紧急放行，内容生效；事后补审任务已创建');
    setComment('');
    setAiConfirmed(false);
    setRedLineConfirmed(false);
  };

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="审批中心"
        description="各类发布统一在这里审批：内容发布、事实发布（回写 KDH）、批次发布、内容市场的上架与推送。审批链按「设置 → 审批流程」匹配，审批引擎可切换为外部标准化审批产品。红线字段（价格、交期、承诺）强制人工确认，Agent 不能推进。"
      />

      <Tabs defaultValue="review" onValueChange={(v) => v === 'review' && handleFetchReviewTasks({ assignee: 'me', status: 'pending' })}>
        <TabsList>
          <TabsTrigger value="review">待审批 {tasks.filter((t) => progressOf(t).status === 'in_review').length}</TabsTrigger>
          <TabsTrigger value="recheck">复核队列 {mockRecheckTasksData.length}</TabsTrigger>
          <TabsTrigger value="agent">Agent 建议 {mockAgentSuggestionsData.length}</TabsTrigger>
          <TabsTrigger value="records">审核记录</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="space-y-3 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {factOnly && <span className="self-center text-xs text-muted-foreground">事实负责人只处理事实发布审批：</span>}
            {(factOnly ? (['fact'] as const) : (['all', 'content', 'fact', 'batch', 'market'] as const)).map((k) => (
              <Button key={k} size="xs" variant={kindFilter === k ? 'default' : 'outline'} onClick={() => setKindFilter(k)}>
                {k === 'all' ? '全部' : KIND_CONFIG[k].label} <span className="tabular-nums opacity-70">{tasks.filter((t) => (k === 'all' || t.kind === k) && progressOf(t).status === 'in_review').length}</span>
              </Button>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
            <div className="space-y-2">
              {shownTasks.map((t) => {
                const p = progressOf(t);
                const st = stagesOf(t, p);
                return (
                <button
                  key={t.taskId}
                  onClick={() => {
                    setSelected(t.taskId);
                    handleFetchReviewDetail(t.taskId);
                    setAiConfirmed(false);
                    setRedLineConfirmed(false);
                  }}
                  className={cn('w-full rounded-xl border bg-background p-3 text-left hover:bg-muted/50', selected === t.taskId && 'border-primary ring-2 ring-primary/20')}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ToneBadge tone={KIND_CONFIG[t.kind].tone}>{KIND_CONFIG[t.kind].label}</ToneBadge>
                    {t.kind === 'content' ? (
                      <>
                        {t.contentId} · v{t.version} · <span className="font-mono">{t.locale}</span>
                      </>
                    ) : (
                      t.taskId
                    )}
                    <span className="ml-auto">
                      {p.status === 'approved' ? <ToneBadge tone="green">已通过</ToneBadge> : p.status === 'rejected' ? <ToneBadge tone="red">已驳回</ToneBadge> : `${st[p.stageIndex - 1]} ${p.stageIndex}/${st.length}`}
                    </span>
                  </div>
                  <div className="mt-1 font-medium">{t.title}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {t.failedCheckCount > 0 && <ToneBadge tone="red">检查未通过 {t.failedCheckCount}</ToneBadge>}
                    {t.aiSectionCount > 0 && <AiMark />}
                    {t.redLineFields.length > 0 && <ToneBadge tone="amber">红线：{t.redLineFields.join('、')}</ToneBadge>}
                    {t.submittedByAgent && <ToneBadge tone="violet">{t.submittedByAgent}</ToneBadge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t.submittedBy} · {t.submittedAt}
                  </div>
                </button>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>
                  <ToneBadge tone={KIND_CONFIG[task.kind].tone} className="mr-2 align-middle">{KIND_CONFIG[task.kind].label}</ToneBadge>
                  {task.title} {isContent && <span className="font-mono text-sm font-normal text-muted-foreground">{task.locale}</span>}
                </CardTitle>
                <CardDescription>
                  {task.taskId} · {isContent ? `${task.contentTypeName} · v${task.version} · ` : ''}{task.brandName} · {finished ? (progress.status === 'approved' ? '审批完成' : '已驳回') : `当前节点：${currentStage} · ${APPROVER_LABEL[currentStage] ?? ''}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-stretch gap-2 text-sm">
                  {['提交', ...stages].map((name, i) => {
                    const state = i === 0 || i < progress.stageIndex || progress.status === 'approved' ? 'done' : i === progress.stageIndex && progress.status === 'in_review' ? 'current' : progress.status === 'rejected' && i === progress.stageIndex ? 'rejected' : 'pending';
                    const hit = [...progress.history].reverse().find((h) => h.stageName === name && h.decision !== 'add_approver');
                    return (
                      <div key={name + i} className="flex items-center gap-2">
                        <div
                          className={cn(
                            'min-w-32 rounded-lg border px-3 py-1.5',
                            state === 'current' && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                            state === 'done' && 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30',
                            state === 'rejected' && 'border-red-300 bg-red-50 dark:bg-red-950/30',
                          )}
                        >
                          <div className="flex items-center gap-1.5 font-medium">
                            {state === 'done' ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : state === 'current' ? <CircleDot className="size-3.5 text-primary" /> : state === 'rejected' ? <XCircle className="size-3.5 text-red-600" /> : <Clock className="size-3.5 text-muted-foreground" />}
                            {name}
                          </div>
                          <div className="text-xs text-muted-foreground">{i === 0 ? task.submittedByAgent ?? task.submittedBy : APPROVER_LABEL[name] ?? '按审批流程分配'}</div>
                          <div className="text-[11px] text-muted-foreground">{hit ? `${DECISION_LABEL[hit.decision]} · ${hit.at}` : state === 'current' ? '处理中' : '待处理'}</div>
                        </div>
                        {i < stages.length && <ArrowRight className="size-4 text-muted-foreground" />}
                      </div>
                    );
                  })}
                </div>

                {progress.status === 'approved' && (
                  <Alert>
                    <CheckCircle2 />
                    <AlertTitle>审批完成：{KIND_CONFIG[task.kind].done}</AlertTitle>
                    <AlertDescription className="flex flex-wrap items-center gap-2">
                      {isContent
                        ? `内容已按发布设置上架内容市场${task.publish?.collections.length ? `，并加入${task.publish.collections.map((c) => `「${c.collectionName}」`).join('')}` : ''}，订阅方会收到通知。需要定时上线时可加入发布批次。`
                        : task.effect}
                      {isContent && (
                        <Button size="xs" variant="outline" onClick={() => navigate('/market')}>
                          去内容市场
                        </Button>
                      )}
                      <Button size="xs" variant="ghost" onClick={openTarget}>
                        {KIND_CONFIG[task.kind].openLabel}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {progress.status === 'rejected' && (
                  <Alert variant="destructive">
                    <XCircle />
                    <AlertTitle>{isContent ? '已驳回，退回草稿' : '已驳回，不执行'}</AlertTitle>
                    <AlertDescription className="flex flex-wrap items-center gap-2">
                      {isContent ? '编辑按意见修改后重新送审，审批从第一个节点重新开始。' : '申请人按意见调整后可重新提交。'}
                      <Button size="xs" variant="outline" onClick={openTarget}>
                        {isContent ? '去修改' : KIND_CONFIG[task.kind].openLabel}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {blocked && (
                  <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertTitle>发布检查未通过，不能通过审核</AlertTitle>
                    <AlertDescription className="flex flex-wrap items-center gap-2">
                      检查项在内容或事实库处理完后，审批可以继续，审核人不能绕过检查。
                      <Button size="xs" variant="outline" onClick={() => navigate(`/content/edit/${task.contentId}`)}>
                        去内容中处理
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {isContent && task.publish && (
                  <div className="space-y-1.5 rounded-xl border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">发布设置 · 通过后执行</span>
                      <span className="text-xs text-muted-foreground">送审时由提交人设置</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="w-16 shrink-0 text-xs text-muted-foreground">上架渠道</span>
                      {task.publish.channels.length ? task.publish.channels.map((ch) => <Badge key={ch} variant="outline">{CHANNEL_LABEL[ch] ?? ch}</Badge>) : <span className="text-xs text-muted-foreground">不上架</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="w-16 shrink-0 text-xs text-muted-foreground">内容集合</span>
                      {task.publish.collections.map((c) => (
                        <Badge key={c.collectionId} variant="secondary">{c.collectionName}</Badge>
                      ))}
                      {task.publish.smartCollections.map((n) => (
                        <Badge key={n} variant="outline" className="text-teal-700 dark:text-teal-300">{n} · 按规则自动</Badge>
                      ))}
                      {task.publish.collections.length + task.publish.smartCollections.length === 0 && <span className="text-xs text-muted-foreground">不加入</span>}
                    </div>
                  </div>
                )}

                {choices.length > 0 && !finished && (
                  <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm dark:border-violet-900 dark:bg-violet-950/30">
                    <div className="flex items-center gap-1.5 font-medium">
                      <GitCompareArrows className="size-4 text-violet-600" /> 生成时的冲突取值，审批通过即裁定
                    </div>
                    {choices.map((c) => (
                      <div key={c.conflictId} className="text-sm">
                        {c.attributeName}：作者选用 <span className="font-medium">{c.chosenValue}</span>（{c.chosenSource}），另一取值 {c.otherValue}（{c.otherSource}）· {c.conflictId}
                      </div>
                    ))}
                    <div className="text-xs text-muted-foreground">通过后：选用的取值进入事实库，后续引用取这个值；并生成回写 KDH 的事实发布申请。不同意可驳回，或先到冲突处理改判。</div>
                  </div>
                )}

                {!isContent && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 text-sm font-medium">申请发布什么</div>
                      <div className="space-y-2">
                        {task.lines.map((c) => (
                          <div key={c.label} className="rounded-lg border p-2.5 text-sm">
                            <div className="text-xs text-muted-foreground">{c.label}</div>
                            {c.before && c.before !== '—' && <div className="text-red-700 line-through decoration-red-300 dark:text-red-300">{c.before}</div>}
                            <div className="text-emerald-700 dark:text-emerald-300">{c.after}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-sm font-medium">通过后</div>
                      <div className="rounded-lg bg-muted/50 p-2.5 text-sm">{task.effect}</div>
                    </div>
                  </div>
                )}

                {isContent && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm font-medium">本次修改</div>
                    <div className="space-y-2">
                      {d.changes.map((c) => (
                        <div key={c.fieldLabel} className="rounded-lg border p-2.5 text-sm">
                          <div className="text-xs text-muted-foreground">{c.fieldLabel}</div>
                          <div className="text-red-700 line-through decoration-red-300 dark:text-red-300">{c.before}</div>
                          <div className="text-emerald-700 dark:text-emerald-300">{c.after}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium">发布检查</div>
                    <div className="space-y-1.5">
                      {d.checks.map((c) => (
                        <div key={c.checkLabel} className="flex gap-2 text-sm">
                          {CHECK_ICON[c.result]}
                          <div>
                            {c.checkLabel}
                            <div className="text-xs text-muted-foreground">{c.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                )}

                {(needAi || needRedLine) && (
                  <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50/60 p-3 text-sm dark:bg-amber-950/30">
                    {needRedLine && (
                      <label className="flex items-start gap-2">
                        <Checkbox checked={redLineConfirmed} onCheckedChange={(c) => setRedLineConfirmed(!!c)} className="mt-0.5" />
                        <span>
                          <ShieldAlert className="mr-1 inline size-4 text-amber-600" />
                          我确认红线字段变更：
                          {d.redLineChanges.map((r) => `${r.fieldLabel} ${r.before} → ${r.after}`).join('；')}
                        </span>
                      </label>
                    )}
                    {needAi && (
                      <label className="flex items-start gap-2">
                        <Checkbox checked={aiConfirmed} onCheckedChange={(c) => setAiConfirmed(!!c)} className="mt-0.5" />
                        <span>我已逐段核对 {task.aiSectionCount} 处 AI 生成内容，发布时保留 AI 标识</span>
                      </label>
                    )}
                  </div>
                )}

                <div>
                  <div className="mb-2 text-sm font-medium">处理记录</div>
                  <ol className="space-y-1.5 border-l pl-4 text-sm">
                    {progress.history.map((h, i) => (
                      <li key={i} className="relative">
                        <span className={cn('absolute top-1.5 -left-[21px] size-2 rounded-full', h.decision === 'reject' ? 'bg-red-500' : h.decision === 'emergency' ? 'bg-amber-500' : 'bg-emerald-500')} />
                        <span className="text-xs text-muted-foreground">{h.at}</span> · {h.stageName} · {h.actor} · <span className="font-medium">{DECISION_LABEL[h.decision]}</span>
                        {h.comment && <span className="text-muted-foreground">：{h.comment}</span>}
                      </li>
                    ))}
                  </ol>
                </div>

                <Textarea placeholder={finished ? '审批已结束' : `审核意见（以「${APPROVER_LABEL[currentStage] ?? currentStage}」身份处理）`} disabled={finished} value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={openTarget}>
                    {KIND_CONFIG[task.kind].openLabel}
                  </Button>
                  <Button variant="outline" disabled={finished || stages.includes('法务加签')} onClick={() => decide('add_approver')}>
                    <UserPlus /> 加签
                  </Button>
                  <Button variant="ghost" className="text-red-600" disabled={finished || task.redLineFields.length > 0} title={task.redLineFields.length > 0 ? '含红线字段，不能紧急放行' : undefined} onClick={() => setEmergencyOpen(true)}>
                    <Zap /> 紧急放行
                  </Button>
                  <div className="ml-auto flex gap-2">
                    <Button variant="outline" disabled={finished || !comment.trim()} title={!comment.trim() ? '驳回需要填写意见' : undefined} onClick={() => decide('reject')}>
                      驳回
                    </Button>
                    <Button
                      disabled={finished || blocked || (needAi && !aiConfirmed) || (needRedLine && !redLineConfirmed)}
                      onClick={() => decide('approve')}
                    >
                      {progress.stageIndex < stages.length ? `通过，转「${stages[progress.stageIndex]}」` : isContent ? '通过并生效' : '通过并执行'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recheck" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>复核队列</CardTitle>
              <CardDescription>事实、资产或授权变化后，正文引用它们的已生效内容需要人工确认。插槽引用已自动刷新，仅记录。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead>变化</TableHead>
                    <TableHead>引用方式</TableHead>
                    <TableHead>触发时间</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRecheckTasksData.map((r) => (
                    <TableRow key={r.taskId} className={cn(handled.includes(r.taskId) && 'opacity-50')}>
                      <TableCell>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.contentId} · {r.locale} · {r.contentStatus}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={RECHECK_REASON_CONFIG[r.reason].tone}>{RECHECK_REASON_CONFIG[r.reason].label}</ToneBadge>
                        <div className="mt-0.5 text-xs text-muted-foreground">{r.triggerRef}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="text-muted-foreground line-through">{r.changeBefore}</span> → <span className="font-medium">{r.changeAfter}</span>
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={r.refMode === 'slot' ? 'teal' : 'violet'}>{r.refMode === 'slot' ? '插槽' : '正文'}</ToneBadge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.createdAt}</TableCell>
                      <TableCell className="text-right">
                        {handled.includes(r.taskId) ? (
                          <ToneBadge tone="green">已处理</ToneBadge>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="xs" onClick={() => { handleResolveRecheck(r.taskId, 'create_revision'); navigate(`/content/edit/${r.contentId}`); }}>
                              修订
                            </Button>
                            <Button size="xs" variant="outline" onClick={() => { handleResolveRecheck(r.taskId, 'no_change'); setHandled((h) => [...h, r.taskId]); }}>
                              无需修改
                            </Button>
                            <Button size="xs" variant="ghost" className="text-red-600" onClick={() => { handleResolveRecheck(r.taskId, 'unpublish'); setHandled((h) => [...h, r.taskId]); }}>
                              下线
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agent" className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">SEO / GEO / SDR Agent 是对接平台，通过 MCP 写入级工具提交建议。建议不会直接改动已生效内容：采纳后生成修改草稿，照常走发布检查和审核；涉及事实的改动只能引用授权事实。</p>
          {mockAgentSuggestionsData.map((a) => (
            <Card key={a.suggestionId} size="sm">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <ToneBadge tone={a.kind === 'geo' ? 'violet' : a.kind === 'seo' ? 'blue' : 'teal'}>{a.agentName}</ToneBadge>
                  {a.title}
                  <span className="text-xs font-normal text-muted-foreground">
                    {a.contentId} · {a.locale} · {a.receivedAt}
                  </span>
                </CardTitle>
                <CardDescription>{a.suggestion}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <div className="rounded-md bg-red-50 p-2.5 dark:bg-red-950">
                    <div className="text-xs text-muted-foreground">现在</div>
                    {a.before}
                  </div>
                  <div className="rounded-md bg-emerald-50 p-2.5 dark:bg-emerald-950">
                    <div className="text-xs text-muted-foreground">建议</div>
                    {a.after}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.touchesFacts && <ToneBadge tone="amber">涉及事实，生成草稿后做事实校验</ToneBadge>}
                  <Button size="sm" className="ml-auto" onClick={() => handleResolveSuggestion(a.suggestionId, 'draft')}>
                    采纳为修改草稿
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleResolveSuggestion(a.suggestionId, 'dismiss')}>
                    忽略
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="records" className="pt-3">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容</TableHead>
                    <TableHead>结果</TableHead>
                    <TableHead>审核人 / 节点</TableHead>
                    <TableHead>意见</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockReviewRecordsData.map((r) => (
                    <TableRow key={r.recordId}>
                      <TableCell>
                        {r.title}
                        <div className="text-xs text-muted-foreground">{r.contentId}</div>
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={r.decision === 'approved' ? 'green' : r.decision === 'rejected' ? 'red' : 'amber'}>
                          {r.decision === 'approved' ? '通过' : r.decision === 'rejected' ? '驳回' : '紧急放行'}
                        </ToneBadge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.reviewerName} · {r.stageName}
                      </TableCell>
                      <TableCell className="text-sm">{r.comment}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.decidedAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={emergencyOpen} onOpenChange={setEmergencyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>紧急放行</DialogTitle>
            <DialogDescription>跳过剩余审批节点立即生效，系统自动创建事后补审任务并通知集团内容负责人。仅限召回、勘误等紧急场景。</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="放行原因（必填）" value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} />
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!emergencyReason.trim()}
              onClick={() => {
                handleEmergencyRelease(task.taskId, emergencyReason);
                decide('emergency', emergencyReason);
                setEmergencyOpen(false);
              }}
            >
              确认放行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
