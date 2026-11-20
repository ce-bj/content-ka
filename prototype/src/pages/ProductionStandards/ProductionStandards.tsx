import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Ban, CheckCheck, Download, FileStack, Mic2, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormDialog, type FormValues } from '@/components/shared/FormDialog';
import { notify } from '@/components/shared/toast';
import { ToneBadge } from '@/components/shared/status';
import { useDemo } from '@/lib/demo-store';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const BRAND_OPTIONS = [
  { value: 'beiling', label: '北岭智造' },
  { value: 'hanchuan', label: '汉川传动' },
];

// 模板分类：生成模板（按内容类型，AI 生成时可选）/ 目标格式模板（一稿多用，按渠道）
const TEMPLATE_KIND_CONFIG = {
  generate: { label: '生成模板', hint: '按内容类型。AI 生成时可选，提供结构与必需事实提示', usedIn: 'AI 生成' },
  repurpose: { label: '一稿多用 · 目标格式', hint: '按渠道。决定改写后的格式、长度、素材规格，是否继承源内容的事实', usedIn: '一稿多用' },
} as const;
type TemplateKind = keyof typeof TEMPLATE_KIND_CONFIG;
const CHANNEL_GROUPS = ['官网与 AI 搜索', '社媒', '销售', '知识库'] as const;
const CONTENT_TYPES = ['产品说明', '技术 FAQ', '客户案例', '落地页', '白皮书', '销售资料', '社媒短帖', '公众号文章', '销售话术卡', '知识条目'];

// ── 类型 ──────────────────────────────────────────────────
interface GenerationTemplate {
  templateId: string;
  templateKind: TemplateKind;
  templateName: string;
  contentTypeName: string;
  channelGroup: string | null;
  channelLabel: string;
  structure: string;
  assetSpec: string | null;
  brandScope: string;
  requiredFactCategories: string[];
  inheritsFacts: boolean;
  usesKnowledgeSearch: boolean;
  usageCount: number;
  enabled: boolean;
  updatedAt: string;
}
interface BrandVoice {
  brandId: string;
  brandName: string;
  toneDescription: string;
  personaTraits: string[];
  bannedPhrases: { phrase: string; reason: string }[];
  requiredPhrases: { phrase: string; context: string }[];
  goodExample: string;
  badExample: string;
  checkPassRate: number;
}
interface GlossaryTerm {
  termId: string;
  zhCN: string;
  enUS: string;
  deDE: string | null;
  jaJP: string | null;
  domain: string;
  doNotTranslate: boolean;
  forbiddenVariants: string[];
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockTemplatesData: GenerationTemplate[] = [
  { templateId: 'TPL-01', templateKind: 'generate', templateName: '产品说明 · 标准版', contentTypeName: '产品说明', channelGroup: null, channelLabel: '官网 / 经销商', structure: '概述 → 核心卖点 → 参数表 → 应用场景 → FAQ', assetSpec: null, brandScope: '全部品牌', requiredFactCategories: ['规格参数', '认证与检测'], inheritsFacts: true, usesKnowledgeSearch: true, usageCount: 312, enabled: true, updatedAt: '11-10' },
  { templateId: 'TPL-02', templateKind: 'generate', templateName: '技术问答 · GEO 友好', contentTypeName: '技术 FAQ', channelGroup: null, channelLabel: '官网 / AI 搜索 / SDR', structure: '每问一答，答案首句可独立引用，附结构化标注', assetSpec: null, brandScope: '全部品牌', requiredFactCategories: ['认证与检测', '交付与产能'], inheritsFacts: true, usesKnowledgeSearch: true, usageCount: 540, enabled: true, updatedAt: '11-02' },
  { templateId: 'TPL-03', templateKind: 'generate', templateName: '展会落地页', contentTypeName: '落地页', channelGroup: null, channelLabel: '官网专题', structure: '首屏 → 卖点 → 参数 → 案例 → 视频 → 预约 CTA', assetSpec: '首屏 16:9 图或视频', brandScope: '北岭智造', requiredFactCategories: ['规格参数', '营销表述'], inheritsFacts: true, usesKnowledgeSearch: false, usageCount: 18, enabled: true, updatedAt: '10-28' },
  { templateId: 'TPL-05', templateKind: 'generate', templateName: '客户案例 · 制造业', contentTypeName: '客户案例', channelGroup: null, channelLabel: '官网 / 销售', structure: '背景 → 挑战 → 方案 → 效果（引用事实）', assetSpec: null, brandScope: '全部品牌', requiredFactCategories: ['案例要点'], inheritsFacts: true, usesKnowledgeSearch: true, usageCount: 46, enabled: true, updatedAt: '09-15' },
  { templateId: 'TPL-08', templateKind: 'generate', templateName: '白皮书 · 行业应用', contentTypeName: '白皮书', channelGroup: null, channelLabel: '官网下载', structure: '行业挑战 → 技术路线 → 方案 → 案例 → 选型建议', assetSpec: null, brandScope: '全部品牌', requiredFactCategories: ['规格参数', '案例要点'], inheritsFacts: true, usesKnowledgeSearch: true, usageCount: 0, enabled: false, updatedAt: '11-18' },
  { templateId: 'RF-01', templateKind: 'repurpose', templateName: '技术 FAQ · 官网与 AI 客服', contentTypeName: '技术 FAQ', channelGroup: '官网与 AI 搜索', channelLabel: '官网 · AI 客服', structure: '8–12 问，答案首句可独立引用', assetSpec: null, brandScope: '全部品牌', requiredFactCategories: ['规格参数'], inheritsFacts: true, usesKnowledgeSearch: false, usageCount: 88, enabled: true, updatedAt: '11-02' },
  { templateId: 'RF-02', templateKind: 'repurpose', templateName: '活动落地页', contentTypeName: '落地页', channelGroup: '官网与 AI 搜索', channelLabel: '官网活动页', structure: '首屏 + 3 个卖点 + CTA', assetSpec: '首屏 16:9', brandScope: '全部品牌', requiredFactCategories: ['规格参数'], inheritsFacts: true, usesKnowledgeSearch: false, usageCount: 12, enabled: true, updatedAt: '10-28' },
  { templateId: 'RF-03', templateKind: 'repurpose', templateName: '公众号长文', contentTypeName: '公众号文章', channelGroup: '社媒', channelLabel: '微信公众号', structure: '1200 字左右，小标题分段，文末引导留资', assetSpec: '封面 2.35:1', brandScope: '全部品牌', requiredFactCategories: ['规格参数'], inheritsFacts: true, usesKnowledgeSearch: false, usageCount: 21, enabled: true, updatedAt: '10-20' },
  { templateId: 'RF-04', templateKind: 'repurpose', templateName: 'LinkedIn 产品帖', contentTypeName: '社媒短帖', channelGroup: '社媒', channelLabel: 'LinkedIn', structure: '≤ 300 字符 × 3 条，一个数据亮点 + 一个场景', assetSpec: '1.91:1 或 1:1', brandScope: '全部品牌', requiredFactCategories: ['规格参数'], inheritsFacts: false, usesKnowledgeSearch: false, usageCount: 64, enabled: true, updatedAt: '11-05' },
  { templateId: 'RF-05', templateKind: 'repurpose', templateName: 'Instagram 图文', contentTypeName: '社媒短帖', channelGroup: '社媒', channelLabel: 'Instagram', structure: '文案 ≤ 2200 字符，首行抓眼球，≤ 30 个话题标签', assetSpec: '1:1 或 4:5，至少 1 张', brandScope: '全部品牌', requiredFactCategories: [], inheritsFacts: false, usesKnowledgeSearch: false, usageCount: 9, enabled: true, updatedAt: '11-16' },
  { templateId: 'RF-06', templateKind: 'repurpose', templateName: 'Facebook 帖子', contentTypeName: '社媒短帖', channelGroup: '社媒', channelLabel: 'Facebook', structure: '≤ 500 字，附链接卡片', assetSpec: '1.91:1', brandScope: '全部品牌', requiredFactCategories: [], inheritsFacts: false, usesKnowledgeSearch: false, usageCount: 4, enabled: true, updatedAt: '11-16' },
  { templateId: 'RF-07', templateKind: 'repurpose', templateName: '销售话术卡', contentTypeName: '销售话术卡', channelGroup: '销售', channelLabel: 'CRM · 销售助手', structure: '3 个要点 + 常见异议应对', assetSpec: null, brandScope: '全部品牌', requiredFactCategories: ['营销表述', '规格参数'], inheritsFacts: true, usesKnowledgeSearch: false, usageCount: 33, enabled: true, updatedAt: '11-12' },
  { templateId: 'RF-08', templateKind: 'repurpose', templateName: '知识库条目', contentTypeName: '知识条目', channelGroup: '知识库', channelLabel: 'KDH 知识库', structure: '问答对 + 结构化摘要，供 KDH 导入', assetSpec: null, brandScope: '全部品牌', requiredFactCategories: ['规格参数'], inheritsFacts: true, usesKnowledgeSearch: false, usageCount: 41, enabled: true, updatedAt: '11-08' },
];

const mockBrandVoiceData: BrandVoice = {
  brandId: 'beiling',
  brandName: '北岭智造',
  toneDescription: '专业、克制、可验证。用数据说话，不夸大；面向工程师和采购决策者，句子简短。',
  personaTraits: ['专业', '务实', '可信', '不浮夸'],
  bannedPhrases: [
    { phrase: '业界第一', reason: '广告法禁用的绝对化用语' },
    { phrase: '零故障', reason: '无法证明的承诺' },
    { phrase: '颠覆', reason: '品牌调性不符' },
  ],
  requiredPhrases: [
    { phrase: '六轴工业机器人', context: '不要写成“机械手”或“机械臂”' },
    { phrase: '数据来源：', context: '引用测试数据时必须注明出处' },
  ],
  goodExample: 'BL-R600 额定负载 20 kg，防护等级 IP66（TÜV 检测报告 TÜV-2026-1188），可在多粉尘的焊装车间稳定运行。',
  badExample: 'BL-R600 是业界第一的颠覆性机器人，零故障运行，8 周极速交付！',
  checkPassRate: 91,
};

const mockGlossaryData: GlossaryTerm[] = [
  { termId: 'G-001', zhCN: '工业机器人', enUS: 'industrial robot', deDE: 'Industrieroboter', jaJP: '産業用ロボット', domain: '产品', doNotTranslate: false, forbiddenVariants: ['机械手', 'robot arm'] },
  { termId: 'G-002', zhCN: '中空腕部', enUS: 'hollow wrist', deDE: 'Hohlwellen-Handgelenk', jaJP: '中空手首', domain: '功能', doNotTranslate: false, forbiddenVariants: ['空心手腕'] },
  { termId: 'G-003', zhCN: '北岭智造', enUS: 'Beiling Robotics', deDE: 'Beiling Robotics', jaJP: null, domain: '品牌', doNotTranslate: true, forbiddenVariants: [] },
  { termId: 'G-004', zhCN: '防护等级', enUS: 'ingress protection rating', deDE: 'Schutzart', jaJP: '保護等級', domain: '认证', doNotTranslate: false, forbiddenVariants: ['waterproof level'] },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取模板 [GET] /api/v1/generation-templates
function handleFetchTemplates(params: { kind: TemplateKind; channelGroup: string }) {
  console.log('fetch templates', params);
}

// ACTION: 新建模板 [POST] /api/v1/generation-templates
function handleCreateTemplate(form: { templateKind: TemplateKind; templateName: string; contentTypeName: string; channelLabel: string; structure: string }) {
  console.log('create template', form);
}

// ACTION: 启停生成模板 [PATCH] /api/v1/generation-templates/{id}
function handleToggleTemplate(templateId: string, enabled: boolean) {
  console.log('toggle template', templateId, enabled);
}

// ACTION: 获取品牌 Brand Voice [GET] /api/v1/brands/{brandId}/voice
function handleFetchBrandVoice(brandId: string) {
  console.log('fetch voice', brandId);
}

// ACTION: 保存品牌 Brand Voice [PUT] /api/v1/brands/{brandId}/voice
function handleSaveBrandVoice(brandId: string, voice: BrandVoice) {
  alert('已保存。新规则对之后的生成和检查生效');
}

// ACTION: 获取术语库 [GET] /api/v1/glossary
function handleFetchGlossary(params: { keyword: string; domain: string }) {
  console.log('fetch glossary', params);
}

// ACTION: 导入术语 [POST] /api/v1/glossary/imports
function handleImportGlossary() {
  alert('选择 Excel / TBX 文件导入');
}

// ACTION: 导出术语 [GET] /api/v1/glossary/export
function handleExportGlossary() {
  alert('正在导出');
}

// ── 主组件 ────────────────────────────────────────────────
export default function ProductionStandards() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialKind = ((location.state as { templateKind?: TemplateKind } | null)?.templateKind ?? 'generate') as TemplateKind;
  const { state: demo, dispatch } = useDemo();
  const [tplKind, setTplKind] = useState<TemplateKind>(initialKind);
  const [channelGroup, setChannelGroup] = useState<string>('all');
  const [tplOpen, setTplOpen] = useState(false);
  const [brand, setBrand] = useState('beiling');
  const [voice, setVoice] = useState(mockBrandVoiceData);
  const [templates, setTemplates] = useState(mockTemplatesData);
  // 生产规范里新建的模板存入演示状态，AI 生成 / 一稿多用里即可选到
  const allTemplates: GenerationTemplate[] = [
    ...templates,
    ...demo.templates.map((t) => ({ templateId: t.templateId, templateKind: t.templateKind, templateName: t.templateName, contentTypeName: t.contentTypeName, channelGroup: t.templateKind === 'repurpose' ? '社媒' : null, channelLabel: t.channelLabel, structure: t.structure, assetSpec: null, brandScope: '全部品牌', requiredFactCategories: [], inheritsFacts: t.templateKind === 'generate', usesKnowledgeSearch: false, usageCount: 0, enabled: t.enabled, updatedAt: '今天' })),
  ];
  const shownTemplates = allTemplates.filter((t) => t.templateKind === tplKind && (tplKind === 'generate' || channelGroup === 'all' || t.channelGroup === channelGroup));
  const [keyword, setKeyword] = useState('');
  const [newPhrase, setNewPhrase] = useState('');
  const addBanned = () => {
    setVoice({ ...voice, bannedPhrases: [...voice.bannedPhrases, { phrase: newPhrase.trim(), reason: '新增，未保存' }] });
    setNewPhrase('');
  };
  const terms = mockGlossaryData.filter((t) => !keyword || t.zhCN.includes(keyword) || t.enUS.toLowerCase().includes(keyword.toLowerCase()));

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="生产规范"
        description="生产环节共用的规范，分类管理：模板（生成模板按内容类型、一稿多用目标格式按渠道）、Brand Voice（语调和用词）、术语库（多语种标准译法）。都会进入发布检查。"
      />

      <Tabs defaultValue="templates" onValueChange={(v) => v === 'glossary' && handleFetchGlossary({ keyword: '', domain: 'all' })}>
        <TabsList>
          <TabsTrigger value="templates">
            <FileStack /> 模板
          </TabsTrigger>
          <TabsTrigger value="voice">
            <Mic2 /> Brand Voice
          </TabsTrigger>
          <TabsTrigger value="glossary">术语库</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="grid gap-4 pt-3 lg:grid-cols-[240px_1fr]">
          <Card size="sm" className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">模板分类</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {(Object.keys(TEMPLATE_KIND_CONFIG) as TemplateKind[]).map((k) => (
                <div key={k}>
                  <button
                    onClick={() => { setTplKind(k); setChannelGroup('all'); handleFetchTemplates({ kind: k, channelGroup: 'all' }); }}
                    className={cn('flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-muted', tplKind === k && channelGroup === 'all' && 'bg-muted font-medium')}
                  >
                    {TEMPLATE_KIND_CONFIG[k].label}
                    <span className="text-xs text-muted-foreground tabular-nums">{allTemplates.filter((t) => t.templateKind === k).length}</span>
                  </button>
                  {k === 'repurpose' && (
                    <div className="ml-3 border-l pl-2">
                      {CHANNEL_GROUPS.map((g) => (
                        <button
                          key={g}
                          onClick={() => { setTplKind('repurpose'); setChannelGroup(g); handleFetchTemplates({ kind: 'repurpose', channelGroup: g }); }}
                          className={cn('flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-muted', tplKind === 'repurpose' && channelGroup === g && 'bg-muted font-medium')}
                        >
                          {g}
                          <span className="text-muted-foreground tabular-nums">{allTemplates.filter((t) => t.channelGroup === g).length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                {TEMPLATE_KIND_CONFIG[tplKind].label}
                {tplKind === 'repurpose' && channelGroup !== 'all' && ` · ${channelGroup}`}
              </CardTitle>
              <CardDescription>
                {TEMPLATE_KIND_CONFIG[tplKind].hint}。启用的模板在「{TEMPLATE_KIND_CONFIG[tplKind].usedIn}」中可选。
              </CardDescription>
              <CardAction className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => navigate(tplKind === 'generate' ? '/production/generate' : '/production/repurpose')}>
                  去{TEMPLATE_KIND_CONFIG[tplKind].usedIn} <ArrowRight />
                </Button>
                <Button size="sm" onClick={() => setTplOpen(true)}>
                  <Plus /> 新建{tplKind === 'generate' ? '生成模板' : '目标格式'}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>模板</TableHead>
                    <TableHead>{tplKind === 'generate' ? '内容类型' : '渠道 · 产出类型'}</TableHead>
                    <TableHead>结构 / 长度</TableHead>
                    <TableHead>{tplKind === 'generate' ? '必需事实' : '素材规格 · 事实'}</TableHead>
                    <TableHead className="text-right">使用</TableHead>
                    <TableHead>启用</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownTemplates.map((t) => (
                    <TableRow key={t.templateId}>
                      <TableCell>
                        <div className="font-medium">{t.templateName}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.templateId} · {t.brandScope} · 更新于 {t.updatedAt}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {tplKind === 'generate' ? (
                          t.contentTypeName
                        ) : (
                          <>
                            <ToneBadge tone="blue">{t.channelLabel}</ToneBadge>
                            <div className="mt-0.5 text-xs text-muted-foreground">{t.contentTypeName}</div>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="max-w-64 text-sm whitespace-normal text-muted-foreground">{t.structure}</TableCell>
                      <TableCell>
                        {tplKind === 'generate' ? (
                          <div className="flex flex-wrap gap-1">
                            {t.requiredFactCategories.map((c) => (
                              <ToneBadge key={c} tone="teal">
                                {c}
                              </ToneBadge>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-0.5 text-xs">
                            <div>{t.assetSpec ?? <span className="text-muted-foreground">无素材要求</span>}</div>
                            <div className={t.inheritsFacts ? 'text-teal-700' : 'text-amber-700'}>{t.inheritsFacts ? '继承源内容事实（插槽）' : '事实写入正文，更新后需复核'}</div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.usageCount}</TableCell>
                      <TableCell>
                        <Switch
                          checked={t.enabled}
                          onCheckedChange={(c) => { setTemplates((p) => p.map((x) => (x.templateId === t.templateId ? { ...x, enabled: c } : x))); handleToggleTemplate(t.templateId, c); }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice" className="space-y-4 pt-3">
          <div className="flex items-center gap-3">
            <Select items={BRAND_OPTIONS} value={brand} onValueChange={(v) => { setBrand(v as string); handleFetchBrandVoice(v as string); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">近 30 天 Brand Voice 检查通过率 {voice.checkPassRate}%</span>
            <Button className="ml-auto" onClick={() => handleSaveBrandVoice(brand, voice)}>
              保存
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>语调</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea rows={3} value={voice.toneDescription} onChange={(e) => setVoice({ ...voice, toneDescription: e.target.value })} />
                <div className="flex flex-wrap gap-1.5">
                  {voice.personaTraits.map((t) => (
                    <ToneBadge key={t} tone="blue">
                      {t}
                    </ToneBadge>
                  ))}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="rounded-md bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                    <div className="mb-1 flex items-center gap-1 text-xs font-medium">
                      <CheckCheck className="size-3.5" /> 好的示例
                    </div>
                    {voice.goodExample}
                  </div>
                  <div className="rounded-md bg-red-50 p-3 text-red-900 dark:bg-red-950 dark:text-red-100">
                    <div className="mb-1 flex items-center gap-1 text-xs font-medium">
                      <Ban className="size-3.5" /> 不要这样写
                    </div>
                    {voice.badExample}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>用词规则</CardTitle>
                <CardDescription>禁用词命中即检查不通过；必用表述命中不到时给出提示。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-1.5">
                  <Label>禁用词</Label>
                  {voice.bannedPhrases.map((b) => (
                    <div key={b.phrase} className="flex items-center justify-between rounded-md border px-3 py-1.5">
                      <span className="font-medium text-red-700">{b.phrase}</span>
                      <span className="text-xs text-muted-foreground">{b.reason}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label>必用表述</Label>
                  {voice.requiredPhrases.map((r) => (
                    <div key={r.phrase} className="flex items-center justify-between rounded-md border px-3 py-1.5">
                      <span className="font-medium">{r.phrase}</span>
                      <span className="text-xs text-muted-foreground">{r.context}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input className="h-7" placeholder="输入禁用词，回车添加" value={newPhrase} onChange={(e) => setNewPhrase(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newPhrase.trim()) addBanned(); }} />
                  <Button size="sm" variant="outline" disabled={!newPhrase.trim()} onClick={() => addBanned()}>
                    <Plus /> 添加禁用词
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">添加后点右上角「保存」生效。</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="glossary" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>术语库</CardTitle>
              <CardDescription>翻译任务强制使用；“不翻译”的词保持原样；禁用变体出现时检查报错。</CardDescription>
              <CardAction className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleImportGlossary()}>
                  <Upload /> 导入
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleExportGlossary()}>
                  <Download /> 导出
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                className="h-8 max-w-xs"
                placeholder="搜索中文或英文术语"
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); handleFetchGlossary({ keyword: e.target.value, domain: 'all' }); }}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>中文</TableHead>
                    <TableHead>English</TableHead>
                    <TableHead>Deutsch</TableHead>
                    <TableHead>日本語</TableHead>
                    <TableHead>领域</TableHead>
                    <TableHead>禁用变体</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terms.map((t) => (
                    <TableRow key={t.termId}>
                      <TableCell className="font-medium">
                        {t.zhCN}
                        {t.doNotTranslate && <ToneBadge tone="amber" className="ml-1.5">不翻译</ToneBadge>}
                      </TableCell>
                      <TableCell>{t.enUS}</TableCell>
                      <TableCell>{t.deDE ?? <span className="text-red-600">缺</span>}</TableCell>
                      <TableCell>{t.jaJP ?? <span className="text-red-600">缺</span>}</TableCell>
                      <TableCell className="text-sm">{t.domain}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.forbiddenVariants.join('、') || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <FormDialog
        open={tplOpen}
        onOpenChange={setTplOpen}
        title={tplKind === 'generate' ? '新建生成模板' : '新建一稿多用目标格式'}
        description={tplKind === 'generate' ? '生成模板是 AI 生成的辅助：给出结构与必需事实提示，不选模板也能生成。' : '目标格式决定一稿多用时改写成什么样：渠道、长度、素材规格。'}
        fields={
          tplKind === 'generate'
            ? [
                { key: 'name', label: '模板名称', kind: 'text', required: true, placeholder: '例如：白皮书 · 行业应用' },
                { key: 'type', label: '内容类型', kind: 'select', options: CONTENT_TYPES.map((x) => ({ value: x, label: x })) },
                { key: 'channel', label: '主要用途', kind: 'text', placeholder: '例如：官网下载' },
                { key: 'structure', label: '结构', kind: 'textarea', required: true, placeholder: '例如：背景 → 方案 → 参数表 → 案例 → CTA' },
              ]
            : [
                { key: 'name', label: '模板名称', kind: 'text', required: true, placeholder: '例如：TikTok 短视频脚本' },
                { key: 'channel', label: '渠道', kind: 'select', options: ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'X', '微信公众号', '小红书'].map((x) => ({ value: x, label: x })) },
                { key: 'type', label: '产出内容类型', kind: 'select', options: ['社媒短帖', '公众号文章', '技术 FAQ', '落地页', '销售话术卡', '知识条目'].map((x) => ({ value: x, label: x })) },
                { key: 'structure', label: '格式与长度', kind: 'textarea', required: true, placeholder: '例如：脚本 ≤ 60 秒，3 个镜头，结尾 CTA' },
              ]
        }
        onSubmit={(v: FormValues) => {
          const prefix = tplKind === 'generate' ? 'TPL' : 'RF';
          const id = `${prefix}-${String(allTemplates.filter((t) => t.templateKind === tplKind).length + 1 + (tplKind === 'generate' ? 4 : 0)).padStart(2, '0')}`;
          const form = { templateKind: tplKind, templateName: String(v.name), contentTypeName: String(v.type), channelLabel: String(v.channel || '官网'), structure: String(v.structure) };
          handleCreateTemplate(form);
          dispatch({ type: 'addTemplate', template: { templateId: id, ...form, enabled: true } });
          if (tplKind === 'repurpose') setChannelGroup('all');
          notify(`已创建 ${id}「${form.templateName}」，已启用，在「${TEMPLATE_KIND_CONFIG[tplKind].usedIn}」中可选`);
        }}
      />
    </div>
  );
}
