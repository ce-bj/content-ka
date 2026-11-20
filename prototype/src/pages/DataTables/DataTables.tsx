import { useState } from 'react';
import { Download, Link2, Plus, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { notify } from '@/components/shared/toast';
import { ContentStatusBadge, ToneBadge, type ContentStatus } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const IMPORT_MODE_OPTIONS = [
  { value: 'upsert', label: '按主键更新，没有则新增' },
  { value: 'insert_only', label: '只新增' },
  { value: 'update_only', label: '只更新已有行' },
];
type ImportMode = 'upsert' | 'insert_only' | 'update_only';

// ── 类型 ──────────────────────────────────────────────────
interface DataTableMeta {
  tableId: string;
  tableName: string;
  description: string;
  rowCount: number;
  primaryKey: string;
  factSlotColumns: number;
  consumerCount: number;
  updatedAt: string;
}
interface CatalogRow {
  rowId: string;
  modelCode: string;
  productName: string;
  payloadKg: number | null;
  reachMm: number | null;
  ipRating: string | null;
  leadTimeWeeks: number | null;
  factBoundColumns: string[];
  regionLabel: string;
  status: ContentStatus;
  editedBy: string;
}
interface ImportPreview {
  fileName: string;
  totalRows: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  errors: { line: number; column: string; message: string }[];
}

// ── 动态数据（DataSlot）──────────────────────────────────
const mockDataTablesData: DataTableMeta[] = [
  { tableId: 'product_catalog', tableName: '产品目录', description: '型号级参数，供官网选型器、经销商门户、AI 客服使用', rowCount: 96, primaryKey: '型号', factSlotColumns: 4, consumerCount: 5, updatedAt: '今天 09:40' },
  { tableId: 'partner_directory', tableName: '伙伴名录', description: '认证经销商、服务网点、联系方式与覆盖区域', rowCount: 214, primaryKey: '伙伴编码', factSlotColumns: 0, consumerCount: 2, updatedAt: '昨天 17:20' },
  { tableId: 'resource_library', tableName: '资源库', description: '白皮书、手册、证书下载项，关联资产库文件', rowCount: 138, primaryKey: '资源编号', factSlotColumns: 1, consumerCount: 3, updatedAt: '11-17' },
];

// PAGINATION: page,pageSize
const mockCatalogRowsData: CatalogRow[] = [
  { rowId: 'R-001', modelCode: 'BL-R600', productName: '六轴工业机器人 20kg', payloadKg: 20, reachMm: 1700, ipRating: 'IP66', leadTimeWeeks: 12, factBoundColumns: ['payloadKg', 'reachMm', 'ipRating', 'leadTimeWeeks'], regionLabel: '全球', status: 'published', editedBy: '事实同步' },
  { rowId: 'R-002', modelCode: 'BL-R500', productName: '六轴工业机器人 12kg（旧款）', payloadKg: 12, reachMm: 1400, ipRating: 'IP54', leadTimeWeeks: 6, factBoundColumns: ['payloadKg', 'reachMm', 'ipRating', 'leadTimeWeeks'], regionLabel: '全球', status: 'unpublished', editedBy: '周敏' },
  { rowId: 'R-003', modelCode: 'BL-R800', productName: '六轴工业机器人 30kg（新品）', payloadKg: 30, reachMm: 2000, ipRating: null, leadTimeWeeks: null, factBoundColumns: ['payloadKg', 'reachMm'], regionLabel: '中国大陆', status: 'draft', editedBy: '林悦' },
  { rowId: 'R-004', modelCode: 'BL-D120', productName: '工业除尘设备', payloadKg: null, reachMm: null, ipRating: 'IP65', leadTimeWeeks: 4, factBoundColumns: ['ipRating', 'leadTimeWeeks'], regionLabel: '欧盟', status: 'in_review', editedBy: '事实同步' },
  { rowId: 'R-005', modelCode: 'HC-RV200', productName: '精密减速机 RV200', payloadKg: null, reachMm: null, ipRating: 'IP65', leadTimeWeeks: 4, factBoundColumns: ['ipRating', 'leadTimeWeeks'], regionLabel: '全球', status: 'published', editedBy: '事实同步' },
];

const mockImportPreviewData: ImportPreview = {
  fileName: '产品目录_2026Q4.xlsx',
  totalRows: 42,
  createCount: 3,
  updateCount: 36,
  skipCount: 1,
  errors: [
    { line: 18, column: '防护等级', message: '该列绑定事实，绑定事实 F-002，导入值 IP65 与事实库 IP66 不一致（另见冲突 CF-018）；请先在事实库处理' },
    { line: 31, column: '负载', message: '不是数字：“约 25”' },
  ],
};

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取数据表列表 [GET] /api/v1/data-tables
function handleFetchDataTables() {
  console.log('fetch data tables');
}

// ACTION: 获取数据表行 [GET] /api/v1/data-tables/{tableId}/rows
function handleFetchTableRows(params: { tableId: string; keyword: string; page: number; pageSize: number }) {
  console.log('fetch rows', params);
}

// ACTION: 更新单元格 [PATCH] /api/v1/data-tables/{tableId}/rows/{rowId}
function handleUpdateCell(tableId: string, rowId: string, column: string, value: string) {
  console.log('update cell', tableId, rowId, column, value);
}

// ACTION: 新增行 [POST] /api/v1/data-tables/{tableId}/rows
function handleCreateRow(tableId: string) {
  console.log('create row', tableId);
}

// ACTION: 预检导入文件 [POST] /api/v1/data-tables/{tableId}/imports/preview
function handlePreviewImport(tableId: string, mode: ImportMode) {
  console.log('preview import', tableId, mode);
}

// ACTION: 确认导入 [POST] /api/v1/data-tables/{tableId}/imports
function handleConfirmImport(tableId: string, mode: ImportMode) {
  alert('导入已提交：有效行进入草稿，错误行已跳过');
}

// ACTION: 导出数据表 [GET] /api/v1/data-tables/{tableId}/export
function handleExportTable(tableId: string, format: 'xlsx' | 'csv') {
  alert(`正在导出 ${format.toUpperCase()}`);
}

// ── 主组件 ────────────────────────────────────────────────
const COLUMNS: { key: keyof CatalogRow; label: string; numeric?: boolean }[] = [
  { key: 'payloadKg', label: '负载 kg', numeric: true },
  { key: 'reachMm', label: '臂展 mm', numeric: true },
  { key: 'ipRating', label: '防护等级' },
  { key: 'leadTimeWeeks', label: '交期 周', numeric: true },
];

export default function DataTables() {
  const [catalog, setCatalog] = useState(mockCatalogRowsData);
  const [tableId, setTableId] = useState('product_catalog');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('upsert');
  const table = mockDataTablesData.find((t) => t.tableId === tableId)!;
  const rows = catalog.filter((r) => !keyword || r.modelCode.includes(keyword) || r.productName.includes(keyword));

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="数据表"
        description="行列结构的内容（产品目录、伙伴名录、资源库），在表格里直接编辑、批量导入导出。绑定事实的列只读，跟随事实库自动刷新。"
        actions={
          <>
            <Button variant="outline" onClick={() => { setImportOpen(true); handlePreviewImport(tableId, importMode); }}>
              <Upload /> 导入
            </Button>
            <Button variant="outline" onClick={() => handleExportTable(tableId, 'xlsx')}>
              <Download /> 导出
            </Button>
            <Button onClick={() => { handleCreateRow(tableId); const rowId = `R-${String(catalog.length + 1).padStart(3, '0')}`; setCatalog((prev) => [...prev, { rowId, modelCode: '新型号', productName: '未命名产品', payloadKg: null, reachMm: null, ipRating: null, leadTimeWeeks: null, factBoundColumns: [], regionLabel: '全球', status: 'draft', editedBy: '我' }]); setEditing(`${rowId}.productName`); notify('已新增一行草稿，填写名称后可绑定事实列'); }}>
              <Plus /> 新增行
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        {mockDataTablesData.map((t) => (
          <button
            key={t.tableId}
            onClick={() => { setTableId(t.tableId); handleFetchTableRows({ tableId: t.tableId, keyword: '', page: 1, pageSize: 50 }); }}
            className={cn('rounded-lg border bg-card p-4 text-left transition hover:border-primary/40', t.tableId === tableId && 'border-primary ring-1 ring-primary/30')}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.tableName}</span>
              <span className="text-xs text-muted-foreground">{t.rowCount} 行</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              <ToneBadge tone="gray">主键 {t.primaryKey}</ToneBadge>
              {t.factSlotColumns > 0 && <ToneBadge tone="teal">{t.factSlotColumns} 列绑定事实</ToneBadge>}
              <ToneBadge tone="blue">{t.consumerCount} 个调用方</ToneBadge>
            </div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{table.tableName}</CardTitle>
          <CardDescription>
            点击单元格编辑。<span className="inline-flex items-center gap-1 text-teal-700"><Link2 className="size-3" />青色列</span> 绑定事实，需要改值请到事实库。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8"
              placeholder="搜索型号或名称"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); handleFetchTableRows({ tableId, keyword: e.target.value, page: 1, pageSize: 50 }); }}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>型号</TableHead>
                <TableHead>名称</TableHead>
                {COLUMNS.map((c) => (
                  <TableHead key={c.key} className={cn(c.numeric && 'text-right')}>
                    {c.label}
                  </TableHead>
                ))}
                <TableHead>适用区域</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最近修改</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.rowId}>
                  <TableCell className="font-mono text-xs">{r.modelCode}</TableCell>
                  <TableCell>
                    {editing === `${r.rowId}.productName` ? (
                      <Input
                        autoFocus
                        className="h-7"
                        defaultValue={r.productName}
                        onBlur={(e) => { handleUpdateCell(tableId, r.rowId, 'productName', e.target.value); const val = e.target.value; setCatalog((prev) => prev.map((x) => (x.rowId === r.rowId ? { ...x, productName: val } : x))); setEditing(null); }}
                      />
                    ) : (
                      <button className="rounded px-1 hover:bg-muted" onClick={() => setEditing(`${r.rowId}.productName`)}>
                        {r.productName}
                      </button>
                    )}
                  </TableCell>
                  {COLUMNS.map((c) => {
                    const bound = r.factBoundColumns.includes(c.key);
                    const v = r[c.key] as string | number | null;
                    return (
                      <TableCell key={c.key} className={cn('tabular-nums', c.numeric && 'text-right', bound && 'bg-teal-50/60 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200')}>
                        {v === null ? <span className="text-red-600">缺失</span> : v}
                        {bound && <Link2 className="ml-1 inline size-3 opacity-60" />}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-sm">{r.regionLabel}</TableCell>
                  <TableCell>
                    <ContentStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.editedBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>共 {table.rowCount} 行 · 显示 {rows.length}</span>
            <div className="flex gap-1">
              <Button size="xs" variant="outline" disabled>
                上一页
              </Button>
              <Button size="xs" variant="outline" onClick={() => handleFetchTableRows({ tableId, keyword, page: 2, pageSize: 50 })}>
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>导入到「{table.tableName}」</DialogTitle>
            <DialogDescription>先预检再导入。导入的行进入草稿，送审后生效。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-dashed p-3 text-muted-foreground">已选文件：{mockImportPreviewData.fileName}</div>
            <Select items={IMPORT_MODE_OPTIONS} value={importMode} onValueChange={(v) => { setImportMode(v as ImportMode); handlePreviewImport(tableId, v as ImportMode); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_MODE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ['总行数', mockImportPreviewData.totalRows],
                ['新增', mockImportPreviewData.createCount],
                ['更新', mockImportPreviewData.updateCount],
                ['跳过', mockImportPreviewData.skipCount],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md bg-muted/60 p-2">
                  <div className="text-lg font-semibold tabular-nums">{v}</div>
                  <div className="text-xs text-muted-foreground">{k}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="font-medium">需要处理 {mockImportPreviewData.errors.length} 处</div>
              {mockImportPreviewData.errors.map((e) => (
                <div key={e.line} className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
                  第 {e.line} 行 · {e.column}：{e.message}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              取消
            </Button>
            <Button onClick={() => { handleConfirmImport(tableId, importMode); setImportOpen(false); }}>跳过错误行并导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
