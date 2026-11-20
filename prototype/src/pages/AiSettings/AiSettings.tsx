import { useState } from 'react';
import { Plug, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormDialog, type FormValues } from '@/components/shared/FormDialog';
import { notify } from '@/components/shared/toast';
import { ToneBadge, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const MODEL_OPTIONS = [
  { value: 'claude-sonnet', label: 'Claude Sonnet（云端）' },
  { value: 'claude-opus', label: 'Claude Opus（云端）' },
  { value: 'qwen-private', label: '通义千问（私有化）' },
  { value: 'deepseek-private', label: 'DeepSeek（私有化）' },
  { value: 'paddleocr', label: 'PaddleOCR（本地）' },
  { value: 'funasr', label: 'FunASR（本地）' },
  { value: 'bge-m3', label: 'bge-m3（本地向量）' },
];
const RISK_CONFIG = {
  read: { label: '只读', tone: 'green' as Tone },
  write: { label: '写入', tone: 'amber' as Tone },
  high: { label: '高风险', tone: 'red' as Tone },
} as const;
type RiskLevel = keyof typeof RISK_CONFIG;

// ── 类型 ──────────────────────────────────────────────────
interface AiCapability {
  capabilityId: string;
  capabilityName: string;
  category: '生成' | '理解' | '检查' | '检索';
  modelId: string;
  enabled: boolean;
  dataLeavesNetwork: boolean;
  requiresHumanConfirm: boolean;
  callsLast30d: number;
}
interface AiUsageStats {
  monthBudgetTokens: number;
  usedTokens: number;
  byCapability: { capabilityName: string; tokens: number }[];
}
interface ExternalMcpTool {
  serverId: string;
  serverName: string;
  endpoint: string;
  toolNames: string[];
  riskLevel: RiskLevel;
  usedBy: string[];
  enabled: boolean;
  lastHealthCheck: string;
  healthy: boolean;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockAiCapabilitiesData: AiCapability[] = [
  { capabilityId: 'gen_template', capabilityName: 'AI 生成 / 一稿多用', category: '生成', modelId: 'claude-sonnet', enabled: true, dataLeavesNetwork: true, requiresHumanConfirm: true, callsLast30d: 1820 },
  { capabilityId: 'rewrite', capabilityName: '改写、扩写、缩写', category: '生成', modelId: 'claude-sonnet', enabled: true, dataLeavesNetwork: true, requiresHumanConfirm: true, callsLast30d: 4210 },
  { capabilityId: 'translate', capabilityName: '翻译（术语库约束）', category: '生成', modelId: 'qwen-private', enabled: true, dataLeavesNetwork: false, requiresHumanConfirm: true, callsLast30d: 960 },
  { capabilityId: 'claim_extract', capabilityName: '正文事实声明抽取（冲突检测）', category: '检查', modelId: 'claude-opus', enabled: true, dataLeavesNetwork: true, requiresHumanConfirm: false, callsLast30d: 3100 },
  { capabilityId: 'brand_voice', capabilityName: 'Brand Voice 检查', category: '检查', modelId: 'claude-sonnet', enabled: true, dataLeavesNetwork: true, requiresHumanConfirm: false, callsLast30d: 5400 },
  { capabilityId: 'ocr', capabilityName: '证书 / 文档 OCR', category: '理解', modelId: 'paddleocr', enabled: true, dataLeavesNetwork: false, requiresHumanConfirm: true, callsLast30d: 640 },
  { capabilityId: 'asr', capabilityName: '视频字幕与摘要', category: '理解', modelId: 'funasr', enabled: true, dataLeavesNetwork: false, requiresHumanConfirm: true, callsLast30d: 88 },
  { capabilityId: 'embedding', capabilityName: '自然语言搜索（向量）', category: '检索', modelId: 'bge-m3', enabled: true, dataLeavesNetwork: false, requiresHumanConfirm: false, callsLast30d: 21800 },
  { capabilityId: 'schema_ai', capabilityName: 'AI 建模（字段草案）', category: '生成', modelId: 'claude-sonnet', enabled: false, dataLeavesNetwork: true, requiresHumanConfirm: true, callsLast30d: 0 },
];

const mockAiUsageStats: AiUsageStats = {
  monthBudgetTokens: 60_000_000,
  usedTokens: 38_400_000,
  byCapability: [
    { capabilityName: 'Brand Voice 检查', tokens: 11_200_000 },
    { capabilityName: '改写、扩写、缩写', tokens: 9_600_000 },
    { capabilityName: '正文事实声明抽取', tokens: 8_100_000 },
    { capabilityName: 'AI 生成 / 一稿多用', tokens: 7_300_000 },
    { capabilityName: '其他', tokens: 2_200_000 },
  ],
};

const mockExternalMcpToolsData: ExternalMcpTool[] = [
  { serverId: 'mcp-kdh', serverName: '企业知识库 KDH', endpoint: 'https://kdh.internal/mcp', toolNames: ['search_knowledge', 'get_document'], riskLevel: 'read', usedBy: ['AI 生成', '编辑器 AI 面板'], enabled: true, lastHealthCheck: '1 分钟前', healthy: true },
  { serverId: 'mcp-pim', serverName: 'Pimcore PIM', endpoint: 'https://pim.internal/mcp', toolNames: ['get_product', 'list_variants'], riskLevel: 'read', usedBy: ['事实录入预检'], enabled: true, lastHealthCheck: '1 分钟前', healthy: true },
  { serverId: 'mcp-figma', serverName: '设计稿（Figma）', endpoint: 'https://mcp.figma.example/v1', toolNames: ['get_frame_image'], riskLevel: 'read', usedBy: ['资产导入'], enabled: true, lastHealthCheck: '5 分钟前', healthy: false },
  { serverId: 'mcp-video', serverName: 'AI 视频剪辑（外部工具）', endpoint: 'https://video-tool.example.com/mcp', toolNames: ['cut_highlights', 'add_subtitles'], riskLevel: 'write', usedBy: ['资产库 · 视频'], enabled: true, lastHealthCheck: '2 分钟前', healthy: true },
  { serverId: 'mcp-voice', serverName: 'AI 多语配音（外部工具）', endpoint: 'https://voice-tool.example.com/mcp', toolNames: ['dub_video'], riskLevel: 'write', usedBy: ['翻译任务'], enabled: true, lastHealthCheck: '2 分钟前', healthy: true },
  { serverId: 'mcp-podcast', serverName: 'AI 播客生成（外部工具）', endpoint: 'https://podcast-tool.example.com/mcp', toolNames: ['script_to_audio'], riskLevel: 'write', usedBy: ['一稿多用'], enabled: false, lastHealthCheck: '—', healthy: true },
  { serverId: 'mcp-crm', serverName: 'CRM 线索系统', endpoint: 'https://crm.example.com/mcp', toolNames: ['create_lead_note'], riskLevel: 'write', usedBy: [], enabled: false, lastHealthCheck: '—', healthy: true },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取 AI 能力配置 [GET] /api/v1/ai/capabilities
function handleFetchAiCapabilities() {
  console.log('fetch capabilities');
}

// ACTION: 更新 AI 能力配置 [PATCH] /api/v1/ai/capabilities/{id}
function handleUpdateAiCapability(capabilityId: string, patch: Partial<AiCapability>) {
  console.log('update capability', capabilityId, patch);
}

// ACTION: 获取 AI 用量 [GET] /api/v1/ai/usage
function handleFetchAiUsage(params: { month: string }) {
  console.log('fetch usage', params);
}

// ACTION: 获取外部 MCP 工具 [GET] /api/v1/external-mcp-servers
function handleFetchExternalMcpTools() {
  console.log('fetch external mcp');
}

// ACTION: 登记外部 MCP 服务 [POST] /api/v1/external-mcp-servers
function handleRegisterMcpServer() {
  console.log('register mcp server');
}

// ACTION: 启停外部 MCP 服务 [PATCH] /api/v1/external-mcp-servers/{id}
function handleToggleMcpServer(serverId: string, enabled: boolean) {
  console.log('toggle mcp', serverId, enabled);
}

// ── 主组件 ────────────────────────────────────────────────
const fmtM = (n: number) => `${(n / 1_000_000).toFixed(1)}M`;

export default function AiSettings() {
  const [mcpOpen, setMcpOpen] = useState(false);
  const [caps, setCaps] = useState(mockAiCapabilitiesData);
  const [mcp, setMcp] = useState(mockExternalMcpToolsData);
  const u = mockAiUsageStats;
  const usedPct = (u.usedTokens / u.monthBudgetTokens) * 100;

  const patchCap = (id: string, patch: Partial<AiCapability>) => {
    setCaps((p) => p.map((c) => (c.capabilityId === id ? { ...c, ...patch } : c)));
    handleUpdateAiCapability(id, patch);
  };

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="AI 与模型"
        description="每项 AI 能力单独选模型、单独开关。涉及敏感数据的能力可以指定私有化或本地模型；数据会离开内网的能力会标出来。"
      />

      <Tabs
        defaultValue="capabilities"
        onValueChange={(v) => {
          if (v === 'capabilities') handleFetchAiCapabilities();
          if (v === 'usage') handleFetchAiUsage({ month: '2026-11' });
          if (v === 'mcp') handleFetchExternalMcpTools();
        }}
      >
        <TabsList>
          <TabsTrigger value="capabilities">AI 能力</TabsTrigger>
          <TabsTrigger value="usage">用量</TabsTrigger>
          <TabsTrigger value="mcp">外部工具（MCP）</TabsTrigger>
        </TabsList>

        <TabsContent value="capabilities" className="pt-3">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>能力</TableHead>
                    <TableHead>模型</TableHead>
                    <TableHead>数据出内网</TableHead>
                    <TableHead>结果需人工确认</TableHead>
                    <TableHead className="text-right">近 30 天调用</TableHead>
                    <TableHead>启用</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {caps.map((c) => (
                    <TableRow key={c.capabilityId} className={cn(!c.enabled && 'opacity-60')}>
                      <TableCell>
                        <div className="font-medium">{c.capabilityName}</div>
                        <ToneBadge tone="gray">{c.category}</ToneBadge>
                      </TableCell>
                      <TableCell>
                        <Select items={MODEL_OPTIONS} value={c.modelId} onValueChange={(v) => patchCap(c.capabilityId, { modelId: v as string })}>
                          <SelectTrigger size="sm" className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MODEL_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{c.dataLeavesNetwork ? <ToneBadge tone="amber">是</ToneBadge> : <ToneBadge tone="green">否</ToneBadge>}</TableCell>
                      <TableCell>
                        <Switch checked={c.requiresHumanConfirm} disabled={c.category === '生成'} onCheckedChange={(v) => patchCap(c.capabilityId, { requiresHumanConfirm: v })} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.callsLast30d.toLocaleString()}</TableCell>
                      <TableCell>
                        <Switch checked={c.enabled} onCheckedChange={(v) => patchCap(c.capabilityId, { enabled: v })} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" /> 生成类能力的结果始终需要人工确认，不能关闭；AI 生成段落在编辑器和审核里都有标识。
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="pt-3">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>本月额度</CardTitle>
                <CardDescription>2026 年 11 月 · 超过 80% 通知平台管理员，100% 后只保留检查类能力</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold tabular-nums">
                  {fmtM(u.usedTokens)} <span className="text-base font-normal text-muted-foreground">/ {fmtM(u.monthBudgetTokens)} tokens</span>
                </div>
                <Progress value={usedPct} />
                <div className="text-xs text-muted-foreground">已用 {usedPct.toFixed(0)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>按能力</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {u.byCapability.map((b) => (
                  <div key={b.capabilityName} className="grid grid-cols-[140px_1fr_56px] items-center gap-3 text-sm">
                    <span className="truncate">{b.capabilityName}</span>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-violet-500" style={{ width: `${(b.tokens / u.byCapability[0].tokens) * 100}%` }} />
                    </div>
                    <span className="text-right text-xs tabular-nums">{fmtM(b.tokens)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mcp" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>中台调用的外部 MCP 工具</CardTitle>
              <CardDescription>这里登记 CMS 作为 MCP 客户端调用的外部工具（视频剪辑、配音、播客等生产能力用对接方式提供，产出作为资产入库）。中台对外提供的 MCP 只读检索在「内容市场 → 对接方与接口」里按对接方开通。</CardDescription>
              <CardAction>
                <Button size="sm" onClick={() => setMcpOpen(true)}>
                  <Plus /> 登记
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>服务</TableHead>
                    <TableHead>工具</TableHead>
                    <TableHead>风险级别</TableHead>
                    <TableHead>被哪些功能使用</TableHead>
                    <TableHead>健康</TableHead>
                    <TableHead>启用</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mcp.map((s) => (
                    <TableRow key={s.serverId}>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-medium">
                          <Plug className="size-3.5 text-muted-foreground" /> {s.serverName}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">{s.endpoint}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.toolNames.map((t) => (
                            <code key={t} className="rounded bg-muted px-1 text-xs">
                              {t}
                            </code>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={RISK_CONFIG[s.riskLevel].tone}>{RISK_CONFIG[s.riskLevel].label}</ToneBadge>
                      </TableCell>
                      <TableCell className="text-sm">{s.usedBy.length ? s.usedBy.join('、') : <span className="text-muted-foreground">未使用</span>}</TableCell>
                      <TableCell className="text-xs">
                        {s.healthy ? <span className="text-emerald-600">正常</span> : <span className="text-red-600">无响应</span>}
                        <div className="text-muted-foreground">{s.lastHealthCheck}</div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={s.enabled}
                          onCheckedChange={(c) => { setMcp((p) => p.map((x) => (x.serverId === s.serverId ? { ...x, enabled: c } : x))); handleToggleMcpServer(s.serverId, c); }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">写入类工具每次调用前需要操作人确认；高风险工具不能被自动调用。</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <FormDialog
        open={mcpOpen}
        onOpenChange={setMcpOpen}
        title="登记外部工具（MCP）"
        description="登记后默认停用；管理员确认风险级别后开启。写入类工具每次调用前需要操作人确认。"
        fields={[
          { key: 'name', label: '名称', kind: 'text', required: true, placeholder: '例如：AI 海报生成' },
          { key: 'endpoint', label: '地址', kind: 'text', required: true, placeholder: 'https://…/mcp' },
          { key: 'tools', label: '工具', kind: 'text', placeholder: '用逗号分隔，连接后自动拉取清单' },
          { key: 'risk', label: '风险级别', kind: 'select', options: [{ value: 'read', label: '只读' }, { value: 'write', label: '写入' }, { value: 'high', label: '高风险' }] },
          { key: 'usedBy', label: '允许哪些功能调用', kind: 'multi', options: ['资产库', 'AI 生成', '一稿多用', '翻译任务', '编辑器 AI 面板'].map((x) => ({ value: x, label: x })) },
        ]}
        submitLabel="登记"
        onSubmit={(v: FormValues) => {
          handleRegisterMcpServer();
          setMcp((prev) => [...prev, { serverId: `mcp-${Date.now()}`, serverName: String(v.name), endpoint: String(v.endpoint), toolNames: String(v.tools).split(/[,，]/).map((x) => x.trim()).filter(Boolean), riskLevel: v.risk as RiskLevel, usedBy: v.usedBy as string[], enabled: false, lastHealthCheck: '刚刚', healthy: true }]);
          notify(`已登记「${v.name}」，默认停用`);
        }}
      />
    </div>
  );
}
