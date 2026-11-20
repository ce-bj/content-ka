import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BookCheck, CircleCheck, Database, FileText, Image as ImageIcon, Import, Lightbulb, RefreshCw, Search, Sparkles, TriangleAlert, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { notify } from '@/components/shared/toast';
import { AiMark, EvidenceBadge, ToneBadge, type EvidenceGrade, type Tone } from '@/components/shared/status';
import { factOverrides, nextContentId, nowLabel, useDemo, type ConflictChoice, type SourceRef } from '@/lib/demo-store';
import { ROLE_CONFIG } from '@/components/layout/access';
import { REF_KIND_LABEL } from '@/lib/content-source';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const CONTENT_TYPE_OPTIONS = ['产品说明', '技术 FAQ', '客户案例', '落地页', '社媒短帖', '销售话术卡'].map((x) => ({ value: x, label: x }));
const BRAND_OPTIONS = [
  { value: '北岭智造', label: '北岭智造' },
  { value: '汉川传动', label: '汉川传动' },
];
const PRODUCT_OPTIONS = [
  { value: 'BL-R600', label: 'BL-R600 六轴工业机器人' },
  { value: 'BL-D120', label: 'BL-D120 工业除尘设备' },
];
const REGION_OPTIONS = [
  { value: '欧盟', label: '欧盟' },
  { value: '中国大陆', label: '中国大陆' },
  { value: '东南亚', label: '东南亚' },
];
const LOCALE_OPTIONS = [
  { value: 'en-US', label: 'English · en-US' },
  { value: 'de-DE', label: 'Deutsch · de-DE' },
  { value: 'zh-CN', label: '简体中文 · zh-CN' },
];
const NO_TEMPLATE = 'none';
type FactUsability = 'usable' | 'conflict' | 'expired' | 'internal_only' | 'out_of_scope';
const USABILITY_CONFIG: Record<FactUsability, { label: string; tone: Tone }> = {
  usable: { label: '可用', tone: 'green' },
  conflict: { label: '冲突中', tone: 'red' },
  expired: { label: '已过期', tone: 'amber' },
  internal_only: { label: '仅内部', tone: 'amber' },
  out_of_scope: { label: '超出范围', tone: 'gray' },
};
type RefKind = SourceRef['refKind'];

// ── 类型 ──────────────────────────────────────────────────
interface Template {
  templateId: string;
  templateName: string;
  contentTypeName: string;
  structure: string;
  requiredAttributes: string[];
}
interface ScopedFact {
  factId: string;
  attributeName: string;
  valueLabel: string;
  evidenceGrade: EvidenceGrade;
  validTo: string;
  usability: FactUsability;
  blockedReason: string | null;
}
// KDH 中检索到、尚未入库的事实（用到才存）
interface KdhFactHit {
  kdhFactId: string;
  attributeName: string;
  valueLabel: string;
  evidenceGrade: EvidenceGrade;
  sourceLabel: string;
}
// 引用时与事实库比对的结果：外部内容事先不知道冲不冲突，被引用时才比对
interface UseTimeCheck {
  refId: string;
  claimAttribute: string;
  claimValue: string;
  localFactId: string;
  localValue: string;
  localSource: string;
  externalSource: string;
  recommendExternal: boolean;
}
// 引用时比对出冲突：作者选一个取值继续生成，冲突同时记入冲突处理，送审后由审批确认
type CheckChoice = 'external' | 'local';
interface ReferenceContent {
  contentId: string;
  title: string;
  contentTypeName: string;
  locale: string;
  version: number;
  excerpt: string;
}
interface KnowledgeHit {
  passageId: string;
  sourceTitle: string;
  sourceCollection: string;
  excerpt: string;
  relevance: number;
}
interface ExternalRef {
  externalId: string;
  title: string;
  systemName: string;
  ingestMode: 'full' | 'on_use' | 'link_only';
  sourceState: 'synced' | 'source_updated' | 'source_deleted';
  excerpt: string;
}
interface PickableAsset {
  assetId: string;
  assetName: string;
  assetKind: 'image' | 'document' | 'video';
  usageNote: string;
}
interface GeneratedDraft {
  taskId: string;
  defaultTitle: string;
  summary: string;
  sections: { heading: string; body: string }[];
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockTemplatesData: Template[] = [
  { templateId: 'TPL-01', templateName: '产品说明 · 标准版', contentTypeName: '产品说明', structure: '概述 → 核心卖点 → 参数表 → 应用场景 → FAQ', requiredAttributes: ['额定负载', '重复定位精度', '最大工作半径', '防护等级'] },
  { templateId: 'TPL-02', templateName: '技术问答 · GEO 友好', contentTypeName: '技术 FAQ', structure: '每问一答，答案首句可独立引用，附结构化标注', requiredAttributes: ['防护等级', '标准交付周期'] },
  { templateId: 'TPL-03', templateName: '展会落地页', contentTypeName: '落地页', structure: '首屏 → 卖点 → 参数 → 案例 → 视频 → 预约 CTA', requiredAttributes: ['额定负载', '重复定位精度'] },
  { templateId: 'TPL-05', templateName: '客户案例 · 制造业', contentTypeName: '客户案例', structure: '背景 → 挑战 → 方案 → 效果（引用事实）', requiredAttributes: ['额定负载'] },
];

const mockScopedFactsData: ScopedFact[] = [
  { factId: 'F-001', attributeName: '重复定位精度', valueLabel: '±0.02 mm', evidenceGrade: 'A', validTo: '2027-12-31', usability: 'usable', blockedReason: null },
  { factId: 'F-004', attributeName: '额定负载', valueLabel: '20 kg', evidenceGrade: 'A', validTo: '2028-06-01', usability: 'usable', blockedReason: null },
  { factId: 'F-005', attributeName: '最大工作半径', valueLabel: '1700 mm', evidenceGrade: 'A', validTo: '2028-06-01', usability: 'usable', blockedReason: null },
  { factId: 'F-007', attributeName: '标准交付周期', valueLabel: '12 周', evidenceGrade: 'B', validTo: '2027-02-28', usability: 'usable', blockedReason: null },
  { factId: 'F-002', attributeName: '防护等级', valueLabel: 'IP66', evidenceGrade: 'A', validTo: '2028-02-28', usability: 'conflict', blockedReason: '与 F-003（IP65）冲突，处理前不能用于对外内容' },
  { factId: 'F-006', attributeName: 'CE 认证', valueLabel: '机械指令 2006/42/EC', evidenceGrade: 'C', validTo: '2028-03-31', usability: 'internal_only', blockedReason: 'C 级证据（自我声明），对外发布需 A/B 级' },
  { factId: 'F-021', attributeName: 'UL 认证', valueLabel: 'UL 1740', evidenceGrade: 'A', validTo: '2027-05-31', usability: 'out_of_scope', blockedReason: '适用区域为北美' },
];

const mockKdhFactHitsData: KdhFactHit[] = [
  { kdhFactId: 'KDH-F-8812', attributeName: '平均无故障时间 MTBF', valueLabel: '80,000 h', evidenceGrade: 'B', sourceLabel: '可靠性测试报告 2025' },
  { kdhFactId: 'KDH-F-8820', attributeName: '标准交付周期', valueLabel: '10 周', evidenceGrade: 'B', sourceLabel: 'ERP 交期表 v2026.11' },
];

const mockUseTimeChecksData: UseTimeCheck[] = [
  { refId: 'KDH-F-8820', claimAttribute: '标准交付周期', claimValue: '10 周', localFactId: 'F-007', localValue: '12 周', localSource: '事实库 F-007（ERP 交期表 v2026.08）', externalSource: 'KDH ← ERP 交期表 v2026.11', recommendExternal: true },
  { refId: 'KP-418', claimAttribute: '最大工作半径', claimValue: '1650 mm', localFactId: 'F-005', localValue: '1700 mm', localSource: '事实库 F-005（PIM 产品主数据）', externalSource: 'KDH · BL-R600 经销商培训手册（2024）第 3 页', recommendExternal: false },
];

const mockReferenceContentsData: ReferenceContent[] = [
  { contentId: 'C-0921', title: 'BL-R600 产品手册摘要（中文）', contentTypeName: '产品说明', locale: 'zh-CN', version: 4, excerpt: '中空腕部设计让焊枪电缆内置走线，减少磨损与停机……' },
  { contentId: 'C-1009', title: '汽车焊装线改造：BL-R600 客户案例', contentTypeName: '客户案例', locale: 'en-US', version: 4, excerpt: '某德系车企焊装线改造后节拍提升 14%，连续 18 个月无密封失效……' },
  { contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', contentTypeName: '销售资料', locale: 'en-US', version: 2, excerpt: '面向欧盟经销商的卖点话术与常见异议应对……' },
];

const mockKnowledgeHitsData: KnowledgeHit[] = [
  { passageId: 'KP-301', sourceTitle: '汽车焊装线改造案例（2025）', sourceCollection: '应用案例库', excerpt: '在焊装车间粉尘环境下连续运行 18 个月，无关节密封失效；节拍提升 14%。', relevance: 0.91 },
  { passageId: 'KP-117', sourceTitle: '欧盟买家高频问题 · 机器人类', sourceCollection: '买家问题库', excerpt: '欧盟买家最常询问 CE 合规、交付周期、本地备件与培训支持。', relevance: 0.86 },
  { passageId: 'KP-552', sourceTitle: 'BL-R600 技术白皮书 v3', sourceCollection: '产品技术文档', excerpt: '中空腕部设计便于焊枪走线，减少电缆磨损与停机。', relevance: 0.79 },
  { passageId: 'KP-418', sourceTitle: 'BL-R600 经销商培训手册（2024）', sourceCollection: '渠道培训资料', excerpt: '工作半径 1650 mm，覆盖常见点焊工位；建议搭配 700 mm 底座使用。', relevance: 0.74 },
];

// 外部内容：要读正文的文字内容，用作写作参考；正文随内容版本保存快照
const mockExternalRefsData: ExternalRef[] = [
  { externalId: 'EX-402', title: 'BL-R600 产品描述（PIM 长描述）', systemName: 'Pimcore PIM', ingestMode: 'full', sourceState: 'synced', excerpt: 'Six-axis industrial robot for welding and handling, hollow wrist for integrated cable routing……' },
  { externalId: 'EX-305', title: 'BL-R600 汉诺威展新闻稿（市场部定稿）', systemName: '飞书云空间', ingestMode: 'on_use', sourceState: 'synced', excerpt: '北岭智造在汉诺威工业展发布 BL-R600 焊装版，现场演示连续 8 小时焊装节拍……' },
  { externalId: 'EX-211', title: 'BL-R600 About & Applications', systemName: '现有官网（反向代理）', ingestMode: 'full', sourceState: 'source_updated', excerpt: 'BL-R600 serves automotive body shops, metal fabrication and logistics……' },
  { externalId: 'EX-318', title: 'Nordwerk 渠道政策说明（2026 版）', systemName: 'SharePoint（欧洲子公司）', ingestMode: 'link_only', sourceState: 'synced', excerpt: '仅链接：生成时实时读取正文，不保存副本。' },
  { externalId: 'EX-509', title: 'BL-D120 Produktseite (alt)', systemName: '现有官网（反向代理）', ingestMode: 'full', sourceState: 'source_deleted', excerpt: '源页面已删除，不能再引用。' },
];

const mockAssetsData: PickableAsset[] = [
  { assetId: 'A-2207', assetName: '汉诺威展焊装线实拍', assetKind: 'image', usageNote: '4:5 · 已授权 · 可对外' },
  { assetId: 'A-2190', assetName: 'BL-R600 白底产品图', assetKind: 'image', usageNote: '1:1 · 已授权 · 可对外' },
  { assetId: 'A-2301', assetName: 'TÜV 检测报告 TÜV-2026-1188', assetKind: 'document', usageNote: 'PDF · 证据文件' },
];

const mockGeneratedDraftData: GeneratedDraft = {
  taskId: 'GEN-7790',
  defaultTitle: 'BL-R600 6-Axis Industrial Robot — Product Brief',
  summary: 'BL-R600 is a six-axis robot built for welding, palletizing and machine tending lines in the EU.',
  sections: [
    { heading: 'Overview', body: 'Built for high-mix lines, BL-R600 handles payloads up to {F-004} with a repeatability of {F-001} and a reach of {F-005}.' },
    { heading: 'Running in welding cells', body: 'In an automotive body-in-white retrofit, BL-R600 ran 18 months in dusty welding cells with no joint seal failure and lifted throughput by 14%. {KP-301}' },
    { heading: 'Delivery and support', body: 'Standard lead time for EU orders is {F-007}. Local spare parts and operator training are available. {KP-117}' },
  ],
};

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取生成模板（可选） [GET] /api/v1/generation-templates
function handleFetchTemplates(params: { contentTypeName: string; kind: 'generate' }) {
  console.log('fetch templates', params);
}

// ACTION: 获取范围内的事实 [GET] /api/v1/facts/scoped
function handleFetchScopedFacts(params: { brand: string; product: string; region: string }) {
  console.log('fetch scoped facts', params);
}

// ACTION: 获取可参考的已生效内容 [GET] /api/v1/contents
function handleFetchReferenceContents(params: { status: 'published'; keyword: string; product: string }) {
  console.log('fetch reference contents', params);
}

// ACTION: 检索知识库 [POST] /api/v1/knowledge/search
function handleSearchKnowledge(req: { query: string; product: string; region: string; topK: number }) {
  console.log('search kdh', req);
}

// ACTION: 获取可引用资产 [GET] /api/v1/assets
function handleFetchAssets(params: { product: string; licensed: boolean }) {
  console.log('fetch assets', params);
}

// ACTION: 检索 KDH 中未入库的事实 [GET] /api/v1/kdh/facts/search
function handleSearchKdhFacts(params: { query: string; product: string }) {
  console.log('search kdh facts', params);
}

// ACTION: 获取可引用的外部内容 [GET] /api/v1/external-contents
function handleFetchExternalRefs(params: { product: string; keyword: string }) {
  console.log('fetch external refs', params);
}

// ACTION: 引用前与事实库比对 [POST] /api/v1/references/check
function handleCheckReference(req: { refKind: RefKind; refId: string; product: string }) {
  console.log('check reference', req);
}

// ACTION: 记录使用中发现的冲突 [POST] /api/v1/conflicts
function handleReportUseTimeConflict(req: { refId: string; localFactId: string; discoveredIn: string }) {
  console.log('report use-time conflict', req);
}

// ACTION: 发起生成任务 [POST] /api/v1/generation-tasks
function handleGenerateDraft(req: {
  topicId: string | null;
  brief: string;
  contentTypeName: string;
  templateId: string | null;
  brand: string;
  product: string;
  region: string;
  locale: string;
  refs: SourceRef[];
  applyBrandVoice: boolean;
}) {
  console.log('generate', req);
}

// ACTION: 保存为内容草稿 [POST] /api/v1/generation-tasks/{taskId}/save-draft
function handleSaveGeneratedDraft(taskId: string, title: string) {
  console.log('save generated draft', taskId, title);
}

// ── 主组件 ────────────────────────────────────────────────
interface TopicState {
  topicId: string;
  title: string;
  contentTypeName: string;
  scopeLabel: string;
  evidence: string;
}

export default function GenerateWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  // 从选题进来带 TopicState；从「外部内容 → 用作引用」进来带 externalRef
  const navState = (location.state as (Partial<TopicState> & { externalRef?: SourceRef }) | null) ?? null;
  const topic = navState?.topicId ? (navState as TopicState) : null;
  const incomingExternal = navState?.externalRef ?? null;
  const { state: demo, dispatch } = useDemo();
  // 冲突裁定后的取值已进入事实库：后续引用直接取这个值
  const overrides = factOverrides(demo);
  const cf018 = demo.conflicts['CF-018'];
  const facts: ScopedFact[] = mockScopedFactsData.map((f) => {
    if (overrides[f.factId]) return { ...f, valueLabel: overrides[f.factId].value, blockedReason: `已按冲突 ${overrides[f.factId].conflictId} 裁定更新` };
    if (f.factId === 'F-002' && cf018 && (cf018.action === 'adopt' || cf018.action === 'split_scope')) return { ...f, valueLabel: cf018.adoptedValue ?? f.valueLabel, usability: 'usable', blockedReason: '冲突 CF-018 已裁定，可以引用' };
    return f;
  });
  const conflictIdOf = (refId: string) => demo.discovered.find((d) => d.externalId === refId)?.conflictId ?? null;
  const resolvedRef = (refId: string) => {
    const id = conflictIdOf(refId);
    return id && demo.conflicts[id] ? { conflictId: id, value: demo.conflicts[id].adoptedValue } : null;
  };

  const [brief, setBrief] = useState(
    topic ? `选题：${topic.title}\n依据：${topic.evidence}\n面向欧盟采购与设备工程师，先回答问题，再给参数与案例佐证。` : '面向欧盟采购与设备工程师，介绍 BL-R600 的核心参数、焊装车间应用和交付支持。语气专业克制，用数据说话。',
  );
  const [typeName, setTypeName] = useState(topic?.contentTypeName ?? '产品说明');
  const [templateId, setTemplateId] = useState<string>(NO_TEMPLATE);
  const [brand, setBrand] = useState('北岭智造');
  const [product, setProduct] = useState('BL-R600');
  const [region, setRegion] = useState('欧盟');
  const [locale, setLocale] = useState('en-US');
  const [applyVoice, setApplyVoice] = useState(true);
  const [kbQuery, setKbQuery] = useState('BL-R600 焊装 粉尘 应用案例');
  const [picked, setPicked] = useState<SourceRef[]>([
    { refKind: 'fact', refId: 'F-001', label: '重复定位精度 ±0.02 mm' },
    { refKind: 'fact', refId: 'F-004', label: '额定负载 20 kg' },
    { refKind: 'kdh', refId: 'KP-301', label: '汽车焊装线改造案例（2025）' },
    ...(incomingExternal ? [incomingExternal] : []),
  ]);
  const [generated, setGenerated] = useState(false);
  const [kdhFactQuery, setKdhFactQuery] = useState('BL-R600 可靠性 交期');
  const [checkChoices, setCheckChoices] = useState<Record<string, CheckChoice | null>>({});
  const [title, setTitle] = useState(topic?.title ?? mockGeneratedDraftData.defaultTitle);

  const templates = [
    ...mockTemplatesData,
    ...demo.templates.filter((t) => t.templateKind === 'generate' && t.enabled).map((t) => ({ templateId: t.templateId, templateName: t.templateName, contentTypeName: t.contentTypeName, structure: t.structure, requiredAttributes: [] as string[] })),
  ].filter((t) => t.contentTypeName === typeName);
  const templateItems = [{ value: NO_TEMPLATE, label: '不使用模板（按内容类型默认结构）' }, ...templates.map((t) => ({ value: t.templateId, label: `${t.templateId} ${t.templateName}` }))];
  const tpl = templates.find((t) => t.templateId === templateId) ?? null;
  const pickedFacts = facts.filter((f) => picked.some((p) => p.refKind === 'fact' && p.refId === f.factId));
  const missingRequired = tpl ? tpl.requiredAttributes.filter((a) => !pickedFacts.some((f) => f.attributeName === a)) : [];
  const isPicked = (kind: RefKind, id: string) => picked.some((p) => p.refKind === kind && p.refId === id);
  const toggle = (kind: RefKind, id: string, label: string, on: boolean) => {
    setPicked((prev) => (on ? [...prev, { refKind: kind, refId: id, label }] : prev.filter((p) => !(p.refKind === kind && p.refId === id))));
    setGenerated(false);
    // 来自 KDH、尚未入库的内容：被引用的这一刻才与事实库比对
    if (id.startsWith('KDH-F') || id.startsWith('KP-')) {
      const c = mockUseTimeChecksData.find((x) => x.refId === id);
      if (on) {
        handleCheckReference({ refKind: kind, refId: id, product });
        if (c && !resolvedRef(id)) {
          setCheckChoices((p) => ({ ...p, [id]: null }));
          recordConflict(c);
        }
      } else if (id in checkChoices) {
        setCheckChoices((p) => {
          const n = { ...p };
          delete n[id];
          return n;
        });
      }
    }
  };
  // 比对出冲突：立即记入冲突处理（不阻断生成）
  const recordConflict = (c: UseTimeCheck) => {
    if (conflictIdOf(c.refId)) return;
    const conflictId = `CF-0${31 + demo.discovered.length}`;
    handleReportUseTimeConflict({ refId: c.refId, localFactId: c.localFactId, discoveredIn: 'AI 生成引用' });
    dispatch({
      type: 'discoverConflict',
      conflict: { conflictId, subjectName: 'BL-R600 六轴工业机器人', attributeName: c.claimAttribute, localFactId: c.localFactId, localValue: c.localValue, localSource: c.localSource, externalId: c.refId, externalValue: c.claimValue, externalSource: c.externalSource, recommendExternal: c.recommendExternal, discoveredIn: 'AI 生成引用', discoveredBy: ROLE_CONFIG[demo.role].person, discoveredAt: `今天 ${nowLabel()}` },
    });
  };
  // 每个冲突最终用哪个值：作者选的，没选就按推荐
  const activeChecks = mockUseTimeChecksData.filter((c) => c.refId in checkChoices && isPicked(c.refId.startsWith('KP-') ? 'kdh' : 'fact', c.refId));
  const effectiveChoice = (c: UseTimeCheck): CheckChoice => checkChoices[c.refId] ?? (c.recommendExternal ? 'external' : 'local');
  const unchosen = activeChecks.filter((c) => !checkChoices[c.refId]);
  const conflictChoices: ConflictChoice[] = activeChecks.map((c) => {
    const ext = effectiveChoice(c) === 'external';
    return { conflictId: conflictIdOf(c.refId) ?? '', attributeName: c.claimAttribute, localFactId: c.localFactId, chosenValue: ext ? c.claimValue : c.localValue, chosenSource: ext ? c.externalSource : c.localSource, otherValue: ext ? c.localValue : c.claimValue, otherSource: ext ? c.localSource : c.externalSource };
  });
  const choose = (c: UseTimeCheck, v: CheckChoice) => {
    setCheckChoices((p) => ({ ...p, [c.refId]: v }));
    // 选事实库的值时，确保引用了对应事实
    if (v === 'local' && !picked.some((p) => p.refId === c.localFactId)) {
      const local = facts.find((f) => f.factId === c.localFactId)!;
      setPicked((prev) => [...prev, { refKind: 'fact', refId: local.factId, label: `${local.attributeName} ${local.valueLabel}` }]);
    }
    setGenerated(false);
  };
  const checkPanel = (id: string, kind: RefKind) => {
    const c = mockUseTimeChecksData.find((x) => x.refId === id);
    const done = resolvedRef(id);
    if (done) return <div className="mt-1 text-xs text-emerald-700">冲突 {done.conflictId} 已裁定为「{done.value}」，已进入事实库 {c?.localFactId}，直接引用事实库即可</div>;
    if (!c || !(id in checkChoices) || !isPicked(kind, id)) {
      if (isPicked(kind, id) && id.startsWith('KDH-F'))
        return (
          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
            <CircleCheck className="size-3" /> 已与事实库比对，无冲突；保存草稿时入库为事实
          </div>
        );
      return null;
    }
    const cur = checkChoices[id];
    const opt = (v: CheckChoice, value: string, src: string, rec: boolean) => (
      <button
        onClick={() => choose(c, v)}
        className={cn('flex-1 rounded-md border bg-background px-2.5 py-1.5 text-left hover:bg-muted', cur === v && 'border-primary ring-2 ring-primary/20')}
      >
        <div className="font-medium text-foreground">
          用「{value}」{rec && <span className="ml-1 text-violet-700">推荐</span>}
        </div>
        <div className="text-muted-foreground">{src}</div>
      </button>
    );
    return (
      <div className="mt-2 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <div className="flex items-start gap-1.5 font-medium">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          引用时发现冲突：{kind === 'kdh' ? '片段中' : 'KDH 中'}「{c.claimAttribute} {c.claimValue}」与事实库 {c.localFactId}「{c.localValue}」不一致 · 已记入冲突处理 {conflictIdOf(id)}
        </div>
        <div className="flex flex-col gap-1.5 sm:flex-row">
          {opt('external', c.claimValue, c.externalSource, c.recommendExternal)}
          {opt('local', c.localValue, c.localSource, !c.recommendExternal)}
        </div>
        <div className="text-amber-800/80 dark:text-amber-200/80">选一个继续生成即可，不影响下一步。送审后由审批确认这个取值：通过即裁定，进入事实库并回写 KDH。</div>
      </div>
    );
  };
  const countOf = (kind: RefKind) => picked.filter((p) => p.refKind === kind).length;

  // 预览：只把选中的事实填进去；没选的事实位置标出“缺”
  // 冲突中选用的值优先；KDH 里的同属性事实被引用时，也算作该属性已引用
  const chosenFor = (factId: string) => conflictChoices.find((x) => x.localFactId === factId);
  const hasFact = (factId: string) => isPicked('fact', factId) || activeChecks.some((c) => c.localFactId === factId && c.refId.startsWith('KDH-F'));
  const valueOf = (factId: string) => chosenFor(factId)?.chosenValue ?? facts.find((x) => x.factId === factId)!.valueLabel;
  const render = (body: string) =>
    body.replace(/\{(F-\d+|KP-\d+)\}/g, (_, id: string) => {
      if (id.startsWith('KP-')) return isPicked('kdh', id) ? `［${id}］` : '';
      const f = facts.find((x) => x.factId === id)!;
      return hasFact(id) ? `【${valueOf(id)}】` : `［缺：${f.attributeName}］`;
    });
  const toEditorBody = (body: string) =>
    body.replace(/\{(F-\d+|KP-\d+)\}/g, (_, id: string) => {
      if (id.startsWith('KP-')) return '';
      const f = facts.find((x) => x.factId === id)!;
      return hasFact(id) ? `[${valueOf(id)} | ${id}]` : `［待补：${f.attributeName}］`;
    });
  const usedIds = mockGeneratedDraftData.sections.flatMap((s) => [...s.body.matchAll(/\{(F-\d+|KP-\d+)\}/g)].map((m) => m[1]));

  const generate = () => {
    handleGenerateDraft({ topicId: topic?.topicId ?? null, brief, contentTypeName: typeName, templateId: tpl?.templateId ?? null, brand, product, region, locale, refs: picked, applyBrandVoice: applyVoice });
    setGenerated(true);
  };
  const save = () => {
    const contentId = nextContentId(demo);
    handleSaveGeneratedDraft(mockGeneratedDraftData.taskId, title);
    dispatch({
      type: 'createContent',
      content: {
        contentId,
        title,
        summary: mockGeneratedDraftData.summary,
        contentTypeName: typeName,
        brandName: brand,
        regionLabel: region,
        locale,
        sections: mockGeneratedDraftData.sections.map((s) => ({ heading: s.heading, body: toEditorBody(s.body).replace(/\s+$/, '') })),
        source: { kind: 'ai_generate', topicId: topic?.topicId ?? null, taskId: mockGeneratedDraftData.taskId, templateId: tpl?.templateId ?? null, templateName: tpl?.templateName ?? null, sourceContentId: null, refs: picked },
        conflictChoices,
        ownerName: '林悦',
        createdAt: `今天 ${nowLabel()}`,
      },
    });
    const stored = picked.filter((p) => p.refId.startsWith('KDH-F')).length;
    const snapshots = picked.filter((p) => p.refKind === 'kdh').length;
    notify(`已保存为草稿 ${contentId}，来源记为「AI 生成${topic ? ` · 选题 ${topic.topicId}` : ''}」${stored ? `；${stored} 条 KDH 事实已入库事实库` : ''}${snapshots ? `；${snapshots} 段知识片段原文已存为引用快照` : ''}${conflictChoices.length ? `；${conflictChoices.length} 个冲突取值随内容送审确认` : ''}`);
    navigate(`/content/edit/${contentId}`);
  };

  const simpleSelect = (items: { value: string; label: string }[], value: string, set: (v: string) => void, onChange?: (v: string) => void) => (
    <Select items={items} value={value} onValueChange={(v) => { set(v as string); onChange?.(v as string); setGenerated(false); }}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="AI 生成"
        description="写下要求，自己挑选要引用的事实、已有内容、知识库片段和资产，直接生成草稿。模板是可选的辅助：选了模板会按它的结构写，并提示缺哪些必需事实。保存后进入「自产内容」，来源与引用随内容保存。"
      />

      {topic && (
        <Alert>
          <Lightbulb />
          <AlertTitle>来自选题 {topic.topicId}：{topic.title}</AlertTitle>
          <AlertDescription>{topic.scopeLabel} · {topic.evidence}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* 写作要求 */}
        <Card>
          <CardHeader>
            <CardTitle>1 · 写什么</CardTitle>
            <CardDescription>要求越具体，AI 越不需要猜；事实只会取自右侧选中的引用。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>写作要求</Label>
              <Textarea rows={4} value={brief} onChange={(e) => { setBrief(e.target.value); setGenerated(false); }} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>内容类型</Label>
                {simpleSelect(CONTENT_TYPE_OPTIONS, typeName, setTypeName, (v) => { setTemplateId(NO_TEMPLATE); handleFetchTemplates({ contentTypeName: v, kind: 'generate' }); })}
              </div>
              <div className="space-y-1.5">
                <Label>语种</Label>
                {simpleSelect(LOCALE_OPTIONS, locale, setLocale)}
              </div>
              <div className="space-y-1.5">
                <Label>品牌</Label>
                {simpleSelect(BRAND_OPTIONS, brand, setBrand, (v) => handleFetchScopedFacts({ brand: v, product, region }))}
              </div>
              <div className="space-y-1.5">
                <Label>产品</Label>
                {simpleSelect(PRODUCT_OPTIONS, product, setProduct, (v) => handleFetchScopedFacts({ brand, product: v, region }))}
              </div>
              <div className="space-y-1.5">
                <Label>区域</Label>
                {simpleSelect(REGION_OPTIONS, region, setRegion, (v) => handleFetchScopedFacts({ brand, product, region: v }))}
              </div>
              <div className="flex items-end gap-2 pb-2 text-sm">
                <Switch checked={applyVoice} onCheckedChange={(c) => setApplyVoice(c)} /> 应用 Brand Voice 与术语库
              </div>
            </div>
            <div className="space-y-1.5 rounded-lg border border-dashed p-3">
              <Label>
                模板 <span className="font-normal text-muted-foreground">（可选，在「生产规范 → 模板」中按类别管理）</span>
              </Label>
              {simpleSelect(templateItems, templateId, setTemplateId)}
              {tpl ? (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>结构：{tpl.structure}</div>
                  {tpl.requiredAttributes.length > 0 && (
                    <div>
                      必需事实：
                      {tpl.requiredAttributes.map((a) => (
                        <span key={a} className={cn('mr-1.5', missingRequired.includes(a) ? 'text-amber-700' : 'text-emerald-700')}>
                          {a}
                          {missingRequired.includes(a) ? '（未选）' : '✓'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">不用模板时，AI 按「{typeName}」的字段结构和写作要求组织内容。</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 引用 */}
        <Card>
          <CardHeader>
            <CardTitle>2 · 引用什么</CardTitle>
            <CardDescription>已选 {picked.length} 项。事实以插槽写入正文（随事实更新）；已有内容、知识库片段和外部内容作为参考，原文随版本保存。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex min-h-8 flex-wrap gap-1.5">
              {picked.map((p) => (
                <span key={`${p.refKind}-${p.refId}`} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs">
                  <span className="text-muted-foreground">{REF_KIND_LABEL[p.refKind]}</span> {p.label}
                  <button aria-label="移除" onClick={() => toggle(p.refKind, p.refId, p.label, false)}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {picked.length === 0 && <span className="text-xs text-muted-foreground">还没有选择引用，AI 只能写通用表述</span>}
            </div>
            <Tabs defaultValue={incomingExternal ? 'external' : 'fact'} onValueChange={(v) => { if (v === 'external') handleFetchExternalRefs({ product, keyword: '' }); if (v === 'content') handleFetchReferenceContents({ status: 'published', keyword: '', product }); if (v === 'asset') handleFetchAssets({ product, licensed: true }); }}>
              <TabsList className="w-full">
                <TabsTrigger value="fact">
                  <BookCheck /> 事实 {countOf('fact')}
                </TabsTrigger>
                <TabsTrigger value="content">
                  <FileText /> 已有内容 {countOf('content')}
                </TabsTrigger>
                <TabsTrigger value="kdh">
                  <Database /> 知识库 {countOf('kdh')}
                </TabsTrigger>
                <TabsTrigger value="external">
                  <Import /> 外部内容 {countOf('external')}
                </TabsTrigger>
                <TabsTrigger value="asset">
                  <ImageIcon /> 资产 {countOf('asset')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="fact" className="grid gap-2 pt-2">
                <div className="text-xs font-medium text-muted-foreground">事实库（已入库）</div>
                {facts.map((f) => {
                  const usable = f.usability === 'usable';
                  return (
                    <label key={f.factId} className={cn('flex items-start gap-3 rounded-lg border p-2.5', !usable && 'bg-muted/40 opacity-70')}>
                      <Checkbox disabled={!usable} checked={isPicked('fact', f.factId)} onCheckedChange={(c) => toggle('fact', f.factId, `${f.attributeName} ${f.valueLabel}`, !!c)} />
                      <div className="flex-1 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{f.attributeName}</span>
                          <span>{f.valueLabel}</span>
                          <EvidenceBadge grade={f.evidenceGrade} />
                          <ToneBadge tone={USABILITY_CONFIG[f.usability].tone}>{USABILITY_CONFIG[f.usability].label}</ToneBadge>
                          {tpl?.requiredAttributes.includes(f.attributeName) && <ToneBadge tone="blue">模板必需</ToneBadge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {f.factId} · 有效期至 {f.validTo}
                        </div>
                        {f.blockedReason && <div className="mt-0.5 text-xs text-amber-700">{f.blockedReason}</div>}
                      </div>
                    </label>
                  );
                })}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-muted-foreground">KDH 中检索（未入库 · 用到才存）</div>
                </div>
                <div className="flex gap-2">
                  <Input value={kdhFactQuery} onChange={(e) => setKdhFactQuery(e.target.value)} />
                  <Button variant="outline" onClick={() => handleSearchKdhFacts({ query: kdhFactQuery, product })}>
                    <Search /> 检索 KDH
                  </Button>
                </div>
                {mockKdhFactHitsData.map((f) => (
                  <div key={f.kdhFactId} className="rounded-lg border border-dashed p-2.5">
                    <label className="flex items-start gap-3">
                      <Checkbox checked={isPicked('fact', f.kdhFactId)} disabled={!!resolvedRef(f.kdhFactId)} onCheckedChange={(c) => toggle('fact', f.kdhFactId, `${f.attributeName} ${f.valueLabel}（KDH，引用时入库）`, !!c)} />
                      <div className="flex-1 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{f.attributeName}</span>
                          <span>{f.valueLabel}</span>
                          <EvidenceBadge grade={f.evidenceGrade} />
                          {resolvedRef(f.kdhFactId) ? <ToneBadge tone="green">已入库</ToneBadge> : <ToneBadge tone="teal">未入库</ToneBadge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {f.kdhFactId} · {f.sourceLabel}
                        </div>
                      </div>
                    </label>
                    {checkPanel(f.kdhFactId, 'fact')}
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="content" className="grid gap-2 pt-2">
                {mockReferenceContentsData.map((c) => (
                  <label key={c.contentId} className="flex items-start gap-3 rounded-lg border p-2.5">
                    <Checkbox checked={isPicked('content', c.contentId)} onCheckedChange={(v) => toggle('content', c.contentId, `${c.contentId} ${c.title}`, !!v)} />
                    <div className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{c.title}</span>
                        <ToneBadge tone="gray">{c.contentTypeName}</ToneBadge>
                        <span className="text-xs text-muted-foreground">
                          {c.contentId} v{c.version} · {c.locale} · 已生效
                        </span>
                      </div>
                      <p className="mt-0.5 text-muted-foreground">{c.excerpt}</p>
                    </div>
                  </label>
                ))}
                <p className="text-xs text-muted-foreground">已有内容作为写法和素材参考；其中的参数不会被直接复制，仍以事实库为准。</p>
              </TabsContent>
              <TabsContent value="kdh" className="space-y-2 pt-2">
                <div className="flex gap-2">
                  <Input value={kbQuery} onChange={(e) => setKbQuery(e.target.value)} />
                  <Button variant="outline" onClick={() => handleSearchKnowledge({ query: kbQuery, product, region, topK: 5 })}>
                    <Search /> 检索
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">知识片段不入库，被引用时只保存选中这段的原文快照，随内容版本保存。</p>
                {mockKnowledgeHitsData.map((k) => (
                  <div key={k.passageId} className="rounded-lg border p-2.5">
                  <label className="flex items-start gap-3">
                    <Checkbox checked={isPicked('kdh', k.passageId)}  onCheckedChange={(v) => toggle('kdh', k.passageId, k.sourceTitle, !!v)} />
                    <div className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{k.sourceTitle}</span>
                        <ToneBadge tone="teal">{k.sourceCollection}</ToneBadge>
                        <span className="text-xs text-muted-foreground">相关度 {Math.round(k.relevance * 100)}%</span>
                      </div>
                      <p className="mt-0.5 text-muted-foreground">{k.excerpt}</p>
                    </div>
                  </label>
                  {checkPanel(k.passageId, 'kdh')}
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="external" className="grid gap-2 pt-2">
                <p className="text-xs text-muted-foreground">外部平台接入的文字内容（官网页面、文档正文、PIM 描述），作写法和素材参考；其中的参数不会被直接复制，仍以事实库为准。被引用时保存正文快照，源更新后提醒复核。</p>
                {mockExternalRefsData.map((x) => {
                  const deleted = x.sourceState === 'source_deleted';
                  return (
                    <label key={x.externalId} className={cn('flex items-start gap-3 rounded-lg border p-2.5', deleted && 'bg-muted/40 opacity-70')}>
                      <Checkbox
                        disabled={deleted}
                        checked={isPicked('external', x.externalId)}
                        onCheckedChange={(v) => {
                          toggle('external', x.externalId, `${x.externalId} ${x.title}`, !!v);
                          if (v && x.ingestMode === 'on_use') notify(`${x.externalId} 是「用到才存」：已从${x.systemName}导入正文副本，进入外部内容`);
                        }}
                      />
                      <div className="text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{x.title}</span>
                          <ToneBadge tone="gray">{x.systemName}</ToneBadge>
                          <span className="text-xs text-muted-foreground">
                            {x.externalId} · {x.ingestMode === 'full' ? '全量导入' : x.ingestMode === 'on_use' ? '用到才存' : '仅链接'}
                          </span>
                          {x.sourceState === 'source_updated' && <ToneBadge tone="amber">源已更新</ToneBadge>}
                          {deleted && <ToneBadge tone="red">源已删除</ToneBadge>}
                        </div>
                        <p className="mt-0.5 text-muted-foreground">{x.excerpt}</p>
                      </div>
                    </label>
                  );
                })}
              </TabsContent>
              <TabsContent value="asset" className="grid gap-2 pt-2">
                {mockAssetsData.map((a) => (
                  <label key={a.assetId} className="flex items-start gap-3 rounded-lg border p-2.5">
                    <Checkbox checked={isPicked('asset', a.assetId)} onCheckedChange={(v) => toggle('asset', a.assetId, a.assetName, !!v)} />
                    <div className="text-sm">
                      <div className="font-medium">{a.assetName}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.assetId} · {a.usageNote}
                      </div>
                    </div>
                  </label>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {unchosen.length > 0 && <span className="text-xs text-amber-700">{unchosen.length} 个冲突未选择，将按推荐取值生成</span>}
        {conflictChoices.length > 0 && unchosen.length === 0 && <span className="text-xs text-muted-foreground">冲突取值已选，送审后由审批确认</span>}
        {missingRequired.length > 0 && <span className="text-xs text-amber-700">模板必需事实未选：{missingRequired.join('、')}，生成后会留空待补</span>}
        <Button size="lg" onClick={generate}>
          {generated ? <RefreshCw /> : <Sparkles />} {generated ? '按当前引用重新生成' : '生成草稿'}
        </Button>
      </div>

      {generated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              3 · 预览 <AiMark />
            </CardTitle>
            <CardDescription>
              任务 {mockGeneratedDraftData.taskId} · {typeName} · {tpl ? `模板 ${tpl.templateName}` : '未使用模板'} · {brand} / {region} / {locale}
            </CardDescription>
            <CardAction>
              <Button onClick={save}>
                保存为草稿并编辑 <ArrowRight />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-5 xl:grid-cols-[1fr_300px]">
            <div className="space-y-4 rounded-xl border p-5">
              <Input className="text-base font-semibold" value={title} onChange={(e) => setTitle(e.target.value)} />
              <p className="rounded-lg bg-muted/50 p-3 text-sm">{mockGeneratedDraftData.summary}</p>
              {mockGeneratedDraftData.sections.map((s) => (
                <div key={s.heading}>
                  <div className="font-medium">{s.heading}</div>
                  <p className="text-sm leading-6 text-muted-foreground">{render(s.body)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-sm">
              <div className="font-medium">引用使用情况</div>
              {picked.map((p) => {
                const used = p.refKind === 'fact' || p.refKind === 'kdh' ? usedIds.includes(p.refId) || mockUseTimeChecksData.some((c) => c.refId === p.refId && usedIds.includes(c.localFactId)) : true;
                return (
                  <div key={`${p.refKind}-${p.refId}`} className="flex items-start justify-between gap-2 rounded-md border px-2.5 py-1.5">
                    <div>
                      <div className="text-xs text-muted-foreground">{REF_KIND_LABEL[p.refKind]}</div>
                      {p.label}
                    </div>
                    <ToneBadge tone={used ? 'green' : 'gray'}>{used ? (p.refKind === 'content' || p.refKind === 'external' ? '作参考' : p.refKind === 'asset' ? '已插入' : '已引用') : '未用到'}</ToneBadge>
                  </div>
                );
              })}
              {usedIds
                .filter((id) => id.startsWith('F-') && !hasFact(id))
                .map((id) => (
                  <div key={id} className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    正文需要「{facts.find((f) => f.factId === id)?.attributeName}」，但没有选这条事实，已留空待补
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
