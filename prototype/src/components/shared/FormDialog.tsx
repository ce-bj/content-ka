import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// 原型通用的新建表单弹窗：字段由页面以静态配置传入，提交后由页面把新对象加入列表
export interface FormField {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'select' | 'multi' | 'datetime' | 'number';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | string[];
  hint?: string;
}
export type FormValues = Record<string, string | string[]>;

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  submitLabel = '创建',
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
  onSubmit: (values: FormValues) => void;
}) {
  const init = () => Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? (f.kind === 'multi' ? [] : f.kind === 'select' ? f.options?.[0]?.value ?? '' : '')])) as FormValues;
  const [values, setValues] = useState<FormValues>(init);
  useEffect(() => {
    if (open) setValues(init());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (k: string, v: string | string[]) => setValues((p) => ({ ...p, [k]: v }));
  const missing = fields.some((f) => f.required && (Array.isArray(values[f.key]) ? (values[f.key] as string[]).length === 0 : !String(values[f.key] ?? '').trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>
                {f.label}
                {f.required && <span className="text-red-600">*</span>}
              </Label>
              {(f.kind === 'text' || f.kind === 'datetime' || f.kind === 'number') && (
                <Input
                  type={f.kind === 'datetime' ? 'datetime-local' : f.kind === 'number' ? 'number' : 'text'}
                  placeholder={f.placeholder}
                  value={values[f.key] as string}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
              {f.kind === 'textarea' && <Textarea rows={2} placeholder={f.placeholder} value={values[f.key] as string} onChange={(e) => set(f.key, e.target.value)} />}
              {f.kind === 'select' && (
                <Select items={f.options} value={values[f.key] as string} onValueChange={(v) => set(f.key, v as string)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options?.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {f.kind === 'multi' && (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {f.options?.map((o) => {
                    const arr = values[f.key] as string[];
                    return (
                      <Label key={o.value} className="flex items-center gap-2 rounded-md border px-2 py-1.5 font-normal">
                        <Checkbox checked={arr.includes(o.value)} onCheckedChange={(c) => set(f.key, c ? [...arr, o.value] : arr.filter((x) => x !== o.value))} />
                        {o.label}
                      </Label>
                    );
                  })}
                </div>
              )}
              {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={missing}
            onClick={() => {
              onSubmit(values);
              onOpenChange(false);
            }}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const labelOf = (options: { value: string; label: string }[] | undefined, v: string) => options?.find((o) => o.value === v)?.label ?? v;
