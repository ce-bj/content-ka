import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { ToneBadge } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const PERIOD_OPTIONS = [
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
  { value: '90d', label: '近 90 天' },
];

// ── 类型 ──────────────────────────────────────────────────
interface UsageStats {
  totalCalls: number;
  callsDelta: number;
  distinctContents: number;
  reuseRate: number;
  forbiddenCalls: number;
  mcpCallShare: number;
}
interface ConsumerUsage {
  consumerName: string;
  channelKind: '网站' | 'MCP' | '小程序' | '门户';
  calls: number;
  distinctContents: number;
  forbiddenCalls: number;
  topContentType: string;
}
interface ContentTypeUsage {
  contentTypeName: string;
  contentCount: number;
  calledCount: number;
  avgConsumersPerContent: number;
}
interface ContentPerformance {
  contentId: string;
  title: string;
  version: number;
  consumerName: string;
  views: number | null;
  ctr: number | null;
  leads: number | null;
  aiAnswerHits: number | null;
  helpfulRate: number | null;
  reportedAt: string;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockUsageStats: UsageStats = { totalCalls: 233700, callsDelta: 12.4, distinctContents: 186, reuseRate: 2.7, forbiddenCalls: 181, mcpCallShare: 12 };

const mockConsumerUsageData: ConsumerUsage[] = [
  { consumerName: '欧盟官网（AI 门户）', channelKind: '网站', calls: 134200, distinctContents: 82, forbiddenCalls: 0, topContentType: '产品说明' },
  { consumerName: '北岭智造微信小程序', channelKind: '小程序', calls: 42200, distinctContents: 64, forbiddenCalls: 13, topContentType: '产品说明' },
  { consumerName: '中国官网（AI 门户）', channelKind: '网站', calls: 26700, distinctContents: 96, forbiddenCalls: 0, topContentType: '技术 FAQ' },
  { consumerName: 'GEO Agent', channelKind: 'MCP', calls: 17700, distinctContents: 172, forbiddenCalls: 52, topContentType: '技术 FAQ' },
  { consumerName: 'SDR Agent', channelKind: 'MCP', calls: 11100, distinctContents: 58, forbiddenCalls: 0, topContentType: '销售话术卡' },
  { consumerName: 'Nordwerk GmbH 经销商门户', channelKind: '门户', calls: 1800, distinctContents: 38, forbiddenCalls: 116, topContentType: '销售资料' },
];

const mockContentTypeUsageData: ContentTypeUsage[] = [
  { contentTypeName: '产品说明', contentCount: 48, calledCount: 46, avgConsumersPerContent: 3.4 },
  { contentTypeName: '技术 FAQ', contentCount: 96, calledCount: 88, avgConsumersPerContent: 2.9 },
  { contentTypeName: '客户案例', contentCount: 22, calledCount: 13, avgConsumersPerContent: 1.6 },
  { contentTypeName: '白皮书', contentCount: 8, calledCount: 3, avgConsumersPerContent: 1.1 },
];

const mockContentPerformanceData: ContentPerformance[] = [
  { contentId: 'C-0921', title: 'BL-R600 产品手册摘要（中文）', version: 4, consumerName: '中国官网（AI 门户）', views: 18240, ctr: 6.8, leads: 42, aiAnswerHits: null, helpfulRate: null, reportedAt: '今天 06:00' },
  { contentId: 'C-0921', title: 'BL-R600 产品手册摘要（中文）', version: 3, consumerName: '中国官网（AI 门户）', views: 15100, ctr: 4.9, leads: 27, aiAnswerHits: null, helpfulRate: null, reportedAt: '11-10' },
  { contentId: 'C-1004', title: 'HC-RV200 精密减速机产品说明', version: 2, consumerName: 'SDR Agent', views: null, ctr: null, leads: null, aiAnswerHits: 3260, helpfulRate: 88, reportedAt: '今天 06:00' },
  { contentId: 'C-1062', title: 'BL-R600 销售话术卡', version: 1, consumerName: 'SDR Agent', views: null, ctr: null, leads: 9, aiAnswerHits: 410, helpfulRate: 72, reportedAt: '昨天' },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取使用统计 [GET] /api/v1/insights/usage/stats
function handleFetchUsageStats(params: { period: string }) {
  console.log('fetch usage stats', params);
}

// ACTION: 获取调用方用量 [GET] /api/v1/insights/usage/consumers
function handleFetchConsumerUsage(params: { period: string }) {
  console.log('fetch consumer usage', params);
}

// ACTION: 获取内容类型用量 [GET] /api/v1/insights/usage/content-types
function handleFetchContentTypeUsage(params: { period: string }) {
  console.log('fetch type usage', params);
}

// ACTION: 获取内容效果 [GET] /api/v1/insights/performance
function handleFetchContentPerformance(params: { period: string; consumer: string }) {
  console.log('fetch performance', params);
}

// ── 主组件 ────────────────────────────────────────────────
export default function UsageInsights() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('30d');
  const s = mockUsageStats;
  const maxCalls = Math.max(...mockConsumerUsageData.map((c) => c.calls));

  const reload = (p: string) => {
    setPeriod(p);
    handleFetchUsageStats({ period: p });
    handleFetchConsumerUsage({ period: p });
    handleFetchContentTypeUsage({ period: p });
  };

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="效果回流"
        description="对接数据底座与各分发平台：调用数据来自内容市场的取用接口；效果数据由数据底座 / 调用方按内容 + 版本回传。CMS 不采集前端埋点、不做归因计算。"
        actions={
          <Select items={PERIOD_OPTIONS} value={period} onValueChange={(v) => reload(v as string)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Tabs defaultValue="usage" onValueChange={(v) => v === 'performance' && handleFetchContentPerformance({ period, consumer: 'all' })}>
        <TabsList>
          <TabsTrigger value="usage">调用与复用</TabsTrigger>
          <TabsTrigger value="performance">内容效果</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4 pt-3">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card size="sm">
              <CardHeader>
                <CardDescription>调用次数</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{s.totalCalls.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-emerald-600">环比 +{s.callsDelta}%</CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>被调用的内容</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{s.distinctContents.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">至少被调用 1 次</CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>复用率</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{s.reuseRate}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">平均每条内容被几个调用方使用</CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>越界请求（403）</CardDescription>
                <CardTitle className="text-2xl text-amber-600 tabular-nums">{s.forbiddenCalls}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">MCP 占调用量 {s.mcpCallShare}%</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>按调用方 / 站点</CardTitle>
              <CardDescription>站点类调用方（欧盟官网、中国官网）即多域统一报表口径；明细在数据底座。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>调用方</TableHead>
                    <TableHead className="w-[35%]">调用次数</TableHead>
                    <TableHead className="text-right">内容数</TableHead>
                    <TableHead className="text-right">越界</TableHead>
                    <TableHead>最常用类型</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockConsumerUsageData.map((c) => (
                    <TableRow key={c.consumerName}>
                      <TableCell>
                        <div className="font-medium">{c.consumerName}</div>
                        <ToneBadge tone={c.channelKind === 'MCP' ? 'violet' : 'gray'}>{c.channelKind}</ToneBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(c.calls / maxCalls) * 100}%` }} />
                          </div>
                          <span className="w-16 text-right text-xs tabular-nums">{c.calls.toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.distinctContents}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', c.forbiddenCalls > 100 && 'text-amber-600')}>{c.forbiddenCalls}</TableCell>
                      <TableCell className="text-sm">{c.topContentType}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">Nordwerk 经销商门户的越界请求偏多，多为请求授权集合 COL-12 以外的内容；GEO Agent 曾尝试读取价格字段。可在「内容市场 → 对接方与接口」里收紧其取用范围。</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>按内容类型</CardTitle>
              <CardDescription>“从未被调用”的内容是精简或下线的候选。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容类型</TableHead>
                    <TableHead className="text-right">内容数</TableHead>
                    <TableHead className="text-right">被调用</TableHead>
                    <TableHead className="text-right">从未被调用</TableHead>
                    <TableHead className="text-right">平均调用方数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockContentTypeUsageData.map((t) => (
                    <TableRow key={t.contentTypeName}>
                      <TableCell className="font-medium">{t.contentTypeName}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.contentCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.calledCount}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', t.contentCount - t.calledCount > 5 && 'text-amber-600')}>{t.contentCount - t.calledCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.avgConsumersPerContent}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4 pt-3">
          <div className="flex items-start gap-2 rounded-md border bg-card p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            效果数据由调用方通过 <code className="rounded bg-muted px-1">POST /api/v1/performance-events</code> 回传，按内容 ID + 版本号归档，用来对比改版前后的效果。没回传的指标显示为“—”。
            <Button size="sm" variant="outline" className="ml-auto shrink-0" onClick={() => navigate('/production/topics')}>
              据此生成选题 <ArrowRight />
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>内容效果（按版本）</CardTitle>
              <CardAction>
                <span className="text-xs text-muted-foreground">同一内容的不同版本相邻展示</span>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容 · 版本</TableHead>
                    <TableHead>调用方</TableHead>
                    <TableHead className="text-right">浏览</TableHead>
                    <TableHead className="text-right">点击率</TableHead>
                    <TableHead className="text-right">线索</TableHead>
                    <TableHead className="text-right">AI 回答命中</TableHead>
                    <TableHead className="text-right">有帮助</TableHead>
                    <TableHead>回传时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockContentPerformanceData.map((p) => (
                    <TableRow key={`${p.contentId}-${p.version}-${p.consumerName}`}>
                      <TableCell>
                        <button className="text-left hover:underline" onClick={() => navigate(`/content/edit/${p.contentId}`)}>
                          {p.title}
                        </button>
                        <span className="ml-1.5 text-xs text-muted-foreground">v{p.version}</span>
                      </TableCell>
                      <TableCell className="text-sm">{p.consumerName}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.views?.toLocaleString() ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.ctr !== null ? `${p.ctr}%` : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.leads ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.aiAnswerHits?.toLocaleString() ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.helpfulRate !== null ? `${p.helpfulRate}%` : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.reportedAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
