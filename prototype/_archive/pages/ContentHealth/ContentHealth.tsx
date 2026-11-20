import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ToneBadge, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const ISSUE_TYPE_CONFIG = {
  expired_fact: { label: '引用过期事实', tone: 'red' as Tone, fixPath: '/facts' },
  open_conflict: { label: '存在未处理冲突', tone: 'red' as Tone, fixPath: '/facts/conflicts' },
  missing_locale: { label: '缺语种版本', tone: 'amber' as Tone, fixPath: '/production/translations' },
  missing_summary: { label: '缺 AI 摘要 / 结构化标注', tone: 'amber' as Tone, fixPath: '/content' },
  broken_asset: { label: '资产失效或授权到期', tone: 'red' as Tone, fixPath: '/assets' },
  stale_content: { label: '超过 12 个月未更新', tone: 'gray' as Tone, fixPath: '/content' },
} as const;
type IssueType = keyof typeof ISSUE_TYPE_CONFIG;
const DIMENSION_OPTIONS = [
  { value: 'brand', label: '按品牌' },
  { value: 'content_type', label: '按内容类型' },
  { value: 'region', label: '按区域' },
];

// ── 类型 ──────────────────────────────────────────────────
interface HealthStats {
  overallScore: number;
  lastWeekScore: number;
  totalContents: number;
  healthyContents: number;
  aiReadyRate: number;
  issueCounts: Record<IssueType, number>;
}
interface HealthBreakdown {
  groupLabel: string;
  contentCount: number;
  score: number;
  topIssue: IssueType;
  topIssueCount: number;
}
interface HealthIssueItem {
  contentId: string;
  title: string;
  issueType: IssueType;
  detail: string;
  ownerName: string;
  sinceDays: number;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockHealthStats: HealthStats = {
  overallScore: 82,
  lastWeekScore: 79,
  totalContents: 214,
  healthyContents: 158,
  aiReadyRate: 86,
  issueCounts: { expired_fact: 6, open_conflict: 5, missing_locale: 23, missing_summary: 31, broken_asset: 4, stale_content: 9 },
};

const mockHealthBreakdownData: HealthBreakdown[] = [
  { groupLabel: '北岭智造', contentCount: 142, score: 80, topIssue: 'missing_summary', topIssueCount: 20 },
  { groupLabel: '汉川传动', contentCount: 61, score: 83, topIssue: 'missing_locale', topIssueCount: 14 },
  { groupLabel: '集团公共', contentCount: 11, score: 91, topIssue: 'stale_content', topIssueCount: 3 },
];

const mockHealthIssuesData: HealthIssueItem[] = [
  { contentId: 'C-1002', title: 'BL-R600 Product Brief', issueType: 'open_conflict', detail: '防护等级：IP66 / IP65 取值冲突（CF-018），正文引用', ownerName: '林悦', sinceDays: 1 },
  { contentId: 'C-0877', title: 'HC-SD75 Servo Drive Datasheet', issueType: 'expired_fact', detail: 'UL 认证（F-014）2026-09-30 已到期', ownerName: '周敏', sinceDays: 50 },
  { contentId: 'C-1021', title: '东南亚经销商大会回顾', issueType: 'broken_asset', detail: '引用图片 A-2050 源已删除，且只引用、无本地副本', ownerName: '林悦', sinceDays: 0 },
  { contentId: 'C-1009', title: '汽车焊装线改造：BL-R600 客户案例', issueType: 'missing_locale', detail: '目标市场为东南亚，缺 th-TH', ownerName: '林悦', sinceDays: 6 },
  { contentId: 'C-0702', title: '2024 版选型指南', issueType: 'stale_content', detail: '最后更新 2025-08，仍被 2 个调用方读取', ownerName: '周敏', sinceDays: 460 },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取健康度统计 [GET] /api/v1/insights/health/stats
function handleFetchHealthStats(params: { brand: string; region: string }) {
  console.log('fetch stats', params);
}

// ACTION: 获取健康度分组 [GET] /api/v1/insights/health/breakdown
function handleFetchHealthBreakdown(params: { dimension: string }) {
  console.log('fetch breakdown', params);
}

// ACTION: 获取健康问题清单 [GET] /api/v1/insights/health/issues
function handleFetchHealthIssues(params: { issueType: IssueType | 'all'; page: number }) {
  console.log('fetch issues', params);
}

// ACTION: 导出健康报告 [GET] /api/v1/insights/health/export
function handleExportHealthReport() {
  alert('正在导出健康度报告（Excel）');
}

// ── 主组件 ────────────────────────────────────────────────
export default function ContentHealth() {
  const navigate = useNavigate();
  const [dimension, setDimension] = useState('brand');
  const [issueType, setIssueType] = useState<IssueType | 'all'>('all');
  const s = mockHealthStats;
  const delta = s.overallScore - s.lastWeekScore;
  const issues = mockHealthIssuesData.filter((i) => issueType === 'all' || i.issueType === issueType);
  const maxIssue = Math.max(...Object.values(s.issueCounts));

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="内容健康度"
        description="已生效内容是否可信、完整、可被 AI 正确使用。分数按问题数量和严重程度计算；点问题类型直接跳到对应的处理入口。"
        actions={
          <>
            <Button variant="outline" onClick={() => handleExportHealthReport()}>
              <Download /> 导出报告
            </Button>
            <Button onClick={() => navigate('/production/topics')}>
              问题转为选题 <ArrowRight />
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>健康分</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{s.overallScore}</CardTitle>
          </CardHeader>
          <CardContent className={cn('text-xs', delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            较上周 {delta >= 0 ? '+' : ''}
            {delta}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>无问题内容</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {s.healthyContents}
              <span className="text-base font-normal text-muted-foreground"> / {s.totalContents}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={(s.healthyContents / s.totalContents) * 100} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>AI 可用率</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{s.aiReadyRate}%</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">有摘要、结构化标注、事实引用完整</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>严重问题</CardDescription>
            <CardTitle className="text-3xl text-red-600 tabular-nums">{s.issueCounts.expired_fact + s.issueCounts.open_conflict + s.issueCounts.broken_asset}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">过期事实 · 冲突 · 资产失效</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>问题分布</CardTitle>
            <CardDescription>点击一类问题筛选下方清单</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(Object.keys(ISSUE_TYPE_CONFIG) as IssueType[]).map((k) => (
              <button
                key={k}
                onClick={() => { setIssueType(k); handleFetchHealthIssues({ issueType: k, page: 1 }); }}
                className={cn('grid w-full grid-cols-[150px_1fr_40px] items-center gap-3 rounded px-1 py-0.5 text-left text-sm hover:bg-muted', issueType === k && 'bg-muted')}
              >
                <span className="truncate">{ISSUE_TYPE_CONFIG[k].label}</span>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className={cn('h-2 rounded-full', ISSUE_TYPE_CONFIG[k].tone === 'red' ? 'bg-red-500' : ISSUE_TYPE_CONFIG[k].tone === 'amber' ? 'bg-amber-500' : 'bg-slate-400')}
                    style={{ width: `${(s.issueCounts[k] / maxIssue) * 100}%` }}
                  />
                </div>
                <span className="text-right tabular-nums">{s.issueCounts[k]}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>分组对比</CardTitle>
            <CardAction>
              <Select items={DIMENSION_OPTIONS} value={dimension} onValueChange={(v) => { setDimension(v as string); handleFetchHealthBreakdown({ dimension: v as string }); }}>
                <SelectTrigger size="sm" className="w-32">
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
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>分组</TableHead>
                  <TableHead className="text-right">内容数</TableHead>
                  <TableHead className="text-right">健康分</TableHead>
                  <TableHead>主要问题</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockHealthBreakdownData.map((b) => (
                  <TableRow key={b.groupLabel}>
                    <TableCell className="font-medium">{b.groupLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.contentCount}</TableCell>
                    <TableCell className={cn('text-right font-medium tabular-nums', b.score < 80 && 'text-amber-600')}>{b.score}</TableCell>
                    <TableCell className="text-sm">
                      {ISSUE_TYPE_CONFIG[b.topIssue].label} <span className="text-muted-foreground">{b.topIssueCount}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>问题清单{issueType !== 'all' && ` · ${ISSUE_TYPE_CONFIG[issueType].label}`}</CardTitle>
          <CardAction>
            {issueType !== 'all' && (
              <Button size="sm" variant="ghost" onClick={() => { setIssueType('all'); handleFetchHealthIssues({ issueType: 'all', page: 1 }); }}>
                清除筛选
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>内容</TableHead>
                <TableHead>问题</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>持续</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((i) => (
                <TableRow key={`${i.contentId}-${i.issueType}`}>
                  <TableCell>
                    <button className="text-left hover:underline" onClick={() => navigate(`/content/edit/${i.contentId}`)}>
                      {i.title}
                    </button>
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={ISSUE_TYPE_CONFIG[i.issueType].tone}>{ISSUE_TYPE_CONFIG[i.issueType].label}</ToneBadge>
                  </TableCell>
                  <TableCell className="max-w-80 text-sm whitespace-normal text-muted-foreground">{i.detail}</TableCell>
                  <TableCell className="text-sm">{i.ownerName}</TableCell>
                  <TableCell className={cn('text-sm', i.sinceDays > 30 && 'text-red-600')}>{i.sinceDays === 0 ? '今天' : `${i.sinceDays} 天`}</TableCell>
                  <TableCell className="text-right">
                    <Button size="xs" variant="outline" onClick={() => navigate(ISSUE_TYPE_CONFIG[i.issueType].fixPath)}>
                      去处理 <ArrowRight />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-2 text-xs text-muted-foreground">
            <button className="underline" onClick={() => handleFetchHealthStats({ brand: 'all', region: 'all' })}>
              重新计算
            </button>{' '}
            · 每小时自动刷新
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
