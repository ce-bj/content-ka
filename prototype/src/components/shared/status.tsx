import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// 全站统一的状态标识（静态配置，不是动态数据）

export type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'teal';

export const TONE_CLASS: Record<Tone, string> = {
  gray: 'bg-muted text-muted-foreground',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
};

export function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('rounded-md font-normal', TONE_CLASS[tone], className)}>
      {children}
    </Badge>
  );
}

// 内容版本状态
export type ContentStatus = 'draft' | 'in_review' | 'published' | 'unpublished';
export const CONTENT_STATUS_CONFIG: Record<ContentStatus, { label: string; tone: Tone }> = {
  draft: { label: '草稿', tone: 'gray' },
  in_review: { label: '审核中', tone: 'blue' },
  published: { label: '已生效', tone: 'green' },
  unpublished: { label: '已下线', tone: 'amber' },
};
export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  const c = CONTENT_STATUS_CONFIG[status];
  return <ToneBadge tone={c.tone}>{c.label}</ToneBadge>;
}

// 同步状态（事实、资产通用）
export type SyncStatus =
  | 'synced'
  | 'source_updated'
  | 'local_modified'
  | 'both_modified'
  | 'source_deleted'
  | 'sync_failed'
  | 'local_only';
export const SYNC_STATUS_CONFIG: Record<SyncStatus, { label: string; tone: Tone }> = {
  synced: { label: '已同步', tone: 'green' },
  source_updated: { label: '源已更新', tone: 'blue' },
  local_modified: { label: '本地已修改', tone: 'violet' },
  both_modified: { label: '双方都改了', tone: 'red' },
  source_deleted: { label: '源已删除', tone: 'amber' },
  sync_failed: { label: '同步失败', tone: 'red' },
  local_only: { label: '本地', tone: 'gray' },
};
export function SyncBadge({ status }: { status: SyncStatus }) {
  const c = SYNC_STATUS_CONFIG[status];
  return <ToneBadge tone={c.tone}>{c.label}</ToneBadge>;
}

// 证据等级
export type EvidenceGrade = 'A' | 'B' | 'C';
export const EVIDENCE_CONFIG: Record<EvidenceGrade, { label: string; tone: Tone; hint: string }> = {
  A: { label: 'A', tone: 'green', hint: '第三方检测 / 证书 / 型式试验' },
  B: { label: 'B', tone: 'blue', hint: '企业正式文件 / 系统数据' },
  C: { label: 'C', tone: 'amber', hint: '自我声明，仅内部引用' },
};
export function EvidenceBadge({ grade }: { grade: EvidenceGrade }) {
  const c = EVIDENCE_CONFIG[grade];
  return (
    <ToneBadge tone={c.tone} className="font-mono font-medium">
      {c.label}
    </ToneBadge>
  );
}

export function AiMark({ className }: { className?: string }) {
  return (
    <ToneBadge tone="violet" className={className}>
      AI 生成
    </ToneBadge>
  );
}
