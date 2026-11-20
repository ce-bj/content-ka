import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, ArrowDownToLine, Info, Plus, RefreshCw, Settings2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDemo } from '@/lib/demo-store';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormDialog, type FormValues } from '@/components/shared/FormDialog';
import { notify } from '@/components/shared/toast';
import { ToneBadge, type Tone } from '@/components/shared/status';

// ── 配置常量 ──────────────────────────────────────────────
const CONNECTOR_STATUS_CONFIG = {
  connected: { label: '正常', tone: 'green' as Tone },
  degraded: { label: '部分异常', tone: 'amber' as Tone },
  auth_expired: { label: '鉴权过期', tone: 'red' as Tone },
  disconnected: { label: '未连接', tone: 'gray' as Tone },
} as const;
type ConnectorStatus = keyof typeof CONNECTOR_STATUS_CONFIG;
const ISSUE_KIND_CONFIG = {
  auth_expired: { label: '鉴权过期', tone: 'red' as Tone },
  mapping_error: { label: '字段映射错误', tone: 'amber' as Tone },
  fetch_failed: { label: '拉取失败', tone: 'red' as Tone },
  both_modified: { label: '双方都改了', tone: 'violet' as Tone },
} as const;
type IssueKind = keyof typeof ISSUE_KIND_CONFIG;
const DIRECTION_OPTIONS = [
  { value: 'two_way', label: '双向（版本比较）' },
  { value: 'kdh_wins', label: '以知识库为准' },
  { value: 'cms_wins', label: '以中台为准' },
  { value: 'fill_if_empty', label: '对方为空才写入' },
];
type SyncDirection = 'two_way' | 'kdh_wins' | 'cms_wins' | 'fill_if_empty';
// 接入方式：两种都支持，按连接器 × 对象类型配置
const INGEST_MODE_CONFIG = {
  full: { label: '全量导入', tone: 'blue' as Tone, hint: '按范围定时同步，先入库再使用；同步时就和已有事实比对' },
  on_use: { label: '用到才存', tone: 'teal' as Tone, hint: '不预先拉取；生产时检索源系统，被引用时才入库，入库前比对冲突' },
  link_only: { label: '仅链接', tone: 'gray' as Tone, hint: '不存文件，只存链接、元数据和缩略图；源删除后链接失效' },
} as const;
type IngestMode = keyof typeof INGEST_MODE_CONFIG;
const SOURCE_STATE_CONFIG = {
  ok: { label: '正常', tone: 'green' as Tone },
  source_updated: { label: '源已更新', tone: 'blue' as Tone },
  source_gone: { label: '源已失效', tone: 'red' as Tone },
  conflict: { label: '使用中发现冲突', tone: 'red' as Tone },
} as const;
type SourceState = keyof typeof SOURCE_STATE_CONFIG;

// ── 类型 ──────────────────────────────────────────────────
interface Connector {
  connectorId: string;
  connectorName: string;
  systemKind: '知识库' | 'DAM' | '网盘' | '协同办公' | 'PIM' | '网站';
  objectLabel: string;
  direction: 'bidirectional' | 'pull';
  ingestPlans: IngestPlan[];
  schedule: string;
  status: ConnectorStatus;
  lastSyncAt: string;
  itemsSynced: number;
  openIssues: number;
}
interface IngestPlan {
  planId: string;
  objectKind: string;
  mode: IngestMode;
  allowedModes: IngestMode[];
  scope: string;
  storeAt: string;
}
interface ExternalRef {
  refId: string;
  externalName: string;
  externalId: string;
  sourceSystem: string;
  mode: IngestMode | 'snapshot';
  storedAt: string;
  storedAtLabel: string;
  referencedBy: string[];
  sourceState: SourceState;
  stateNote: string | null;
}
interface SyncJob {
  jobId: string;
  connectorName: string;
  objectLabel: string;
  mode: 'incremental' | 'full';
  startedAt: string;
  durationLabel: string;
  createdCount: number;
  updatedCount: number;
  conflictCount: number;
  failedCount: number;
  status: 'success' | 'partial' | 'failed' | 'running';
}
interface SyncIssue {
  issueId: string;
  connectorName: string;
  issueKind: IssueKind;
  objectRef: string;
  message: string;
  occurredAt: string;
}
interface SyncRule {
  category: string;
  exampleAttributes: string;
  direction: SyncDirection;
  authoritySource: string;
  redLine: boolean;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockConnectorsData: Connector[] = [
  { connectorId: 'kdh', connectorName: '企业知识库 KDH', systemKind: '知识库', objectLabel: '事实（含 PIM / ERP 来源）· 知识检索', direction: 'bidirectional', ingestPlans: [{ planId: 'kdh-fact', objectKind: '事实 · 在售产品', mode: 'full', allowedModes: ['full', 'on_use'], scope: 'BL-R600、BL-D120、HC-RV200、HC-SD75 的授权事实', storeAt: '事实库' }, { planId: 'kdh-fact-other', objectKind: '事实 · 其他产品线', mode: 'on_use', allowedModes: ['full', 'on_use'], scope: '生产时检索 KDH，被引用才入库', storeAt: '事实库' }, { planId: 'kdh-passage', objectKind: '知识片段', mode: 'on_use', allowedModes: ['on_use'], scope: '全部可检索文档；被引用时保存原文快照', storeAt: '内容版本（引用快照）' }], schedule: '实时事件 + 每小时校对', status: 'connected', lastSyncAt: '09:40', itemsSynced: 1286, openIssues: 1 },
  { connectorId: 'musedam', connectorName: '特赞 MuseDAM', systemKind: 'DAM', objectLabel: '资产', direction: 'pull', ingestPlans: [{ planId: 'md-asset', objectKind: '资产', mode: 'on_use', allowedModes: ['full', 'on_use', 'link_only'], scope: '全库可检索，选用时导入副本', storeAt: '资产库' }], schedule: '变更通知', status: 'connected', lastSyncAt: '09:12', itemsSynced: 1406, openIssues: 0 },
  { connectorId: 'feishu', connectorName: '飞书云空间', systemKind: '协同办公', objectLabel: '资产 · 外部内容', direction: 'pull', ingestPlans: [{ planId: 'fs-asset', objectKind: '资产 · 素材文件（图片 / 视频 / PDF）', mode: 'full', allowedModes: ['full', 'on_use', 'link_only'], scope: '/市场部/产品素材 文件夹：原样给出去的文件', storeAt: '资产库' }, { planId: 'fs-doc', objectKind: '外部内容 · 文档正文', mode: 'on_use', allowedModes: ['full', 'on_use', 'link_only'], scope: '/市场部/定稿 文件夹：读正文作引用，用到时导入', storeAt: '外部内容' }], schedule: '每 30 分钟', status: 'auth_expired', lastSyncAt: '06:10', itemsSynced: 512, openIssues: 3 },
  { connectorId: 'sharepoint', connectorName: 'SharePoint（欧洲子公司）', systemKind: '网盘', objectLabel: '资产 · 外部内容', direction: 'pull', ingestPlans: [{ planId: 'sp-asset', objectKind: '资产 · 素材文件', mode: 'link_only', allowedModes: ['on_use', 'link_only'], scope: '培训手册、规格书 PDF 等（客户要求文件不出库）', storeAt: '资产库（引用记录）' }, { planId: 'sp-doc', objectKind: '外部内容 · 页面正文', mode: 'link_only', allowedModes: ['on_use', 'link_only'], scope: '渠道政策页面：只读正文作引用', storeAt: '外部内容（仅链接）' }], schedule: '每小时', status: 'degraded', lastSyncAt: '08:00', itemsSynced: 164, openIssues: 1 },
  { connectorId: 'pimcore', connectorName: 'Pimcore PIM', systemKind: 'PIM', objectLabel: '产品图（规格事实经 KDH）', direction: 'pull', ingestPlans: [{ planId: 'pim-image', objectKind: '产品图', mode: 'full', allowedModes: ['full', 'on_use'], scope: '在售产品主图与场景图', storeAt: '资产库' }, { planId: 'pim-desc', objectKind: '外部内容 · 产品描述', mode: 'full', allowedModes: ['full', 'on_use'], scope: '在售产品长描述', storeAt: '外部内容' }], schedule: '每日 23:00', status: 'connected', lastSyncAt: '昨天 23:05', itemsSynced: 96, openIssues: 0 },
  { connectorId: 'website', connectorName: '现有官网（反向代理）', systemKind: '网站', objectLabel: '内容 · 网页', direction: 'pull', ingestPlans: [{ planId: 'web-page', objectKind: '外部内容 · 网页', mode: 'full', allowedModes: ['full', 'on_use', 'link_only'], scope: 'beiling.example / hanchuan.example 全站页面', storeAt: '外部内容' }], schedule: '每天 06:00', status: 'connected', lastSyncAt: '06:00', itemsSynced: 1240, openIssues: 1 },
];

const mockExternalRefsData: ExternalRef[] = [
  { refId: 'ER-01', externalName: '重复定位精度 ±0.02 mm', externalId: 'KDH-F-7731', sourceSystem: 'KDH', mode: 'full', storedAt: '/facts', storedAtLabel: '事实库 F-001', referencedBy: ['C-1002', 'C-1003', 'C-0921'], sourceState: 'ok', stateNote: null },
  { refId: 'ER-02', externalName: 'HC-RV200 背隙 ≤ 1 arcmin', externalId: 'KDH-F-8705', sourceSystem: 'KDH', mode: 'on_use', storedAt: '/facts', storedAtLabel: '事实库 F-038（11-14 被 C-1004 引用时入库）', referencedBy: ['C-1004'], sourceState: 'ok', stateNote: null },
  { refId: 'ER-03', externalName: '汽车焊装线改造案例（2025）', externalId: 'KP-301', sourceSystem: 'KDH', mode: 'snapshot', storedAt: '/content/edit/C-1002', storedAtLabel: 'C-1002 v3、C-1009 v4 的引用快照', referencedBy: ['C-1002', 'C-1009'], sourceState: 'source_updated', stateNote: 'KDH 原文 11-17 修订，快照不变；需要时可在内容中更新引用' },
  { refId: 'ER-04', externalName: '欧盟买家高频问题 · 机器人类', externalId: 'KP-117', sourceSystem: 'KDH', mode: 'snapshot', storedAt: '/content/edit/C-1002', storedAtLabel: 'C-1002 v3 的引用快照', referencedBy: ['C-1002'], sourceState: 'ok', stateNote: null },
  { refId: 'ER-05', externalName: '汉诺威展焊装线实拍.jpg', externalId: 'MD-55821', sourceSystem: '特赞 MuseDAM', mode: 'on_use', storedAt: '/assets', storedAtLabel: '资产库 A-2207（选用时导入副本）', referencedBy: ['C-1002', 'C-1009'], sourceState: 'ok', stateNote: null },
  { refId: 'ER-06', externalName: 'BL-D120 欧洲宣传册.pdf', externalId: 'SP:/eu/brochure-d120.pdf', sourceSystem: 'SharePoint', mode: 'link_only', storedAt: '/assets', storedAtLabel: '资产库 A-2050（仅链接）', referencedBy: ['C-1006'], sourceState: 'source_gone', stateNote: '源文件 404，本地无副本，引用它的内容发布检查会报错' },
  { refId: 'ER-07', externalName: 'BL-R600 白底产品图', externalId: 'PIM-IMG-3310', sourceSystem: 'Pimcore PIM', mode: 'full', storedAt: '/assets', storedAtLabel: '资产库 A-2190', referencedBy: ['C-0921', 'C-1012'], sourceState: 'ok', stateNote: null },
];

const mockSyncJobsData: SyncJob[] = [
  { jobId: 'SYNC-2431', connectorName: '企业知识库 KDH', objectLabel: '事实', mode: 'incremental', startedAt: '07:40', durationLabel: '12s', createdCount: 0, updatedCount: 3, conflictCount: 1, failedCount: 0, status: 'partial' },
  { jobId: 'SYNC-2430', connectorName: '特赞 MuseDAM', objectLabel: '资产', mode: 'incremental', startedAt: '07:12', durationLabel: '48s', createdCount: 6, updatedCount: 2, conflictCount: 0, failedCount: 0, status: 'success' },
  { jobId: 'SYNC-2429', connectorName: '飞书云空间', objectLabel: '资产', mode: 'incremental', startedAt: '06:40', durationLabel: '2s', createdCount: 0, updatedCount: 0, conflictCount: 0, failedCount: 3, status: 'failed' },
  { jobId: 'SYNC-2428', connectorName: '企业知识库 KDH', objectLabel: '事实（ERP 来源）', mode: 'incremental', startedAt: '06:00', durationLabel: '9s', createdCount: 0, updatedCount: 2, conflictCount: 0, failedCount: 0, status: 'success' },
  { jobId: 'SYNC-2427', connectorName: 'Pimcore PIM', objectLabel: '产品图', mode: 'full', startedAt: '昨天 23:00', durationLabel: '5m 12s', createdCount: 4, updatedCount: 31, conflictCount: 0, failedCount: 0, status: 'success' },
];

const mockSyncIssuesData: SyncIssue[] = [
  { issueId: 'SI-88', connectorName: '飞书云空间', issueKind: 'auth_expired', objectRef: '3 个资产', message: 'OAuth 令牌已过期，需管理员重新授权', occurredAt: '06:40' },
  { issueId: 'SI-87', connectorName: '企业知识库 KDH', issueKind: 'both_modified', objectRef: 'F-007 标准交付周期', message: '中台改为 8 周，知识库改为 12 周 → 生成冲突 CF-021；08:30 已采纳 12 周并回写知识库', occurredAt: '07:40' },
  { issueId: 'SI-86', connectorName: 'SharePoint（欧洲子公司）', issueKind: 'fetch_failed', objectRef: 'A-2050', message: '源文件已删除（404），本地仅引用，无副本', occurredAt: '08:00' },
  { issueId: 'SI-85', connectorName: 'Pimcore PIM', issueKind: 'mapping_error', objectRef: 'image.alt_de', message: '源字段无对应的内容侧字段，已跳过 12 张图片的德语 alt', occurredAt: '昨天 23:05' },
];

const mockSyncRulesData: SyncRule[] = [
  { category: '认证与检测', exampleAttributes: '防护等级、CE、UL、检测报告编号', direction: 'kdh_wins', authoritySource: '证书 / 检测报告', redLine: false },
  { category: '规格参数', exampleAttributes: '负载、精度、半径、扭矩', direction: 'two_way', authoritySource: 'PIM', redLine: false },
  { category: '交付与产能', exampleAttributes: '交付周期、产能', direction: 'kdh_wins', authoritySource: 'ERP', redLine: true },
  { category: '价格与商务', exampleAttributes: '指导价、折扣、付款条件', direction: 'kdh_wins', authoritySource: 'CRM / 报价系统', redLine: true },
  { category: '营销表述', exampleAttributes: '核心卖点、官方表述、口号', direction: 'cms_wins', authoritySource: '中台（品牌管理员）', redLine: false },
  { category: '案例要点', exampleAttributes: '客户名、效果数据', direction: 'fill_if_empty', authoritySource: '知识库案例库', redLine: false },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取连接器列表 [GET] /api/v1/connectors
function handleFetchConnectors(params: { objectKind: string }) {
  console.log('fetch connectors', params);
}

// ACTION: 立即同步 [POST] /api/v1/connectors/{id}/sync
function handleRunSync(connectorId: string, mode: 'incremental' | 'full') {
  alert(`已触发${mode === 'full' ? '全量' : '增量'}同步`);
}

// ACTION: 重新授权连接器 [POST] /api/v1/connectors/{id}/reauthorize
function handleReauthorizeConnector(connectorId: string) {
  alert('跳转到源系统 OAuth 授权页；授权成功后自动重试失败的同步任务');
}

// ACTION: 新建连接器 [POST] /api/v1/connectors
function handleCreateConnector() {
  console.log('create connector');
}

// ACTION: 获取同步任务 [GET] /api/v1/sync-jobs
function handleFetchSyncJobs(params: { connectorId: string; status: string }) {
  console.log('fetch jobs', params);
}

// ACTION: 重试同步异常 [POST] /api/v1/sync-issues/{id}/retry
function handleRetrySyncIssue(issueId: string) {
  alert('已重试');
}

// ACTION: 更新事实同步规则 [PUT] /api/v1/sync-rules/{category}
function handleUpdateSyncRule(category: string, direction: SyncDirection) {
  console.log('update rule', category, direction);
}

// ACTION: 更新接入方式 [PUT] /api/v1/connectors/{id}/ingest-plans
function handleUpdateIngestPlans(connectorId: string, plans: IngestPlan[]) {
  console.log('update ingest plans', connectorId, plans);
}

// ACTION: 获取外部引用台账 [GET] /api/v1/external-refs
function handleFetchExternalRefs(params: { mode: string; sourceState: string }) {
  console.log('fetch external refs', params);
}

// ── 主组件 ────────────────────────────────────────────────
export default function IntegrationCenter() {
  const [connectors, setConnectors] = useState(mockConnectorsData);
  const [connOpen, setConnOpen] = useState(false);
  const navigate = useNavigate();
  const [rules, setRules] = useState(mockSyncRulesData);
  const { state: demo } = useDemo();
  const [cfgId, setCfgId] = useState<string | null>(null);
  const [cfgPlans, setCfgPlans] = useState<IngestPlan[]>([]);
  const cfgConnector = connectors.find((c) => c.connectorId === cfgId) ?? null;
  // 台账 = 已有记录 + 本次演示里生产引用的外部内容 + 使用中发现的冲突
  const sessionRefs: ExternalRef[] = [
    ...demo.created.flatMap((c) =>
      c.source.refs
        .filter((r) => r.refKind === 'kdh' || r.refId.startsWith('KDH-F'))
        .map((r) => ({ refId: `S-${c.contentId}-${r.refId}`, externalName: r.label.replace(/（KDH，引用时入库）$/, ''), externalId: r.refId, sourceSystem: 'KDH', mode: r.refId.startsWith('KDH-F') ? ('on_use' as const) : ('snapshot' as const), storedAt: r.refId.startsWith('KDH-F') ? '/facts' : `/content/edit/${c.contentId}`, storedAtLabel: r.refId.startsWith('KDH-F') ? `事实库（${c.contentId} 引用时入库）` : `${c.contentId} v1 的引用快照`, referencedBy: [c.contentId], sourceState: 'ok' as const, stateNote: '刚刚由 AI 生成引用' })),
    ),
    ...demo.discovered.map((d) => ({ refId: `D-${d.conflictId}`, externalName: `${d.attributeName} ${d.externalValue}`, externalId: d.externalId, sourceSystem: 'KDH', mode: 'on_use' as const, storedAt: '/facts/conflicts', storedAtLabel: `未入库，冲突 ${d.conflictId} 处理后决定`, referencedBy: [], sourceState: 'conflict' as const, stateNote: `与事实库 ${d.localFactId}「${d.localValue}」不一致；${d.discoveredIn}时发现` })),
  ];
  const externalRefs = [...sessionRefs, ...mockExternalRefsData];

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="上游接入"
        description="对接上游平台（KDH、DAM、网盘、协同办公、PIM、现有官网），CMS 不做知识治理，也不把其他平台的东西整个搬过来。每个连接器按对象类型选择接入方式：全量导入、用到才存或仅链接。进中台的落点按用途分：数值进事实库；要读正文作引用的进外部内容；要原样给出去的文件进资产库；知识片段只存为内容版本里的引用快照。外部引用台账记录每一条存在哪、被谁用。"
        actions={
          <Button onClick={() => setConnOpen(true)}>
            <Plus /> 新建连接器
          </Button>
        }
      />

      <Tabs defaultValue="connectors" onValueChange={(v) => { if (v === 'jobs') handleFetchSyncJobs({ connectorId: 'all', status: 'all' }); if (v === 'refs') handleFetchExternalRefs({ mode: 'all', sourceState: 'all' }); }}>
        <TabsList>
          <TabsTrigger value="connectors">连接器 {connectors.length}</TabsTrigger>
          <TabsTrigger value="refs">外部引用台账 {externalRefs.length}</TabsTrigger>
          <TabsTrigger value="jobs">同步任务</TabsTrigger>
          <TabsTrigger value="issues">同步异常 {mockSyncIssuesData.length}</TabsTrigger>
          <TabsTrigger value="rules">事实同步规则</TabsTrigger>
        </TabsList>

        <TabsContent value="connectors" className="space-y-4 pt-3">
          <Alert>
            <Info />
            <AlertTitle>两种接入方式，冲突在不同时机发现</AlertTitle>
            <AlertDescription>
              <div><span className="font-medium text-foreground">全量导入</span>：按范围定时同步，先入库再使用。同步时就和事实库比对，冲突在同步时发现。</div>
              <div><span className="font-medium text-foreground">用到才存</span>：不预先拉取，KDH 里冲不冲突事先不知道。生产时检索源系统，被引用的那一刻才与事实库比对：一致就入库；不一致就在使用中提示并记入冲突处理，作者选一个取值继续生成，由内容审批确认。</div>
            </AlertDescription>
          </Alert>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {connectors.map((c) => (
              <Card key={c.connectorId} size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {c.connectorName}
                  </CardTitle>
                  <CardDescription>
                    {c.systemKind} · {c.objectLabel}
                  </CardDescription>
                  <CardAction>
                    <ToneBadge tone={CONNECTOR_STATUS_CONFIG[c.status].tone}>{CONNECTOR_STATUS_CONFIG[c.status].label}</ToneBadge>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {c.direction === 'bidirectional' ? <ArrowLeftRight className="size-3.5 text-blue-600" /> : <ArrowDownToLine className="size-3.5" />}
                    {c.direction === 'bidirectional' ? '双向（事实可回写）' : '只拉取'}
                  </div>
                  {c.ingestPlans.map((pl) => (
                    <div key={pl.planId} className="rounded-md border px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pl.objectKind}</span>
                        <ToneBadge tone={INGEST_MODE_CONFIG[pl.mode].tone} className="ml-auto">
                          {INGEST_MODE_CONFIG[pl.mode].label}
                        </ToneBadge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pl.scope} → 存入{pl.storeAt}
                      </div>
                    </div>
                  ))}
                  <div className="text-muted-foreground">计划：{c.schedule}</div>
                  <div className="text-muted-foreground">
                    已同步 {c.itemsSynced.toLocaleString()} · 最近 {c.lastSyncAt}
                    {c.openIssues > 0 && <span className="text-red-600"> · 异常 {c.openIssues}</span>}
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  {c.status === 'auth_expired' ? (
                    <Button size="sm" onClick={() => handleReauthorizeConnector(c.connectorId)}>
                      重新授权
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleRunSync(c.connectorId, 'incremental')}>
                      <RefreshCw /> 立即同步
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { handleFetchConnectors({ objectKind: 'all' }); setCfgId(c.connectorId); setCfgPlans(c.ingestPlans); }}>
                    <Settings2 /> 接入方式
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="refs" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>外部引用台账</CardTitle>
              <CardDescription>从其他平台进入中台的每一条内容：怎么进来的、存在中台哪里、被哪些内容引用、源那边现在怎样。知识片段只存被引用的那一段原文快照，不整篇入库。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>外部对象</TableHead>
                    <TableHead>接入方式</TableHead>
                    <TableHead>存在中台哪里</TableHead>
                    <TableHead>被引用</TableHead>
                    <TableHead>源状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {externalRefs.map((r) => (
                    <TableRow key={r.refId}>
                      <TableCell className="max-w-64 whitespace-normal">
                        <div className="font-medium">{r.externalName}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.sourceSystem} · {r.externalId}
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.mode === 'snapshot' ? <ToneBadge tone="violet">引用快照</ToneBadge> : <ToneBadge tone={INGEST_MODE_CONFIG[r.mode].tone}>{INGEST_MODE_CONFIG[r.mode].label}</ToneBadge>}
                      </TableCell>
                      <TableCell className="max-w-60 whitespace-normal">
                        <button className="text-left text-sm text-primary hover:underline" onClick={() => navigate(r.storedAt)}>
                          {r.storedAtLabel}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs">{r.referencedBy.join('、') || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="max-w-64 whitespace-normal">
                        <ToneBadge tone={SOURCE_STATE_CONFIG[r.sourceState].tone}>{SOURCE_STATE_CONFIG[r.sourceState].label}</ToneBadge>
                        {r.stateNote && <div className="mt-0.5 text-xs text-muted-foreground">{r.stateNote}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="pt-3">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>批次</TableHead>
                    <TableHead>连接器 / 对象</TableHead>
                    <TableHead>方式</TableHead>
                    <TableHead className="text-right">新增</TableHead>
                    <TableHead className="text-right">更新</TableHead>
                    <TableHead className="text-right">冲突</TableHead>
                    <TableHead className="text-right">失败</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>开始 · 耗时</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockSyncJobsData.map((j) => (
                    <TableRow key={j.jobId}>
                      <TableCell className="font-mono text-xs">{j.jobId}</TableCell>
                      <TableCell>
                        {j.connectorName}
                        <div className="text-xs text-muted-foreground">{j.objectLabel}</div>
                      </TableCell>
                      <TableCell>{j.mode === 'full' ? '全量' : '增量'}</TableCell>
                      <TableCell className="text-right tabular-nums">{j.createdCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{j.updatedCount}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {j.conflictCount > 0 ? (
                          <button className="text-red-600 underline" onClick={() => navigate('/facts/conflicts')}>
                            {j.conflictCount}
                          </button>
                        ) : (
                          0
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{j.failedCount}</TableCell>
                      <TableCell>
                        <ToneBadge tone={j.status === 'success' ? 'green' : j.status === 'partial' ? 'amber' : j.status === 'running' ? 'blue' : 'red'}>
                          {j.status === 'success' ? '成功' : j.status === 'partial' ? '部分成功' : j.status === 'running' ? '进行中' : '失败'}
                        </ToneBadge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {j.startedAt} · {j.durationLabel}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="pt-3">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类型</TableHead>
                    <TableHead>连接器</TableHead>
                    <TableHead>对象</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockSyncIssuesData.map((i) => (
                    <TableRow key={i.issueId}>
                      <TableCell>
                        <ToneBadge tone={ISSUE_KIND_CONFIG[i.issueKind].tone}>{ISSUE_KIND_CONFIG[i.issueKind].label}</ToneBadge>
                      </TableCell>
                      <TableCell>{i.connectorName}</TableCell>
                      <TableCell className="text-sm">{i.objectRef}</TableCell>
                      <TableCell className="max-w-96 text-sm whitespace-normal">{i.message}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.occurredAt}</TableCell>
                      <TableCell className="text-right">
                        {i.issueKind === 'both_modified' ? (
                          <Button size="xs" variant="outline" onClick={() => navigate('/facts/conflicts')}>
                            查看冲突
                          </Button>
                        ) : (
                          <Button size="xs" variant="outline" onClick={() => handleRetrySyncIssue(i.issueId)}>
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

        <TabsContent value="rules" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>事实同步规则</CardTitle>
              <CardDescription>
                中台和知识库都能修改事实。按属性类别设置同步方向：只有一方改动时自动同步；双方都改了，进入冲突处理。红线类别的变更始终需要人工确认。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>属性类别</TableHead>
                    <TableHead>示例属性</TableHead>
                    <TableHead>权威来源</TableHead>
                    <TableHead>同步方向</TableHead>
                    <TableHead>红线</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.category}>
                      <TableCell className="font-medium">{r.category}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.exampleAttributes}</TableCell>
                      <TableCell className="text-sm">{r.authoritySource}</TableCell>
                      <TableCell>
                        <Select
                          items={DIRECTION_OPTIONS}
                          value={r.direction}
                          onValueChange={(v) => {
                            setRules((prev) => prev.map((x) => (x.category === r.category ? { ...x, direction: v as SyncDirection } : x)));
                            handleUpdateSyncRule(r.category, v as SyncDirection);
                          }}
                        >
                          <SelectTrigger size="sm" className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DIRECTION_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{r.redLine ? <ToneBadge tone="red">人工确认</ToneBadge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={!!cfgConnector} onOpenChange={(v) => !v && setCfgId(null)}>
        <DialogContent className="sm:max-w-xl">
          {cfgConnector && (
            <>
              <DialogHeader>
                <DialogTitle>接入方式 · {cfgConnector.connectorName}</DialogTitle>
                <DialogDescription>按对象类型选择全量导入或用到才存；改为用到才存后，已入库但从未被引用的数据会在下次同步时清理。</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {cfgPlans.map((pl) => (
                  <div key={pl.planId} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{pl.objectKind}</span>
                      <span className="text-xs text-muted-foreground">存入{pl.storeAt}</span>
                    </div>
                    <Select
                      items={pl.allowedModes.map((m) => ({ value: m, label: INGEST_MODE_CONFIG[m].label }))}
                      value={pl.mode}
                      onValueChange={(v) => setCfgPlans((p) => p.map((x) => (x.planId === pl.planId ? { ...x, mode: v as IngestMode } : x)))}
                    >
                      <SelectTrigger className="w-full" disabled={pl.allowedModes.length === 1}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pl.allowedModes.map((m) => (
                          <SelectItem key={m} value={m}>
                            {INGEST_MODE_CONFIG[m].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">{INGEST_MODE_CONFIG[pl.mode].hint}</div>
                    {pl.allowedModes.length === 1 && <div className="text-xs text-amber-700">知识治理在 KDH，知识片段不做全量导入，只在被引用时保存原文快照。</div>}
                    <Input value={pl.scope} onChange={(e) => setCfgPlans((p) => p.map((x) => (x.planId === pl.planId ? { ...x, scope: e.target.value } : x)))} placeholder="范围，例如某几个产品线或文件夹" />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCfgId(null)}>
                  取消
                </Button>
                <Button
                  onClick={() => {
                    handleUpdateIngestPlans(cfgConnector.connectorId, cfgPlans);
                    setConnectors((p) => p.map((c) => (c.connectorId === cfgConnector.connectorId ? { ...c, ingestPlans: cfgPlans } : c)));
                    setCfgId(null);
                    notify(`已保存「${cfgConnector.connectorName}」的接入方式：${cfgPlans.map((x) => `${x.objectKind} ${INGEST_MODE_CONFIG[x.mode].label}`).join('；')}`);
                  }}
                >
                  保存
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <FormDialog
        open={connOpen}
        onOpenChange={setConnOpen}
        title="新建连接器"
        description="对接上游的资产源。规格、交期等事实统一经 KDH 进入，不在这里直连 ERP。"
        fields={[
          { key: 'kind', label: '类型', kind: 'select', options: [{ value: 'DAM', label: 'DAM（特赞 / Bynder / Cloudinary…）' }, { value: '网盘', label: '网盘（SharePoint / OneDrive / Google Drive）' }, { value: '协同办公', label: '协同办公（飞书 / 钉钉 / 企业微信）' }, { value: 'PIM', label: 'PIM（只拉产品图）' }] },
          { key: 'name', label: '名称', kind: 'text', required: true, placeholder: '例如：钉钉云盘（华南）' },
          { key: 'auth', label: '鉴权', kind: 'select', options: [{ value: 'oauth', label: 'OAuth（沿用源系统权限）' }, { value: 'key', label: 'API Key' }] },
          { key: 'mode', label: '接入方式', kind: 'select', options: (Object.keys(INGEST_MODE_CONFIG) as IngestMode[]).map((m) => ({ value: m, label: `${INGEST_MODE_CONFIG[m].label} — ${INGEST_MODE_CONFIG[m].hint}` })) },
          { key: 'scope', label: '范围', kind: 'text', placeholder: '全量导入时必填，例如 /市场部/产品素材' },
          { key: 'schedule', label: '同步计划', kind: 'select', options: ['变更通知', '每 30 分钟', '每小时', '每日 23:00'].map((x) => ({ value: x, label: x })) },
        ]}
        submitLabel="连接并授权"
        onSubmit={(v: FormValues) => {
          handleCreateConnector();
          setConnectors((prev) => [...prev, { connectorId: `c-${Date.now()}`, connectorName: String(v.name), systemKind: v.kind as Connector['systemKind'], objectLabel: '资产', direction: 'pull', ingestPlans: [{ planId: `p-${Date.now()}`, objectKind: '资产', mode: v.mode as IngestMode, allowedModes: ['full', 'on_use', 'link_only'], scope: String(v.scope || '全部'), storeAt: v.mode === 'link_only' ? '资产库（引用记录）' : '资产库' }], schedule: String(v.schedule), status: 'connected', lastSyncAt: '刚刚', itemsSynced: 0, openIssues: 0 }]);
          notify(`「${v.name}」已连接，首次同步已排队`);
        }}
      />
    </div>
  );
}
