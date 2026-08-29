import { useForm } from 'react-hook-form';
import { useState } from 'react';
import type { FormField } from '../../types';
import { getFieldValidation } from '../../lib/fieldValidation';
import { getFieldTypeLabel } from './fieldMeta';
import { Button } from '../ui/button';
import { CheckCircle2, RotateCcw, Info } from 'lucide-react';

/**
 * A live, frontend-only preview of the published form.
 *
 * Respondents can type into real controls, trigger the field validation rules
 * configured in the editor, and hit "Submit preview" — but nothing is ever
 * sent to the backend and nothing is saved. This exists so builders can feel
 * the exact validation experience without affecting data.
 */
export default function InteractivePreview({ fields }: { fields: FormField[] }) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm();
  const [submitted, setSubmitted] = useState(false);

  const requiredCount = fields.filter((f) => f.required).length;

  const onSubmit = () => {
    // Client-side only — validation already ran via react-hook-form.
    setSubmitted(true);
  };

  const handleReset = () => {
    reset({});
    setSubmitted(false);
  };

  const getControl = (field: FormField) => {
    const opts = getFieldValidation(field);
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
      case 'date':
      case 'time':
        return (
          <input
            type={field.type === 'number' ? 'text' : field.type}
            placeholder={field.placeholder || `Enter ${getFieldTypeLabel(field.type).toLowerCase()}`}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            {...register(field.id, opts)}
          />
        );
      case 'textarea':
        return (
          <textarea
            placeholder={field.placeholder || 'Enter long text'}
            className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            {...register(field.id, opts)}
          />
        );
      case 'select':
        return (
          <select
            className="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-[13px] shadow-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
            {...register(field.id, opts)}
          >
            <option value="">Select an option…</option>
            {(field.options ?? []).map((o, i) => (
              <option key={i} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      case 'radio':
        return (
          <div className="space-y-1.5">
            {(field.options ?? []).map((o, i) => (
              <label key={i} className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="radio" value={o.value} className="accent-primary" {...register(field.id, opts)} />
                {o.label}
              </label>
            ))}
            {(field.options ?? []).length === 0 && (
              <span className="text-[12px] text-muted-foreground">No options configured.</span>
            )}
          </div>
        );
      case 'checkbox':
        return (
          <div className="space-y-1.5">
            {(field.options ?? []).map((o, i) => (
              <label key={i} className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" value={o.value} className="accent-primary" {...register(field.id, opts)} />
                {o.label}
              </label>
            ))}
            {(field.options ?? []).length === 0 && (
              <span className="text-[12px] text-muted-foreground">No options configured.</span>
            )}
          </div>
        );
      case 'multiselect':
        return (
          <div className="space-y-1.5">
            {(field.options ?? []).map((o, i) => (
              <label key={i} className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  value={o.value}
                  className="accent-primary"
                  {...register(field.id, {
                    ...opts,
                    validate: {
                      arrayMin: (v: any) =>
                        !field.required ||
                        (Array.isArray(v) && v.length > 0) ||
                        'This field is required',
                    },
                  })}
                />
                {o.label}
              </label>
            ))}
            {(field.options ?? []).length === 0 && (
              <span className="text-[12px] text-muted-foreground">No options configured.</span>
            )}
          </div>
        );
      case 'rating':
        return <RatingPreview field={field} />;
      case 'html':
      case 'display':
      case 'file':
      case 'signature':
      case 'table':
        return (
          <div className="flex h-14 items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 text-[12px] text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            {getFieldTypeLabel(field.type)} is interactive in the live form only.
          </div>
        );
      default:
        return (
          <input
            placeholder={field.placeholder || 'Enter value'}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] shadow-sm outline-none focus:ring-2 focus:ring-ring"
            {...register(field.id, opts)}
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-4">
        {fields.map((field) => {
          const err = (errors as Record<string, { message?: string }>)[field.id];
          return (
            <div key={field.id}>
              <div className="mb-1.5 flex items-baseline gap-1">
                <label className="text-[13px] font-semibold text-foreground">{field.label}</label>
                {field.required && <span className="text-destructive">*</span>}
              </div>
              {field.helpText && (
                <p className="mb-1.5 text-[12px] text-muted-foreground">{field.helpText}</p>
              )}
              {getControl(field)}
              {err && err.message && (
                <p className="mt-1.5 text-[12px] font-medium text-destructive">{err.message}</p>
              )}
            </div>
          );
        })}

        {fields.length === 0 && (
          <p className="py-8 text-center text-[13px] text-muted-foreground">
            This form has no fields yet.
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="mt-5 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-[12px] text-muted-foreground">
        <span>{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
        <span className="mx-1.5 text-muted-foreground/40">·</span>
        <span>{requiredCount} required</span>
        <span className="mx-1.5 text-muted-foreground/40">·</span>
        <span>Preview only — nothing is saved</span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button type="submit" size="sm">
          Submit preview
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {submitted && Object.keys(errors).length === 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Validated successfully. This preview never submits or saves real data.
        </div>
      )}
      {submitted && Object.keys(errors).length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800">
          Fix the highlighted fields and try again.
        </div>
      )}
    </form>
  );
}

function RatingPreview({ field }: { field: FormField }) {
  const [value, setValue] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setValue(n)}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
          className={`h-6 w-6 text-[22px] leading-none transition-transform hover:scale-110 ${
            n <= value ? 'text-amber-500' : 'text-border'
          }`}
        >
          ★
        </button>
      ))}
      <span className="ml-1 text-[12px] text-muted-foreground">
        {field.label && value > 0 ? `${value} / 5` : 'Tap to rate'}
      </span>
    </div>
  );
}
