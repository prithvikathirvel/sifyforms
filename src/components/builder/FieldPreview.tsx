import type { FormField } from '../../types';
import { ChevronDown, Circle, CheckSquare, Star, Upload, PenTool, Code, Calculator, Table2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getFieldTypeLabel } from './fieldMeta';

function PreviewShell({ control, hint }: {
  control: React.ReactNode; hint?: string;
}) {
  return (
    <div className="pointer-events-none select-none">
      {control}
      {hint && <p className="mt-1.5 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls = 'w-full h-9 rounded-md border border-input bg-background px-3 text-[13px] text-foreground shadow-sm';

/**
 * Renders a field the way a respondent would see it in the published form,
 * in a disabled/read-only state. Used on the canvas (edit mode) and in the
 * editor Preview toggle so the canvas looks like the real form.
 */
export function FieldPreview({ field }: { field: FormField }) {
  const p = field.placeholder || `Enter ${getFieldTypeLabel(field.type).toLowerCase()}`;

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'number':
    case 'date':
    case 'time':
      return <PreviewShell control={
        <input
          type={field.type === 'number' ? 'text' : field.type}
          placeholder={p}
          className={inputCls}
          tabIndex={-1}
          readOnly
        />
      } />;

    case 'textarea':
      return <PreviewShell control={
        <textarea placeholder={p} readOnly tabIndex={-1}
          className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-[13px] shadow-sm" />
      } />;

    case 'select':
    case 'multiselect':
      return <PreviewShell control={
        <div className="relative">
          <div className={cn(inputCls, 'flex items-center justify-between pr-9 text-muted-foreground')}>
            <span className="truncate">{field.options && field.options.length > 0 ? field.options[0].label : 'Select an option'}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </div>
      } />;

    case 'radio':
      return <PreviewShell control={
        <div className="space-y-1.5">
          {(field.options ?? []).map((o, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px] text-foreground">
              <Circle className="h-4 w-4 text-border" />
              <span>{o.label}</span>
            </div>
          ))}
          {(field.options ?? []).length === 0 && (
            <span className="text-[13px] text-muted-foreground">No options yet</span>
          )}
        </div>
      } />;

    case 'checkbox':
      return <PreviewShell control={
        <div className="space-y-1.5">
          {(field.options ?? []).map((o, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px] text-foreground">
              <CheckSquare className="h-4 w-4 text-border" />
              <span>{o.label}</span>
            </div>
          ))}
          {(field.options ?? []).length === 0 && (
            <span className="text-[13px] text-muted-foreground">No options yet</span>
          )}
        </div>
      } />;

    case 'rating':
      return <PreviewShell control={
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-5 w-5 text-border fill-border/40" />
          ))}
        </div>
      } />;

    case 'file':
      return <PreviewShell control={
        <div className="flex h-16 items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/30 text-[13px] text-muted-foreground">
          <Upload className="h-4 w-4" />
          <span>Upload a file</span>
        </div>
      } />;

    case 'signature':
      return <PreviewShell control={
        <div className="flex h-16 items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/30 text-[13px] text-muted-foreground">
          <PenTool className="h-4 w-4" />
          <span>Draw signature</span>
        </div>
      } />;

    case 'html':
      return <PreviewShell control={
        <div className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-[13px] text-muted-foreground">
          <Code className="h-4 w-4" />
          <span>Custom HTML block</span>
        </div>
      } />;

    case 'display':
      return <PreviewShell control={
        <div className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-[13px] text-foreground">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <span>{field.label}</span>
        </div>
      } />;

    case 'table':
      return <PreviewShell control={
        <div className="overflow-hidden rounded-md border border-input">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[12px] font-medium text-muted-foreground">
            <Table2 className="h-3.5 w-3.5" />
            {(field.tableConfig?.columns?.length ?? 0)} column(s) · {(field.tableConfig?.defaultRows ?? 1)} row(s)
          </div>
          <div className="grid grid-cols-3 gap-px bg-border">
            {(field.tableConfig?.columns ?? []).slice(0, 3).map((c) => (
              <div key={c.id} className="bg-background px-3 py-2 text-[12px] text-muted-foreground">
                {c.label}
              </div>
            ))}
          </div>
        </div>
      } />;

    default:
      return <PreviewShell control={
        <input placeholder={p} readOnly tabIndex={-1} className={inputCls} />
      } />;
  }
}
