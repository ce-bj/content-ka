import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookPlus, Check, Filter, MessageCircleQuestion, PenLine, Plus, Settings2, Sparkles, TrendingDown, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormDialog, labelOf, type FormValues } from '@/components/shared/FormDialog';
import { notify } from '@/components/shared/toast';
import { ToneBadge, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const SIGNAL_CONFIG = {
  buyer_question: { label: '买家高频问题', source: 'KDH 买家问题库', owner: '对接', tone: 'blue' as Tone, icon: MessageCircleQuestion },
  knowledge_gap: { label: '知识缺口', source: 'KDH 对话日志', owner: '对接', tone: 'violet' as Tone, icon: BookPlus },
  performance: { label: '效果回流', source: '数据底座', owner: '对接', tone: 'amber' as Tone, icon: TrendingDown },
  health: { label: '内容健康度', source: 'CMS', owner: '自建', tone: 'teal' as Tone, icon: Sparkles },
  manual: { label: '人工提报', source: 'CMS 成员', owner: '自建', tone: 'gray' as Tone, icon: PenLine },
} as const;
type SignalKind = keyof typeof SIGNAL_CONFIG;
const PRIORITY_CONFIG = {
  high: { label: '高', tone: 'red' as Tone },
  medium: { label: '中', tone: 'amber' as Tone },
  low: { label: '低', tone: 'gray' as Tone },
} as const;
type Priority = keyof typeof PRIORITY_CONFIG;
type TopicStatus = 'suggested' | 'adopted' | 'rejected';
const OWNER_RULE_OPTIONS = [
  { value: 'brand_owner', label: '按品牌：品牌内容负责人' },
  { value: 'product_editor', label: '按产品线：对应内容编辑' },
  { value: 'fixed', label: '固定：林悦' },
];
const ENTRY_MODE_OPTIONS = [
  { value: 'confirm', label: '进入「待确认」，负责人确认后生产' },
  { value: 'auto_task', label: '自动采纳，直接创建 AI 生成任务' },
];
const SCOPE_OPTIONS = [
  { value: 'all', label: '全部品牌' },
  { value: 'beiling', label: '北岭智造' },
  { value: 'hanchuan', label: '汉川传动' },
];
const CONTENT_TYPE_OPTIONS = ['产品说明', '技术 FAQ', '客户案例', '落地页', '社媒短帖', '销售话术卡'].map((x) => ({ value: x, label: x }));

// ── 类型 ──────────────────────────────────────────────────
interface TopicRule {
  ruleId: string;
  signalKind: SignalKind;
  ruleName: string;
  conditionPrefix: string;
  metricUnit: string;
  windowDays: number | null;
  threshold: number;
  highPriorityAt: number;
  scope: string;
  ownerRule: string;
  entryMode: 'confirm' | 'auto_task';
  dedupeDays: number;
  enabled: boolean;
}
interface TopicSuggestion {
  topicId: string;
  title: string;
  signalKind: SignalKind;
  ruleId: string;
  metricValue: number;
  evidence: string;
  scopeLabel: string;
  contentTypeName: string;
  usableFactCount: number;
  missingFacts: string[];
  priority: Priority;
  status: TopicStatus;
  ownerName: string | null;
}
interface FactGap {
  gapId: string;
  subjectName: string;
  attributeName: string;
  reason: string;
  askedCount: number;
  requestStatus: 'none' | 'requested' | 'filled';
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockTopicRulesData: TopicRule[] = [
  { ruleId: 'R-01', signalKind: 'buyer_question', ruleName: '买家高频问题未被内容覆盖', conditionPrefix: '同一问题被问', metricUnit: '次', windowDays: 30, threshold: 50, highPriorityAt: 200, scope: 'all', ownerRule: 'brand_owner', entryMode: 'confirm', dedupeDays: 14, enabled: true },
  { ruleId: 'R-02', signalKind: 'knowledge_gap', ruleName: 'KDH 中缺少该属性的事实', conditionPrefix: '同一属性被问', metricUnit: '次', windowDays: 30, threshold: 20, highPriorityAt: 30, scope: 'all', ownerRule: 'product_editor', entryMode: 'confirm', dedupeDays: 14, enabled: true },
  { ruleId: 'R-03', signalKind: 'performance', ruleName: '已生效内容效果下降', conditionPrefix: '停留时长或点击率环比下降', metricUnit: '%', windowDays: 14, threshold: 25, highPriorityAt: 50, scope: 'all', ownerRule: 'product_editor', entryMode: 'confirm', dedupeDays: 30, enabled: true },
  { ruleId: 'R-04', signalKind: 'health', ruleName: '目标市场缺语种 / 内容过期', conditionPrefix: '缺少目标语种数', metricUnit: '个', windowDays: null, threshold: 1, highPriorityAt: 3, scope: 'all', ownerRule: 'product_editor', entryMode: 'auto_task', dedupeDays: 30, enabled: true },
  { ruleId: 'R-05', signalKind: 'manual', ruleName: '成员人工提报', conditionPrefix: '提报即进入', metricUnit: '', windowDays: null, threshold: 0, highPriorityAt: 0, scope: 'all', ownerRule: 'brand_owner', entryMode: 'confirm', dedupeDays: 0, enabled: true },
];

const mockTopicSuggestionsData: TopicSuggestion[] = [
  { topicId: 'TP-41', title: 'BL-R600 在焊装车间的防护与清洁', signalKind: 'buyer_question', ruleId: 'R-01', metricValue: 412, evidence: '欧盟买家近 30 天在 AI 客服问“粉尘 / 焊渣环境能否用”412 次，现有 FAQ 只覆盖防护等级', scopeLabel: '北岭智造 · 欧盟 · en-US', contentTypeName: '技术 FAQ', usableFactCount: 4, missingFacts: [], priority: 'high', status: 'suggested', ownerName: null },
  { topicId: 'TP-40', title: 'BL-R600 防爆版选型说明', signalKind: 'knowledge_gap', ruleId: 'R-02', metricValue: 37, evidence: 'SDR 对话 37 次被问到防爆认证，KDH 中没有“防爆等级”属性', scopeLabel: '北岭智造 · 全部区域', contentTypeName: '产品说明', usableFactCount: 3, missingFacts: ['防爆等级'], priority: 'high', status: 'suggested', ownerName: null },
  { topicId: 'TP-39', title: '改写 BL-R600 产品手册摘要的应用场景段', signalKind: 'performance', ruleId: 'R-03', metricValue: 31, evidence: 'C-0921 v4 线索 42、点击率 6.8%；但“应用场景”段停留时长比 v3 下降 31%', scopeLabel: '北岭智造 · 中国大陆 · zh-CN', contentTypeName: '产品说明', usableFactCount: 7, missingFacts: [], priority: 'medium', status: 'suggested', ownerName: null },
  { topicId: 'TP-42', title: 'HC-SD75 伺服驱动器现场调试步骤', signalKind: 'buyer_question', ruleId: 'R-01', metricValue: 36, evidence: '中国大陆经销商近 30 天在销售助手里问“怎么调试 / 参数怎么设”36 次', scopeLabel: '汉川传动 · 中国大陆 · zh-CN', contentTypeName: '技术 FAQ', usableFactCount: 5, missingFacts: [], priority: 'low', status: 'suggested', ownerName: null },
  { topicId: 'TP-38', title: '汽车焊装线案例补泰语版', signalKind: 'health', ruleId: 'R-04', metricValue: 1, evidence: '健康度：C-1009 目标市场为东南亚，缺 th-TH', scopeLabel: '北岭智造 · 东南亚 · th-TH', contentTypeName: '客户案例', usableFactCount: 5, missingFacts: [], priority: 'medium', status: 'adopted', ownerName: '林悦' },
  { topicId: 'TP-37', title: 'HC-RV200 与竞品扭矩对比', signalKind: 'buyer_question', ruleId: 'R-01', metricValue: 58, evidence: '买家问题库：“和 XX 品牌比扭矩”58 次', scopeLabel: '汉川传动 · 全部区域', contentTypeName: '销售话术卡', usableFactCount: 1, missingFacts: ['竞品扭矩（无授权来源）'], priority: 'low', status: 'rejected', ownerName: '周敏' },
];

const mockFactGapsData: FactGap[] = [
  { gapId: 'GAP-12', subjectName: 'BL-R600', attributeName: '防爆等级', reason: 'SDR 与 AI 客服被问到 37 次，KDH 无此属性', askedCount: 37, requestStatus: 'none' },
  { gapId: 'GAP-11', subjectName: 'BL-R600', attributeName: '焊渣防护说明', reason: '买家高频问题，KDH 只有防护等级数值', askedCount: 412, requestStatus: 'requested' },
  { gapId: 'GAP-09', subjectName: 'HC-RV200', attributeName: '背隙', reason: '中台 OCR 已抽取候选值 F-032，待 KDH 确认', askedCount: 22, requestStatus: 'requested' },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取选题建议 [GET] /api/v1/topics
function handleFetchTopics(params: { status: TopicStatus }) {
  console.log('fetch topics', params);
}

// ACTION: 采纳选题 [PATCH] /api/v1/topics/{id}
function handleAdoptTopic(topicId: string) {
  console.log('adopt topic', topicId);
}

// ACTION: 驳回选题 [PATCH] /api/v1/topics/{id}
function handleRejectTopic(topicId: string, reason: string) {
  console.log('reject topic', topicId, reason);
}

// ACTION: 人工提报选题 [POST] /api/v1/topics
function handleCreateTopic(form: { title: string; contentTypeName: string; scopeLabel: string; reason: string }) {
  console.log('create topic', form);
}

// ACTION: 按入口规则重新计算选题建议 [POST] /api/v1/topics/refresh
function handleRefreshTopics() {
  console.log('refresh topics');
}

// ACTION: 获取选题入口规则 [GET] /api/v1/topic-rules
function handleFetchTopicRules() {
  console.log('fetch topic rules');
}

// ACTION: 保存选题入口规则 [PUT] /api/v1/topic-rules
function handleSaveTopicRules(rules: TopicRule[]) {
  console.log('save topic rules', rules);
}

// ACTION: 向 KDH 发起事实补录 [POST] /api/v1/kdh/fact-requests
function handleRequestKdhFact(gapId: string) {
  console.log('request kdh fact', gapId);
}

// ── 主组件 ────────────────────────────────────────────────
export default function TopicPlanner() {
  const navigate = useNavigate();
  const [view, setView] = useState<'topics' | 'rules'>('topics');
  const [rules, setRules] = useState(mockTopicRulesData);
  const [savedRules, setSavedRules] = useState(mockTopicRulesData);
  const [topics, setTopics] = useState(mockTopicSuggestionsData);
  const [tab, setTab] = useState<TopicStatus>('suggested');
  const [gaps, setGaps] = useState(mockFactGapsData);
  const [manualOpen, setManualOpen] = useState(false);

  const ruleOf = (id: string) => savedRules.find((r) => r.ruleId === id)!;
  // 入口规则决定哪些信号能成为“待确认”的建议：规则停用或指标未达门槛的不出现
  const hits = (t: TopicSuggestion) => {
    const r = ruleOf(t.ruleId);
    return r.enabled && t.metricValue >= r.threshold;
  };
  const priorityOf = (t: TopicSuggestion): Priority => {
    if (t.signalKind === 'manual') return t.priority;
    const r = ruleOf(t.ruleId);
    return t.metricValue >= r.highPriorityAt ? 'high' : t.metricValue >= (r.threshold + r.highPriorityAt) / 2 ? 'medium' : 'low';
  };
  const suggested = topics.filter((t) => t.status === 'suggested');
  const visibleSuggested = suggested.filter(hits);
  const hiddenCount = suggested.length - visibleSuggested.length;
  const list = tab === 'suggested' ? visibleSuggested : topics.filter((t) => t.status === tab);
  const countBy = (k: SignalKind) => visibleSuggested.filter((t) => t.signalKind === k).length;
  const dirty = JSON.stringify(rules) !== JSON.stringify(savedRules);
  const patchRule = (ruleId: string, patch: Partial<TopicRule>) => setRules((p) => p.map((r) => (r.ruleId === ruleId ? { ...r, ...patch } : r)));

  const adopt = (t: TopicSuggestion) => {
    handleAdoptTopic(t.topicId);
    setTopics((p) => p.map((x) => (x.topicId === t.topicId ? { ...x, status: 'adopted', ownerName: '林悦' } : x)));
    navigate('/production/generate', { state: { topicId: t.topicId, title: t.title, contentTypeName: t.contentTypeName, scopeLabel: t.scopeLabel, evidence: t.evidence } });
  };

  const ruleSentence = (r: TopicRule) => {
    if (r.signalKind === 'manual') return '成员提报后进入待确认';
    return `${r.windowDays ? `近 ${r.windowDays} 天` : ''}${r.conditionPrefix} ≥ ${r.threshold}${r.metricUnit}`;
  };

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="选题"
        description="内容主流程的第一步。对接平台的信号（KDH 买家问题、知识缺口、效果回流）和 CMS 自己的健康度，按「入口规则」筛成选题建议；负责人确认后进入 AI 生成。缺的事实不让 AI 编，而是向 KDH 发起补录。"
        actions={
          <>
            <Button variant="outline" onClick={() => setManualOpen(true)}>
              <Plus /> 提报选题
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                handleRefreshTopics();
                notify(`已按入口规则重新计算：命中 ${visibleSuggested.length} 条，未达门槛 ${hiddenCount} 条`);
              }}
            >
              <Sparkles /> 重新计算建议
            </Button>
          </>
        }
      />

      <Tabs value={view} onValueChange={(v) => { setView(v as 'topics' | 'rules'); if (v === 'rules') handleFetchTopicRules(); }}>
        <TabsList>
          <TabsTrigger value="topics">选题建议</TabsTrigger>
          <TabsTrigger value="rules">
            <Settings2 /> 入口规则 {savedRules.filter((r) => r.enabled).length}/{savedRules.length}
          </TabsTrigger>
        </TabsList>

        {/* ── 选题建议 ── */}
        <TabsContent value="topics" className="space-y-5 pt-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {(Object.keys(SIGNAL_CONFIG) as SignalKind[]).map((k) => {
              const c = SIGNAL_CONFIG[k];
              const Icon = c.icon;
              const rule = savedRules.find((r) => r.signalKind === k);
              return (
                <Card key={k} size="sm" className={cn(rule && !rule.enabled && 'opacity-60')}>
                  <CardHeader>
                    <CardDescription className="flex items-center gap-1.5">
                      <Icon className="size-3.5" /> {c.label}
                    </CardDescription>
                    <CardTitle className="text-2xl tabular-nums">{countBy(k)}</CardTitle>
                    <CardAction>
                      <ToneBadge tone={c.owner === '自建' ? 'teal' : 'gray'}>{c.owner}</ToneBadge>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    {rule ? (rule.enabled ? `${rule.ruleId}：${ruleSentence(rule)}` : `${rule.ruleId} 已停用`) : `来源：${c.source}`}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Tabs value={tab} onValueChange={(v) => { setTab(v as TopicStatus); handleFetchTopics({ status: v as TopicStatus }); }}>
            <div className="flex flex-wrap items-center gap-3">
              <TabsList>
                <TabsTrigger value="suggested">待确认 {visibleSuggested.length}</TabsTrigger>
                <TabsTrigger value="adopted">已采纳</TabsTrigger>
                <TabsTrigger value="rejected">已驳回</TabsTrigger>
              </TabsList>
              {tab === 'suggested' && hiddenCount > 0 && (
                <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setView('rules')}>
                  <Filter className="size-3.5" /> 另有 {hiddenCount} 条信号未达入口规则门槛，未进入待确认 · 调整规则
                </button>
              )}
            </div>
            <TabsContent value={tab} className="space-y-3 pt-3">
              {list.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无</div>}
              {list.map((t) => {
                const sig = SIGNAL_CONFIG[t.signalKind];
                const rule = ruleOf(t.ruleId);
                const pr = priorityOf(t);
                return (
                  <Card key={t.topicId} size="sm">
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        {t.title}
                        <ToneBadge tone={PRIORITY_CONFIG[pr].tone}>优先级 {PRIORITY_CONFIG[pr].label}</ToneBadge>
                        <span className="text-xs font-normal text-muted-foreground">{t.topicId}</span>
                      </CardTitle>
                      <CardDescription>
                        <ToneBadge tone={sig.tone}>{sig.label}</ToneBadge> <span className="ml-1">{t.evidence}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                        命中规则 <span className="font-medium text-foreground">{rule.ruleId} {rule.ruleName}</span>
                        {t.signalKind !== 'manual' && (
                          <>
                            ：{ruleSentence(rule)}，本条为 <span className="font-medium text-foreground">{t.metricValue}{rule.metricUnit}</span>
                            {' '}· 负责人分配：{labelOf(OWNER_RULE_OPTIONS, rule.ownerRule)}
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3 sm:gap-6">
                          <div>
                            范围
                            <div className="text-sm text-foreground">{t.scopeLabel}</div>
                          </div>
                          <div>
                            建议内容类型
                            <div className="text-sm text-foreground">{t.contentTypeName}</div>
                          </div>
                          <div>
                            可用事实
                            <div className={cn('text-sm', t.missingFacts.length ? 'text-red-600' : 'text-foreground')}>
                              {t.usableFactCount} 条{t.missingFacts.length > 0 && ` · 缺：${t.missingFacts.join('、')}`}
                            </div>
                          </div>
                        </div>
                        {t.status === 'suggested' && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { handleRejectTopic(t.topicId, '不在本季度重点'); setTopics((p) => p.map((x) => (x.topicId === t.topicId ? { ...x, status: 'rejected', ownerName: '林悦' } : x))); notify(`已驳回 ${t.topicId}，${rule.dedupeDays || 14} 天内同类信号不再重复建议`); }}>
                              <X /> 驳回
                            </Button>
                            <Button size="sm" disabled={t.missingFacts.length > 0} title={t.missingFacts.length ? '缺事实，先向 KDH 发起补录' : undefined} onClick={() => adopt(t)}>
                              <Check /> 采纳并去生成 <ArrowRight />
                            </Button>
                          </div>
                        )}
                        {t.status === 'adopted' && <span className="text-xs text-muted-foreground">负责人 {t.ownerName} · 已进入生产</span>}
                        {t.status === 'rejected' && <span className="text-xs text-muted-foreground">{t.ownerName} 驳回</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>事实缺口 → KDH 补录</CardTitle>
              <CardDescription>选题需要、但 KDH 里没有授权事实的属性。CMS 不自行编写，向 KDH 发起补录，补录后同步回事实库，选题才可采纳。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>对象 / 属性</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead className="text-right">被问次数</TableHead>
                    <TableHead>补录</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gaps.map((g) => (
                    <TableRow key={g.gapId}>
                      <TableCell>
                        <div className="font-medium">{g.attributeName}</div>
                        <div className="text-xs text-muted-foreground">{g.subjectName}</div>
                      </TableCell>
                      <TableCell className="max-w-96 text-sm whitespace-normal text-muted-foreground">{g.reason}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.askedCount}</TableCell>
                      <TableCell>
                        {g.requestStatus === 'none' ? (
                          <Button size="xs" variant="outline" onClick={() => { handleRequestKdhFact(g.gapId); setGaps((p) => p.map((x) => (x.gapId === g.gapId ? { ...x, requestStatus: 'requested' } : x))); notify('已在 KDH 创建补录任务，事实负责人处理后会同步回事实库'); }}>
                            发起 KDH 补录
                          </Button>
                        ) : (
                          <ToneBadge tone={g.requestStatus === 'filled' ? 'green' : 'blue'}>{g.requestStatus === 'filled' ? '已补录' : 'KDH 处理中'}</ToneBadge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 入口规则 ── */}
        <TabsContent value="rules" className="space-y-4 pt-3">
          <Alert>
            <Settings2 />
            <AlertTitle>什么样的信号会变成选题</AlertTitle>
            <AlertDescription>
              每条规则对应一类信号：指标达到门槛才生成选题建议，达到“高优先级”线标为高；同一对象在去重期内只建议一次。负责人按分配规则自动指派；“自动采纳”的规则跳过待确认，直接创建 AI 生成任务。
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {rules.map((r) => {
              const sig = SIGNAL_CONFIG[r.signalKind];
              const Icon = sig.icon;
              const matched = topics.filter((t) => t.ruleId === r.ruleId && t.status === 'suggested' && r.enabled && t.metricValue >= r.threshold).length;
              const total = topics.filter((t) => t.ruleId === r.ruleId && t.status === 'suggested').length;
              return (
                <Card key={r.ruleId} size="sm" className={cn(!r.enabled && 'opacity-70')}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      {r.ruleId} {r.ruleName}
                      <ToneBadge tone={sig.tone}>{sig.label}</ToneBadge>
                    </CardTitle>
                    <CardDescription>
                      信号来源：{sig.source}（{sig.owner}）{r.signalKind !== 'manual' && ` · 按当前设置，待确认中命中 ${matched}/${total} 条`}
                    </CardDescription>
                    <CardAction>
                      <Switch checked={r.enabled} onCheckedChange={(c) => patchRule(r.ruleId, { enabled: c })} />
                    </CardAction>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm lg:grid-cols-[1.3fr_1fr_1fr]">
                    <div className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">触发条件</div>
                      {r.signalKind === 'manual' ? (
                        <div className="text-sm">任何成员可提报，提报后进入待确认</div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.windowDays !== null && (
                            <>
                              近 <Input type="number" className="h-7 w-16" value={r.windowDays} onChange={(e) => patchRule(r.ruleId, { windowDays: Number(e.target.value) })} /> 天
                            </>
                          )}
                          {r.conditionPrefix} ≥
                          <Input type="number" className="h-7 w-20" value={r.threshold} onChange={(e) => patchRule(r.ruleId, { threshold: Number(e.target.value) })} />
                          {r.metricUnit}
                        </div>
                      )}
                      {r.signalKind !== 'manual' && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          ≥ <Input type="number" className="h-7 w-20" value={r.highPriorityAt} onChange={(e) => patchRule(r.ruleId, { highPriorityAt: Number(e.target.value) })} />
                          {r.metricUnit} 标为高优先级 · 去重
                          <Input type="number" className="h-7 w-14" value={r.dedupeDays} onChange={(e) => patchRule(r.ruleId, { dedupeDays: Number(e.target.value) })} /> 天
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">适用范围 · 负责人</div>
                      <Select items={SCOPE_OPTIONS} value={r.scope} onValueChange={(v) => patchRule(r.ruleId, { scope: v as string })}>
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SCOPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select items={OWNER_RULE_OPTIONS} value={r.ownerRule} onValueChange={(v) => patchRule(r.ruleId, { ownerRule: v as string })}>
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OWNER_RULE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">命中后</div>
                      <Select items={ENTRY_MODE_OPTIONS} value={r.entryMode} onValueChange={(v) => patchRule(r.ruleId, { entryMode: v as TopicRule['entryMode'] })}>
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ENTRY_MODE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/95 py-3">
            {dirty && <span className="mr-auto text-xs text-amber-700">有未保存的修改</span>}
            <Button variant="outline" disabled={!dirty} onClick={() => setRules(savedRules)}>
              撤销修改
            </Button>
            <Button
              disabled={!dirty}
              onClick={() => {
                handleSaveTopicRules(rules);
                setSavedRules(rules);
                const next = topics.filter((t) => t.status === 'suggested').filter((t) => {
                  const r = rules.find((x) => x.ruleId === t.ruleId)!;
                  return r.enabled && t.metricValue >= r.threshold;
                }).length;
                notify(`入口规则已保存，并按新规则重新计算：待确认 ${next} 条`);
                setView('topics');
                setTab('suggested');
              }}
            >
              保存并重新计算
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <FormDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        title="提报选题"
        description="按规则 R-05 进入待确认，由负责人决定是否生产。"
        fields={[
          { key: 'title', label: '选题', kind: 'text', required: true, placeholder: '例如：BL-R600 在食品包装线的应用' },
          { key: 'type', label: '建议内容类型', kind: 'select', options: CONTENT_TYPE_OPTIONS },
          { key: 'scope', label: '范围', kind: 'select', options: ['北岭智造 · 欧盟 · en-US', '北岭智造 · 中国大陆 · zh-CN', '汉川传动 · 中国大陆 · zh-CN'].map((x) => ({ value: x, label: x })) },
          { key: 'reason', label: '提报理由', kind: 'textarea', required: true, placeholder: '客户或销售的反馈、市场活动需要等' },
        ]}
        submitLabel="提报"
        onSubmit={(v: FormValues) => {
          handleCreateTopic({ title: String(v.title), contentTypeName: String(v.type), scopeLabel: String(v.scope), reason: String(v.reason) });
          const id = `TP-${43 + topics.filter((t) => t.signalKind === 'manual').length}`;
          setTopics((p) => [{ topicId: id, title: String(v.title), signalKind: 'manual', ruleId: 'R-05', metricValue: 0, evidence: `孙铭提报：${String(v.reason)}`, scopeLabel: String(v.scope), contentTypeName: String(v.type), usableFactCount: 4, missingFacts: [], priority: 'medium', status: 'suggested', ownerName: null }, ...p]);
          setView('topics');
          setTab('suggested');
          notify(`已提报 ${id}，进入待确认`);
        }}
      />
    </div>
  );
}
