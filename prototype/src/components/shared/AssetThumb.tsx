import { FileAudio, FileText, ImageIcon, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MediaType = 'image' | 'video' | 'document' | 'audio';

const ICON: Record<MediaType, React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  audio: FileAudio,
};

const HUES = [
  'from-sky-100 to-sky-200 text-sky-700 dark:from-sky-950 dark:to-sky-900 dark:text-sky-300',
  'from-emerald-100 to-emerald-200 text-emerald-700 dark:from-emerald-950 dark:to-emerald-900 dark:text-emerald-300',
  'from-amber-100 to-amber-200 text-amber-700 dark:from-amber-950 dark:to-amber-900 dark:text-amber-300',
  'from-violet-100 to-violet-200 text-violet-700 dark:from-violet-950 dark:to-violet-900 dark:text-violet-300',
  'from-rose-100 to-rose-200 text-rose-700 dark:from-rose-950 dark:to-rose-900 dark:text-rose-300',
  'from-slate-100 to-slate-200 text-slate-700 dark:from-slate-900 dark:to-slate-800 dark:text-slate-300',
];

// 原型不加载真实图片：用色块 + 类型图标代替缩略图
export function AssetThumb({ mediaType, seed, className, label }: { mediaType: MediaType; seed: string; className?: string; label?: string }) {
  const Icon = ICON[mediaType];
  const hue = HUES[[...seed].reduce((s, ch) => s + ch.charCodeAt(0), 0) % HUES.length];
  return (
    <div className={cn('relative flex items-center justify-center overflow-hidden rounded-md bg-gradient-to-br', hue, className)}>
      <Icon className="size-6 opacity-70" />
      {label && <span className="absolute right-1 bottom-1 rounded bg-black/50 px-1 text-[10px] text-white">{label}</span>}
    </div>
  );
}
