import { useEffect, useState } from 'react';
import {
  Copy, Trash2, X, ChevronDown, ChevronRight, Plus, Check, Hash, Eye, Globe,
  Link, Calculator, AlertCircle, FileText, FileSpreadsheet, ClipboardCheck,
  BarChart2, Info, Search,
} from 'lucide-react';
import type { FieldRule, FormField, FormVariable } from '../../types';
import { COUNTRIES, countryByIso, flagForIso } from '../../lib/countries';
import CountrySelect from '../ui/CountrySelect';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Checkbox as UICheckbox } from '../ui/checkbox';
import { cn } from '../../lib/utils';
import LiveControl from './LiveControl';
import type { FieldModalKind } from './QuestionCard';
import {
  FIELD_DESCRIPTIONS, FIELD_EDITOR_TAB_LABELS, FILE_ACCEPT_TYPES,
  HAS_OPTIONS, POLLABLE, NO_VALUE_RULE_TYPES, SURVEY_TYPES, TYPE_FRIENDLY,
  TYPE_GROUPS, TYPE_ICONS, TYPE_LABEL, TYPE_SURVEY_GROUP, countShowWhenLeaves,
  defaultOptions, fieldEditorTabs, isInvalidRegex, ruleDefaultMessage,
  ruleOptionsFor, ruleSentence, ruleValuePlaceholder, slugifyOptionValue,
  validationTabMode, type FieldEditorTab,
} from './formSetup';

/* ---------------------------------------------------------------------------
 * Shared bits
 * ------------------------------------------------------------------------- */

interface FieldEditorProps {
  field: FormField;
  allFields: FormField[];
  variables: FormVariable[];
  formType?: string;
  onOpenModal: (kind: FieldModalKind) => void;
  /** Update any field by id (this one, or others — e.g. clearing poll marks). */
  onUpdateField: (id: string, updates: Partial<FormField>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  /** Tab to land on when the editor opens (e.g. from a rule chip). */
  initialTab?: FieldEditorTab;
}

const PLACEHOLDER_HINTS: Record<string, string> = {
  text: 'e.g. John Doe',
  email: 'e.g. name@example.com',
  phone: 'e.g. +91 98765 43210',
  number: 'e.g. 0',
  textarea: 'Type here…',
  select: 'Choose…',
  multiselect: 'Choose…',
};

const PLACEHOLDER_TYPES = ['text', 'email', 'phone', 'number', 'textarea', 'select', 'multiselect'];
const DEFAULT_VALUE_TYPES = ['text', 'email', 'phone', 'number', 'date', 'time', 'textarea'];

/** Survey defaults applied when a question becomes a survey type. */
function surveyDefaults(type: FormField['type'], field: FormField): Partial<FormField> {
  switch (type) {
    case 'nps': return { surveyConfig: { kind: 'nps', scale: { min: 0, max: 10, minLabel: 'Not at all likely', maxLabel: 'Extremely likely' } } };
    case 'csat': return { surveyConfig: { kind: 'csat', scale: { min: 1, max: 5, minLabel: 'Very dissatisfied', maxLabel: 'Very satisfied' } } };
    case 'ces': return { surveyConfig: { kind: 'ces', scale: { min: 1, max: 7, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' } } };
    case 'likert': return {
      surveyConfig: {
        kind: 'likert', scale: { min: 1, max: 5, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' },
        rows: field.surveyConfig?.rows?.length ? field.surveyConfig.rows
          : [{ id: `row_${Date.now()}_1`, label: 'Statement 1' }, { id: `row_${Date.now()}_2`, label: 'Statement 2' }],
      },
    };
    case 'ranking': return { surveyConfig: { kind: 'ranking', ranking: { requireAll: true } } };
    default: return {};
  }
}

/** Guess-from-the-label, offered never applied (v2 §3.2). */
function guessFor(field: FormField): { to: FormField['type']; message: string } | null {
  if (field.type !== 'text' || !field.label) return null;
  const l = field.label.toLowerCase();
  if (/e-?mail/.test(l)) return { to: 'email', message: 'This looks like an email question. Check the address is valid?' };
  if (/(phone|mobile|contact number)/.test(l)) return { to: 'phone', message: 'This looks like a phone question. Use a phone field?' };
  if (/(how many|how much|number of|count)/.test(l)) return { to: 'number', message: 'This looks like it wants a number. Use a number field?' };
  if (/(when|date|day of)/.test(l)) return { to: 'date', message: 'This looks like it wants a date. Use a date field?' };
  return null;
}

/** Ids for new rules — kept at module scope so components stay pure. */
let ruleIdSeq = 0;
function nextRuleId(): string {
  return `rule_${Date.now()}_${ruleIdSeq++}`;
}

/** A labelled setting row. */
function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[10.5px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Content tab
 * ------------------------------------------------------------------------- */

function OptionsEditor({ field, onUpdate, onBulkImport }: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onBulkImport: () => void;
}) {
  const options = field.options ?? [];

  const setOptionLabel = (i: number, label: string) => {
    const opt = options[i];
    // Keep hand-written values; regenerate only values that were auto-derived.
    const wasDerived = !opt.value || slugifyOptionValue(opt.label, '') === opt.value;
    const optionsNext = options.map((o, idx) =>
      idx === i ? { ...o, label, value: wasDerived ? slugifyOptionValue(label, `option_${i + 1}`) : o.value } : o
    );
    onUpdate({ options: optionsNext });
  };
  const removeOption = (i: number) => {
    onUpdate({ options: options.filter((_, idx) => idx !== i) });
  };
  const addOption = () => {
    onUpdate({ options: [...options, { label: '', value: slugifyOptionValue('', `option_${options.length + 1}`) }] });
  };

  const single = field.type === 'radio' || field.type === 'select';
  const shape = single ? 'rounded-full' : 'rounded';
  const isRanking = field.type === 'ranking';

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {options.map((option, i) => (
          <div
            key={i}
            className={cn(
              'group/opt flex items-center gap-2.5 border-b border-border/60 px-3 py-2 last:border-b-0 hover:bg-muted/40',
              i % 2 === 1 && 'bg-ink-50/40'
            )}
          >
            {isRanking
              ? <span className="w-4 flex-none text-center text-[11px] font-semibold text-ink-400">{i + 1}</span>
              : <span className={cn('h-4 w-4 flex-none border-[1.5px] border-ink-300', shape)} />}
            <input
              value={option.label}
              onChange={(e) => setOptionLabel(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1}`}
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeOption(i)}
              className="grid h-6 w-6 flex-none place-items-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/opt:opacity-100"
              aria-label={`Remove option ${i + 1}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {options.length === 0 && (
          <p className="px-3 py-3.5 text-[12.5px] italic text-muted-foreground">No options yet — add the first one below.</p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addOption}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-input px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Add option
        </button>
        <button
          type="button"
          onClick={onBulkImport}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-[12px] font-medium text-foreground hover:bg-muted"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Bulk import (CSV)
        </button>
      </div>
    </div>
  );
}

function ContentTab({ field, onUpdate, onTypeChange, onOpenModal, focusLabel, onLabelFocus }: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onTypeChange: (type: FormField['type']) => void;
  onOpenModal: (kind: FieldModalKind) => void;
  focusLabel: boolean;
  onLabelFocus: () => void;
}) {
  const [descOpen, setDescOpen] = useState(false);
  const [guessDismissed, setGuessDismissed] = useState(false);
  const guess = !guessDismissed ? guessFor(field) : null;

  const note = (() => {
    // v2 §3.2 — radio vs dropdown follows from the option count. The editor
    // suggests the switch; it never applies it silently.
    if (field.type === 'radio' && (field.options ?? []).length > 6) {
      return {
        text: <>A list of {(field.options ?? []).length} options is easier to answer as a dropdown.</>,
        action: { label: 'Show as a dropdown', to: 'select' as const },
      };
    }
    const maxLength = field.validation?.maxLength
      ?? (field.rules ?? []).find((r) => r.type === 'maxLength' && r.enabled !== false)?.value;
    if (field.type === 'textarea' && maxLength && Number(maxLength) > 0 && Number(maxLength) <= 80) {
      return {
        text: <>A {maxLength}-character limit is short for a long answer.</>,
        action: { label: 'Make it a short answer', to: 'text' as const },
      };
    }
    return null;
  })();

  const inputCls = 'h-10 text-[13.5px]';

  return (
    <div className="space-y-5">
      {guess && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-accent px-3 py-2 text-[11.5px]">
          <Info className="h-3.5 w-3.5 flex-none text-primary" />
          <span className="flex-1 font-medium text-accent-foreground">{guess.message}</span>
          <button
            type="button"
            onClick={() => onTypeChange(guess.to)}
            className="h-6 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setGuessDismissed(true)}
            className="h-6 rounded-md px-2 text-[11px] font-medium text-muted-foreground hover:bg-muted"
          >
            No
          </button>
        </div>
      )}

      <FieldRow label="Field label">
        <Input
          autoFocus={focusLabel}
          onFocus={onLabelFocus}
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Type your question"
          className={inputCls}
        />
      </FieldRow>

      {field.helpText || descOpen ? (
        <FieldRow label="Description" hint="Shown under the label, above the field.">
          <Input
            value={field.helpText ?? ''}
            onChange={(e) => onUpdate({ helpText: e.target.value || undefined })}
            placeholder="Additional instructions (optional)"
            className={inputCls}
          />
        </FieldRow>
      ) : (
        <button
          type="button"
          onClick={() => setDescOpen(true)}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:underline"
        >
          <Plus className="h-3 w-3" />
          Add a description
        </button>
      )}

      {PLACEHOLDER_TYPES.includes(field.type) && (
        <FieldRow label="Placeholder" hint="The hint text inside the field before people type.">
          <Input
            value={field.placeholder ?? ''}
            onChange={(e) => onUpdate({ placeholder: e.target.value || undefined })}
            placeholder={PLACEHOLDER_HINTS[field.type] || 'Text shown inside the field'}
            className={inputCls}
          />
        </FieldRow>
      )}

      {DEFAULT_VALUE_TYPES.includes(field.type) && (
        <FieldRow label="Default value" hint="Pre-filled when the form loads. Smart Connection overrides it when enabled.">
          <Input
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
            value={field.defaultValue ?? ''}
            onChange={(e) => onUpdate({ defaultValue: e.target.value || undefined })}
            placeholder={field.type === 'number' ? 'e.g. 0' : 'Optional'}
            className={inputCls}
          />
        </FieldRow>
      )}

      {field.type === 'phone' && (
        <>
          <FieldRow label="Default country" hint="Preselected in the country picker people fill the form with.">
            <CountrySelect
              value={field.phoneConfig?.defaultCountry}
              onChange={(iso2) => onUpdate({
                phoneConfig: { ...field.phoneConfig, defaultCountry: iso2 },
              })}
            />
          </FieldRow>
          <FieldRow label="Allowed countries" hint="Leave empty to offer every country. The default is always offered.">
            <div className="flex flex-wrap gap-1.5">
              {(field.phoneConfig?.allowedCountries ?? []).map((iso) => {
                const c = countryByIso(iso);
                if (!c) return null;
                return (
                  <span
                    key={iso}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card pl-2.5 pr-1 text-[11.5px] font-medium text-foreground"
                  >
                    <span className="text-sm leading-none">{flagForIso(iso)}</span>
                    +{c.dial}
                    <button
                      type="button"
                      onClick={() => onUpdate({
                        phoneConfig: {
                          ...field.phoneConfig,
                          allowedCountries: (field.phoneConfig?.allowedCountries ?? []).filter((x) => x !== iso),
                        },
                      })}
                      className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${c.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              <div className="flex items-center">
                <CountrySelect
                  variant="inline"
                  countries={COUNTRIES.filter(
                    (c) => !(field.phoneConfig?.allowedCountries ?? []).includes(c.iso2)
                  )}
                  value={undefined}
                  onChange={(iso2) => {
                    if (!iso2) return;
                    onUpdate({
                      phoneConfig: {
                        ...field.phoneConfig,
                        allowedCountries: [...(field.phoneConfig?.allowedCountries ?? []), iso2],
                      },
                    });
                  }}
                />
              </div>
            </div>
          </FieldRow>
        </>
      )}

      {HAS_OPTIONS(field.type) && (
        <FieldRow
          label={field.type === 'ranking' ? 'Items to rank' : 'Options'}
          hint={field.type === 'ranking' ? 'People put these in order of preference.' : undefined}
        >
          <OptionsEditor
            field={field}
            onUpdate={onUpdate}
            onBulkImport={() => onOpenModal('csv')}
          />
          {note && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-border bg-ink-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-px h-3.5 w-3.5 flex-none" />
              <span>
                {note.text}{' '}
                <button
                  type="button"
                  onClick={() => onTypeChange(note.action.to)}
                  className="whitespace-nowrap font-semibold text-primary hover:underline"
                >
                  {note.action.label}
                </button>
              </span>
            </div>
          )}
        </FieldRow>
      )}

      {field.type === 'likert' && (
        <FieldRow label="Statements" hint="One row per statement in the matrix.">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {(field.surveyConfig?.rows ?? []).map((row, i, rows) => (
              <div key={row.id} className="group/row flex items-center gap-2.5 border-b border-border/60 px-3 py-2 last:border-b-0 hover:bg-muted/40">
                <span className="w-4 flex-none text-center text-[11px] font-semibold text-ink-400">{i + 1}</span>
                <input
                  value={row.label}
                  onChange={(e) => onUpdate({
                    surveyConfig: {
                      ...field.surveyConfig!,
                      rows: rows.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r)),
                    },
                  })}
                  placeholder={`Statement ${i + 1}`}
                  aria-label={`Statement ${i + 1}`}
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => onUpdate({
                    surveyConfig: { ...field.surveyConfig!, rows: rows.filter((r) => r.id !== row.id) },
                  })}
                  className="grid h-6 w-6 flex-none place-items-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/row:opacity-100"
                  aria-label={`Remove statement ${i + 1}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onUpdate({
                surveyConfig: {
                  ...field.surveyConfig!,
                  rows: [...(field.surveyConfig?.rows ?? []), { id: `row_${Date.now()}`, label: '' }],
                },
              })}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:bg-muted/40 hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Add statement
            </button>
          </div>
        </FieldRow>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Validation tab — "Limit the answer" (v2 §3.3), shaped by the field type:
 * file uploads get their upload policy, rule-based types get only the rules
 * that make sense for them, and a few types have nothing to limit at all.
 * ------------------------------------------------------------------------- */

function FilePolicyGroup({ field, onUpdate }: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const accept = field.fileConfig?.accept ?? [];
  return (
    <div className="space-y-5">
      <FieldRow label="Accepted file types" hint="Leave all unchecked to accept every type the form allows.">
        <div className="flex flex-wrap gap-1.5">
          {FILE_ACCEPT_TYPES.map((type) => {
            const on = accept.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => onUpdate({
                  fileConfig: {
                    ...field.fileConfig,
                    accept: on ? accept.filter((t) => t !== type) : [...accept, type],
                  },
                })}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors',
                  on ? 'border-primary bg-primary/[0.08] text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {on && <Check className="h-3 w-3" />}
                {type}
              </button>
            );
          })}
        </div>
      </FieldRow>
      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Minimum size (MB)">
          <Input
            type="number"
            min={0}
            value={Math.round((field.fileConfig?.minSize ?? 0) / 1048576)}
            onChange={(e) => onUpdate({
              fileConfig: { ...field.fileConfig, minSize: Math.max(0, Number(e.target.value) || 0) * 1024 * 1024 },
            })}
            className="h-10 text-[13.5px]"
          />
        </FieldRow>
        <FieldRow label="Maximum size (MB)">
          <Input
            type="number"
            min={1}
            value={Math.round((field.fileConfig?.maxSize ?? 5242880) / 1048576)}
            onChange={(e) => onUpdate({
              fileConfig: { ...field.fileConfig, maxSize: Math.max(1, Number(e.target.value) || 5) * 1024 * 1024 },
            })}
            className="h-10 text-[13.5px]"
          />
        </FieldRow>
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
        <UICheckbox
          checked={!!field.fileConfig?.multiple}
          onCheckedChange={(checked: boolean) => onUpdate({ fileConfig: { ...field.fileConfig, multiple: !!checked } })}
          className="mt-0.5"
        />
        <span className="text-[13.5px]">
          <span className="font-medium text-foreground">Allow multiple files</span>
          <span className="mt-0.5 block text-[11.5px] leading-4 text-muted-foreground">People can attach more than one file to this question.</span>
        </span>
      </label>
      <div className="rounded-lg border border-plum-200 bg-plum-50 p-3 text-[11px] leading-relaxed text-plum-800">
        The form-level policy in <b>Access &amp; Security</b> is the ceiling; this can only narrow it.
      </div>
    </div>
  );
}

function ValidationTab({ field, otherFields, onUpdate }: {
  field: FormField;
  otherFields: FormField[];
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const rules = field.rules ?? [];
  const mode = validationTabMode(field.type);

  const addRuleOfType = (type: string) => {
    onUpdate({ rules: [...rules, { id: nextRuleId(), type: type as FieldRule['type'], enabled: true, message: '' }] });
  };
  const removeRule = (ruleId: string) => {
    onUpdate({ rules: rules.filter((r) => r.id !== ruleId) });
  };
  const updateRule = (ruleId: string, updates: Partial<FieldRule>) => {
    onUpdate({ rules: rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)) });
  };

  if (mode === 'file') {
    return <FilePolicyGroup field={field} onUpdate={onUpdate} />;
  }

  if (mode === 'none') {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-ink-400">
          <Hash className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <p className="mt-3 text-[13.5px] font-semibold text-foreground">Nothing to limit on this answer</p>
        <p className="mt-1 max-w-[320px] text-[12px] leading-snug text-muted-foreground">
          This question type has no answer rules. If it must be filled in, use the <b>Required</b> toggle below.
        </p>
      </div>
    );
  }

  const available = ruleOptionsFor(field.type);
  const quickAdd = available.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Quick add — the rules people actually reach for on this type */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quick add</span>
        {quickAdd.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => addRuleOfType(r.value)}
            className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card px-2.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.05] hover:text-primary"
          >
            <Plus className="h-3 w-3" />
            {r.label}
          </button>
        ))}
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-ink-400">
            <Hash className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <p className="mt-3 text-[13.5px] font-semibold text-foreground">No rules on this answer</p>
          <p className="mt-1 max-w-[320px] text-[12px] leading-snug text-muted-foreground">
            Anything people enter is accepted as-is. Add a rule to limit what this answer can be.
          </p>
          <button
            type="button"
            onClick={() => addRuleOfType(available[0]?.value ?? 'minLength')}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add a rule
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rules.map((rule, i) => {
            const matchLabel = otherFields.find((f) => f.id === rule.value)?.label;
            return (
              <div key={rule.id} className="rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2">
                  <span className="min-w-0 truncate text-[12.5px] font-semibold text-foreground">
                    {ruleSentence(rule.type, rule.value, matchLabel)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRule(rule.id)}
                    className="grid h-6 w-6 flex-none place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove rule ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-2.5 p-3 sm:grid-cols-2">
                  <FieldRow label="Rule">
                    <Select
                      value={rule.type}
                      onChange={(e) => updateRule(rule.id, { type: e.target.value as FieldRule['type'], value: '' })}
                      options={ruleOptionsFor(field.type, rule.type)}
                      className="h-10 text-[13px] font-medium"
                    />
                  </FieldRow>
                  {!NO_VALUE_RULE_TYPES.has(rule.type) && (
                    <FieldRow label={rule.type === 'custom' ? 'Field to match' : 'Value'}>
                      {rule.type === 'custom' ? (
                        <Select
                          value={rule.value || ''}
                          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                          options={otherFields.map((f) => ({ value: f.id, label: f.label || f.id }))}
                          placeholder="Select a field to match…"
                          className="h-10 text-[13px] font-medium"
                        />
                      ) : (
                        <Input
                          type={rule.type === 'min' || rule.type === 'max' ? 'number' : 'text'}
                          value={rule.value || ''}
                          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                          placeholder={ruleValuePlaceholder(rule.type)}
                          className="h-10 text-[13px]"
                        />
                      )}
                    </FieldRow>
                  )}
                  <div className="sm:col-span-2">
                    <FieldRow label="Error message">
                      <Input
                        value={rule.message || ''}
                        onChange={(e) => updateRule(rule.id, { message: e.target.value })}
                        placeholder={`Default: “${ruleDefaultMessage(rule.type)}”`}
                        className="h-10 text-[13px]"
                      />
                      {(rule.type === 'pattern' || rule.type === 'regex') && isInvalidRegex(rule.value) && (
                        <p className="text-[11px] font-medium text-destructive">
                          This pattern is invalid — the rule won&apos;t run until it&apos;s fixed.
                        </p>
                      )}
                    </FieldRow>
                  </div>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => addRuleOfType(available[0]?.value ?? 'minLength')}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Add another rule
          </button>
        </div>
      )}

      {['date', 'time'].includes(field.type) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldRow label={`Minimum ${field.type === 'date' ? 'date' : 'time'}`}>
            <Input
              type={field.type}
              value={field.minValue ?? ''}
              onChange={(e) => onUpdate({ minValue: e.target.value || undefined })}
              placeholder="No minimum"
              className="h-10 text-[13px]"
            />
          </FieldRow>
          <FieldRow label={`Maximum ${field.type === 'date' ? 'date' : 'time'}`}>
            <Input
              type={field.type}
              value={field.maxValue ?? ''}
              onChange={(e) => onUpdate({ maxValue: e.target.value || undefined })}
              placeholder="No maximum"
              className="h-10 text-[13px]"
            />
          </FieldRow>
        </div>
      )}

      {field.type !== 'table' && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
          <UICheckbox
            checked={!!field.unique}
            onCheckedChange={(checked: boolean) => onUpdate({ unique: !!checked })}
            className="mt-0.5"
          />
          <span className="text-[13.5px]">
            <span className="font-medium text-foreground">Unique submission value</span>
            <span className="mt-0.5 block text-[11.5px] leading-4 text-muted-foreground">
              Rejects a value that was already submitted{!field.required ? '. Only checked when the respondent enters one.' : '.'}
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

function AppearanceTab({ field, onUpdate }: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const cfg = field.surveyConfig;
  const scale = cfg?.scale;
  const setScale = (updates: Partial<NonNullable<FormField['surveyConfig']>['scale']>) => onUpdate({
    surveyConfig: { ...cfg!, scale: { ...(scale ?? { min: 1, max: 5 }), ...updates } },
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Scale minimum">
          <Input
            type="number"
            min={0}
            max={10}
            value={scale?.min ?? (field.type === 'nps' ? 0 : 1)}
            onChange={(e) => setScale({ min: Number(e.target.value) })}
            className="h-10 text-[13.5px]"
          />
        </FieldRow>
        <FieldRow label="Scale maximum">
          <Input
            type="number"
            min={1}
            max={10}
            value={scale?.max ?? (field.type === 'nps' ? 10 : 5)}
            onChange={(e) => setScale({ max: Number(e.target.value) })}
            className="h-10 text-[13.5px]"
          />
        </FieldRow>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldRow label="Minimum label">
          <Input
            value={scale?.minLabel ?? ''}
            onChange={(e) => setScale({ minLabel: e.target.value || undefined })}
            placeholder="e.g. Not at all likely"
            className="h-10 text-[13.5px]"
          />
        </FieldRow>
        <FieldRow label="Maximum label">
          <Input
            value={scale?.maxLabel ?? ''}
            onChange={(e) => setScale({ maxLabel: e.target.value || undefined })}
            placeholder="e.g. Extremely likely"
            className="h-10 text-[13.5px]"
          />
        </FieldRow>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
        <UICheckbox
          checked={!!scale?.notApplicable}
          onCheckedChange={(checked: boolean) => setScale({ notApplicable: !!checked || undefined })}
          className="mt-0.5"
        />
        <span className="text-[13px]">
          <span className="font-medium text-foreground">Offer &ldquo;Not applicable&rdquo;</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">Adds an N/A choice that skips scoring.</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
        <UICheckbox
          checked={!!cfg?.softRequired}
          onCheckedChange={(checked: boolean) => onUpdate({ surveyConfig: { ...cfg!, softRequired: !!checked || undefined } })}
          className="mt-0.5"
        />
        <span className="text-[13px]">
          <span className="font-medium text-foreground">Soft required</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">Prompts when skipped, but lets people continue.</span>
        </span>
      </label>

      {field.type === 'ranking' && (
        <>
          <FieldRow label="Maximum items to rank" hint="Leave empty to allow ranking every item.">
            <Input
              type="number"
              min={1}
              value={cfg?.ranking?.maxRanked ?? ''}
              onChange={(e) => onUpdate({
                surveyConfig: { ...cfg!, ranking: { ...cfg?.ranking, maxRanked: e.target.value ? Number(e.target.value) : undefined } },
              })}
              placeholder="All items"
              className="h-10 text-[13.5px]"
            />
          </FieldRow>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
            <UICheckbox
              checked={!!cfg?.ranking?.requireAll}
              onCheckedChange={(checked: boolean) => onUpdate({
                surveyConfig: { ...cfg!, ranking: { ...cfg?.ranking, requireAll: !!checked || undefined } },
              })}
              className="mt-0.5"
            />
            <span className="text-[13px]">
              <span className="font-medium text-foreground">Require ranking every item</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
            <UICheckbox
              checked={!!cfg?.randomize?.enabled}
              onCheckedChange={(checked: boolean) => onUpdate({
                surveyConfig: { ...cfg!, randomize: { ...cfg?.randomize, enabled: !!checked } },
              })}
              className="mt-0.5"
            />
            <span className="text-[13px]">
              <span className="font-medium text-foreground">Randomize choices per response</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">Each person sees the items in a different order.</span>
            </span>
          </label>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Advanced tab — the former ⋮ menu, as cards with live status
 * ------------------------------------------------------------------------- */

function AdvancedTab({ field, allFields, variables, formType, onOpenModal, onUpdateField }: {
  field: FormField;
  allFields: FormField[];
  variables: FormVariable[];
  formType?: string;
  onOpenModal: (kind: FieldModalKind) => void;
  onUpdateField: (id: string, updates: Partial<FormField>) => void;
}) {
  const linkedSource = allFields.find((f) => f.id === field.fieldLinking?.sourceFieldId);
  const displayVariable = variables.find((v) => v.id === field.displayConfig?.variableId);
  let externalHost = field.externalValidation?.url ?? '';
  try { if (externalHost) externalHost = new URL(externalHost.startsWith('http') ? externalHost : `https://${externalHost}`).host; } catch { /* keep raw */ }

  interface Card {
    key: string;
    icon: React.ElementType;
    title: string;
    sub: string;
    on?: boolean;
    onClick: () => void;
  }

  const cards: Card[] = [
    {
      key: 'visibility',
      icon: Eye,
      title: 'Only show this sometimes',
      sub: field.showWhen && countShowWhenLeaves(field.showWhen.conditions) > 0
        ? `On — ${countShowWhenLeaves(field.showWhen.conditions)} condition${countShowWhenLeaves(field.showWhen.conditions) === 1 ? '' : 's'}`
        : 'Show or hide this question based on other answers.',
      on: !!(field.showWhen && countShowWhenLeaves(field.showWhen.conditions) > 0),
      onClick: () => onOpenModal('visibility'),
    },
    {
      key: 'linking',
      icon: Link,
      title: 'Fill from another question',
      sub: field.fieldLinking?.enabled
        ? `On — from “${linkedSource?.label || 'another question'}”`
        : 'Copy or restrict this answer using other questions.',
      on: !!field.fieldLinking?.enabled,
      onClick: () => onOpenModal('linking'),
    },
    {
      key: 'external',
      icon: Globe,
      title: 'Check with another system',
      sub: field.externalValidation?.enabled && externalHost
        ? `On — answers are checked against ${externalHost}`
        : 'Verify the answer against an external API.',
      on: !!field.externalValidation?.enabled,
      onClick: () => onOpenModal('external'),
    },
    {
      key: 'alerts',
      icon: AlertCircle,
      title: 'Show a message when',
      sub: field.alerts?.length
        ? `On — ${field.alerts.length} message${field.alerts.length === 1 ? '' : 's'}`
        : 'Show a custom message when conditions match.',
      on: !!field.alerts?.length,
      onClick: () => onOpenModal('alerts'),
    },
    {
      key: 'documents',
      icon: FileText,
      title: 'Attach a document',
      sub: field.supportDocuments?.length
        ? `On — ${field.supportDocuments.length} document${field.supportDocuments.length === 1 ? '' : 's'}`
        : 'Show reference files next to this question.',
      on: !!field.supportDocuments?.length,
      onClick: () => onOpenModal('documents'),
    },
    {
      key: 'variables',
      icon: Calculator,
      title: 'Calculate from other answers',
      sub: 'Manage the variables this form can compute.',
      on: variables.length > 0,
      onClick: () => onOpenModal('variables'),
    },
  ];

  if (field.type === 'table') {
    cards.push({
      key: 'table',
      icon: FileSpreadsheet,
      title: 'Table columns',
      sub: field.tableConfig?.columns?.length
        ? `${field.tableConfig.columns.length} column${field.tableConfig.columns.length === 1 ? '' : 's'} configured`
        : 'Set up the columns of this grid.',
      on: !!field.tableConfig?.columns?.length,
      onClick: () => onOpenModal('table'),
    });
  }
  if (field.type === 'display') {
    cards.push({
      key: 'display',
      icon: Eye,
      title: 'Choose what to display',
      sub: displayVariable ? `On — showing “${displayVariable.name}”` : 'Pick the variable or value to show.',
      on: !!displayVariable,
      onClick: () => onOpenModal('display'),
    });
  }
  if (formType === 'voting' && POLLABLE(field.type)) {
    cards.push({
      key: 'poll',
      icon: BarChart2,
      title: 'Count this in the poll',
      sub: field.isPollQuestion ? 'On — this is the counted question' : 'Make this the question the poll tallies.',
      on: !!field.isPollQuestion,
      onClick: () => {
        // A poll counts one question: selecting this one deselects the rest.
        allFields.forEach((f) => {
          if (f.id !== field.id && f.isPollQuestion) onUpdateField(f.id, { isPollQuestion: false });
        });
        onUpdateField(field.id, { isPollQuestion: !field.isPollQuestion });
      },
    });
  }
  if (formType === 'assessment' && POLLABLE(field.type)) {
    cards.push({
      key: 'scoring',
      icon: ClipboardCheck,
      title: 'Score this question',
      sub: field.correctAnswer != null ? 'On — a correct answer is set' : 'Mark the correct answer and its points.',
      on: field.correctAnswer != null,
      onClick: () => onOpenModal('scoring'),
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map(({ key, icon: Icon, title, sub, on, onClick }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          className={cn(
            'group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
            on ? 'border-primary/35 bg-accent/60 hover:border-primary/60' : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40'
          )}
        >
          <span className={cn(
            'flex h-8 w-8 flex-none items-center justify-center rounded-lg border',
            on ? 'border-primary/25 bg-primary/[0.08] text-primary' : 'border-border bg-muted/60 text-ink-400'
          )}>
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
              {title}
              {on && <span className="h-1.5 w-1.5 flex-none rounded-full bg-primary" />}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{sub}</span>
          </span>
          <ChevronRight className="mt-1.5 h-4 w-4 flex-none text-ink-300 transition-colors group-hover:translate-x-0.5 group-hover:text-primary" />
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Preview tab — exactly how the question looks in the final form
 * ------------------------------------------------------------------------- */

function PreviewTab({ field, variables }: { field: FormField; variables: FormVariable[] }) {
  return (
    <div className="space-y-3">
      <p className="text-[11.5px] leading-snug text-muted-foreground">
        This is exactly how people filling the form will see this question.
      </p>
      <div className="rounded-xl border border-border bg-background px-4 py-5 sm:px-6">
        <p className="text-[14px] font-semibold leading-snug text-foreground">
          {field.label || <span className="font-normal italic text-muted-foreground/70">Your question will appear here</span>}
          {field.required && <span className="ml-0.5 text-destructive">*</span>}
        </p>
        {field.helpText && (
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{field.helpText}</p>
        )}
        <div className="mt-3.5">
          <LiveControl field={field} variables={variables} variant="preview" />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * The field editor — header, dynamic tabs, footer (v2 §3.3)
 * ------------------------------------------------------------------------- */

export default function FieldEditor({
  field, allFields, variables, formType,
  onOpenModal, onUpdateField, onDuplicate, onDelete, onClose, initialTab,
}: FieldEditorProps) {
  const [tab, setTab] = useState<FieldEditorTab>(initialTab ?? 'content');
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [typeQuery, setTypeQuery] = useState('');
  const [labelFocused, setLabelFocused] = useState(false);
  const otherFields = allFields.filter((f) => f.id !== field.id);

  const onUpdate = (updates: Partial<FormField>) => onUpdateField(field.id, updates);

  /** Change the question type, carrying over what makes sense (v2 §3.3). */
  const setType = (type: FormField['type']) => {
    const updates: Partial<FormField> = { type };
    if (HAS_OPTIONS(type) && !(field.options ?? []).length) {
      updates.options = type === 'ranking'
        ? [{ label: 'First item', value: 'item_1' }, { label: 'Second item', value: 'item_2' }, { label: 'Third item', value: 'item_3' }]
        : defaultOptions();
    }
    if (!HAS_OPTIONS(type) && type !== 'ranking') updates.options = undefined;
    if (SURVEY_TYPES.includes(type as (typeof SURVEY_TYPES)[number])) {
      Object.assign(updates, surveyDefaults(type, field));
    } else if (field.surveyConfig) {
      updates.surveyConfig = undefined;
    }
    if (type === 'display' && !field.displayConfig) {
      const firstVar = variables[0];
      updates.displayConfig = firstVar
        ? { variableId: firstVar.id, label: firstVar.name }
        : { label: '' };
    }
    onUpdate(updates);
    setTypeMenuOpen(false);
  };

  // Escape closes the type menu, like every other popover in the editor.
  useEffect(() => {
    if (!typeMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTypeMenuOpen(false);
        setTypeQuery('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [typeMenuOpen]);

  const tabs = fieldEditorTabs(field.type);
  const activeTab = tabs.includes(tab) ? tab : 'content';
  const TypeIcon = TYPE_ICONS[field.type];
  const focusLabel = !labelFocused && !field.label;

  const validationSet = !!(field.validation && Object.entries(field.validation).some(([k, v]) => v != null && v !== '' && k !== 'allowClearAll' && k !== 'showCount'))
    || !!(field.rules?.length)
    || !!field.unique;
  const advancedSet = !!(field.showWhen && countShowWhenLeaves(field.showWhen.conditions) > 0)
    || !!field.fieldLinking?.enabled
    || !!field.externalValidation?.enabled
    || !!field.alerts?.length
    || !!field.supportDocuments?.length
    || !!field.tableConfig?.columns?.length
    || !!field.displayConfig?.variableId
    || (formType === 'voting' && !!field.isPollQuestion)
    || (formType === 'assessment' && field.correctAnswer != null);

  const isSurveyForm = formType === 'survey' || (TYPE_SURVEY_GROUP.types as string[]).includes(field.type);
  const CurrentTypeIcon = TYPE_ICONS[field.type];

  // Sections shown in the type menu; searching flattens them into results.
  const typeMenuGroups = isSurveyForm
    ? [TYPE_SURVEY_GROUP, ...TYPE_GROUPS]
    : TYPE_GROUPS;
  const typeQueryLower = typeQuery.trim().toLowerCase();
  const typeMatches = (t: string) =>
    !typeQueryLower
    || (TYPE_FRIENDLY[t] ?? '').toLowerCase().includes(typeQueryLower)
    || (TYPE_LABEL[t] ?? '').toLowerCase().includes(typeQueryLower)
    || t.toLowerCase().includes(typeQueryLower);
  const typeResults = typeQueryLower
    ? typeMenuGroups.flatMap((g) => g.types).filter(typeMatches)
    : null;

  const typeMenuItem = (t: FormField['type']) => {
    const ItemIcon = TYPE_ICONS[t];
    const active = t === field.type;
    return (
      <button
        key={t}
        type="button"
        onClick={() => setType(t)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-accent hover:text-accent-foreground',
          active && 'font-semibold text-primary'
        )}
      >
        {ItemIcon && <ItemIcon className={cn('h-3.5 w-3.5 flex-none', active ? 'text-primary' : 'text-ink-400')} strokeWidth={1.8} />}
        <span className="min-w-0 flex-1 truncate">{TYPE_FRIENDLY[t] || t}</span>
        {active && <Check className="h-3.5 w-3.5 flex-none" />}
      </button>
    );
  };

  const tabDot = (t: FieldEditorTab) =>
    t === 'validation' && validationSet ? true
    : t === 'advanced' && advancedSet ? true
    : false;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Header — icon, type name, contextual description, actions */}
      <div className="flex items-start gap-3.5 px-5 py-4 sm:px-6">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.07] text-primary">
          {TypeIcon && <TypeIcon className="h-5 w-5" strokeWidth={1.8} />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-bold tracking-tight text-foreground">
            {TYPE_FRIENDLY[field.type] || TYPE_LABEL[field.type] || field.type}
          </h3>
          <p className="mt-px truncate text-xs leading-snug text-muted-foreground">
            {FIELD_DESCRIPTIONS[field.type] || 'Configure this question.'}
          </p>
        </div>
        <div className="flex flex-none items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Duplicate this question"
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Delete this question"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[11.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            title="Finish editing this question"
          >
            <Check className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Done</span>
          </button>
        </div>
      </div>

      {/* Tabs — dynamic per field type */}
      <div className="flex items-end gap-0.5 overflow-x-auto border-b border-border/70 px-3 sm:px-4" role="tablist" aria-label="Field editor sections">
        {tabs.map((t) => {
          const active = t === activeTab;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={cn(
                'relative flex h-10 flex-none items-center gap-1.5 px-3 text-[13px] font-semibold transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {FIELD_EDITOR_TAB_LABELS[t]}
              {tabDot(t) && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              {active && <span className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-t bg-primary" />}
            </button>
          );
        })}
      </div>

      {/* Tab body — scrolls internally like a dialog, so a long option list
       * never stretches the page under the editor. */}
      <div className="max-h-[min(62vh,560px)] overflow-y-auto px-5 py-5 scrollbar-subtle sm:px-6">
        {activeTab === 'content' && (
          <ContentTab
            field={field}
            onUpdate={onUpdate}
            onTypeChange={setType}
            onOpenModal={onOpenModal}
            focusLabel={focusLabel}
            onLabelFocus={() => setLabelFocused(true)}
          />
        )}
        {activeTab === 'validation' && (
          <ValidationTab field={field} otherFields={otherFields} onUpdate={onUpdate} />
        )}
        {activeTab === 'appearance' && <AppearanceTab field={field} onUpdate={onUpdate} />}
        {activeTab === 'advanced' && (
          <AdvancedTab
            field={field}
            allFields={allFields}
            variables={variables}
            formType={formType}
            onOpenModal={onOpenModal}
            onUpdateField={onUpdateField}
          />
        )}
        {activeTab === 'preview' && <PreviewTab field={field} variables={variables} />}
      </div>

      {/* Footer — type · width · required, unchanged from the card design */}
      <div className="relative mt-auto">
        {typeMenuOpen && (
          <div className="fixed inset-0 z-30" onClick={() => setTypeMenuOpen(false)} />
        )}
        <div className="flex flex-wrap items-center gap-2 rounded-b-lg border-t border-border bg-ink-50 px-5 py-2.5 sm:px-6">
          {/* Type picker */}
            <div className="relative flex items-center gap-1.5">
              <span className="hidden text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-400 sm:inline">
                Type
              </span>
              <button
                type="button"
                onClick={() => { setTypeMenuOpen((v) => !v); setTypeQuery(''); }}
                aria-expanded={typeMenuOpen}
                className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary"
                title="Switch this question to another type"
              >
              {CurrentTypeIcon && <CurrentTypeIcon className="h-3.5 w-3.5 flex-none text-ink-400" strokeWidth={1.8} />}
              {TYPE_FRIENDLY[field.type] || TYPE_LABEL[field.type] || field.type}
              <ChevronDown className="h-3 w-3" />
            </button>
              {typeMenuOpen && (
              <div className="absolute bottom-[calc(100%+6px)] left-0 z-40 w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-xl shadow-foreground/10">
                <div className="border-b border-border/70 p-2">
                  <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-2.5 transition-colors focus-within:border-primary">
                    <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                    <input
                      autoFocus
                      value={typeQuery}
                      onChange={(e) => setTypeQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') { setTypeMenuOpen(false); setTypeQuery(''); } }}
                      placeholder="Search question types…"
                      aria-label="Search question types"
                      className="h-8 min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                    />
                    {typeQuery && (
                      <button
                        type="button"
                        onClick={() => setTypeQuery('')}
                        className="grid h-5 w-5 flex-none place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Clear search"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1 scrollbar-subtle">
                  {typeResults ? (
                    typeResults.length ? (
                      <div className="space-y-0.5">
                        <p className="px-2.5 pb-1 pt-1.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-400">
                          {typeResults.length} result{typeResults.length === 1 ? '' : 's'}
                        </p>
                        {typeResults.map((t) => typeMenuItem(t))}
                      </div>
                    ) : (
                      <p className="px-2.5 py-4 text-center text-[12px] text-muted-foreground">
                        No question type matches &ldquo;{typeQuery}&rdquo;.
                      </p>
                    )
                  ) : (
                    typeMenuGroups.map((group) => (
                      <div key={group.label} className="space-y-0.5">
                        <p className="px-2.5 pb-1 pt-1.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-400">
                          {group.label}
                        </p>
                        {group.types.filter(typeMatches).map((t) => typeMenuItem(t))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Width picker */}
          <div className="inline-flex overflow-hidden rounded-lg border border-border bg-card" title="Field width">
            {([
              { value: 'full' as const, label: '100%' },
              { value: 'half' as const, label: '50%' },
              { value: 'third' as const, label: '33%' },
            ]).map((w) => (
              <button
                key={w.value}
                type="button"
                onClick={() => onUpdate({ width: w.value })}
                className={cn(
                  'h-7 border-l border-border px-2 text-[10.5px] font-semibold first:border-l-0',
                  (field.width ?? 'full') === w.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {w.label}
              </button>
            ))}
          </div>

          <span className="flex-1" />

          {/* Required toggle */}
          <button
            type="button"
            onClick={() => onUpdate({ required: !field.required })}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-semibold',
              field.required ? 'text-foreground' : 'text-muted-foreground'
            )}
            aria-pressed={!!field.required}
          >
            <span className={cn(
              'relative h-[19px] w-[34px] rounded-full transition-colors',
              field.required ? 'bg-primary' : 'bg-ink-300'
            )}>
              <span className={cn(
                'absolute top-0.5 h-[15px] w-[15px] rounded-full bg-white shadow transition-transform',
                field.required ? 'translate-x-[15px] left-[2px]' : 'left-[2px]'
              )} />
            </span>
            Required
          </button>
        </div>
      </div>
    </div>
  );
}
