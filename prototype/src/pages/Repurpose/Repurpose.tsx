import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookCheck, FileText, Loader2, Settings2, Sparkles, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { AiMark, ToneBadge, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';
import { notify } from '@/components/shared/toast';
import { nowLabel, useDemo } from '@/lib/demo-store';

// ── 配置常量 ──────────────────────────────────────────────
const TARGET_STATUS_CONFIG = {
  ready: { label: '已生成', tone: 'green' as Tone },
  generating: { label: '生成中', tone: 'blue' as Tone },
  needs_fix: { label: '检查未通过', tone: 'red' as Tone },
  not_started: { label: '未开始', tone: 'gray' as Tone },
} as const;
type TargetStatus = keyof typeof TARGET_STATUS_CONFIG;

// ── 类型 ──────────────────────────────────────────────────
interface SourceContent {
  contentId: string;
  title: string;
  contentTypeName: string;
  locale: string;
  version: number;
  wordCount: number;
  factRefCount: number;
}
// 目标格式即「生产规范 → 模板 → 一稿多用 · 目标格式」中启用的模板
interface TargetFormat {
  targetId: string;
  templateName: string;
  contentTypeName: string;
  channelGroup: string;
  channelLabel: string;
  lengthHint: string;
  assetSpec: string | null;
  inheritsFacts: boolean;
}
interface RepurposeOutput {
  targetId: string;
  contentTypeName: string;
  channelLabel: string;
  status: TargetStatus;
  draftContentId: string | null;
  previewText: string;
  factsUsed: number;
  factsDropped: number;
  issue: string | null;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockSourceContentsData: SourceContent[] = [
  { contentId: 'C-0921', title: 'BL-R600 产品手册摘要（中文）', contentTypeName: '产品说明', locale: 'zh-CN', version: 4, wordCount: 2480, factRefCount: 7 },
  { contentId: 'C-1009', title: '汽车焊装线改造：BL-R600 客户案例', contentTypeName: '客户案例', locale: 'zh-CN', version: 4, wordCount: 3120, factRefCount: 5 },
  { contentId: 'C-1004', title: 'HC-RV200 精密减速机产品说明', contentTypeName: '产品说明', locale: 'zh-CN', version: 2, wordCount: 1860, factRefCount: 9 },
];

const mockTargetFormatsData: TargetFormat[] = [
  { targetId: 'RF-01', templateName: '技术 FAQ · 官网与 AI 客服', contentTypeName: '技术 FAQ', channelGroup: '官网与 AI 搜索', channelLabel: '官网 · AI 客服', lengthHint: '8–12 问', assetSpec: null, inheritsFacts: true },
  { targetId: 'RF-02', templateName: '活动落地页', contentTypeName: '落地页', channelGroup: '官网与 AI 搜索', channelLabel: '官网活动页', lengthHint: '首屏 + 3 个卖点 + CTA', assetSpec: '首屏 16:9', inheritsFacts: true },
  { targetId: 'RF-03', templateName: '公众号长文', contentTypeName: '公众号文章', channelGroup: '社媒', channelLabel: '微信公众号', lengthHint: '1200 字左右', assetSpec: '封面 2.35:1', inheritsFacts: true },
  { targetId: 'RF-05', templateName: 'Instagram 图文', contentTypeName: '社媒短帖', channelGroup: '社媒', channelLabel: 'Instagram', lengthHint: '≤ 2200 字符 + 话题标签', assetSpec: '1:1 或 4:5', inheritsFacts: false },
  { targetId: 'RF-06', templateName: 'Facebook 帖子', contentTypeName: '社媒短帖', channelGroup: '社媒', channelLabel: 'Facebook', lengthHint: '≤ 500 字 + 链接卡片', assetSpec: '1.91:1', inheritsFacts: false },
  { targetId: 'RF-07', templateName: '销售话术卡', contentTypeName: '销售话术卡', channelGroup: '销售', channelLabel: 'CRM · 销售助手', lengthHint: '要点 + 异议应对', assetSpec: null, inheritsFacts: true },
  { targetId: 'RF-08', templateName: '知识库条目', contentTypeName: '知识条目', channelGroup: '知识库', channelLabel: 'KDH 知识库', lengthHint: '问答对 + 结构化摘要', assetSpec: null, inheritsFacts: true },
];

const mockRepurposeOutputsData: RepurposeOutput[] = [
  { targetId: 'RF-01', contentTypeName: '技术 FAQ', channelLabel: '官网 · AI 客服', status: 'ready', draftContentId: 'C-1060', previewText: 'Q：BL-R600 能在多粉尘的焊装车间使用吗？A：整机防护等级 IP66（TÜV 检测报告 TÜV-2026-1188）……', factsUsed: 5, factsDropped: 0, issue: null },
  { targetId: 'RF-02', contentTypeName: '落地页', channelLabel: '官网活动页', status: 'needs_fix', draftContentId: 'C-1061', previewText: '20 kg 负载，1700 mm 工作半径，8 周极速交付……', factsUsed: 4, factsDropped: 1, issue: '「8 周交付」与事实 F-007（12 周，CF-021 已裁定）不一致；交期是红线字段，需改为引用事实' },
  { targetId: 'RF-05', contentTypeName: '社媒短帖', channelLabel: 'Instagram', status: 'ready', draftContentId: 'C-1064', previewText: '18 months in a dusty welding cell. Zero seal failures. 🤖 #industrialrobot #welding #automation #BLR600', factsUsed: 1, factsDropped: 4, issue: null },
  { targetId: 'RF-03', contentTypeName: '公众号文章', channelLabel: '微信公众号', status: 'generating', draftContentId: null, previewText: '', factsUsed: 0, factsDropped: 0, issue: null },
  { targetId: 'RF-07', contentTypeName: '销售话术卡', channelLabel: 'CRM · 销售助手', status: 'ready', draftContentId: 'C-1062', previewText: '核心卖点：①中空腕部，焊枪走线不缠绕 ②IP66 ③±0.02 mm 重复定位精度；客户问“比竞品贵”时……', factsUsed: 5, factsDropped: 2, issue: null },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取可作为源的内容 [GET] /api/v1/contents
function handleFetchSourceContents(params: { status: 'published'; keyword: string }) {
  console.log('fetch sources', params);
}

// ACTION: 获取可用目标格式 [GET] /api/v1/repurpose/targets
function handleFetchTargetFormats(sourceContentId: string) {
  console.log('fetch targets', sourceContentId);
}

// ACTION: 发起一稿多用 [POST] /api/v1/repurpose-jobs
function handleStartRepurpose(sourceContentId: string, targetIds: string[]) {
  console.log('start repurpose', sourceContentId, targetIds);
}

// ACTION: 获取一稿多用结果 [GET] /api/v1/repurpose-jobs/{jobId}/outputs
function handleFetchRepurposeOutputs(jobId: string) {
  console.log('fetch outputs', jobId);
}

// ACTION: 重新生成单个目标 [POST] /api/v1/repurpose-jobs/{jobId}/outputs/{targetId}/regenerate
function handleRegenerateOutput(jobId: string, targetId: string) {
  console.log('regenerate', jobId, targetId);
}

// ── 主组件 ────────────────────────────────────────────────
export default function Repurpose() {
  const navigate = useNavigate();
  const { state: demo, dispatch } = useDemo();
  const [sourceId, setSourceId] = useState('C-0921');
  const [picked, setPicked] = useState<string[]>(['RF-01', 'RF-02', 'RF-05', 'RF-03', 'RF-07']);
  const targets: TargetFormat[] = [
    ...mockTargetFormatsData,
    ...demo.templates.filter((t) => t.templateKind === 'repurpose' && t.enabled).map((t) => ({ targetId: t.templateId, templateName: t.templateName, contentTypeName: t.contentTypeName, channelGroup: '社媒', channelLabel: t.channelLabel, lengthHint: t.structure, assetSpec: null, inheritsFacts: false })),
  ];
  // 打开草稿：把改写稿作为一条内容存入「全部内容」，来源记为一稿多用
  const openDraft = (o: RepurposeOutput) => {
    const id = o.draftContentId!;
    if (!demo.created.some((c) => c.contentId === id)) {
      const t = targets.find((x) => x.targetId === o.targetId);
      dispatch({
        type: 'createContent',
        content: {
          contentId: id,
          title: `${source.title.replace('（中文）', '')} · ${o.channelLabel}`,
          summary: o.previewText.slice(0, 80),
          contentTypeName: o.contentTypeName,
          brandName: '北岭智造',
          regionLabel: source.locale === 'zh-CN' ? '中国大陆' : '欧盟',
          locale: source.locale,
          sections: [{ heading: o.channelLabel, body: o.previewText }],
          source: { kind: 'repurpose', topicId: null, taskId: 'RP-0218', templateId: o.targetId, templateName: t?.templateName ?? null, sourceContentId: `${source.contentId} v${source.version}`, refs: [{ refKind: 'content', refId: source.contentId, label: `${source.contentId} ${source.title}` }] },
          ownerName: '林悦',
          createdAt: `今天 ${nowLabel()}`,
        },
      });
    }
    navigate(`/content/edit/${id}`);
  };
  const [started, setStarted] = useState(true);
  const source = mockSourceContentsData.find((s) => s.contentId === sourceId)!;
  const sourceItems = mockSourceContentsData.map((s) => ({ value: s.contentId, label: s.title }));

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="一稿多用"
        description="选一篇已生效的源内容，一次生成多种目标类型。目标稿继承源内容引用的事实（不重新编造），每篇都是独立草稿，走各自的检查和审核。"
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader>
            <CardTitle>1 · 源内容</CardTitle>
            <CardDescription>只能选已生效版本，保证事实已经过审。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select items={sourceItems} value={sourceId} onValueChange={(v) => { setSourceId(v as string); handleFetchTargetFormats(v as string); setStarted(false); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sourceItems.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <FileText className="size-4 text-muted-foreground" /> {source.title}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
                <span>类型：{source.contentTypeName}</span>
                <span>语种：{source.locale}</span>
                <span>版本：v{source.version}（已生效）</span>
                <span>字数：{source.wordCount.toLocaleString()}</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs text-teal-700">
                <BookCheck className="size-3.5" /> 引用事实 {source.factRefCount} 条，目标稿只能使用这些事实
              </div>
            </div>
            <Button variant="link" className="h-auto px-0" onClick={() => handleFetchSourceContents({ status: 'published', keyword: '' })}>
              浏览全部已生效内容
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2 · 目标格式</CardTitle>
            <CardDescription>
              来自「生产规范 → 模板 → 一稿多用 · 目标格式」中启用的模板，按渠道分组。
              <button className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline" onClick={() => navigate('/production/standards', { state: { templateKind: 'repurpose' } })}>
                <Settings2 className="size-3" /> 管理目标格式
              </button>
            </CardDescription>
            <CardAction>
              <Button
                disabled={picked.length === 0}
                onClick={() => { handleStartRepurpose(sourceId, picked); setStarted(true); notify(`已发起 RP-0218：${picked.length} 个目标格式，生成的稿件各自进入「全部内容」，来源记为一稿多用`); }}
              >
                <Sparkles /> 生成 {picked.length} 篇
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            {targets.map((t) => (
              <Label key={t.targetId} className={cn('flex items-start gap-3 rounded-md border p-3 font-normal', picked.includes(t.targetId) && 'border-primary/50 bg-primary/5')}>
                <Checkbox
                  className="mt-0.5"
                  checked={picked.includes(t.targetId)}
                  onCheckedChange={(c) => setPicked((p) => (c ? [...p, t.targetId] : p.filter((x) => x !== t.targetId)))}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t.contentTypeName}</span>
                    <ToneBadge tone="blue">{t.channelLabel}</ToneBadge>
                    <span className="text-xs text-muted-foreground">{t.channelGroup}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t.targetId}「{t.templateName}」· {t.lengthHint}
                    {t.assetSpec && ` · 素材 ${t.assetSpec}`}
                  </div>
                  {!t.inheritsFacts && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                      <TriangleAlert className="size-3" /> 该类型没有事实插槽，参数只能写进正文，事实更新后需要复核
                    </div>
                  )}
                </div>
              </Label>
            ))}
          </CardContent>
        </Card>
      </div>

      {started && (
        <Card>
          <CardHeader>
            <CardTitle>3 · 生成结果</CardTitle>
            <CardDescription>任务 RP-0218 · 源 {source.contentId} v{source.version}</CardDescription>
            <CardAction>
              <Button size="sm" variant="outline" onClick={() => handleFetchRepurposeOutputs('RP-0218')}>
                刷新
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>目标</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>预览</TableHead>
                  <TableHead className="text-right">事实</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRepurposeOutputsData.map((o) => (
                  <TableRow key={o.targetId}>
                    <TableCell>
                      <div className="font-medium">{o.contentTypeName}</div>
                      <div className="text-xs text-muted-foreground">{o.channelLabel}</div>
                    </TableCell>
                    <TableCell>
                      {o.status === 'generating' ? (
                        <span className="inline-flex items-center gap-1 text-sm text-blue-600">
                          <Loader2 className="size-3.5 animate-spin" /> 生成中
                        </span>
                      ) : (
                        <ToneBadge tone={TARGET_STATUS_CONFIG[o.status].tone}>{TARGET_STATUS_CONFIG[o.status].label}</ToneBadge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-96 whitespace-normal">
                      {o.previewText && (
                        <div className="flex items-start gap-2 text-sm">
                          <AiMark className="shrink-0" />
                          <span className="line-clamp-2 text-muted-foreground">{o.previewText}</span>
                        </div>
                      )}
                      {o.issue && <div className="mt-1 text-xs text-red-700">{o.issue}</div>}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      用 {o.factsUsed}
                      {o.factsDropped > 0 && <div className="text-muted-foreground">未用 {o.factsDropped}</div>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {o.draftContentId && (
                        <Button size="xs" variant="outline" onClick={() => openDraft(o)}>
                          打开草稿 <ArrowRight />
                        </Button>
                      )}
                      {o.status !== 'generating' && (
                        <Button size="xs" variant="ghost" onClick={() => { handleRegenerateOutput('RP-0218', o.targetId); notify(`已按模板 ${o.targetId} 重新生成`); }}>
                          重新生成
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
