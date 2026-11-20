import { useState } from 'react';
import { Bot, Download, Search, ShieldAlert, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ToneBadge, type Tone } from '@/components/shared/status';

// ── 配置常量 ──────────────────────────────────────────────
const ACTOR_KIND_CONFIG = {
  user: { label: '成员', icon: User },
  ai: { label: 'AI', icon: Bot },
  system: { label: '系统 / 同步', icon: ShieldAlert },
  mcp: { label: 'MCP 调用方', icon: Bot },
} as const;
type ActorKind = keyof typeof ACTOR_KIND_CONFIG;
const ACTION_CATEGORY_OPTIONS = [
  { value: 'all', label: '全部操作' },
  { value: 'content', label: '内容' },
  { value: 'fact', label: '事实' },
  { value: 'review', label: '审核与发布' },
  { value: 'permission', label: '权限与密钥' },
  { value: 'model', label: '内容模型' },
];
const ACTOR_OPTIONS = [
  { value: 'all', label: '全部操作者' },
  { value: 'user', label: '成员' },
  { value: 'ai', label: 'AI' },
  { value: 'system', label: '系统 / 同步' },
  { value: 'mcp', label: 'MCP 调用方' },
];
const RISK_TONE: Record<'normal' | 'sensitive' | 'red_line', Tone> = { normal: 'gray', sensitive: 'amber', red_line: 'red' };
const RISK_LABEL: Record<'normal' | 'sensitive' | 'red_line', string> = { normal: '一般', sensitive: '敏感', red_line: '红线' };

// ── 类型 ──────────────────────────────────────────────────
interface TraceStep {
  stepId: string;
  occurredAt: string;
  system: 'KDH' | 'CMS' | '对接平台';
  actor: string;
  action: string;
  objectRef: string;
}
interface AuditEntry {
  eventId: string;
  occurredAt: string;
  actorKind: ActorKind;
  actorName: string;
  actionLabel: string;
  category: string;
  targetLabel: string;
  risk: 'normal' | 'sensitive' | 'red_line';
  ipAddress: string | null;
  before: string | null;
  after: string | null;
  reason: string | null;
}

// ── 动态数据（DataSlot）──────────────────────────────────
// PAGINATION: page,pageSize
const mockAuditLogsData: AuditEntry[] = [
  { eventId: 'EV-90398', occurredAt: '2026-11-19 09:58:41', actorKind: 'ai', actorName: 'AI 生成（模板 TPL-02）', actionLabel: '生成草稿', category: 'content', targetLabel: 'C-1060 BL-R600 技术 FAQ（一稿多用）', risk: 'normal', ipAddress: null, before: null, after: 'v1 草稿，引用事实 5 条，知识库片段 2 段', reason: '由林悦发起的一稿多用任务 RP-0218' },
  { eventId: 'EV-90360', occurredAt: '2026-11-19 09:31:55', actorKind: 'mcp', actorName: 'GEO Agent', actionLabel: '读取被拒（403）', category: 'permission', targetLabel: 'price_list.guide_price', risk: 'sensitive', ipAddress: '52.81.4.10', before: null, after: null, reason: '调用方授权范围不含价格字段' },
  { eventId: 'EV-90344', occurredAt: '2026-11-19 09:12:30', actorKind: 'user', actorName: '何静（合规审核）', actionLabel: '添加审核意见', category: 'review', targetLabel: 'C-1011 HC-RV200 Technical FAQ（de-DE）', risk: 'normal', ipAddress: '10.2.8.77', before: null, after: '要求改正文扭矩数值', reason: '正文写的额定扭矩 1000 N·m 与事实 1200 N·m 不一致（CF-022）' },
  { eventId: 'EV-90321', occurredAt: '2026-11-19 08:50:16', actorKind: 'user', actorName: '孙铭（平台管理员）', actionLabel: '轮换密钥', category: 'permission', targetLabel: '调用方：经销商门户', risk: 'sensitive', ipAddress: '10.2.1.5', before: 'key …a91f', after: 'key …7c02', reason: '季度例行轮换' },
  { eventId: 'EV-90302', occurredAt: '2026-11-19 08:30:15', actorKind: 'user', actorName: '王拓（事实负责人）', actionLabel: '处理冲突 · 采纳', category: 'fact', targetLabel: 'CF-021 · F-007 标准交付周期', risk: 'red_line', ipAddress: '10.2.14.31', before: '中台 8 周 / 知识库 12 周', after: '12 周（采纳知识库值，已同步回知识库）', reason: 'ERP 是交付周期的权威来源；8 周来自市场部促销口径，无供应链依据。红线字段，人工确认' },
  { eventId: 'EV-90288', occurredAt: '2026-11-19 07:40:02', actorKind: 'system', actorName: '知识库同步', actionLabel: '同步冲突', category: 'fact', targetLabel: 'F-007 标准交付周期', risk: 'sensitive', ipAddress: null, before: '中台 8 周（07:20）', after: '知识库 12 周（07:35）', reason: '双方都改了，已生成冲突 CF-021' },
];

const mockFactTraceData: TraceStep[] = [
  { stepId: 'T1', occurredAt: '07:35', system: 'KDH', actor: 'ERP 同步', action: 'F-007 标准交付周期改为 12 周', objectRef: 'F-007' },
  { stepId: 'T2', occurredAt: '07:40', system: 'CMS', actor: '知识库同步', action: '与中台的 8 周冲突，生成 CF-021', objectRef: 'CF-021' },
  { stepId: 'T3', occurredAt: '08:30', system: 'CMS', actor: '王拓（事实负责人）', action: '采纳 12 周，回写 KDH（红线人工确认）', objectRef: 'CF-021' },
  { stepId: 'T4', occurredAt: '08:30', system: 'CMS', actor: '自动化流程 FL-01', action: '插槽刷新 C-1002 参数表；C-1003 正文引用生成复核任务 RC-310', objectRef: 'C-1002 / C-1003' },
  { stepId: 'T5', occurredAt: '09:30', system: 'CMS', actor: '林悦', action: 'C-1003 v3 送审，红线字段“交付周期 10 → 12 周”', objectRef: 'RV-553' },
  { stepId: 'T6', occurredAt: '11-21 08:00', system: 'CMS', actor: '发布批次 RB-030', action: '欧盟交期口径统一（排期中）', objectRef: 'RB-030' },
  { stepId: 'T7', occurredAt: '发布后', system: '对接平台', actor: '欧盟官网（AI 门户）、SDR Agent', action: '收到 Webhook，取新版本（调用记录写入同一审计流）', objectRef: 'content.published' },
];

const mockAuditDetailData: AuditEntry = mockAuditLogsData[4];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 查询审计日志 [GET] /api/v1/audit-logs
function handleFetchAuditLogs(params: { keyword: string; category: string; actorKind: string; page: number; pageSize: number }) {
  console.log('fetch audit logs', params);
}

// ACTION: 获取审计详情 [GET] /api/v1/audit-logs/{eventId}
function handleFetchAuditDetail(eventId: string) {
  console.log('fetch detail', eventId);
}

// ACTION: 按事实追溯全链路 [GET] /api/v1/audit-logs/trace
function handleFetchTrace(params: { factId: string }) {
  console.log('fetch trace', params);
}

// ACTION: 导出审计日志 [POST] /api/v1/audit-logs/exports
function handleExportAuditLogs(params: { category: string; actorKind: string }) {
  alert('导出任务已创建，完成后通过站内信下载（导出本身也会记录审计）');
}

// ── 主组件 ────────────────────────────────────────────────
export default function AuditLog() {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [actor, setActor] = useState('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState(mockAuditDetailData.eventId);
  const rows = mockAuditLogsData.filter((r) => (actor === 'all' || r.actorKind === actor) && (category === 'all' || r.category === category) && (!keyword || r.targetLabel.includes(keyword) || r.actorName.includes(keyword)));
  const d = mockAuditLogsData.find((r) => r.eventId === detailId) ?? mockAuditDetailData;
  const query = (patch: Partial<{ keyword: string; category: string; actorKind: string }>) =>
    handleFetchAuditLogs({ keyword, category, actorKind: actor, page: 1, pageSize: 50, ...patch });

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="审计日志"
        description="谁在什么时候改了什么。成员、AI、同步任务、MCP 调用方的操作都记录在这里；红线和敏感操作单独标出。日志只追加，不可修改或删除。"
        actions={
          <Button variant="outline" onClick={() => handleExportAuditLogs({ category, actorKind: actor })}>
            <Download /> 导出
          </Button>
        }
      />

      <Tabs defaultValue="logs" onValueChange={(v) => v === 'trace' && handleFetchTrace({ factId: 'F-007' })}>
        <TabsList>
          <TabsTrigger value="logs">全部日志</TabsTrigger>
          <TabsTrigger value="trace">按事实追溯</TabsTrigger>
        </TabsList>
        <TabsContent value="logs" className="space-y-4 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 pl-8" placeholder="对象或操作者" value={keyword} onChange={(e) => { setKeyword(e.target.value); query({ keyword: e.target.value }); }} />
        </div>
        <Select items={ACTION_CATEGORY_OPTIONS} value={category} onValueChange={(v) => { setCategory(v as string); query({ category: v as string }); }}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_CATEGORY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={ACTOR_OPTIONS} value={actor} onValueChange={(v) => { setActor(v as string); query({ actorKind: v as string }); }}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTOR_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">保留 3 年 · 今日 1,284 条</span>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>操作者</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>对象</TableHead>
                <TableHead>变更</TableHead>
                <TableHead>级别</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const Icon = ACTOR_KIND_CONFIG[r.actorKind].icon;
                return (
                  <TableRow key={r.eventId} className="cursor-pointer" onClick={() => { setDetailId(r.eventId); setDetailOpen(true); handleFetchAuditDetail(r.eventId); }}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{r.occurredAt.slice(5)}</TableCell>
                    <TableCell className="text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="size-3.5 text-muted-foreground" />
                        {r.actorName}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{r.actionLabel}</TableCell>
                    <TableCell className="text-sm">{r.targetLabel}</TableCell>
                    <TableCell className="max-w-60 truncate text-xs text-muted-foreground">
                      {r.before || r.after ? `${r.before ?? '—'} → ${r.after ?? '—'}` : '—'}
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={RISK_TONE[r.risk]}>{RISK_LABEL[r.risk]}</ToneBadge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="mt-3 flex justify-end gap-1">
            <Button size="xs" variant="outline" disabled>
              上一页
            </Button>
            <Button size="xs" variant="outline" onClick={() => handleFetchAuditLogs({ keyword, category, actorKind: actor, page: 2, pageSize: 50 })}>
              下一页
            </Button>
          </div>
        </CardContent>
      </Card>

        </TabsContent>
        <TabsContent value="trace" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>F-007 标准交付周期 · BL-R600</CardTitle>
              <CardDescription>KDH 与 CMS 的事件写入平台同一审计流，可以从一条事实一路追到受影响的内容、审核、发布与调用。</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l pl-5">
                {mockFactTraceData.map((t) => (
                  <li key={t.stepId} className="relative">
                    <span className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full ${t.system === 'KDH' ? 'bg-violet-500' : t.system === 'CMS' ? 'bg-primary' : 'bg-slate-400'}`} />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{t.occurredAt}</span>
                      <ToneBadge tone={t.system === 'KDH' ? 'violet' : t.system === 'CMS' ? 'blue' : 'gray'}>{t.system}</ToneBadge>
                      <span>{t.actor}</span>
                    </div>
                    <div className="mt-0.5 text-sm">{t.action}</div>
                    <div className="font-mono text-xs text-muted-foreground">{t.objectRef}</div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{d.actionLabel}</SheetTitle>
            <SheetDescription>
              {d.eventId} · {d.occurredAt}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6 text-sm">
            <dl className="grid grid-cols-[88px_1fr] gap-y-2">
              <dt className="text-muted-foreground">操作者</dt>
              <dd>{d.actorName}</dd>
              <dt className="text-muted-foreground">对象</dt>
              <dd>{d.targetLabel}</dd>
              <dt className="text-muted-foreground">级别</dt>
              <dd>
                <ToneBadge tone={RISK_TONE[d.risk]}>{RISK_LABEL[d.risk]}</ToneBadge>
              </dd>
              <dt className="text-muted-foreground">来源 IP</dt>
              <dd className="font-mono text-xs">{d.ipAddress ?? '—'}</dd>
            </dl>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-950">
                <div className="text-xs text-muted-foreground">修改前</div>
                <div className="mt-1 font-medium">{d.before ?? '—'}</div>
              </div>
              <div className="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950">
                <div className="text-xs text-muted-foreground">修改后</div>
                <div className="mt-1 font-medium">{d.after ?? '—'}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">依据 / 说明</div>
              <p className="mt-1">{d.reason ?? '—'}</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
