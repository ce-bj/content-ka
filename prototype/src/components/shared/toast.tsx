import { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';

// 原型用的轻量提示：替代 alert，不打断操作
type ToastItem = { id: number; text: string };
type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l([...items]));

export function notify(text: string) {
  const id = ++seq;
  items = [...items, { id, text }].slice(-4);
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 4200);
}

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {list.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-start gap-2 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <span className="flex-1">{t.text}</span>
          <button
            aria-label="关闭"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              items = items.filter((x) => x.id !== t.id);
              emit();
            }}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
