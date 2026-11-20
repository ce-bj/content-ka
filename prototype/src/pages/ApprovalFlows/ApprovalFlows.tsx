import { useState } from 'react';
import { ArrowDown, GitBranch, Plug, Plus, ShieldAlert, Timer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormDialog, type FormValues } from '@/components/shared/FormDialog';
import { notify } from '@/components/shared/toast';
import { ToneBadge } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const APPROVER_OPTIONS = [
  { value: 'brand_admin', label: '品牌管理员' },
  { value: 'compliance', label: '合规审核' },
  { value: 'fact_owner', label: '事实负责人' },
  { value: 'region_owner', label: '区域市场负责人' },
  { value: 'legal', label: '法务' },
  { value: 'group_owner', label: '集团内容负责人' },
];
// 审批事项：各类“发布”统一审批，按事项匹配流程
const KIND_CONFIG = {
  content: { label: '内容发布', start: '送审（发布检查已通过）', end: '内容生效，自动上架内容市场' },
  fact: { label: '事实发布', start: '冲突裁定 / 中台录入的事实提交回写', end: '回写 KDH，事实库标记已同步' },
  batch: { label: '批次发布', start: '批次提交排期（条目均已通过内容审批）', end: '排期，到点执行' },
  market: { label: '上架与推送', start: '内容上架到新渠道 / 推送给新对接方', end: '上架生效，对接方可以取用' },
} as const;
type ApprovalKind = keyof typeof KIND_CONFIG;
// 审批引擎：现在用内置引擎；后续可接标准化审批产品，审批中心只显示进度和结果
const ENGINE_OPTIONS = [
  { value: 'builtin', label: '内置审批引擎（当前）' },
  { value: 'feishu', label: '飞书审批' },
  { value: 'dingtalk', label: '钉钉审批' },
  { value: 'wecom', label: '企业微信审批' },
  { value: 'weaver', label: '泛微 OA' },
  { value: 'custom', label: '其他（按标准接口对接）' },
];
const MODE_OPTIONS = [
  { value: 'any', label: '任一人通过' },
  { value: 'all', label: '全部通过' },
];

// ── 类型 ──────────────────────────────────────────────────
interface FlowStep {
  stepId: string;
  approverRole: string;
  mode: 'any' | 'all';
  condition: string | null;
  slaHours: number;
}
interface ApprovalEngine {
  engine: string;
  callbackUrl: string;
  syncedFlows: number;
  lastCallbackAt: string | null;
}
interface ApprovalFlow {
  flowId: string;
  approvalKind: ApprovalKind;
  flowName: string;
  scopeLabel: string;
  contentTypes: string[];
  priority: number;
  isRedLine: boolean;
  allowEmergency: boolean;
  steps: FlowStep[];
  activeReviews: number;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockApprovalFlowsData: ApprovalFlow[] = [
  {
    flowId: 'AF-01', approvalKind: 'content', flowName: '对外内容 · 标准', scopeLabel: '全部品牌 · 全部区域', contentTypes: ['产品说明', '技术 FAQ', '案例', '落地页'], priority: 10, isRedLine: false, allowEmergency: true, activeReviews: 5,
    steps: [
      { stepId: 's1', approverRole: 'brand_admin', mode: 'any', condition: null, slaHours: 24 },
      { stepId: 's2', approverRole: 'compliance', mode: 'any', condition: '含 AI 生成段落 或 区域 = 欧盟', slaHours: 24 },
    ],
  },
  {
    flowId: 'AF-02', approvalKind: 'content', flowName: '欧盟 · 加法务', scopeLabel: '全部品牌 · 欧盟', contentTypes: ['案例', '白皮书'], priority: 20, isRedLine: false, allowEmergency: false, activeReviews: 1,
    steps: [
      { stepId: 's1', approverRole: 'region_owner', mode: 'any', condition: null, slaHours: 24 },
      { stepId: 's2', approverRole: 'compliance', mode: 'any', condition: null, slaHours: 24 },
      { stepId: 's3', approverRole: 'legal', mode: 'any', condition: '案例含客户名称', slaHours: 48 },
    ],
  },
  {
    flowId: 'AF-03', approvalKind: 'fact', flowName: '事实发布 · 红线字段', scopeLabel: '全部', contentTypes: ['价格 / 交期 / 承诺'], priority: 100, isRedLine: true, allowEmergency: false, activeReviews: 1,
    steps: [
      { stepId: 's1', approverRole: 'fact_owner', mode: 'any', condition: null, slaHours: 8 },
      { stepId: 's2', approverRole: 'group_owner', mode: 'all', condition: null, slaHours: 24 },
    ],
  },
  {
    flowId: 'AF-04', approvalKind: 'fact', flowName: '事实发布 · 回写 KDH', scopeLabel: '全部', contentTypes: ['冲突裁定', '中台录入 / 文档解析'], priority: 10, isRedLine: false, allowEmergency: false, activeReviews: 1,
    steps: [{ stepId: 's1', approverRole: 'fact_owner', mode: 'any', condition: null, slaHours: 24 }],
  },
  {
    flowId: 'AF-05', approvalKind: 'batch', flowName: '批次发布', scopeLabel: '全部品牌', contentTypes: ['发布批次'], priority: 10, isRedLine: false, allowEmergency: false, activeReviews: 1,
    steps: [
      { stepId: 's1', approverRole: 'brand_admin', mode: 'any', condition: null, slaHours: 24 },
      { stepId: 's2', approverRole: 'group_owner', mode: 'any', condition: '条目 ≥ 10 或含下线', slaHours: 24 },
    ],
  },
  {
    flowId: 'AF-06', approvalKind: 'market', flowName: '上架与推送', scopeLabel: '全部品牌', contentTypes: ['新增渠道', '新增对接方'], priority: 10, isRedLine: false, allowEmergency: true, activeReviews: 1,
    steps: [{ stepId: 's1', approverRole: 'brand_admin', mode: 'any', condition: null, slaHours: 24 }],
  },
];

const mockApprovalEngineData: ApprovalEngine = {
  engine: 'builtin',
  callbackUrl: 'https://cms.example.com/api/v1/approvals/callback',
  syncedFlows: 0,
  lastCallbackAt: null,
};

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取审批引擎设置 [GET] /api/v1/approval-engine
function handleFetchApprovalEngine() {
  console.log('fetch approval engine');
}

// ACTION: 保存审批引擎设置 [PUT] /api/v1/approval-engine
function handleSaveApprovalEngine(engine: string) {
  console.log('save approval engine', engine);
}

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取审批流程 [GET] /api/v1/approval-flows
function handleFetchApprovalFlows() {
  console.log('fetch flows');
}

// ACTION: 新建审批流程 [POST] /api/v1/approval-flows
function handleCreateApprovalFlow() {
  console.log('create approval flow');
}

// ACTION: 保存审批流程 [PUT] /api/v1/approval-flows/{id}
function handleSaveApprovalFlow(flow: ApprovalFlow) {
  alert('已保存。进行中的审批按旧流程走完，新送审的内容使用新流程');
}

// ACTION: 模拟匹配流程 [POST] /api/v1/approval-flows/simulate
function handleSimulateFlow(params: { contentType: string; region: string; hasAi: boolean }) {
  console.log('simulate', params);
}

// ── 主组件 ────────────────────────────────────────────────
const approverLabel = (v: string) => APPROVER_OPTIONS.find((o) => o.value === v)?.label ?? v;

export default function ApprovalFlows() {
  const [flowOpen, setFlowOpen] = useState(false);
  const [flows, setFlows] = useState(mockApprovalFlowsData);
  const [selectedId, setSelectedId] = useState('AF-01');
  const [kind, setKind] = useState<ApprovalKind | 'all'>('all');
  const [engine, setEngine] = useState(mockApprovalEngineData.engine);
  const [savedEngine, setSavedEngine] = useState(mockApprovalEngineData.engine);
  const flow = flows.find((f) => f.flowId === selectedId)!;

  const patchFlow = (patch: Partial<ApprovalFlow>) => setFlows((p) => p.map((f) => (f.flowId === selectedId ? { ...f, ...patch } : f)));
  const patchStep = (stepId: string, patch: Partial<FlowStep>) => patchFlow({ steps: flow.steps.map((s) => (s.stepId === stepId ? { ...s, ...patch } : s)) });

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="审批流程"
        description="各类发布用同一套审批：内容发布、事实发布（回写 KDH）、批次发布、上架与推送。每类事项按范围配置审批链，提交时命中优先级最高的流程，统一在审批中心处理。审批引擎可以换成外部标准化审批产品。"
        actions={
          <>
            <Button variant="outline" onClick={() => handleSimulateFlow({ contentType: '案例', region: 'eu', hasAi: true })}>
              模拟匹配
            </Button>
            <Button onClick={() => setFlowOpen(true)}>
              <Plus /> 新建流程
            </Button>
          </>
        }
      />

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="size-4 text-muted-foreground" /> 审批引擎
          </CardTitle>
          <CardDescription>
            现在由 CMS 内置引擎执行审批。换成外部产品后，CMS 按下面的流程在对方发起审批实例，审批动作在外部完成，结果通过回调写回；审批中心照常显示进度、意见和结果，各页面的“审批中 / 已通过”状态不变。
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <Select items={ENGINE_OPTIONS} value={engine} onValueChange={(v) => { setEngine(v as string); handleFetchApprovalEngine(); }}>
              <SelectTrigger size="sm" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGINE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={engine === savedEngine}
              onClick={() => { handleSaveApprovalEngine(engine); setSavedEngine(engine); notify(engine === 'builtin' ? '已切回内置审批引擎' : `已切换为「${ENGINE_OPTIONS.find((o) => o.value === engine)?.label}」：${flows.length} 个流程将同步为外部审批模板（原型中仅示意）`); }}
            >
              保存
            </Button>
          </CardAction>
        </CardHeader>
        {engine !== 'builtin' && (
          <CardContent className="space-y-1.5 text-xs">
            {[
              ['发起', '在外部产品发起审批实例：事项类型、标题、申请内容（前后对比）、审批链'],
              ['回调', `${mockApprovalEngineData.callbackUrl} ← 实例编号、节点、结果（通过 / 驳回）、意见、处理人`],
              ['映射', '审批人角色 → 外部组织架构；红线确认节点不可跳过'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2 rounded-md border px-3 py-1.5">
                <ToneBadge tone="violet">{k}</ToneBadge>
                <span className="whitespace-normal">{v}</span>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {(['all', 'content', 'fact', 'batch', 'market'] as const).map((k) => (
          <Button key={k} size="xs" variant={kind === k ? 'default' : 'outline'} onClick={() => setKind(k)}>
            {k === 'all' ? '全部事项' : KIND_CONFIG[k].label} <span className="tabular-nums opacity-70">{flows.filter((f) => k === 'all' || f.approvalKind === k).length}</span>
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="space-y-2">
          {flows.filter((f) => kind === 'all' || f.approvalKind === kind).map((f) => (
            <button
              key={f.flowId}
              onClick={() => { setSelectedId(f.flowId); handleFetchApprovalFlows(); }}
              className={cn('w-full rounded-lg border bg-card p-3 text-left hover:border-primary/40', f.flowId === selectedId && 'border-primary ring-1 ring-primary/30')}
            >
              <div className="flex items-center gap-2">
                {f.isRedLine ? <ShieldAlert className="size-4 text-red-600" /> : <GitBranch className="size-4 text-muted-foreground" />}
                <span className="font-medium">{f.flowName}</span>
                <span className="ml-auto text-xs text-muted-foreground">优先级 {f.priority}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ToneBadge tone="blue">{KIND_CONFIG[f.approvalKind].label}</ToneBadge>
                {f.scopeLabel}
              </div>
              <div className="mt-1.5 text-xs">
                {f.steps.length} 步 · 进行中 {f.activeReviews}
              </div>
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {flow.flowName}
              {flow.isRedLine && <ToneBadge tone="red">红线</ToneBadge>}
            </CardTitle>
            <CardDescription>
              {KIND_CONFIG[flow.approvalKind].label} · 适用：{flow.scopeLabel} · {flow.contentTypes.join('、')}
            </CardDescription>
            <CardAction>
              <Button size="sm" onClick={() => handleSaveApprovalFlow(flow)}>
                保存
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-0">
              <div className="rounded-md border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">{KIND_CONFIG[flow.approvalKind].start}</div>
              {flow.steps.map((s, idx) => (
                <div key={s.stepId}>
                  <div className="flex justify-center py-1">
                    <ArrowDown className="size-4 text-muted-foreground" />
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{idx + 1}</span>
                      <Select items={APPROVER_OPTIONS} value={s.approverRole} onValueChange={(v) => patchStep(s.stepId, { approverRole: v as string })}>
                        <SelectTrigger size="sm" className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APPROVER_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select items={MODE_OPTIONS} value={s.mode} onValueChange={(v) => patchStep(s.stepId, { mode: v as 'any' | 'all' })}>
                        <SelectTrigger size="sm" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Timer className="size-3.5" />
                        <Input className="h-7 w-14" type="number" value={s.slaHours} onChange={(e) => patchStep(s.stepId, { slaHours: Number(e.target.value) })} /> 小时内处理
                      </span>
                      <Button size="icon-xs" variant="ghost" className="ml-auto" aria-label="删除步骤" onClick={() => patchFlow({ steps: flow.steps.filter((x) => x.stepId !== s.stepId) })}>
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {s.condition ? (
                        <>
                          条件：<span className="text-foreground">{s.condition}</span>
                        </>
                      ) : (
                        '无条件，始终执行'
                      )}
                      <span className="ml-2">· 当前角色：{approverLabel(s.approverRole)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex justify-center py-1">
                <ArrowDown className="size-4 text-muted-foreground" />
              </div>
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => patchFlow({ steps: [...flow.steps, { stepId: `s${flow.steps.length + 1}`, approverRole: 'compliance', mode: 'any', condition: null, slaHours: 24 }] })}
              >
                <Plus /> 添加步骤
              </Button>
              <div className="flex justify-center py-1">
                <ArrowDown className="size-4 text-muted-foreground" />
              </div>
              <div className="rounded-md border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">通过后：{KIND_CONFIG[flow.approvalKind].end}</div>
            </div>

            <div className="space-y-3 rounded-md bg-muted/50 p-3">
              <div className="flex items-center justify-between">
                <Label className="font-normal">允许紧急放行（放行人须为集团内容负责人或合规审核，事后补审）</Label>
                <Switch checked={flow.allowEmergency} disabled={flow.isRedLine} onCheckedChange={(c) => patchFlow({ allowEmergency: c })} />
              </div>
              <div className="text-xs text-muted-foreground">超时未处理：提醒审批人 → 再超时 50% 通知其上级。红线流程不能紧急放行。</div>
            </div>
          </CardContent>
        </Card>
      </div>
      <FormDialog
        open={flowOpen}
        onOpenChange={setFlowOpen}
        title="新建审批流程"
        description="送审时按范围 × 内容类型匹配，优先级高的流程优先。步骤按勾选顺序排列，创建后可继续调整条件与时限。"
        fields={[
          { key: 'kind', label: '审批事项', kind: 'select', options: (Object.keys(KIND_CONFIG) as ApprovalKind[]).map((k) => ({ value: k, label: KIND_CONFIG[k].label })) },
          { key: 'name', label: '流程名称', kind: 'text', required: true, placeholder: '例如：东南亚 · 本地化审核' },
          { key: 'scope', label: '适用范围', kind: 'select', options: ['全部品牌 · 全部区域', '北岭智造 · 欧盟', '北岭智造 · 东南亚', '汉川传动 · 全部区域'].map((x) => ({ value: x, label: x })) },
          { key: 'types', label: '适用对象（内容类型 / 事实类别等）', kind: 'multi', required: true, options: ['产品说明', '技术 FAQ', '客户案例', '落地页', '销售资料', '社媒短帖'].map((x) => ({ value: x, label: x })) },
          { key: 'steps', label: '审批步骤（按勾选顺序）', kind: 'multi', required: true, options: APPROVER_OPTIONS },
          { key: 'priority', label: '优先级', kind: 'number', defaultValue: '30' },
          { key: 'emergency', label: '允许紧急放行', kind: 'select', options: [{ value: 'no', label: '不允许' }, { value: 'yes', label: '允许' }] },
        ]}
        onSubmit={(v: FormValues) => {
          handleCreateApprovalFlow();
          const id = `AF-${String(flows.length + 1).padStart(2, '0')}`;
          setFlows((prev) => [...prev, { flowId: id, approvalKind: v.kind as ApprovalKind, flowName: String(v.name), scopeLabel: String(v.scope), contentTypes: v.types as string[], priority: Number(v.priority) || 30, isRedLine: false, allowEmergency: v.emergency === 'yes', activeReviews: 0, steps: (v.steps as string[]).map((r, i) => ({ stepId: `s${i + 1}`, approverRole: r, mode: 'any' as const, condition: null, slaHours: 24 })) }]);
          setSelectedId(id);
          notify(`已创建审批流程 ${id}（${KIND_CONFIG[v.kind as ApprovalKind].label}），新提交的申请会按它匹配`);
        }}
      />
    </div>
  );
}
