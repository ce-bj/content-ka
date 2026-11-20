import { useState } from 'react';
import { Copy, KeyRound, Plus, Send, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { notify } from '@/components/shared/toast';
import { ToneBadge, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const APP_KIND_CONFIG = {
  website: { label: '官网 / AI 门户', tone: 'blue' as Tone },
  miniprogram: { label: '小程序', tone: 'green' as Tone },
  app: { label: 'App', tone: 'teal' as Tone },
  internal_agent: { label: '内部 Agent', tone: 'violet' as Tone },
  partner_portal: { label: '经销商门户', tone: 'amber' as Tone },
  external_agent: { label: '外部 Agent', tone: 'gray' as Tone },
} as const;
type AppKind = keyof typeof APP_KIND_CONFIG;
const MCP_LEVEL_CONFIG = {
  none: { label: '未开通', tone: 'gray' as Tone, hint: '' },
  readonly: { label: '只读', tone: 'green' as Tone, hint: '搜索与读取已生效内容、资产、事实' },
  write: { label: '写入', tone: 'blue' as Tone, hint: '可创建 / 更新草稿、上传资产、提交事实候选、送审' },
  high_risk: { label: '高风险', tone: 'red' as Tone, hint: '发布、下线、删除、改事实、改模型；每次调用强制人工确认' },
} as const;
type McpLevel = keyof typeof MCP_LEVEL_CONFIG;
const KIND_OPTIONS = (Object.keys(APP_KIND_CONFIG) as AppKind[]).map((k) => ({ value: k, label: APP_KIND_CONFIG[k].label }));
const ENV_OPTIONS = [
  { value: 'production', label: '生产' },
  { value: 'staging', label: '预发' },
];
const CONTENT_TYPE_OPTIONS = [
  { value: 'product_brief', label: '产品说明' },
  { value: 'tech_faq', label: '技术 FAQ' },
  { value: 'case_study', label: '客户案例' },
];

// API 与 SDK 文档入口（静态配置）
const API_DOCS = [
  { name: 'Delivery API', audience: '门户、小程序、经销商门户', description: '只返回已生效版本；按调用方的品牌 / 区域 / 语种 / 站点范围过滤。REST + GraphQL。', entry: 'GET /delivery/v1/entries?type=product_brief&locale=de-DE' },
  { name: 'Preview API', audience: '门户预览环境', description: '可取草稿与审核中版本，用于编辑器“预览”与门户联调。', entry: 'GET /preview/v1/entries/{id}?version=draft' },
  { name: 'Management API', audience: '集成方、批量导入、CI', description: '内容、数据表、资产、内容模型的读写；受角色与范围约束。', entry: 'POST /management/v1/entries' },
  { name: 'MCP Server', audience: 'AI 客服、SDR、SEO/GEO Agent', description: '只读 / 写入 / 高风险三级工具；写入类结果进入审核。', entry: 'mcp://cms.example.com/mcp' },
  { name: 'Webhook', audience: '门户、搜索索引、CRM', description: 'content.published / unpublished / updated、collection.updated 等事件。', entry: 'POST {your-endpoint}  X-Signature: sha256=…' },
  { name: 'SDK', audience: '前端与服务端开发', description: 'TypeScript 与 Java SDK，内置类型定义（由内容模型生成）、分页与重试。', entry: 'npm i @company/cms-sdk' },
];

// ── 类型 ──────────────────────────────────────────────────
interface ClientApp {
  appId: string;
  appName: string;
  appKind: AppKind;
  scopeLabel: string;
  environment: 'production' | 'staging';
  interfaces: ('delivery' | 'preview' | 'graphql' | 'mcp' | 'webhook')[];
  mcpLevel: McpLevel;
  status: 'active' | 'disabled';
  callsLast7d: number;
  deniedLast7d: number;
  lastCallAt: string;
}
interface McpTool {
  toolName: string;
  level: Exclude<McpLevel, 'none'>;
  description: string;
  generatedFrom: string;
  enabled: boolean;
  callsLast7d: number;
}
interface Webhook {
  webhookId: string;
  appName: string;
  events: string[];
  targetUrl: string;
  status: 'active' | 'failing' | 'paused';
  lastDelivery: string;
  failures24h: number;
}
interface CallLog {
  callId: string;
  appName: string;
  channel: 'rest' | 'graphql' | 'mcp';
  operation: string;
  actorLabel: string;
  contentRef: string;
  resultCode: number;
  reason: string;
  calledAt: string;
}
interface OutputMapping {
  contentTypeId: string;
  contentTypeName: string;
  schemaOrgType: string;
  fieldMappings: { schemaField: string; sourceField: string }[];
  markdownEnabled: boolean;
  jsonLdPreview: string;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockClientAppsData: ClientApp[] = [
  { appId: 'APP-01', appName: '欧盟官网（AI 门户）', appKind: 'website', scopeLabel: '北岭智造 · 欧盟 · en/de · 站点 eu.beiling.com', environment: 'production', interfaces: ['delivery', 'preview', 'webhook'], mcpLevel: 'none', status: 'active', callsLast7d: 31204, deniedLast7d: 0, lastCallAt: '09:41' },
  { appId: 'APP-07', appName: '中国官网（AI 门户）', appKind: 'website', scopeLabel: '北岭智造 · 中国大陆 · zh · 站点 www.beiling.cn', environment: 'production', interfaces: ['delivery', 'preview', 'webhook'], mcpLevel: 'none', status: 'active', callsLast7d: 6200, deniedLast7d: 0, lastCallAt: '09:40' },
  { appId: 'APP-02', appName: '北岭智造微信小程序', appKind: 'miniprogram', scopeLabel: '北岭智造 · 中国大陆 · zh', environment: 'production', interfaces: ['delivery', 'webhook'], mcpLevel: 'none', status: 'active', callsLast7d: 9820, deniedLast7d: 3, lastCallAt: '09:40' },
  { appId: 'APP-03', appName: 'GEO Agent', appKind: 'internal_agent', scopeLabel: '全部品牌 · 全部区域', environment: 'production', interfaces: ['mcp'], mcpLevel: 'write', status: 'active', callsLast7d: 4120, deniedLast7d: 12, lastCallAt: '08:55' },
  { appId: 'APP-04', appName: 'SDR Agent', appKind: 'internal_agent', scopeLabel: '全部品牌 · 欧盟 / 东南亚', environment: 'production', interfaces: ['mcp'], mcpLevel: 'readonly', status: 'active', callsLast7d: 2588, deniedLast7d: 0, lastCallAt: '09:38' },
  { appId: 'APP-05', appName: 'Nordwerk GmbH 经销商门户', appKind: 'partner_portal', scopeLabel: '北岭智造 · 欧盟 · 内容集合 COL-12', environment: 'production', interfaces: ['graphql'], mcpLevel: 'none', status: 'active', callsLast7d: 412, deniedLast7d: 27, lastCallAt: '昨天' },
  { appId: 'APP-06', appName: '集团 Copilot（客户自有 Claude）', appKind: 'external_agent', scopeLabel: '全部品牌 · 内部只读', environment: 'production', interfaces: ['mcp'], mcpLevel: 'readonly', status: 'disabled', callsLast7d: 0, deniedLast7d: 0, lastCallAt: '—' },
];

const mockMcpToolsData: McpTool[] = [
  { toolName: 'search_contents', level: 'readonly', description: '按关键词 / 语义在授权范围内搜索已生效内容', generatedFrom: '系统', enabled: true, callsLast7d: 3920 },
  { toolName: 'get_product_brief', level: 'readonly', description: '读取产品说明（含引用事实与 JSON-LD）', generatedFrom: '内容类型：产品说明', enabled: true, callsLast7d: 1688 },
  { toolName: 'get_fact', level: 'readonly', description: '查询事实取值、证据等级与有效期', generatedFrom: '系统', enabled: true, callsLast7d: 902 },
  { toolName: 'search_assets', level: 'readonly', description: '自然语言搜索可投放资产，只返回已审、有授权的资产', generatedFrom: '系统', enabled: true, callsLast7d: 344 },
  { toolName: 'create_tech_faq_draft', level: 'write', description: '创建技术 FAQ 草稿（带 AI 标识，需送审）', generatedFrom: '内容类型：技术 FAQ', enabled: true, callsLast7d: 61 },
  { toolName: 'submit_fact_candidate', level: 'write', description: '提交事实候选，待事实负责人确认', generatedFrom: '系统', enabled: true, callsLast7d: 8 },
  { toolName: 'publish_content', level: 'high_risk', description: '发布内容版本（强制人工确认）', generatedFrom: '系统', enabled: false, callsLast7d: 0 },
  { toolName: 'update_fact', level: 'high_risk', description: '修改事实取值（强制人工确认）', generatedFrom: '系统', enabled: false, callsLast7d: 0 },
];

const mockWebhooksData: Webhook[] = [
  { webhookId: 'WH-01', appName: '欧盟官网（AI 门户）', events: ['content.published', 'content.unpublished'], targetUrl: 'https://portal.beiling.eu/hooks/cms', status: 'active', lastDelivery: '09:12 · 200', failures24h: 0 },
  { webhookId: 'WH-02', appName: '北岭智造微信小程序', events: ['content.published'], targetUrl: 'https://mp-api.beiling.cn/cms/notify', status: 'failing', lastDelivery: '09:12 · 502（重试 3/5）', failures24h: 4 },
  { webhookId: 'WH-03', appName: 'GEO Agent', events: ['content.published', 'fact.changed'], targetUrl: 'mcp-gateway://geo-agent/events', status: 'active', lastDelivery: '07:40 · 200', failures24h: 0 },
];

// PAGINATION: page,pageSize
const mockCallLogsData: CallLog[] = [
  { callId: 'CALL-8812', appName: '欧盟官网（AI 门户）', channel: 'rest', operation: 'GET /contents/C-1002?locale=en-US', actorLabel: '—', contentRef: 'C-1002 v2', resultCode: 200, reason: '授权范围内', calledAt: '09:40:12' },
  { callId: 'CALL-8790', appName: 'GEO Agent', channel: 'mcp', operation: 'create_tech_faq_draft', actorLabel: '代表 林悦', contentRef: 'C-1015 草稿', resultCode: 200, reason: '写入级权限', calledAt: '08:55:03' },
  { callId: 'CALL-8788', appName: 'GEO Agent', channel: 'mcp', operation: 'publish_content', actorLabel: '代表 林悦', contentRef: 'C-1015', resultCode: 403, reason: '高风险工具未开启', calledAt: '08:54:40' },
  { callId: 'CALL-8702', appName: 'Nordwerk GmbH 经销商门户', channel: 'graphql', operation: 'query channelPack', actorLabel: '—', contentRef: 'C-1006 v1', resultCode: 403, reason: '内容已下线，不在可调用状态', calledAt: '昨天 16:10' },
  { callId: 'CALL-8650', appName: '北岭智造微信小程序', channel: 'rest', operation: 'GET /contents/C-1002?locale=en-US', actorLabel: '—', contentRef: 'C-1002', resultCode: 403, reason: '区域越界：小程序仅授权中国大陆', calledAt: '昨天 11:02' },
];

const mockOutputMappingData: OutputMapping = {
  contentTypeId: 'product_brief',
  contentTypeName: '产品说明',
  schemaOrgType: 'Product',
  fieldMappings: [
    { schemaField: 'name', sourceField: '标题' },
    { schemaField: 'description', sourceField: '机器可读摘要' },
    { schemaField: 'brand.name', sourceField: '品牌' },
    { schemaField: 'additionalProperty[]', sourceField: '参数表（事实插槽，带证据等级与有效期）' },
    { schemaField: 'image', sourceField: '主图（资产 CDN 地址）' },
  ],
  markdownEnabled: true,
  jsonLdPreview: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "BL-R600 6-Axis Industrial Robot",
  "description": "BL-R600 is a 20 kg payload six-axis robot ...",
  "brand": { "@type": "Brand", "name": "北岭智造" },
  "additionalProperty": [
    { "@type": "PropertyValue", "name": "Rated payload", "value": "20", "unitText": "kg",
      "description": "Evidence A; valid until 2028-06-01" }
  ]
}`,
};

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取调用方列表 [GET] /api/v1/client-apps
function handleFetchClientApps(params: { kind: AppKind | 'all' }) {
  console.log('fetch apps', params);
}

// ACTION: 新建调用方 [POST] /api/v1/client-apps
function handleCreateClientApp(form: { appName: string; appKind: AppKind; environment: string; brands: string[]; regions: string[]; interfaces: string[]; mcpLevel: McpLevel }) {
  console.log('create client app', form);
}

// ACTION: 轮换密钥 [POST] /api/v1/client-apps/{id}/tokens/rotate
function handleRotateToken(appId: string) {
  alert('新密钥已生成，旧密钥 24 小时后失效');
}

// ACTION: 启停调用方 [PATCH] /api/v1/client-apps/{id}
function handleToggleClientApp(appId: string, status: 'active' | 'disabled') {
  console.log('toggle app', appId, status);
}

// ACTION: 启停 MCP 工具 [PATCH] /api/v1/mcp/tools/{name}
function handleToggleMcpTool(toolName: string, enabled: boolean) {
  console.log('toggle tool', toolName, enabled);
}

// ACTION: 测试 Webhook [POST] /api/v1/webhooks/{id}/test
function handleTestWebhook(webhookId: string) {
  alert('已发送测试事件');
}

// ACTION: 获取调用日志 [GET] /api/v1/call-logs
function handleFetchCallLogs(params: { appId: string; result: string; page: number; pageSize: number }) {
  console.log('fetch logs', params);
}

// ACTION: 保存输出格式映射 [PUT] /api/v1/output-mappings/{contentTypeId}
function handleSaveOutputMapping(contentTypeId: string, mapping: { schemaOrgType: string; markdownEnabled: boolean }) {
  alert('输出格式已保存，下次发布时生效');
}

// ── 主组件 ────────────────────────────────────────────────
export default function DeliveryCenter() {
  const [apps, setApps] = useState(mockClientAppsData);
  const [createOpen, setCreateOpen] = useState(false);
  const [tools, setTools] = useState(mockMcpToolsData);
  const [logResult, setLogResult] = useState('all');
  const [mappingType, setMappingType] = useState('product_brief');
  const [form, setForm] = useState<{ appName: string; appKind: AppKind; environment: string; brands: string[]; regions: string[]; interfaces: string[]; mcpLevel: McpLevel }>({
    appName: '',
    appKind: 'website',
    environment: 'production',
    brands: ['北岭智造'],
    regions: ['欧盟'],
    interfaces: ['delivery'],
    mcpLevel: 'none',
  });
  const toggleIn = (key: 'brands' | 'regions' | 'interfaces', v: string, on: boolean) =>
    setForm((f) => ({ ...f, [key]: on ? [...f[key], v] : f[key].filter((x) => x !== v) }));

  const logs = mockCallLogsData.filter((l) => logResult === 'all' || (logResult === 'denied' ? l.resultCode >= 400 : l.resultCode < 400));
  const m = mockOutputMappingData;

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="下游分发"
        description="CMS 不渲染页面、不管站点：门户、社媒 Agent、AI 客服、SEO/GEO Agent 等对接平台各注册为一个调用方，绑定授权范围。服务端按品牌、区域、语种过滤，只下发已生效版本；越界返回 403 并留痕。哪些内容给谁用、按什么渠道标签取用，在「内容市场」中管理；这里管凭证、MCP 与调用日志。"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> 新建调用方
          </Button>
        }
      />

      <Tabs defaultValue="apps" onValueChange={(v) => v === 'apps' && handleFetchClientApps({ kind: 'all' })}>
        <TabsList>
          <TabsTrigger value="apps">调用方 {apps.length}</TabsTrigger>
          <TabsTrigger value="mcp">MCP 工具</TabsTrigger>
          <TabsTrigger value="webhooks">Webhook</TabsTrigger>
          <TabsTrigger value="logs">调用日志</TabsTrigger>
          <TabsTrigger value="format">输出格式</TabsTrigger>
          <TabsTrigger value="sdk">API 与 SDK</TabsTrigger>
        </TabsList>

        <TabsContent value="apps" className="pt-3">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>调用方</TableHead>
                    <TableHead>授权范围</TableHead>
                    <TableHead>接口</TableHead>
                    <TableHead>MCP 权限</TableHead>
                    <TableHead className="text-right">近 7 天调用 / 拒绝</TableHead>
                    <TableHead>启用</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.map((a) => (
                    <TableRow key={a.appId}>
                      <TableCell>
                        <div className="font-medium">{a.appName}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <ToneBadge tone={APP_KIND_CONFIG[a.appKind].tone}>{APP_KIND_CONFIG[a.appKind].label}</ToneBadge>
                          {a.appId} · {a.environment === 'production' ? '生产' : '预发'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{a.scopeLabel}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {a.interfaces.map((i) => (
                            <ToneBadge key={i} tone="gray" className="font-mono text-[10px]">
                              {i}
                            </ToneBadge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={MCP_LEVEL_CONFIG[a.mcpLevel].tone}>{MCP_LEVEL_CONFIG[a.mcpLevel].label}</ToneBadge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.callsLast7d.toLocaleString()} / <span className={cn(a.deniedLast7d > 0 && 'text-red-600')}>{a.deniedLast7d}</span>
                      </TableCell>
                      <TableCell>
                        <Switch defaultChecked={a.status === 'active'} onCheckedChange={(c) => handleToggleClientApp(a.appId, c ? 'active' : 'disabled')} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="xs" variant="outline" onClick={() => handleRotateToken(a.appId)}>
                          <KeyRound /> 轮换密钥
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mcp" className="space-y-3 pt-3">
          <Alert>
            <ShieldAlert />
            <AlertTitle>MCP 与人走同一套权限</AlertTitle>
            <AlertDescription>工具按内容模型自动生成。调用方只能使用其 MCP 级别以内的工具；高风险工具默认关闭，开启后每次调用都需人工确认。所有调用记录「哪个 Agent、代表谁、调了什么」。</AlertDescription>
          </Alert>
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>工具</TableHead>
                    <TableHead>级别</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead className="text-right">近 7 天</TableHead>
                    <TableHead>启用</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.map((t) => (
                    <TableRow key={t.toolName}>
                      <TableCell className="font-mono text-sm">{t.toolName}</TableCell>
                      <TableCell>
                        <ToneBadge tone={MCP_LEVEL_CONFIG[t.level].tone}>{MCP_LEVEL_CONFIG[t.level].label}</ToneBadge>
                      </TableCell>
                      <TableCell className="max-w-80 text-sm whitespace-normal">{t.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.generatedFrom}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.callsLast7d}</TableCell>
                      <TableCell>
                        <Switch
                          checked={t.enabled}
                          onCheckedChange={(c) => {
                            if (c && t.level === 'high_risk' && !confirm('开启高风险工具：每次调用仍需人工确认。确定开启？')) return;
                            setTools((prev) => prev.map((x) => (x.toolName === t.toolName ? { ...x, enabled: c } : x)));
                            handleToggleMcpTool(t.toolName, c);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>Webhook</CardTitle>
              <CardDescription>内容生效、下线、更新与事实变更时通知调用方。带签名，失败按指数退避重试 5 次，之后进入死信可重放。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>调用方</TableHead>
                    <TableHead>事件</TableHead>
                    <TableHead>地址</TableHead>
                    <TableHead>最近投递</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockWebhooksData.map((w) => (
                    <TableRow key={w.webhookId}>
                      <TableCell>{w.appName}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {w.events.map((e) => (
                            <ToneBadge key={e} tone="gray" className="font-mono text-[10px]">
                              {e}
                            </ToneBadge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-56 truncate font-mono text-xs">{w.targetUrl}</TableCell>
                      <TableCell className="text-xs">{w.lastDelivery}</TableCell>
                      <TableCell>
                        <ToneBadge tone={w.status === 'active' ? 'green' : w.status === 'failing' ? 'red' : 'gray'}>
                          {w.status === 'active' ? '正常' : w.status === 'failing' ? `失败 ${w.failures24h} 次` : '已暂停'}
                        </ToneBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="xs" variant="outline" onClick={() => handleTestWebhook(w.webhookId)}>
                          <Send /> 测试
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>调用日志</CardTitle>
              <CardAction>
                <LogResultFilter value={logResult} onChange={(v) => { setLogResult(v); handleFetchCallLogs({ appId: 'all', result: v, page: 1, pageSize: 50 }); }} />
              </CardAction>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>调用方</TableHead>
                    <TableHead>通道</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>代表</TableHead>
                    <TableHead>结果</TableHead>
                    <TableHead>原因</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.callId}>
                      <TableCell className="text-xs text-muted-foreground">{l.calledAt}</TableCell>
                      <TableCell className="text-sm">{l.appName}</TableCell>
                      <TableCell className="text-xs uppercase">{l.channel}</TableCell>
                      <TableCell className="font-mono text-xs">{l.operation}</TableCell>
                      <TableCell className="text-xs">{l.actorLabel}</TableCell>
                      <TableCell>
                        <ToneBadge tone={l.resultCode < 400 ? 'green' : 'red'}>{l.resultCode}</ToneBadge>
                      </TableCell>
                      <TableCell className="text-xs">{l.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sdk" className="pt-3">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {API_DOCS.map((d) => (
              <Card key={d.name} size="sm">
                <CardHeader>
                  <CardTitle>{d.name}</CardTitle>
                  <CardDescription>{d.audience}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{d.description}</p>
                  <code className="block rounded bg-muted px-2 py-1 text-xs">{d.entry}</code>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">接入方（门户、社媒 Agent、AI 客服、SEO/GEO Agent 等）用以上接口与 SDK 取内容；鉴权用调用方密钥，范围由「调用方」授权决定。</p>
        </TabsContent>

        <TabsContent value="format" className="pt-3">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>输出格式映射</CardTitle>
                <CardDescription>同一份内容可按 JSON、Markdown（给 AI 引用）、Schema.org JSON-LD（给搜索与 AI 引擎）输出。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Label className="w-20">内容类型</Label>
                  <Select items={CONTENT_TYPE_OPTIONS} value={mappingType} onValueChange={(v) => setMappingType(v as string)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ToneBadge tone="blue">schema.org/{m.schemaOrgType}</ToneBadge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>JSON-LD 字段</TableHead>
                      <TableHead>来源字段</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {m.fieldMappings.map((f) => (
                      <TableRow key={f.schemaField}>
                        <TableCell className="font-mono text-xs">{f.schemaField}</TableCell>
                        <TableCell>{f.sourceField}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center gap-2">
                  <Switch defaultChecked={m.markdownEnabled} /> 同时输出 Markdown 版本
                </div>
                <Button size="sm" onClick={() => handleSaveOutputMapping(mappingType, { schemaOrgType: m.schemaOrgType, markdownEnabled: m.markdownEnabled })}>
                  保存
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>预览 · C-1002 v2</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">{m.jsonLdPreview}</pre>
                <Button size="xs" variant="ghost" className="mt-2" onClick={() => navigator.clipboard?.writeText(m.jsonLdPreview)}>
                  <Copy /> 复制
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 新建调用方 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建调用方</DialogTitle>
            <DialogDescription>授权范围在服务端强制生效；超出范围的请求返回 403。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>名称</Label>
                <Input value={form.appName} onChange={(e) => setForm({ ...form, appName: e.target.value })} placeholder="如：东南亚官网" />
              </div>
              <div className="space-y-1.5">
                <Label>类型</Label>
                <Select items={KIND_OPTIONS} value={form.appKind} onValueChange={(v) => setForm({ ...form, appKind: v as AppKind })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>环境</Label>
                <Select items={ENV_OPTIONS} value={form.environment} onValueChange={(v) => setForm({ ...form, environment: v as string })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENV_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(
              [
                ['brands', '品牌', ['北岭智造', '汉川传动']],
                ['regions', '区域', ['中国大陆', '欧盟', '东南亚', '北美']],
                ['interfaces', '接口', ['delivery', 'preview', 'graphql', 'webhook', 'mcp']],
              ] as const
            ).map(([key, label, opts]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <div className="flex flex-wrap gap-3">
                  {opts.map((o) => (
                    <label key={o} className="flex items-center gap-1.5">
                      <Checkbox checked={form[key].includes(o)} onCheckedChange={(c) => toggleIn(key, o, !!c)} /> {o}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {form.interfaces.includes('mcp') && (
              <div className="space-y-1.5">
                <Label>MCP 权限级别</Label>
                <RadioGroup value={form.mcpLevel} onValueChange={(v) => setForm({ ...form, mcpLevel: v as McpLevel })} className="space-y-1">
                  {(['readonly', 'write', 'high_risk'] as McpLevel[]).map((lv) => (
                    <label key={lv} className="flex items-start gap-2">
                      <RadioGroupItem value={lv} className="mt-0.5" />
                      <span>
                        <span className="font-medium">{MCP_LEVEL_CONFIG[lv].label}</span>
                        <span className="text-xs text-muted-foreground"> · {MCP_LEVEL_CONFIG[lv].hint}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              disabled={!form.appName}
              onClick={() => {
                handleCreateClientApp(form);
                setApps((prev) => [...prev, { appId: `APP-${String(prev.length + 1).padStart(2, '0')}`, appName: form.appName, appKind: form.appKind, scopeLabel: `${form.brands.join(' / ') || '全部品牌'} · ${form.regions.join(' / ') || '全部区域'}`, environment: form.environment as ClientApp['environment'], interfaces: form.interfaces as ClientApp['interfaces'], mcpLevel: form.mcpLevel, status: 'active', callsLast7d: 0, deniedLast7d: 0, lastCallAt: '—' }]);
                notify(`调用方「${form.appName}」已创建。密钥 cms_live_••••7f3a 只显示这一次，请立即复制`);
                setCreateOpen(false);
              }}
            >
              创建并生成密钥
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 日志结果筛选（卡片右上角）
function LogResultFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const items = [
    { value: 'all', label: '全部结果' },
    { value: 'ok', label: '成功' },
    { value: 'denied', label: '拒绝 / 失败' },
  ];
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(v as string)}>
        <SelectTrigger size="sm" className="w-32">
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
}
