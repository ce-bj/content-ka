import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ExternalLink, Import, Search, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { notify } from '@/components/shared/toast';
import { ToneBadge, type Tone } from '@/components/shared/status';
import { nextContentId, nowLabel, useDemo } from '@/lib/demo-store';

// ── 配置常量 ──────────────────────────────────────────────
// 接入方式与「上游接入」一致
const INGEST_CONFIG = {
  full: { label: '全量导入', tone: 'blue' as Tone },
  on_use: { label: '用到才存', tone: 'violet' as Tone },
  link_only: { label: '仅链接', tone: 'gray' as Tone },
} as const;
type IngestMode = keyof typeof INGEST_CONFIG;
const SOURCE_STATE_CONFIG = {
  synced: { label: '与源一致', tone: 'green' as Tone },
  source_updated: { label: '源已更新', tone: 'amber' as Tone },
  source_deleted: { label: '源已删除', tone: 'red' as Tone },
} as const;
type SourceState = keyof typeof SOURCE_STATE_CONFIG;

// ── 类型 ──────────────────────────────────────────────────
interface ExternalContent {
  externalId: string;
  title: string;
  systemName: string;
  contentKind: string;
  locale: string;
  ingestMode: IngestMode;
  sourceState: SourceState;
  syncedAt: string;
  referencedBy: string[]; // 引用它的自产内容
  adoptedAs: string | null; // 已纳管为哪条自产内容
  sourceUrl: string;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockExternalContentsData: ExternalContent[] = [
  { externalId: 'EX-204', title: 'HC-RV200 精密减速机（旧官网产品页）', systemName: '现有官网（反向代理）', contentKind: '网页', locale: 'zh-CN', ingestMode: 'full', sourceState: 'synced', syncedAt: '今天 06:00', referencedBy: [], adoptedAs: 'C-1004', sourceUrl: 'https://www.hanchuan.example/products/rv200' },
  { externalId: 'EX-211', title: 'BL-R600 About & Applications', systemName: '现有官网（反向代理）', contentKind: '网页', locale: 'en-US', ingestMode: 'full', sourceState: 'source_updated', syncedAt: '今天 06:00', referencedBy: ['C-1002'], adoptedAs: null, sourceUrl: 'https://www.beiling.example/en/bl-r600' },
  { externalId: 'EX-305', title: 'BL-R600 汉诺威展新闻稿（市场部定稿）', systemName: '飞书云空间', contentKind: '文档', locale: 'zh-CN', ingestMode: 'on_use', sourceState: 'synced', syncedAt: '11-15 14:20', referencedBy: ['C-1012'], adoptedAs: null, sourceUrl: 'https://feishu.example/docx/hannover-press' },
  { externalId: 'EX-318', title: 'Nordwerk 渠道政策说明（2026 版）', systemName: 'SharePoint（欧洲子公司）', contentKind: '页面', locale: 'de-DE', ingestMode: 'link_only', sourceState: 'synced', syncedAt: '—', referencedBy: [], adoptedAs: null, sourceUrl: 'https://sharepoint.example/eu/channel-policy' },
  { externalId: 'EX-402', title: 'BL-R600 产品描述（PIM 长描述）', systemName: 'Pimcore PIM', contentKind: '产品描述', locale: 'en-US', ingestMode: 'full', sourceState: 'synced', syncedAt: '今天 05:30', referencedBy: ['C-1002', 'C-1055'], adoptedAs: null, sourceUrl: 'pimcore://products/BL-R600/description' },
  { externalId: 'EX-509', title: 'BL-D120 Produktseite (alt)', systemName: '现有官网（反向代理）', contentKind: '网页', locale: 'de-DE', ingestMode: 'full', sourceState: 'source_deleted', syncedAt: '11-10 06:00', referencedBy: ['C-1006'], adoptedAs: null, sourceUrl: 'https://www.beiling.example/de/bl-d120' },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取外部内容 [GET] /api/v1/external-contents
function handleFetchExternalContents(params: { system: string; mode: IngestMode | 'all'; keyword: string }) {
  console.log('fetch external contents', params);
}

// ACTION: 纳管为自产内容 [POST] /api/v1/external-contents/{id}/adopt
function handleAdoptExternal(externalId: string) {
  console.log('adopt external', externalId);
}

// ACTION: 从源重新同步 [POST] /api/v1/external-contents/{id}/sync
function handleResyncExternal(externalId: string) {
  console.log('resync external', externalId);
}

// ── 主组件 ────────────────────────────────────────────────
export default function ExternalContentPage() {
  const navigate = useNavigate();
  const { state: demo, dispatch } = useDemo();
  const [system, setSystem] = useState('all');
  const [mode, setMode] = useState<IngestMode | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const [adopted, setAdopted] = useState<Record<string, string>>({});
  const [resynced, setResynced] = useState<string[]>([]);

  const systems = [...new Set(mockExternalContentsData.map((x) => x.systemName))];
  const rows = mockExternalContentsData
    .map((x) => ({ ...x, adoptedAs: adopted[x.externalId] ?? x.adoptedAs, sourceState: resynced.includes(x.externalId) ? ('synced' as SourceState) : x.sourceState }))
    .filter((x) => (system === 'all' || x.systemName === system) && (mode === 'all' || x.ingestMode === mode) && (!keyword || x.title.toLowerCase().includes(keyword.toLowerCase())));
  const refetch = (p: Partial<{ system: string; mode: IngestMode | 'all'; keyword: string }>) => handleFetchExternalContents({ system, mode, keyword, ...p });

  const adopt = (x: ExternalContent) => {
    handleAdoptExternal(x.externalId);
    const id = nextContentId(demo);
    dispatch({
      type: 'createContent',
      content: {
        contentId: id, title: x.title.replace(/（.*?）|\(alt\)/g, '').trim(), summary: `纳管自 ${x.systemName} ${x.externalId}`, contentTypeName: x.contentKind === '产品描述' || x.contentKind === '网页' ? '产品说明' : '落地页',
        brandName: '北岭智造', regionLabel: x.locale === 'zh-CN' ? '中国大陆' : '欧盟', locale: x.locale,
        sections: [{ heading: '正文（来自外部原文）', body: `${x.title} 的原文已导入为草稿，关键数值请改为事实引用后再送审。` }],
        source: { kind: 'import', topicId: null, taskId: null, templateId: null, templateName: null, sourceContentId: `${x.externalId} ${x.systemName}`, refs: [] },
        ownerName: '林悦', createdAt: `今天 ${nowLabel()}`,
      },
    });
    setAdopted((p) => ({ ...p, [x.externalId]: id }));
    notify(`已纳管为自产内容 ${id}（草稿），原文图片已进资产库；之后按自产内容编辑、送审、发布`);
    navigate(`/content/edit/${id}`);
  };

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="外部内容"
        description="引用源之一：从上游平台接入、要读正文的文字内容，如现有官网页面、飞书 / SharePoint 文档正文、PIM 产品描述。CMS 不生产、不审批、不发布它们，只做两件事：生产时用作引用；需要由 CMS 接手时纳管为自产内容。图片、视频、PDF 这类原样给出去的文件在「资产」里。"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/assets')}>
              资产库
            </Button>
            <Button variant="outline" onClick={() => navigate('/integrations')}>
              上游接入 <ArrowRight />
            </Button>
          </>
        }
      />

      <Alert>
        <Import />
        <AlertTitle>和自产内容、资产的关系</AlertTitle>
        <AlertDescription>
          用作引用：在「AI 生成」的引用里选它，生成稿记录引用来源，源更新时提醒复核。纳管：复制为一条自产草稿，此后以 CMS 为准，外部原文只作来源记录；原文里的图片自动进资产库，并记下来自哪条外部内容。
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={system} onValueChange={(v) => { setSystem(String(v)); refetch({ system: String(v) }); }} items={[{ value: 'all', label: '全部来源系统' }, ...systems.map((x) => ({ value: x, label: x }))]}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源系统</SelectItem>
            {systems.map((x) => (
              <SelectItem key={x} value={x}>
                {x}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mode} onValueChange={(v) => { setMode(v as IngestMode | 'all'); refetch({ mode: v as IngestMode | 'all' }); }} items={[{ value: 'all', label: '全部接入方式' }, ...(Object.keys(INGEST_CONFIG) as IngestMode[]).map((k) => ({ value: k, label: INGEST_CONFIG[k].label }))]}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部接入方式</SelectItem>
            {(Object.keys(INGEST_CONFIG) as IngestMode[]).map((k) => (
              <SelectItem key={k} value={k}>
                {INGEST_CONFIG[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative ml-auto w-60">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 pl-8" placeholder="标题" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && refetch({ keyword })} />
        </div>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>外部内容</TableHead>
                <TableHead>来源系统</TableHead>
                <TableHead>接入方式</TableHead>
                <TableHead>源状态</TableHead>
                <TableHead>被自产内容引用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((x) => (
                <TableRow key={x.externalId}>
                  <TableCell className="min-w-64 max-w-80 whitespace-normal">
                    <div className="font-medium">{x.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {x.externalId} · {x.contentKind} · {x.locale} · 同步 {x.syncedAt}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{x.systemName}</TableCell>
                  <TableCell>
                    <ToneBadge tone={INGEST_CONFIG[x.ingestMode].tone}>{INGEST_CONFIG[x.ingestMode].label}</ToneBadge>
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={SOURCE_STATE_CONFIG[x.sourceState].tone}>{SOURCE_STATE_CONFIG[x.sourceState].label}</ToneBadge>
                    {x.sourceState !== 'synced' && x.referencedBy.length > 0 && <div className="mt-0.5 text-[11px] text-amber-700">引用方需复核</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {x.referencedBy.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      x.referencedBy.map((cid) => (
                        <button key={cid} className="mr-1.5 font-mono hover:underline" onClick={() => navigate(`/content/edit/${cid}`)}>
                          {cid}
                        </button>
                      ))
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {x.sourceState === 'source_updated' && (
                      <Button size="xs" variant="ghost" onClick={() => { handleResyncExternal(x.externalId); setResynced((p) => [...p, x.externalId]); notify(`已从源重新同步 ${x.externalId}，引用它的 ${x.referencedBy.length} 条自产内容已生成复核提醒`); }}>
                        重新同步
                      </Button>
                    )}
                    <Button size="xs" variant="ghost" onClick={() => navigate('/production/generate', { state: { externalRef: { refKind: 'external', refId: x.externalId, label: `${x.externalId} ${x.title}` } } })} disabled={x.sourceState === 'source_deleted'}>
                      <Sparkles /> 用作引用
                    </Button>
                    {x.adoptedAs ? (
                      <Button size="xs" variant="outline" onClick={() => navigate(`/content/edit/${x.adoptedAs}`)}>
                        已纳管 {x.adoptedAs}
                      </Button>
                    ) : (
                      <Button size="xs" variant="outline" disabled={x.sourceState === 'source_deleted' || x.ingestMode === 'link_only'} title={x.ingestMode === 'link_only' ? '仅链接的内容没有副本，不能纳管' : undefined} onClick={() => adopt(x)}>
                        纳管为自产
                      </Button>
                    )}
                    <Button size="icon-xs" variant="ghost" aria-label="查看原文" onClick={() => notify(`原文：${x.sourceUrl}`)}>
                      <ExternalLink />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
