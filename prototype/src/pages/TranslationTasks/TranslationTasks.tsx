import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Languages, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { notify } from '@/components/shared/toast';
import { ToneBadge, type Tone } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const TASK_STATUS_CONFIG = {
  machine: { label: '机翻中', tone: 'blue' as Tone },
  reviewing: { label: '人工校对', tone: 'violet' as Tone },
  done: { label: '已完成', tone: 'green' as Tone },
  outdated: { label: '源已更新', tone: 'amber' as Tone },
} as const;
type TaskStatus = keyof typeof TASK_STATUS_CONFIG;
const LOCALE_OPTIONS = [
  { value: 'en-US', label: '英语（美国）' },
  { value: 'de-DE', label: '德语' },
  { value: 'ja-JP', label: '日语' },
  { value: 'th-TH', label: '泰语' },
];
const ENGINE_OPTIONS = [
  { value: 'llm_glossary', label: '大模型 + 术语库（默认）' },
  { value: 'mt_vendor', label: '机器翻译服务' },
  { value: 'human_vendor', label: '外部翻译供应商' },
];

// ── 类型 ──────────────────────────────────────────────────
interface TranslationTask {
  taskId: string;
  contentTitle: string;
  contentId: string;
  fromLocale: string;
  toLocale: string;
  status: TaskStatus;
  progress: number;
  segmentCount: number;
  glossaryHits: number;
  glossaryViolations: number;
  reviewerName: string | null;
  dueAt: string;
}
interface Segment {
  segmentId: string;
  sourceText: string;
  targetText: string;
  factLocked: boolean;
  glossaryTerms: { source: string; target: string; respected: boolean }[];
  confirmed: boolean;
}
interface CreateTranslationForm {
  contentIds: string[];
  toLocales: string[];
  engine: string;
  reviewerRequired: boolean;
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockTranslationTasksData: TranslationTask[] = [
  { taskId: 'TR-118', contentTitle: 'BL-R600 产品手册摘要（中文）', contentId: 'C-0921', fromLocale: 'zh-CN', toLocale: 'de-DE', status: 'reviewing', progress: 62, segmentCount: 48, glossaryHits: 31, glossaryViolations: 1, reviewerName: 'Anna K.', dueAt: '11-21' },
  { taskId: 'TR-117', contentTitle: 'BL-R600 FAQ: IP rating', contentId: 'C-1015', fromLocale: 'en-US', toLocale: 'ja-JP', status: 'machine', progress: 35, segmentCount: 22, glossaryHits: 0, glossaryViolations: 0, reviewerName: null, dueAt: '11-22' },
  { taskId: 'TR-116', contentTitle: '汽车焊装线改造：BL-R600 客户案例', contentId: 'C-1009', fromLocale: 'zh-CN', toLocale: 'en-US', status: 'outdated', progress: 100, segmentCount: 36, glossaryHits: 18, glossaryViolations: 0, reviewerName: 'Tom W.', dueAt: '11-18' },
  { taskId: 'TR-115', contentTitle: 'HC-RV200 精密减速机产品说明', contentId: 'C-1004', fromLocale: 'zh-CN', toLocale: 'th-TH', status: 'done', progress: 100, segmentCount: 40, glossaryHits: 26, glossaryViolations: 0, reviewerName: 'Somchai P.', dueAt: '11-15' },
];

const mockSegmentsData: Segment[] = [
  { segmentId: 'S-01', sourceText: 'BL-R600 是一款额定负载 20 kg 的六轴工业机器人，最大工作半径 1700 mm。', targetText: 'Der BL-R600 ist ein Sechsachs-Industrieroboter mit 20 kg Nennlast und 1700 mm Reichweite.', factLocked: true, glossaryTerms: [{ source: '工业机器人', target: 'Industrieroboter', respected: true }, { source: '额定负载', target: 'Nennlast', respected: true }], confirmed: true },
  { segmentId: 'S-02', sourceText: '整机防护等级 IP66，可在多粉尘的焊装车间稳定运行。', targetText: 'Schutzart IP66, zuverlässiger Betrieb in staubigen Schweißumgebungen.', factLocked: true, glossaryTerms: [{ source: '防护等级', target: 'Schutzart', respected: true }], confirmed: false },
  { segmentId: 'S-03', sourceText: '中空腕部设计，焊枪走线不缠绕。', targetText: 'Hohles Handgelenk – das Schweißkabel verdreht sich nicht.', factLocked: false, glossaryTerms: [{ source: '中空腕部', target: 'Hohlwellen-Handgelenk', respected: false }], confirmed: false },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取翻译任务 [GET] /api/v1/translation-tasks
function handleFetchTranslationTasks(params: { status: TaskStatus | 'all' }) {
  console.log('fetch tasks', params);
}

// ACTION: 获取任务分段 [GET] /api/v1/translation-tasks/{id}/segments
function handleFetchSegments(taskId: string) {
  console.log('fetch segments', taskId);
}

// ACTION: 创建翻译任务 [POST] /api/v1/translation-tasks
function handleCreateTranslationTasks(form: CreateTranslationForm) {
  console.log('create tasks', form);
}

// ACTION: 确认分段译文 [PATCH] /api/v1/translation-tasks/{id}/segments/{segmentId}
function handleConfirmSegment(taskId: string, segmentId: string) {
  console.log('confirm segment', taskId, segmentId);
}

// ACTION: 完成翻译并生成语种版本 [POST] /api/v1/translation-tasks/{id}/complete
function handleCompleteTranslation(taskId: string) {
  alert('已生成德语版本草稿，进入审核');
}

// ── 主组件 ────────────────────────────────────────────────
export default function TranslationTasks() {
  const [taskList, setTaskList] = useState(mockTranslationTasksData);
  const navigate = useNavigate();
  const [status, setStatus] = useState<TaskStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState('TR-118');
  const [segments, setSegments] = useState(mockSegmentsData);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateTranslationForm>({ contentIds: ['C-0921'], toLocales: ['de-DE'], engine: 'llm_glossary', reviewerRequired: true });
  const list = taskList.filter((t) => status === 'all' || t.status === status);
  const selected = taskList.find((t) => t.taskId === selectedId)!;
  const unconfirmed = segments.filter((s) => !s.confirmed).length;

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="翻译任务"
        description="批量机翻 + 人工校对。术语库强制使用；事实插槽里的数值不翻译、不改动，只换单位格式。源内容更新后，译文自动标记为「源已更新」。"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> 新建翻译
          </Button>
        }
      />

      <Tabs value={status} onValueChange={(v) => { setStatus(v as TaskStatus | 'all'); handleFetchTranslationTasks({ status: v as TaskStatus | 'all' }); }}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          {(Object.keys(TASK_STATUS_CONFIG) as TaskStatus[]).map((k) => (
            <TabsTrigger key={k} value={k}>
              {TASK_STATUS_CONFIG[k].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>内容</TableHead>
                <TableHead>语种</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="w-40">进度</TableHead>
                <TableHead>术语</TableHead>
                <TableHead>校对人</TableHead>
                <TableHead>截止</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((t) => (
                <TableRow
                  key={t.taskId}
                  className={cn('cursor-pointer', t.taskId === selectedId && 'bg-muted/60')}
                  onClick={() => { setSelectedId(t.taskId); handleFetchSegments(t.taskId); }}
                >
                  <TableCell>
                    <div className="font-medium">{t.contentTitle}</div>
                    <div className="font-mono text-xs text-muted-foreground">{t.taskId}</div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {t.fromLocale} → {t.toLocale}
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={TASK_STATUS_CONFIG[t.status].tone}>{TASK_STATUS_CONFIG[t.status].label}</ToneBadge>
                  </TableCell>
                  <TableCell>
                    <Progress value={t.progress} />
                    <div className="mt-1 text-xs text-muted-foreground">{t.segmentCount} 段</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    命中 {t.glossaryHits}
                    {t.glossaryViolations > 0 && <div className="text-red-600">未遵守 {t.glossaryViolations}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{t.reviewerName ?? <span className="text-muted-foreground">待分配</span>}</TableCell>
                  <TableCell className="text-sm">{t.dueAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="size-4" /> 校对：{selected.contentTitle}（{selected.fromLocale} → {selected.toLocale}）
          </CardTitle>
          <CardDescription>
            <span className="text-teal-700">青色</span>分段含事实插槽，数值已锁定；红色术语表示译文没用术语库的标准译法。
          </CardDescription>
          <CardAction className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate(`/content/edit/${selected.contentId}`)}>
              打开内容
            </Button>
            <Button size="sm" disabled={unconfirmed > 0} onClick={() => handleCompleteTranslation(selected.taskId)}>
              完成并送审{unconfirmed > 0 && `（剩 ${unconfirmed} 段）`}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          {segments.map((s) => (
            <div key={s.segmentId} className={cn('grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_1fr_auto]', s.factLocked && 'border-teal-200 bg-teal-50/40 dark:border-teal-900 dark:bg-teal-950/30')}>
              <div className="text-sm">{s.sourceText}</div>
              <div className="text-sm">
                {s.targetText}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {s.glossaryTerms.map((g) => (
                    <ToneBadge key={g.source} tone={g.respected ? 'gray' : 'red'}>
                      {g.source} → {g.target}
                      {!g.respected && '（未遵守）'}
                    </ToneBadge>
                  ))}
                </div>
              </div>
              <div className="flex items-start">
                {s.confirmed ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                    <Check className="size-3.5" /> 已确认
                  </span>
                ) : (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => { handleConfirmSegment(selected.taskId, s.segmentId); setSegments((p) => p.map((x) => (x.segmentId === s.segmentId ? { ...x, confirmed: true } : x))); }}
                  >
                    确认
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建翻译任务</DialogTitle>
            <DialogDescription>每条内容 × 每个目标语种生成一个任务；已有该语种版本的会生成“更新翻译”。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-md bg-muted/60 p-3">已选内容：BL-R600 产品手册摘要（中文）（C-0921）</div>
            <div className="space-y-1.5">
              <Label>目标语种</Label>
              <div className="grid grid-cols-2 gap-2">
                {LOCALE_OPTIONS.map((o) => (
                  <Label key={o.value} className="flex items-center gap-2 rounded-md border p-2 font-normal">
                    <Checkbox
                      checked={form.toLocales.includes(o.value)}
                      onCheckedChange={(c) => setForm({ ...form, toLocales: c ? [...form.toLocales, o.value] : form.toLocales.filter((x) => x !== o.value) })}
                    />
                    {o.label}
                  </Label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>翻译方式</Label>
              <Select items={ENGINE_OPTIONS} value={form.engine} onValueChange={(v) => setForm({ ...form, engine: v as string })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGINE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox checked={form.reviewerRequired} onCheckedChange={(c) => setForm({ ...form, reviewerRequired: !!c })} />
              需要人工校对（对外发布的内容建议开启）
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button disabled={form.toLocales.length === 0} onClick={() => { handleCreateTranslationTasks(form); const created = form.toLocales.map((l, i) => ({ taskId: `TR-${119 + taskList.length - mockTranslationTasksData.length + i}`, contentTitle: 'BL-R600 产品手册摘要（中文）', contentId: 'C-0921', fromLocale: 'zh-CN', toLocale: l, status: 'machine' as TaskStatus, progress: 0, segmentCount: 48, glossaryHits: 0, glossaryViolations: 0, reviewerName: form.reviewerRequired ? null : '无需校对', dueAt: '11-27' })); setTaskList((prev) => [...created, ...prev]); notify(`已创建 ${created.length} 个翻译任务，正在机翻`); setCreateOpen(false); }}>
              创建 {form.contentIds.length * form.toLocales.length} 个任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
