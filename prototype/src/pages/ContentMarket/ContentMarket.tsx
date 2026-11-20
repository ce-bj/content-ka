import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BellRing, Copy, Link2, PackageOpen, Plus, Search, Send, Sparkles, Store, Tags } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormDialog, type FormValues } from '@/components/shared/FormDialog';
import { notify } from '@/components/shared/toast';
import { ToneBadge, type Tone } from '@/components/shared/status';
import { nextApprovalId, nowLabel, useDemo } from '@/lib/demo-store';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
// 适用渠道标签：决定一条内容可以被哪些对接方取用
const CHANNEL_CONFIG = {
  kdh: { label: 'KDH 知识库', group: '知识库', tone: 'violet' as Tone },
  website: { label: '官网', group: '自有站点', tone: 'blue' as Tone },
  product_platform: { label: '产品发布平台', group: '自有站点', tone: 'blue' as Tone },
  ai_service: { label: 'AI 客服 / GEO', group: '自有站点', tone: 'teal' as Tone },
  sales: { label: '销售助手', group: '销售', tone: 'amber' as Tone },
  instagram: { label: 'Instagram', group: '社媒', tone: 'red' as Tone },
  facebook: { label: 'Facebook', group: '社媒', tone: 'blue' as Tone },
  linkedin: { label: 'LinkedIn', group: '社媒', tone: 'blue' as Tone },
  wechat: { label: '微信公众号', group: '社媒', tone: 'green' as Tone },
} as const;
type ChannelKey = keyof typeof CHANNEL_CONFIG;
const CHANNEL_KEYS = Object.keys(CHANNEL_CONFIG) as ChannelKey[];
// 取用方式
const MODE_CONFIG = {
  subscribe: { label: '订阅导入', tone: 'violet' as Tone, hint: '内容生效或更新后推送，对方导入为自己的条目（如 KDH）' },
  reference: { label: '按 ID 引用', tone: 'teal' as Tone, hint: '对方只保存内容 ID，展示时实时取最新生效版本（如产品发布平台）' },
  copy: { label: '取用副本', tone: 'amber' as Tone, hint: '按渠道格式导出一份，之后的更新需对方重新取用（如社媒）' },
} as const;
type ConsumeMode = keyof typeof MODE_CONFIG;
// 新上架内容按类型给出默认渠道（送审时的发布设置未指定时使用）
const DEFAULT_TAGS_BY_TYPE: Record<string, ChannelKey[]> = {
  产品说明: ['website', 'product_platform', 'kdh'],
  '技术 FAQ': ['website', 'ai_service', 'kdh'],
  客户案例: ['website', 'linkedin', 'kdh'],
  社媒短帖: ['instagram', 'facebook', 'linkedin'],
  销售话术卡: ['sales'],
};

// 内容集合：把一组内容打包，对接方可以按集合取用（和渠道标签并列的第二种取用范围）
const COLLECTION_KIND_CONFIG = {
  channel_pack: { label: '渠道内容包', tone: 'blue' as Tone },
  topic: { label: '专题集合', tone: 'violet' as Tone },
  smart: { label: '智能集合', tone: 'teal' as Tone },
} as const;
type CollectionKind = keyof typeof COLLECTION_KIND_CONFIG;
// 接入方式（凭证、网关、计量由业务平台基础设施提供）
const ACCESS_CONFIG = {
  api: { label: 'API' },
  mcp: { label: 'MCP · 只读' },
  webhook: { label: 'Webhook 推送' },
} as const;
type AccessVia = keyof typeof ACCESS_CONFIG;

// ── 类型 ──────────────────────────────────────────────────
interface MarketCollection {
  collectionId: string;
  collectionName: string;
  kind: CollectionKind;
  description: string;
  ruleSummary: string | null;
  ownerName: string;
}
interface MarketItem {
  contentId: string;
  title: string;
  contentTypeName: string;
  brandName: string;
  locale: string;
  version: number;
  listedAt: string;
  channelTags: ChannelKey[];
  suggestedTags: { channel: ChannelKey; reason: string }[];
  formats: string[];
  assetCount: number;
  claimCount: number;
  staleClaimCount: number;
  pendingApproval: { channels: ChannelKey[]; taskId: string } | null;
  collectionIds: string[];
}
interface MarketConsumer {
  consumerId: string;
  consumerName: string;
  mode: ConsumeMode;
  channelTags: ChannelKey[];
  collectionIds: string[]; // 按集合取用（与渠道标签取并集）
  accessVia: AccessVia;
  endpoint: string;
  autoSync: boolean;
  claimedCount: number;
  lastClaimAt: string;
}
interface ClaimRecord {
  claimId: string;
  contentId: string;
  contentTitle: string;
  consumerName: string;
  mode: ConsumeMode;
  channel: ChannelKey;
  claimedVersion: number;
  latestVersion: number;
  claimedAt: string;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockMarketItemsData: MarketItem[] = [
  { contentId: 'C-0921', title: 'BL-R600 产品手册摘要（中文）', contentTypeName: '产品说明', brandName: '北岭智造', locale: 'zh-CN', version: 4, listedAt: '11-08', channelTags: ['kdh', 'website', 'product_platform', 'sales'], suggestedTags: [{ channel: 'wechat', reason: '长度 2480 字、有小标题，适合改写为公众号长文' }], formats: ['HTML', 'Markdown', 'JSON'], assetCount: 3, claimCount: 6, staleClaimCount: 0, pendingApproval: null, collectionIds: ['COL-12'] },
  { contentId: 'C-1009', title: '汽车焊装线改造：BL-R600 客户案例', contentTypeName: '客户案例', brandName: '北岭智造', locale: 'en-US', version: 4, listedAt: '11-15', channelTags: ['website', 'linkedin', 'facebook', 'kdh'], suggestedTags: [{ channel: 'instagram', reason: '有 4:5 现场照片 A-2207，可直接做图文' }], formats: ['HTML', 'Markdown', '图文卡片'], assetCount: 4, claimCount: 5, staleClaimCount: 1, pendingApproval: null, collectionIds: ['COL-12'] },
  { contentId: 'C-1004', title: 'HC-RV200 精密减速机产品说明', contentTypeName: '产品说明', brandName: '汉川传动', locale: 'zh-CN', version: 2, listedAt: '11-19', channelTags: ['kdh', 'product_platform', 'website'], suggestedTags: [], formats: ['HTML', 'JSON'], assetCount: 2, claimCount: 3, staleClaimCount: 0, pendingApproval: null, collectionIds: ['COL-12', 'COL-10'] },
  { contentId: 'C-1055', title: 'BL-R600 Technical FAQ', contentTypeName: '技术 FAQ', brandName: '北岭智造', locale: 'en-US', version: 3, listedAt: '11-10', channelTags: ['ai_service', 'kdh', 'website'], suggestedTags: [], formats: ['HTML', 'JSON-LD FAQPage'], assetCount: 0, claimCount: 4, staleClaimCount: 1, pendingApproval: null, collectionIds: ['COL-10'] },
  { contentId: 'C-1063', title: 'BL-R600 焊装车间 · Instagram 图文', contentTypeName: '社媒短帖', brandName: '北岭智造', locale: 'en-US', version: 1, listedAt: '11-19', channelTags: ['instagram'], suggestedTags: [{ channel: 'facebook', reason: '文案 ≤ 500 字，配图可裁 1.91:1' }], formats: ['文案 + 图片包'], assetCount: 2, claimCount: 1, staleClaimCount: 0, pendingApproval: null, collectionIds: [] },
  { contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', contentTypeName: '销售资料', brandName: '北岭智造', locale: 'en-US', version: 2, listedAt: '11-12', channelTags: ['sales'], suggestedTags: [], formats: ['PDF', 'Markdown'], assetCount: 1, claimCount: 2, staleClaimCount: 0, pendingApproval: { channels: ['kdh'], taskId: 'AP-603' }, collectionIds: [] },
];

const mockMarketConsumersData: MarketConsumer[] = [
  { consumerId: 'MC-01', consumerName: 'KDH 企业知识库', mode: 'subscribe', channelTags: ['kdh'], collectionIds: [], accessVia: 'webhook', endpoint: 'market.item.updated → KDH 导入接口', autoSync: true, claimedCount: 128, lastClaimAt: '今天 09:40' },
  { consumerId: 'MC-02', consumerName: '产品发布平台（产品详情页 / 电商）', mode: 'reference', channelTags: ['product_platform'], collectionIds: [], accessVia: 'api', endpoint: 'GET /api/v1/market/items/{id}?format=html', autoSync: true, claimedCount: 64, lastClaimAt: '今天 10:02' },
  { consumerId: 'MC-03', consumerName: '社媒运营（Instagram / Facebook / LinkedIn）', mode: 'copy', channelTags: ['instagram', 'facebook', 'linkedin'], collectionIds: [], accessVia: 'api', endpoint: 'GET /api/v1/market/items/{id}/export?channel=', autoSync: false, claimedCount: 37, lastClaimAt: '昨天 17:30' },
  { consumerId: 'MC-04', consumerName: '欧盟官网（AI 门户）', mode: 'reference', channelTags: ['website'], collectionIds: ['COL-11'], accessVia: 'api', endpoint: 'GET /api/v1/market/items?channel=website', autoSync: true, claimedCount: 210, lastClaimAt: '今天 09:58' },
  { consumerId: 'MC-05', consumerName: 'CRM 销售助手', mode: 'subscribe', channelTags: ['sales'], collectionIds: [], accessVia: 'webhook', endpoint: 'market.item.updated → CRM 资料库', autoSync: true, claimedCount: 22, lastClaimAt: '11-18' },
  { consumerId: 'MC-06', consumerName: 'Nordwerk GmbH 经销商门户', mode: 'reference', channelTags: [], collectionIds: ['COL-12'], accessVia: 'api', endpoint: 'GET /api/v1/market/collections/COL-12/items', autoSync: true, claimedCount: 41, lastClaimAt: '昨天' },
  { consumerId: 'MC-07', consumerName: 'SDR / GEO Agent', mode: 'reference', channelTags: ['ai_service'], collectionIds: ['COL-10'], accessVia: 'mcp', endpoint: 'MCP 工具 market.search / market.get（只读）', autoSync: true, claimedCount: 3120, lastClaimAt: '今天 10:05' },
];

const mockMarketCollectionsData: MarketCollection[] = [
  { collectionId: 'COL-12', collectionName: '经销商季度内容包 · 2026Q4', kind: 'channel_pack', description: '给经销商门户的产品页、FAQ、案例与下载资源', ruleSummary: null, ownerName: '周敏' },
  { collectionId: 'COL-11', collectionName: '汉诺威工业展专题', kind: 'topic', description: '展会落地页、新品发布稿、演示视频', ruleSummary: null, ownerName: '林悦' },
  { collectionId: 'COL-10', collectionName: 'SDR 知识集 · 欧盟', kind: 'smart', description: '自动包含欧盟区域的技术 FAQ 与产品说明', ruleSummary: '区域 = 欧盟 且 类型 ∈ {技术 FAQ, 产品说明} 且 证据 ∈ {A, B}', ownerName: '陈立' },
  { collectionId: 'COL-09', collectionName: '东南亚新品上市包', kind: 'channel_pack', description: '尚未有内容，也未授权对接方', ruleSummary: null, ownerName: '周敏' },
];

// 审批中、通过后才加入集合的内容（送审时的发布设置）
const mockPendingJoinsData: { collectionId: string; contentId: string; title: string; taskId: string }[] = [
  { collectionId: 'COL-11', contentId: 'C-1002', title: 'BL-R600 Product Brief', taskId: 'RV-551' },
  { collectionId: 'COL-12', contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', taskId: 'RV-553' },
  { collectionId: 'COL-10', contentId: 'C-1015', title: 'BL-R600 FAQ: IP rating', taskId: 'RV-554' },
];

const mockClaimRecordsData: ClaimRecord[] = [
  { claimId: 'CL-901', contentId: 'C-0921', contentTitle: 'BL-R600 产品手册摘要（中文）', consumerName: 'KDH 企业知识库', mode: 'subscribe', channel: 'kdh', claimedVersion: 4, latestVersion: 4, claimedAt: '11-12 10:00' },
  { claimId: 'CL-902', contentId: 'C-1009', contentTitle: '汽车焊装线改造：BL-R600 客户案例', consumerName: '社媒运营', mode: 'copy', channel: 'facebook', claimedVersion: 3, latestVersion: 4, claimedAt: '11-02 15:20' },
  { claimId: 'CL-903', contentId: 'C-1004', contentTitle: 'HC-RV200 精密减速机产品说明', consumerName: '产品发布平台', mode: 'reference', channel: 'product_platform', claimedVersion: 2, latestVersion: 2, claimedAt: '11-19 10:02' },
  { claimId: 'CL-904', contentId: 'C-1063', contentTitle: 'BL-R600 焊装车间 · Instagram 图文', consumerName: '社媒运营', mode: 'copy', channel: 'instagram', claimedVersion: 1, latestVersion: 1, claimedAt: '11-19 16:45' },
  { claimId: 'CL-905', contentId: 'C-1055', contentTitle: 'BL-R600 Technical FAQ', consumerName: 'KDH 企业知识库', mode: 'subscribe', channel: 'kdh', claimedVersion: 2, latestVersion: 3, claimedAt: '11-03 09:00' },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取市场内容 [GET] /api/v1/market/items
function handleFetchMarketItems(params: { channel: ChannelKey | 'all'; keyword: string }) {
  console.log('fetch market items', params);
}

// ACTION: 更新适用渠道标签 [PUT] /api/v1/market/items/{id}/channels
function handleUpdateChannelTags(contentId: string, channelTags: ChannelKey[]) {
  console.log('update channel tags', contentId, channelTags);
}

// ACTION: 推送给订阅方 [POST] /api/v1/market/items/{id}/push
function handlePushToConsumer(contentId: string, consumerId: string) {
  console.log('push to consumer', contentId, consumerId);
}

// ACTION: 下架内容 [PATCH] /api/v1/market/items/{id}
function handleUnlistItem(contentId: string) {
  console.log('unlist item', contentId);
}

// ACTION: 获取对接方 [GET] /api/v1/market/consumers
function handleFetchConsumers() {
  console.log('fetch consumers');
}

// ACTION: 新增对接方 [POST] /api/v1/market/consumers
function handleCreateConsumer(form: { consumerName: string; mode: ConsumeMode; channelTags: ChannelKey[]; collectionIds: string[] }) {
  console.log('create consumer', form);
}

// ACTION: 获取内容集合 [GET] /api/v1/market/collections
function handleFetchCollections() {
  console.log('fetch collections');
}

// ACTION: 新建内容集合 [POST] /api/v1/market/collections
function handleCreateCollection(form: { collectionName: string; kind: CollectionKind; description: string }) {
  console.log('create collection', form);
}

// ACTION: 移出集合（立即生效）[DELETE] /api/v1/market/collections/{id}/items/{contentId}
function handleRemoveFromCollection(collectionId: string, contentId: string) {
  console.log('remove from collection', collectionId, contentId);
}

// ACTION: 获取取用记录 [GET] /api/v1/market/claims
function handleFetchClaimRecords(params: { staleOnly: boolean }) {
  console.log('fetch claims', params);
}

// ACTION: 通知对方重新取用 [POST] /api/v1/market/claims/{id}/notify
function handleNotifyReclaim(claimId: string) {
  console.log('notify reclaim', claimId);
}

// ── 主组件 ────────────────────────────────────────────────
export default function ContentMarket() {
  const navigate = useNavigate();
  const { state: demo, dispatch } = useDemo();
  const [channel, setChannel] = useState<ChannelKey | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const [tagOverrides, setTagOverrides] = useState<Record<string, ChannelKey[]>>({});
  const [pendingBy, setPendingBy] = useState<Record<string, { channels: ChannelKey[]; taskId: string }>>({});
  const [unlisted, setUnlisted] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftTags, setDraftTags] = useState<ChannelKey[]>([]);
  const [consumers, setConsumers] = useState(mockMarketConsumersData);
  const [consumerOpen, setConsumerOpen] = useState(false);
  const [claims, setClaims] = useState(mockClaimRecordsData);
  const [notified, setNotified] = useState<string[]>([]);
  const [collections, setCollections] = useState(mockMarketCollectionsData);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [removedJoins, setRemovedJoins] = useState<string[]>([]); // `${collectionId}/${contentId}`
  const [selectedCol, setSelectedCol] = useState('COL-12');
  const colIdsOf = (names: string[]) => collections.filter((c) => names.includes(c.collectionName)).map((c) => c.collectionId);

  // 审核通过（生效）的内容自动上架：演示中 C-1002 与生产环节新送审的内容
  const justListed: MarketItem[] = [];
  if (demo.reviews['RV-551']?.status === 'approved')
    justListed.push({ contentId: 'C-1002', title: 'BL-R600 6-Axis Industrial Robot — Product Brief', contentTypeName: '产品说明', brandName: '北岭智造', locale: 'en-US', version: 3, listedAt: '刚刚', channelTags: DEFAULT_TAGS_BY_TYPE['产品说明'], suggestedTags: [{ channel: 'linkedin', reason: '有数据亮点 ±0.02 mm，适合一稿多用为 LinkedIn 帖' }], formats: ['HTML', 'Markdown', 'JSON'], assetCount: 1, claimCount: 0, staleClaimCount: 0, pendingApproval: null, collectionIds: ['COL-11', 'COL-10'] });
  demo.submitted
    .filter((t) => (t.kind ?? 'content') === 'content' && demo.reviews[t.taskId]?.status === 'approved')
    .forEach((t) => justListed.push({ contentId: t.contentId, title: t.title, contentTypeName: t.contentTypeName, brandName: t.brandName, locale: t.locale, version: t.version, listedAt: '刚刚', channelTags: (t.publish?.channels as ChannelKey[] | undefined) ?? DEFAULT_TAGS_BY_TYPE[t.contentTypeName] ?? ['website'], suggestedTags: [], formats: ['HTML', 'Markdown', 'JSON'], assetCount: 0, claimCount: 0, staleClaimCount: 0, pendingApproval: null, collectionIds: [...(t.publish?.collections ?? []).map((c) => c.collectionId), ...colIdsOf(t.publish?.smartCollections ?? [])] }));

  // 发布设置里选了集合、但审批还没通过的内容：在集合里显示为「待加入」
  const sessionJoins = demo.submitted.flatMap((t) => ((t.kind ?? 'content') === 'content' ? (t.publish?.collections ?? []).map((c) => ({ collectionId: c.collectionId, contentId: t.contentId, title: t.title, taskId: t.taskId })) : []));
  const allJoins = [...sessionJoins, ...mockPendingJoinsData];
  const approvedJoins = allJoins.filter((j) => demo.reviews[j.taskId]?.status === 'approved');
  const pendingJoins = allJoins.filter((j) => !demo.reviews[j.taskId] || demo.reviews[j.taskId].status === 'in_review');

  const items = [...justListed, ...mockMarketItemsData]
    .filter((i) => !unlisted.includes(i.contentId))
    .map((i) => {
      // 新增渠道 = 上架到新渠道，属于发布：审批通过后才生效
      const base = tagOverrides[i.contentId] ?? i.channelTags;
      const pending = pendingBy[i.contentId] ?? i.pendingApproval;
      const st = pending ? demo.reviews[pending.taskId]?.status : undefined;
      const joined = approvedJoins.filter((j) => j.contentId === i.contentId && !i.collectionIds.includes(j.collectionId)).map((j) => j.collectionId);
      const collectionIds = [...i.collectionIds, ...joined].filter((cid) => !removedJoins.includes(`${cid}/${i.contentId}`));
      if (pending && st === 'approved') return { ...i, collectionIds, channelTags: [...base, ...pending.channels.filter((c) => !base.includes(c))], pendingApproval: null };
      return { ...i, collectionIds, channelTags: base, pendingApproval: pending && st !== 'rejected' ? pending : null };
    });
  const shown = items.filter((i) => (channel === 'all' || i.channelTags.includes(channel)) && (!keyword || i.title.toLowerCase().includes(keyword.toLowerCase()) || i.contentId.includes(keyword)));
  const open = items.find((i) => i.contentId === openId) ?? null;
  const consumersFor = (tags: ChannelKey[], colIds: string[] = []) => consumers.filter((c) => c.channelTags.some((t) => tags.includes(t)) || c.collectionIds.some((x) => colIds.includes(x)));
  const colName = (id: string) => collections.find((c) => c.collectionId === id)?.collectionName ?? id;
  const sel = collections.find((c) => c.collectionId === selectedCol) ?? collections[0];
  const selItems = items.filter((i) => i.collectionIds.includes(sel.collectionId));
  const selPending = pendingJoins.filter((j) => j.collectionId === sel.collectionId);
  const selConsumers = consumers.filter((c) => c.collectionIds.includes(sel.collectionId));
  const staleClaims = claims.filter((c) => c.claimedVersion < c.latestVersion);

  const openDetail = (i: MarketItem) => {
    setOpenId(i.contentId);
    setDraftTags(i.channelTags);
  };
  const saveTags = (item: MarketItem) => {
    const added = draftTags.filter((t) => !item.channelTags.includes(t));
    const kept = draftTags.filter((t) => item.channelTags.includes(t));
    handleUpdateChannelTags(item.contentId, draftTags);
    setTagOverrides((p) => ({ ...p, [item.contentId]: kept }));
    if (added.length > 0) {
      const taskId = nextApprovalId(demo);
      const label = (xs: ChannelKey[]) => xs.map((t) => CHANNEL_CONFIG[t].label).join('、') || '无';
      dispatch({
        type: 'submitTask',
        task: {
          taskId, kind: 'market', targetRef: item.contentId, contentId: item.contentId, title: `${item.contentId} 上架到 ${label(added)}`, contentTypeName: '上架与推送', brandName: item.brandName, locale: item.locale, version: item.version,
          submittedBy: '林悦', submittedAt: `今天 ${nowLabel()}`,
          lines: [{ label: '适用渠道', before: label(item.channelTags), after: label([...kept, ...added]) }],
          effect: `上架到 ${label(added)}，对应对接方（${consumersFor(added).map((c) => c.consumerName.split('（')[0]).join('、') || '暂无'}）可以取用`,
          stages: [{ stageName: '品牌审核', approverLabel: '周敏（北岭智造品牌管理员）', rule: '上架到新渠道' }],
        },
        progress: { taskId, stageIndex: 1, status: 'in_review', history: [{ stageName: '提交', actor: '林悦', decision: 'submit', comment: '', at: `今天 ${nowLabel()}` }] },
      });
      setPendingBy((p) => ({ ...p, [item.contentId]: { channels: added, taskId } }));
      notify(`新增渠道「${label(added)}」属于上架发布，已提交审批 ${taskId}，通过后生效`);
    } else {
      notify(`已更新 ${item.contentId} 的适用渠道：${label2(kept)}`);
    }
    setOpenId(null);
  };
  const label2 = (xs: ChannelKey[]) => xs.map((t) => CHANNEL_CONFIG[t].label).join('、') || '无';
  const toggleDraftTag = (k: ChannelKey, on: boolean) => setDraftTags((p) => (on ? [...p, k] : p.filter((x) => x !== k)));

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="内容市场"
        description="已生效内容在这里对外提供。送审时的发布设置决定上架到哪些渠道、放进哪些内容集合，审批通过后自动执行。对接方按「渠道标签」或「内容集合」取用，只拿得到已生效版本：KDH 订阅导入、产品平台按 ID 引用、社媒取用副本、Agent 经 MCP 只读检索。"
        actions={
          <Button variant="outline" onClick={() => navigate('/review')}>
            审批中心 <ArrowRight />
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(MODE_CONFIG) as ConsumeMode[]).map((m) => (
          <Card key={m} size="sm">
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                {m === 'subscribe' ? <BellRing className="size-3.5" /> : m === 'reference' ? <Link2 className="size-3.5" /> : <Copy className="size-3.5" />}
                {MODE_CONFIG[m].label}
              </CardDescription>
              <CardTitle className="text-base">{consumers.filter((c) => c.mode === m).map((c) => c.consumerName.split('（')[0]).join('、')}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{MODE_CONFIG[m].hint}</CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="items" onValueChange={(v) => { if (v === 'consumers') handleFetchConsumers(); if (v === 'collections') handleFetchCollections(); if (v === 'claims') handleFetchClaimRecords({ staleOnly: false }); }}>
        <TabsList>
          <TabsTrigger value="items">
            <Store /> 货架 {items.length}
          </TabsTrigger>
          <TabsTrigger value="collections">内容集合 {collections.length}</TabsTrigger>
          <TabsTrigger value="consumers">对接方与接口 {consumers.length}</TabsTrigger>
          <TabsTrigger value="claims">取用记录{staleClaims.length > 0 && ` · ${staleClaims.length} 条落后`}</TabsTrigger>
        </TabsList>

        {/* 货架 */}
        <TabsContent value="items" className="space-y-3 pt-3">
          {justListed.length > 0 && (
            <Alert>
              <PackageOpen />
              <AlertTitle>刚上架 {justListed.length} 条</AlertTitle>
              <AlertDescription>{justListed.map((i) => `${i.contentId} ${i.title}`).join('；')} 审批通过后已按送审时的发布设置自动上架，渠道可在详情中调整。</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', ...CHANNEL_KEYS] as const).map((k) => {
              const n = k === 'all' ? items.length : items.filter((i) => i.channelTags.includes(k)).length;
              return (
                <Button key={k} size="xs" variant={channel === k ? 'default' : 'outline'} onClick={() => { setChannel(k); handleFetchMarketItems({ channel: k, keyword }); }}>
                  {k === 'all' ? '全部渠道' : CHANNEL_CONFIG[k].label} <span className="tabular-nums opacity-70">{n}</span>
                </Button>
              );
            })}
            <div className="relative ml-auto w-56">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-8" placeholder="标题或编号" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFetchMarketItems({ channel, keyword })} />
            </div>
          </div>
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容</TableHead>
                    <TableHead>适用渠道 · 所在集合</TableHead>
                    <TableHead>可取格式</TableHead>
                    <TableHead>可被谁取用</TableHead>
                    <TableHead className="text-right">取用</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((i) => (
                    <TableRow key={i.contentId} className="cursor-pointer" onClick={() => openDetail(i)}>
                      <TableCell className="max-w-72 whitespace-normal">
                        <div className="font-medium">{i.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {i.contentId} · v{i.version} · {i.contentTypeName} · {i.brandName} · {i.locale} · 上架 {i.listedAt}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-64 whitespace-normal">
                        <div className="flex flex-wrap gap-1">
                          {i.channelTags.map((t) => (
                            <ToneBadge key={t} tone={CHANNEL_CONFIG[t].tone}>
                              {CHANNEL_CONFIG[t].label}
                            </ToneBadge>
                          ))}
                          {i.pendingApproval?.channels.map((t) => (
                            <span key={t} className="inline-flex items-center rounded-md border border-dashed px-1.5 text-xs text-muted-foreground">
                              {CHANNEL_CONFIG[t].label} · 待审批
                            </span>
                          ))}
                          {i.suggestedTags.filter((s) => !i.channelTags.includes(s.channel)).length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-violet-700">
                              <Sparkles className="size-3" /> 建议 +{i.suggestedTags.filter((s) => !i.channelTags.includes(s.channel)).length}
                            </span>
                          )}
                        </div>
                        {i.collectionIds.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {i.collectionIds.map((cid) => (
                              <span key={cid} className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 text-xs text-muted-foreground">
                                <PackageOpen className="size-3" /> {colName(cid)}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.formats.join(' / ')}</TableCell>
                      <TableCell className="max-w-56 text-xs whitespace-normal">
                        {consumersFor(i.channelTags, i.collectionIds).map((c) => (
                          <div key={c.consumerId}>
                            <span className="text-muted-foreground">{MODE_CONFIG[c.mode].label} · </span>
                            {c.consumerName.split('（')[0]}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {i.claimCount}
                        {i.staleClaimCount > 0 && <div className="text-xs text-amber-700">{i.staleClaimCount} 份落后</div>}
                      </TableCell>
                      <TableCell>
                        <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(i); }}>
                          <Tags /> 标签与取用
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {shown.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        这个渠道下还没有内容。可以在内容详情里加渠道标签，或用「一稿多用」改写成该渠道的格式。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 内容集合 */}
        <TabsContent value="collections" className="space-y-3 pt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">集合是货架上的「打包」：一组内容作为一个单元给对接方。加入集合在送审时的发布设置里选，随内容审批一起审；智能集合按规则自动收集。移出立即生效。</p>
            <Button size="sm" onClick={() => setCollectionOpen(true)}>
              <Plus /> 新建集合
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="space-y-2">
              {collections.map((c) => {
                const n = items.filter((i) => i.collectionIds.includes(c.collectionId)).length;
                const pn = pendingJoins.filter((j) => j.collectionId === c.collectionId).length;
                const cs = consumers.filter((x) => x.collectionIds.includes(c.collectionId));
                return (
                  <button key={c.collectionId} onClick={() => setSelectedCol(c.collectionId)} className={cn('w-full rounded-lg border bg-card p-3 text-left hover:border-primary/40', c.collectionId === sel.collectionId && 'border-primary ring-1 ring-primary/30')}>
                    <div className="flex items-center gap-2">
                      <ToneBadge tone={COLLECTION_KIND_CONFIG[c.kind].tone}>{COLLECTION_KIND_CONFIG[c.kind].label}</ToneBadge>
                      <span className="truncate font-medium">{c.collectionName}</span>
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {n} 条已上架{pn > 0 && <span className="text-blue-600"> · {pn} 条审批中</span>} · {cs.length ? `${cs.map((x) => x.consumerName.split('（')[0]).join('、')} 取用` : <span className="text-amber-600">暂无对接方取用</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <Card>
              <CardHeader>
                <CardTitle>{sel.collectionName}</CardTitle>
                <CardDescription>{sel.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {sel.ruleSummary && <div className="rounded-md bg-teal-50 p-2.5 font-mono text-xs text-teal-900 dark:bg-teal-950 dark:text-teal-100">自动收集规则：{sel.ruleSummary}</div>}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">取用这个集合的对接方：</span>
                  {selConsumers.map((c) => (
                    <ToneBadge key={c.consumerId} tone={MODE_CONFIG[c.mode].tone}>
                      {c.consumerName.split('（')[0]} · {ACCESS_CONFIG[c.accessVia].label}
                    </ToneBadge>
                  ))}
                  {selConsumers.length === 0 && <span className="text-xs text-amber-600">暂无，可在「对接方与接口」里给对接方加上本集合</span>}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>内容</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selItems.map((i) => (
                      <TableRow key={i.contentId}>
                        <TableCell>
                          <div className="font-medium">{i.title}</div>
                          <div className="text-xs text-muted-foreground">{i.contentId} · v{i.version} · {i.contentTypeName}</div>
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone="green">已上架</ToneBadge>
                        </TableCell>
                        <TableCell className="text-right">
                          {sel.kind !== 'smart' && (
                            <Button size="xs" variant="ghost" onClick={() => { handleRemoveFromCollection(sel.collectionId, i.contentId); setRemovedJoins((p) => [...p, `${sel.collectionId}/${i.contentId}`]); notify(`已从「${sel.collectionName}」移出 ${i.contentId}，对接方立即取不到`); }}>
                              移出
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {selPending.map((j) => (
                      <TableRow key={`p-${j.contentId}`}>
                        <TableCell>
                          <div className="font-medium">{j.title}</div>
                          <div className="text-xs text-muted-foreground">{j.contentId}</div>
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone="blue">审批中 · 通过后加入</ToneBadge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="xs" variant="ghost" onClick={() => navigate('/review', { state: { taskId: j.taskId } })}>
                            {j.taskId}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {selItems.length + selPending.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                          还没有内容。送审时在发布设置里选择本集合即可加入。
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 对接方与接口 */}
        <TabsContent value="consumers" className="space-y-4 pt-3">
          <Card>
            <CardHeader>
              <CardTitle>对接方</CardTitle>
              <CardDescription>每个对接方声明取用范围（渠道标签和 / 或内容集合）、取用方式和接入方式。越界请求返回 403 并留痕；凭证、网关与计量由业务平台基础设施提供。</CardDescription>
              <CardAction>
                <Button size="sm" onClick={() => setConsumerOpen(true)}>
                  <Plus /> 新增对接方
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>对接方</TableHead>
                    <TableHead>取用方式</TableHead>
                    <TableHead>取用范围</TableHead>
                    <TableHead>接入</TableHead>
                    <TableHead>更新后</TableHead>
                    <TableHead className="text-right">已取用</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumers.map((c) => (
                    <TableRow key={c.consumerId}>
                      <TableCell className="max-w-56 whitespace-normal">
                        <div className="font-medium">{c.consumerName}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.consumerId} · 最近 {c.lastClaimAt}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={MODE_CONFIG[c.mode].tone}>{MODE_CONFIG[c.mode].label}</ToneBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.channelTags.map((t) => (
                            <ToneBadge key={t} tone={CHANNEL_CONFIG[t].tone}>
                              {CHANNEL_CONFIG[t].label}
                            </ToneBadge>
                          ))}
                          {c.collectionIds.map((cid) => (
                            <span key={cid} className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 text-xs text-muted-foreground">
                              <PackageOpen className="size-3" /> {colName(cid)}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-64 text-xs whitespace-normal">
                        <div className="font-medium">{ACCESS_CONFIG[c.accessVia].label}</div>
                        <div className="font-mono text-muted-foreground">{c.endpoint}</div>
                      </TableCell>
                      <TableCell className="text-xs">{c.mode === 'copy' ? '提醒重新取用' : c.mode === 'reference' ? '实时取最新版' : '自动推送新版'}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.claimedCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>市场接口</CardTitle>
              <CardDescription>对接方统一走这组接口；只能拿到已生效版本，且只返回其取用范围（渠道标签 + 集合）内的内容。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5 font-mono text-xs">
              {[
                ['GET', '/api/v1/market/items?channel=instagram', '按渠道列出可取用内容'],
                ['GET', '/api/v1/market/items/{id}?format=html|markdown|json', '按 ID 引用：始终返回最新生效版本'],
                ['GET', '/api/v1/market/items/{id}/export?channel=facebook', '取用副本：按渠道格式导出文案与素材包，登记取用版本'],
                ['GET', '/api/v1/market/collections/{id}/items', '按集合取用：返回集合内全部已生效内容'],
                ['MCP', 'market.search / market.get', 'Agent 只读检索，范围同上'],
                ['WEBHOOK', 'market.item.listed / market.item.updated / market.item.unlisted', '订阅方收到上架、更新、下架通知'],
              ].map(([m, path, desc]) => (
                <div key={path} className="flex flex-wrap items-baseline gap-2 rounded-md border px-3 py-1.5">
                  <ToneBadge tone={m === 'WEBHOOK' ? 'violet' : m === 'MCP' ? 'teal' : 'green'}>{m}</ToneBadge>
                  <span>{path}</span>
                  <span className="font-sans text-muted-foreground">{desc}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 取用记录 */}
        <TabsContent value="claims" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>取用记录</CardTitle>
              <CardDescription>取用副本和订阅导入都会登记版本。内容更新后，落后的副本标黄，可以通知对方重新取用。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容</TableHead>
                    <TableHead>对接方 · 渠道</TableHead>
                    <TableHead>方式</TableHead>
                    <TableHead>取用版本</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((c) => {
                    const stale = c.claimedVersion < c.latestVersion;
                    return (
                      <TableRow key={c.claimId}>
                        <TableCell className="max-w-64 whitespace-normal">
                          <div className="font-medium">{c.contentTitle}</div>
                          <div className="text-xs text-muted-foreground">{c.contentId}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.consumerName}
                          <div>
                            <ToneBadge tone={CHANNEL_CONFIG[c.channel].tone}>{CHANNEL_CONFIG[c.channel].label}</ToneBadge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone={MODE_CONFIG[c.mode].tone}>{MODE_CONFIG[c.mode].label}</ToneBadge>
                        </TableCell>
                        <TableCell className={cn('text-sm tabular-nums', stale && 'text-amber-700')}>
                          v{c.claimedVersion}
                          {stale && ` · 最新 v${c.latestVersion}`}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.claimedAt}</TableCell>
                        <TableCell className="text-right">
                          {stale &&
                            (notified.includes(c.claimId) ? (
                              <span className="text-xs text-muted-foreground">已通知</span>
                            ) : c.mode === 'subscribe' ? (
                              <Button size="xs" variant="outline" onClick={() => { handlePushToConsumer(c.contentId, 'MC-01'); setClaims((p) => p.map((x) => (x.claimId === c.claimId ? { ...x, claimedVersion: x.latestVersion, claimedAt: '刚刚' } : x))); notify(`已把 ${c.contentId} v${c.latestVersion} 推送给 ${c.consumerName}，对方已导入`); }}>
                                <Send /> 重新推送
                              </Button>
                            ) : (
                              <Button size="xs" variant="outline" onClick={() => { handleNotifyReclaim(c.claimId); setNotified((p) => [...p, c.claimId]); notify(`已通知${c.consumerName}：${c.contentId} 已更新到 v${c.latestVersion}，请重新取用`); }}>
                                <BellRing /> 通知重新取用
                              </Button>
                            ))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 内容详情：渠道标签与取用方式 */}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{open.title}</DialogTitle>
                <DialogDescription>
                  {open.contentId} · v{open.version} · {open.contentTypeName} · {open.locale} · 可取格式 {open.formats.join(' / ')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="space-y-2">
                  <Label>适用渠道</Label>
                  <div className="grid gap-1.5 sm:grid-cols-3">
                    {CHANNEL_KEYS.map((k) => {
                      const sug = open.suggestedTags.find((s) => s.channel === k);
                      return (
                        <Label key={k} className={cn('flex items-center gap-2 rounded-md border px-2 py-1.5 font-normal', sug && !draftTags.includes(k) && 'border-violet-300 bg-violet-50 dark:bg-violet-950')}>
                          <Checkbox checked={draftTags.includes(k)} onCheckedChange={(c) => toggleDraftTag(k, !!c)} />
                          {CHANNEL_CONFIG[k].label}
                          {sug && !draftTags.includes(k) && <Sparkles className="ml-auto size-3 text-violet-600" />}
                        </Label>
                      );
                    })}
                  </div>
                  {open.suggestedTags
                    .filter((s) => !draftTags.includes(s.channel))
                    .map((s) => (
                      <div key={s.channel} className="flex items-center gap-2 text-xs text-violet-700">
                        <Sparkles className="size-3" /> 建议加「{CHANNEL_CONFIG[s.channel].label}」：{s.reason}
                        <Button size="xs" variant="ghost" onClick={() => toggleDraftTag(s.channel, true)}>
                          采纳
                        </Button>
                      </div>
                    ))}
                </div>
                <div className="space-y-2">
                  <Label>按当前标签，可被这些对接方取用</Label>
                  {consumersFor(draftTags).map((c) => (
                    <div key={c.consumerId} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
                      <ToneBadge tone={MODE_CONFIG[c.mode].tone}>{MODE_CONFIG[c.mode].label}</ToneBadge>
                      <span className="font-medium">{c.consumerName}</span>
                      <span className="text-xs text-muted-foreground">{c.mode === 'copy' ? `GET /api/v1/market/items/${open.contentId}/export?channel=${c.channelTags.find((t) => draftTags.includes(t))}` : c.mode === 'reference' ? `GET /api/v1/market/items/${open.contentId}` : '更新后自动推送'}</span>
                      {c.mode === 'subscribe' && (
                        <Button size="xs" variant="outline" className="ml-auto" onClick={() => { handlePushToConsumer(open.contentId, c.consumerId); notify(`已推送 ${open.contentId} v${open.version} 给 ${c.consumerName}`); }}>
                          <Send /> 立即推送
                        </Button>
                      )}
                    </div>
                  ))}
                  {consumersFor(draftTags).length === 0 && <div className="text-xs text-muted-foreground">没有对接方取用这些渠道</div>}
                </div>
              </div>
              <DialogFooter className="sm:justify-between">
                <Button variant="ghost" className="text-red-600" onClick={() => { handleUnlistItem(open.contentId); setUnlisted((p) => [...p, open.contentId]); setOpenId(null); notify(`${open.contentId} 已下架，订阅方收到下架通知，按 ID 引用的位置将不再展示`); }}>
                  下架
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate(`/content/edit/${open.contentId}`)}>
                    查看内容
                  </Button>
                  <Button onClick={() => saveTags(open)}>
                    {draftTags.some((t) => !open.channelTags.includes(t)) ? '提交上架审批' : '保存渠道标签'}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <FormDialog
        open={consumerOpen}
        onOpenChange={setConsumerOpen}
        title="新增对接方"
        description="声明对方能取哪些内容（渠道标签和 / 或内容集合）、怎么取。凭证由业务平台统一签发。"
        fields={[
          { key: 'name', label: '对接方名称', kind: 'text', required: true, placeholder: '例如：小红书运营' },
          { key: 'mode', label: '取用方式', kind: 'select', options: (Object.keys(MODE_CONFIG) as ConsumeMode[]).map((m) => ({ value: m, label: `${MODE_CONFIG[m].label} — ${MODE_CONFIG[m].hint}` })) },
          { key: 'tags', label: '取用渠道标签', kind: 'multi', options: CHANNEL_KEYS.map((k) => ({ value: k, label: CHANNEL_CONFIG[k].label })) },
          { key: 'cols', label: '取用内容集合', kind: 'multi', options: collections.map((c) => ({ value: c.collectionId, label: c.collectionName })) },
        ]}
        onSubmit={(v: FormValues) => {
          const form = { consumerName: String(v.name), mode: v.mode as ConsumeMode, channelTags: (v.tags as ChannelKey[]) ?? [], collectionIds: (v.cols as string[]) ?? [] };
          handleCreateConsumer(form);
          const id = `MC-${String(consumers.length + 1).padStart(2, '0')}`;
          setConsumers((p) => [...p, { consumerId: id, ...form, accessVia: form.mode === 'subscribe' ? 'webhook' : 'api', endpoint: form.mode === 'subscribe' ? 'Webhook（待配置）' : form.channelTags[0] ? `GET /api/v1/market/items?channel=${form.channelTags[0]}` : `GET /api/v1/market/collections/${form.collectionIds[0] ?? '{id}'}/items`, autoSync: form.mode !== 'copy', claimedCount: 0, lastClaimAt: '—' }]);
          notify(`已新增对接方 ${id}，取用范围内的已生效内容即可取用`);
        }}
      />
      <FormDialog
        open={collectionOpen}
        onOpenChange={setCollectionOpen}
        title="新建内容集合"
        description="建好后，送审时的发布设置里就能选它；再给对接方加上本集合即可按集合取用。"
        fields={[
          { key: 'name', label: '名称', kind: 'text', required: true, placeholder: '例如：经销商季度内容包' },
          { key: 'kind', label: '类型', kind: 'select', options: (Object.keys(COLLECTION_KIND_CONFIG) as CollectionKind[]).map((k) => ({ value: k, label: COLLECTION_KIND_CONFIG[k].label })) },
          { key: 'desc', label: '说明', kind: 'text' },
        ]}
        onSubmit={(v: FormValues) => {
          const form = { collectionName: String(v.name), kind: (v.kind as CollectionKind) || 'channel_pack', description: String(v.desc ?? '') };
          handleCreateCollection(form);
          const id = `COL-${13 + collections.length - mockMarketCollectionsData.length}`;
          setCollections((p) => [{ collectionId: id, ...form, description: form.description || '—', ruleSummary: null, ownerName: '我' }, ...p]);
          setSelectedCol(id);
          notify(`已创建集合 ${id}`);
        }}
      />
    </div>
  );
}
