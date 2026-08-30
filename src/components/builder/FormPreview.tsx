import { useEffect, useMemo, useState } from 'react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Star, FileText, ExternalLink, ChevronLeft, ChevronRight, ShieldCheck, Loader2 } from 'lucide-react';
import { MultiSelectField } from './MultiSelectField';
import { DisplayField } from './DisplayField';
import TableField from '../ui/TableField';
import FileUpload from '../ui/FileUpload';
import DmsFileUpload from '../ui/DmsFileUpload';
import SignaturePad from '../ui/SignaturePad';
import FormStepper from './FormStepper';
import { Button } from '../ui/button';
import { evaluateShowWhen, evaluateLinkingConditions } from '../../lib/ruleEngine';
import { CalculationEngine } from '../../lib/calculationEngine';
import { getPublicDownloadUrl } from '../../lib/dms';
import type { FormField, FormSchema, FormSettings, FormBrandingSection, FormLayout } from '../../types';
import { cn } from '../../lib/utils';

interface FormPreviewProps {
  schema: FormSchema;
  settings: FormSettings;
  formId?: string;
  name?: string;
  description?: string;
  orientation?: 'vertical' | 'horizontal';
  layout?: FormLayout;
}

const JUSTIFY: Record<string, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

/** Header/footer branding — mirrors the public page's header bar + footer text. */
function PreviewBranding({ section, variant, formId }: {
  section?: FormBrandingSection;
  variant: 'header' | 'footer';
  formId?: string;
}) {
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!section || section.enabled === false) { setLogoUrl(undefined); return; }
    if (section.logoDocumentId && formId) {
      getPublicDownloadUrl(section.logoDocumentId, formId)
        .then((url) => setLogoUrl(url))
        .catch(() => setLogoUrl(section.logoUrl));
    } else {
      setLogoUrl(section.logoUrl);
    }
  }, [section, formId]);

  if (!section || section.enabled === false) return null;

  if (variant === 'footer') {
    if (!section.text) return null;
    return (
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground whitespace-pre-line">{section.text}</p>
      </div>
    );
  }

  const hasLogo = !!logoUrl;
  const hasText = !!section.text;
  if (!hasLogo && !hasText) return null;

  const logoPos = section.logoPosition || 'center';
  const textPos = section.textPosition || 'center';

  const logoEl = hasLogo ? (
    <img src={logoUrl} alt="Form header logo" className="max-h-12 object-contain" />
  ) : null;
  const textEl = hasText ? (
    <p className="text-lg font-semibold text-foreground whitespace-pre-line">{section.text}</p>
  ) : null;

  const row = (!hasLogo || !hasText || logoPos === textPos) ? (
    <div className={`flex items-center gap-3 ${JUSTIFY[hasLogo ? logoPos : textPos]}`}>
      {logoEl}
      {textEl}
    </div>
  ) : (
    <div className="grid grid-cols-3 items-center gap-2">
      {(['left', 'center', 'right'] as const).map((pos) => (
        <div key={pos} className={`flex items-center gap-2 ${JUSTIFY[pos]}`}>
          {logoPos === pos && logoEl}
          {textPos === pos && textEl}
        </div>
      ))}
    </div>
  );

  return (
    <div className="sticky top-0 z-40 w-full bg-card border-b border-border shadow-sm px-4 sm:px-6 lg:px-8 py-3">
      {row}
    </div>
  );
}

function validateField(field: FormField, value: unknown): string | null {
  const isEmpty =
    value === undefined || value === null || value === '' ||
    (Array.isArray(value) && value.length === 0);

  if (field.required && isEmpty) return 'This field is required';
  if (isEmpty) return null;

  const str = Array.isArray(value) ? value.join(', ') : String(value);

  if (field.validation?.minLength && str.length < field.validation.minLength) {
    return `Minimum ${field.validation.minLength} characters`;
  }
  if (field.validation?.maxLength && str.length > field.validation.maxLength) {
    return `Maximum ${field.validation.maxLength} characters`;
  }

  if (field.type === 'number' || field.validation?.min !== undefined || field.validation?.max !== undefined) {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      if (field.validation?.min !== undefined && num < field.validation.min) {
        return `Minimum value is ${field.validation.min}`;
      }
      if (field.validation?.max !== undefined && num > field.validation.max) {
        return `Maximum value is ${field.validation.max}`;
      }
    }
  }

  if (field.type === 'email' && str && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return 'Please enter a valid email address';
  }

  if (field.validation?.pattern) {
    try {
      if (!new RegExp(field.validation.pattern).test(str)) {
        return field.validation.message || 'Invalid format';
      }
    } catch { /* ignore malformed patterns */ }
  }

  return null;
}

/** Effective options for select/radio/checkbox/multiselect, incl. Smart Connection dynamic options. */
function resolveOptions(field: FormField, values: Record<string, unknown>): { label: string; value: string }[] {
  const linking = field.fieldLinking;
  if (!linking?.enabled) return field.options ?? [];
  if (!['select', 'multiselect', 'radio', 'checkbox'].includes(field.type)) return field.options ?? [];

  const mode = linking.mode || 'basic';
  const sourceValue = linking.sourceFieldId ? values[linking.sourceFieldId] : undefined;

  // Advanced/restriction rules with dynamicOptions
  if ((mode === 'advanced' || mode === 'restriction') && linking.rules) {
    const matched = linking.rules.find((r) => {
      if (r.conditions && r.conditions.length > 0) {
        return evaluateLinkingConditions(r.conditions, r.logic || 'and', values);
      }
      return false;
    });
    if (matched?.dynamicOptions && matched.dynamicOptions.length > 0) return matched.dynamicOptions;
  }

  // Basic cascading options
  if (linking.dynamicConfig?.options && sourceValue !== undefined && sourceValue !== null) {
    const map = linking.dynamicConfig.options as Record<string, { label: string; value: string }[]>;
    const keys = Array.isArray(sourceValue) ? sourceValue.map(String) : [String(sourceValue)];
    const merged: { label: string; value: string }[] = [];
    const seen = new Set<string>();
    keys.forEach((k) => {
      (map[k] || []).forEach((opt) => {
        if (!seen.has(opt.value)) { merged.push(opt); seen.add(opt.value); }
      });
    });
    if (merged.length > 0) return merged;
  }

  return field.options ?? [];
}

/** Auto-fill from Smart Connections (copy-from / static target values). */
function resolveLinkingValue(field: FormField, values: Record<string, unknown>): unknown {
  const linking = field.fieldLinking;
  if (!linking?.enabled || !linking.rules) return undefined;

  const mode = linking.mode || 'basic';
  const sourceValue = linking.sourceFieldId ? values[linking.sourceFieldId] : undefined;

  const matchingRule = linking.rules.find((r) => {
    if (r.conditions && r.conditions.length > 0) {
      return evaluateLinkingConditions(r.conditions, r.logic || 'and', values);
    }
    if (mode === 'basic' && linking.sourceFieldId) {
      if (sourceValue === undefined || sourceValue === null) return false;
      const cv = String(sourceValue);
      const tv = String(r.sourceValue);
      switch (r.operator) {
        case 'equals': return cv === tv;
        case 'notEquals': return cv !== tv;
        case 'greaterThan': return Number(cv) > Number(tv);
        case 'lessThan': return Number(cv) < Number(tv);
        case 'contains': return cv.includes(tv);
        case 'notContains': return !cv.includes(tv);
        default: return false;
      }
    }
    return false;
  });

  if (!matchingRule) return undefined;
  if (matchingRule.copyFromFieldId) return values[matchingRule.copyFromFieldId];
  if (matchingRule.targetValue !== undefined && matchingRule.targetValue !== '') return matchingRule.targetValue;
  return undefined;
}

function FieldControl({
  field,
  value,
  onChange,
  onBlur,
  values,
  formId,
  dmsEnabled,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  onBlur: () => void;
  values: Record<string, unknown>;
  formId?: string;
  dmsEnabled: boolean;
}) {
  const options = resolveOptions(field, values);
  const disabled = !!field.disabled;

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
      return (
        <Input
          type={field.type === 'phone' ? 'tel' : field.type}
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      );
    case 'number':
      return (
        <Input
          type="number"
          placeholder={field.placeholder}
          value={(value as number | '') ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      );
    case 'date':
      return (
        <Input type="date" value={(value as string) ?? ''} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      );
    case 'time':
      return (
        <Input type="time" value={(value as string) ?? ''} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      );
    case 'textarea':
      return (
        <Textarea
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      );
    case 'select':
      return (
        <select
          value={(value as string) ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <option value="">Select an option</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'radio':
      return (
        <div className="grid gap-2">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2">
              <input
                type="radio"
                name={field.id}
                value={o.value}
                checked={value === o.value}
                disabled={disabled}
                onChange={() => onChange(o.value)}
                onBlur={onBlur}
                className="h-4 w-4 border-border text-primary focus:ring-primary"
              />
              <span className="text-[13px]">{o.label}</span>
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div className="space-y-2">
          {options.map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            return (
              <label key={o.value} className="flex items-center gap-2">
                <Checkbox
                  checked={arr.includes(o.value)}
                  onCheckedChange={(checked) => {
                    onChange(checked ? [...arr, o.value] : arr.filter((v) => v !== o.value));
                  }}
                  disabled={disabled}
                />
                <span className="text-[13px]">{o.label}</span>
              </label>
            );
          })}
        </div>
      );
    case 'multiselect':
      return (
        <MultiSelectField
          field={field}
          options={options}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(v) => onChange(v)}
          disabled={disabled}
          hideLabel
        />
      );
    case 'file':
      if (dmsEnabled && formId) {
        return (
          <DmsFileUpload
            field={field}
            value={(value as any) ?? null}
            onChange={(v) => onChange(v)}
            formId={formId}
            disabled={disabled}
            hideLabel
            deferUpload
            publicDownload
          />
        );
      }
      return (
        <FileUpload
          field={field}
          value={(value as any) ?? null}
          onChange={(v) => onChange(v)}
          disabled={disabled}
          hideLabel
        />
      );
    case 'rating':
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" disabled={disabled} onClick={() => onChange(star)} className="p-1">
              <Star className={`h-6 w-6 ${star <= Number(value ?? 0) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
            </button>
          ))}
        </div>
      );
    case 'signature':
      return (
        <SignaturePad
          field={field}
          value={(value as any) ?? null}
          onChange={(v) => onChange(v)}
          formId={formId}
          dmsEnabled={dmsEnabled}
          disabled={disabled}
          hideLabel
        />
      );
    case 'table':
      return (
        <TableField
          field={field}
          value={(value as any) ?? { rows: [] }}
          onChange={(v) => onChange(v)}
          disabled={disabled}
          formValues={values}
        />
      );
    case 'display':
      return null;
    default:
      return (
        <Input
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      );
  }
}

function renderSupportDocuments(field: FormField) {
  const docs = Array.isArray(field.supportDocuments)
    ? field.supportDocuments.filter((d) => d && d.label && (d.url || d.fileData || d.documentId))
    : [];
  if (docs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {docs.map((doc) => {
        const inner = (
          <>
            <FileText className="h-3 w-3" />
            {doc.label}
          </>
        );
        if (doc.url) {
          return (
            <a key={doc.id || doc.label} href={doc.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded border border-plum-100 bg-plum-50 px-2 py-1 text-xs text-plum-600 hover:text-plum-800">
              {inner}
              <ExternalLink className="h-2.5 w-2.5 opacity-70" />
            </a>
          );
        }
        return (
          <span key={doc.id || doc.label}
            className="inline-flex items-center gap-1.5 rounded border border-plum-100 bg-plum-50 px-2 py-1 text-xs text-plum-600">
            {inner}
          </span>
        );
      })}
    </div>
  );
}

export default function FormPreview({
  schema,
  settings,
  formId,
  name,
  description,
  orientation = 'vertical',
  layout,
}: FormPreviewProps) {
  const fields = schema.fields ?? [];
  const variables = schema.variables ?? [];
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [extValidation, setExtValidation] = useState<Record<string, { loading: boolean; ok?: boolean; message?: string }>>({});

  const steps = useMemo(
    () => [...(layout?.steps || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [layout?.steps]
  );
  const isMultiStep = layout?.mode === 'multiStep' && steps.length > 0;
  const stepperStyle = layout?.stepperStyle || 'progress';
  const allowBack = layout?.allowBackNavigation !== false;

  // Clamp the step index whenever the step list shrinks.
  useEffect(() => {
    setCurrentStepIndex((i) => (steps.length ? Math.min(i, steps.length - 1) : 0));
  }, [steps.length]);

  // Initialize defaults once
  useEffect(() => {
    const defaults: Record<string, unknown> = {};
    fields.forEach((f) => {
      if (f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== '') {
        defaults[f.id] = f.defaultValue;
      }
    });
    setValues((prev) => ({ ...defaults, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleFields = useMemo(
    () => fields.filter((f) => evaluateShowWhen(f.showWhen, values as Record<string, unknown>, f)),
    [fields, values]
  );

  const currentStep = isMultiStep ? steps[currentStepIndex] ?? steps[0] : undefined;

  const stepFields = useMemo(() => {
    if (!isMultiStep || !currentStep) return visibleFields;
    const ids = new Set(currentStep.fieldIds);
    return visibleFields.filter((f) => ids.has(f.id));
  }, [isMultiStep, currentStep, visibleFields]);

  const calculated = useMemo(() => {
    if (variables.length === 0) return {};
    try {
      return new CalculationEngine(variables, values as Record<string, any>).calculateAllVariables();
    } catch {
      return {};
    }
  }, [variables, values]);

  // Smart-connection auto-fill
  useEffect(() => {
    const patches: Record<string, unknown> = {};
    fields.forEach((f) => {
      if (!f.fieldLinking?.enabled) return;
      const linked = resolveLinkingValue(f, values as Record<string, unknown>);
      if (linked !== undefined && String(values[f.id] ?? '') !== String(linked)) {
        patches[f.id] = linked;
      }
    });
    if (Object.keys(patches).length > 0) {
      setValues((prev) => ({ ...prev, ...patches }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const setValue = (id: string, v: unknown) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    // Clear any previous external-validation result when the value changes.
    setExtValidation((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  const setTouchedField = (id: string) => setTouched((prev) => ({ ...prev, [id]: true }));

  // Preview simulation of the external check (the published page calls the
  // backend; here we just replay the UI states for parity).
  const runExternalCheck = (field: FormField) => {
    const err = validateField(field, values[field.id]);
    if (err) return;
    setExtValidation((prev) => ({ ...prev, [field.id]: { loading: true } }));
    window.setTimeout(() => {
      setExtValidation((prev) => ({
        ...prev,
        [field.id]: {
          loading: false,
          ok: true,
          message: field.externalValidation?.successMsg || 'Verified',
        },
      }));
    }, 600);
  };

  const isHorizontal = orientation === 'horizontal';

  const spanClass = (f: FormField) =>
    f.width === 'half'
      ? 'col-span-1 sm:col-span-3'
      : f.width === 'third'
        ? 'col-span-1 sm:col-span-2'
        : 'col-span-1 sm:col-span-6';

  const renderFieldBlock = (field: FormField) => {
    if (field.type === 'display') {
      return (
        <div key={field.id} className={cn('space-y-2', isHorizontal && spanClass(field))}>
          <DisplayField field={field} variables={variables} />
        </div>
      );
    }
    const error = touched[field.id] ? validateField(field, values[field.id]) : null;
    return (
      <div key={field.id} className={cn('space-y-2', isHorizontal && spanClass(field))}>
        <Label>
          {field.label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        <FieldControl
          field={field}
          value={values[field.id]}
          values={values as Record<string, unknown>}
          onChange={(v) => setValue(field.id, v)}
          onBlur={() => {
            setTouchedField(field.id);
            if (field.externalValidation?.enabled && (field.externalValidation.trigger ?? 'auto') === 'auto') {
              runExternalCheck(field);
            }
          }}
          formId={formId}
          dmsEnabled={settings.dms?.enabled === true}
        />
        {field.helpText && <p className="text-[13px] text-muted-foreground">{field.helpText}</p>}
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        {field.externalValidation?.enabled && field.externalValidation.trigger === 'manual' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!!error || !!extValidation[field.id]?.loading}
            onClick={() => runExternalCheck(field)}
            className="h-8 gap-1.5"
          >
            {extValidation[field.id]?.loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {field.externalValidation.buttonLabel || 'Verify'}
          </Button>
        )}
        {extValidation[field.id]?.loading && (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Validating…
          </p>
        )}
        {extValidation[field.id] && !extValidation[field.id].loading && extValidation[field.id].ok && (
          <p className="text-[13px] font-medium text-green-600">✓ {extValidation[field.id].message}</p>
        )}
        {renderSupportDocuments(field)}
      </div>
    );
  };

  const renderFieldList = (list: FormField[]) => {
    if (isHorizontal) {
      return <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">{list.map(renderFieldBlock)}</div>;
    }
    // Group consecutive same-width fields so they sit side by side.
    const groups: { width: 'full' | 'half' | 'third'; items: FormField[] }[] = [];
    let current: typeof groups[0] | null = null;
    list.forEach((f) => {
      const width = (f.width || 'full') as 'full' | 'half' | 'third';
      if (!current || current.width !== width) {
        current = { width, items: [] };
        groups.push(current);
      }
      current.items.push(f);
    });
    return groups.map((group, gi) => {
      const gridClass =
        group.width === 'half'
          ? 'grid grid-cols-2 gap-4'
          : group.width === 'third'
            ? 'grid grid-cols-3 gap-4'
            : 'space-y-6';
      return (
        <div key={gi} className={gridClass}>
          {group.items.map(renderFieldBlock)}
        </div>
      );
    });
  };

  const handleNext = () => {
    if (!isMultiStep) return;
    // Validate the current step before advancing.
    let hasError = false;
    const nextTouched = { ...touched };
    stepFields.forEach((f) => {
      if (f.type === 'display' || f.type === 'html') return;
      nextTouched[f.id] = true;
      if (validateField(f, values[f.id])) hasError = true;
    });
    setTouched(nextTouched);
    if (hasError) return;
    setCurrentStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };

  const isLastStep = !isMultiStep || currentStepIndex >= steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  return (
    <div className="min-h-full bg-muted/30" data-theme={settings.theme || 'default'}>
      <PreviewBranding section={settings.header} variant="header" formId={formId} />
      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <div className={isHorizontal ? 'mx-auto w-full max-w-[1400px]' : 'mx-auto max-w-2xl'}>
          <div className="form-card rounded-lg border border-border bg-card p-6 shadow-xl sm:p-8">
            <div className="mb-6">
              <h2 className="min-w-0 break-words text-2xl font-semibold text-foreground">{name || 'Untitled form'}</h2>
              {description && <p className="mt-1 break-words text-sm text-muted-foreground">{description}</p>}
            </div>

            {isMultiStep && (
              <>
                <FormStepper
                  steps={steps.map((s) => ({ id: s.id, title: s.title }))}
                  currentIndex={currentStepIndex}
                  style={stepperStyle}
                  onStepClick={allowBack ? (i) => setCurrentStepIndex(i) : undefined}
                />
                {currentStep?.title && (
                  <h3 className="mb-1 text-lg font-semibold text-foreground">{currentStep.title}</h3>
                )}
                {currentStep?.description && (
                  <p className="mb-5 text-sm text-muted-foreground">{currentStep.description}</p>
                )}
              </>
            )}

            {stepFields.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-muted-foreground">
                {isMultiStep ? 'No fields in this step yet.' : 'Nothing to preview yet — add fields to your form.'}
              </p>
            ) : (
              renderFieldList(stepFields)
            )}

            {variables.length > 0 && isLastStep && (
              <div className="mt-6 border-t border-border/70 pt-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Calculated Values</p>
                <div className="mt-2 space-y-1.5">
                  {variables.map((v) => (
                    <div key={v.id} className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">{v.name}</span>
                      <span className="font-medium">{String(calculated[v.id] ?? '—')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isMultiStep && (
              <div className="mt-6 flex gap-2 border-t border-border/70 pt-4">
                {!isFirstStep && allowBack && (
                  <Button type="button" variant="outline" onClick={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                )}
                {!isLastStep && (
                  <Button type="button" className="ml-auto" onClick={handleNext}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <PreviewBranding section={settings.footer} variant="footer" formId={formId} />
        </div>
      </div>
    </div>
  );
}
