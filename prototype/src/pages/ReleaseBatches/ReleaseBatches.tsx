import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, CircleX, Plus, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormDialog, type FormValues } from '@/components/shared/FormDialog';
import { notify } from '@/components/shared/toast';
import { ToneBadge, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';
import { nextApprovalId, nowLabel, useDemo } from '@/lib/demo-store';

// ── 配置常量 ──────────────────────────────────────────────
const BATCH_STATUS_CONFIG = {
  draft: { label: '编排中', tone: 'gray' as Tone },
  in_approval: { label: '发布审批中', tone: 'violet' as Tone },
  scheduled: { label: '已排期', tone: 'blue' as Tone },
  blocked: { label: '检查未通过', tone: 'red' as Tone },
  released: { label: '已执行', tone: 'green' as Tone },
  rolled_back: { label: '已回滚', tone: 'amber' as Tone },
} as const;
type BatchStatus = keyof typeof BATCH_STATUS_CONFIG;
const ITEM_OP_CONFIG = {
  publish: { label: '上线', tone: 'green' as Tone },
  unpublish: { label: '下线', tone: 'amber' as Tone },
  update: { label: '更新版本', tone: 'blue' as Tone },
} as const;
type ItemOp = keyof typeof ITEM_OP_CONFIG;

// ── 类型 ──────────────────────────────────────────────────
interface ReleaseBatch {
  batchId: string;
  batchName: string;
  scheduledAt: string;
  timezone: string;
  status: BatchStatus;
  itemCount: number;
  blockedCount: number;
  consumers: string[];
  ownerName: string;
  approvalTaskId: string | null;
}
interface BatchItem {
  contentId: string;
  title: string;
  locale: string;
  op: ItemOp;
  targetVersion: number;
  checkPassed: boolean;
  approvalPassed: boolean;
  blockReason: string | null;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockReleaseBatchesData: ReleaseBatch[] = [
  { batchId: 'RB-032', batchName: '欧盟官网 12 月更新', scheduledAt: '12-01 08:00', timezone: 'Europe/Berlin', status: 'in_approval', itemCount: 4, blockedCount: 0, consumers: ['欧盟官网（AI 门户）'], ownerName: '周敏', approvalTaskId: 'AP-602' },
  { batchId: 'RB-031', batchName: 'BL-R800 新品全球上市', scheduledAt: '11-25 09:00', timezone: 'Asia/Shanghai', status: 'blocked', itemCount: 12, blockedCount: 2, consumers: ['欧盟官网（AI 门户）', '中国官网（AI 门户）', 'SDR Agent'], ownerName: '周敏', approvalTaskId: null },
  { batchId: 'RB-030', batchName: '欧盟交期口径统一（12 周）', scheduledAt: '11-21 08:00', timezone: 'Europe/Berlin', status: 'scheduled', itemCount: 6, blockedCount: 0, consumers: ['欧盟官网（AI 门户）', 'SDR Agent'], ownerName: '何静', approvalTaskId: null },
  { batchId: 'RB-029', batchName: '旧款 BL-R500 停产下线', scheduledAt: '11-30 00:00', timezone: 'Asia/Shanghai', status: 'draft', itemCount: 9, blockedCount: 0, consumers: ['全部调用方'], ownerName: '周敏', approvalTaskId: null },
  { batchId: 'RB-028', batchName: '汉诺威展会专题上线', scheduledAt: '11-15 07:00', timezone: 'Europe/Berlin', status: 'released', itemCount: 14, blockedCount: 0, consumers: ['欧盟官网（AI 门户）', '北岭智造微信小程序'], ownerName: '林悦', approvalTaskId: null },
  { batchId: 'RB-027', batchName: '双十一促销页', scheduledAt: '11-10 00:00', timezone: 'Asia/Shanghai', status: 'rolled_back', itemCount: 3, blockedCount: 0, consumers: ['中国官网（AI 门户）'], ownerName: '林悦', approvalTaskId: null },
];

const mockBatchItemsData: BatchItem[] = [
  { contentId: 'C-1040', title: 'BL-R800 产品说明', locale: 'zh-CN', op: 'publish', targetVersion: 2, checkPassed: true, approvalPassed: true, blockReason: null },
  { contentId: 'C-1040', title: 'BL-R800 产品说明', locale: 'en-US', op: 'publish', targetVersion: 2, checkPassed: false, approvalPassed: false, blockReason: '引用事实「防护等级」缺失（数据表 R-003）' },
  { contentId: 'C-1041', title: 'BL-R800 技术 FAQ', locale: 'zh-CN', op: 'publish', targetVersion: 1, checkPassed: true, approvalPassed: false, blockReason: '审批未完成：合规审核待处理' },
  { contentId: 'C-0921', title: 'BL-R600 产品手册摘要（中文）', locale: 'zh-CN', op: 'update', targetVersion: 5, checkPassed: true, approvalPassed: true, blockReason: null },
  { contentId: 'C-0890', title: 'BL-R500 产品说明（旧款）', locale: 'zh-CN', op: 'unpublish', targetVersion: 6, checkPassed: true, approvalPassed: true, blockReason: null },
];

// 可加入批次的内容（静态演示候选，正式版从内容列表接口选择）
const BATCH_CANDIDATES = [
  { contentId: 'C-0921', title: 'BL-R600 产品手册摘要（中文）', locale: 'zh-CN', version: 5, statusLabel: '已审批 v5', checkPassed: true, approved: true, blockReason: null },
  { contentId: 'C-1004', title: 'HC-RV200 精密减速机产品说明', locale: 'zh-CN', version: 3, statusLabel: '已审批 v3', checkPassed: true, approved: true, blockReason: null },
  { contentId: 'C-1012', title: 'BL-R600 汉诺威展专题落地页', locale: 'en-US', version: 1, statusLabel: '草稿', checkPassed: true, approved: false, blockReason: '草稿，尚未送审' },
  { contentId: 'C-1002', title: 'BL-R600 Product Brief', locale: 'en-US', version: 3, statusLabel: '审核中', checkPassed: false, approved: false, blockReason: '审核中；防护等级冲突 CF-018 未处理' },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取发布批次 [GET] /api/v1/release-batches
function handleFetchReleaseBatches(params: { status: BatchStatus | 'all' }) {
  console.log('fetch batches', params);
}

// ACTION: 获取批次条目 [GET] /api/v1/release-batches/{id}/items
function handleFetchBatchItems(batchId: string) {
  console.log('fetch items', batchId);
}

// ACTION: 新建发布批次 [POST] /api/v1/release-batches
function handleCreateReleaseBatch() {
  console.log('create release batch');
}

// ACTION: 重新检查批次 [POST] /api/v1/release-batches/{id}/check
function handleRecheckBatch(batchId: string) {
  alert('已重新执行发布检查与审批状态核对');
}

// ACTION: 提交批次发布审批 [POST] /api/v1/release-batches/{id}/approval
function handleScheduleBatch(batchId: string) {
  console.log('submit batch approval', batchId);
}

// ACTION: 回滚批次 [POST] /api/v1/release-batches/{id}/rollback
function handleRollbackBatch(batchId: string) {
  alert('已回滚到批次执行前的版本，并通知调用方');
}

// ── 主组件 ────────────────────────────────────────────────
export default function ReleaseBatches() {
  const [rawBatches, setBatches] = useState(mockReleaseBatchesData);
  const { state: demo, dispatch } = useDemo();
  // 批次排期属于“发布”，走统一审批：审批通过才排期
  const batches = rawBatches.map((b) => {
    if (!b.approvalTaskId || b.status === 'released' || b.status === 'rolled_back') return b;
    const st = demo.reviews[b.approvalTaskId]?.status;
    return { ...b, status: (st === 'approved' ? 'scheduled' : st === 'rejected' ? 'draft' : 'in_approval') as BatchStatus };
  });
  const submitApproval = (b: ReleaseBatch) => {
    const taskId = nextApprovalId(demo);
    handleScheduleBatch(b.batchId);
    dispatch({
      type: 'submitTask',
      task: {
        taskId, kind: 'batch', targetRef: b.batchId, contentId: b.batchId, title: `发布批次 ${b.batchId} ${b.batchName}`, contentTypeName: '批次发布', brandName: '北岭智造', locale: '—', version: 1,
        submittedBy: '周敏', submittedAt: `今天 ${nowLabel()}`,
        lines: [{ label: '执行时间', before: '—', after: `${b.scheduledAt}（${b.timezone}）` }, { label: '条目', before: '—', after: `${b.itemCount} 条，影响 ${b.consumers.join('、')}` }],
        effect: '批次排期，到点一起发布；执行前 30 分钟再检查一次',
        stages: [{ stageName: '品牌审核', approverLabel: '周敏（北岭智造品牌管理员）', rule: '批次发布' }],
      },
      progress: { taskId, stageIndex: 1, status: 'in_review', history: [{ stageName: '提交', actor: '周敏', decision: 'submit', comment: '', at: `今天 ${nowLabel()}` }] },
    });
    setBatches((prev) => prev.map((x) => (x.batchId === b.batchId ? { ...x, approvalTaskId: taskId } : x)));
    notify(`已提交批次发布审批 ${taskId}，通过后自动排期`);
  };
  const [itemsBy, setItemsBy] = useState<Record<string, BatchItem[]>>({});
  const [batchOpen, setBatchOpen] = useState(false);
  const navigate = useNavigate();
  const [status, setStatus] = useState<BatchStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState('RB-031');
  const list = batches.filter((b) => status === 'all' || b.status === status);
  const selected = batches.find((b) => b.batchId === selectedId)!;
  const items = itemsBy[selectedId] ?? (selectedId === 'RB-031' ? mockBatchItemsData : []);
  const setStatus2 = (s: BatchStatus) => setBatches((prev) => prev.map((b) => (b.batchId === selectedId ? { ...b, status: s } : b)));
  const blocked = items.filter((i) => !i.checkPassed || !i.approvalPassed).length;

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="发布批次"
        description="多条内容在同一时间一起上线或下线（新品发布、口径统一、停产下线）。每条都要先通过内容审批；整批排期再走一次批次发布审批（统一在审批中心），通过后到点执行。"
        actions={
          <Button onClick={() => setBatchOpen(true)}>
            <Plus /> 新建批次
          </Button>
        }
      />

      <Tabs value={status} onValueChange={(v) => { setStatus(v as BatchStatus | 'all'); handleFetchReleaseBatches({ status: v as BatchStatus | 'all' }); }}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          {(Object.keys(BATCH_STATUS_CONFIG) as BatchStatus[]).map((k) => (
            <TabsTrigger key={k} value={k}>
              {BATCH_STATUS_CONFIG[k].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>批次</TableHead>
                <TableHead>执行时间</TableHead>
                <TableHead className="text-right">条目</TableHead>
                <TableHead>影响调用方</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>负责人</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((b) => (
                <TableRow
                  key={b.batchId}
                  className={cn('cursor-pointer', b.batchId === selectedId && 'bg-muted/60')}
                  onClick={() => { setSelectedId(b.batchId); handleFetchBatchItems(b.batchId); }}
                >
                  <TableCell>
                    <div className="font-medium">{b.batchName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{b.batchId}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <CalendarClock className="mr-1 inline size-3.5 text-muted-foreground" />
                    {b.scheduledAt}
                    <div className="text-xs text-muted-foreground">{b.timezone}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.itemCount}
                    {b.blockedCount > 0 && <div className="text-xs text-red-600">{b.blockedCount} 条拦截</div>}
                  </TableCell>
                  <TableCell className="text-xs">{b.consumers.join('、')}</TableCell>
                  <TableCell>
                    <ToneBadge tone={BATCH_STATUS_CONFIG[b.status].tone}>{BATCH_STATUS_CONFIG[b.status].label}</ToneBadge>
                  </TableCell>
                  <TableCell className="text-sm">{b.ownerName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{selected.batchName}</CardTitle>
          <CardDescription>
            {selected.scheduledAt}（{selected.timezone}）执行 · {items.length} 条 · {blocked > 0 ? <span className="text-red-600">{blocked} 条未就绪</span> : '全部就绪'}
          </CardDescription>
          <CardAction className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleRecheckBatch(selected.batchId)}>
              重新检查
            </Button>
            {selected.status === 'released' ? (
              <Button size="sm" variant="outline" onClick={() => { handleRollbackBatch(selected.batchId); setStatus2('rolled_back'); }}>
                <Undo2 /> 回滚
              </Button>
            ) : (
              selected.status === 'in_approval' ? (
                <Button size="sm" variant="secondary" onClick={() => navigate('/review', { state: { taskId: selected.approvalTaskId } })}>
                  发布审批中 · 查看
                </Button>
              ) : selected.status === 'scheduled' ? (
                <Button size="sm" variant="secondary" disabled>
                  已排期
                </Button>
              ) : (
                <Button size="sm" disabled={blocked > 0} onClick={() => submitApproval(selected)}>
                  提交发布审批
                </Button>
              )
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {blocked > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              <AlertTriangle className="size-4" /> 未就绪的条目处理完之前不能排期。也可以把它移出本批次，单独发布。
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>内容</TableHead>
                <TableHead>语种</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>版本</TableHead>
                <TableHead>发布检查</TableHead>
                <TableHead>审批</TableHead>
                <TableHead>原因</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={`${i.contentId}-${i.locale}`}>
                  <TableCell>
                    <button className="text-left hover:underline" onClick={() => navigate(`/content/edit/${i.contentId}`)}>
                      {i.title}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">{i.locale}</TableCell>
                  <TableCell>
                    <ToneBadge tone={ITEM_OP_CONFIG[i.op].tone}>{ITEM_OP_CONFIG[i.op].label}</ToneBadge>
                  </TableCell>
                  <TableCell className="text-sm">v{i.targetVersion}</TableCell>
                  <TableCell>{i.checkPassed ? <CheckCircle2 className="size-4 text-emerald-600" /> : <CircleX className="size-4 text-red-600" />}</TableCell>
                  <TableCell>{i.approvalPassed ? <CheckCircle2 className="size-4 text-emerald-600" /> : <CircleX className="size-4 text-red-600" />}</TableCell>
                  <TableCell className="max-w-72 text-xs whitespace-normal text-red-700">{i.blockReason ?? ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <FormDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        title="新建发布批次"
        description="选中的内容在同一时间一起上线 / 下线。每条都要通过发布检查和审批，有一条未就绪整批不能排期。"
        fields={[
          { key: 'name', label: '批次名称', kind: 'text', required: true, placeholder: '例如：BL-R600 欧盟页面更新' },
          { key: 'op', label: '操作', kind: 'select', options: [{ value: 'publish', label: '上线' }, { value: 'update', label: '更新版本' }, { value: 'unpublish', label: '下线' }] },
          { key: 'contents', label: '内容', kind: 'multi', required: true, options: BATCH_CANDIDATES.map((c) => ({ value: c.contentId, label: `${c.title}（${c.statusLabel}）` })) },
          { key: 'at', label: '执行时间', kind: 'datetime', required: true },
          { key: 'tz', label: '时区', kind: 'select', options: ['Asia/Shanghai', 'Europe/Berlin', 'Asia/Singapore', 'America/Chicago'].map((x) => ({ value: x, label: x })) },
        ]}
        onSubmit={(v: FormValues) => {
          handleCreateReleaseBatch();
          const id = `RB-${String(32 + batches.length - mockReleaseBatchesData.length)}`.replace('RB-', 'RB-0');
          const picked = BATCH_CANDIDATES.filter((c) => (v.contents as string[]).includes(c.contentId));
          const newItems: BatchItem[] = picked.map((c) => ({ contentId: c.contentId, title: c.title, locale: c.locale, op: v.op as ItemOp, targetVersion: c.version, checkPassed: c.checkPassed, approvalPassed: c.approved, blockReason: c.blockReason }));
          setBatches((prev) => [{ batchId: id, batchName: String(v.name), scheduledAt: String(v.at).replace('T', ' ').slice(5), timezone: String(v.tz), status: newItems.some((i) => !i.checkPassed || !i.approvalPassed) ? 'blocked' : 'draft', itemCount: newItems.length, blockedCount: newItems.filter((i) => !i.checkPassed || !i.approvalPassed).length, consumers: ['欧盟官网（AI 门户）', 'SDR Agent'], ownerName: '我', approvalTaskId: null }, ...prev]);
          setItemsBy((prev) => ({ ...prev, [id]: newItems }));
          setSelectedId(id);
          notify(`已创建 ${id}，共 ${newItems.length} 条；未就绪的条目处理后才能排期`);
        }}
      />
    </div>
  );
}
