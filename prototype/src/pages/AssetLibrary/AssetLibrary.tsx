import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CloudDownload, Folder, Sparkles, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssetThumb, type MediaType } from '@/components/shared/AssetThumb';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormDialog, type FormValues } from '@/components/shared/FormDialog';
import { notify } from '@/components/shared/toast';
import { SyncBadge, ToneBadge, type SyncStatus, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
type AssetStatus = 'pending_review' | 'available' | 'rights_expired' | 'disabled';
const ASSET_STATUS_CONFIG: Record<AssetStatus, { label: string; tone: Tone }> = {
  pending_review: { label: '待审', tone: 'blue' },
  available: { label: '可用', tone: 'green' },
  rights_expired: { label: '授权到期', tone: 'red' },
  disabled: { label: '已停用', tone: 'gray' },
};
type AiState = 'done' | 'processing' | 'pending_confirm' | 'failed';
const AI_STATE_CONFIG: Record<AiState, { label: string; tone: Tone }> = {
  done: { label: 'AI 已确认', tone: 'green' },
  processing: { label: 'AI 处理中', tone: 'blue' },
  pending_confirm: { label: 'AI 待确认', tone: 'violet' },
  failed: { label: 'AI 失败', tone: 'red' },
};
const TASK_KIND_LABEL = {
  ocr: '文字识别',
  tagging: '识图打标',
  transcribe: '语音转写 / 字幕',
  summary: '摘要',
  keyframes: '关键帧',
  fact_extract: '事实候选抽取',
} as const;
type AiTaskKind = keyof typeof TASK_KIND_LABEL;
const MEDIA_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'document', label: '文档' },
  { value: 'audio', label: '音频' },
];
const SEARCH_EXAMPLES = ['带 CE 标志的产品图', '去年汉诺威展 BL-R600 现场照片', '讲到防护等级的视频片段', '白底产品图 正面'];

// ── 类型 ──────────────────────────────────────────────────
interface AssetSource {
  sourceId: string;
  sourceName: string;
  sourceKind: 'local' | 'connector';
  assetCount: number;
}
interface AssetItem {
  assetId: string;
  fileName: string;
  mediaType: MediaType;
  sizeLabel: string;
  dimensionLabel: string;
  sourceName: string;
  storageMode: 'copy' | 'reference' | 'local';
  syncStatus: SyncStatus;
  rightsLabel: string;
  rightsExpiresAt: string | null;
  status: AssetStatus;
  aiState: AiState;
  tags: string[];
  referencedCount: number;
  matchReason: string | null;
  updatedAt: string;
}
interface AiTask {
  taskId: string;
  assetId: string;
  fileName: string;
  mediaType: MediaType;
  taskKind: AiTaskKind;
  status: 'queued' | 'running' | 'pending_confirm' | 'failed';
  progress: number;
  confidence: number | null;
  resultPreview: string;
}
interface AssetDetail {
  assetId: string;
  fileName: string;
  mediaType: MediaType;
  sourceName: string;
  storageMode: 'copy' | 'reference' | 'local';
  externalId: string | null;
  externalVersion: string | null;
  lastSyncedAt: string | null;
  syncStatus: SyncStatus;
  titles: { locale: string; title: string; alt: string }[];
  rights: { copyright: string; regions: string; channels: string; expiresAt: string | null };
  aiTags: { label: string; confidence: number; confirmed: boolean }[];
  ocrText: string;
  factCandidates: { attributeName: string; valueLabel: string; confidence: number }[];
  references: { contentId: string; title: string; contentStatus: string }[];
}
interface ImportConnector {
  connectorId: string;
  connectorName: string;
  defaultMode: 'copy' | 'reference';
  status: 'connected' | 'auth_expired';
}
interface ExternalFile {
  externalId: string;
  fileName: string;
  mediaType: MediaType;
  sizeLabel: string;
  modifiedAt: string;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockAssetSourcesData: AssetSource[] = [
  { sourceId: 'all', sourceName: '全部来源', sourceKind: 'local', assetCount: 3412 },
  { sourceId: 'local', sourceName: '本地上传', sourceKind: 'local', assetCount: 1288 },
  { sourceId: 'musedam', sourceName: '特赞 MuseDAM', sourceKind: 'connector', assetCount: 1406 },
  { sourceId: 'feishu', sourceName: '飞书云空间', sourceKind: 'connector', assetCount: 512 },
  { sourceId: 'sharepoint', sourceName: 'SharePoint（欧洲子公司）', sourceKind: 'connector', assetCount: 164 },
  { sourceId: 'pim', sourceName: 'Pimcore PIM', sourceKind: 'connector', assetCount: 42 },
];

// PAGINATION: page,pageSize
const mockAssetsData: AssetItem[] = [
  { assetId: 'A-2207', fileName: 'hannover-2026-welding-line.jpg', mediaType: 'image', sizeLabel: '4.2 MB', dimensionLabel: '6000×4000', sourceName: '特赞 MuseDAM', storageMode: 'copy', syncStatus: 'synced', rightsLabel: '摄影师授权 · 全渠道', rightsExpiresAt: '2026-12-01', status: 'available', aiState: 'done', tags: ['BL-R600', '焊接', '展会', '汉诺威'], referencedCount: 4, matchReason: '命中标签：展会、汉诺威', updatedAt: '2026-11-02' },
  { assetId: 'A-2190', fileName: 'BL-R600-white-bg-front.png', mediaType: 'image', sizeLabel: '2.1 MB', dimensionLabel: '3000×3000', sourceName: 'Pimcore PIM', storageMode: 'copy', syncStatus: 'source_updated', rightsLabel: '自有 · 全渠道', rightsExpiresAt: null, status: 'available', aiState: 'done', tags: ['BL-R600', '白底', '正面', 'CE 标志'], referencedCount: 11, matchReason: '画面识别：CE 标志', updatedAt: '2026-11-18' },
  { assetId: 'A-2311', fileName: 'BL-R600-palletizing-demo.mp4', mediaType: 'video', sizeLabel: '186 MB', dimensionLabel: '03:42', sourceName: '本地上传', storageMode: 'local', syncStatus: 'local_only', rightsLabel: '自有 · 官网与社媒', rightsExpiresAt: null, status: 'pending_review', aiState: 'pending_confirm', tags: ['码垛', 'BL-R600'], referencedCount: 0, matchReason: '字幕 01:12 提到 “IP66”', updatedAt: '2026-11-19' },
  { assetId: 'A-1987', fileName: 'TUV-2026-1188-report.pdf', mediaType: 'document', sizeLabel: '1.3 MB', dimensionLabel: '14 页', sourceName: '飞书云空间', storageMode: 'copy', syncStatus: 'synced', rightsLabel: '仅下载区', rightsExpiresAt: null, status: 'available', aiState: 'done', tags: ['检测报告', 'TÜV', '防护等级'], referencedCount: 2, matchReason: null, updatedAt: '2026-03-02' },
  { assetId: 'A-2050', fileName: 'distributor-event-sea-2025.jpg', mediaType: 'image', sizeLabel: '3.6 MB', dimensionLabel: '5472×3648', sourceName: 'SharePoint（欧洲子公司）', storageMode: 'reference', syncStatus: 'source_deleted', rightsLabel: '活动方授权 · 社媒', rightsExpiresAt: '2026-08-31', status: 'rights_expired', aiState: 'done', tags: ['经销商', '活动'], referencedCount: 1, matchReason: null, updatedAt: '2025-09-10' },
  { assetId: 'A-2320', fileName: 'HC-RV200-type-test-scan.pdf', mediaType: 'document', sizeLabel: '8.9 MB', dimensionLabel: '22 页', sourceName: '本地上传', storageMode: 'local', syncStatus: 'local_only', rightsLabel: '内部', rightsExpiresAt: null, status: 'pending_review', aiState: 'processing', tags: [], referencedCount: 0, matchReason: null, updatedAt: '2026-11-19' },
  { assetId: 'A-2101', fileName: 'ceo-interview-cn.m4a', mediaType: 'audio', sizeLabel: '24 MB', dimensionLabel: '18:20', sourceName: '飞书云空间', storageMode: 'copy', syncStatus: 'sync_failed', rightsLabel: '自有', rightsExpiresAt: null, status: 'available', aiState: 'failed', tags: ['访谈'], referencedCount: 0, matchReason: null, updatedAt: '2026-11-11' },
];

const mockAiTasksData: AiTask[] = [
  { taskId: 'AI-901', assetId: 'A-2311', fileName: 'BL-R600-palletizing-demo.mp4', mediaType: 'video', taskKind: 'transcribe', status: 'pending_confirm', progress: 100, confidence: 0.93, resultPreview: '中英字幕 2 轨，58 段；01:12 “sealed to IP66 for dusty cells”' },
  { taskId: 'AI-902', assetId: 'A-2311', fileName: 'BL-R600-palletizing-demo.mp4', mediaType: 'video', taskKind: 'keyframes', status: 'pending_confirm', progress: 100, confidence: 0.88, resultPreview: '6 个关键帧、4 个章节：开箱 / 示教 / 码垛 / 维护' },
  { taskId: 'AI-903', assetId: 'A-2320', fileName: 'HC-RV200-type-test-scan.pdf', mediaType: 'document', taskKind: 'ocr', status: 'running', progress: 62, confidence: null, resultPreview: '已识别 14 / 22 页' },
  { taskId: 'AI-904', assetId: 'A-2320', fileName: 'HC-RV200-type-test-scan.pdf', mediaType: 'document', taskKind: 'fact_extract', status: 'queued', progress: 0, confidence: null, resultPreview: '等待文字识别完成' },
  { taskId: 'AI-905', assetId: 'A-2101', fileName: 'ceo-interview-cn.m4a', mediaType: 'audio', taskKind: 'transcribe', status: 'failed', progress: 0, confidence: null, resultPreview: '源文件同步失败，无法读取' },
];

const mockAssetDetailData: AssetDetail = {
  assetId: 'A-1987',
  fileName: 'TUV-2026-1188-report.pdf',
  mediaType: 'document',
  sourceName: '飞书云空间',
  storageMode: 'copy',
  externalId: 'boxcn8Kx2…Qf1',
  externalVersion: '2026-03-01 18:22',
  lastSyncedAt: '2026-11-19 06:10',
  syncStatus: 'synced',
  titles: [
    { locale: 'zh-CN', title: 'BL-R600 防护等级检测报告（TÜV）', alt: 'TÜV 检测报告封面' },
    { locale: 'en-US', title: 'BL-R600 IP Rating Test Report (TÜV)', alt: 'Cover of TÜV test report' },
  ],
  rights: { copyright: '北岭智造（检测机构授权公开）', regions: '全部', channels: '官网下载区 / 经销商门户', expiresAt: null },
  aiTags: [
    { label: '检测报告', confidence: 0.98, confirmed: true },
    { label: 'TÜV', confidence: 0.97, confirmed: true },
    { label: '防护等级', confidence: 0.91, confirmed: true },
    { label: 'IEC 60529', confidence: 0.84, confirmed: false },
  ],
  ocrText: 'Test Report No. TÜV-2026-1188 … Product: Industrial Robot BL-R600 … Degree of protection: IP66 (IEC 60529) … Valid until 2028-02-28',
  factCandidates: [
    { attributeName: '防护等级', valueLabel: 'IP66', confidence: 0.95 },
    { attributeName: '测试标准', valueLabel: 'IEC 60529', confidence: 0.9 },
    { attributeName: '证书有效期', valueLabel: '2028-02-28', confidence: 0.86 },
  ],
  references: [
    { contentId: 'C-1002', title: 'BL-R600 Product Brief（证据下载）', contentStatus: '审核中' },
    { contentId: 'F-002', title: '事实：防护等级 IP66（证据原件）', contentStatus: '有效' },
  ],
};

// 原型：详情接口只给了 A-1987 一份样例，其余资产用列表字段拼出详情
function assetDetailOf(a: AssetItem | undefined): AssetDetail {
  if (!a || a.assetId === mockAssetDetailData.assetId) return mockAssetDetailData;
  return {
    assetId: a.assetId,
    fileName: a.fileName,
    mediaType: a.mediaType,
    sourceName: a.sourceName,
    storageMode: a.storageMode,
    externalId: a.storageMode === 'local' ? null : `${a.assetId.toLowerCase()}@source`,
    externalVersion: a.storageMode === 'local' ? null : a.updatedAt,
    lastSyncedAt: a.storageMode === 'local' ? null : `${a.updatedAt} 06:10`,
    syncStatus: a.syncStatus,
    titles: [{ locale: 'zh-CN', title: a.fileName.replace(/\.[a-z0-9]+$/, ''), alt: a.tags.join('、') || '待补充' }],
    rights: { copyright: a.rightsLabel, regions: '全部', channels: a.rightsLabel.split(' · ')[1] ?? '—', expiresAt: a.rightsExpiresAt },
    aiTags: a.tags.map((t, i) => ({ label: t, confidence: 0.95 - i * 0.04, confirmed: i < 2 })),
    ocrText: '',
    factCandidates: [],
    references: [],
  };
}

const mockImportConnectorsData: ImportConnector[] = [
  { connectorId: 'musedam', connectorName: '特赞 MuseDAM', defaultMode: 'copy', status: 'connected' },
  { connectorId: 'feishu', connectorName: '飞书云空间', defaultMode: 'copy', status: 'auth_expired' },
  { connectorId: 'sharepoint', connectorName: 'SharePoint（欧洲子公司）', defaultMode: 'reference', status: 'connected' },
];

const mockExternalFilesData: ExternalFile[] = [
  { externalId: 'md-77812', fileName: 'BL-R600-explosion-proof-hero.jpg', mediaType: 'image', sizeLabel: '5.1 MB', modifiedAt: '2026-11-15' },
  { externalId: 'md-77813', fileName: 'BL-R600-teach-pendant.jpg', mediaType: 'image', sizeLabel: '2.8 MB', modifiedAt: '2026-11-15' },
  { externalId: 'md-77820', fileName: 'customer-story-auto-oem.mp4', mediaType: 'video', sizeLabel: '412 MB', modifiedAt: '2026-11-10' },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取资产列表（支持自然语言搜索） [GET] /api/v1/assets
function handleFetchAssets(params: { sourceId: string; mediaType: string; query: string; searchMode: 'keyword' | 'semantic'; page: number; pageSize: number }) {
  console.log('fetch assets', params);
}

// ACTION: 获取资产详情 [GET] /api/v1/assets/{id}
function handleFetchAssetDetail(assetId: string) {
  console.log('asset detail', assetId);
}

// ACTION: 上传资产 [POST] /api/v1/assets
function handleUploadAsset() {
  console.log('upload asset');
}

// ACTION: 浏览外部来源文件 [GET] /api/v1/connectors/{id}/files
function handleBrowseExternal(connectorId: string, keyword: string) {
  console.log('browse external', connectorId, keyword);
}

// ACTION: 从外部导入资产 [POST] /api/v1/assets/import
function handleImportAssets(req: { connectorId: string; externalIds: string[]; mode: 'copy' | 'reference' }) {
  console.log('import assets', req);
  alert(`已导入 ${req.externalIds.length} 个资产（${req.mode === 'copy' ? '导入副本' : '仅引用'}），进入 AI 处理与审核`);
}

// ACTION: 确认 AI 处理结果 [PATCH] /api/v1/ai-tasks/{id}
function handleConfirmAiTask(taskId: string, decision: 'confirm' | 'reject' | 'retry') {
  console.log('confirm ai task', taskId, decision);
}

// ACTION: 将抽取结果提交为事实候选 [POST] /api/v1/facts/candidates
function handleSubmitFactCandidates(assetId: string, candidates: { attributeName: string; valueLabel: string }[]) {
  alert(`已提交 ${candidates.length} 条事实候选，等待事实负责人确认`);
}

// ── 主组件 ────────────────────────────────────────────────
export default function AssetLibrary() {
  const [assetList, setAssetList] = useState(mockAssetsData);
  const [uploadOpen, setUploadOpen] = useState(false);
  const navigate = useNavigate();
  const [sourceId, setSourceId] = useState('all');
  const [mediaType, setMediaType] = useState('all');
  const [query, setQuery] = useState('');
  const [semantic, setSemantic] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState('A-1987');
  const [importOpen, setImportOpen] = useState(false);
  const [importConnector, setImportConnector] = useState('musedam');
  const [importMode, setImportMode] = useState<'copy' | 'reference'>('copy');
  const [picked, setPicked] = useState<string[]>([]);

  const params = { sourceId, mediaType, query, searchMode: semantic ? ('semantic' as const) : ('keyword' as const), page: 1, pageSize: 40 };
  const assets = assetList.filter(
    (a) =>
      (mediaType === 'all' || a.mediaType === mediaType) &&
      (sourceId === 'all' || (sourceId === 'local' ? a.storageMode === 'local' : a.sourceName === mockAssetSourcesData.find((s) => s.sourceId === sourceId)?.sourceName)) &&
      (!semantic || a.matchReason),
  );
  const pendingCount = assetList.filter((a) => a.syncStatus === 'source_updated' || a.syncStatus === 'source_deleted' || a.status === 'rights_expired' || a.status === 'pending_review').length;
  const d = assetDetailOf(assetList.find((a) => a.assetId === detailId));
  const connectorItems = mockImportConnectorsData.map((c) => ({ value: c.connectorId, label: c.connectorName }));

  const runSearch = (q: string) => {
    setQuery(q);
    setSemantic(!!q);
    handleFetchAssets({ ...params, query: q, searchMode: 'semantic' });
  };

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="资产"
        description="引用源之一：原样插进内容或作为附件给出去的文件（图片、视频、PDF）。本地上传与从外部导入的副本统一管理；外部链接失效不影响使用；授权到期无论有无副本都会拦截发布。要读正文作引用的文档在「外部内容」里。"
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <CloudDownload /> 从外部导入
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload /> 上传
            </Button>
          </>
        }
      />

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">资产库</TabsTrigger>
          <TabsTrigger value="ai">AI 处理队列 {mockAiTasksData.length}</TabsTrigger>
          <TabsTrigger value="pending">待处理 {pendingCount}</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="pt-3">
          <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
            <Card size="sm" className="h-fit">
              <CardHeader>
                <CardTitle className="text-sm">来源</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 text-sm">
                {mockAssetSourcesData.map((s) => (
                  <button
                    key={s.sourceId}
                    onClick={() => {
                      setSourceId(s.sourceId);
                      handleFetchAssets({ ...params, sourceId: s.sourceId });
                    }}
                    className={cn('flex w-full items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted', sourceId === s.sourceId && 'bg-muted font-medium')}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Folder className="size-3.5 text-muted-foreground" /> {s.sourceName}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{s.assetCount}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Card size="sm">
                <CardContent className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Sparkles className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-violet-500" />
                      <Input className="pl-8" placeholder="用一句话描述你要的素材，例如：带 CE 标志的产品白底图" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch(query)} />
                    </div>
                    <Select
                      items={MEDIA_OPTIONS}
                      value={mediaType}
                      onValueChange={(v) => {
                        setMediaType(v as string);
                        handleFetchAssets({ ...params, mediaType: v as string });
                      }}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEDIA_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => runSearch(query)}>搜索</Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    试试：
                    {SEARCH_EXAMPLES.map((ex) => (
                      <button key={ex} onClick={() => runSearch(ex)} className="rounded-full border px-2 py-0.5 hover:bg-muted">
                        {ex}
                      </button>
                    ))}
                    {semantic && (
                      <button className="ml-auto text-primary" onClick={() => { setQuery(''); setSemantic(false); }}>
                        清除搜索
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {assets.map((a) => (
                  <button
                    key={a.assetId}
                    onClick={() => {
                      handleFetchAssetDetail(a.assetId);
                      setDetailId(a.assetId);
                      setDetailOpen(true);
                    }}
                    className="overflow-hidden rounded-xl border bg-background text-left hover:ring-2 hover:ring-primary/20"
                  >
                    <AssetThumb mediaType={a.mediaType} seed={a.assetId} className="h-32 w-full rounded-none" label={a.mediaType === 'video' || a.mediaType === 'audio' ? a.dimensionLabel : undefined} />
                    <div className="space-y-1.5 p-2.5">
                      <div className="truncate text-sm font-medium">{a.fileName}</div>
                      <div className="flex flex-wrap gap-1">
                        <ToneBadge tone={ASSET_STATUS_CONFIG[a.status].tone}>{ASSET_STATUS_CONFIG[a.status].label}</ToneBadge>
                        <SyncBadge status={a.syncStatus} />
                        <ToneBadge tone={AI_STATE_CONFIG[a.aiState].tone}>{AI_STATE_CONFIG[a.aiState].label}</ToneBadge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {a.sourceName} · {a.storageMode === 'reference' ? '仅引用' : a.storageMode === 'copy' ? '副本' : '本地'} · 被引用 {a.referencedCount}
                      </div>
                      {semantic && a.matchReason && <div className="text-xs text-violet-700 dark:text-violet-300">{a.matchReason}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>AI 处理队列</CardTitle>
              <CardDescription>上传或导入后自动运行。结果带置信度，人工确认后才生效；证书与检测报告会抽取「事实候选」送事实负责人确认。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>资产</TableHead>
                    <TableHead>任务</TableHead>
                    <TableHead>进度</TableHead>
                    <TableHead>结果</TableHead>
                    <TableHead>置信度</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockAiTasksData.map((t) => (
                    <TableRow key={t.taskId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AssetThumb mediaType={t.mediaType} seed={t.assetId} className="h-8 w-12" />
                          <span className="max-w-48 truncate">{t.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell>{TASK_KIND_LABEL[t.taskKind]}</TableCell>
                      <TableCell className="w-32">
                        {t.status === 'failed' ? <ToneBadge tone="red">失败</ToneBadge> : t.status === 'queued' ? <ToneBadge tone="gray">排队中</ToneBadge> : <Progress value={t.progress} />}
                      </TableCell>
                      <TableCell className="max-w-72 text-xs whitespace-normal text-muted-foreground">{t.resultPreview}</TableCell>
                      <TableCell className="tabular-nums">{t.confidence ? `${Math.round(t.confidence * 100)}%` : '—'}</TableCell>
                      <TableCell className="text-right">
                        {t.status === 'pending_confirm' && (
                          <div className="flex justify-end gap-1">
                            <Button size="xs" onClick={() => handleConfirmAiTask(t.taskId, 'confirm')}>
                              <Check /> 确认
                            </Button>
                            <Button size="xs" variant="ghost" onClick={() => handleConfirmAiTask(t.taskId, 'reject')}>
                              驳回
                            </Button>
                          </div>
                        )}
                        {t.status === 'failed' && (
                          <Button size="xs" variant="outline" onClick={() => handleConfirmAiTask(t.taskId, 'retry')}>
                            重试
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>待处理</CardTitle>
              <CardDescription>源已更新、源已删除、授权到期与待审资产。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>资产</TableHead>
                    <TableHead>问题</TableHead>
                    <TableHead>被引用</TableHead>
                    <TableHead>建议</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockAssetsData
                    .filter((a) => a.syncStatus === 'source_updated' || a.syncStatus === 'source_deleted' || a.status === 'rights_expired' || a.status === 'pending_review')
                    .map((a) => (
                      <TableRow key={a.assetId}>
                        <TableCell>
                          {a.fileName}
                          <div className="text-xs text-muted-foreground">
                            {a.assetId} · {a.sourceName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {a.syncStatus !== 'synced' && a.syncStatus !== 'local_only' && <SyncBadge status={a.syncStatus} />}
                            {a.status !== 'available' && <ToneBadge tone={ASSET_STATUS_CONFIG[a.status].tone}>{ASSET_STATUS_CONFIG[a.status].label}</ToneBadge>}
                          </div>
                        </TableCell>
                        <TableCell>{a.referencedCount}</TableCell>
                        <TableCell className="text-xs">
                          {a.syncStatus === 'source_updated'
                            ? '拉取新版本并替换（引用不变）'
                            : a.status === 'rights_expired'
                              ? '引用内容已进入复核，请替换素材'
                              : a.syncStatus === 'source_deleted'
                                ? '副本保留可用；新引用需确认'
                                : '确认 AI 结果与授权信息后可用'}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 资产详情 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{d.fileName}</SheetTitle>
            <SheetDescription>
              {d.assetId} · {d.sourceName} · {d.storageMode === 'copy' ? '导入副本' : d.storageMode === 'reference' ? '仅引用' : '本地'}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <AssetThumb mediaType={d.mediaType} seed={d.assetId} className="h-44 w-full" />
            <Tabs defaultValue="ai">
              <TabsList>
                <TabsTrigger value="ai">AI 理解</TabsTrigger>
                <TabsTrigger value="meta">内容侧字段</TabsTrigger>
                <TabsTrigger value="rights">授权</TabsTrigger>
                <TabsTrigger value="refs">被引用</TabsTrigger>
                <TabsTrigger value="source">来源</TabsTrigger>
              </TabsList>
              <TabsContent value="ai" className="space-y-4 pt-2 text-sm">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">标签（置信度）</div>
                  <div className="flex flex-wrap gap-1">
                    {d.aiTags.map((t) => (
                      <ToneBadge key={t.label} tone={t.confirmed ? 'blue' : 'violet'}>
                        {t.label} {Math.round(t.confidence * 100)}%{!t.confirmed && ' · 待确认'}
                      </ToneBadge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">文字识别</div>
                  <p className="rounded-lg bg-muted/50 p-2 font-mono text-xs leading-relaxed">{d.ocrText}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <Wand2 className="size-4 text-violet-500" /> 抽取到的事实候选
                  </div>
                  {d.factCandidates.map((f) => (
                    <div key={f.attributeName} className="flex justify-between border-b py-1 last:border-0">
                      <span>{f.attributeName}</span>
                      <span>
                        <span className="font-medium">{f.valueLabel}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{Math.round(f.confidence * 100)}%</span>
                      </span>
                    </div>
                  ))}
                  <Button size="sm" className="mt-3" onClick={() => handleSubmitFactCandidates(d.assetId, d.factCandidates)}>
                    提交到事实库
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="meta" className="space-y-3 pt-2 text-sm">
                {d.titles.map((t) => (
                  <div key={t.locale} className="space-y-1.5 rounded-lg border p-3">
                    <ToneBadge tone="gray" className="font-mono">
                      {t.locale}
                    </ToneBadge>
                    <Input defaultValue={t.title} />
                    <Input defaultValue={t.alt} placeholder="alt 文本" />
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="rights" className="space-y-2 pt-2 text-sm">
                {[
                  ['版权', d.rights.copyright],
                  ['可用区域', d.rights.regions],
                  ['可用渠道', d.rights.channels],
                  ['到期', d.rights.expiresAt ?? '长期'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b py-1.5">
                    <span className="text-muted-foreground">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="refs" className="space-y-2 pt-2 text-sm">
                {d.references.map((r) => (
                  <button key={r.contentId} onClick={() => navigate(r.contentId.startsWith('F') ? '/facts' : `/content/edit/${r.contentId}`)} className="flex w-full justify-between rounded-lg border p-2.5 text-left hover:bg-muted">
                    <span>{r.title}</span>
                    <span className="text-xs text-muted-foreground">{r.contentStatus}</span>
                  </button>
                ))}
              </TabsContent>
              <TabsContent value="source" className="space-y-2 pt-2 text-sm">
                {[
                  ['来源系统', d.sourceName],
                  ['外部 ID', d.externalId ?? '—'],
                  ['外部版本', d.externalVersion ?? '—'],
                  ['最近同步', d.lastSyncedAt ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b py-1.5">
                    <span className="text-muted-foreground">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
                <SyncBadge status={d.syncStatus} />
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* 从外部导入 */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>从外部导入</DialogTitle>
            <DialogDescription>沿用源系统权限浏览。默认导入副本：文件存到中台，源链接失效也能用。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="w-14">来源</Label>
              <Select
                items={connectorItems}
                value={importConnector}
                onValueChange={(v) => {
                  setImportConnector(v as string);
                  const c = mockImportConnectorsData.find((x) => x.connectorId === v);
                  if (c) setImportMode(c.defaultMode);
                  handleBrowseExternal(v as string, '');
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mockImportConnectorsData.map((c) => (
                    <SelectItem key={c.connectorId} value={c.connectorId}>
                      {c.connectorName}
                      {c.status === 'auth_expired' && '（鉴权过期）'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as 'copy' | 'reference')} className="grid grid-cols-2 gap-2">
              <Label className={cn('flex items-start gap-2 rounded-lg border p-3 font-normal', importMode === 'copy' && 'border-primary')}>
                <RadioGroupItem value="copy" className="mt-0.5" />
                <div>
                  <div className="font-medium">导入副本（推荐）</div>
                  <div className="text-xs text-muted-foreground">存一份到中台，持续跟踪源变化</div>
                </div>
              </Label>
              <Label className={cn('flex items-start gap-2 rounded-lg border p-3 font-normal', importMode === 'reference' && 'border-primary')}>
                <RadioGroupItem value="reference" className="mt-0.5" />
                <div>
                  <div className="font-medium">仅引用</div>
                  <div className="text-xs text-muted-foreground">文件留在原库，只存 ID 和地址</div>
                </div>
              </Label>
            </RadioGroup>
            <div className="divide-y rounded-lg border">
              {mockExternalFilesData.map((f) => (
                <label key={f.externalId} className="flex items-center gap-3 p-2.5">
                  <Checkbox checked={picked.includes(f.externalId)} onCheckedChange={(c) => setPicked((p) => (c ? [...p, f.externalId] : p.filter((x) => x !== f.externalId)))} />
                  <AssetThumb mediaType={f.mediaType} seed={f.externalId} className="h-9 w-12" />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="truncate">{f.fileName}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.sizeLabel} · {f.modifiedAt}
                    </div>
                  </div>
                  {f.mediaType === 'video' && importMode === 'copy' && <ToneBadge tone="amber">大文件：仅存分发版</ToneBadge>}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={picked.length === 0}
              onClick={() => {
                handleImportAssets({ connectorId: importConnector, externalIds: picked, mode: importMode });
                const conn = mockImportConnectorsData.find((c) => c.connectorId === importConnector)?.connectorName ?? importConnector;
                setAssetList((prev) => [
                  ...mockExternalFilesData
                    .filter((f) => picked.includes(f.externalId))
                    .map((f, i) => ({ assetId: `A-${2500 + prev.length + i}`, fileName: f.fileName, mediaType: f.mediaType, sizeLabel: f.sizeLabel, dimensionLabel: '—', sourceName: conn, storageMode: importMode, syncStatus: 'synced' as const, rightsLabel: '沿用源系统授权', rightsExpiresAt: null, status: 'pending_review' as const, aiState: 'processing' as const, tags: [], referencedCount: 0, matchReason: null, updatedAt: '今天' })),
                  ...prev,
                ]);
                setImportOpen(false);
                setPicked([]);
              }}
            >
              导入 {picked.length || ''} 个
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FormDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        title="上传资产"
        description="上传后自动进入 AI 处理（识图打标 / OCR / 字幕），审核通过后可用。"
        fields={[
          { key: 'file', label: '文件名', kind: 'text', required: true, placeholder: '例如 BL-R800-front.png', hint: '原型中以文件名代替实际上传' },
          { key: 'type', label: '类型', kind: 'select', options: [{ value: 'image', label: '图片' }, { value: 'video', label: '视频' }, { value: 'document', label: '文档' }, { value: 'audio', label: '音频' }] },
          { key: 'rights', label: '授权', kind: 'select', options: ['自有 · 全渠道', '自有 · 官网与社媒', '摄影师授权 · 全渠道', '内部'].map((x) => ({ value: x, label: x })) },
          { key: 'expires', label: '授权到期日', kind: 'text', placeholder: '无期限可留空，例如 2027-12-31' },
          { key: 'tags', label: '标签', kind: 'text', placeholder: '用逗号分隔，AI 会补充' },
        ]}
        submitLabel="上传"
        onSubmit={(v: FormValues) => {
          handleUploadAsset();
          const id = `A-${2400 + assetList.length}`;
          setAssetList((prev) => [{ assetId: id, fileName: String(v.file), mediaType: v.type as MediaType, sizeLabel: '—', dimensionLabel: '—', sourceName: '本地上传', storageMode: 'local', syncStatus: 'local_only', rightsLabel: String(v.rights), rightsExpiresAt: String(v.expires) || null, status: 'pending_review', aiState: 'processing', tags: String(v.tags).split(/[,，]/).map((x) => x.trim()).filter(Boolean), referencedCount: 0, matchReason: null, updatedAt: '今天' }, ...prev]);
          notify(`${id} 已上传，正在 AI 处理，审核后可用`);
        }}
      />
    </div>
  );
}
