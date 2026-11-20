import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FilePlus2, RotateCcw, Search, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { AiMark, ContentStatusBadge, ToneBadge, type ContentStatus, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';
import { useDemo, type SourceKind } from '@/lib/demo-store';
import { SOURCE_CONFIG } from '@/lib/content-source';

// ── 配置常量 ──────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'in_review', label: '审核中' },
  { value: 'published', label: '已生效' },
  { value: 'unpublished', label: '已下线' },
];
const BRAND_OPTIONS = [
  { value: 'all', label: '全部品牌' },
  { value: 'beiling', label: '北岭智造' },
  { value: 'hanchuan', label: '汉川传动' },
];
const FLAG_OPTIONS = [
  { value: 'all', label: '全部标记' },
  { value: 'recheck', label: '待复核' },
  { value: 'check_failed', label: '检查未通过' },
  { value: 'ai', label: '含 AI 生成' },
];
const SOURCE_OPTIONS = [{ value: 'all', label: '全部来源' }, ...(Object.keys(SOURCE_CONFIG) as SourceKind[]).map((k) => ({ value: k, label: SOURCE_CONFIG[k].label }))];
const LOCALE_TONE: Record<ContentStatus | 'missing', Tone> = {
  draft: 'gray',
  in_review: 'blue',
  published: 'green',
  unpublished: 'amber',
  missing: 'red',
};

interface LocaleVariant {
  locale: 'zh-CN' | 'en-US' | 'de-DE';
  status: ContentStatus | 'missing';
}
interface ContentRow {
  contentId: string;
  title: string;
  contentTypeId: string;
  contentTypeName: string;
  brandName: string;
  regionLabel: string;
  status: ContentStatus;
  version: number;
  locales: LocaleVariant[];
  factRefCount: number;
  aiGenerated: boolean;
  sourceKind: SourceKind;
  sourceDetail: string;
  needsRecheck: boolean;
  checkFailed: boolean;
  healthScore: number;
  ownerName: string;
  updatedAt: string;
}
interface ContentTypeOption {
  contentTypeId: string;
  name: string;
  kind: 'collection' | 'singleton' | 'table';
  entryCount: number;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockContentTypesData: ContentTypeOption[] = [
  { contentTypeId: 'product_brief', name: '产品说明', kind: 'collection', entryCount: 48 },
  { contentTypeId: 'tech_faq', name: '技术 FAQ', kind: 'collection', entryCount: 96 },
  { contentTypeId: 'case_study', name: '客户案例', kind: 'collection', entryCount: 22 },
  { contentTypeId: 'landing_page', name: '落地页', kind: 'collection', entryCount: 14 },
  { contentTypeId: 'white_paper', name: '白皮书', kind: 'collection', entryCount: 8 },
  { contentTypeId: 'sales_kit', name: '销售资料', kind: 'collection', entryCount: 12 },
  { contentTypeId: 'social_post', name: '社媒短帖', kind: 'collection', entryCount: 18 },
  { contentTypeId: 'wechat_article', name: '公众号文章', kind: 'collection', entryCount: 9 },
  { contentTypeId: 'sales_card', name: '销售话术卡', kind: 'collection', entryCount: 10 },
  { contentTypeId: 'brand_profile', name: '品牌信息', kind: 'singleton', entryCount: 2 },
  { contentTypeId: 'product_catalog', name: '产品目录', kind: 'table', entryCount: 96 },
  { contentTypeId: 'partner_directory', name: '伙伴名录', kind: 'table', entryCount: 214 },
  { contentTypeId: 'resource_library', name: '资源库', kind: 'table', entryCount: 138 },
];

// PAGINATION: page,pageSize
const mockContentsData: ContentRow[] = [
  { contentId: 'C-1002', title: 'BL-R600 Product Brief', contentTypeId: 'product_brief', contentTypeName: '产品说明', brandName: '北岭智造', regionLabel: '欧盟', status: 'in_review', version: 3, locales: [{ locale: 'en-US', status: 'in_review' }, { locale: 'de-DE', status: 'missing' }], factRefCount: 7, aiGenerated: true, sourceKind: 'ai_generate', sourceDetail: '选题 TP-35 · 模板 TPL-01', needsRecheck: false, checkFailed: true, healthScore: 72, ownerName: '林悦', updatedAt: '2026-11-19 08:12' },
  { contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', contentTypeId: 'sales_kit', contentTypeName: '销售资料', brandName: '北岭智造', regionLabel: '欧盟', status: 'published', version: 2, locales: [{ locale: 'en-US', status: 'published' }, { locale: 'de-DE', status: 'published' }], factRefCount: 5, aiGenerated: false, sourceKind: 'manual', sourceDetail: '林悦新建', needsRecheck: true, checkFailed: false, healthScore: 81, ownerName: '林悦', updatedAt: '2026-11-12 15:04' },
  { contentId: 'C-1004', title: 'HC-RV200 精密减速机产品说明', contentTypeId: 'product_brief', contentTypeName: '产品说明', brandName: '汉川传动', regionLabel: '中国大陆', status: 'published', version: 2, locales: [{ locale: 'zh-CN', status: 'published' }, { locale: 'en-US', status: 'draft' }], factRefCount: 6, aiGenerated: false, sourceKind: 'import', sourceDetail: '纳管自外部内容 EX-204（旧官网）· 2026-06', needsRecheck: false, checkFailed: false, healthScore: 92, ownerName: '赵启', updatedAt: '2026-11-19 09:12' },
  { contentId: 'C-1005', title: 'HC-SD75 伺服驱动器技术 FAQ', contentTypeId: 'tech_faq', contentTypeName: '技术 FAQ', brandName: '汉川传动', regionLabel: '中国大陆', status: 'draft', version: 1, locales: [{ locale: 'zh-CN', status: 'draft' }], factRefCount: 3, aiGenerated: true, sourceKind: 'ai_generate', sourceDetail: '选题 TP-33 · 未用模板', needsRecheck: false, checkFailed: true, healthScore: 58, ownerName: '林悦', updatedAt: '2026-11-18 17:40' },
  { contentId: 'C-1006', title: 'BL-D120 Industrie-Entstaubungsanlage', contentTypeId: 'product_brief', contentTypeName: '产品说明', brandName: '北岭智造', regionLabel: '欧盟', status: 'unpublished', version: 1, locales: [{ locale: 'de-DE', status: 'unpublished' }, { locale: 'en-US', status: 'missing' }], factRefCount: 2, aiGenerated: false, sourceKind: 'translation', sourceDetail: '源 C-0930 zh-CN', needsRecheck: false, checkFailed: false, healthScore: 64, ownerName: '周敏', updatedAt: '2026-10-28 09:15' },
  { contentId: 'C-1009', title: '汽车焊装线改造：BL-R600 客户案例', contentTypeId: 'case_study', contentTypeName: '客户案例', brandName: '北岭智造', regionLabel: '东南亚', status: 'published', version: 4, locales: [{ locale: 'en-US', status: 'published' }, { locale: 'zh-CN', status: 'published' }], factRefCount: 4, aiGenerated: true, sourceKind: 'ai_generate', sourceDetail: '选题 TP-29 · 模板 TPL-05', needsRecheck: true, checkFailed: false, healthScore: 77, ownerName: 'Sophie Wei', updatedAt: '2026-11-15 11:30' },
  { contentId: 'C-1060', title: 'BL-R600 技术 FAQ · 官网与 AI 客服', contentTypeId: 'tech_faq', contentTypeName: '技术 FAQ', brandName: '北岭智造', regionLabel: '中国大陆', status: 'draft', version: 1, locales: [{ locale: 'zh-CN', status: 'draft' }], factRefCount: 5, aiGenerated: true, sourceKind: 'repurpose', sourceDetail: '源 C-0921 v4 · RF-01', needsRecheck: false, checkFailed: false, healthScore: 80, ownerName: '林悦', updatedAt: '2026-11-19 11:20' },
  { contentId: 'C-1062', title: 'BL-R600 销售话术卡', contentTypeId: 'sales_card', contentTypeName: '销售话术卡', brandName: '北岭智造', regionLabel: '中国大陆', status: 'in_review', version: 1, locales: [{ locale: 'zh-CN', status: 'in_review' }], factRefCount: 5, aiGenerated: true, sourceKind: 'repurpose', sourceDetail: '源 C-0921 v4 · RF-07', needsRecheck: false, checkFailed: false, healthScore: 83, ownerName: '林悦', updatedAt: '2026-11-19 11:24' },
  { contentId: 'C-1012', title: 'BL-R600 汉诺威展专题落地页', contentTypeId: 'landing_page', contentTypeName: '落地页', brandName: '北岭智造', regionLabel: '欧盟', status: 'draft', version: 1, locales: [{ locale: 'en-US', status: 'draft' }, { locale: 'de-DE', status: 'draft' }], factRefCount: 9, aiGenerated: true, sourceKind: 'repurpose', sourceDetail: '源 C-1002 v2 · RF-02 活动落地页', needsRecheck: false, checkFailed: false, healthScore: 85, ownerName: '林悦', updatedAt: '2026-11-19 10:02' },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取内容列表 [GET] /api/v1/contents
function handleFetchContents(params: {
  contentTypeId: string | 'all';
  status: string;
  source: string;
  brand: string;
  flag: string;
  keyword: string;
  page: number;
  pageSize: number;
}) {
  console.log('fetch contents', params);
}

// ACTION: 批量送审 [POST] /api/v1/contents/batch-submit
function handleBatchSubmitReview(contentIds: string[]) {
  alert(`已提交送审：${contentIds.join(', ')}`);
}

// ACTION: 批量下线 [PATCH] /api/v1/contents/batch-unpublish
function handleBatchUnpublish(contentIds: string[]) {
  alert(`已下线：${contentIds.join(', ')}`);
}

// ACTION: 导出内容清单 [GET] /api/v1/contents/export
function handleExportContents(params: { contentTypeId: string; status: string; brand: string }) {
  console.log('export contents', params);
}

// ── 主组件 ────────────────────────────────────────────────
export default function ContentList() {
  const navigate = useNavigate();
  const [typeId, setTypeId] = useState<string>('all');
  const [status, setStatus] = useState('all');
  const [brand, setBrand] = useState('all');
  const [flag, setFlag] = useState('all');
  const [source, setSource] = useState('all');
  const { state: demo } = useDemo();
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const pageSize = 20;

  const query = { contentTypeId: typeId, status, source, brand, flag, keyword, page, pageSize };
  // 生产环节刚保存的内容（演示状态），排在最前
  const createdRows: ContentRow[] = demo.created.map((c) => {
    const sub = demo.submitted.find((t) => (t.kind ?? 'content') === 'content' && t.contentId === c.contentId);
    const rv = sub ? demo.reviews[sub.taskId] : undefined;
    const st: ContentStatus = !sub ? 'draft' : rv?.status === 'approved' ? 'published' : rv?.status === 'rejected' ? 'draft' : 'in_review';
    const typeId = mockContentTypesData.find((t) => t.name === c.contentTypeName)?.contentTypeId ?? 'other';
    const detail = c.source.kind === 'repurpose' ? `源 ${c.source.sourceContentId} · ${c.source.templateId}` : [c.source.topicId && `选题 ${c.source.topicId}`, c.source.templateId ? `模板 ${c.source.templateId}` : '未用模板'].filter(Boolean).join(' · ');
    return { contentId: c.contentId, title: c.title, contentTypeId: typeId, contentTypeName: c.contentTypeName, brandName: c.brandName, regionLabel: c.regionLabel, status: st, version: 1, locales: [{ locale: c.locale as LocaleVariant['locale'], status: st }], factRefCount: c.source.refs.filter((r) => r.refKind === 'fact').length, aiGenerated: c.source.kind !== 'manual', sourceKind: c.source.kind, sourceDetail: detail, needsRecheck: false, checkFailed: false, healthScore: 80, ownerName: c.ownerName, updatedAt: c.createdAt };
  });
  const allRows = [...createdRows, ...mockContentsData.filter((r) => !createdRows.some((c) => c.contentId === r.contentId))];
  const refetch = (patch: Partial<typeof query>) => handleFetchContents({ ...query, ...patch });

  const rows = allRows.filter(
    (r) =>
      (typeId === 'all' || r.contentTypeId === typeId) &&
      (status === 'all' || r.status === status) &&
      (source === 'all' || r.sourceKind === source) &&
      (brand === 'all' || (brand === 'beiling' ? r.brandName === '北岭智造' : r.brandName === '汉川传动')) &&
      (flag === 'all' || (flag === 'recheck' && r.needsRecheck) || (flag === 'check_failed' && r.checkFailed) || (flag === 'ai' && r.aiGenerated)) &&
      (!keyword || r.title.toLowerCase().includes(keyword.toLowerCase()) || r.contentId.includes(keyword)),
  );
  const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r.contentId));

  const filterSelect = (
    items: { value: string; label: string }[],
    value: string,
    set: (v: string) => void,
    key: 'status' | 'source' | 'brand' | 'flag',
  ) => (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => {
        set(v as string);
        refetch({ [key]: v as string, page: 1 });
      }}
    >
      <SelectTrigger className="w-32">
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
        title="自产内容"
        description="CMS 负责生产和发布的内容：AI 生成、一稿多用、翻译、人工新建，以及从外部内容纳管过来的。每条记录来源、语种版本、引用的事实与资产、审批与发布状态。只读引用的外部内容在「外部内容」里。"
        actions={
          <>
            <Button variant="outline" onClick={() => handleExportContents({ contentTypeId: typeId, status, brand })}>
              <Download /> 导出
            </Button>
            <Button variant="outline" onClick={() => navigate('/production/generate')}>
              <Sparkles /> AI 生成
            </Button>
            <Button onClick={() => navigate('/content/edit/new')}>
              <FilePlus2 /> 新建内容
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <Card size="sm" className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">内容类型</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5 text-sm">
            {[{ contentTypeId: 'all', name: '全部内容', kind: 'collection' as const, entryCount: mockContentTypesData.reduce((s, t) => s + (t.kind === 'table' ? 0 : t.entryCount), 0) }, ...mockContentTypesData].map((t) => (
              <button
                key={t.contentTypeId}
                onClick={() => {
                  setTypeId(t.contentTypeId);
                  refetch({ contentTypeId: t.contentTypeId, page: 1 });
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted',
                  typeId === t.contentTypeId && 'bg-muted font-medium',
                )}
              >
                <span className="flex items-center gap-1.5">
                  {t.name}
                  {t.kind === 'singleton' && <span className="text-[10px] text-muted-foreground">单例</span>}
                  {t.kind === 'table' && <span className="text-[10px] text-muted-foreground">数据表</span>}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">{t.entryCount}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="标题或编号"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && refetch({ keyword, page: 1 })}
                />
              </div>
              {filterSelect(STATUS_OPTIONS, status, setStatus, 'status')}
              {filterSelect(SOURCE_OPTIONS, source, setSource, 'source')}
              {filterSelect(BRAND_OPTIONS, brand, setBrand, 'brand')}
              {filterSelect(FLAG_OPTIONS, flag, setFlag, 'flag')}
              {selected.length > 0 && (
                <div className="ml-auto flex items-center gap-2 rounded-lg bg-muted px-2 py-1 text-sm">
                  已选 {selected.length} 条
                  <Button size="sm" variant="outline" onClick={() => handleBatchSubmitReview(selected)}>
                    <Send /> 送审
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleBatchUnpublish(selected)}>
                    <RotateCcw /> 下线
                  </Button>
                </div>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(c) => setSelected(c ? rows.map((r) => r.contentId) : [])}
                    />
                  </TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>品牌 / 区域</TableHead>
                  <TableHead>语种版本</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">引用事实</TableHead>
                  <TableHead className="text-right">健康分</TableHead>
                  <TableHead>更新</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.contentId} className="cursor-pointer" onClick={() => navigate(`/content/edit/${r.contentId}`)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(r.contentId)}
                        onCheckedChange={(c) =>
                          setSelected((prev) => (c ? [...prev, r.contentId] : prev.filter((x) => x !== r.contentId)))
                        }
                      />
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal">
                      <div className="font-medium">{r.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {r.contentId} · v{r.version} · {r.ownerName}
                        {r.aiGenerated && <AiMark />}
                        {r.needsRecheck && <ToneBadge tone="violet">待复核</ToneBadge>}
                        {r.checkFailed && <ToneBadge tone="red">检查未通过</ToneBadge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={SOURCE_CONFIG[r.sourceKind].tone}>{SOURCE_CONFIG[r.sourceKind].label}</ToneBadge>
                      <div className="mt-0.5 text-xs text-muted-foreground">{r.sourceDetail}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.contentTypeName}</TableCell>
                    <TableCell className="text-sm">
                      {r.brandName}
                      <div className="text-xs text-muted-foreground">{r.regionLabel}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.locales.map((l) => (
                          <ToneBadge key={l.locale} tone={LOCALE_TONE[l.status]} className="font-mono text-[10px]">
                            {l.locale}
                            {l.status === 'missing' && ' 缺'}
                          </ToneBadge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ContentStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.factRefCount}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', r.healthScore < 70 && 'text-red-600')}>{r.healthScore}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.updatedAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>共 {rows.length} 条</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => { setPage(page - 1); refetch({ page: page - 1 }); }}>
                  上一页
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setPage(page + 1); refetch({ page: page + 1 }); }}>
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
