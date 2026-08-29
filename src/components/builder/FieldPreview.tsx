import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Star, Upload, PenTool, Table } from 'lucide-react';
import type { FormField, FormVariable } from '../../types';

/**
 * Read-only approximation of how a field will appear on the published form.
 * Mirrors the public renderer's visual treatment (labels, help text, required
 * marker) without any submission logic. Used by the editor's "Preview" mode.
 */
interface FieldPreviewProps {
  field: FormField;
  variables: FormVariable[];
}

function OptionsList({ field }: { field: FormField }) {
  const options = field.options ?? [];
  if (options.length === 0) {
    return <p className="text-[13px] italic text-muted-foreground">No options added yet</p>;
  }
  const isCheck = field.type === 'checkbox' || field.type === 'multiselect';
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2">
          <span
            className={
              isCheck
                ? 'h-4 w-4 shrink-0 rounded border border-border bg-background'
                : 'h-4 w-4 shrink-0 rounded-full border border-border bg-background'
            }
          />
          <span className="text-[13px] text-foreground">{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function FieldPreview({ field, variables }: FieldPreviewProps) {
  const required = field.required;

  const renderControl = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
        return <Input disabled placeholder={field.placeholder} type={field.type === 'phone' ? 'tel' : field.type} />;
      case 'number':
        return <Input disabled type="number" placeholder={field.placeholder} />;
      case 'date':
        return <Input disabled type="date" />;
      case 'time':
        return <Input disabled type="time" />;
      case 'textarea':
        return (
          <div className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] text-muted-foreground/70">
            {field.placeholder || ''}
          </div>
        );
      case 'select':
        return (
          <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-[13px] text-muted-foreground">
            <span>{field.placeholder || 'Select an option'}</span>
            <span className="text-muted-foreground/60">▾</span>
          </div>
        );
      case 'radio':
      case 'checkbox':
      case 'multiselect':
        return <OptionsList field={field} />;
      case 'file':
        return (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-6 py-8 text-center">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-[13px] text-muted-foreground">
              {field.fileConfig?.multiple ? 'Drop files here or click to browse' : 'Drop file here or click to browse'}
            </p>
          </div>
        );
      case 'rating':
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className="h-6 w-6 text-muted-foreground/40" />
            ))}
          </div>
        );
      case 'signature':
        return (
          <div className="flex h-24 items-center justify-center rounded-md border border-input bg-background text-muted-foreground">
            <PenTool className="mr-2 h-4 w-4" />
            <span className="text-[13px]">Sign here</span>
          </div>
        );
      case 'table':
        return (
          <div className="flex h-24 items-center justify-center rounded-md border border-input bg-muted/40 text-muted-foreground">
            <Table className="mr-2 h-4 w-4" />
            <span className="text-[13px]">Table grid</span>
          </div>
        );
      case 'display': {
        const variable = variables.find((v) => v.id === field.displayConfig?.variableId);
        return (
          <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2.5">
            <span className="text-[13px] font-medium text-muted-foreground">
              {field.displayConfig?.label || variable?.name || field.label}
            </span>
            <span className="text-[13px] font-semibold text-foreground">—</span>
          </div>
        );
      }
      case 'html':
        return null;
      default:
        return <Input disabled placeholder={field.placeholder} />;
    }
  };

  const control = renderControl();
  if (control === null) return null;

  return (
    <div className="space-y-2">
      <Label>
        {field.label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {control}
      {field.helpText && <p className="text-[12px] text-muted-foreground">{field.helpText}</p>}
    </div>
  );
}
