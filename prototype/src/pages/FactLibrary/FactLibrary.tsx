import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BookOpen, Download, FileInput, PenLine, Plus, RefreshCw, Search, UploadCloud } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { notify } from '@/components/shared/toast';
import { approvalOf, useDemo } from '@/lib/demo-store';
import { EvidenceBadge, SyncBadge, ToneBadge, type EvidenceGrade, type SyncStatus, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
type FactStatus = 'pending' | 'valid' | 'expired' | 'superseded' | 'paused';
const FACT_STATUS_CONFIG: Record<FactStatus, { label: string; tone: Tone }> = {
  pending: { label: '待确认', tone: 'blue' },
  valid: { label: '有效', tone: 'green' },
  expired: { label: '已过期', tone: 'amber' },
  superseded: { label: '已被替代', tone: 'gray' },
  paused: { label: '暂停引用', tone: 'red' },
};
type FactOrigin = 'cms' | 'kdh' | 'pim' | 'erp' | 'doc_ocr';
// 可见级别来自 KDH 分级权限（只读）
const VISIBILITY_CONFIG = {
  public: { label: '公开', tone: 'green' as Tone, hint: '可用于对外内容' },
  internal: { label: '内部', tone: 'amber' as Tone, hint: '仅内部内容可引用' },
  confidential: { label: '机密', tone: 'red' as Tone, hint: '不可被内容引用' },
} as const;
type FactVisibility = keyof typeof VISIBILITY_CONFIG;

const ORIGIN_LABEL: Record<FactOrigin, string> = {
  cms: '中台录入',
  kdh: '知识库',
  pim: 'KDH ← PIM',
  erp: 'KDH ← ERP',
  doc_ocr: '文档解析',
};
const STATUS_OPTIONS = [{ value: 'all', label: '全部状态' }, ...Object.entries(FACT_STATUS_CONFIG).map(([value, c]) => ({ value, label: c.label }))];
const SYNC_OPTIONS = [
  { value: 'all', label: '全部同步状态' },
  { value: 'synced', label: '已同步' },
  { value: 'local_modified', label: '本地已修改' },
  { value: 'source_updated', label: '源已更新' },
  { value: 'both_modified', label: '双方都改了' },
  { value: 'sync_failed', label: '同步失败' },
];
const EVIDENCE_OPTIONS = [
  { value: 'all', label: '全部证据' },
  { value: 'A', label: 'A 级' },
  { value: 'B', label: 'B 级' },
  { value: 'C', label: 'C 级' },
];
const UNIT_OPTIONS = [
  { value: 'none', label: '无单位' },
  { value: 'mm', label: 'mm' },
  { value: 'kg', label: 'kg' },
  { value: 'week', label: '周' },
  { value: 'Nm', label: 'N·m' },
];

// ── 类型 ──────────────────────────────────────────────────
interface SubjectNode {
  subjectId: string;
  subjectName: string;
  subjectKind: 'brand' | 'product' | 'variant' | 'certificate';
  depth: number;
  factCount: number;
}
interface FactRow {
  factId: string;
  subjectName: string;
  attributeName: string;
  attributeCategory: string;
  valueLabel: string;
  evidenceGrade: EvidenceGrade;
  evidenceSource: string;
  validFrom: string;
  validTo: string;
  scopeLabel: string;
  status: FactStatus;
  inConflict: boolean;
  origin: FactOrigin;
  syncStatus: SyncStatus;
  referencedCount: number;
  visibility: FactVisibility;
}
interface FactDetail {
  factId: string;
  subjectName: string;
  attributeName: string;
  valueLabel: string;
  scopeDimensions: { dimension: string; value: string }[];
  evidenceGrade: EvidenceGrade;
  evidenceAssetName: string;
  evidenceAssetId: string;
  validFrom: string;
  validTo: string;
  ownerName: string;
  sourceTrace: { sourceSystem: string; externalId: string; externalVersion: string; lastSyncedAt: string; syncStatus: SyncStatus; syncDirection: string };
  references: { contentId: string; title: string; version: number; refMode: 'slot' | 'inline'; contentStatus: string }[];
  history: { version: number; valueLabel: string; changedBy: string; changeOrigin: string; changedAt: string }[];
}
interface AttributeDefinition {
  attributeKey: string;
  attributeName: string;
  category: string;
  unit: string | null;
  scopeDimensions: string[];
  authoritySource: string;
  redLine: boolean;
}
interface ConflictPrecheck {
  hasConflict: boolean;
  conflictingFactId: string;
  conflictingValue: string;
  conflictingSource: string;
  suggestion: string;
}

// 事实变更对内容的影响：插槽引用随事实刷新；正文写死的需要人工复核
interface FactChange {
  changeId: string;
  factId: string;
  attributeName: string;
  subjectName: string;
  oldValue: string;
  newValue: string;
  changeOrigin: string;
  changedAt: string;
  impacts: { contentId: string; title: string; refMode: 'slot' | 'inline'; contentStatus: string }[];
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockFactChangesData: FactChange[] = [
  {
    changeId: 'FC-31', factId: 'F-007', attributeName: '标准交付周期', subjectName: 'BL-R600', oldValue: '12 周', newValue: '10 周', changeOrigin: 'KDH ← ERP 交期表 v2026.11', changedAt: '今天 09:30',
    impacts: [
      { contentId: 'C-1002', title: 'BL-R600 Product Brief', refMode: 'slot', contentStatus: '审核中' },
      { contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', refMode: 'slot', contentStatus: '已生效' },
      { contentId: 'C-1060', title: 'BL-R600 技术 FAQ · 官网与 AI 客服', refMode: 'slot', contentStatus: '草稿' },
      { contentId: 'C-1012', title: 'BL-R600 汉诺威展专题落地页', refMode: 'inline', contentStatus: '草稿' },
      { contentId: 'C-1062', title: 'BL-R600 销售话术卡', refMode: 'inline', contentStatus: '审核中' },
    ],
  },
  {
    changeId: 'FC-30', factId: 'F-005', attributeName: '最大工作半径', subjectName: 'BL-R600', oldValue: '1700 mm', newValue: '1720 mm', changeOrigin: 'KDH ← PIM 产品主数据', changedAt: '昨天 16:10',
    impacts: [
      { contentId: 'C-1002', title: 'BL-R600 Product Brief', refMode: 'slot', contentStatus: '审核中' },
      { contentId: 'C-0921', title: 'BL-R600 产品手册摘要（中文）', refMode: 'slot', contentStatus: '已生效' },
    ],
  },
];

const mockSubjectsData: SubjectNode[] = [
  { subjectId: 'S-BL', subjectName: '北岭智造', subjectKind: 'brand', depth: 0, factCount: 842 },
  { subjectId: 'S-R600', subjectName: 'BL-R600 六轴工业机器人', subjectKind: 'product', depth: 1, factCount: 46 },
  { subjectId: 'S-R600-STD', subjectName: '标准版', subjectKind: 'variant', depth: 2, factCount: 12 },
  { subjectId: 'S-R600-EX', subjectName: '防爆版', subjectKind: 'variant', depth: 2, factCount: 9 },
  { subjectId: 'S-D120', subjectName: 'BL-D120 工业除尘设备', subjectKind: 'product', depth: 1, factCount: 31 },
  { subjectId: 'S-HC', subjectName: '汉川传动', subjectKind: 'brand', depth: 0, factCount: 444 },
  { subjectId: 'S-RV200', subjectName: 'HC-RV200 精密减速机', subjectKind: 'product', depth: 1, factCount: 38 },
  { subjectId: 'S-SD75', subjectName: 'HC-SD75 伺服驱动器', subjectKind: 'product', depth: 1, factCount: 27 },
];

// PAGINATION: page,pageSize
const mockFactsData: FactRow[] = [
  { factId: 'F-001', subjectName: 'BL-R600', attributeName: '重复定位精度', attributeCategory: '规格', valueLabel: '±0.02 mm', evidenceGrade: 'A', evidenceSource: '出厂检测报告 BL-QR-2026-041', validFrom: '2026-01-01', validTo: '2027-12-31', scopeLabel: '全部区域', status: 'valid', inConflict: false, origin: 'kdh', syncStatus: 'synced', referencedCount: 14, visibility: 'public' },
  { factId: 'F-002', subjectName: 'BL-R600', attributeName: '防护等级', attributeCategory: '认证与检测', valueLabel: 'IP66', evidenceGrade: 'A', evidenceSource: 'TÜV 检测报告 TÜV-2026-1188', validFrom: '2026-03-01', validTo: '2028-02-28', scopeLabel: '欧盟', status: 'valid', inConflict: true, origin: 'doc_ocr', syncStatus: 'synced', referencedCount: 6, visibility: 'public' },
  { factId: 'F-003', subjectName: 'BL-R600', attributeName: '防护等级', attributeCategory: '认证与检测', valueLabel: 'IP65', evidenceGrade: 'B', evidenceSource: '产品手册（2024 版）第 4.2 节', validFrom: '2024-05-01', validTo: '2026-12-31', scopeLabel: '中国大陆 / 欧盟', status: 'valid', inConflict: true, origin: 'pim', syncStatus: 'synced', referencedCount: 3, visibility: 'public' },
  { factId: 'F-007', subjectName: 'BL-R600', attributeName: '标准交付周期', attributeCategory: '交付', valueLabel: '12 周', evidenceGrade: 'B', evidenceSource: '供应链季度公告 2026Q4（修订）', validFrom: '2026-11-19', validTo: '2027-02-28', scopeLabel: '中国大陆 / 欧盟', status: 'valid', inConflict: false, origin: 'erp', syncStatus: 'synced', referencedCount: 2, visibility: 'public' },
  { factId: 'F-012', subjectName: 'BL-R600', attributeName: '核心卖点', attributeCategory: '营销表述', valueLabel: '中空腕部，焊枪走线不缠绕', evidenceGrade: 'B', evidenceSource: '产品经理确认 2026-10', validFrom: '2026-10-10', validTo: '2027-10-10', scopeLabel: '全部区域', status: 'valid', inConflict: false, origin: 'cms', syncStatus: 'local_modified', referencedCount: 5, visibility: 'public' },
  { factId: 'F-014', subjectName: 'HC-SD75', attributeName: 'UL 认证', attributeCategory: '认证与检测', valueLabel: 'UL 61800-5-1', evidenceGrade: 'B', evidenceSource: 'UL 证书 E512340', validFrom: '2024-02-01', validTo: '2026-09-30', scopeLabel: '北美', status: 'expired', inConflict: false, origin: 'kdh', syncStatus: 'synced', referencedCount: 2, visibility: 'public' },
  { factId: 'F-031', subjectName: 'HC-RV200', attributeName: '额定扭矩', attributeCategory: '规格', valueLabel: '1200 N·m', evidenceGrade: 'A', evidenceSource: '型式试验报告 HC-TR-2025-088', validFrom: '2025-07-01', validTo: '2028-01-01', scopeLabel: '全部区域', status: 'valid', inConflict: false, origin: 'doc_ocr', syncStatus: 'synced', referencedCount: 1, visibility: 'public' },
  { factId: 'F-032', subjectName: 'HC-RV200', attributeName: '背隙', attributeCategory: '规格', valueLabel: '≤ 1 arcmin', evidenceGrade: 'B', evidenceSource: 'OCR 候选：型式试验报告 HC-TR-2025-088 第 6 页', validFrom: '2025-07-01', validTo: '2028-01-01', scopeLabel: '全部区域', status: 'pending', inConflict: false, origin: 'doc_ocr', syncStatus: 'local_only', referencedCount: 0, visibility: 'internal' },
  { factId: 'F-006', subjectName: 'BL-R600', attributeName: 'CE 认证', attributeCategory: '认证与检测', valueLabel: '机械指令 2006/42/EC', evidenceGrade: 'C', evidenceSource: '企业自我声明', validFrom: '2026-04-01', validTo: '2028-03-31', scopeLabel: '欧盟', status: 'valid', inConflict: false, origin: 'cms', syncStatus: 'sync_failed', referencedCount: 1, visibility: 'internal' },
];

const mockFactDetailData: FactDetail = {
  factId: 'F-002',
  subjectName: 'BL-R600 六轴工业机器人',
  attributeName: '防护等级',
  valueLabel: 'IP66',
  scopeDimensions: [
    { dimension: '型号', value: '标准版' },
    { dimension: '区域', value: '欧盟' },
    { dimension: '测试标准', value: 'IEC 60529' },
  ],
  evidenceGrade: 'A',
  evidenceAssetName: 'TUV-2026-1188-report.pdf',
  evidenceAssetId: 'A-1987',
  validFrom: '2026-03-01',
  validTo: '2028-02-28',
  ownerName: '王拓',
  sourceTrace: { sourceSystem: '资产库 OCR → 中台确认', externalId: 'KDH-FACT-88213', externalVersion: 'v2', lastSyncedAt: '2026-11-18 18:40', syncStatus: 'synced', syncDirection: '以知识库为准（认证与检测类）' },
  references: [
    { contentId: 'C-1002', title: 'BL-R600 Product Brief', version: 3, refMode: 'inline', contentStatus: '审核中' },
    { contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', version: 2, refMode: 'slot', contentStatus: '已生效' },
    { contentId: 'C-1015', title: 'BL-R600 FAQ: IP rating', version: 1, refMode: 'inline', contentStatus: '草稿' },
  ],
  history: [
    { version: 2, valueLabel: 'IP66', changedBy: '王拓', changeOrigin: '中台（OCR 候选确认）', changedAt: '2026-03-02 10:20' },
    { version: 1, valueLabel: 'IP65', changedBy: '系统', changeOrigin: 'KDH（来自 PIM）', changedAt: '2024-05-01 00:00' },
  ],
};

// 原型：详情接口只给了 F-002 一份样例，其余行用列表字段拼出详情，保证点哪行看哪行
const F007_HISTORY: FactDetail['history'] = [
  { version: 3, valueLabel: '12 周', changedBy: '王拓', changeOrigin: '处理冲突 CF-021（采纳知识库值）', changedAt: '2026-11-19 08:30' },
  { version: 2, valueLabel: '8 周', changedBy: 'Sophie Wei', changeOrigin: '中台修改（已被替代）', changedAt: '2026-11-19 07:20' },
  { version: 1, valueLabel: '10 周', changedBy: 'ERP 同步', changeOrigin: '知识库', changedAt: '2026-08-01 06:00' },
];
const REFS_BY_FACT: Record<string, FactDetail['references']> = {
  'F-007': [
    { contentId: 'C-1002', title: 'BL-R600 Product Brief', version: 3, refMode: 'slot', contentStatus: '审核中（参数表已自动刷新）' },
    { contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', version: 2, refMode: 'inline', contentStatus: '已生效 · 复核中 RC-310' },
  ],
  'F-014': [{ contentId: 'C-0877', title: 'HC-SD75 Servo Drive Datasheet', version: 3, refMode: 'slot', contentStatus: '已生效 · 复核中 RC-312' }],
};
function factDetailOf(row: FactRow | undefined): FactDetail {
  if (!row || row.factId === mockFactDetailData.factId) return mockFactDetailData;
  return {
    factId: row.factId,
    subjectName: row.subjectName,
    attributeName: row.attributeName,
    valueLabel: row.valueLabel,
    scopeDimensions: [{ dimension: '区域', value: row.scopeLabel }],
    evidenceGrade: row.evidenceGrade,
    evidenceAssetName: row.evidenceSource,
    evidenceAssetId: '—',
    validFrom: row.validFrom,
    validTo: row.validTo,
    ownerName: '王拓',
    sourceTrace: { ...mockFactDetailData.sourceTrace, sourceSystem: ORIGIN_LABEL[row.origin], syncStatus: row.syncStatus },
    references: REFS_BY_FACT[row.factId] ?? (row.subjectName === 'BL-R600' ? mockFactDetailData.references.slice(0, Math.min(row.referencedCount, 3)) : []),
    history: row.factId === 'F-007' ? F007_HISTORY : [{ version: 1, valueLabel: row.valueLabel, changedBy: '系统', changeOrigin: ORIGIN_LABEL[row.origin], changedAt: row.validFrom }],
  };
}

// 属性定义来自 KDH 统一事实模型（CMS 只读）
const mockAttributeDefinitionsData: AttributeDefinition[] = [
  { attributeKey: 'payload', attributeName: '额定负载', category: '规格参数', unit: 'kg', scopeDimensions: ['型号'], authoritySource: 'PIM', redLine: false },
  { attributeKey: 'ip_rating', attributeName: '防护等级', category: '认证与检测', unit: null, scopeDimensions: ['型号', '测试标准'], authoritySource: '检测报告 / 证书', redLine: false },
  { attributeKey: 'lead_time', attributeName: '标准交付周期', category: '交付与产能', unit: '周', scopeDimensions: ['区域'], authoritySource: 'ERP', redLine: true },
  { attributeKey: 'guide_price', attributeName: '指导价', category: '价格与商务', unit: '元', scopeDimensions: ['区域', '渠道'], authoritySource: 'CRM / 报价系统', redLine: true },
  { attributeKey: 'key_message', attributeName: '核心卖点', category: '营销表述', unit: null, scopeDimensions: ['区域'], authoritySource: 'CMS（品牌管理员）', redLine: false },
];

const mockConflictPrecheckData: ConflictPrecheck = {
  hasConflict: true,
  conflictingFactId: 'F-002',
  conflictingValue: 'IP66',
  conflictingSource: 'TÜV 检测报告 TÜV-2026-1188（A 级）',
  suggestion: '若适用于不同型号或测试标准，请在「适用范围」中补充区分维度，可避免冲突。',
};

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取事实列表 [GET] /api/v1/facts
function handleFetchFacts(params: { subjectId: string; status: string; syncStatus: string; evidenceGrade: string; keyword: string; page: number; pageSize: number }) {
  console.log('fetch facts', params);
}

// ACTION: 获取 KDH 属性定义 [GET] /api/v1/kdh/attribute-definitions
function handleFetchAttributeDefinitions() {
  console.log('fetch attribute definitions');
}

// ACTION: 获取事实详情 [GET] /api/v1/facts/{id}
function handleFetchFactDetail(factId: string) {
  console.log('fetch fact detail', factId);
}

// ACTION: 新建事实前冲突预检 [POST] /api/v1/facts/precheck
function handlePrecheckFact(form: { subjectId: string; attributeName: string; value: string; unit: string; region: string; variant: string }) {
  console.log('precheck', form);
}

// ACTION: 新建事实 [POST] /api/v1/facts
function handleCreateFact(form: { subjectId: string; attributeName: string; value: string; unit: string; evidenceGrade: string; validTo: string; region: string; variant: string }) {
  console.log('create fact', form);
}

// ACTION: 立即同步到知识库 [POST] /api/v1/facts/{id}/sync
function handleSyncFact(factId: string) {
  alert(`已重新推送 ${factId} 到知识库`);
}

// ACTION: 获取事实变更及影响内容 [GET] /api/v1/facts/changes
function handleFetchFactChanges(params: { days: number }) {
  console.log('fetch fact changes', params);
}

// ACTION: 处理事实变更影响 [POST] /api/v1/facts/changes/{id}/apply
function handleApplyFactChange(changeId: string, req: { refreshSlots: boolean; createRecheckTasks: boolean }) {
  console.log('apply fact change', changeId, req);
}

// ACTION: 导出事实清单 [GET] /api/v1/facts/export
function handleExportFacts(params: { subjectId: string; status: string }) {
  console.log('export facts', params);
}

// ── 主组件 ────────────────────────────────────────────────
export default function FactLibrary() {
  const [facts, setFacts] = useState(mockFactsData);
  const navigate = useNavigate();
  const [subjectId, setSubjectId] = useState('S-R600');
  const [status, setStatus] = useState('all');
  const [syncStatus, setSyncStatus] = useState('all');
  const [evidence, setEvidence] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState('F-002');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: 'S-R600', attributeName: '防护等级', value: 'IP65', unit: 'none', evidenceGrade: 'B', validTo: '2027-12-31', region: '欧盟', variant: '' });
  const [prechecked, setPrechecked] = useState(false);
  const [attrOpen, setAttrOpen] = useState(false);
  const [appliedChanges, setAppliedChanges] = useState<string[]>([]);
  const originCount = (o: FactOrigin[]) => facts.filter((f) => o.includes(f.origin)).length;
  const refTotal = facts.reduce((n, f) => n + f.referencedCount, 0);

  const query = { subjectId, status, syncStatus, evidenceGrade: evidence, keyword, page: 1, pageSize: 50 };
  // 冲突裁定的结果进入事实库：取值更新、冲突标记清除；回写 KDH 审批通过前显示「本地已修改」
  const { state: demo } = useDemo();
  const syncOf = (conflictId: string): SyncStatus => (approvalOf(demo, 'fact', conflictId)?.status === 'approved' ? 'synced' : 'local_modified');
  const cf018 = demo.conflicts['CF-018'];
  const shownFacts: FactRow[] = facts.map((f) => {
    if (cf018 && (f.factId === 'F-002' || f.factId === 'F-003')) {
      if (cf018.action === 'split_scope') return { ...f, inConflict: false, scopeLabel: f.factId === 'F-002' ? '欧盟 · 标准版' : '旧款', syncStatus: syncOf('CF-018') };
      if (cf018.action === 'adopt') return f.valueLabel === cf018.adoptedValue ? { ...f, inConflict: false, syncStatus: syncOf('CF-018') } : { ...f, inConflict: false, status: 'superseded' };
    }
    const d = demo.discovered.find((x) => x.localFactId === f.factId);
    if (d) {
      const r = demo.conflicts[d.conflictId];
      if (!r) return { ...f, inConflict: true };
      if (r.adoptedValue) return { ...f, valueLabel: r.adoptedValue, evidenceSource: r.adoptedValue === d.externalValue ? `${d.externalSource}（冲突 ${d.conflictId} 裁定）` : f.evidenceSource, inConflict: false, syncStatus: r.adoptedValue === d.externalValue ? syncOf(d.conflictId) : f.syncStatus };
    }
    return f;
  });
  const rows = shownFacts.filter(
    (f) =>
      (status === 'all' || f.status === status) &&
      (syncStatus === 'all' || f.syncStatus === syncStatus) &&
      (evidence === 'all' || f.evidenceGrade === evidence) &&
      (!keyword || f.attributeName.includes(keyword) || f.valueLabel.includes(keyword) || f.factId.includes(keyword)),
  );
  const conflictCount = new Set(shownFacts.filter((f) => f.inConflict).map((f) => f.attributeName)).size;
  const d = factDetailOf(facts.find((f) => f.factId === detailId));

  const filter = (items: { value: string; label: string }[], value: string, set: (v: string) => void, key: 'status' | 'syncStatus' | 'evidenceGrade') => (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => {
        set(v as string);
        handleFetchFacts({ ...query, [key]: v as string });
      }}
    >
      <SelectTrigger className="w-36">
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
        title="事实库"
        description="内容生产引用的事实。它从 KDH 来，在生产时被选为引用、以插槽写进内容；KDH 更新后，按引用方式刷新内容或生成复核。每条事实带证据等级、有效期、适用范围与来源追踪。"
        actions={
          <>
            <Button variant="outline" onClick={() => { setAttrOpen(true); handleFetchAttributeDefinitions(); }}>
              <BookOpen /> 属性定义（KDH）
            </Button>
            <Button variant="outline" onClick={() => handleExportFacts({ subjectId, status })}>
              <Download /> 导出
            </Button>
            <Button onClick={() => { setCreateOpen(true); setPrechecked(false); }}>
              <Plus /> 录入事实
            </Button>
          </>
        }
      />

      {conflictCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>{conflictCount} 组冲突待处理</AlertTitle>
          <AlertDescription>冲突中的事实不能用于对外发布；引用它们的内容无法通过发布检查。</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => navigate('/facts/conflicts')}>
              去处理
            </Button>
          </AlertAction>
        </Alert>
      )}

      {/* 事实在内容生产中的位置：怎么来 → 怎么用 → 怎么更新 */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileInput className="size-4 text-muted-foreground" /> 1 · 怎么来
            </CardTitle>
            <CardDescription>权威来源是 KDH，CMS 不自行编写；按上游接入的配置两种方式进入</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="text-xs"><span className="font-medium">全量导入</span>：在售产品的授权事实按范围定时同步</div>
            <div className="text-xs"><span className="font-medium">用到才存</span>：其他产品线不预先拉取，生产时从 KDH 检索，被引用才入库</div>
            <div className="flex justify-between"><span>KDH 同步（含 PIM / ERP 经 KDH）</span><span className="tabular-nums">{originCount(['kdh', 'pim', 'erp'])}</span></div>
            <div className="flex justify-between"><span>文档解析候选（待 KDH 确认）</span><span className="tabular-nums">{originCount(['doc_ocr'])}</span></div>
            <div className="flex justify-between"><span>中台录入（回写 KDH）</span><span className="tabular-nums">{originCount(['cms'])}</span></div>
            <div className="pt-1 text-xs text-muted-foreground">选题发现的事实缺口，向 KDH 发起补录后进入这里。</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <PenLine className="size-4 text-muted-foreground" /> 2 · 怎么用
            </CardTitle>
            <CardDescription>生产时被选为引用，以插槽写入内容</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div>AI 生成 / 编辑器里选事实 → 正文或参数表中插入<span className="mx-1 rounded bg-teal-50 px-1 text-teal-800 dark:bg-teal-950 dark:text-teal-200">事实插槽</span>，取值不手打</div>
            <div>发布检查校验：有效期、证据等级、适用范围、是否冲突</div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>当前列表中的事实共被引用</span><span className="tabular-nums">{refTotal} 次</span></div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <RefreshCw className="size-4 text-muted-foreground" /> 3 · 怎么更新
            </CardTitle>
            <CardDescription>KDH 变更同步过来后，按引用方式影响内容</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div><span className="font-medium">插槽引用</span>：取值自动刷新，生效内容走简审后发新版</div>
            <div><span className="font-medium">正文写死</span>：标记待复核，生成复核任务给负责人</div>
            <div><span className="font-medium">取值冲突</span>：全量导入的在同步时发现，用到才存的在引用时比对发现；都进入冲突处理，处理前不能用于对外内容</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>事实更新影响</CardTitle>
          <CardDescription>近 7 天从 KDH 同步来的取值变更，以及引用它们的内容。处理后，插槽引用的内容取到新值，正文写死的进入复核。</CardDescription>
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => handleFetchFactChanges({ days: 7 })}>
              <RefreshCw /> 刷新
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockFactChangesData.map((c) => {
            const done = appliedChanges.includes(c.changeId);
            const slots = c.impacts.filter((i) => i.refMode === 'slot');
            const inline = c.impacts.filter((i) => i.refMode === 'inline');
            return (
              <div key={c.changeId} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{c.subjectName} · {c.attributeName}</span>
                  <span className="text-muted-foreground line-through">{c.oldValue}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <span className="font-medium text-teal-700">{c.newValue}</span>
                  <span className="text-xs text-muted-foreground">{c.factId} · {c.changeOrigin} · {c.changedAt}</span>
                  <div className="ml-auto">
                    {done ? (
                      <ToneBadge tone="green">已处理</ToneBadge>
                    ) : (
                      <Button
                        size="xs"
                        onClick={() => {
                          handleApplyFactChange(c.changeId, { refreshSlots: true, createRecheckTasks: inline.length > 0 });
                          setAppliedChanges((p) => [...p, c.changeId]);
                          notify(`${c.factId} 已更新为 ${c.newValue}：${slots.length} 篇插槽引用已刷新${inline.length ? `，${inline.length} 篇正文写死的已生成复核任务` : ''}`);
                        }}
                      >
                        刷新插槽{inline.length > 0 && ' · 生成复核任务'}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {c.impacts.map((i) => (
                    <button key={i.contentId} onClick={() => navigate(`/content/edit/${i.contentId}`)} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-left text-xs hover:bg-muted">
                      <span className="min-w-0 truncate">
                        <span className="text-muted-foreground">{i.contentId}</span> {i.title}
                      </span>
                      {done ? (
                        <ToneBadge tone={i.refMode === 'slot' ? 'green' : 'violet'}>{i.refMode === 'slot' ? '已刷新' : '待复核'}</ToneBadge>
                      ) : (
                        <ToneBadge tone={i.refMode === 'slot' ? 'teal' : 'amber'}>{i.refMode === 'slot' ? '插槽' : '正文写死'}</ToneBadge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <Card size="sm" className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">对象</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5 text-sm">
            {mockSubjectsData.map((s) => (
              <button
                key={s.subjectId}
                onClick={() => {
                  setSubjectId(s.subjectId);
                  handleFetchFacts({ ...query, subjectId: s.subjectId });
                }}
                style={{ paddingLeft: 8 + s.depth * 14 }}
                className={cn('flex w-full items-center justify-between rounded-md py-1.5 pr-2 text-left hover:bg-muted', subjectId === s.subjectId && 'bg-muted font-medium', s.depth === 0 && 'font-medium')}
              >
                <span className="truncate">{s.subjectName}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{s.factCount}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="属性、取值或编号" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFetchFacts(query)} />
              </div>
              {filter(STATUS_OPTIONS, status, setStatus, 'status')}
              {filter(SYNC_OPTIONS, syncStatus, setSyncStatus, 'syncStatus')}
              {filter(EVIDENCE_OPTIONS, evidence, setEvidence, 'evidenceGrade')}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>对象 / 属性</TableHead>
                  <TableHead>取值</TableHead>
                  <TableHead>证据</TableHead>
                  <TableHead>有效期</TableHead>
                  <TableHead>适用范围</TableHead>
                  <TableHead>可见级别</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>来源 / 同步</TableHead>
                  <TableHead className="text-right">被引用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((f) => (
                  <TableRow
                    key={f.factId}
                    className={cn('cursor-pointer', f.inConflict && 'bg-red-50/50 dark:bg-red-950/20')}
                    onClick={() => {
                      handleFetchFactDetail(f.factId);
                      setDetailId(f.factId);
                      setDetailOpen(true);
                    }}
                  >
                    <TableCell>
                      <div className="font-medium">{f.attributeName}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.factId} · {f.subjectName} · {f.attributeCategory}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{f.valueLabel}</TableCell>
                    <TableCell>
                      <EvidenceBadge grade={f.evidenceGrade} />
                      <div className="max-w-40 truncate text-xs text-muted-foreground">{f.evidenceSource}</div>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {f.validFrom}
                      <br />至 {f.validTo}
                    </TableCell>
                    <TableCell className="text-xs">{f.scopeLabel}</TableCell>
                    <TableCell>
                      <ToneBadge tone={VISIBILITY_CONFIG[f.visibility].tone}>{VISIBILITY_CONFIG[f.visibility].label}</ToneBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <ToneBadge tone={FACT_STATUS_CONFIG[f.status].tone}>{FACT_STATUS_CONFIG[f.status].label}</ToneBadge>
                        {f.inConflict && <ToneBadge tone="red">冲突中</ToneBadge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">{ORIGIN_LABEL[f.origin]}</div>
                      <SyncBadge status={f.syncStatus} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{f.referencedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-sm text-muted-foreground">共 {rows.length} 条 · 对外内容只能引用：证据 A/B + 可见级别“公开” + 有效 + 无冲突。可见级别与属性定义来自 KDH，CMS 只读</div>
          </CardContent>
        </Card>
      </div>

      {/* KDH 属性定义（只读） */}
      <Dialog open={attrOpen} onOpenChange={setAttrOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>属性定义 · 来自 KDH 统一事实模型</DialogTitle>
            <DialogDescription>CMS 不另建事实模型：属性、单位、区分维度、权威来源、红线标记都由 KDH 维护，这里只读。内容模型的事实插槽直接绑定这些属性。</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>属性</TableHead>
                <TableHead>类别</TableHead>
                <TableHead>单位</TableHead>
                <TableHead>区分维度</TableHead>
                <TableHead>权威来源</TableHead>
                <TableHead>红线</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAttributeDefinitionsData.map((a) => (
                <TableRow key={a.attributeKey}>
                  <TableCell>
                    <div className="font-medium">{a.attributeName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{a.attributeKey}</div>
                  </TableCell>
                  <TableCell className="text-sm">{a.category}</TableCell>
                  <TableCell className="text-sm">{a.unit ?? '—'}</TableCell>
                  <TableCell className="text-xs">{a.scopeDimensions.join('、')}</TableCell>
                  <TableCell className="text-sm">{a.authoritySource}</TableCell>
                  <TableCell>{a.redLine ? <ToneBadge tone="red">人工确认</ToneBadge> : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* 事实详情 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {d.attributeName}：{d.valueLabel}
            </SheetTitle>
            <SheetDescription>
              {d.factId} · {d.subjectName} · 负责人 {d.ownerName}
            </SheetDescription>
          </SheetHeader>
          <Tabs defaultValue="value" className="px-4 pb-6">
            <TabsList>
              <TabsTrigger value="value">取值与范围</TabsTrigger>
              <TabsTrigger value="refs">被引用 {d.references.length}</TabsTrigger>
              <TabsTrigger value="sync">同步</TabsTrigger>
              <TabsTrigger value="history">变更历史</TabsTrigger>
            </TabsList>
            <TabsContent value="value" className="space-y-4 pt-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">证据</div>
                  <div className="flex items-center gap-2">
                    <EvidenceBadge grade={d.evidenceGrade} /> {d.evidenceAssetName}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">有效期</div>
                  {d.validFrom} 至 {d.validTo}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">适用范围（区分维度，用于排除假冲突）</div>
                <div className="flex flex-wrap gap-1">
                  {d.scopeDimensions.map((s) => (
                    <ToneBadge key={s.dimension} tone="blue">
                      {s.dimension}：{s.value}
                    </ToneBadge>
                  ))}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/assets')}>
                查看证据原件 {d.evidenceAssetId}
              </Button>
            </TabsContent>
            <TabsContent value="refs" className="pt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容</TableHead>
                    <TableHead>引用方式</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.references.map((r) => (
                    <TableRow key={r.contentId} className="cursor-pointer" onClick={() => navigate(`/content/edit/${r.contentId}`)}>
                      <TableCell>
                        {r.title}
                        <div className="text-xs text-muted-foreground">
                          {r.contentId} · v{r.version}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={r.refMode === 'slot' ? 'teal' : 'violet'}>{r.refMode === 'slot' ? '插槽 · 自动刷新' : '正文 · 需复核'}</ToneBadge>
                      </TableCell>
                      <TableCell className="text-xs">{r.contentStatus}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="sync" className="space-y-2 pt-2 text-sm">
              {[
                ['来源', d.sourceTrace.sourceSystem],
                ['知识库 ID', d.sourceTrace.externalId],
                ['知识库版本', d.sourceTrace.externalVersion],
                ['最近同步', d.sourceTrace.lastSyncedAt],
                ['同步方向', d.sourceTrace.syncDirection],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b py-1.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <SyncBadge status={d.sourceTrace.syncStatus} />
                <Button size="sm" variant="outline" onClick={() => handleSyncFact(d.factId)}>
                  <UploadCloud /> 立即同步
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="history" className="pt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>版本</TableHead>
                    <TableHead>取值</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.history.map((h) => (
                    <TableRow key={h.version}>
                      <TableCell>v{h.version}</TableCell>
                      <TableCell className="font-medium">{h.valueLabel}</TableCell>
                      <TableCell className="text-xs">
                        {h.changedBy} · {h.changeOrigin}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.changedAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* 录入事实 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>录入事实</DialogTitle>
            <DialogDescription>保存后推送到知识库。保存前会检测与已有事实是否冲突。</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>对象</Label>
              <Input value="BL-R600 六轴工业机器人" readOnly />
            </div>
            <div className="space-y-1.5">
              <Label>属性</Label>
              <Input value={form.attributeName} onChange={(e) => setForm({ ...form, attributeName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>取值</Label>
              <div className="flex gap-2">
                <Input value={form.value} onChange={(e) => { setForm({ ...form, value: e.target.value }); setPrechecked(false); }} />
                <Select items={UNIT_OPTIONS} value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v as string })}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>证据等级</Label>
              <Select items={EVIDENCE_OPTIONS.slice(1)} value={form.evidenceGrade} onValueChange={(v) => setForm({ ...form, evidenceGrade: v as string })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVIDENCE_OPTIONS.slice(1).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>有效期至</Label>
              <Input type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>适用区域</Label>
              <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>适用型号（可选）</Label>
              <Input placeholder="如：防爆版" value={form.variant} onChange={(e) => { setForm({ ...form, variant: e.target.value }); setPrechecked(false); }} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>证据原件</Label>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate('/assets')}>
                从资产库选择（检测报告、证书、手册）
              </Button>
            </div>
          </div>
          {prechecked && mockConflictPrecheckData.hasConflict && !form.variant && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>
                与 {mockConflictPrecheckData.conflictingFactId}（{mockConflictPrecheckData.conflictingValue}）冲突
              </AlertTitle>
              <AlertDescription>
                来源：{mockConflictPrecheckData.conflictingSource}。{mockConflictPrecheckData.suggestion}
              </AlertDescription>
            </Alert>
          )}
          {prechecked && form.variant && (
            <Alert>
              <AlertTitle>未发现冲突</AlertTitle>
              <AlertDescription>已按型号「{form.variant}」区分适用范围。</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                handlePrecheckFact({ subjectId: form.subjectId, attributeName: form.attributeName, value: form.value, unit: form.unit, region: form.region, variant: form.variant });
                setPrechecked(true);
              }}
            >
              冲突预检
            </Button>
            <Button
              disabled={!prechecked}
              onClick={() => {
                handleCreateFact(form);
                const id = `F-${String(40 + facts.length).padStart(3, '0')}`;
                const subj = mockSubjectsData.find((x) => x.subjectId === form.subjectId)?.subjectName ?? 'BL-R600';
                const conflict = mockConflictPrecheckData.hasConflict && !form.variant;
                setFacts((prev) => [{ factId: id, subjectName: subj.split(' ')[0], attributeName: form.attributeName, attributeCategory: '认证与检测', valueLabel: form.value, evidenceGrade: form.evidenceGrade as EvidenceGrade, evidenceSource: '中台录入', validFrom: '2026-11-20', validTo: form.validTo, scopeLabel: form.variant ? `${form.region} · ${form.variant}` : form.region, status: 'pending', inConflict: conflict, origin: 'cms', syncStatus: 'local_modified', referencedCount: 0, visibility: 'internal' }, ...prev]);
                notify(conflict ? `${id} 已保存并推送 KDH（待确认），与 F-002 冲突，已进入冲突处理` : `${id} 已保存并推送 KDH，确认前不能用于对外内容`);
                setCreateOpen(false);
              }}
            >
              {prechecked && mockConflictPrecheckData.hasConflict && !form.variant ? '仍然保存（进入冲突处理）' : '保存并同步'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
