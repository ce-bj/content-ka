import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, KeyRound, RefreshCw, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { notify } from '@/components/shared/toast';
import { ContentStatusBadge, ToneBadge, type ContentStatus, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';
import { useDemo } from '@/lib/demo-store';

// ── 配置常量 ──────────────────────────────────────────────
const COLLECTION_KIND_CONFIG = {
  channel_pack: { label: '渠道内容包', tone: 'blue' as Tone },
  topic: { label: '专题集合', tone: 'violet' as Tone },
  smart: { label: '智能集合', tone: 'teal' as Tone },
} as const;
type CollectionKind = keyof typeof COLLECTION_KIND_CONFIG;

// ── 类型 ──────────────────────────────────────────────────
interface Collection {
  collectionId: string;
  collectionName: string;
  kind: CollectionKind;
  description: string;
  itemCount: number;
  ruleSummary: string | null;
  grantedConsumers: string[];
  ownerName: string;
  updatedAt: string;
}
interface CollectionItem {
  collectionId: string;
  contentId: string;
  title: string;
  contentTypeName: string;
  locale: string;
  status: ContentStatus;
  pinnedVersion: number | null;
  latestVersion: number;
  joinTaskId: string | null; // 经哪次内容审批加入（送审时的发布设置）；null = 早于此规则加入
}
interface CollectionForm {
  collectionName: string;
  kind: CollectionKind;
  description: string;
  rule: string;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockCollectionsData: Collection[] = [
  { collectionId: 'COL-12', collectionName: '经销商季度内容包 · 2026Q4', kind: 'channel_pack', description: '给经销商门户的产品页、FAQ、案例与下载资源', itemCount: 38, ruleSummary: null, grantedConsumers: ['Nordwerk GmbH 经销商门户'], ownerName: '周敏', updatedAt: '今天 10:02' },
  { collectionId: 'COL-11', collectionName: '汉诺威工业展专题', kind: 'topic', description: '展会落地页、新品发布稿、演示视频', itemCount: 14, ruleSummary: null, grantedConsumers: ['欧盟官网（AI 门户）', '北岭智造微信小程序'], ownerName: '林悦', updatedAt: '昨天' },
  { collectionId: 'COL-10', collectionName: 'SDR 知识集 · 欧盟', kind: 'smart', description: '自动包含欧盟区域、已生效、证据 A/B 的 FAQ 与说明', itemCount: 41, ruleSummary: '区域 = 欧盟 且 状态 = 已生效 且 类型 ∈ {技术 FAQ, 产品说明} 且 证据 ∈ {A, B}', grantedConsumers: ['SDR Agent', 'GEO Agent'], ownerName: '陈立', updatedAt: '自动更新' },
  { collectionId: 'COL-09', collectionName: '东南亚新品上市包', kind: 'channel_pack', description: '尚未授权给任何调用方', itemCount: 0, ruleSummary: null, grantedConsumers: [], ownerName: '周敏', updatedAt: '11-12' },
];

const mockCollectionItemsData: CollectionItem[] = [
  { collectionId: 'COL-12', contentId: 'C-0921', title: 'BL-R600 产品手册摘要（中文）', contentTypeName: '产品说明', locale: 'zh-CN / en-US', status: 'published', pinnedVersion: null, latestVersion: 4, joinTaskId: 'RV-512' },
  { collectionId: 'COL-12', contentId: 'C-1004', title: 'HC-RV200 精密减速机产品说明', contentTypeName: '产品说明', locale: 'zh-CN / en-US / de-DE', status: 'published', pinnedVersion: 1, latestVersion: 2, joinTaskId: 'RV-530' },
  { collectionId: 'COL-12', contentId: 'C-1009', title: '汽车焊装线改造：BL-R600 客户案例', contentTypeName: '客户案例', locale: 'zh-CN / en-US', status: 'published', pinnedVersion: null, latestVersion: 4, joinTaskId: null },
  { collectionId: 'COL-12', contentId: 'C-1006', title: 'BL-D120 Industrie-Entstaubungsanlage', contentTypeName: '产品说明', locale: 'de-DE', status: 'unpublished', pinnedVersion: null, latestVersion: 1, joinTaskId: null },
  { collectionId: 'COL-12', contentId: 'C-1003', title: 'BL-R600 欧盟经销商销售资料', contentTypeName: '销售资料', locale: 'en-US', status: 'in_review', pinnedVersion: null, latestVersion: 3, joinTaskId: 'RV-553' },
  { collectionId: 'COL-11', contentId: 'C-1012', title: 'BL-R600 汉诺威展专题落地页', contentTypeName: '落地页', locale: 'en-US', status: 'published', pinnedVersion: null, latestVersion: 1, joinTaskId: 'RV-541' },
  { collectionId: 'COL-11', contentId: 'C-1002', title: 'BL-R600 Product Brief', contentTypeName: '产品说明', locale: 'en-US', status: 'in_review', pinnedVersion: null, latestVersion: 3, joinTaskId: 'RV-551' },
  { collectionId: 'COL-10', contentId: 'C-1055', title: 'BL-R600 Technical FAQ', contentTypeName: '技术 FAQ', locale: 'en-US', status: 'published', pinnedVersion: null, latestVersion: 3, joinTaskId: null },
  { collectionId: 'COL-10', contentId: 'C-1004', title: 'HC-RV200 精密减速机产品说明', contentTypeName: '产品说明', locale: 'en-US', status: 'published', pinnedVersion: null, latestVersion: 2, joinTaskId: null },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取内容集合列表 [GET] /api/v1/collections
function handleFetchCollections(params: { kind: CollectionKind | 'all' }) {
  console.log('fetch collections', params);
}

// ACTION: 获取集合内容 [GET] /api/v1/collections/{id}/items
function handleFetchCollectionItems(collectionId: string) {
  console.log('fetch items', collectionId);
}

// ACTION: 新建内容集合 [POST] /api/v1/collections
function handleCreateCollection(form: CollectionForm) {
  console.log('create collection', form);
}

// ACTION: 移出集合（立即生效，相当于从该集合下架）[DELETE] /api/v1/collections/{id}/items/{contentId}
function handleRemoveCollectionItem(collectionId: string, contentId: string) {
  console.log('remove item', collectionId, contentId);
}

// ACTION: 更新版本锁定 [PATCH] /api/v1/collections/{id}/items/{contentId}
function handleUpdatePinnedVersion(collectionId: string, contentId: string, pinnedVersion: number | null) {
  console.log('pin version', collectionId, contentId, pinnedVersion);
}

// ── 主组件 ────────────────────────────────────────────────
export default function ContentCollections() {
  const { state: demo } = useDemo();
  const navigate = useNavigate();
  const [collections, setCollections] = useState(mockCollectionsData);
  const [removed, setRemoved] = useState<string[]>([]); // `${collectionId}/${contentId}`
  const [kindFilter, setKindFilter] = useState<CollectionKind | 'all'>('all');
  const [selectedId, setSelectedId] = useState('COL-12');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CollectionForm>({ collectionName: '', kind: 'channel_pack', description: '', rule: '' });
  const list = collections.filter((c) => kindFilter === 'all' || c.kind === kindFilter);
  const selected = collections.find((c) => c.collectionId === selectedId)!;

  // 本次演示中送审时选了集合的内容：审批中显示为「待加入」，通过后正式加入
  const fromSubmitted: CollectionItem[] = demo.submitted.flatMap((t) =>
    (t.kind ?? 'content') === 'content'
      ? (t.publish?.collections ?? []).map((c) => ({ collectionId: c.collectionId, contentId: t.contentId, title: t.title, contentTypeName: t.contentTypeName, locale: t.locale, status: 'in_review' as ContentStatus, pinnedVersion: null, latestVersion: t.version, joinTaskId: t.taskId }))
      : [],
  );
  const reviewStatus = (taskId: string | null) => (taskId ? demo.reviews[taskId]?.status : undefined);
  const allItems = [...fromSubmitted, ...mockCollectionItemsData]
    .filter((i) => reviewStatus(i.joinTaskId) !== 'rejected')
    .map((i) => (i.status === 'in_review' && reviewStatus(i.joinTaskId) === 'approved' ? { ...i, status: 'published' as ContentStatus } : i));
  const isPending = (i: CollectionItem) => i.status === 'in_review';
  const itemsOf = (id: string) => allItems.filter((i) => i.collectionId === id && !removed.includes(`${id}/${i.contentId}`));
  const items = itemsOf(selectedId);
  const pendingOf = (id: string) => itemsOf(id).filter(isPending).length;

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="内容集合"
        description="把一组内容打包成一个单元给调用方：渠道内容包、专题集合，或按规则自动收集的智能集合。内容在送审时的发布设置里选择放进哪个集合，审批通过后自动加入；这里维护集合本身、授权和版本锁定。"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/market')}>
              <Store /> 内容市场
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <FolderPlus /> 新建集合
            </Button>
          </>
        }
      />

      <div className="flex gap-1.5">
        {(['all', 'channel_pack', 'topic', 'smart'] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={kindFilter === k ? 'secondary' : 'ghost'}
            onClick={() => { setKindFilter(k); handleFetchCollections({ kind: k }); }}
          >
            {k === 'all' ? '全部' : COLLECTION_KIND_CONFIG[k].label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="space-y-2">
          {list.map((c) => (
            <button
              key={c.collectionId}
              onClick={() => { setSelectedId(c.collectionId); handleFetchCollectionItems(c.collectionId); }}
              className={cn('w-full rounded-lg border bg-card p-3 text-left hover:border-primary/40', c.collectionId === selectedId && 'border-primary ring-1 ring-primary/30')}
            >
              <div className="flex items-center gap-2">
                <ToneBadge tone={COLLECTION_KIND_CONFIG[c.kind].tone}>{COLLECTION_KIND_CONFIG[c.kind].label}</ToneBadge>
                <span className="truncate font-medium">{c.collectionName}</span>
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">
                {c.itemCount} 条内容 · {c.grantedConsumers.length ? c.grantedConsumers.join('、') : <span className="text-amber-600">未授权调用方</span>}
              </div>
              {pendingOf(c.collectionId) > 0 && <div className="mt-1 text-xs text-blue-600">{pendingOf(c.collectionId)} 条审批中，通过后加入</div>}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{selected.collectionName}</CardTitle>
            <CardDescription>{selected.description}</CardDescription>
            <CardAction>
              <Button size="sm" variant="outline" onClick={() => navigate('/delivery')}>
                <KeyRound /> 授权调用方
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected.ruleSummary ? (
              <div className="flex items-start gap-2 rounded-md bg-teal-50 p-3 text-sm text-teal-900 dark:bg-teal-950 dark:text-teal-100">
                <RefreshCw className="mt-0.5 size-4 shrink-0" />
                <div>
                  <div className="font-medium">自动收集规则</div>
                  <div className="font-mono text-xs">{selected.ruleSummary}</div>
                  <div className="mt-1 text-xs">内容生效时自动判断，符合即加入；送审时的发布设置里会提示。</div>
                </div>
              </div>
            ) : (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                加入：在编辑器「送审 → 发布设置」里勾选本集合，随内容审批一起审，通过后自动加入。移出：在下方直接移出，立即生效（相当于从该集合下架）。
              </div>
            )}
            <div className="text-sm text-muted-foreground">调用方默认取每条内容的最新已生效版本；锁定后固定在指定版本。</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>内容</TableHead>
                  <TableHead>语种</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>下发版本</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      还没有内容。送审时在发布设置里选择本集合即可加入。
                    </TableCell>
                  </TableRow>
                )}
                {items.map((i) => (
                  <TableRow key={`${i.collectionId}/${i.contentId}`}>
                    <TableCell>
                      <button className="text-left hover:underline" onClick={() => navigate(`/content/edit/${i.contentId}`)}>
                        {i.title}
                      </button>
                      <div className="text-xs text-muted-foreground">
                        {i.contentTypeName}
                        {i.joinTaskId && (
                          <>
                            {' · '}
                            <button className="hover:underline" onClick={() => navigate('/review', { state: { taskId: i.joinTaskId } })}>
                              经 {i.joinTaskId} 发布设置加入
                            </button>
                          </>
                        )}
                        {!i.joinTaskId && selected.kind === 'smart' && ' · 按规则自动加入'}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{i.locale}</TableCell>
                    <TableCell>
                      {isPending(i) ? <ToneBadge tone="blue">审批中 · 通过后加入</ToneBadge> : <ContentStatusBadge status={i.status} />}
                      {i.status === 'unpublished' && <div className="mt-0.5 text-[11px] text-amber-600">已下线，调用方取不到</div>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {isPending(i) ? (
                        <span className="text-muted-foreground">—</span>
                      ) : i.pinnedVersion ? (
                        <span>
                          锁定 v{i.pinnedVersion}
                          {i.pinnedVersion < i.latestVersion && <span className="ml-1 text-xs text-blue-600">（最新 v{i.latestVersion}）</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">跟随最新（v{i.latestVersion}）</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {!isPending(i) && (
                        <Button size="xs" variant="ghost" onClick={() => handleUpdatePinnedVersion(selected.collectionId, i.contentId, i.pinnedVersion ? null : i.latestVersion)}>
                          {i.pinnedVersion ? '取消锁定' : '锁定版本'}
                        </Button>
                      )}
                      {selected.kind !== 'smart' && !isPending(i) && (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label="移出"
                          onClick={() => {
                            handleRemoveCollectionItem(selected.collectionId, i.contentId);
                            setRemoved((prev) => [...prev, `${selected.collectionId}/${i.contentId}`]);
                            setCollections((prev) => prev.map((c) => (c.collectionId === selectedId ? { ...c, itemCount: Math.max(0, c.itemCount - 1), updatedAt: '刚刚' } : c)));
                            notify(`已从「${selected.collectionName}」移出，调用方立即取不到`);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建内容集合</DialogTitle>
            <DialogDescription>建好后，送审时的发布设置里就能选它；智能集合按规则自动收集，内容生效时自动进出。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>名称</Label>
              <Input value={form.collectionName} onChange={(e) => setForm({ ...form, collectionName: e.target.value })} placeholder="例如：经销商季度内容包" />
            </div>
            <div className="space-y-1.5">
              <Label>类型</Label>
              <RadioGroup value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as CollectionKind })} className="grid grid-cols-3 gap-2">
                {(Object.keys(COLLECTION_KIND_CONFIG) as CollectionKind[]).map((k) => (
                  <Label key={k} className="flex items-center gap-2 rounded-md border p-2 font-normal">
                    <RadioGroupItem value={k} /> {COLLECTION_KIND_CONFIG[k].label}
                  </Label>
                ))}
              </RadioGroup>
            </div>
            {form.kind === 'smart' && (
              <div className="space-y-1.5">
                <Label>收集规则</Label>
                <Textarea rows={2} value={form.rule} onChange={(e) => setForm({ ...form, rule: e.target.value })} placeholder="区域 = 欧盟 且 状态 = 已生效" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>说明</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              disabled={!form.collectionName}
              onClick={() => {
                handleCreateCollection(form);
                const id = `COL-${13 + collections.length - mockCollectionsData.length}`;
                setCollections((prev) => [{ collectionId: id, collectionName: form.collectionName, kind: form.kind, description: form.description || '—', itemCount: 0, ruleSummary: form.kind === 'smart' ? form.rule || '（未设置规则）' : null, grantedConsumers: [], ownerName: '我', updatedAt: '刚刚' }, ...prev]);
                setSelectedId(id);
                notify(`已创建集合 ${id}：送审时的发布设置里可以选它，记得给调用方授权`);
                setCreateOpen(false);
              }}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
