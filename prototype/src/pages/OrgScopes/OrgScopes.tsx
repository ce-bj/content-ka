import { useState } from 'react';
import { Building2, Globe2, Languages, Megaphone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormDialog, type FormValues } from '@/components/shared/FormDialog';
import { notify } from '@/components/shared/toast';
import { ToneBadge } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 类型 ──────────────────────────────────────────────────
interface OrgUnit {
  unitId: string;
  unitName: string;
  unitKind: 'group' | 'brand' | 'division';
  parentId: string | null;
  contentCount: number;
  adminName: string | null;
  inheritsVoice: boolean;
}
interface Region {
  regionCode: string;
  regionName: string;
  defaultLocale: string;
  locales: string[];
  timezone: string;
  complianceNotes: string;
  contentCount: number;
}
interface LocaleSetting {
  localeCode: string;
  localeName: string;
  fallbackLocale: string | null;
  enabled: boolean;
  requiresHumanReview: boolean;
  glossaryCoverage: number;
}
interface SiteInfo {
  siteId: string;
  siteName: string;
  domain: string;
  brandName: string;
  regionLabel: string;
  locales: string[];
  hreflangGroup: string;
  servedBy: string;
  contentCount: number;
}
interface Channel {
  channelId: string;
  channelName: string;
  channelKind: string;
  consumerCount: number;
  formatHint: string;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockOrgUnitsData: OrgUnit[] = [
  { unitId: 'grp', unitName: '北岭集团', unitKind: 'group', parentId: null, contentCount: 11, adminName: '陈立', inheritsVoice: false },
  { unitId: 'beiling', unitName: '北岭智造', unitKind: 'brand', parentId: 'grp', contentCount: 158, adminName: '周敏', inheritsVoice: false },
  { unitId: 'bl-robot', unitName: '工业机器人事业部', unitKind: 'division', parentId: 'beiling', contentCount: 131, adminName: '赵启', inheritsVoice: true },
  { unitId: 'bl-env', unitName: '环保设备事业部', unitKind: 'division', parentId: 'beiling', contentCount: 27, adminName: null, inheritsVoice: true },
  { unitId: 'hanchuan', unitName: '汉川传动', unitKind: 'brand', parentId: 'grp', contentCount: 68, adminName: '刘畅', inheritsVoice: false },
];

const mockRegionsData: Region[] = [
  { regionCode: 'cn', regionName: '中国大陆', defaultLocale: 'zh-CN', locales: ['zh-CN'], timezone: 'Asia/Shanghai', complianceNotes: '广告法绝对化用语检查', contentCount: 96 },
  { regionCode: 'eu', regionName: '欧盟', defaultLocale: 'en-US', locales: ['en-US', 'de-DE', 'fr-FR'], timezone: 'Europe/Berlin', complianceNotes: 'CE 标识、GDPR 案例授权', contentCount: 82 },
  { regionCode: 'sea', regionName: '东南亚', defaultLocale: 'en-US', locales: ['en-US', 'th-TH', 'vi-VN'], timezone: 'Asia/Singapore', complianceNotes: '—', contentCount: 38 },
  { regionCode: 'na', regionName: '北美', defaultLocale: 'en-US', locales: ['en-US'], timezone: 'America/Chicago', complianceNotes: 'UL 认证表述', contentCount: 21 },
];

const mockLocalesData: LocaleSetting[] = [
  { localeCode: 'zh-CN', localeName: '简体中文', fallbackLocale: null, enabled: true, requiresHumanReview: false, glossaryCoverage: 100 },
  { localeCode: 'en-US', localeName: 'English', fallbackLocale: 'zh-CN', enabled: true, requiresHumanReview: true, glossaryCoverage: 98 },
  { localeCode: 'de-DE', localeName: 'Deutsch', fallbackLocale: 'en-US', enabled: true, requiresHumanReview: true, glossaryCoverage: 86 },
  { localeCode: 'ja-JP', localeName: '日本語', fallbackLocale: 'en-US', enabled: true, requiresHumanReview: true, glossaryCoverage: 64 },
  { localeCode: 'vi-VN', localeName: 'Tiếng Việt', fallbackLocale: 'en-US', enabled: false, requiresHumanReview: true, glossaryCoverage: 12 },
];

const mockSitesData: SiteInfo[] = [
  { siteId: 'beiling-cn', siteName: '北岭官网 · 中国', domain: 'www.beiling.cn', brandName: '北岭智造', regionLabel: '中国大陆', locales: ['zh-CN'], hreflangGroup: 'beiling-global', servedBy: 'AI 门户', contentCount: 96 },
  { siteId: 'beiling-eu', siteName: '北岭官网 · 欧盟', domain: 'eu.beiling.com', brandName: '北岭智造', regionLabel: '欧盟', locales: ['en-US', 'de-DE', 'fr-FR'], hreflangGroup: 'beiling-global', servedBy: 'AI 门户（反向代理挂在客户现有域名下）', contentCount: 82 },
  { siteId: 'beiling-sea', siteName: '北岭官网 · 东南亚', domain: 'sea.beiling.com', brandName: '北岭智造', regionLabel: '东南亚', locales: ['en-US', 'th-TH', 'vi-VN'], hreflangGroup: 'beiling-global', servedBy: 'AI 门户', contentCount: 38 },
  { siteId: 'hanchuan', siteName: '汉川传动官网', domain: 'www.hanchuan.com', brandName: '汉川传动', regionLabel: '全部区域', locales: ['zh-CN', 'en-US'], hreflangGroup: 'hanchuan', servedBy: '客户自有网站（只取内容）', contentCount: 21 },
];

const mockChannelsData: Channel[] = [
  { channelId: 'web', channelName: '官网', channelKind: '网站', consumerCount: 2, formatHint: 'JSON + JSON-LD' },
  { channelId: 'ai_cs', channelName: 'AI 问答（SDR）', channelKind: 'AI 问答', consumerCount: 1, formatHint: 'Markdown 分块' },
  { channelId: 'mcp', channelName: 'MCP Agent', channelKind: 'Agent', consumerCount: 3, formatHint: 'MCP 工具返回' },
  { channelId: 'dealer', channelName: '经销商门户', channelKind: '门户', consumerCount: 1, formatHint: 'JSON' },
  { channelId: 'mini', channelName: '微信小程序', channelKind: '小程序', consumerCount: 1, formatHint: 'JSON（图片压缩）' },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取组织单元 [GET] /api/v1/org-units
function handleFetchOrgUnits() {
  console.log('fetch org units');
}

// ACTION: 新建组织单元 [POST] /api/v1/org-units
function handleCreateOrgUnit(parentId: string | null) {
  console.log('create org unit', parentId);
}

// ACTION: 获取区域 [GET] /api/v1/regions
function handleFetchRegions() {
  console.log('fetch regions');
}

// ACTION: 新建区域 [POST] /api/v1/regions
function handleCreateRegion() {
  console.log('create region');
}

// ACTION: 获取语种设置 [GET] /api/v1/locales
function handleFetchLocales() {
  console.log('fetch locales');
}

// ACTION: 更新语种设置 [PATCH] /api/v1/locales/{code}
function handleUpdateLocale(localeCode: string, patch: Partial<LocaleSetting>) {
  console.log('update locale', localeCode, patch);
}

// ACTION: 获取站点 [GET] /api/v1/sites
function handleFetchSites() {
  console.log('fetch sites');
}

// ACTION: 获取渠道 [GET] /api/v1/channels
function handleFetchChannels() {
  console.log('fetch channels');
}

// ── 主组件 ────────────────────────────────────────────────
const UNIT_KIND_LABEL = { group: '集团', brand: '品牌', division: '事业部' } as const;

export default function OrgScopes() {
  const [units, setUnits] = useState(mockOrgUnitsData);
  const [regions, setRegions] = useState(mockRegionsData);
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitParent, setUnitParent] = useState<string | null>(null);
  const [regionOpen, setRegionOpen] = useState(false);
  const [locales, setLocales] = useState(mockLocalesData);
  const depth = (u: OrgUnit): number => (u.parentId ? 1 + depth(units.find((x) => x.unitId === u.parentId)!) : 0);

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="组织与范围"
        description="内容、事实、权限都按「范围」划分：品牌 / 事业部 × 区域 × 语种 × 站点 / 渠道。范围与 KDH 共用同一套划分。顶栏的范围切换器和成员的数据权限都来自这里。渠道用来区分内容去向。"
      />

      <Tabs
        defaultValue="org"
        onValueChange={(v) => {
          if (v === 'org') handleFetchOrgUnits();
          if (v === 'regions') handleFetchRegions();
          if (v === 'locales') handleFetchLocales();
          if (v === 'channels') handleFetchChannels();
          if (v === 'sites') handleFetchSites();
        }}
      >
        <TabsList>
          <TabsTrigger value="org">
            <Building2 /> 品牌与事业部
          </TabsTrigger>
          <TabsTrigger value="regions">
            <Globe2 /> 区域
          </TabsTrigger>
          <TabsTrigger value="locales">
            <Languages /> 语种
          </TabsTrigger>
          <TabsTrigger value="sites">
            <Globe2 /> 站点
          </TabsTrigger>
          <TabsTrigger value="channels">
            <Megaphone /> 渠道
          </TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>组织层级</CardTitle>
              <CardDescription>下级默认继承上级的 Brand Voice、审批流程和发布检查规则，可单独覆盖。</CardDescription>
              <CardAction>
                <Button size="sm" onClick={() => { setUnitParent(null); setUnitOpen(true); }}>
                  <Plus /> 新建
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>层级</TableHead>
                    <TableHead>管理员</TableHead>
                    <TableHead className="text-right">内容数</TableHead>
                    <TableHead>Brand Voice</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((u) => (
                    <TableRow key={u.unitId}>
                      <TableCell className="font-medium" style={{ paddingLeft: `${8 + depth(u) * 20}px` }}>
                        {depth(u) > 0 && <span className="mr-1 text-muted-foreground">└</span>}
                        {u.unitName}
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={u.unitKind === 'brand' ? 'blue' : u.unitKind === 'group' ? 'violet' : 'gray'}>{UNIT_KIND_LABEL[u.unitKind]}</ToneBadge>
                      </TableCell>
                      <TableCell className="text-sm">{u.adminName ?? <span className="text-amber-600">未指定</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{u.contentCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.inheritsVoice ? '继承上级' : '独立配置'}</TableCell>
                      <TableCell className="text-right">
                        {u.unitKind !== 'division' && (
                          <Button size="xs" variant="ghost" onClick={() => { setUnitParent(u.unitId); setUnitOpen(true); }}>
                            <Plus /> 下级
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

        <TabsContent value="regions" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>区域</CardTitle>
              <CardDescription>事实可以按区域取不同值（例如交付周期），内容按区域发布。</CardDescription>
              <CardAction>
                <Button size="sm" onClick={() => setRegionOpen(true)}>
                  <Plus /> 新建区域
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>区域</TableHead>
                    <TableHead>语种</TableHead>
                    <TableHead>时区</TableHead>
                    <TableHead>合规要求</TableHead>
                    <TableHead className="text-right">内容数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regions.map((r) => (
                    <TableRow key={r.regionCode}>
                      <TableCell>
                        <div className="font-medium">{r.regionName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{r.regionCode}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.locales.map((l) => (
                            <ToneBadge key={l} tone={l === r.defaultLocale ? 'blue' : 'gray'}>
                              {l}
                              {l === r.defaultLocale && ' · 默认'}
                            </ToneBadge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{r.timezone}</TableCell>
                      <TableCell className="text-sm">{r.complianceNotes}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.contentCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locales" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>语种</CardTitle>
              <CardDescription>调用方请求的语种没有内容时，按回退语种返回，并在响应里标明。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>语种</TableHead>
                    <TableHead>回退到</TableHead>
                    <TableHead>术语覆盖</TableHead>
                    <TableHead>译文需人工校对</TableHead>
                    <TableHead>启用</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locales.map((l) => (
                    <TableRow key={l.localeCode} className={cn(!l.enabled && 'opacity-60')}>
                      <TableCell>
                        <span className="font-medium">{l.localeName}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{l.localeCode}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{l.fallbackLocale ?? '—'}</TableCell>
                      <TableCell className={cn('tabular-nums', l.glossaryCoverage < 70 && 'text-amber-600')}>{l.glossaryCoverage}%</TableCell>
                      <TableCell>
                        <Switch
                          checked={l.requiresHumanReview}
                          onCheckedChange={(c) => { setLocales((p) => p.map((x) => (x.localeCode === l.localeCode ? { ...x, requiresHumanReview: c } : x))); handleUpdateLocale(l.localeCode, { requiresHumanReview: c }); }}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={l.enabled}
                          onCheckedChange={(c) => { setLocales((p) => p.map((x) => (x.localeCode === l.localeCode ? { ...x, enabled: c } : x))); handleUpdateLocale(l.localeCode, { enabled: c }); }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sites" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>站点</CardTitle>
              <CardDescription>站点由门户或客户网站承载（对接），CMS 只管理“内容属于哪个站点、哪个语种对应哪个页面”。同一 hreflang 组内的站点互相输出 hreflang 关系；调用方可以按站点授权。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>站点</TableHead>
                    <TableHead>品牌 · 区域</TableHead>
                    <TableHead>语种</TableHead>
                    <TableHead>hreflang 组</TableHead>
                    <TableHead>承载方（对接）</TableHead>
                    <TableHead className="text-right">内容数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockSitesData.map((x) => (
                    <TableRow key={x.siteId}>
                      <TableCell>
                        <div className="font-medium">{x.siteName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{x.domain}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {x.brandName} · {x.regionLabel}
                      </TableCell>
                      <TableCell className="text-xs">{x.locales.join(' / ')}</TableCell>
                      <TableCell className="font-mono text-xs">{x.hreflangGroup}</TableCell>
                      <TableCell className="text-xs">{x.servedBy}</TableCell>
                      <TableCell className="text-right tabular-nums">{x.contentCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="pt-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mockChannelsData.map((c) => (
              <Card key={c.channelId} size="sm">
                <CardHeader>
                  <CardTitle>{c.channelName}</CardTitle>
                  <CardDescription>{c.channelKind}</CardDescription>
                  <CardAction>
                    <ToneBadge tone="blue">{c.consumerCount} 个调用方</ToneBadge>
                  </CardAction>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">默认输出：{c.formatHint}</CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <FormDialog
        open={unitOpen}
        onOpenChange={setUnitOpen}
        title={unitParent ? '新建下级单元' : '新建品牌 / 事业部'}
        description="下级默认继承上级的 Brand Voice、审批流程和发布检查规则。"
        fields={[
          { key: 'name', label: '名称', kind: 'text', required: true, placeholder: '例如：协作机器人事业部' },
          { key: 'kind', label: '层级', kind: 'select', options: [{ value: 'division', label: '事业部' }, { value: 'brand', label: '品牌' }], defaultValue: unitParent ? 'division' : 'brand' },
          { key: 'parent', label: '上级', kind: 'select', options: units.filter((u) => u.unitKind !== 'division').map((u) => ({ value: u.unitId, label: u.unitName })), defaultValue: unitParent ?? 'grp' },
          { key: 'admin', label: '管理员', kind: 'text', placeholder: '可稍后指定' },
          { key: 'inherit', label: 'Brand Voice', kind: 'select', options: [{ value: 'yes', label: '继承上级' }, { value: 'no', label: '独立配置' }] },
        ]}
        onSubmit={(v: FormValues) => {
          handleCreateOrgUnit(String(v.parent));
          const unit = { unitId: `u-${Date.now()}`, unitName: String(v.name), unitKind: v.kind as OrgUnit['unitKind'], parentId: String(v.parent), contentCount: 0, adminName: String(v.admin) || null, inheritsVoice: v.inherit === 'yes' };
          setUnits((prev) => {
            const at = prev.findIndex((x) => x.unitId === unit.parentId);
            return [...prev.slice(0, at + 1), unit, ...prev.slice(at + 1)];
          });
          notify(`已创建「${unit.unitName}」`);
        }}
      />
      <FormDialog
        open={regionOpen}
        onOpenChange={setRegionOpen}
        title="新建区域"
        description="事实可以按区域取不同值，内容按区域发布。"
        fields={[
          { key: 'code', label: '编码', kind: 'text', required: true, placeholder: '例如 mena' },
          { key: 'name', label: '名称', kind: 'text', required: true, placeholder: '例如 中东' },
          { key: 'locales', label: '语种', kind: 'multi', required: true, options: ['zh-CN', 'en-US', 'de-DE', 'fr-FR', 'ja-JP', 'th-TH', 'vi-VN', 'ar-SA'].map((x) => ({ value: x, label: x })) },
          { key: 'timezone', label: '时区', kind: 'select', options: ['Asia/Dubai', 'Asia/Shanghai', 'Europe/Berlin', 'America/Chicago', 'Asia/Singapore'].map((x) => ({ value: x, label: x })) },
          { key: 'compliance', label: '合规要求', kind: 'text', placeholder: '例如：阿语右到左排版' },
        ]}
        onSubmit={(v: FormValues) => {
          handleCreateRegion();
          const locales = v.locales as string[];
          setRegions((prev) => [...prev, { regionCode: String(v.code), regionName: String(v.name), defaultLocale: locales[0], locales, timezone: String(v.timezone), complianceNotes: String(v.compliance) || '—', contentCount: 0 }]);
          notify(`已创建区域「${v.name}」`);
        }}
      />
    </div>
  );
}
