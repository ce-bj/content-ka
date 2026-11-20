import { useState } from 'react';
import {
  AlertTriangle,
  Braces,
  Calendar,
  Database,
  Download,
  FileStack,
  GripVertical,
  Hash,
  Image,
  Layers,
  Link2,
  List,
  Plus,
  Sparkles,
  ToggleLeft,
  Type,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormDialog, type FormValues } from '@/components/shared/FormDialog';
import { notify } from '@/components/shared/toast';
import { ToneBadge, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量：字段类型（内核内置，非动态数据）──────────────
const FIELD_TYPE_CONFIG = {
  text: { label: '单行文本', group: '基础', icon: Type },
  rich_text: { label: '富文本（块编辑器）', group: '基础', icon: FileStack },
  number: { label: '数字', group: '基础', icon: Hash },
  boolean: { label: '布尔', group: '基础', icon: ToggleLeft },
  date: { label: '日期', group: '基础', icon: Calendar },
  enum: { label: '枚举', group: '基础', icon: List },
  json: { label: 'JSON', group: '基础', icon: Braces },
  component: { label: '组件', group: '结构', icon: Layers },
  dynamic_zone: { label: '动态区（自由组合组件）', group: '结构', icon: Layers },
  content_ref: { label: '内容引用', group: '关联', icon: Link2 },
  asset_ref: { label: '资产引用', group: '关联', icon: Image },
  fact_slot: { label: '事实插槽', group: '关联', icon: Database },
  fact_list: { label: '事实列表（参数表）', group: '关联', icon: Database },
  variant: { label: '变体（按受众 / 地区 / 来源）', group: '体验', icon: Layers },
  summary: { label: '机器可读摘要', group: 'AI 与可见性', icon: Sparkles },
  qa_list: { label: 'Q&A 列表', group: 'AI 与可见性', icon: List },
} as const;
type FieldType = keyof typeof FIELD_TYPE_CONFIG;
const KIND_CONFIG = {
  collection: { label: '多条', tone: 'blue' as Tone },
  singleton: { label: '单例', tone: 'violet' as Tone },
  table: { label: '数据表', tone: 'teal' as Tone },
} as const;
type TypeKind = keyof typeof KIND_CONFIG;

// ── 类型 ──────────────────────────────────────────────────
interface ContentTypeSummary {
  apiId: string;
  name: string;
  kind: TypeKind;
  entryCount: number;
  fieldCount: number;
  updatedAt: string;
}
interface FieldDef {
  fieldId: string;
  label: string;
  apiName: string;
  fieldType: FieldType;
  required: boolean;
  localized: boolean;
  filterable: boolean;
  aiAssist: boolean;
  readonlyRoles: string[];
  helpText: string;
  isNew?: boolean;
}
interface ContentTypeDetail {
  apiId: string;
  name: string;
  kind: TypeKind;
  description: string;
  schemaVersion: number;
  fields: FieldDef[];
}
interface ComponentSummary {
  apiId: string;
  name: string;
  usedByCount: number;
}
interface AiSchemaSuggestion {
  suggestedName: string;
  suggestedKind: TypeKind;
  fields: { label: string; apiName: string; fieldType: FieldType; reason: string }[];
}
interface ChangesetPreview {
  fromVersion: number;
  toVersion: number;
  operations: { op: 'add' | 'rename' | 'change_type' | 'remove'; target: string; detail: string; breaking: boolean }[];
  affectedEntries: number;
  affectedApps: string[];
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockContentTypesData: ContentTypeSummary[] = [
  { apiId: 'product_brief', name: '产品说明', kind: 'collection', entryCount: 48, fieldCount: 9, updatedAt: '2026-11-02' },
  { apiId: 'tech_faq', name: '技术 FAQ', kind: 'collection', entryCount: 96, fieldCount: 6, updatedAt: '2026-10-18' },
  { apiId: 'case_study', name: '客户案例', kind: 'collection', entryCount: 22, fieldCount: 11, updatedAt: '2026-09-30' },
  { apiId: 'landing_page', name: '落地页', kind: 'collection', entryCount: 14, fieldCount: 5, updatedAt: '2026-11-15' },
  { apiId: 'white_paper', name: '白皮书', kind: 'collection', entryCount: 8, fieldCount: 7, updatedAt: '2026-08-21' },
  { apiId: 'sales_kit', name: '销售资料', kind: 'collection', entryCount: 12, fieldCount: 8, updatedAt: '2026-10-11' },
  { apiId: 'social_post', name: '社媒短帖', kind: 'collection', entryCount: 18, fieldCount: 4, updatedAt: '2026-11-08' },
  { apiId: 'wechat_article', name: '公众号文章', kind: 'collection', entryCount: 9, fieldCount: 5, updatedAt: '2026-10-02' },
  { apiId: 'sales_card', name: '销售话术卡', kind: 'collection', entryCount: 10, fieldCount: 6, updatedAt: '2026-11-12' },
  { apiId: 'brand_profile', name: '品牌信息', kind: 'singleton', entryCount: 2, fieldCount: 8, updatedAt: '2026-06-01' },
  { apiId: 'product_catalog', name: '产品目录', kind: 'table', entryCount: 96, fieldCount: 14, updatedAt: '2026-11-19' },
  { apiId: 'partner_directory', name: '伙伴名录', kind: 'table', entryCount: 214, fieldCount: 10, updatedAt: '2026-10-08' },
  { apiId: 'resource_library', name: '资源库', kind: 'table', entryCount: 138, fieldCount: 9, updatedAt: '2026-11-17' },
];

const mockContentTypeDetailData: ContentTypeDetail = {
  apiId: 'product_brief',
  name: '产品说明',
  kind: 'collection',
  description: '单个产品的对外说明，供官网、经销商门户、GEO 与 SDR 使用',
  schemaVersion: 7,
  fields: [
    { fieldId: 'f1', label: '标题', apiName: 'title', fieldType: 'text', required: true, localized: true, filterable: true, aiAssist: true, readonlyRoles: [], helpText: '' },
    { fieldId: 'f2', label: '产品', apiName: 'product', fieldType: 'content_ref', required: true, localized: false, filterable: true, aiAssist: false, readonlyRoles: [], helpText: '关联产品目录中的条目' },
    { fieldId: 'f3', label: '机器可读摘要', apiName: 'summary', fieldType: 'summary', required: true, localized: true, filterable: false, aiAssist: true, readonlyRoles: [], helpText: '300 字符内，可被 AI 直接引用' },
    { fieldId: 'f4', label: '正文', apiName: 'body', fieldType: 'rich_text', required: true, localized: true, filterable: false, aiAssist: true, readonlyRoles: [], helpText: '可插入事实标签' },
    { fieldId: 'f5', label: '参数表', apiName: 'specs', fieldType: 'fact_list', required: true, localized: false, filterable: false, aiAssist: false, readonlyRoles: [], helpText: '事实插槽，事实更新后自动刷新' },
    { fieldId: 'f6', label: '标准交付周期', apiName: 'lead_time', fieldType: 'fact_slot', required: false, localized: false, filterable: true, aiAssist: false, readonlyRoles: ['内容编辑', 'Agent'], helpText: '红线字段：交期变更需人工确认' },
    { fieldId: 'f7', label: '主图', apiName: 'hero_image', fieldType: 'asset_ref', required: true, localized: false, filterable: false, aiAssist: false, readonlyRoles: [], helpText: '' },
    { fieldId: 'f8', label: '首屏卖点', apiName: 'hero_message', fieldType: 'variant', required: false, localized: true, filterable: false, aiAssist: true, readonlyRoles: [], helpText: '按受众行业提供多个版本，门户运行时选择' },
    { fieldId: 'f9', label: 'FAQ', apiName: 'faq', fieldType: 'qa_list', required: false, localized: true, filterable: false, aiAssist: true, readonlyRoles: [], helpText: '' },
  ],
};

const mockComponentsData: ComponentSummary[] = [
  { apiId: 'cta_block', name: 'CTA 按钮组', usedByCount: 4 },
  { apiId: 'spec_card', name: '规格卡', usedByCount: 3 },
  { apiId: 'case_quote', name: '客户引言', usedByCount: 2 },
  { apiId: 'video_section', name: '视频段落', usedByCount: 2 },
];

const mockAiSchemaSuggestionData: AiSchemaSuggestion = {
  suggestedName: '认证证书',
  suggestedKind: 'collection',
  fields: [
    { label: '证书名称', apiName: 'cert_name', fieldType: 'text', reason: '标题' },
    { label: '认证产品', apiName: 'products', fieldType: 'content_ref', reason: '关联产品目录（多选）' },
    { label: '证书编号', apiName: 'cert_no', fieldType: 'fact_slot', reason: '取自事实库，保证与证据一致' },
    { label: '有效期至', apiName: 'valid_to', fieldType: 'fact_slot', reason: '到期自动触发复核' },
    { label: '适用区域', apiName: 'regions', fieldType: 'enum', reason: '用于授权范围过滤' },
    { label: '证书扫描件', apiName: 'cert_file', fieldType: 'asset_ref', reason: '证据原件，下载区展示' },
    { label: '说明', apiName: 'summary', fieldType: 'summary', reason: '供 GEO / SDR 引用' },
  ],
};

const mockChangesetPreviewData: ChangesetPreview = {
  fromVersion: 7,
  toVersion: 8,
  operations: [
    { op: 'add', target: 'applicable_industries', detail: '新增字段「适用行业」（枚举，可筛选）', breaking: false },
    { op: 'rename', target: 'hero_message', detail: '「首屏卖点」API 名改为 headline', breaking: true },
  ],
  affectedEntries: 86,
  affectedApps: ['欧盟官网（AI 门户）', 'Nordwerk GmbH 经销商门户', 'MCP 工具 get_product_brief'],
};

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取内容类型列表 [GET] /api/v1/content-types
function handleFetchContentTypes(params: { kind: TypeKind | 'all' }) {
  console.log('fetch types', params);
}

// ACTION: 获取内容类型详情 [GET] /api/v1/content-types/{apiId}
function handleFetchContentTypeDetail(apiId: string) {
  console.log('fetch type detail', apiId);
}

// ACTION: 新建内容类型 [POST] /api/v1/content-types
function handleCreateContentType(form: { name: string; kind: TypeKind; fields: { label: string; apiName: string; fieldType: FieldType }[] }) {
  alert(`已创建内容类型「${form.name}」，MCP 工具已自动生成`);
}

// ACTION: AI 生成模型草案 [POST] /api/v1/ai/schema-suggestions
function handleGenerateSchemaByAi(prompt: string) {
  console.log('ai schema', prompt);
}

// ACTION: 预览模型变更影响 [POST] /api/v1/content-types/{apiId}/changesets/preview
function handlePreviewChangeset(apiId: string, fields: FieldDef[]) {
  console.log('preview changeset', apiId, fields);
}

// ACTION: 发布模型变更 [POST] /api/v1/content-types/{apiId}/changesets
function handlePublishChangeset(apiId: string, toVersion: number) {
  alert(`模型已更新到 v${toVersion}，即时生效；变更集可导出到其他环境`);
}

// ACTION: 导出模型变更集 [GET] /api/v1/content-types/{apiId}/changesets/export
function handleExportSchema(apiId: string) {
  console.log('export schema', apiId);
}

// ── 主组件 ────────────────────────────────────────────────
export default function ContentModelDesigner() {
  const [types, setTypes] = useState(mockContentTypesData);
  const [typeOpen, setTypeOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('product_brief');
  const [fields, setFields] = useState<FieldDef[]>(mockContentTypeDetailData.fields);
  const [selectedField, setSelectedField] = useState('f6');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('我要管理产品的认证证书：证书编号、有效期、适用区域、扫描件，可以给官网下载区和 SDR 用');
  const [aiDone, setAiDone] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const t = mockContentTypeDetailData;
  const f = fields.find((x) => x.fieldId === selectedField);
  const updateField = (patch: Partial<FieldDef>) => setFields((prev) => prev.map((x) => (x.fieldId === selectedField ? { ...x, ...patch } : x)));
  const addField = (type: FieldType) => {
    const id = `n${Date.now()}`;
    setFields((prev) => [...prev, { fieldId: id, label: '适用行业', apiName: 'applicable_industries', fieldType: type, required: false, localized: false, filterable: true, aiAssist: false, readonlyRoles: [], helpText: '', isNew: true }]);
    setSelectedField(id);
  };
  const groups = Array.from(new Set(Object.values(FIELD_TYPE_CONFIG).map((c) => c.group)));

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="内容模型"
        description="内容类型、组件与字段在这里定义，保存后即时生效，无需重新部署。字段结构同时决定编辑器表单、API、MCP 工具与 JSON-LD 输出。"
        actions={
          <>
            <Button variant="outline" onClick={() => handleExportSchema(selectedType)}>
              <Download /> 导出变更集
            </Button>
            <Button variant="outline" onClick={() => setTypeOpen(true)}>
              <Plus /> 新建内容类型
            </Button>
            <Button variant="outline" onClick={() => { setAiOpen(true); setAiDone(false); }}>
              <Sparkles /> AI 建模
            </Button>
            <Button
              onClick={() => {
                handlePreviewChangeset(selectedType, fields);
                setPreviewOpen(true);
              }}
            >
              保存变更
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[230px_1fr_320px]">
        {/* 类型与组件 */}
        <div className="space-y-4">
          {(Object.keys(KIND_CONFIG) as TypeKind[]).map((k) => (
            <Card key={k} size="sm">
              <CardHeader>
                <CardTitle className="text-sm">{k === 'collection' ? '内容类型' : k === 'singleton' ? '单例' : '数据表'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 text-sm">
                {types
                  .filter((x) => x.kind === k)
                  .map((x) => (
                    <button
                      key={x.apiId}
                      onClick={() => {
                        setSelectedType(x.apiId);
                        handleFetchContentTypeDetail(x.apiId);
                      }}
                      className={cn('flex w-full items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted', selectedType === x.apiId && 'bg-muted font-medium')}
                    >
                      {x.name}
                      <span className="text-xs text-muted-foreground">{x.fieldCount} 字段</span>
                    </button>
                  ))}
              </CardContent>
            </Card>
          ))}
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">组件</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 text-sm">
              {mockComponentsData.map((c) => (
                <div key={c.apiId} className="flex justify-between px-2 py-1.5">
                  {c.name}
                  <span className="text-xs text-muted-foreground">用于 {c.usedByCount}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Button variant="outline" size="sm" className="w-full" onClick={() => handleFetchContentTypes({ kind: 'all' })}>
            <Plus /> 新建内容类型
          </Button>
        </div>

        {/* 字段列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t.name} <ToneBadge tone={KIND_CONFIG[t.kind].tone}>{KIND_CONFIG[t.kind].label}</ToneBadge>
              <span className="text-xs font-normal text-muted-foreground">
                {t.apiId} · 模型 v{t.schemaVersion}
              </span>
            </CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {fields.map((x) => {
              const Icon = FIELD_TYPE_CONFIG[x.fieldType].icon;
              return (
                <button
                  key={x.fieldId}
                  onClick={() => setSelectedField(x.fieldId)}
                  className={cn('flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left hover:bg-muted/50', selectedField === x.fieldId && 'border-primary ring-2 ring-primary/20', x.isNew && 'border-dashed border-emerald-400')}
                >
                  <GripVertical className="size-4 text-muted-foreground" />
                  <Icon className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {x.label}
                      {x.required && <span className="text-red-500">*</span>}
                      {x.isNew && <ToneBadge tone="green">新增</ToneBadge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{x.apiName}</span> · {FIELD_TYPE_CONFIG[x.fieldType].label}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {x.localized && <ToneBadge tone="gray">多语种</ToneBadge>}
                    {x.filterable && <ToneBadge tone="gray">可筛选</ToneBadge>}
                    {x.aiAssist && <ToneBadge tone="violet">AI</ToneBadge>}
                    {x.readonlyRoles.length > 0 && <ToneBadge tone="red">红线</ToneBadge>}
                  </div>
                </button>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" className="mt-2 w-full border-dashed" />}>
                <Plus /> 添加字段
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64">
                {groups.map((g, gi) => (
                  <DropdownMenuGroup key={g}>
                    {gi > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel>{g}</DropdownMenuLabel>
                    {(Object.keys(FIELD_TYPE_CONFIG) as FieldType[])
                      .filter((k) => FIELD_TYPE_CONFIG[k].group === g)
                      .map((k) => (
                        <DropdownMenuItem key={k} onClick={() => addField(k)}>
                          {FIELD_TYPE_CONFIG[k].label}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuGroup>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>

        {/* 字段配置 */}
        {f && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">字段配置</CardTitle>
              <CardDescription>{FIELD_TYPE_CONFIG[f.fieldType].label}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1.5">
                <Label>显示名称</Label>
                <Input value={f.label} onChange={(e) => updateField({ label: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>API 名称</Label>
                <Input className="font-mono" value={f.apiName} onChange={(e) => updateField({ apiName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>说明</Label>
                <Textarea rows={2} value={f.helpText} onChange={(e) => updateField({ helpText: e.target.value })} />
              </div>
              {(
                [
                  ['required', '必填'],
                  ['localized', '多语种（各语种分别填写）'],
                  ['filterable', '可筛选 / 排序（写入字段索引）'],
                  ['aiAssist', '允许 AI 生成与改写'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span>{label}</span>
                  <Switch checked={f[key]} onCheckedChange={(c) => updateField({ [key]: c })} />
                </div>
              ))}
              <div className="space-y-1.5 border-t pt-3">
                <Label>只读角色（红线字段）</Label>
                <div className="flex flex-wrap gap-3">
                  {['内容编辑', '区域市场负责人', 'Agent'].map((r) => (
                    <label key={r} className="flex items-center gap-1.5">
                      <Checkbox
                        checked={f.readonlyRoles.includes(r)}
                        onCheckedChange={(c) => updateField({ readonlyRoles: c ? [...f.readonlyRoles, r] : f.readonlyRoles.filter((x) => x !== r) })}
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              {(f.fieldType === 'fact_slot' || f.fieldType === 'fact_list') && (
                <div className="rounded-lg bg-teal-50 p-2.5 text-xs text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                  事实插槽：属性定义来自 KDH 统一事实模型（只读，CMS 不另建）。只能选择范围内、有效、无冲突、证据 A/B、可见级别为“公开”的事实；事实更新后自动刷新并生成新版本。
                </div>
              )}
              {f.fieldType === 'variant' && (
                <div className="rounded-lg bg-blue-50 p-2.5 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                  变体：中台存多个版本与受众条件，门户在运行时选择（Smart Content / A/B 由门户执行）。
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* AI 建模 */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>AI 建模</DialogTitle>
            <DialogDescription>用一句话描述要管理的内容，AI 生成字段草案，确认后创建。</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
          {!aiDone ? (
            <Button
              onClick={() => {
                handleGenerateSchemaByAi(aiPrompt);
                setAiDone(true);
              }}
            >
              <Sparkles /> 生成草案
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                建议名称 <span className="font-medium">{mockAiSchemaSuggestionData.suggestedName}</span>
                <ToneBadge tone={KIND_CONFIG[mockAiSchemaSuggestionData.suggestedKind].tone}>{KIND_CONFIG[mockAiSchemaSuggestionData.suggestedKind].label}</ToneBadge>
              </div>
              <div className="divide-y rounded-lg border text-sm">
                {mockAiSchemaSuggestionData.fields.map((x) => (
                  <div key={x.apiName} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-24 font-medium">{x.label}</span>
                    <span className="w-32 text-xs text-muted-foreground">{FIELD_TYPE_CONFIG[x.fieldType].label}</span>
                    <span className="flex-1 text-xs text-muted-foreground">{x.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {aiDone && (
            <DialogFooter>
              <Button
                onClick={() => {
                  handleCreateContentType({ name: mockAiSchemaSuggestionData.suggestedName, kind: mockAiSchemaSuggestionData.suggestedKind, fields: mockAiSchemaSuggestionData.fields });
                  setTypes((prev) => [...prev, { apiId: `ai_${Date.now()}`, name: mockAiSchemaSuggestionData.suggestedName, kind: mockAiSchemaSuggestionData.suggestedKind, entryCount: 0, fieldCount: mockAiSchemaSuggestionData.fields.length, updatedAt: '刚刚' }]);
                  setAiOpen(false);
                }}
              >
                确认创建
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* 变更影响预览 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              模型变更 v{mockChangesetPreviewData.fromVersion} → v{mockChangesetPreviewData.toVersion}
            </DialogTitle>
            <DialogDescription>保存后即时生效。旧版本内容在读取时自动按新模型升级。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {mockChangesetPreviewData.operations.map((o) => (
              <div key={o.target} className="flex items-start gap-2 rounded-lg border p-2.5">
                <ToneBadge tone={o.breaking ? 'red' : 'green'}>{o.op === 'add' ? '新增' : o.op === 'rename' ? '改名' : o.op === 'change_type' ? '改类型' : '删除'}</ToneBadge>
                <span>{o.detail}</span>
              </div>
            ))}
          </div>
          {mockChangesetPreviewData.operations.some((o) => o.breaking) && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>包含破坏性变更</AlertTitle>
              <AlertDescription>
                影响 {mockChangesetPreviewData.affectedEntries} 条内容，以及：{mockChangesetPreviewData.affectedApps.join('、')}。API 旧字段名保留 90 天兼容期。
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                handlePublishChangeset(selectedType, mockChangesetPreviewData.toVersion);
                setPreviewOpen(false);
              }}
            >
              确认生效
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FormDialog
        open={typeOpen}
        onOpenChange={setTypeOpen}
        title="新建内容类型"
        description="先建类型，再在右侧添加字段。字段结构会同时生成编辑器表单、API、MCP 工具与 JSON-LD 映射。"
        fields={[
          { key: 'name', label: '名称', kind: 'text', required: true, placeholder: '例如：活动报名页' },
          { key: 'apiId', label: 'API 标识', kind: 'text', required: true, placeholder: 'event_page' },
          { key: 'kind', label: '种类', kind: 'select', options: [{ value: 'collection', label: '内容类型（多条）' }, { value: 'singleton', label: '单例' }, { value: 'table', label: '数据表' }] },
        ]}
        onSubmit={(v: FormValues) => {
          handleCreateContentType({ name: String(v.name), kind: v.kind as TypeKind, fields: [] });
          setTypes((prev) => [...prev, { apiId: String(v.apiId), name: String(v.name), kind: v.kind as TypeKind, entryCount: 0, fieldCount: 0, updatedAt: '刚刚' }]);
          setSelectedType(String(v.apiId));
          setFields([{ fieldId: `n${Date.now()}`, label: '标题', apiName: 'title', fieldType: 'text' as FieldType, required: true, localized: true, filterable: true, aiAssist: true, readonlyRoles: [], helpText: '', isNew: true }]);
          notify(`已创建内容类型「${v.name}」，添加字段后保存变更即可使用`);
        }}
      />
    </div>
  );
}
