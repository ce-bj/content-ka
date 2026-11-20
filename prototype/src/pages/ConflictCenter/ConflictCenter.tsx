import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Info, Lightbulb, Star } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { EvidenceBadge, ToneBadge, type EvidenceGrade, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';
import { notify } from '@/components/shared/toast';
import { ROLE_CONFIG, accessOf } from '@/components/layout/access';
import { approvalOf, factPublishAction, nowLabel, RED_LINE_ATTRIBUTES, useDemo, type DiscoveredConflict } from '@/lib/demo-store';

// ── 配置常量 ──────────────────────────────────────────────
const KIND_CONFIG = {
  fact_fact: { label: '① 事实 vs 事实', short: '事实冲突', tone: 'red' as Tone },
  content_fact: { label: '② 内容 vs 事实', short: '内容与事实', tone: 'violet' as Tone },
  content_content: { label: '③ 内容 vs 内容', short: '内容之间', tone: 'blue' as Tone },
  expired: { label: '④ 时效', short: '已过期', tone: 'amber' as Tone },
  sync: { label: '⑤ 同步冲突', short: '双方都改了', tone: 'red' as Tone },
} as const;
type ConflictKind = keyof typeof KIND_CONFIG;

const ACTION_CONFIG = {
  adopt: { label: '采纳其中一条', hint: '另一条标记为「已被替代」，保留历史，不再可引用' },
  split_scope: { label: '拆分适用范围', hint: '两条都保留，补上区分维度（型号 / 区域 / 测试标准）' },
  pause_all: { label: '都暂停引用', hint: '两条都不可用于对外发布，直到补齐证据' },
  request_source_fix: { label: '发起源系统修正', hint: '源系统事实只读时，生成修正任务给源系统负责人' },
} as const;
type ResolveAction = keyof typeof ACTION_CONFIG;

const DIMENSION_OPTIONS = [
  { value: 'variant', label: '型号 / 配置' },
  { value: 'region', label: '区域 / 市场' },
  { value: 'standard', label: '测试标准 / 条件' },
  { value: 'effective', label: '生效时间（版本更替）' },
];

// ── 类型 ──────────────────────────────────────────────────
interface ConflictMember {
  memberId: string;
  memberKind: 'fact' | 'content';
  valueLabel: string;
  sourceLabel: string;
  originLabel: string;
  evidenceGrade: EvidenceGrade | null;
  validTo: string | null;
  scopeLabel: string;
  updatedBy: string;
  updatedAt: string;
  referencedCount: number;
}
interface Conflict {
  conflictId: string;
  kind: ConflictKind;
  subjectName: string;
  attributeName: string;
  members: ConflictMember[];
  recommendedMemberId: string | null;
  recommendationRule: string | null;
  recommendationDetail: string | null;
  falseConflictHint: string | null;
  impactedContents: { contentId: string; title: string; refMode: 'slot' | 'inline'; contentStatus: string }[];
  status: 'open' | 'resolved';
  detectedAt: string;
  detectedBy: string;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockConflictsData: Conflict[] = [
  {
    conflictId: 'CF-018',
    kind: 'fact_fact',
    subjectName: 'BL-R600 六轴工业机器人',
    attributeName: '防护等级',
    members: [
      { memberId: 'F-002', memberKind: 'fact', valueLabel: 'IP66', sourceLabel: 'TÜV 检测报告 TÜV-2026-1188', originLabel: '文档解析 → 中台确认', evidenceGrade: 'A', validTo: '2028-02-28', scopeLabel: '欧盟 · 型号未指定', updatedBy: '王拓', updatedAt: '2026-03-02', referencedCount: 6 },
      { memberId: 'F-003', memberKind: 'fact', valueLabel: 'IP65', sourceLabel: '产品手册（2024 版）第 4.2 节', originLabel: 'KDH（来自 PIM）', evidenceGrade: 'B', validTo: '2026-12-31', scopeLabel: '中国大陆 / 欧盟 · 型号未指定', updatedBy: '系统', updatedAt: '2024-05-01', referencedCount: 3 },
    ],
    recommendedMemberId: 'F-002',
    recommendationRule: '规则 1：属性的权威来源优先（认证与检测类 → 检测报告 / 证书）',
    recommendationDetail: 'F-002 来自第三方检测报告且证据等级更高（A > B），生效日期更新。',
    falseConflictHint: '两条都未指定型号。若 IP65 实为旧款或防爆版取值，可选「拆分适用范围」。',
    impactedContents: [
      { contentId: 'C-1002', title: 'BL-R600 Product Brief', refMode: 'inline', contentStatus: '审核中' },
      { contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', refMode: 'slot', contentStatus: '已生效' },
      { contentId: 'C-1015', title: 'BL-R600 FAQ: IP rating', refMode: 'inline', contentStatus: '草稿' },
      { contentId: 'C-0921', title: 'BL-R600 产品手册摘要（中文）', refMode: 'slot', contentStatus: '已生效' },
    ],
    status: 'open',
    detectedAt: '2026-11-18 18:44',
    detectedBy: 'KDH 同步时检测',
  },
  {
    conflictId: 'CF-021',
    kind: 'sync',
    subjectName: 'BL-R600 六轴工业机器人',
    attributeName: '标准交付周期',
    members: [
      { memberId: 'F-007@cms', memberKind: 'fact', valueLabel: '8 周', sourceLabel: '中台修改（市场部促销承诺）', originLabel: '中台', evidenceGrade: 'B', validTo: '2027-02-28', scopeLabel: '欧盟', updatedBy: 'Sophie Wei', updatedAt: '2026-11-19 07:20', referencedCount: 2 },
      { memberId: 'F-007@kdh', memberKind: 'fact', valueLabel: '12 周', sourceLabel: '知识库（ERP 季度公告修订）', originLabel: '知识库', evidenceGrade: 'B', validTo: '2027-02-28', scopeLabel: '中国大陆 / 欧盟', updatedBy: 'ERP 同步', updatedAt: '2026-11-19 07:35', referencedCount: 2 },
    ],
    recommendedMemberId: 'F-007@kdh',
    recommendationRule: '同步方向：交付类「以知识库为准」；交期属于红线字段',
    recommendationDetail: '交期属于承诺类红线字段，需人工确认；ERP 为交付周期的权威来源。',
    falseConflictHint: null,
    impactedContents: [
      { contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', refMode: 'inline', contentStatus: '已生效' },
      { contentId: 'C-1002', title: 'BL-R600 Product Brief', refMode: 'slot', contentStatus: '审核中' },
    ],
    status: 'resolved',
    detectedAt: '2026-11-19 07:40',
    detectedBy: '知识库双向同步',
  },
  {
    conflictId: 'CF-022',
    kind: 'content_fact',
    subjectName: 'HC-RV200 精密减速机',
    attributeName: '额定扭矩',
    members: [
      { memberId: 'C-1011', memberKind: 'content', valueLabel: '1000 N·m', sourceLabel: '内容 C-1011 正文第 2 段（AI 抽取的声明）', originLabel: '内容', evidenceGrade: null, validTo: null, scopeLabel: '欧盟 · de-DE', updatedBy: '林悦', updatedAt: '2026-11-18 16:20', referencedCount: 0 },
      { memberId: 'F-031', memberKind: 'fact', valueLabel: '1200 N·m', sourceLabel: '型式试验报告 HC-TR-2025-088', originLabel: '知识库', evidenceGrade: 'A', validTo: '2028-01-01', scopeLabel: '全部区域', updatedBy: '系统', updatedAt: '2025-07-01', referencedCount: 8 },
    ],
    recommendedMemberId: 'F-031',
    recommendationRule: '内容声明须与事实一致',
    recommendationDetail: '建议把正文改为引用事实标签，避免手写数值。',
    falseConflictHint: '若正文指的是「持续扭矩」而非「额定扭矩」，请在内容中改用对应属性。',
    impactedContents: [{ contentId: 'C-1011', title: 'HC-RV200 Technical FAQ（de-DE）', refMode: 'inline', contentStatus: '审核中' }],
    status: 'open',
    detectedAt: '2026-11-18 16:21',
    detectedBy: '保存草稿时声明抽取',
  },
  {
    conflictId: 'CF-016',
    kind: 'expired',
    subjectName: 'HC-SD75 伺服驱动器',
    attributeName: 'UL 认证',
    members: [
      { memberId: 'F-014', memberKind: 'fact', valueLabel: 'UL 61800-5-1', sourceLabel: 'UL 证书 E512340', originLabel: '知识库', evidenceGrade: 'B', validTo: '2026-09-30', scopeLabel: '北美', updatedBy: '系统', updatedAt: '2024-02-01', referencedCount: 2 },
    ],
    recommendedMemberId: null,
    recommendationRule: null,
    recommendationDetail: null,
    falseConflictHint: null,
    impactedContents: [{ contentId: 'C-0877', title: 'HC-SD75 Servo Drive Datasheet', refMode: 'slot', contentStatus: '已生效' }],
    status: 'open',
    detectedAt: '2026-10-01 08:00',
    detectedBy: '每日到期巡检',
  },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取冲突列表 [GET] /api/v1/conflicts
function handleFetchConflicts(params: { kind: ConflictKind | 'all'; status: 'open' | 'resolved' }) {
  console.log('fetch conflicts', params);
}

// ACTION: 处理冲突 [POST] /api/v1/conflicts/{id}/resolve
function handleResolveConflict(conflictId: string, body: { action: ResolveAction; adoptedMemberId: string | null; splitDimension: string | null; note: string }) {
  console.log('resolve', conflictId, body);
}

// 使用中发现的冲突（演示状态）→ 冲突队列中的一条
function fromDiscovered(d: DiscoveredConflict): Conflict {
  const ext = `${d.externalId}`;
  return {
    conflictId: d.conflictId,
    kind: 'fact_fact',
    subjectName: d.subjectName,
    attributeName: d.attributeName,
    members: [
      { memberId: d.localFactId, memberKind: 'fact', valueLabel: d.localValue, sourceLabel: d.localSource, originLabel: '事实库（已入库）', evidenceGrade: 'B', validTo: '2027-02-28', scopeLabel: '全部区域', updatedBy: '系统', updatedAt: '2026-08-01', referencedCount: 5 },
      { memberId: ext, memberKind: 'fact', valueLabel: d.externalValue, sourceLabel: d.externalSource, originLabel: 'KDH（用到才存，未入库）', evidenceGrade: 'B', validTo: null, scopeLabel: '全部区域', updatedBy: 'KDH', updatedAt: '—', referencedCount: 0 },
    ],
    recommendedMemberId: d.recommendExternal ? ext : d.localFactId,
    recommendationRule: d.recommendExternal ? '同一权威来源（ERP）的较新版本优先' : '权威来源优先：主数据 > 培训资料',
    recommendationDetail: d.recommendExternal ? 'KDH 中的取值来自更新的 ERP 交期表，事实库的取值可能已过期。' : '片段来自 2024 年培训手册，事实库取自 PIM 主数据。',
    falseConflictHint: null,
    impactedContents: [],
    status: 'open',
    detectedAt: d.discoveredAt,
    detectedBy: `使用中发现 · ${d.discoveredBy}在${d.discoveredIn}时`,
  };
}

// ── 主组件 ────────────────────────────────────────────────
export default function ConflictCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: demo, dispatch } = useDemo();
  const allConflicts = [...demo.discovered.map(fromDiscovered), ...mockConflictsData];
  const canResolve = ['full', 'scoped'].includes(accessOf(demo.role, 'conflicts'));
  const [kind, setKind] = useState<ConflictKind | 'all'>('all');
  const initialId = (location.state as { conflictId?: string } | null)?.conflictId ?? allConflicts[0].conflictId;
  const [selectedId, setSelectedId] = useState<string>(initialId);
  const [action, setAction] = useState<ResolveAction>('adopt');
  const [adopted, setAdopted] = useState<string | null>(allConflicts.find((x) => x.conflictId === initialId)?.recommendedMemberId ?? null);
  const [dimension, setDimension] = useState('variant');
  const [note, setNote] = useState('');
  const resolved = [...mockConflictsData.filter((x) => x.status === 'resolved').map((x) => x.conflictId), ...Object.keys(demo.conflicts)];

  const list = allConflicts.filter((c) => kind === 'all' || c.kind === kind);
  const c = allConflicts.find((x) => x.conflictId === selectedId)!;

  const select = (id: string) => {
    const next = allConflicts.find((x) => x.conflictId === id)!;
    setSelectedId(id);
    setAdopted(next.recommendedMemberId);
    setAction(next.kind === 'expired' ? 'request_source_fix' : 'adopt');
    setNote('');
  };

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="冲突处理"
        description="冲突有两种发现时机：全量导入的事实在同步时比对；用到才存的外部内容事先不知道冲不冲突，在生产引用时比对发现。系统按「权威来源 → 证据等级 → 生效时间」推荐取值，先排除范围不同造成的假冲突；裁定结果立即进入事实库供后续引用，回写 KDH 走事实发布审批；引用了被替代取值的内容自动进入复核。"
      />

      <Tabs
        value={kind}
        onValueChange={(v) => {
          setKind(v as ConflictKind | 'all');
          handleFetchConflicts({ kind: v as ConflictKind | 'all', status: 'open' });
        }}
      >
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">全部 {allConflicts.length}</TabsTrigger>
          {(Object.keys(KIND_CONFIG) as ConflictKind[]).map((k) => (
            <TabsTrigger key={k} value={k}>
              {KIND_CONFIG[k].label} {allConflicts.filter((x) => x.kind === k).length}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        {/* 队列 */}
        <div className="space-y-2">
          {list.map((x) => (
            <button
              key={x.conflictId}
              onClick={() => select(x.conflictId)}
              className={cn('w-full rounded-xl border bg-background p-3 text-left hover:bg-muted/50', selectedId === x.conflictId && 'border-primary ring-2 ring-primary/20')}
            >
              <div className="flex items-center gap-2">
                <ToneBadge tone={KIND_CONFIG[x.kind].tone}>{KIND_CONFIG[x.kind].short}</ToneBadge>
                {resolved.includes(x.conflictId) && <ToneBadge tone="green">已处理</ToneBadge>}
                <span className="ml-auto text-xs text-muted-foreground">{x.conflictId}</span>
              </div>
              <div className="mt-1.5 font-medium">
                {x.subjectName.split(' ')[0]} · {x.attributeName}
              </div>
              <div className="text-sm text-muted-foreground">{x.members.map((m) => m.valueLabel).join(' / ')}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {x.detectedBy.startsWith('使用中') ? <ToneBadge tone="amber">使用中发现</ToneBadge> : <span>{x.detectedBy}</span>}
                <span>· 影响 {x.impactedContents.length} 条内容 · {x.detectedAt}</span>
              </div>
            </button>
          ))}
        </div>

        {/* 处理面板 */}
        <Card>
          <CardHeader>
            <CardTitle>
              {c.subjectName} · {c.attributeName}
            </CardTitle>
            <CardDescription>
              {KIND_CONFIG[c.kind].label} · {c.detectedBy} · {c.detectedAt}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {c.falseConflictHint && (
              <Alert>
                <Info />
                <AlertTitle>可能不是冲突</AlertTitle>
                <AlertDescription>{c.falseConflictHint}</AlertDescription>
              </Alert>
            )}

            <div className={cn('grid gap-3', c.members.length > 1 && 'md:grid-cols-2')}>
              {c.members.map((m) => {
                const rec = m.memberId === c.recommendedMemberId;
                return (
                  <div key={m.memberId} className={cn('rounded-xl border p-4', rec && 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20')}>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-semibold">{m.valueLabel}</span>
                      {rec && (
                        <ToneBadge tone="green">
                          <Star className="size-3" /> 推荐
                        </ToneBadge>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        {m.evidenceGrade ? <EvidenceBadge grade={m.evidenceGrade} /> : <ToneBadge tone="gray">内容声明</ToneBadge>}
                        <span>{m.sourceLabel}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {m.memberId} · {m.originLabel}
                      </div>
                      <div className="text-muted-foreground">适用：{m.scopeLabel}</div>
                      {m.validTo && <div className="text-muted-foreground">有效期至 {m.validTo}</div>}
                      <div className="text-muted-foreground">
                        {m.updatedBy} · {m.updatedAt} · 被引用 {m.referencedCount}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {c.recommendationRule && (
              <div className="flex gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <div>
                  <div className="font-medium">{c.recommendationRule}</div>
                  <div className="text-muted-foreground">{c.recommendationDetail}</div>
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-sm font-medium">受影响的内容（{c.impactedContents.length}）</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容</TableHead>
                    <TableHead>引用方式</TableHead>
                    <TableHead>处理后</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.impactedContents.map((ic) => (
                    <TableRow key={ic.contentId} className="cursor-pointer" onClick={() => navigate(`/content/edit/${ic.contentId}`)}>
                      <TableCell>
                        {ic.title}
                        <div className="text-xs text-muted-foreground">{ic.contentId}</div>
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={ic.refMode === 'slot' ? 'teal' : 'violet'}>{ic.refMode === 'slot' ? '插槽' : '正文'}</ToneBadge>
                      </TableCell>
                      <TableCell className="text-xs">{ic.refMode === 'slot' ? '自动刷新，生成新版本' : '进入复核队列'}</TableCell>
                      <TableCell className="text-xs">{ic.contentStatus}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {resolved.includes(c.conflictId) ? (
              <Alert>
                <CheckCircle2 />
                <AlertTitle>已处理</AlertTitle>
                <AlertDescription>
                  {demo.conflicts[c.conflictId] && (
                    <div>
                      {demo.conflicts[c.conflictId].resolvedBy} · {demo.conflicts[c.conflictId].resolvedAt} ·{' '}
                      {demo.conflicts[c.conflictId].action === 'adopt' ? `采纳 ${demo.conflicts[c.conflictId].adoptedValue}` : ACTION_CONFIG[demo.conflicts[c.conflictId].action].label} · 依据：{demo.conflicts[c.conflictId].note}
                    </div>
                  )}
                  {(() => {
                    const ap = approvalOf(demo, 'fact', c.conflictId);
                    return (
                      <div className="mt-1 space-y-1">
                        <div>① 裁定结果已进入事实库，后续生产引用取这个值；正文引用的 {c.impactedContents.filter((x) => x.refMode === 'inline').length} 条内容已生成复核任务。</div>
                        <div className="flex flex-wrap items-center gap-2">
                          ② 回写 KDH：
                          {ap ? (
                            <>
                              <ToneBadge tone={ap.status === 'approved' ? 'green' : ap.status === 'rejected' ? 'red' : 'blue'}>{ap.status === 'approved' ? '已回写' : ap.status === 'rejected' ? '审批驳回' : '事实发布审批中'}</ToneBadge>
                              <Button size="xs" variant="outline" onClick={() => navigate('/review', { state: { taskId: ap.taskId } })}>
                                查看审批 {ap.taskId}
                              </Button>
                            </>
                          ) : (
                            <span>已同步</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3 rounded-xl border p-4">
                <div className="text-sm font-medium">处理方式</div>
                <RadioGroup value={action} onValueChange={(v) => setAction(v as ResolveAction)} className="grid gap-2 md:grid-cols-2">
                  {(Object.keys(ACTION_CONFIG) as ResolveAction[]).map((a) => (
                    <Label key={a} className={cn('flex items-start gap-2 rounded-lg border p-3 font-normal', action === a && 'border-primary bg-muted/40')}>
                      <RadioGroupItem value={a} className="mt-0.5" />
                      <div>
                        <div className="font-medium">{ACTION_CONFIG[a].label}</div>
                        <div className="text-xs text-muted-foreground">{ACTION_CONFIG[a].hint}</div>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>

                {action === 'adopt' && c.members.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    采纳：
                    {c.members.map((m) => (
                      <Button key={m.memberId} size="sm" variant={adopted === m.memberId ? 'default' : 'outline'} onClick={() => setAdopted(m.memberId)}>
                        {m.valueLabel}（{m.memberId}）
                      </Button>
                    ))}
                  </div>
                )}
                {action === 'split_scope' && (
                  <div className="flex items-center gap-2 text-sm">
                    区分维度
                    <Select items={DIMENSION_OPTIONS} value={dimension} onValueChange={(v) => setDimension(v as string)}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIMENSION_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Textarea placeholder="处理依据（必填，记录到决策日志）" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!canResolve && (
                    <span className="mr-auto text-xs text-amber-700">
                      当前角色「{ROLE_CONFIG[demo.role].label}」只读。
                      <button className="ml-1 underline" onClick={() => dispatch({ type: 'setRole', role: 'fact_owner' })}>
                        切换为事实负责人 · 王拓
                      </button>
                    </span>
                  )}
                  <Button
                    disabled={!canResolve || !note.trim()}
                    onClick={() => {
                      handleResolveConflict(c.conflictId, { action, adoptedMemberId: action === 'adopt' ? adopted : null, splitDimension: action === 'split_scope' ? dimension : null, note });
                      const adoptedValue = c.members.find((m) => m.memberId === adopted)?.valueLabel ?? null;
                      dispatch({ type: 'resolveConflict', resolution: { conflictId: c.conflictId, action, adoptedValue: action === 'adopt' ? adoptedValue : null, note, resolvedBy: ROLE_CONFIG[demo.role].person, resolvedAt: `今天 ${nowLabel()}` } });
                      const other = c.members.find((m) => m.memberId !== adopted)?.valueLabel ?? '';
                      const fp = factPublishAction(demo, { conflictId: c.conflictId, subjectName: c.subjectName.split(' ')[0], attributeName: c.attributeName, before: action === 'adopt' ? other : c.members.map((m) => m.valueLabel).join(' / '), after: action === 'adopt' ? adoptedValue ?? '' : ACTION_CONFIG[action].label, person: ROLE_CONFIG[demo.role].person, redLine: RED_LINE_ATTRIBUTES.includes(c.attributeName) });
                      dispatch(fp.action);
                      notify(`${c.conflictId} 已裁定，结果进入事实库，后续引用取此值；受影响的 ${c.impactedContents.length} 条内容已刷新或进入复核。回写 KDH 的事实发布申请 ${fp.taskId} 已提交审批`);
                    }}
                  >
                    确认处理
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
