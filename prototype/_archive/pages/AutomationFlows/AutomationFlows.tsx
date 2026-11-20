import { useState } from 'react';
import { ArrowDown, CalendarClock, Database, Hand, Play, Plus, Webhook, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormDialog, type FormValues } from '@/components/shared/FormDialog';
import { notify } from '@/components/shared/toast';
import { ToneBadge, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const TRIGGER_CONFIG = {
  event: { label: '数据事件', icon: Database },
  schedule: { label: '定时', icon: CalendarClock },
  webhook: { label: 'Webhook', icon: Webhook },
  manual: { label: '手动', icon: Hand },
} as const;
type TriggerKind = keyof typeof TRIGGER_CONFIG;
const RUN_STATUS_CONFIG = {
  success: { label: '成功', tone: 'green' as Tone },
  failed: { label: '失败', tone: 'red' as Tone },
  running: { label: '运行中', tone: 'blue' as Tone },
  skipped: { label: '条件不满足', tone: 'gray' as Tone },
} as const;
type RunStatus = keyof typeof RUN_STATUS_CONFIG;

// ── 类型 ──────────────────────────────────────────────────
interface FlowStepDef {
  stepKind: 'condition' | 'action' | 'ai';
  label: string;
  detail: string;
}
interface AutomationFlow {
  flowId: string;
  flowName: string;
  triggerKind: TriggerKind;
  triggerDetail: string;
  steps: FlowStepDef[];
  enabled: boolean;
  runsLast7d: number;
  failuresLast7d: number;
  fromTemplate: string | null;
}
interface FlowRun {
  runId: string;
  flowName: string;
  startedAt: string;
  durationLabel: string;
  status: RunStatus;
  summary: string;
}
interface FlowTemplate {
  templateId: string;
  templateName: string;
  description: string;
  triggerKind: TriggerKind;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockAutomationFlowsData: AutomationFlow[] = [
  {
    flowId: 'FL-01', flowName: '事实变更 → 生成复核任务', triggerKind: 'event', triggerDetail: 'fact.updated', enabled: true, runsLast7d: 46, failuresLast7d: 0, fromTemplate: '内置',
    steps: [
      { stepKind: 'action', label: '查询引用', detail: '找出引用该事实的内容（插槽 / 正文）' },
      { stepKind: 'condition', label: '按引用方式分流', detail: '插槽引用 → 自动刷新；正文引用 → 下一步' },
      { stepKind: 'action', label: '创建复核任务', detail: '分配给内容负责人，SLA 3 天' },
    ],
  },
  {
    flowId: 'FL-02', flowName: '资产入库 → AI 理解', triggerKind: 'event', triggerDetail: 'asset.created', enabled: true, runsLast7d: 212, failuresLast7d: 3, fromTemplate: '内置',
    steps: [
      { stepKind: 'ai', label: 'AI 识别', detail: '图片打标 / OCR / 视频字幕摘要关键帧' },
      { stepKind: 'condition', label: '是否为证书或检测报告', detail: 'OCR 结果命中证书模板' },
      { stepKind: 'ai', label: '抽取事实候选', detail: '进入事实库“待确认”' },
    ],
  },
  {
    flowId: 'FL-03', flowName: '证书到期前 30 天提醒', triggerKind: 'schedule', triggerDetail: '每天 08:00', enabled: true, runsLast7d: 7, failuresLast7d: 0, fromTemplate: '内置',
    steps: [
      { stepKind: 'action', label: '查询即将过期的事实', detail: '有效期 ≤ 30 天' },
      { stepKind: 'action', label: '通知事实负责人', detail: '站内信 + 飞书' },
    ],
  },
  {
    flowId: 'FL-04', flowName: '内容发布 → 推送 CRM 销售助手', triggerKind: 'event', triggerDetail: 'content.published（类型 = 销售话术卡）', enabled: false, runsLast7d: 0, failuresLast7d: 0, fromTemplate: null,
    steps: [{ stepKind: 'action', label: '调用 Webhook', detail: 'POST https://crm.example.com/hooks/content' }],
  },
];

const mockFlowRunsData: FlowRun[] = [
  { runId: 'RUN-8812', flowName: '事实变更 → 生成复核任务', startedAt: '08:30', durationLabel: '1.2s', status: 'success', summary: 'F-007 交付周期 12 周生效 → 插槽刷新 1 条（C-1002），复核任务 1 条（C-1003）' },
  { runId: 'RUN-8809', flowName: '资产入库 → AI 理解', startedAt: '09:51', durationLabel: '38s', status: 'failed', summary: 'A-2061 视频转写超时（> 30 分钟素材）' },
  { runId: 'RUN-8804', flowName: '资产入库 → AI 理解', startedAt: '09:40', durationLabel: '6s', status: 'success', summary: 'A-2058 证书 → 事实候选 3 条' },
  { runId: 'RUN-8801', flowName: '证书到期前 30 天提醒', startedAt: '08:00', durationLabel: '0.4s', status: 'skipped', summary: '今天没有即将过期的证书' },
];

const mockFlowTemplatesData: FlowTemplate[] = [
  { templateId: 'T-translate', templateName: '源内容更新 → 标记译文过期', description: '中文版本发布后，把其他语种标记为“源已更新”并创建翻译任务', triggerKind: 'event' },
  { templateId: 'T-unpublish', templateName: '资产授权到期 → 下线引用内容', description: '授权到期当天自动下线或替换为备用图', triggerKind: 'schedule' },
  { templateId: 'T-digest', templateName: '每周健康度周报', description: '每周一把健康度变化发到负责人群', triggerKind: 'schedule' },
  { templateId: 'T-inbound', templateName: '外部系统推送 → 创建草稿', description: '接收 Webhook，按映射创建内容草稿', triggerKind: 'webhook' },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取自动化流程 [GET] /api/v1/automation-flows
function handleFetchAutomationFlows() {
  console.log('fetch flows');
}

// ACTION: 启停流程 [PATCH] /api/v1/automation-flows/{id}
function handleToggleAutomationFlow(flowId: string, enabled: boolean) {
  console.log('toggle flow', flowId, enabled);
}

// ACTION: 手动运行流程 [POST] /api/v1/automation-flows/{id}/runs
function handleRunAutomationFlow(flowId: string) {
  alert('已触发一次试运行（只读模式，不写入数据）');
}

// ACTION: 获取运行记录 [GET] /api/v1/automation-runs
function handleFetchFlowRuns(params: { flowId: string; status: string }) {
  console.log('fetch runs', params);
}

// ACTION: 从模板创建流程 [POST] /api/v1/automation-flows
function handleCreateFlowFromTemplate(templateId: string | null) {
  alert(templateId ? '已从模板创建（默认停用），切到「流程」检查后启用' : '已创建空白流程（默认停用），请添加条件或动作');
}

// ── 主组件 ────────────────────────────────────────────────
const STEP_PRESETS: FlowStepDef[] = [
  { stepKind: 'condition', label: '按字段值判断', detail: '新步骤：设置条件' },
  { stepKind: 'action', label: '发送通知', detail: '新步骤：站内信 / 飞书 / 邮件' },
  { stepKind: 'action', label: '调用 Webhook', detail: '新步骤：填写地址与载荷' },
  { stepKind: 'action', label: '创建复核任务', detail: '新步骤：指定负责人与时限' },
  { stepKind: 'ai', label: 'AI 处理', detail: '新步骤：结果需人工确认' },
];
const STEP_TONE: Record<FlowStepDef['stepKind'], string> = {
  condition: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950',
  action: 'border-border bg-card',
  ai: 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950',
};

export default function AutomationFlows() {
  const [blankOpen, setBlankOpen] = useState(false);
  const [flows, setFlows] = useState(mockAutomationFlowsData);
  const [selectedId, setSelectedId] = useState('FL-01');
  const flow = flows.find((f) => f.flowId === selectedId)!;
  const TriggerIcon = TRIGGER_CONFIG[flow.triggerKind].icon;

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="自动化流程"
        description="触发器 + 条件 + 动作。内容中台里的“事实变更传导”“资产 AI 理解”等机制都是内置流程，也可以自己加。流程里的 AI 动作同样要人工确认结果。"
        actions={
          <Button onClick={() => setBlankOpen(true)}>
            <Plus /> 新建流程
          </Button>
        }
      />

      <Tabs defaultValue="flows" onValueChange={(v) => v === 'runs' && handleFetchFlowRuns({ flowId: 'all', status: 'all' })}>
        <TabsList>
          <TabsTrigger value="flows">流程 {flows.length}</TabsTrigger>
          <TabsTrigger value="runs">运行记录</TabsTrigger>
          <TabsTrigger value="templates">模板</TabsTrigger>
        </TabsList>

        <TabsContent value="flows" className="pt-3">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <div className="space-y-2">
              {flows.map((f) => {
                const Icon = TRIGGER_CONFIG[f.triggerKind].icon;
                return (
                  <div
                    key={f.flowId}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setSelectedId(f.flowId); handleFetchAutomationFlows(); }}
                    className={cn('cursor-pointer rounded-lg border bg-card p-3 hover:border-primary/40', f.flowId === selectedId && 'border-primary ring-1 ring-primary/30')}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="truncate font-medium">{f.flowName}</span>
                      <Switch
                        className="ml-auto"
                        checked={f.enabled}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={(c) => { setFlows((p) => p.map((x) => (x.flowId === f.flowId ? { ...x, enabled: c } : x))); handleToggleAutomationFlow(f.flowId, c); }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {TRIGGER_CONFIG[f.triggerKind].label}：{f.triggerDetail}
                    </div>
                    <div className="mt-1 text-xs">
                      近 7 天运行 {f.runsLast7d}
                      {f.failuresLast7d > 0 && <span className="text-red-600"> · 失败 {f.failuresLast7d}</span>}
                      {f.fromTemplate && <span className="text-muted-foreground"> · {f.fromTemplate}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{flow.flowName}</CardTitle>
                <CardDescription>{flow.enabled ? '已启用' : '已停用'}</CardDescription>
                <CardAction>
                  <Button size="sm" variant="outline" onClick={() => handleRunAutomationFlow(flow.flowId)}>
                    <Play /> 试运行
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <TriggerIcon className="size-4" /> 触发：{TRIGGER_CONFIG[flow.triggerKind].label}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">{flow.triggerDetail}</div>
                </div>
                {flow.steps.map((s, i) => (
                  <div key={i}>
                    <div className="flex justify-center py-1">
                      <ArrowDown className="size-4 text-muted-foreground" />
                    </div>
                    <div className={cn('rounded-lg border p-3', STEP_TONE[s.stepKind])}>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {s.stepKind === 'ai' ? <ToneBadge tone="violet">AI</ToneBadge> : s.stepKind === 'condition' ? <ToneBadge tone="amber">条件</ToneBadge> : <Zap className="size-4 text-muted-foreground" />}
                        {s.label}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-center py-1">
                  <ArrowDown className="size-4 text-muted-foreground" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" className="w-full border-dashed" />}>
                    <Plus /> 添加条件或动作
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64">
                    {STEP_PRESETS.map((p) => (
                      <DropdownMenuItem key={p.label} onClick={() => setFlows((prev) => prev.map((x) => (x.flowId === flow.flowId ? { ...x, steps: [...x.steps, p] } : x)))}>
                        {p.stepKind === 'ai' ? 'AI · ' : p.stepKind === 'condition' ? '条件 · ' : '动作 · '}
                        {p.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="runs" className="pt-3">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>运行</TableHead>
                    <TableHead>流程</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>结果</TableHead>
                    <TableHead>开始 · 耗时</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockFlowRunsData.map((r) => (
                    <TableRow key={r.runId}>
                      <TableCell className="font-mono text-xs">{r.runId}</TableCell>
                      <TableCell className="text-sm">{r.flowName}</TableCell>
                      <TableCell>
                        <ToneBadge tone={RUN_STATUS_CONFIG[r.status].tone}>{RUN_STATUS_CONFIG[r.status].label}</ToneBadge>
                      </TableCell>
                      <TableCell className="max-w-96 text-sm whitespace-normal">{r.summary}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.startedAt} · {r.durationLabel}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="pt-3">
          <div className="grid gap-3 md:grid-cols-2">
            {mockFlowTemplatesData.map((t) => {
              const Icon = TRIGGER_CONFIG[t.triggerKind].icon;
              return (
                <Card key={t.templateId} size="sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" /> {t.templateName}
                    </CardTitle>
                    <CardDescription>{t.description}</CardDescription>
                    <CardAction>
                      <Button size="sm" variant="outline" onClick={() => {
                          handleCreateFlowFromTemplate(t.templateId);
                          const id = `FL-${String(flows.length + 1).padStart(2, '0')}`;
                          setFlows((prev) => [...prev, { flowId: id, flowName: t.templateName, triggerKind: t.triggerKind, triggerDetail: '按模板默认配置', steps: [{ stepKind: 'action', label: '模板动作', detail: t.description }], enabled: false, runsLast7d: 0, failuresLast7d: 0, fromTemplate: '模板' }]);
                          setSelectedId(id);
                        }}>
                        使用
                      </Button>
                    </CardAction>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
      <FormDialog
        open={blankOpen}
        onOpenChange={setBlankOpen}
        title="新建自动化流程"
        description="先定触发器，创建后在右侧添加条件、动作或 AI 步骤。新流程默认停用。"
        fields={[
          { key: 'name', label: '流程名称', kind: 'text', required: true, placeholder: '例如：新品上市 → 通知经销商' },
          { key: 'trigger', label: '触发器', kind: 'select', options: [{ value: 'event', label: '数据事件' }, { value: 'schedule', label: '定时' }, { value: 'webhook', label: 'Webhook' }, { value: 'manual', label: '手动' }] },
          { key: 'detail', label: '触发条件', kind: 'text', required: true, placeholder: '例如 content.published（类型 = 产品说明）' },
        ]}
        onSubmit={(v: FormValues) => {
          handleCreateFlowFromTemplate(null);
          const id = `FL-${String(flows.length + 1).padStart(2, '0')}`;
          setFlows((prev) => [...prev, { flowId: id, flowName: String(v.name), triggerKind: v.trigger as TriggerKind, triggerDetail: String(v.detail), steps: [], enabled: false, runsLast7d: 0, failuresLast7d: 0, fromTemplate: null }]);
          setSelectedId(id);
        }}
      />
    </div>
  );
}
