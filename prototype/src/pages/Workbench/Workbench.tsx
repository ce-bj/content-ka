import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FilePlus2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { ToneBadge, type Tone } from '@/components/shared/status';

// ── 配置常量 ──────────────────────────────────────────────
const TODO_KIND_CONFIG = {
  review: { label: '待审', tone: 'blue' as Tone, path: '/review' },
  recheck: { label: '复核', tone: 'violet' as Tone, path: '/review' },
  conflict: { label: '冲突', tone: 'red' as Tone, path: '/facts/conflicts' },
  sync_error: { label: '同步异常', tone: 'amber' as Tone, path: '/integrations' },
  rights_expiring: { label: '授权到期', tone: 'amber' as Tone, path: '/assets' },
} as const;
type TodoKind = keyof typeof TODO_KIND_CONFIG;

type Priority = 'high' | 'medium' | 'low';
const PRIORITY_CONFIG: Record<Priority, { label: string; tone: Tone }> = {
  high: { label: '高', tone: 'red' },
  medium: { label: '中', tone: 'amber' },
  low: { label: '低', tone: 'gray' },
};

interface TodoItem {
  todoId: string;
  kind: TodoKind;
  title: string;
  objectRef: string;
  scopeLabel: string;
  priority: Priority;
  dueAt: string | null;
  createdAt: string;
}

interface ContentStats {
  draftCount: number;
  inReviewCount: number;
  publishedCount: number;
  recheckCount: number;
  factCount: number;
  openConflictCount: number;
  assetCount: number;
  callsLast7d: number;
  performanceSourceCount: number;
}

interface HealthIssue {
  issueKey: string;
  issueLabel: string;
  affectedCount: number;
  totalCount: number;
}

interface Activity {
  activityId: string;
  actorName: string;
  actorKind: 'user' | 'agent' | 'system';
  action: string;
  objectRef: string;
  occurredAt: string;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockTodosData: TodoItem[] = [
  { todoId: 'T-301', kind: 'conflict', title: 'BL-R600 防护等级 IP66 / IP65 取值冲突', objectRef: 'CF-018', scopeLabel: '北岭智造 · 欧盟', priority: 'high', dueAt: '2026-11-20', createdAt: '2026-11-18 18:44' },
  { todoId: 'T-302', kind: 'review', title: 'BL-R600 Product Brief（en-US）送审', objectRef: 'C-1002 v3', scopeLabel: '北岭智造 · 欧盟', priority: 'high', dueAt: '2026-11-21', createdAt: '2026-11-19 08:12' },
  { todoId: 'T-303', kind: 'recheck', title: '交付周期 10 周 → 12 周，正文引用需复核', objectRef: 'C-1003', scopeLabel: '北岭智造 · 欧盟', priority: 'medium', dueAt: '2026-11-22', createdAt: '2026-11-19 08:31' },
  { todoId: 'T-304', kind: 'sync_error', title: '飞书云空间鉴权过期，3 个资产未能同步', objectRef: 'CON-feishu', scopeLabel: '集团', priority: 'medium', dueAt: null, createdAt: '2026-11-19 06:10' },
  { todoId: 'T-305', kind: 'rights_expiring', title: '展会现场照片授权 12 天后到期，被 4 条内容引用', objectRef: 'A-2207', scopeLabel: '北岭智造 · 全部区域', priority: 'low', dueAt: '2026-12-01', createdAt: '2026-11-18 09:00' },
  { todoId: 'T-306', kind: 'review', title: 'HC-RV200 Technical FAQ（de-DE）送审', objectRef: 'C-1011 v1', scopeLabel: '汉川传动 · 欧盟', priority: 'medium', dueAt: '2026-11-23', createdAt: '2026-11-18 16:20' },
];

const mockContentStats: ContentStats = {
  draftCount: 18,
  inReviewCount: 5,
  publishedCount: 214,
  recheckCount: 7,
  factCount: 1286,
  openConflictCount: 3,
  assetCount: 3412,
  callsLast7d: 54344,
  performanceSourceCount: 3,
};

const mockHealthIssuesData: HealthIssue[] = [
  { issueKey: 'expired_fact', issueLabel: '引用了过期事实', affectedCount: 6, totalCount: 214 },
  { issueKey: 'missing_locale', issueLabel: '缺少区域应有语种', affectedCount: 23, totalCount: 214 },
  { issueKey: 'missing_summary', issueLabel: '缺少机器可读摘要', affectedCount: 31, totalCount: 214 },
  { issueKey: 'broken_asset', issueLabel: '资产源已删除或授权到期', affectedCount: 4, totalCount: 214 },
  { issueKey: 'missing_jsonld', issueLabel: '结构化标注不完整', affectedCount: 12, totalCount: 214 },
];

const mockActivitiesData: Activity[] = [
  { activityId: 'AC-1', actorName: '何静', actorKind: 'user', action: '通过审核并生效', objectRef: 'C-1004 HC-RV200 精密减速机产品说明 v2', occurredAt: '09:12' },
  { activityId: 'AC-2', actorName: 'GEO Agent', actorKind: 'agent', action: '经 MCP 创建草稿（代表 林悦）', objectRef: 'C-1015 BL-R600 FAQ: IP rating', occurredAt: '08:55' },
  { activityId: 'AC-3', actorName: '系统', actorKind: 'system', action: '知识库同步：事实变更 3 条，生成复核 2 条', objectRef: 'SYNC-2431', occurredAt: '07:40' },
  { activityId: 'AC-4', actorName: '王拓', actorKind: 'user', action: '处理冲突：拆分适用范围（标准版 / 防爆版）', objectRef: 'CF-017', occurredAt: '昨天 18:02' },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取我的待办 [GET] /api/v1/workbench/todos
function handleFetchTodos(params: { kind: TodoKind | 'all' }) {
  console.log('fetch todos', params);
}

// ACTION: 获取最近活动 [GET] /api/v1/workbench/activities
function handleFetchActivities(params: { limit: number }) {
  console.log('fetch activities', params);
}

// ── 主组件 ────────────────────────────────────────────────
// 整体流程（静态配置）：一条主线 + 引用源 + 统一审批，点击进入对应页面
const OVERVIEW_LANES: { lane: string; note: string; steps: { label: string; to: string }[] }[] = [
  {
    lane: '内容主线',
    note: '生产出的稿件进自产内容；送审时定好渠道和集合，审批通过后上架内容市场；外部内容只用作引用或纳管',
    steps: [
      { label: '选题', to: '/production/topics' },
      { label: 'AI 生成 / 一稿多用 / 翻译', to: '/production/generate' },
      { label: '自产内容', to: '/content' },
      { label: '审批中心', to: '/review' },
      { label: '发布（生效 / 批次）', to: '/content/releases' },
      { label: '内容市场', to: '/market' },
      { label: '对接方按渠道 / 集合取用：KDH · 产品平台 · 社媒 · Agent', to: '/market' },
    ],
  },
  {
    lane: '事实',
    note: '外部事实全量导入或用到才存；冲突在同步时或引用时发现，裁定后进入事实库供后续引用，回写 KDH 也走审批',
    steps: [
      { label: '上游接入（全量 / 用到才存）', to: '/integrations' },
      { label: '冲突处理', to: '/facts/conflicts' },
      { label: '事实库（后续引用取此值）', to: '/facts' },
      { label: '事实发布审批', to: '/review' },
      { label: '回写 KDH', to: '/integrations' },
    ],
  },
  {
    lane: '审批',
    note: '内容发布 · 事实发布 · 批次发布 · 上架与推送，同一套审批；引擎可换成外部标准化审批产品',
    steps: [
      { label: '各页面提交申请', to: '/review' },
      { label: '按事项匹配审批流程', to: '/settings/approvals' },
      { label: '审批中心逐级处理', to: '/review' },
      { label: '通过后自动执行', to: '/review' },
    ],
  },
];

export default function Workbench() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<TodoKind | 'all'>('all');
  const todos = kind === 'all' ? mockTodosData : mockTodosData.filter((t) => t.kind === kind);
  const s = mockContentStats;

  const kpis = [
    { label: '待我处理', value: mockTodosData.length, hint: `其中高优先级 ${mockTodosData.filter((t) => t.priority === 'high').length} 项` },
    { label: '审批中 / 待复核', value: `${s.inReviewCount} / ${s.recheckCount}`, hint: `草稿 ${s.draftCount} · 已生效 ${s.publishedCount}` },
    { label: '未处理冲突', value: s.openConflictCount, hint: `事实总数 ${s.factCount.toLocaleString()}` },
    { label: '近 7 天调用', value: s.callsLast7d.toLocaleString(), hint: `资产 ${s.assetCount.toLocaleString()} 个` },
  ];

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="工作台"
        description="早上好，陈立。冲突、待审、复核、同步异常和授权到期统一汇集在这里。"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/content/edit/new')}>
              <FilePlus2 /> 新建内容
            </Button>
            <Button onClick={() => navigate('/production/generate')}>
              <Sparkles /> AI 生成
            </Button>
          </>
        }
      />

      <Card size="sm">
        <CardHeader>
          <CardTitle>整体流程</CardTitle>
          <CardDescription>CMS 只做内容生产与统一管理，上游和下游都对接其他平台。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {OVERVIEW_LANES.map((l) => (
            <div key={l.lane} className="grid gap-1.5 md:grid-cols-[72px_1fr]">
              <div className="pt-1 text-xs font-medium text-muted-foreground">{l.lane}</div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1">
                  {l.steps.map((st, i) => (
                    <span key={st.label} className="inline-flex items-center gap-1">
                      <button onClick={() => navigate(st.to)} className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs hover:border-primary/50 hover:bg-muted">
                        {st.label}
                      </button>
                      {i < l.steps.length - 1 && <ChevronRight className="size-3.5 text-muted-foreground" />}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">{l.note}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} size="sm">
            <CardHeader>
              <CardDescription>{k.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{k.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{k.hint}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>我的待办</CardTitle>
            <CardDescription>按优先级与到期时间排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs
              value={kind}
              onValueChange={(v) => {
                setKind(v as TodoKind | 'all');
                handleFetchTodos({ kind: v as TodoKind | 'all' });
              }}
            >
              <TabsList>
                <TabsTrigger value="all">全部 {mockTodosData.length}</TabsTrigger>
                {(Object.keys(TODO_KIND_CONFIG) as TodoKind[]).map((k) => (
                  <TabsTrigger key={k} value={k}>
                    {TODO_KIND_CONFIG[k].label} {mockTodosData.filter((t) => t.kind === k).length}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">类型</TableHead>
                  <TableHead>事项</TableHead>
                  <TableHead className="w-36">范围</TableHead>
                  <TableHead className="w-14">优先级</TableHead>
                  <TableHead className="w-24">期限</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todos.map((t) => (
                  <TableRow key={t.todoId} className="cursor-pointer" onClick={() => navigate(TODO_KIND_CONFIG[t.kind].path)}>
                    <TableCell>
                      <ToneBadge tone={TODO_KIND_CONFIG[t.kind].tone}>{TODO_KIND_CONFIG[t.kind].label}</ToneBadge>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.objectRef} · {t.createdAt}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.scopeLabel}</TableCell>
                    <TableCell>
                      <ToneBadge tone={PRIORITY_CONFIG[t.priority].tone}>{PRIORITY_CONFIG[t.priority].label}</ToneBadge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{t.dueAt ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>内容健康度</CardTitle>
              <CardDescription>已生效内容 {s.publishedCount} 条</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" onClick={() => navigate('/content')}>
                  自产内容
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockHealthIssuesData.map((h) => (
                <div key={h.issueKey} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{h.issueLabel}</span>
                    <span className="tabular-nums text-muted-foreground">{h.affectedCount} 条</span>
                  </div>
                  <Progress value={(h.affectedCount / h.totalCount) * 100} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>最近活动</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" onClick={() => handleFetchActivities({ limit: 20 })}>
                  更多
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockActivitiesData.map((a) => (
                <div key={a.activityId} className="flex gap-2 text-sm">
                  <ToneBadge tone={a.actorKind === 'agent' ? 'violet' : a.actorKind === 'system' ? 'gray' : 'blue'} className="mt-0.5">
                    {a.actorKind === 'agent' ? 'Agent' : a.actorKind === 'system' ? '系统' : '人'}
                  </ToneBadge>
                  <div className="min-w-0">
                    <div>
                      <span className="font-medium">{a.actorName}</span> {a.action}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.objectRef} · {a.occurredAt}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
