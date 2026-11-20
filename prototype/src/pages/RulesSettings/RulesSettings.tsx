import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowRight, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { ToneBadge, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const SEVERITY_CONFIG = {
  block: { label: '拦截', tone: 'red' as Tone },
  warn: { label: '提醒', tone: 'amber' as Tone },
} as const;
type Severity = keyof typeof SEVERITY_CONFIG;
const SEVERITY_OPTIONS = [
  { value: 'block', label: '拦截（不能送审）' },
  { value: 'warn', label: '提醒（可送审）' },
];

// ── 类型 ──────────────────────────────────────────────────
interface PublishCheckRule {
  ruleId: string;
  ruleName: string;
  description: string;
  threshold: string | null;
  severity: Severity;
  appliesTo: string;
  enabled: boolean;
  blockedLast30d: number;
}
interface SurvivorshipRule {
  ruleId: string;
  order: number;
  ruleName: string;
  description: string;
  enabled: boolean;
}
interface FalseConflictDimension {
  dimension: string;
  description: string;
  enabled: boolean;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockPublishCheckRulesData: PublishCheckRule[] = [
  { ruleId: 'PC-01', ruleName: '对外内容的事实证据等级', description: '对外发布的内容只能引用证据等级达到阈值的事实', threshold: 'A 或 B', severity: 'block', appliesTo: '对外渠道', enabled: true, blockedLast30d: 23 },
  { ruleId: 'PC-02', ruleName: '引用了过期事实', description: '事实有效期已过或即将过期', threshold: '提前 30 天提醒', severity: 'block', appliesTo: '全部', enabled: true, blockedLast30d: 12 },
  { ruleId: 'PC-03', ruleName: '存在未处理冲突', description: '引用的事实有未处理的冲突', threshold: null, severity: 'block', appliesTo: '全部', enabled: true, blockedLast30d: 9 },
  { ruleId: 'PC-09', ruleName: '事实可见级别', description: '引用的事实在 KDH 中的可见级别不是“公开”（内部 / 机密事实不能进入对外内容）', threshold: '对外渠道仅“公开”', severity: 'block', appliesTo: '对外渠道', enabled: true, blockedLast30d: 3 },
  { ruleId: 'PC-04', ruleName: '资产授权', description: '引用资产的授权已到期，或不覆盖发布区域 / 渠道', threshold: null, severity: 'block', appliesTo: '全部', enabled: true, blockedLast30d: 6 },
  { ruleId: 'PC-05', ruleName: 'Brand Voice 禁用词', description: '命中品牌禁用词或广告法绝对化用语', threshold: null, severity: 'block', appliesTo: '全部', enabled: true, blockedLast30d: 31 },
  { ruleId: 'PC-06', ruleName: 'AI 生成段落未确认', description: '含 AI 生成段落，且编辑尚未逐段确认', threshold: null, severity: 'block', appliesTo: '全部', enabled: true, blockedLast30d: 40 },
  { ruleId: 'PC-07', ruleName: 'AI 摘要与结构化标注', description: '缺 AI 摘要、FAQ 结构或 JSON-LD 必填项', threshold: null, severity: 'warn', appliesTo: '产品说明、技术 FAQ', enabled: true, blockedLast30d: 0 },
  { ruleId: 'PC-08', ruleName: '必需语种', description: '目标区域要求的语种版本不齐', threshold: '欧盟需 en-US + de-DE', severity: 'warn', appliesTo: '欧盟', enabled: false, blockedLast30d: 0 },
];

const mockSurvivorshipRulesData: SurvivorshipRule[] = [
  { ruleId: 'SV-1', order: 1, ruleName: '权威来源优先', description: '属性类别有指定权威来源时（如交期以 ERP 为准），直接采纳该来源的值', enabled: true },
  { ruleId: 'SV-2', order: 2, ruleName: '证据等级高优先', description: 'A（第三方检测 / 证书）> B（企业正式文件）> C（自我声明）', enabled: true },
  { ruleId: 'SV-3', order: 3, ruleName: '生效时间新优先', description: '证据等级相同时，生效时间更新的值优先', enabled: true },
  { ruleId: 'SV-4', order: 4, ruleName: '人工判断', description: '以上规则都无法区分时，推荐值留空，由事实负责人决定', enabled: true },
];

const mockFalseConflictDimensionsData: FalseConflictDimension[] = [
  { dimension: '型号 / 配置', description: '两个值分别属于不同型号或选配，不算冲突', enabled: true },
  { dimension: '区域', description: '欧盟 12 周、中国 8 周，属于按区域取值', enabled: true },
  { dimension: '测试标准', description: 'IEC 60529 与 GB/T 4208 下的结果分别成立', enabled: true },
  { dimension: '生效时间', description: '旧值已失效、新值已生效，属于更替而非冲突', enabled: true },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取发布检查规则 [GET] /api/v1/rules/publish-checks
function handleFetchPublishCheckRules() {
  console.log('fetch publish check rules');
}

// ACTION: 更新发布检查规则 [PATCH] /api/v1/rules/publish-checks/{ruleId}
function handleUpdatePublishCheckRule(ruleId: string, patch: Partial<PublishCheckRule>) {
  console.log('update check rule', ruleId, patch);
}

// ACTION: 获取冲突选择规则 [GET] /api/v1/rules/survivorship
function handleFetchSurvivorshipRules() {
  console.log('fetch survivorship');
}

// ACTION: 保存冲突选择规则 [PUT] /api/v1/rules/survivorship
function handleSaveSurvivorshipRules(rules: SurvivorshipRule[], dimensions: FalseConflictDimension[]) {
  alert('已保存，对新产生的冲突生效；已有冲突的推荐值会重新计算');
}

// ── 主组件 ────────────────────────────────────────────────
export default function RulesSettings() {
  const navigate = useNavigate();
  const [checks, setChecks] = useState(mockPublishCheckRulesData);
  const [survivorship, setSurvivorship] = useState(mockSurvivorshipRulesData);
  const [dimensions, setDimensions] = useState(mockFalseConflictDimensionsData);

  const patchCheck = (ruleId: string, patch: Partial<PublishCheckRule>) => {
    setChecks((p) => p.map((r) => (r.ruleId === ruleId ? { ...r, ...patch } : r)));
    handleUpdatePublishCheckRule(ruleId, patch);
  };
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...survivorship];
    const [item] = next.splice(idx, 1);
    next.splice(idx + dir, 0, item);
    setSurvivorship(next.map((r, i) => ({ ...r, order: i + 1 })));
  };

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="规则"
        description="三类规则决定内容能不能发、冲突怎么推荐、事实怎么同步。规则修改会记录审计日志。"
      />

      <Tabs defaultValue="checks" onValueChange={(v) => { if (v === 'checks') handleFetchPublishCheckRules(); if (v === 'conflict') handleFetchSurvivorshipRules(); }}>
        <TabsList>
          <TabsTrigger value="checks">发布检查规则</TabsTrigger>
          <TabsTrigger value="conflict">冲突选择规则</TabsTrigger>
          <TabsTrigger value="sync">事实同步方向</TabsTrigger>
        </TabsList>

        <TabsContent value="checks" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>发布检查规则</CardTitle>
              <CardDescription>编辑器右侧实时显示检查结果；“拦截”项未通过时不能送审，审核人也不能绕过（只能紧急放行）。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>检查项</TableHead>
                    <TableHead>阈值</TableHead>
                    <TableHead>适用</TableHead>
                    <TableHead>级别</TableHead>
                    <TableHead className="text-right">近 30 天拦截</TableHead>
                    <TableHead>启用</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checks.map((r) => (
                    <TableRow key={r.ruleId} className={cn(!r.enabled && 'opacity-60')}>
                      <TableCell className="max-w-80 whitespace-normal">
                        <div className="font-medium">{r.ruleName}</div>
                        <div className="text-xs text-muted-foreground">{r.description}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.threshold ?? '—'}</TableCell>
                      <TableCell className="text-sm">{r.appliesTo}</TableCell>
                      <TableCell>
                        <Select items={SEVERITY_OPTIONS} value={r.severity} onValueChange={(v) => patchCheck(r.ruleId, { severity: v as Severity })}>
                          <SelectTrigger size="sm" className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SEVERITY_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.blockedLast30d}</TableCell>
                      <TableCell>
                        <Switch checked={r.enabled} onCheckedChange={(c) => patchCheck(r.ruleId, { enabled: c })} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflict" className="space-y-4 pt-3">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>推荐值的判断顺序</CardTitle>
                <CardDescription>冲突处理面板按这个顺序给出推荐值，并写明命中了哪条规则。推荐只是建议，最终由人决定。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {survivorship.map((r, idx) => (
                  <div key={r.ruleId} className="flex items-start gap-2 rounded-md border bg-card p-3">
                    <GripVertical className="mt-0.5 size-4 text-muted-foreground" />
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{r.order}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{r.ruleName}</div>
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    </div>
                    <div className="flex flex-col">
                      <Button size="icon-xs" variant="ghost" aria-label="上移" disabled={idx === 0 || r.ruleId === 'SV-4'} onClick={() => move(idx, -1)}>
                        <ArrowUp />
                      </Button>
                      <Button size="icon-xs" variant="ghost" aria-label="下移" disabled={idx >= survivorship.length - 2} onClick={() => move(idx, 1)}>
                        <ArrowDown />
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">“人工判断”固定在最后。</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>假冲突识别</CardTitle>
                <CardDescription>两个值在以下维度上适用范围不同时，提示“可能不是冲突”，建议拆分适用范围。</CardDescription>
                <CardAction>
                  <Button size="sm" onClick={() => handleSaveSurvivorshipRules(survivorship, dimensions)}>
                    保存
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-2">
                {dimensions.map((d) => (
                  <div key={d.dimension} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">{d.dimension}</div>
                      <div className="text-xs text-muted-foreground">{d.description}</div>
                    </div>
                    <Switch checked={d.enabled} onCheckedChange={(c) => setDimensions((p) => p.map((x) => (x.dimension === d.dimension ? { ...x, enabled: c } : x)))} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sync" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>事实同步方向</CardTitle>
              <CardDescription>按属性类别配置中台与知识库之间的同步方向。配置入口在「对接 → 上游接入」，这里是汇总视图。</CardDescription>
              <CardAction>
                <Button size="sm" variant="outline" onClick={() => navigate('/integrations')}>
                  去上游接入配置 <ArrowRight />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-2">
              {[
                ['认证与检测', '以知识库为准', 'blue'],
                ['规格参数', '双向（版本比较）', 'violet'],
                ['交付与产能', '以知识库为准 · 红线', 'red'],
                ['价格与商务', '以知识库为准 · 红线', 'red'],
                ['营销表述', '以中台为准', 'green'],
                ['案例要点', '对方为空才写入', 'gray'],
              ].map(([k, v, t]) => (
                <div key={k} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span>{k}</span>
                  <ToneBadge tone={t as Tone}>{v}</ToneBadge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
