import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileUp,
  Info,
  PenLine,
  RotateCcw,
  Send,
  ShieldCheck,
  Smartphone,
  Star,
  X,
} from 'lucide-react';
import type { FormField, FormLayout, FormSchema, FormSettings } from '../../types';
import { evaluateShowWhen } from '../../lib/ruleEngine';

interface BuilderPreviewModalProps {
  open: boolean;
  onClose: () => void;
  formName: string;
  description: string;
  schema: FormSchema;
  settings: FormSettings;
  layout: FormLayout;
}

type PreviewValues = Record<string, unknown>;
type PreviewErrors = Record<string, string>;

type FieldMeta = {
  label: string;
};

const FIELD_META: Record<FormField['type'], FieldMeta> = {
  text: { label: 'Text input' },
  email: { label: 'Email' },
  phone: { label: 'Phone' },
  number: { label: 'Number' },
  select: { label: 'Dropdown' },
  radio: { label: 'Radio buttons' },
  checkbox: { label: 'Checkboxes' },
  multiselect: { label: 'Multi-select' },
  date: { label: 'Date picker' },
  time: { label: 'Time picker' },
  textarea: { label: 'Long text' },
  file: { label: 'File upload' },
  rating: { label: 'Rating' },
  signature: { label: 'Signature' },
  html: { label: 'Instructions' },
  display: { label: 'Display value' },
  table: { label: 'Table grid' },
};

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isEmptyValue);
  return false;
}

function asText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

function getInitialPreviewValues(schema: FormSchema): PreviewValues {
  return (schema.fields ?? []).reduce<PreviewValues>((initialValues, field) => {
    if (field.defaultValue !== undefined && field.defaultValue !== null) {
      initialValues[field.id] = field.defaultValue;
    }
    return initialValues;
  }, {});
}

function validateFileValue(field: FormField, value: unknown): string | undefined {
  const config = field.fileConfig;
  if (!config) return undefined;

  const files = (Array.isArray(value) ? value : [value]).filter(Boolean).map((item) =>
    item && typeof item === 'object' ? item as { name?: unknown; size?: unknown; type?: unknown } : {}
  );
  if (config.maxFiles !== undefined && files.length > config.maxFiles) {
    return `Choose no more than ${config.maxFiles} file${config.maxFiles === 1 ? '' : 's'}.`;
  }

  for (const file of files) {
    const name = String(file.name || '').toLowerCase();
    const mimeType = String(file.type || '').toLowerCase();
    if (config.minSize !== undefined && Number(file.size) < config.minSize) {
      return 'The selected file is smaller than the configured minimum.';
    }
    if (config.maxSize !== undefined && Number(file.size) > config.maxSize) {
      return 'The selected file is larger than the configured maximum.';
    }
    if (config.accept?.length) {
      const accepted = config.accept.some((pattern) => {
        const normalizedPattern = pattern.toLowerCase().trim();
        if (normalizedPattern.startsWith('.')) return name.endsWith(normalizedPattern);
        if (normalizedPattern.endsWith('/*')) return mimeType.startsWith(normalizedPattern.slice(0, -1));
        return mimeType === normalizedPattern;
      });
      if (!accepted) return 'This file type is not allowed by the current policy.';
    }
  }
  return undefined;
}

function validateField(field: FormField, value: unknown, values: PreviewValues): string | undefined {
  if (field.disabled || field.type === 'html' || field.type === 'display') return undefined;

  const isEmpty = isEmptyValue(value);
  if (field.required && isEmpty) return 'This field is required.';
  if (isEmpty) return undefined;
  if (field.type === 'file') {
    const fileError = validateFileValue(field, value);
    if (fileError) return fileError;
  }

  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asText(value))) {
    return 'Enter a valid email address.';
  }
  if (field.type === 'phone' && !/^[+\d][\d\s().-]{6,}$/.test(asText(value))) {
    return 'Enter a valid phone number.';
  }
  if (field.type === 'number' && !Number.isFinite(Number(value))) {
    return 'Enter a valid number.';
  }

  const validation = field.validation;
  if (validation) {
    const text = asText(value);
    if (validation.minLength !== undefined && text.length < validation.minLength) return `Use at least ${validation.minLength} characters.`;
    if (validation.maxLength !== undefined && text.length > validation.maxLength) return `Use no more than ${validation.maxLength} characters.`;
    if (validation.min !== undefined && Number(value) < validation.min) return `Use a value of ${validation.min} or higher.`;
    if (validation.max !== undefined && Number(value) > validation.max) return `Use a value of ${validation.max} or lower.`;
    if (validation.pattern) {
      try {
        if (!new RegExp(validation.pattern).test(text)) return validation.message || 'The value has an invalid format.';
      } catch {
        // A malformed pattern is reported in the editor, not allowed to break Preview.
      }
    }
    if (validation.equalToFieldId && String(value) !== String(values[validation.equalToFieldId])) {
      return validation.equalToMessage || 'This value does not match.';
    }
  }

  for (const rule of field.rules ?? []) {
    if (rule.enabled === false) continue;
    const ruleValue = rule.value;
    const text = asText(value);
    const message = rule.message;
    switch (rule.type) {
      case 'required':
        if (isEmpty) return message || 'This field is required.';
        break;
      case 'minLength':
        if (text.length < Number(ruleValue)) return message || `Use at least ${ruleValue} characters.`;
        break;
      case 'maxLength':
        if (text.length > Number(ruleValue)) return message || `Use no more than ${ruleValue} characters.`;
        break;
      case 'min':
      case 'greaterThan':
      case 'gte':
        if (rule.type === 'min' && Number(value) < Number(ruleValue)) return message || `Use a value of ${ruleValue} or higher.`;
        if (rule.type === 'greaterThan' && Number(value) <= Number(ruleValue)) return message || `Use a value greater than ${ruleValue}.`;
        if (rule.type === 'gte' && Number(value) < Number(ruleValue)) return message || `Use a value of ${ruleValue} or higher.`;
        break;
      case 'max':
      case 'lessThan':
      case 'lte':
        if (rule.type === 'max' && Number(value) > Number(ruleValue)) return message || `Use a value of ${ruleValue} or lower.`;
        if (rule.type === 'lessThan' && Number(value) >= Number(ruleValue)) return message || `Use a value less than ${ruleValue}.`;
        if (rule.type === 'lte' && Number(value) > Number(ruleValue)) return message || `Use a value of ${ruleValue} or lower.`;
        break;
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return message || 'Enter a valid email address.';
        break;
      case 'contains':
        if (!text.includes(String(ruleValue))) return message || `Include “${ruleValue}”.`;
        break;
      case 'notContains':
        if (text.includes(String(ruleValue))) return message || `Do not include “${ruleValue}”.`;
        break;
      case 'startsWith':
        if (!text.startsWith(String(ruleValue))) return message || `Start with “${ruleValue}”.`;
        break;
      case 'endsWith':
        if (!text.endsWith(String(ruleValue))) return message || `End with “${ruleValue}”.`;
        break;
      case 'equals':
        if (String(value) !== String(ruleValue)) return message || `Enter exactly “${ruleValue}”.`;
        break;
      case 'notEquals':
        if (String(value) === String(ruleValue)) return message || `Use a value other than “${ruleValue}”.`;
        break;
      case 'pattern':
      case 'regex':
        try {
          if (!new RegExp(String(ruleValue)).test(text)) return message || 'The value has an invalid format.';
        } catch {
          // Keep Preview resilient when an unfinished rule is being edited.
        }
        break;
      case 'custom':
        if (String(value) !== String(values[String(ruleValue)])) return message || 'This value does not match.';
        break;
      case 'url':
        try {
          new URL(text);
        } catch {
          return message || 'Enter a valid URL.';
        }
        break;
    }
  }

  if (field.options?.length) {
    const allowed = new Set(field.options.map((option) => option.value));
    const selected = Array.isArray(value) ? value : [value];
    if (selected.some((option) => !allowed.has(String(option)))) return 'Choose an available option.';
  }

  return undefined;
}

function FieldLabel({ field }: { field: FormField }) {
  return (
    <div className="mb-1.5 flex items-start justify-between gap-3">
      <div>
        <label htmlFor={`preview-${field.id}`} className="text-sm font-bold tracking-tight text-foreground">
          {field.label || 'Untitled field'}
          {field.required && <span className="ml-1 text-destructive" aria-label="required">*</span>}
        </label>
        {field.helpText && <p className="mt-1 text-xs leading-5 text-muted-foreground">{field.helpText}</p>}
      </div>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{FIELD_META[field.type].label}</span>
    </div>
  );
}

function ControlShell({ children, error, errorId }: { children: ReactNode; error?: string; errorId?: string }) {
  return (
    <>
      {children}
      {error && <p id={errorId} className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-destructive" role="alert"><CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />{error}</p>}
    </>
  );
}

const inputClassName = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';
const optionClassName = 'flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/80 bg-background px-3 py-2.5 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.025]';

function PreviewField({
  field,
  value,
  error,
  onChange,
}: {
  field: FormField;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const errorId = `preview-${field.id}-error`;
  const commonProps = {
    id: `preview-${field.id}`,
    disabled: field.disabled,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? errorId : undefined,
  };
  const textValue = asText(value);
  const options = field.options ?? [];

  const toggleArrayValue = (optionValue: string) => {
    const current = Array.isArray(value) ? value.map(String) : [];
    onChange(current.includes(optionValue) ? current.filter((item) => item !== optionValue) : [...current, optionValue]);
  };

  let control: ReactNode;
  switch (field.type) {
    case 'textarea':
      control = <textarea {...commonProps} value={textValue} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder || 'Type your answer'} rows={4} className={`${inputClassName} h-auto resize-y py-2.5`} />;
      break;
    case 'select':
      control = (
        <select {...commonProps} value={textValue} onChange={(event) => onChange(event.target.value)} className={inputClassName}>
          <option value="">{field.placeholder || 'Select an option'}</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      );
      break;
    case 'radio':
      control = (
        <div className="space-y-2" role="radiogroup" aria-label={field.label} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}>
          {options.map((option) => (
            <label key={option.value} className={optionClassName}>
              <input type="radio" name={`preview-${field.id}`} value={option.value} checked={textValue === option.value} onChange={() => onChange(option.value)} disabled={field.disabled} className="h-4 w-4 accent-primary" />
              <span>{option.label}</span>
            </label>
          ))}
          {options.length === 0 && <p className="text-xs text-muted-foreground">No options configured for this field.</p>}
        </div>
      );
      break;
    case 'checkbox':
    case 'multiselect':
      control = (
        <div className="space-y-2">
          {options.length > 0 ? options.map((option) => {
            const checked = Array.isArray(value) && value.map(String).includes(option.value);
            return (
              <label key={option.value} className={optionClassName}>
                <input type="checkbox" checked={checked} onChange={() => toggleArrayValue(option.value)} disabled={field.disabled} className="h-4 w-4 rounded accent-primary" />
                <span>{option.label}</span>
              </label>
            );
          }) : (
            <label className={optionClassName}>
              <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} disabled={field.disabled} className="h-4 w-4 rounded accent-primary" />
              <span>{field.label || 'I agree'}</span>
            </label>
          )}
        </div>
      );
      break;
    case 'file': {
      const selectedFiles = (Array.isArray(value) ? value : [value]).filter(Boolean) as Array<{ name?: string }>;
      const fileLabel = selectedFiles.length === 0
        ? 'Choose file'
        : selectedFiles.length === 1
          ? selectedFiles[0].name || '1 file selected'
          : `${selectedFiles.length} files selected`;
      control = (
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-primary/25 bg-primary/[0.025] px-3 py-3 transition-colors hover:border-primary/50">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary"><FileUp className="h-4 w-4" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{fileLabel}</span><span className="block text-xs text-muted-foreground">Preview only — nothing will be uploaded</span></span>
          <input {...commonProps} type="file" multiple={field.fileConfig?.multiple} accept={field.fileConfig?.accept?.join(',')} onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files ?? []).map((file) => ({ name: file.name, size: file.size, type: file.type }));
            if (field.fileConfig?.multiple) onChange(files);
            else onChange(files[0]);
          }} className="sr-only" />
        </label>
      );
      break;
    }
    case 'rating':
      control = (
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label={field.label}>
          {[1, 2, 3, 4, 5].map((rating) => (
            <button key={rating} type="button" disabled={field.disabled} onClick={() => onChange(rating)} aria-label={`${rating} out of 5`} aria-pressed={Number(value) === rating} className={`rounded-md p-1 transition-colors ${Number(value) >= rating ? 'text-primary' : 'text-muted-foreground/30'} hover:bg-primary/10`}>
              <Star className="h-6 w-6" fill="currentColor" aria-hidden="true" />
            </button>
          ))}
          <span className="ml-2 text-xs font-semibold text-muted-foreground">{value ? `${value}/5` : 'Choose a rating'}</span>
        </div>
      );
      break;
    case 'signature':
      control = (
        <button type="button" disabled={field.disabled} onClick={() => onChange(true)} className={`flex h-16 w-full items-end justify-between rounded-lg border border-dashed px-3 pb-2 text-left text-xs transition-colors ${value ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/35'}`}>
          <span className="border-b border-dashed border-current pb-1">{value ? 'Signature captured in preview' : 'Click to sign in preview'}</span>
          <PenLine className="h-4 w-4" aria-hidden="true" />
        </button>
      );
      break;
    case 'table': {
      const columns = field.tableConfig?.columns?.slice(0, 4) ?? [];
      const row = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
      control = columns.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border/80">
          <table className="min-w-full text-left text-xs"><thead className="bg-muted/50"><tr>{columns.map((column) => <th key={column.id} className="whitespace-nowrap px-2.5 py-2 font-bold text-foreground">{column.label}</th>)}</tr></thead><tbody><tr>{columns.map((column) => <td key={column.id} className="p-1.5"><input type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'} value={asText(row[column.id])} onChange={(event) => onChange({ ...row, [column.id]: event.target.value })} placeholder={column.placeholder || 'Enter value'} className="h-8 min-w-[110px] rounded border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" /></td>)}</tr></tbody></table>
        </div>
      ) : <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">Configure table columns in the inspector to preview this table.</div>;
      break;
    }
    case 'display':
      control = <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-3 text-sm font-semibold text-primary"><span className="font-mono text-xs">ƒx</span>{field.displayConfig?.format || 'Calculated value appears here'}</div>;
      break;
    case 'html':
      control = <div className="rounded-lg border border-border/80 bg-muted/35 px-3 py-3 text-sm leading-6 text-muted-foreground">{field.helpText || 'Supporting instructions appear here.'}</div>;
      break;
    case 'date':
    case 'time':
    case 'email':
    case 'phone':
    case 'number':
    case 'text':
    default:
      control = <input {...commonProps} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : field.type === 'email' ? 'email' : 'text'} value={textValue} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder || `Enter ${FIELD_META[field.type].label.toLowerCase()}`} min={field.minValue as string | number | undefined} max={field.maxValue as string | number | undefined} className={inputClassName} />;
  }

  return (
    <div>
      <FieldLabel field={field} />
      <ControlShell error={error} errorId={errorId}>{control}</ControlShell>
      {field.disabled && <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">This field is disabled in the current configuration.</p>}
    </div>
  );
}

export default function BuilderPreviewModal({ open, onClose, formName, description, schema, settings, layout }: BuilderPreviewModalProps) {
  const [values, setValues] = useState<PreviewValues>(() => getInitialPreviewValues(schema));
  const [errors, setErrors] = useState<PreviewErrors>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const steps = useMemo(() => layout.mode === 'multiStep' && layout.steps?.length ? [...layout.steps].sort((a, b) => a.order - b.order) : [], [layout]);
  const visibleFields = useMemo(() => (schema.fields ?? []).filter((field) => evaluateShowWhen(field.showWhen, values, field)), [schema.fields, values]);
  const currentStep = steps[stepIndex];
  const currentFields = currentStep ? visibleFields.filter((field) => currentStep.fieldIds.includes(field.id)) : visibleFields;
  const progress = steps.length > 0 ? Math.round(((stepIndex + 1) / steps.length) * 100) : 100;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const updateValue = (fieldId: string, value: unknown) => {
    setValues((previous) => ({ ...previous, [fieldId]: value }));
    setErrors((previous) => {
      if (!previous[fieldId]) return previous;
      const next = { ...previous };
      delete next[fieldId];
      return next;
    });
  };

  const validateFields = (fieldsToValidate: FormField[]): PreviewErrors => {
    const nextErrors: PreviewErrors = {};
    fieldsToValidate.forEach((field) => {
      const message = validateField(field, values[field.id], values);
      if (message) nextErrors[field.id] = message;
    });
    setErrors((previous) => ({ ...previous, ...nextErrors }));
    return nextErrors;
  };

  const handleNext = () => {
    const nextErrors = validateFields(currentFields);
    if (Object.keys(nextErrors).length > 0) return;
    setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  };

  const handleSubmit = () => {
    const nextErrors = validateFields(visibleFields);
    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = visibleFields.find((field) => nextErrors[field.id]);
      if (firstInvalid) document.getElementById(`preview-${firstInvalid.id}`)?.focus();
      return;
    }
    setSubmitted(true);
  };

  const resetPreview = () => {
    setValues(getInitialPreviewValues(schema));
    setErrors({});
    setStepIndex(0);
    setSubmitted(false);
  };

  const previewTheme = settings.theme || undefined;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background" data-theme={previewTheme} role="dialog" aria-modal="true" aria-label="Form preview">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-card px-4 shadow-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <ButtonLike icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />} label="Exit preview" onClick={onClose} />
          <div className="h-6 w-px bg-border/80" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><EyeIcon className="h-3.5 w-3.5" /></span>
              <span className="truncate text-sm font-bold text-foreground">{formName || 'Untitled form'}</span>
            </div>
            <p className="ml-8 text-[10px] font-bold uppercase tracking-[0.1em] text-primary">Preview only</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary sm:inline-flex"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Nothing will be saved</span>
          <ButtonLike icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />} label="Reset preview" onClick={resetPreview} compact />
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close preview"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </header>

      {!submitted && steps.length > 0 && (
        <div className="shrink-0 border-b border-border/70 bg-card px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-muted-foreground"><span>Step {stepIndex + 1} of {steps.length}</span><span>{progress}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
            <div className="hidden max-w-[240px] truncate text-right text-xs font-bold text-foreground sm:block">{currentStep?.title}</div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/35 px-3 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto w-full max-w-3xl">
          {submitted ? (
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
              <div className="border-b border-border/70 bg-background px-6 py-8 text-center sm:px-10">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-6 w-6" aria-hidden="true" /></div>
                <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">Preview completed</h1>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">The validation flow completed successfully. This was a local preview and no response, upload, payment, or draft was created.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 px-6 py-5 sm:px-10"><button type="button" onClick={resetPreview} className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground hover:bg-muted"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Try again</button><button type="button" onClick={onClose} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Exit preview</button></div>
            </div>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); if (steps.length > 0 && stepIndex < steps.length - 1) handleNext(); else handleSubmit(); }} className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
              <div className="border-b border-border/70 bg-background px-6 py-6 sm:px-9 sm:py-8">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><Smartphone className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Respondent view</div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">{formName || 'Untitled form'}</h1>
                {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Info className="h-3.5 w-3.5" aria-hidden="true" /> Preview mode · values stay in this browser tab</div>
              </div>
              <div className="grid grid-cols-12 gap-x-4 gap-y-5 px-6 py-6 sm:px-9 sm:py-8">
                {currentFields.length === 0 ? (
                  <div className="col-span-12 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No visible fields in this preview state.</div>
                ) : currentFields.map((field) => (
                  <div key={field.id} className={`col-span-12 ${field.width === 'half' ? 'md:col-span-6' : field.width === 'third' ? 'md:col-span-4' : ''}`}>
                    <PreviewField field={field} value={values[field.id]} error={errors[field.id]} onChange={(value) => updateValue(field.id, value)} />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-6 py-4 sm:px-9">
                <span className="text-xs text-muted-foreground"><span className="font-bold text-destructive">*</span> Required field</span>
                <div className="ml-auto flex items-center gap-2">
                  {steps.length > 0 && stepIndex > 0 && layout.allowBackNavigation !== false && <button type="button" onClick={() => setStepIndex((index) => Math.max(0, index - 1))} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-semibold hover:bg-muted"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Back</button>}
                  <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">{steps.length > 0 && stepIndex < steps.length - 1 ? <>Continue <ChevronRight className="h-4 w-4" aria-hidden="true" /></> : <>Test validation <Send className="h-3.5 w-3.5" aria-hidden="true" /></>}</button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ButtonLike({ icon, label, onClick, compact = false }: { icon: ReactNode; label: string; onClick: () => void; compact?: boolean }) {
  return <button type="button" onClick={onClick} title={label} aria-label={label} className={`inline-flex h-8 items-center gap-1.5 rounded-md text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${compact ? 'px-2' : 'px-2.5'}`}>{icon}<span className={compact ? 'hidden sm:inline' : 'hidden sm:inline'}>{label}</span></button>;
}

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}
