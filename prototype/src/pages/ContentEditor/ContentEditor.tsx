import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Eye,
  Languages,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AssetThumb, type MediaType } from '@/components/shared/AssetThumb';
import {
  AiMark,
  ContentStatusBadge,
  EvidenceBadge,
  SyncBadge,
  ToneBadge,
  type ContentStatus,
  type EvidenceGrade,
  type SyncStatus,
  type Tone,
} from '@/components/shared/status';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { notify } from '@/components/shared/toast';
import { accessOf, ROLE_CONFIG } from '@/components/layout/access';
import { conflictClearedFor, EDITOR_CONFLICT_ID, factOverrides, factPublishAction, nowLabel, useDemo, type ConflictAction, type ContentSource, type CreatedContent, type PublishSettings } from '@/lib/demo-store';
import { CHANNEL_LABEL, defaultChannelsOf } from '@/lib/publish-config';
import { Checkbox } from '@/components/ui/checkbox';
import { REF_KIND_LABEL, SOURCE_CONFIG } from '@/lib/content-source';

// ── 配置常量 ──────────────────────────────────────────────
type FactState = 'valid' | 'conflict' | 'expired' | 'out_of_scope';
const FACT_STATE_CONFIG: Record<FactState, { label: string; tone: Tone }> = {
  valid: { label: '有效', tone: 'green' },
  conflict: { label: '冲突中', tone: 'red' },
  expired: { label: '已过期', tone: 'amber' },
  out_of_scope: { label: '超出范围', tone: 'gray' },
};
type CheckResult = 'pass' | 'fail' | 'warn';
const CHECK_ICON: Record<CheckResult, React.ReactNode> = {
  pass: <CheckCircle2 className="size-4 text-emerald-600" />,
  fail: <XCircle className="size-4 text-red-600" />,
  warn: <CircleAlert className="size-4 text-amber-600" />,
};
const LOCALE_OPTIONS = [
  { value: 'en-US', label: 'English · en-US' },
  { value: 'de-DE', label: 'Deutsch · de-DE' },
  { value: 'zh-CN', label: '简体中文 · zh-CN' },
];
const AI_ACTIONS = [
  { key: 'rewrite', label: '改写选中段落' },
  { key: 'expand', label: '扩写' },
  { key: 'shorten', label: '缩写' },
  { key: 'summary', label: '生成机器可读摘要' },
  { key: 'faq', label: '从正文生成 FAQ' },
  { key: 'brand_voice', label: '检查 Brand Voice' },
] as const;
type AiActionKey = (typeof AI_ACTIONS)[number]['key'];

// ── 类型 ──────────────────────────────────────────────────
type Segment = { segKind: 'text'; text: string } | { segKind: 'fact'; factId: string };
type ContentBlock =
  | { blockId: string; kind: 'paragraph'; heading: string; segments: Segment[]; aiGenerated: boolean }
  | { blockId: string; kind: 'spec_table'; heading: string; factIds: string[] }
  | { blockId: string; kind: 'image'; assetId: string; caption: string }
  | { blockId: string; kind: 'faq'; heading: string; items: { question: string; answer: string; aiGenerated: boolean }[] };

interface ContentDetail {
  contentId: string;
  title: string;
  contentTypeName: string;
  brandName: string;
  regionLabel: string;
  locale: string;
  status: ContentStatus;
  version: number;
  ownerName: string;
  updatedAt: string;
  summary: string;
  summaryAiGenerated: boolean;
  blocks: ContentBlock[];
  source: ContentSource;
}
interface ScopedFact {
  factId: string;
  subjectName: string;
  attributeName: string;
  valueLabel: string;
  evidenceGrade: EvidenceGrade;
  evidenceSource: string;
  validTo: string;
  factState: FactState;
  stateReason: string | null;
}
interface PickableAsset {
  assetId: string;
  fileName: string;
  mediaType: MediaType;
  rightsLabel: string;
  rightsExpiresAt: string | null;
  syncStatus: SyncStatus;
}
interface PublishCheck {
  checkKey: string;
  checkLabel: string;
  result: CheckResult;
  detail: string;
  fixPath: string | null;
}
interface LocaleVariant {
  locale: string;
  status: ContentStatus | 'missing';
  version: number | null;
  requiredByRegion: boolean;
  translatedFrom: string | null;
  updatedAt: string | null;
  siteName: string | null;
  pageUrl: string | null;
}
interface ContentVariantItem {
  variantId: string;
  fieldLabel: string;
  variantName: string;
  audienceRule: string;
  experimentKey: string | null;
  trafficShare: number | null;
  text: string;
  status: 'active' | 'draft';
  aiGenerated: boolean;
  resultLabel: string | null;
}
interface VersionRecord {
  version: number;
  state: 'draft' | 'in_review' | 'published' | 'superseded';
  changeNote: string;
  authorName: string;
  createdAt: string;
  factSnapshotCount: number;
}
interface GenerationBasis {
  basisId: string;
  sourceKind: 'local_fact' | 'kdh_passage';
  citation: string;
  excerpt: string;
  retrievedAt: string;
}
interface CallRecord {
  callId: string;
  appName: string;
  channel: 'rest' | 'graphql' | 'mcp';
  version: number;
  result: number;
  calledAt: string;
}
interface ContentTypeOption {
  contentTypeId: string;
  name: string;
  description: string;
}
interface CollectionOption {
  collectionId: string;
  collectionName: string;
  kind: 'channel_pack' | 'topic' | 'smart';
  kindLabel: string;
  grantedConsumers: string[];
  ruleSummary: string | null;
  ruleTypes: string[] | null; // 智能集合按内容类型自动收集（演示用简化规则）
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockContentDetailData: ContentDetail = {
  contentId: 'C-1002',
  title: 'BL-R600 6-Axis Industrial Robot — Product Brief',
  contentTypeName: '产品说明',
  brandName: '北岭智造',
  regionLabel: '欧盟',
  locale: 'en-US',
  status: 'in_review',
  version: 3,
  ownerName: '林悦',
  updatedAt: '2026-11-19 08:12',
  summary:
    'BL-R600 is a 20 kg payload six-axis industrial robot with ±0.02 mm repeatability and 1700 mm reach, designed for welding, palletizing and machine tending lines in the EU market.',
  summaryAiGenerated: true,
  source: {
    kind: 'ai_generate',
    topicId: 'TP-35',
    taskId: 'GEN-7781',
    templateId: 'TPL-01',
    templateName: '产品说明 · 标准版',
    sourceContentId: null,
    refs: [
      { refKind: 'fact', refId: 'F-001', label: '重复定位精度 ±0.02 mm' },
      { refKind: 'fact', refId: 'F-002', label: '防护等级 IP66' },
      { refKind: 'fact', refId: 'F-004', label: '额定负载 20 kg' },
      { refKind: 'content', refId: 'C-0921', label: 'C-0921 BL-R600 产品手册摘要（中文）' },
      { refKind: 'kdh', refId: 'KP-301', label: '汽车焊装线改造案例（2025）' },
      { refKind: 'asset', refId: 'A-2207', label: '汉诺威展焊装线实拍' },
    ],
  },
  blocks: [
    {
      blockId: 'b1',
      kind: 'paragraph',
      heading: 'Overview',
      aiGenerated: true,
      segments: [
        { segKind: 'text', text: 'Built for high-mix production lines, BL-R600 handles payloads up to ' },
        { segKind: 'fact', factId: 'F-004' },
        { segKind: 'text', text: ' with a repeatability of ' },
        { segKind: 'fact', factId: 'F-001' },
        { segKind: 'text', text: '. Its sealed joints reach protection class ' },
        { segKind: 'fact', factId: 'F-002' },
        { segKind: 'text', text: ', so it keeps running in dusty welding cells.' },
      ],
    },
    { blockId: 'b2', kind: 'spec_table', heading: 'Key specifications', factIds: ['F-004', 'F-005', 'F-001', 'F-002', 'F-007'] },
    { blockId: 'b3', kind: 'image', assetId: 'A-2207', caption: 'BL-R600 on a welding line at Hannover Messe 2026' },
    {
      blockId: 'b4',
      kind: 'faq',
      heading: 'FAQ',
      items: [
        { question: 'Is BL-R600 CE certified?', answer: 'Yes, it complies with the Machinery Directive 2006/42/EC.', aiGenerated: true },
        { question: 'What is the standard lead time?', answer: 'Standard lead time is 10 weeks for EU orders.', aiGenerated: false },
      ],
    },
  ],
};

const mockScopedFactsData: ScopedFact[] = [
  { factId: 'F-001', subjectName: 'BL-R600', attributeName: '重复定位精度', valueLabel: '±0.02 mm', evidenceGrade: 'A', evidenceSource: '出厂检测报告 BL-QR-2026-041', validTo: '2027-12-31', factState: 'valid', stateReason: null },
  { factId: 'F-002', subjectName: 'BL-R600', attributeName: '防护等级', valueLabel: 'IP66', evidenceGrade: 'A', evidenceSource: 'TÜV 检测报告 TÜV-2026-1188', validTo: '2028-02-28', factState: 'conflict', stateReason: '与 F-003（IP65，产品手册 2024 版）冲突，待处理' },
  { factId: 'F-004', subjectName: 'BL-R600', attributeName: '额定负载', valueLabel: '20 kg', evidenceGrade: 'A', evidenceSource: '型式试验报告 BL-TR-2025-019', validTo: '2028-06-01', factState: 'valid', stateReason: null },
  { factId: 'F-005', subjectName: 'BL-R600', attributeName: '最大工作半径', valueLabel: '1700 mm', evidenceGrade: 'A', evidenceSource: '型式试验报告 BL-TR-2025-019', validTo: '2028-06-01', factState: 'valid', stateReason: null },
  { factId: 'F-006', subjectName: 'BL-R600', attributeName: 'CE 认证', valueLabel: '机械指令 2006/42/EC', evidenceGrade: 'C', evidenceSource: '企业自我声明', validTo: '2028-03-31', factState: 'valid', stateReason: 'C 级证据，仅可内部引用' },
  { factId: 'F-007', subjectName: 'BL-R600', attributeName: '标准交付周期', valueLabel: '12 周', evidenceGrade: 'B', evidenceSource: '供应链季度公告 2026Q4（修订）', validTo: '2027-02-28', factState: 'valid', stateReason: null },
  { factId: 'F-021', subjectName: 'BL-R600', attributeName: 'UL 认证', valueLabel: 'UL 1740', evidenceGrade: 'A', evidenceSource: 'UL 证书 E498812', validTo: '2027-05-31', factState: 'out_of_scope', stateReason: '适用区域为北美，不在本内容范围（欧盟）' },
];

const mockAssetPickerData: PickableAsset[] = [
  { assetId: 'A-2207', fileName: 'hannover-2026-welding-line.jpg', mediaType: 'image', rightsLabel: '自有 · 全渠道', rightsExpiresAt: '2026-12-01', syncStatus: 'synced' },
  { assetId: 'A-2190', fileName: 'BL-R600-white-bg-front.png', mediaType: 'image', rightsLabel: '自有 · 全渠道', rightsExpiresAt: null, syncStatus: 'source_updated' },
  { assetId: 'A-2311', fileName: 'BL-R600-palletizing-demo.mp4', mediaType: 'video', rightsLabel: '自有 · 官网与社媒', rightsExpiresAt: null, syncStatus: 'local_only' },
  { assetId: 'A-1987', fileName: 'TUV-2026-1188-report.pdf', mediaType: 'document', rightsLabel: '仅下载区', rightsExpiresAt: null, syncStatus: 'synced' },
];

const mockPublishChecksData: PublishCheck[] = [
  { checkKey: 'fact_refs', checkLabel: '事实引用完整', result: 'pass', detail: '引用 5 条事实，均可回溯到来源', fixPath: null },
  { checkKey: 'fact_validity', checkLabel: '事实在有效期内', result: 'pass', detail: '最近到期：标准交付周期 2027-02-28', fixPath: null },
  { checkKey: 'evidence', checkLabel: '证据等级满足对外发布', result: 'pass', detail: '引用事实均为 A/B 级', fixPath: null },
  { checkKey: 'conflict', checkLabel: '无冲突事实', result: 'fail', detail: '防护等级 IP66（F-002）与 IP65（F-003）冲突', fixPath: '/facts/conflicts' },
  { checkKey: 'scope', checkLabel: '品牌与区域在授权范围内', result: 'pass', detail: '北岭智造 · 欧盟', fixPath: null },
  { checkKey: 'asset_rights', checkLabel: '资产授权有效', result: 'warn', detail: 'A-2207 授权 2026-12-01 到期', fixPath: '/assets' },
  { checkKey: 'claims', checkLabel: '正文声明与事实一致', result: 'pass', detail: 'AI 抽取 6 条声明，全部与事实一致', fixPath: null },
  { checkKey: 'ai_mark', checkLabel: 'AI 生成标识与人工确认', result: 'warn', detail: '2 处 AI 生成段落待审核人确认', fixPath: null },
  { checkKey: 'structure', checkLabel: '结构与摘要完整', result: 'pass', detail: '摘要 182 字符，JSON-LD 可生成', fixPath: null },
];

const mockLocaleVariantsData: LocaleVariant[] = [
  { locale: 'en-US', status: 'in_review', version: 3, requiredByRegion: true, translatedFrom: null, updatedAt: '2026-11-19 08:12', siteName: '北岭官网 · 欧盟', pageUrl: 'https://eu.beiling.com/en/robots/bl-r600' },
  { locale: 'de-DE', status: 'missing', version: null, requiredByRegion: true, translatedFrom: null, updatedAt: null, siteName: '北岭官网 · 欧盟', pageUrl: 'https://eu.beiling.com/de/robots/bl-r600' },
  { locale: 'zh-CN', status: 'published', version: 2, requiredByRegion: false, translatedFrom: 'en-US v2', updatedAt: '2026-11-02 10:00', siteName: '北岭官网 · 中国', pageUrl: 'https://www.beiling.cn/robots/bl-r600' },
];

const mockContentVariantsData: ContentVariantItem[] = [
  { variantId: 'V-0', fieldLabel: '首屏卖点', variantName: '默认', audienceRule: '未命中其他规则的访客', experimentKey: null, trafficShare: null, text: 'Built for high-mix production lines: 20 kg payload, ±0.02 mm repeatability.', status: 'active', aiGenerated: false, resultLabel: null },
  { variantId: 'V-1', fieldLabel: '首屏卖点', variantName: '汽车行业', audienceRule: '受众行业 = 汽车及零部件', experimentKey: 'EXP-12 · A', trafficShare: 50, text: 'Hollow wrist keeps welding cables tangle-free — built for body-in-white lines.', status: 'active', aiGenerated: true, resultLabel: '点击率 7.4%（领先）' },
  { variantId: 'V-2', fieldLabel: '首屏卖点', variantName: '汽车行业 · 对照', audienceRule: '受众行业 = 汽车及零部件', experimentKey: 'EXP-12 · B', trafficShare: 50, text: 'IP66 sealed joints keep running in dusty welding cells.', status: 'active', aiGenerated: false, resultLabel: '点击率 5.1%' },
  { variantId: 'V-3', fieldLabel: '首屏卖点', variantName: '来自展会二维码', audienceRule: '来源 = 汉诺威展会二维码', experimentKey: null, trafficShare: null, text: 'Saw it at Hannover? Book a live demo in your plant.', status: 'draft', aiGenerated: true, resultLabel: null },
];

const mockVersionHistoryData: VersionRecord[] = [
  { version: 3, state: 'in_review', changeNote: '补充 FAQ，参数表新增交付周期', authorName: '林悦', createdAt: '2026-11-19 08:12', factSnapshotCount: 5 },
  { version: 2, state: 'published', changeNote: '防护等级更新为 IP66（TÜV 新报告）', authorName: '林悦', createdAt: '2026-11-05 14:30', factSnapshotCount: 4 },
  { version: 1, state: 'superseded', changeNote: 'AI 依据模板「产品说明」生成初稿', authorName: '林悦', createdAt: '2026-10-21 09:00', factSnapshotCount: 4 },
];

const mockGenerationBasisData: GenerationBasis[] = [
  { basisId: 'GB-1', sourceKind: 'local_fact', citation: 'F-001 / F-002 / F-004 / F-005 / F-007', excerpt: '5 条结构化事实（取值随版本快照固定）', retrievedAt: '2026-11-19 08:05' },
  { basisId: 'GB-2', sourceKind: 'kdh_passage', citation: 'KDH · 应用案例库 · 汽车焊装线改造（2025）', excerpt: '…在焊装车间粉尘环境下连续运行 18 个月，无关节密封失效…', retrievedAt: '2026-11-19 08:05' },
  { basisId: 'GB-3', sourceKind: 'kdh_passage', citation: 'KDH · 买家高频问题 · 欧盟 · 机器人类', excerpt: '欧盟买家最常询问：CE 合规、交付周期、备件供应…', retrievedAt: '2026-11-19 08:05' },
];

const mockCallRecordsData: CallRecord[] = [
  { callId: 'CALL-8812', appName: '欧盟官网（AI 门户）', channel: 'rest', version: 2, result: 200, calledAt: '2026-11-19 09:40' },
  { callId: 'CALL-8790', appName: 'GEO Agent', channel: 'mcp', version: 2, result: 200, calledAt: '2026-11-19 08:55' },
  { callId: 'CALL-8702', appName: 'Nordwerk GmbH 经销商门户', channel: 'graphql', version: 2, result: 200, calledAt: '2026-11-18 16:10' },
];

const mockContentTypeOptionsData: ContentTypeOption[] = [
  { contentTypeId: 'product_brief', name: '产品说明', description: '概述 + 参数表 + 图片 + FAQ' },
  { contentTypeId: 'tech_faq', name: '技术 FAQ', description: '问答列表，适合 GEO 与 SDR 引用' },
  { contentTypeId: 'case_study', name: '客户案例', description: '背景 · 方案 · 效果 · 引用事实' },
  { contentTypeId: 'landing_page', name: '落地页', description: '由组件自由组合，交门户渲染' },
];

// 送审时可选的内容集合（发布设置）
const mockCollectionOptionsData: CollectionOption[] = [
  { collectionId: 'COL-12', collectionName: '经销商季度内容包 · 2026Q4', kind: 'channel_pack', kindLabel: '渠道内容包', grantedConsumers: ['Nordwerk GmbH 经销商门户'], ruleSummary: null, ruleTypes: null },
  { collectionId: 'COL-11', collectionName: '汉诺威工业展专题', kind: 'topic', kindLabel: '专题集合', grantedConsumers: ['欧盟官网（AI 门户）', '北岭智造微信小程序'], ruleSummary: null, ruleTypes: null },
  { collectionId: 'COL-09', collectionName: '东南亚新品上市包', kind: 'channel_pack', kindLabel: '渠道内容包', grantedConsumers: [], ruleSummary: null, ruleTypes: null },
  { collectionId: 'COL-10', collectionName: 'SDR 知识集 · 欧盟', kind: 'smart', kindLabel: '智能集合', grantedConsumers: ['SDR Agent', 'GEO Agent'], ruleSummary: '区域 = 欧盟 且 类型 ∈ {技术 FAQ, 产品说明} 且 证据 ∈ {A, B}', ruleTypes: ['技术 FAQ', '产品说明'] },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取可加入的内容集合 [GET] /api/v1/collections
function handleFetchCollectionOptions(params: { contentId: string }) {
  console.log('fetch collection options', params);
}

// ACTION: 保存草稿 [PUT] /api/v1/contents/{id}/draft
function handleSaveDraft(contentId: string, draft: { title: string; summary: string; blocks: ContentBlock[] }) {
  console.log('save draft', contentId, draft);
  alert('草稿已保存（自动生成事实引用与声明检查）');
}

// ACTION: 提交送审（含发布设置）[POST] /api/v1/contents/{id}/submit
function handleSubmitReview(contentId: string, locale: string, publish: PublishSettings | null) {
  console.log('submit review', contentId, locale, publish);
}

// ACTION: 运行发布检查 [POST] /api/v1/contents/{id}/checks
function handleRunPublishCheck(contentId: string) {
  console.log('run checks', contentId);
}

// ACTION: 搜索可引用事实 [GET] /api/v1/facts
function handleSearchFacts(params: { keyword: string; subject: string; region: string }) {
  console.log('search facts', params);
}

// ACTION: AI 编辑辅助 [POST] /api/v1/ai/assist
function handleAiAssist(req: { contentId: string; action: AiActionKey; blockId: string | null }) {
  console.log('ai assist', req);
}

// ACTION: 创建翻译任务 [POST] /api/v1/translation-tasks
function handleCreateTranslationTask(req: { contentId: string; fromLocale: string; toLocale: string }) {
  alert(`已创建翻译任务：${req.fromLocale} → ${req.toLocale}（机翻 + 区域审核）`);
}

// ACTION: 回滚到指定版本 [POST] /api/v1/contents/{id}/versions/{version}/rollback
function handleRollbackVersion(contentId: string, version: number) {
  alert(`已基于 v${version} 创建新草稿`);
}

// ACTION: 获取预览地址 [GET] /api/v1/contents/{id}/preview-url
function handleOpenPreview(contentId: string, locale: string) {
  alert('将在 AI 门户预览环境中打开（Preview API 读取草稿）');
}

// ACTION: 保存内容变体 [PUT] /api/v1/contents/{id}/variants
function handleSaveVariants(contentId: string, variants: ContentVariantItem[], access: { accessLevel: string; tokens: string[] }) {
  alert('变体已保存（随本版本送审）。运行时由门户按受众规则与实验分流选择');
}

// ACTION: 在编辑器内处理事实冲突 [POST] /api/v1/conflicts/{id}/resolve
function handleResolveConflictInline(conflictId: string, body: { action: ConflictAction; adoptedFactId: string | null; note: string }) {
  console.log('resolve conflict', conflictId, body);
}

// ACTION: 移除本内容中的事实引用 [PATCH] /api/v1/contents/{id}/references
function handleRemoveFactRef(contentId: string, factId: string) {
  console.log('remove fact ref', contentId, factId);
}

// ACTION: 新建内容 [POST] /api/v1/contents
function handleCreateContent(req: { contentTypeId: string; brand: string; region: string; locale: string }) {
  console.log('create content', req);
}

// ── 小组件 ────────────────────────────────────────────────
function FactChip({ fact, onResolve }: { fact: ScopedFact | undefined; onResolve?: () => void }) {
  if (!fact) return null;
  const bad = fact.factState !== 'valid';
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              'mx-0.5 inline-flex items-center gap-1 rounded border px-1.5 py-px align-baseline text-[13px] font-medium',
              bad ? 'cursor-pointer border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950' : 'cursor-default border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
            )}
            onClick={bad && onResolve ? onResolve : undefined}
          />
        }
      >
        {bad && <AlertTriangle className="size-3" />}
        {fact.valueLabel}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-0.5 text-xs">
          <div className="font-medium">
            {fact.factId} · {fact.subjectName} · {fact.attributeName}
          </div>
          <div>
            证据 {fact.evidenceGrade} · {fact.evidenceSource}
          </div>
          <div>有效期至 {fact.validTo}</div>
          {fact.stateReason && <div className="text-red-300">{fact.stateReason}</div>}
          {bad && onResolve && <div className="font-medium">点击处理</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// 生产环节保存的内容 → 编辑器结构：正文里的 [取值 | F-xxx] 还原为事实插槽
function toDetail(c: CreatedContent): ContentDetail {
  return {
    contentId: c.contentId,
    title: c.title,
    contentTypeName: c.contentTypeName,
    brandName: c.brandName,
    regionLabel: c.regionLabel,
    locale: c.locale,
    status: 'draft',
    version: 1,
    ownerName: c.ownerName,
    updatedAt: c.createdAt,
    summary: c.summary,
    summaryAiGenerated: c.source.kind !== 'manual',
    source: c.source,
    blocks: c.sections.map((sec, i) => ({
      blockId: `g${i}`,
      kind: 'paragraph' as const,
      heading: sec.heading,
      aiGenerated: c.source.kind !== 'manual',
      segments: sec.body.split(/(\[[^\]|]+\|\s*F-\d+\])/).filter(Boolean).map((part): Segment => {
        const m = part.match(/^\[[^\]|]+\|\s*(F-\d+)\]$/);
        return m ? { segKind: 'fact', factId: m[1] } : { segKind: 'text', text: part };
      }),
    })),
  };
}

// ── 主组件 ────────────────────────────────────────────────
export default function ContentEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = id === 'new';
  const { state: demo, dispatch } = useDemo();
  // 生产环节（AI 生成 / 一稿多用 / 翻译）保存的内容
  const created = demo.created.find((c) => c.contentId === id);
  const isOwn = isNew || !!created;
  const d = created ? toDetail(created) : mockContentDetailData;
  const resolution = demo.conflicts[EDITOR_CONFLICT_ID];
  const removedRefs = demo.removedRefs[d.contentId] ?? [];
  const conflictCleared = conflictClearedFor(demo, d.contentId);
  // 冲突处理后，事实取当前值（采纳 IP65 时取 IP65）
  const overrides = factOverrides(demo);
  const choiceOf = (factId: string) => created?.conflictChoices?.find((c) => c.localFactId === factId && !demo.conflicts[c.conflictId]);
  const factMap = new Map(
    mockScopedFactsData.map((f) => {
      const ch = choiceOf(f.factId);
      if (ch) return [f.factId, { ...f, valueLabel: ch.chosenValue, stateReason: `生成时选用（${ch.conflictId} 待审批确认）` }] as const;
      if (overrides[f.factId]) return [f.factId, { ...f, valueLabel: overrides[f.factId].value, stateReason: null }] as const;
      if (f.factId !== 'F-002' || !resolution) return [f.factId, f] as const;
      if (resolution.action === 'adopt' || resolution.action === 'split_scope')
        return [f.factId, { ...f, valueLabel: resolution.adoptedValue ?? f.valueLabel, factState: 'valid' as FactState, stateReason: null }] as const;
      return [f.factId, { ...f, stateReason: resolution.action === 'pause_all' ? '两条取值都已暂停引用，等待补齐证据' : '已发起源系统修正，等待 KDH 处理' }] as const;
    }),
  );
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveAction, setResolveAction] = useState<'adopt_66' | 'adopt_65' | 'split_scope'>('adopt_66');
  const [resolveNote, setResolveNote] = useState('');
  const canResolve = ['full', 'scoped'].includes(accessOf(demo.role, 'conflicts'));
  const reviewTaskId = 'RV-551';
  const review = demo.reviews[reviewTaskId];
  const ownSubmission = demo.submitted.find((t) => (t.kind ?? 'content') === 'content' && t.contentId === (isNew ? 'C-1070' : d.contentId));
  const ownReview = ownSubmission ? demo.reviews[ownSubmission.taskId] : undefined;
  const status: ContentStatus = isOwn
    ? ownSubmission
      ? ownReview?.status === 'approved'
        ? 'published'
        : ownReview?.status === 'rejected'
          ? 'draft'
          : 'in_review'
      : 'draft'
    : review?.status === 'approved'
      ? 'published'
      : review?.status === 'rejected'
        ? 'draft'
        : d.status;
  const checks = mockPublishChecksData.map((c) => {
    if (c.checkKey !== 'conflict') return c;
    if (isOwn) return { ...c, result: 'pass' as CheckResult, detail: '未引用存在冲突的事实', fixPath: null };
    if (conflictCleared)
      return {
        ...c,
        result: 'pass' as CheckResult,
        detail: removedRefs.includes('F-002') ? '本内容已移除防护等级引用' : `CF-018 已处理：${resolution?.action === 'split_scope' ? '拆分适用范围' : `采纳 ${resolution?.adoptedValue}`}`,
        fixPath: null,
      };
    return resolution ? { ...c, detail: `${c.detail}（${resolution.action === 'pause_all' ? '已暂停引用' : '已发起源系统修正'}）` } : c;
  });
  const pendingChoices = (created?.conflictChoices ?? []).filter((c) => !demo.conflicts[c.conflictId]);
  if (pendingChoices.length > 0)
    checks.push({ checkKey: 'conflict_choice', checkLabel: '生成时的冲突取值', result: 'warn' as CheckResult, detail: `${pendingChoices.map((c) => `${c.attributeName}选用 ${c.chosenValue}（${c.conflictId}）`).join('；')}，送审后由审批确认，通过即裁定`, fixPath: null });
  const openResolve = () => {
    setResolveNote('');
    setResolveOpen(true);
  };
  const confirmResolve = () => {
    const adoptedValue = resolveAction === 'adopt_65' ? 'IP65' : 'IP66';
    const action: ConflictAction = resolveAction === 'split_scope' ? 'split_scope' : 'adopt';
    handleResolveConflictInline(EDITOR_CONFLICT_ID, { action, adoptedFactId: resolveAction === 'adopt_65' ? 'F-003' : 'F-002', note: resolveNote });
    dispatch({ type: 'resolveConflict', resolution: { conflictId: EDITOR_CONFLICT_ID, action, adoptedValue, note: resolveNote, resolvedBy: ROLE_CONFIG[demo.role].person, resolvedAt: `今天 ${nowLabel()}` } });
    setResolveOpen(false);
    const fp = factPublishAction(demo, { conflictId: EDITOR_CONFLICT_ID, subjectName: 'BL-R600', attributeName: '防护等级', before: action === 'split_scope' ? 'IP66 / IP65（未区分型号）' : adoptedValue === 'IP66' ? 'IP65' : 'IP66', after: action === 'split_scope' ? 'IP66（标准版）/ IP65（旧款）' : adoptedValue, person: ROLE_CONFIG[demo.role].person, redLine: false });
    dispatch(fp.action);
    notify(`${action === 'split_scope' ? 'CF-018 已拆分适用范围' : `CF-018 已采纳 ${adoptedValue}`}，结果进入事实库，本内容检查已通过；回写 KDH 的事实发布申请 ${fp.taskId} 已提交审批`);
  };
  const removeRef = () => {
    handleRemoveFactRef(d.contentId, 'F-002');
    dispatch({ type: 'removeRef', contentId: d.contentId, factId: 'F-002' });
    setResolveOpen(false);
    notify('已在本内容中移除防护等级引用，改用不含数值的表述；冲突仍由事实负责人处理');
  };
  const isResubmitMock = status === 'draft' && !isOwn && !!review;
  // newTypeId 在下方声明，这里用函数延后取值
  const typeNameNow = () => mockContentTypeOptionsData.find((t) => t.contentTypeId === newTypeId)?.name ?? d.contentTypeName;
  const [publishOpen, setPublishOpen] = useState(false);
  const [pubChannels, setPubChannels] = useState<string[]>([]);
  const [pubCollections, setPubCollections] = useState<string[]>([]);
  const smartMatched = () => mockCollectionOptionsData.filter((c) => c.kind === 'smart' && (c.ruleTypes ?? []).includes(typeNameNow()));
  const openPublish = () => {
    if (isResubmitMock) return submit(null);
    handleFetchCollectionOptions({ contentId: d.contentId });
    setPubChannels(defaultChannelsOf(typeNameNow()));
    setPubCollections([]);
    setPublishOpen(true);
  };
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const submit = (publish: PublishSettings | null) => {
    handleSubmitReview(d.contentId, locale, publish);
    setPublishOpen(false);
    if (isResubmitMock && review) {
      dispatch({ type: 'setReview', progress: { ...review, status: 'in_review', stageIndex: 1, history: [...review.history, { stageName: '提交', actor: '林悦', decision: 'resubmit', comment: '按审核意见修改后重新送审', at: `今天 ${nowLabel()}` }] } });
      navigate('/review', { state: { taskId: reviewTaskId } });
      notify('已重新送审，审批从「品牌审核」开始');
      return;
    }
    const taskId = `RV-${560 + demo.submitted.length}`;
    dispatch({
      type: 'submitTask',
      task: {
        taskId, contentId: isNew ? 'C-1070' : d.contentId, title: title || '未命名内容', contentTypeName: typeNameNow(), brandName: d.brandName, locale, version: 1, publish: publish ?? undefined,
        submittedBy: ROLE_CONFIG[demo.role].person, submittedAt: `今天 ${nowLabel()}`,
        stages: [
          { stageName: '品牌审核', approverLabel: '周敏（北岭智造品牌管理员）', rule: '任一人通过' },
          { stageName: '合规审核', approverLabel: '何静（合规审核）', rule: '含 AI 生成段落或区域 = 欧盟' },
        ],
      },
      progress: { taskId, stageIndex: 1, status: 'in_review', history: [{ stageName: '提交', actor: ROLE_CONFIG[demo.role].person, decision: 'submit', comment: '', at: `今天 ${nowLabel()}` }] },
    });
    notify(`已送审 ${taskId}：匹配审批流程「对外内容 · 标准」，第一个节点为品牌审核`);
    navigate('/review', { state: { taskId } });
  };

  const [newTypeId, setNewTypeId] = useState<string | null>(null);
  const [title, setTitle] = useState(isNew ? '' : d.title);
  const [summary, setSummary] = useState(isNew ? '' : d.summary);
  const [blocks, setBlocks] = useState<ContentBlock[]>(isNew ? [{ blockId: 'n1', kind: 'paragraph', heading: '正文', segments: [], aiGenerated: false }] : d.blocks);
  const [locale, setLocale] = useState(d.locale);
  const [activeBlock, setActiveBlock] = useState<string>(blocks[0]?.blockId ?? '');
  const [factKeyword, setFactKeyword] = useState('');
  const [aiResult, setAiResult] = useState<{ action: string; text: string } | null>(null);

  const failed = checks.filter((c) => c.result === 'fail').length;
  const warned = checks.filter((c) => c.result === 'warn').length;

  const insertFact = (factId: string) =>
    setBlocks((prev) =>
      prev.map((b) =>
        b.blockId === activeBlock && b.kind === 'paragraph'
          ? { ...b, segments: [...b.segments, { segKind: 'text', text: ' ' }, { segKind: 'fact', factId }] }
          : b.blockId === activeBlock && b.kind === 'spec_table'
            ? { ...b, factIds: b.factIds.includes(factId) ? b.factIds : [...b.factIds, factId] }
            : b,
      ),
    );
  const addBlock = (kind: ContentBlock['kind']) => {
    const blockId = `n${Date.now()}`;
    const block: ContentBlock =
      kind === 'paragraph'
        ? { blockId, kind, heading: '新段落', segments: [], aiGenerated: false }
        : kind === 'spec_table'
          ? { blockId, kind, heading: '参数表', factIds: [] }
          : kind === 'image'
            ? { blockId, kind, assetId: 'A-2190', caption: '' }
            : { blockId, kind, heading: 'FAQ', items: [] };
    setBlocks((prev) => [...prev, block]);
    setActiveBlock(blockId);
  };

  // 新建：先选内容类型
  if (isNew && !newTypeId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/content')}>
          <ArrowLeft /> 返回内容
        </Button>
        <h1 className="text-xl font-semibold">新建内容：选择内容类型</h1>
        <p className="text-sm text-muted-foreground">内容类型决定字段结构，在「设置 → 内容模型」中维护。想让 AI 按要求和所选引用直接生成，请用「内容生产 → AI 生成」。</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {mockContentTypeOptionsData.map((t) => (
            <Card
              key={t.contentTypeId}
              size="sm"
              className="cursor-pointer hover:ring-primary/40"
              onClick={() => {
                setNewTypeId(t.contentTypeId);
                handleCreateContent({ contentTypeId: t.contentTypeId, brand: 'beiling', region: 'eu', locale: 'en-US' });
              }}
            >
              <CardHeader>
                <CardTitle>{t.name}</CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const asset = (assetId: string) => mockAssetPickerData.find((a) => a.assetId === assetId);
  const filteredFacts = mockScopedFactsData.filter(
    (f) => !factKeyword || f.attributeName.includes(factKeyword) || f.valueLabel.includes(factKeyword) || f.factId.includes(factKeyword),
  );
  const activeKind = blocks.find((b) => b.blockId === activeBlock)?.kind;

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏 */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-background px-4 py-2.5">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/content')} aria-label="返回">
          <ArrowLeft />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{title || '未命名内容'}</span>
            {(!isNew || ownSubmission) && <ContentStatusBadge status={status} />}
          </div>
          <div className="text-xs text-muted-foreground">
            {isNew ? '新建' : `${d.contentId} · v${d.version}`} · {d.contentTypeName} · {d.brandName} · {d.regionLabel} · 负责人 {d.ownerName}
            {!isNew && (
              <>
                {' · 来源 '}
                <ToneBadge tone={SOURCE_CONFIG[d.source.kind].tone} className="align-middle">
                  {SOURCE_CONFIG[d.source.kind].label}
                </ToneBadge>
                {d.source.topicId && ` 选题 ${d.source.topicId}`}
                {d.source.sourceContentId && ` 源 ${d.source.sourceContentId}`}
              </>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select items={LOCALE_OPTIONS} value={locale} onValueChange={(v) => setLocale(v as string)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => handleOpenPreview(d.contentId, locale)}>
            <Eye /> 预览
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSaveDraft(d.contentId, { title, summary, blocks })}>
            <Save /> 保存
          </Button>
          {status === 'in_review' ? (
            <Button size="sm" variant="secondary" onClick={() => navigate('/review', { state: { taskId: ownSubmission?.taskId ?? reviewTaskId } })}>
              <Send /> 审核中 · 查看审批进度
            </Button>
          ) : status === 'published' ? (
            <Button size="sm" variant="secondary" disabled>
              <CheckCircle2 /> 已生效
            </Button>
          ) : (
            <Button size="sm" disabled={failed > 0} title={failed > 0 ? '发布检查有未通过项' : undefined} onClick={openPublish}>
              <Send /> {review?.status === 'rejected' ? '重新送审' : '送审'}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="edit" className="min-h-0 flex-1 gap-0">
        <div className="border-b bg-background px-4">
          <TabsList variant="line" className="max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="edit">编辑</TabsTrigger>
            <TabsTrigger value="variants">变体与个性化</TabsTrigger>
            <TabsTrigger value="locales">语种版本</TabsTrigger>
            <TabsTrigger value="refs">引用与依据</TabsTrigger>
            <TabsTrigger value="versions">版本历史</TabsTrigger>
            <TabsTrigger value="calls">调用情况</TabsTrigger>
          </TabsList>
        </div>

        {/* 编辑 */}
        <TabsContent value="edit" className="min-h-0 flex-1">
          <div className="grid grid-cols-1 md:h-full md:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[180px_minmax(0,1fr)_340px]">
            {/* 结构 */}
            <div className="hidden border-r bg-background p-3 text-sm xl:block">
              <div className="mb-2 text-xs font-medium text-muted-foreground">结构</div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between rounded px-2 py-1">
                  标题 <span className={cn('size-1.5 rounded-full', title ? 'bg-emerald-500' : 'bg-red-500')} />
                </div>
                <div className="flex items-center justify-between rounded px-2 py-1">
                  摘要 <span className={cn('size-1.5 rounded-full', summary ? 'bg-emerald-500' : 'bg-red-500')} />
                </div>
                {blocks.map((b) => (
                  <button
                    key={b.blockId}
                    onClick={() => setActiveBlock(b.blockId)}
                    className={cn('flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-muted', activeBlock === b.blockId && 'bg-muted font-medium')}
                  >
                    <span className="truncate">
                      {b.kind === 'image' ? '图片' : b.heading}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {b.kind === 'paragraph' ? '段落' : b.kind === 'spec_table' ? '参数表' : b.kind === 'faq' ? 'FAQ' : '资产'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 字段区 */}
            <ScrollArea className="h-full">
              <div className="mx-auto max-w-3xl space-y-5 p-6">
                <div className="space-y-1.5">
                  <Label>标题</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="输入标题" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label>机器可读摘要</Label>
                    {d.summaryAiGenerated && !isNew && <AiMark />}
                    <span className="ml-auto text-xs text-muted-foreground">{summary.length} / 300 · 供 GEO、SDR 与外部 Agent 直接引用</span>
                  </div>
                  <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
                </div>

                {blocks.map((b) => (
                  <div
                    key={b.blockId}
                    onClick={() => setActiveBlock(b.blockId)}
                    className={cn(
                      'rounded-xl border bg-background p-4 transition-shadow',
                      activeBlock === b.blockId && 'ring-2 ring-primary/30',
                      b.kind === 'paragraph' && b.aiGenerated && 'border-l-4 border-l-violet-400',
                    )}
                  >
                    {b.kind === 'paragraph' && (
                      <>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-sm font-semibold">{b.heading}</span>
                          {b.aiGenerated && <AiMark />}
                        </div>
                        <p className="min-h-10 text-[15px] leading-7">
                          {b.segments.length === 0 && <span className="text-muted-foreground">输入正文，或从右侧「事实」插入事实标签…</span>}
                          {b.segments.map((s, i) =>
                            s.segKind === 'text' ? (
                              <span key={i}>{s.text}</span>
                            ) : removedRefs.includes(s.factId) ? (
                              <span key={i} className="rounded bg-muted px-1" title="已移除事实引用，改用不含数值的表述">
                                sealed
                              </span>
                            ) : (
                              <FactChip key={i} fact={factMap.get(s.factId)} onResolve={openResolve} />
                            ),
                          )}
                        </p>
                      </>
                    )}
                    {b.kind === 'spec_table' && (
                      <>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-sm font-semibold">{b.heading}</span>
                          <ToneBadge tone="teal">事实插槽 · 事实更新后自动刷新</ToneBadge>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>参数</TableHead>
                              <TableHead>取值</TableHead>
                              <TableHead>证据</TableHead>
                              <TableHead>有效期至</TableHead>
                              <TableHead>状态</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {b.factIds.filter((fid) => !removedRefs.includes(fid)).map((fid) => {
                              const f = factMap.get(fid);
                              if (!f) return null;
                              return (
                                <TableRow key={fid}>
                                  <TableCell>{f.attributeName}</TableCell>
                                  <TableCell className="font-medium">{f.valueLabel}</TableCell>
                                  <TableCell>
                                    <EvidenceBadge grade={f.evidenceGrade} />
                                  </TableCell>
                                  <TableCell className="tabular-nums">{f.validTo}</TableCell>
                                  <TableCell>
                                    <ToneBadge tone={FACT_STATE_CONFIG[f.factState].tone}>{FACT_STATE_CONFIG[f.factState].label}</ToneBadge>
                                    {f.factState === 'conflict' && (
                                      <Button size="xs" variant="link" className="h-auto px-1" onClick={openResolve}>
                                        处理
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </>
                    )}
                    {b.kind === 'image' &&
                      (() => {
                        const a = asset(b.assetId);
                        return (
                          <div className="flex gap-4">
                            <AssetThumb mediaType={a?.mediaType ?? 'image'} seed={b.assetId} className="h-28 w-44 shrink-0" />
                            <div className="min-w-0 space-y-1.5 text-sm">
                              <div className="font-medium">{a?.fileName}</div>
                              <div className="flex flex-wrap gap-1">
                                {a && <SyncBadge status={a.syncStatus} />}
                                <ToneBadge tone="gray">{a?.rightsLabel}</ToneBadge>
                                {a?.rightsExpiresAt && <ToneBadge tone="amber">授权至 {a.rightsExpiresAt}</ToneBadge>}
                              </div>
                              <Input defaultValue={b.caption} placeholder="图注（多语种）" className="h-7 text-xs" />
                            </div>
                          </div>
                        );
                      })()}
                    {b.kind === 'faq' && (
                      <>
                        <div className="mb-2 text-sm font-semibold">{b.heading}</div>
                        <div className="space-y-3">
                          {b.items.length === 0 && <div className="text-sm text-muted-foreground">暂无问答，可在右侧 AI 中「从正文生成 FAQ」</div>}
                          {b.items.map((q, i) => (
                            <div key={i} className="rounded-lg bg-muted/50 p-3 text-sm">
                              <div className="flex items-center gap-2 font-medium">
                                Q：{q.question} {q.aiGenerated && <AiMark />}
                              </div>
                              <div className="mt-1 text-muted-foreground">A：{q.answer}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}

                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" className="w-full border-dashed" />}>
                    <Plus /> 添加内容块
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => addBlock('paragraph')}>段落</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addBlock('spec_table')}>参数表（事实插槽）</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addBlock('image')}>图片 / 视频</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addBlock('faq')}>FAQ</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </ScrollArea>

            {/* 右侧面板 */}
            <div className="min-h-0 border-l bg-background">
              <Tabs defaultValue="checks" className="h-full gap-0">
                <div className="border-b px-3 pt-2">
                  <TabsList variant="line">
                    <TabsTrigger value="checks">
                      检查
                      {failed > 0 && <Badge variant="destructive" className="h-4 px-1 text-[10px]">{failed}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="facts">事实</TabsTrigger>
                    <TabsTrigger value="assets">资产</TabsTrigger>
                    <TabsTrigger value="ai">AI</TabsTrigger>
                  </TabsList>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <TabsContent value="checks" className="space-y-3 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {failed} 项未通过 · {warned} 项提醒
                      </span>
                      <Button size="xs" variant="outline" onClick={() => handleRunPublishCheck(d.contentId)}>
                        <RefreshCw /> 重新检查
                      </Button>
                    </div>
                    {failed > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle />
                        <AlertTitle>不能送审</AlertTitle>
                        <AlertDescription>未通过项需回到内容或事实库处理，审核不能绕过。</AlertDescription>
                      </Alert>
                    )}
                    {checks.map((c) => (
                      <div key={c.checkKey} className="flex gap-2 rounded-lg border p-2.5 text-sm">
                        {CHECK_ICON[c.result]}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{c.checkLabel}</div>
                          <div className="text-xs text-muted-foreground">{c.detail}</div>
                          {c.fixPath && c.result !== 'pass' && (
                            <Button size="xs" variant="link" className="h-auto px-0" onClick={() => (c.checkKey === 'conflict' ? openResolve() : navigate(c.fixPath!))}>
                              {c.checkKey === 'conflict' ? '在这里处理 →' : '去处理 →'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="facts" className="space-y-3 p-3">
                    <div className="relative">
                      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-8"
                        placeholder="搜索属性或取值"
                        value={factKeyword}
                        onChange={(e) => {
                          setFactKeyword(e.target.value);
                          handleSearchFacts({ keyword: e.target.value, subject: 'BL-R600', region: 'eu' });
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      插入到当前块：{activeKind === 'paragraph' ? '段落（正文引用，事实变更时进复核）' : activeKind === 'spec_table' ? '参数表（插槽，自动刷新）' : '请先选中段落或参数表'}
                    </p>
                    {filteredFacts.map((f) => {
                      const blocked = f.factState === 'out_of_scope' || f.factState === 'expired';
                      return (
                        <div key={f.factId} className={cn('rounded-lg border p-2.5 text-sm', blocked && 'opacity-60')}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{f.attributeName}</span>
                            <EvidenceBadge grade={f.evidenceGrade} />
                            <ToneBadge tone={FACT_STATE_CONFIG[f.factState].tone}>{FACT_STATE_CONFIG[f.factState].label}</ToneBadge>
                          </div>
                          <div className="mt-0.5 text-[15px]">{f.valueLabel}</div>
                          <div className="text-xs text-muted-foreground">
                            {f.factId} · {f.evidenceSource} · 至 {f.validTo}
                          </div>
                          {f.stateReason && <div className="mt-1 text-xs text-amber-700">{f.stateReason}</div>}
                          <Button
                            size="xs"
                            variant="outline"
                            className="mt-2"
                            disabled={blocked || (activeKind !== 'paragraph' && activeKind !== 'spec_table')}
                            onClick={() => insertFact(f.factId)}
                          >
                            <Plus /> 插入
                          </Button>
                        </div>
                      );
                    })}
                  </TabsContent>

                  <TabsContent value="assets" className="space-y-3 p-3">
                    <p className="text-xs text-muted-foreground">来自资产库（本地上传与外部导入的副本）。授权到期或源已删除的资产无法通过发布检查。</p>
                    {mockAssetPickerData.map((a) => (
                      <div key={a.assetId} className="flex gap-3 rounded-lg border p-2">
                        <AssetThumb mediaType={a.mediaType} seed={a.assetId} className="h-14 w-20 shrink-0" />
                        <div className="min-w-0 text-xs">
                          <div className="truncate text-sm font-medium">{a.fileName}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <SyncBadge status={a.syncStatus} />
                            {a.rightsExpiresAt && <ToneBadge tone="amber">至 {a.rightsExpiresAt}</ToneBadge>}
                          </div>
                          <div className="mt-1 text-muted-foreground">{a.rightsLabel}</div>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/assets')}>
                      打开资产库
                    </Button>
                  </TabsContent>

                  <TabsContent value="ai" className="space-y-3 p-3">
                    <p className="text-xs text-muted-foreground">AI 只基于本内容引用的事实与生成依据工作；结果默认为建议，采纳后带 AI 标识。</p>
                    <div className="grid grid-cols-2 gap-2">
                      {AI_ACTIONS.map((a) => (
                        <Button
                          key={a.key}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleAiAssist({ contentId: d.contentId, action: a.key, blockId: activeBlock });
                            setAiResult({
                              action: a.label,
                              text:
                                a.key === 'brand_voice'
                                  ? '发现 1 处偏离：“best-in-class” 属于北岭智造禁用词，建议改为 “proven in 1,200+ installations”。'
                                  : 'BL-R600 combines a 20 kg payload with ±0.02 mm repeatability, giving welding and palletizing lines both strength and precision.',
                            });
                          }}
                        >
                          <Sparkles /> {a.label}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleCreateTranslationTask({ contentId: d.contentId, fromLocale: locale, toLocale: 'de-DE' })}
                    >
                      <Languages /> 翻译为 de-DE（区域要求的缺失语种）
                    </Button>
                    {aiResult && (
                      <Card size="sm">
                        <CardHeader>
                          <CardTitle className="text-sm">{aiResult.action}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <p>{aiResult.text}</p>
                          <div className="flex gap-2">
                            <Button size="xs" onClick={() => setAiResult(null)}>
                              采纳
                            </Button>
                            <Button size="xs" variant="ghost" onClick={() => setAiResult(null)}>
                              放弃
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          </div>
        </TabsContent>

        {/* 语种版本 */}
        <TabsContent value="locales" className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>语种版本</CardTitle>
              <CardDescription>欧盟区域要求 en-US、de-DE；每个语种独立审核与生效。非多语种字段（参数表、型号）各语种共享。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>语种</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>版本</TableHead>
                    <TableHead>区域要求</TableHead>
                    <TableHead>站点 · 页面</TableHead>
                    <TableHead>翻译来源</TableHead>
                    <TableHead>更新</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockLocaleVariantsData.map((l) => (
                    <TableRow key={l.locale}>
                      <TableCell className="font-mono">{l.locale}</TableCell>
                      <TableCell>{l.status === 'missing' ? <ToneBadge tone="red">缺失</ToneBadge> : <ContentStatusBadge status={l.status} />}</TableCell>
                      <TableCell>{l.version ? `v${l.version}` : '—'}</TableCell>
                      <TableCell>{l.requiredByRegion ? '必需' : '可选'}</TableCell>
                      <TableCell className="max-w-72 text-xs">
                        {l.siteName}
                        <div className="truncate font-mono text-muted-foreground">{l.pageUrl}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{l.translatedFrom ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{l.updatedAt ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {l.status === 'missing' ? (
                          <Button size="xs" onClick={() => handleCreateTranslationTask({ contentId: d.contentId, fromLocale: 'en-US', toLocale: l.locale })}>
                            <Languages /> 创建翻译
                          </Button>
                        ) : (
                          <Button size="xs" variant="outline" onClick={() => setLocale(l.locale)}>
                            编辑
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="mt-5">
            <CardHeader>
              <CardTitle>hreflang 关系（输出给门户）</CardTitle>
              <CardDescription>CMS 维护各语种版本与站点页面的对应关系，通过 Delivery API 输出；门户负责写入页面头部。缺失的语种不会输出。</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{mockLocaleVariantsData
                .filter((l) => l.status !== 'missing')
                .map((l) => `<link rel="alternate" hreflang="${l.locale.toLowerCase()}" href="${l.pageUrl}" />`)
                .concat(['<link rel="alternate" hreflang="x-default" href="https://eu.beiling.com/en/robots/bl-r600" />'])
                .join('\n')}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variants" className="space-y-5 p-6">
          <Card>
            <CardHeader>
              <CardTitle>内容变体</CardTitle>
              <CardDescription>CMS 只负责把各版本写好、审好，并标好受众规则和实验分组；按访客选择哪个版本、怎么分流，由门户在运行时完成，效果按变体回传。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>字段 · 变体</TableHead>
                    <TableHead>受众规则</TableHead>
                    <TableHead>实验</TableHead>
                    <TableHead>内容</TableHead>
                    <TableHead>回流效果</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockContentVariantsData.map((v) => (
                    <TableRow key={v.variantId}>
                      <TableCell>
                        <div className="font-medium">{v.variantName}</div>
                        <div className="text-xs text-muted-foreground">
                          {v.fieldLabel} · {v.status === 'active' ? '生效' : '草稿'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{v.audienceRule}</TableCell>
                      <TableCell className="text-xs">{v.experimentKey ? `${v.experimentKey} · ${v.trafficShare}%` : '—'}</TableCell>
                      <TableCell className="max-w-80 text-sm whitespace-normal">
                        {v.aiGenerated && <AiMark className="mr-1" />}
                        {v.text}
                      </TableCell>
                      <TableCell className="text-xs">{v.resultLabel ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>访问与个性化令牌</CardTitle>
              <CardDescription>访问级别决定门户是否要求登录；令牌是占位符，由门户用访客属性替换，取不到时显示回退文字。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">访问级别</span>
                <ToneBadge tone="green">公开</ToneBadge>
                <span className="text-xs text-muted-foreground">可选：登录会员 / 经销商（伙伴门户）</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">使用的令牌</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{'{{contact.company | "your plant"}}'}</code>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{'{{visitor.country | "Europe"}}'}</code>
              </div>
              <Button size="sm" onClick={() => handleSaveVariants(d.contentId, mockContentVariantsData, { accessLevel: 'public', tokens: ['contact.company', 'visitor.country'] })}>
                保存变体
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 引用与依据 */}
        <TabsContent value="refs" className="grid gap-5 p-6 lg:grid-cols-2">
          {!isNew && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  来源 <ToneBadge tone={SOURCE_CONFIG[d.source.kind].tone}>{SOURCE_CONFIG[d.source.kind].label}</ToneBadge>
                </CardTitle>
                <CardDescription>{SOURCE_CONFIG[d.source.kind].hint}。来源和生产时选的引用随内容保存，内容管理里可按来源筛选。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm md:grid-cols-[260px_1fr]">
                <div className="space-y-1.5">
                  {d.source.topicId && (
                    <div>
                      <span className="text-muted-foreground">选题：</span>
                      <button className="text-primary hover:underline" onClick={() => navigate('/production/topics')}>
                        {d.source.topicId}
                      </button>
                    </div>
                  )}
                  {d.source.taskId && (
                    <div>
                      <span className="text-muted-foreground">生产任务：</span>
                      {d.source.taskId}
                    </div>
                  )}
                  {d.source.sourceContentId && (
                    <div>
                      <span className="text-muted-foreground">源内容：</span>
                      {d.source.sourceContentId}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">模板：</span>
                    {d.source.templateName ? `${d.source.templateId} ${d.source.templateName}` : '未使用模板'}
                  </div>
                </div>
                <div className="flex flex-wrap content-start gap-1.5">
                  {d.source.refs.map((r) => (
                    <span key={`${r.refKind}-${r.refId}`} className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs">
                      <span className="text-muted-foreground">{REF_KIND_LABEL[r.refKind]}</span> {r.label}
                    </span>
                  ))}
                  {d.source.refs.length === 0 && <span className="text-xs text-muted-foreground">生产时未选择引用</span>}
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>引用的事实</CardTitle>
              <CardDescription>发布时取值随版本快照固定；事实更新后：参数表自动刷新，正文引用进入复核。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>事实</TableHead>
                    <TableHead>取值</TableHead>
                    <TableHead>引用方式</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockScopedFactsData
                    .filter((f) => ['F-001', 'F-002', 'F-004', 'F-005', 'F-007'].includes(f.factId))
                    .map((f) => (
                      <TableRow key={f.factId}>
                        <TableCell>
                          {f.attributeName}
                          <div className="text-xs text-muted-foreground">{f.factId}</div>
                        </TableCell>
                        <TableCell className="font-medium">{f.valueLabel}</TableCell>
                        <TableCell className="text-xs">{['F-005', 'F-007'].includes(f.factId) ? '插槽' : '正文 + 插槽'}</TableCell>
                        <TableCell>
                          <ToneBadge tone={FACT_STATE_CONFIG[f.factState].tone}>{FACT_STATE_CONFIG[f.factState].label}</ToneBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>生成依据</CardTitle>
              <CardDescription>生成时使用的本地事实与知识库片段原文，随版本保存；知识库文档后续删改不影响追溯。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockGenerationBasisData.map((g) => (
                <div key={g.basisId} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <ToneBadge tone={g.sourceKind === 'local_fact' ? 'blue' : 'teal'}>{g.sourceKind === 'local_fact' ? '本地事实' : '知识库片段'}</ToneBadge>
                    <span className="text-xs text-muted-foreground">{g.retrievedAt}</span>
                  </div>
                  <div className="mt-1.5 font-medium">{g.citation}</div>
                  <div className="mt-1 text-muted-foreground">{g.excerpt}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 版本历史 */}
        <TabsContent value="versions" className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>版本历史</CardTitle>
              <CardDescription>送审即冻结为不可变版本；新版本审核期间，已生效版本继续对外提供。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>版本</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead>事实快照</TableHead>
                    <TableHead>作者</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockVersionHistoryData.map((v) => (
                    <TableRow key={v.version}>
                      <TableCell className="font-medium">v{v.version}</TableCell>
                      <TableCell>
                        {v.state === 'superseded' ? <ToneBadge tone="gray">已替代</ToneBadge> : <ContentStatusBadge status={v.state} />}
                      </TableCell>
                      <TableCell>{v.changeNote}</TableCell>
                      <TableCell>{v.factSnapshotCount} 条</TableCell>
                      <TableCell>{v.authorName}</TableCell>
                      <TableCell className="text-muted-foreground">{v.createdAt}</TableCell>
                      <TableCell className="text-right">
                        <Button size="xs" variant="outline" onClick={() => handleRollbackVersion(d.contentId, v.version)}>
                          以此版本新建草稿
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 调用情况 */}
        <TabsContent value="calls" className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>调用情况</CardTitle>
              <CardDescription>哪些调用方取过这条内容、取的哪个版本（只会取到已生效版本 v2）。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>调用 ID</TableHead>
                    <TableHead>调用方</TableHead>
                    <TableHead>通道</TableHead>
                    <TableHead>版本</TableHead>
                    <TableHead>结果</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockCallRecordsData.map((c) => (
                    <TableRow key={c.callId}>
                      <TableCell className="font-mono text-xs">{c.callId}</TableCell>
                      <TableCell>{c.appName}</TableCell>
                      <TableCell className="uppercase">{c.channel}</TableCell>
                      <TableCell>v{c.version}</TableCell>
                      <TableCell>
                        <ToneBadge tone={c.result === 200 ? 'green' : 'red'}>{c.result}</ToneBadge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.calledAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>送审 · 发布设置</DialogTitle>
            <DialogDescription>在这里定好审批通过后发到哪里：上架内容市场的渠道，以及放进哪些内容集合。审批人会一起看到，通过后自动执行。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label>上架渠道</Label>
                <span className="text-xs text-muted-foreground">按「{typeNameNow()}」预选，可调整</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(CHANNEL_LABEL).map((ch) => (
                  <Label key={ch} className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 font-normal', pubChannels.includes(ch) && 'border-primary/50 bg-primary/5')}>
                    <Checkbox checked={pubChannels.includes(ch)} onCheckedChange={() => setPubChannels(toggleIn(pubChannels, ch))} /> {CHANNEL_LABEL[ch]}
                  </Label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>加入内容集合</Label>
              <div className="space-y-1.5">
                {mockCollectionOptionsData
                  .filter((c) => c.kind !== 'smart')
                  .map((c) => (
                    <Label key={c.collectionId} className={cn('flex items-start gap-2 rounded-md border p-2 font-normal', pubCollections.includes(c.collectionId) && 'border-primary/50 bg-primary/5')}>
                      <Checkbox className="mt-0.5" checked={pubCollections.includes(c.collectionId)} onCheckedChange={() => setPubCollections(toggleIn(pubCollections, c.collectionId))} />
                      <div className="min-w-0">
                        <div>
                          {c.collectionName} <span className="text-xs text-muted-foreground">· {c.kindLabel}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{c.grantedConsumers.length ? `授权给 ${c.grantedConsumers.join('、')}` : '尚未授权调用方'}</div>
                      </div>
                    </Label>
                  ))}
              </div>
              {smartMatched().map((c) => (
                <div key={c.collectionId} className="rounded-md bg-teal-50 p-2 text-xs text-teal-900 dark:bg-teal-950 dark:text-teal-100">
                  符合智能集合「{c.collectionName}」的规则，生效后自动加入（{c.ruleSummary}）
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              取消
            </Button>
            <Button
              disabled={pubChannels.length === 0 && pubCollections.length === 0}
              onClick={() =>
                submit({
                  channels: pubChannels,
                  collections: mockCollectionOptionsData.filter((c) => pubCollections.includes(c.collectionId)).map((c) => ({ collectionId: c.collectionId, collectionName: c.collectionName })),
                  smartCollections: smartMatched().map((c) => c.collectionName),
                })
              }
            >
              <Send /> 送审
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>处理冲突 CF-018 · BL-R600 防护等级</DialogTitle>
            <DialogDescription>冲突处理后会回写 KDH，所有引用这条事实的内容同步生效；也可以只在本内容中先移除这个引用，内容照常推进。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-300 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">IP66</span>
                  <ToneBadge tone="green">推荐</ToneBadge>
                </div>
                <div className="text-xs text-muted-foreground">F-002 · 证据 A · TÜV 检测报告 TÜV-2026-1188 · 有效至 2028-02-28 · 欧盟</div>
              </div>
              <div className="rounded-lg border p-3">
                <span className="text-lg font-semibold">IP65</span>
                <div className="text-xs text-muted-foreground">F-003 · 证据 B · 产品手册（2024 版）· 有效至 2026-12-31</div>
              </div>
            </div>
            <div className="rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">推荐依据：认证与检测类以检测报告为权威来源，且证据等级 A &gt; B。两条都未指定型号，若 IP65 是旧款取值，可以拆分适用范围。</div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="font-medium">处理这条事实冲突（事实负责人）</div>
              {!canResolve && (
                <Alert>
                  <AlertTriangle />
                  <AlertTitle>当前角色「{ROLE_CONFIG[demo.role].label}」不能处理事实冲突</AlertTitle>
                  <AlertDescription className="flex flex-wrap gap-2">
                    <Button size="xs" onClick={() => dispatch({ type: 'setRole', role: 'fact_owner' })}>
                      切换为事实负责人 · 王拓
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => { setResolveOpen(false); notify('已通知事实负责人王拓处理 CF-018'); }}>
                      通知事实负责人
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <RadioGroup value={resolveAction} onValueChange={(v) => setResolveAction(v as 'adopt_66' | 'adopt_65' | 'split_scope')} className="gap-1.5" disabled={!canResolve}>
                <Label className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value="adopt_66" /> 采纳 IP66（IP65 标为已被替代）
                </Label>
                <Label className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value="adopt_65" /> 采纳 IP65（IP66 标为已被替代）
                </Label>
                <Label className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value="split_scope" /> 拆分适用范围：IP66 用于标准版，IP65 限旧款
                </Label>
              </RadioGroup>
              <Textarea rows={2} disabled={!canResolve} placeholder="处理依据（必填），例如：以 TÜV 2026 报告为准" value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={removeRef}>
                只在本内容中移除该引用
              </Button>
              <Button variant="ghost" onClick={() => navigate('/facts/conflicts', { state: { conflictId: EDITOR_CONFLICT_ID } })}>
                去冲突处理中心
              </Button>
            </div>
            <Button disabled={!canResolve || !resolveNote.trim()} onClick={confirmResolve}>
              确认处理并回写 KDH
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
