import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Trash2, Copy, MoreVertical, ChevronDown, Plus, X, Star, Upload,
  Hash, Eye, Globe, Link, Calculator, AlertCircle, FileText, FileSpreadsheet,
  ClipboardCheck, BarChart2, Info, FileUp,
} from 'lucide-react';
import type { FormField, FormVariable, ShowConditionOperator } from '../../types';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { updateField, selectField } from '../../store/builderSlice';
import { cn } from '../../lib/utils';
import {
  HAS_OPTIONS, SINGLE_CHOICE, SURVEY_TYPES, POLLABLE, TYPE_LABEL, TYPE_FRIENDLY,
  TYPE_PICKER_ORDER, slugifyOptionValue, countShowWhenLeaves, firstShowWhenLeaf,
  defaultOptions,
} from './formSetup';

/** The modals reachable from the ⋮ menu (opened at page level). */
export type FieldModalKind =
  | 'validation' | 'visibility' | 'linking' | 'external' | 'variables'
  | 'alerts' | 'documents' | 'file' | 'table' | 'csv' | 'scoring' | 'display';

interface QuestionCardProps {
  field: FormField;
  index: number;
  isSelected: boolean;
  allFields: FormField[];
  variables: FormVariable[];
  formType?: string;
  onOpenModal: (kind: FieldModalKind) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  className?: string;
}

const SHOW_OPERATOR_LABELS: Partial<Record<ShowConditionOperator, string>> = {
  equals: 'is', notEquals: 'is not', contains: 'contains', notContains: 'does not contain',
  isEmpty: 'is empty', isNotEmpty: 'is not empty', greaterThan: 'is greater than',
  lessThan: 'is less than', gte: 'is at least', lte: 'is at most', in: 'is one of',
  notIn: 'is not one of',
};

const PLACEHOLDER_TYPES = ['text', 'email', 'phone', 'number', 'select', 'multiselect', 'date', 'time', 'textarea', 'html'];

/** Survey defaults applied when a question becomes a survey type. */
function surveyDefaults(type: FormField['type'], field: FormField): Partial<FormField> {
  switch (type) {
    case 'nps': return { surveyConfig: { kind: 'nps', scale: { min: 0, max: 10, minLabel: 'Not at all likely', maxLabel: 'Extremely likely' } } };
    case 'csat': return { surveyConfig: { kind: 'csat', scale: { min: 1, max: 5, minLabel: 'Very dissatisfied', maxLabel: 'Very satisfied' } } };
    case 'ces': return { surveyConfig: { kind: 'ces', scale: { min: 1, max: 7, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' } } };
    case 'likert': return {
      surveyConfig: {
        kind: 'likert',
        scale: { min: 1, max: 5, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' },
        rows: field.surveyConfig?.rows?.length ? field.surveyConfig.rows
          : [{ id: `row_${Date.now()}_1`, label: 'Statement 1' }, { id: `row_${Date.now()}_2`, label: 'Statement 2' }],
      },
    };
    case 'ranking': return { surveyConfig: { kind: 'ranking', ranking: { requireAll: true } } };
    default: return {};
  }
}

/* ---------------------------------------------------------------------------
 * The answer control, rendered live at respondent size (v2 §3.3)
 * ------------------------------------------------------------------------- */
function LiveControl({ field, open, variables, onAddOption, onBulkImport }: {
  field: FormField;
  open: boolean;
  variables: FormVariable[];
  onAddOption: () => void;
  onBulkImport: () => void;
}) {
  const dispatch = useAppDispatch();
  const options = field.options ?? [];

  const box = (children: React.ReactNode, extra?: string, narrow?: boolean) => (
    <div className={cn(
      'flex items-center rounded-lg border border-input bg-background px-3 py-2 text-[13.5px] text-ink-400',
      narrow && 'max-w-[200px]',
      extra
    )}>
      {children}
    </div>
  );

  const setOptionLabel = (i: number, label: string) => {
    const opt = options[i];
    // Keep hand-written values; regenerate only values that were auto-derived.
    const wasDerived = !opt.value || slugifyOptionValue(opt.label, '') === opt.value;
    const optionsNext = options.map((o, idx) =>
      idx === i ? { ...o, label, value: wasDerived ? slugifyOptionValue(label, `option_${i + 1}`) : o.value } : o
    );
    dispatch(updateField({ id: field.id, updates: { options: optionsNext } }));
  };
  const removeOption = (i: number) => {
    dispatch(updateField({ id: field.id, updates: { options: options.filter((_, idx) => idx !== i) } }));
  };

  const scale = field.surveyConfig?.scale;
  const scaleMax = scale?.max ?? (field.type === 'nps' ? 10 : 5);
  const scaleMin = scale?.min ?? (field.type === 'nps' ? 0 : 1);
  const scaleRow = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

  switch (field.type) {
    case 'textarea':
      return <div className="min-h-[64px] w-full rounded-lg border border-input bg-background px-3 py-2 text-[13.5px] text-ink-400">{field.placeholder || 'Their answer…'}</div>;
    case 'number':
      return <div className="w-[180px] rounded-lg border border-input bg-background px-3 py-2 text-[13.5px] text-ink-400">{field.placeholder || '0'}</div>;
    case 'date':
      return box(<span>dd / mm / yyyy</span>, '', true);
    case 'time':
      return box(<span>--:--</span>, 'max-w-[140px]');
    case 'file':
      return box(<><Upload className="mr-2 h-3.5 w-3.5" /><span>Choose a file</span></>);
    case 'signature':
      return <div className="grid h-20 place-items-center rounded-lg border border-dashed border-input bg-background text-[12.5px] italic text-ink-400">Sign here</div>;
    case 'rating':
      return (
        <div className="flex gap-1.5 text-ink-300">
          {[1, 2, 3, 4, 5].map((n) => <Star key={n} className="h-4 w-4 fill-current" />)}
        </div>
      );
    case 'nps':
      return (
        <div className="flex flex-wrap gap-1">
          {scaleRow(scaleMin, scaleMax).map((n) => (
            <span key={n} className="grid h-[30px] w-[30px] place-items-center rounded-md border border-input bg-background text-xs text-ink-500">{n}</span>
          ))}
        </div>
      );
    case 'csat':
    case 'ces':
      return (
        <div className="flex flex-wrap gap-1">
          {scaleRow(scaleMin, scaleMax).map((n) => (
            <span key={n} className="grid h-[30px] w-[30px] place-items-center rounded-md border border-input bg-background text-xs text-ink-500">{n}</span>
          ))}
        </div>
      );
    case 'likert': {
      const cols = scaleRow(scaleMin, scaleMax);
      const rows = field.surveyConfig?.rows?.length ? field.surveyConfig.rows : [{ id: 'r1', label: 'Statement 1' }, { id: 'r2', label: 'Statement 2' }];
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th />
                {cols.map((c) => (
                  <th key={c} className="border-b border-border px-1 py-1.5 text-center text-[10.5px] font-semibold text-muted-foreground">
                    {c === scaleMin && scale?.minLabel ? scale.minLabel : c === scaleMax && scale?.maxLabel ? scale.maxLabel : c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="border-b border-border/60 py-2 pr-2 text-[12.5px] text-foreground">{r.label}</td>
                  {cols.map((c) => (
                    <td key={c} className="border-b border-border/60 py-2 text-center">
                      <span className="inline-block h-4 w-4 rounded-full border-[1.5px] border-ink-300" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'ranking':
      // A closed ranking question shows its items; open, it falls through to
      // the editable option list below.
      if (!open) {
        return options.length
          ? (
            <div className="space-y-1">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1 text-[13.5px]">
                  <span className="w-3.5 text-[11px] text-ink-400">{i + 1}</span>
                  <span className="text-foreground">{o.label || `Option ${i + 1}`}</span>
                </div>
              ))}
            </div>
          )
          : <p className="text-[12.5px] italic text-muted-foreground">No items to rank yet.</p>;
      }
      break;
    case 'table': {
      const columns = field.tableConfig?.columns ?? [];
      return columns.length
        ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.id} className="border border-border bg-ink-50 px-2 py-1.5 text-left text-[10.5px] font-semibold text-muted-foreground">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {columns.map((c) => (
                    <td key={c.id} className="border border-border px-2 py-1.5 text-ink-400">—</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )
        : <p className="text-[12.5px] italic text-muted-foreground">No columns yet — use ⋮ → Table columns…</p>;
    }
    case 'display': {
      const variable = variables.find((v) => v.id === field.displayConfig?.variableId);
      return (
        <div className="w-full rounded-lg border border-plum-200 bg-plum-50 px-3 py-2 text-[13.5px] font-medium text-plum-800">
          {variable ? `{{ ${variable.name} }}` : 'Choose a value to display — ⋮ → Choose what to display…'}
        </div>
      );
    }
    case 'html':
      return <div className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-ink-400">&lt;p&gt;Custom markup&lt;/p&gt;</div>;
    case 'select':
    case 'multiselect':
      if (!open) {
        return box(<><span className="flex-1">{field.placeholder || 'Choose…'}</span><ChevronDown className="h-4 w-4" /></>);
      }
      break;
    case 'radio':
    case 'checkbox':
      if (!open) {
        const shape = field.type === 'radio' ? 'rounded-full' : 'rounded';
        return options.length ? (
          <div className="space-y-1">
            {options.slice(0, 6).map((o, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1 text-[13.5px]">
                <span className={cn('h-4 w-4 flex-none border-[1.5px] border-ink-300', shape)} />
                <span className="truncate text-foreground">{o.label || `Option ${i + 1}`}</span>
              </div>
            ))}
            {options.length > 6 && (
              <p className="pl-[26px] text-[11.5px] text-muted-foreground">+{options.length - 6} more</p>
            )}
          </div>
        ) : <p className="text-[12.5px] italic text-muted-foreground">No options yet.</p>;
      }
      break;
    default:
      return <div className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13.5px] text-ink-400">{field.placeholder || 'Their answer…'}</div>;
  }

  /* Option-based question, expanded: the options are edited in place (v2 §3.3) */
  const single = SINGLE_CHOICE(field.type);
  const shape = single ? 'rounded-full' : 'rounded';
  const marker = field.type === 'ranking'
    ? <span className="w-3.5 flex-none text-center text-[11px] text-ink-400" />
    : <span className={cn('h-4 w-4 flex-none border-[1.5px] border-ink-300', shape)} />;

  return (
    <div>
      <div className="space-y-0.5">
        {(field.options ?? []).map((option, i) => (
          <div key={i} className="group/opt flex items-center gap-2.5 py-1">
            {field.type === 'ranking'
              ? <span className="w-3.5 flex-none text-center text-[11px] text-ink-400">{i + 1}</span>
              : marker}
            <input
              value={option.label}
              onChange={(e) => { e.stopPropagation(); setOptionLabel(i, e.target.value); }}
              onClick={(e) => e.stopPropagation()}
              placeholder={`Option ${i + 1}`}
              className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent px-0 py-0.5 text-[13.5px] text-foreground placeholder:text-muted-foreground/60 hover:border-border focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeOption(i); }}
              className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/opt:opacity-100"
              aria-label={`Remove option ${i + 1}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAddOption(); }}
          className="flex items-center gap-2.5 py-1.5 text-[12.5px] text-muted-foreground"
        >
          {field.type === 'ranking'
            ? <span className="w-3.5 flex-none" />
            : <span className={cn('h-4 w-4 flex-none border-[1.5px] border-ink-300 opacity-45', shape)} />}
          <span className="border-b border-dashed border-ink-300 pb-px hover:border-primary hover:text-primary">Add an option</span>
        </button>
      </div>
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onBulkImport(); }}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Bulk import (CSV)
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * The rules a question carries, stated on the question (v2 §3.3)
 * ------------------------------------------------------------------------- */
interface RuleChip { key: string; icon: React.ElementType; text: React.ReactNode; clear: Partial<FormField>; }

function rulesFor(field: FormField, allFields: FormField[], formType?: string): RuleChip[] {
  const chips: RuleChip[] = [];

  if (field.showWhen && countShowWhenLeaves(field.showWhen.conditions) > 0) {
    const total = countShowWhenLeaves(field.showWhen.conditions);
    const leaf = firstShowWhenLeaf(field.showWhen.conditions);
    const source = leaf ? allFields.find((f) => f.id === leaf.fieldId) : null;
    const opLabel = leaf ? SHOW_OPERATOR_LABELS[leaf.operator] ?? leaf.operator : '';
    chips.push({
      key: 'vis',
      icon: Eye,
      text: <>Only shown when <b>{source?.label || 'another question'}</b> {opLabel}{leaf?.value !== undefined && leaf.value !== '' ? <> <b>{String(leaf.value)}</b></> : null}{total > 1 ? <> <b>+{total - 1}</b></> : null}</>,
      clear: { showWhen: undefined },
    });
  }

  const bits: string[] = [];
  const v = field.validation;
  if (v?.minLength != null) bits.push(`at least ${v.minLength} characters`);
  if (v?.maxLength != null) bits.push(`at most ${v.maxLength} characters`);
  if (v?.min != null) bits.push(`no less than ${v.min}`);
  if (v?.max != null) bits.push(`no more than ${v.max}`);
  if (v?.pattern) bits.push('matching a pattern');
  (field.rules ?? []).forEach((r) => {
    if (r.enabled === false) return;
    if (['minLength', 'maxLength', 'min', 'max'].includes(r.type) && r.value !== undefined && r.value !== '') bits.push(`${r.type === 'minLength' || r.type === 'maxLength' ? r.type.replace('Length', ' length') : (r.type === 'min' ? 'minimum ' : 'maximum ') + r.value}`);
    else if (r.type === 'pattern' || r.type === 'regex') bits.push('matching a pattern');
    else if (['email', 'url'].includes(r.type)) bits.push(`a valid ${r.type}`);
    else if (r.type !== 'required' && r.value) bits.push(`${r.type} ${r.value}`);
  });
  if (field.unique) bits.push('not already used');
  if (bits.length) {
    chips.push({
      key: 'val',
      icon: Hash,
      text: <>Answer must be <b>{bits.slice(0, 3).join(', ')}</b>{bits.length > 3 ? <> and {bits.length - 3} more</> : null}</>,
      clear: { validation: undefined, rules: undefined, unique: false },
    });
  }

  if (field.externalValidation?.enabled && field.externalValidation.url) {
    let host = field.externalValidation.url;
    try { host = new URL(field.externalValidation.url.startsWith('http') ? field.externalValidation.url : `https://${field.externalValidation.url}`).host; } catch { /* keep raw */ }
    chips.push({ key: 'ext', icon: Globe, text: <>Checked against <b>{host}</b></>, clear: { externalValidation: undefined } });
  }

  if (field.fieldLinking?.enabled) {
    const source = allFields.find((f) => f.id === field.fieldLinking?.sourceFieldId);
    chips.push({
      key: 'lnk',
      icon: Link,
      text: <>Filled from <b>{source?.label || 'another question'}</b></>,
      clear: { fieldLinking: undefined },
    });
  }

  if (field.alerts?.length) {
    const first = field.alerts[0].message;
    chips.push({
      key: 'alr',
      icon: AlertCircle,
      text: <>Shows a message: <b>{first.length > 42 ? `${first.slice(0, 42)}…` : first}</b>{field.alerts.length > 1 ? <> +{field.alerts.length - 1}</> : null}</>,
      clear: { alerts: undefined },
    });
  }

  if (field.supportDocuments?.length) {
    const first = field.supportDocuments[0].label;
    chips.push({
      key: 'doc',
      icon: FileText,
      text: <><b>{first}</b> attached{field.supportDocuments.length > 1 ? <> +{field.supportDocuments.length - 1}</> : null}</>,
      clear: { supportDocuments: undefined },
    });
  }

  if (field.fileConfig && (field.fileConfig.accept?.length || field.fileConfig.maxSize)) {
    chips.push({
      key: 'file',
      icon: FileUp,
      text: <>Accepts <b>{field.fileConfig.accept?.length ? field.fileConfig.accept.join(', ') : 'any allowed type'}</b>, up to <b>{Math.round((field.fileConfig.maxSize ?? 5242880) / 1048576)} MB</b></>,
      clear: { fileConfig: undefined },
    });
  }

  if (field.tableConfig?.columns?.length) {
    chips.push({
      key: 'tbl',
      icon: FileSpreadsheet,
      text: <><b>{field.tableConfig.columns.length} column{field.tableConfig.columns.length === 1 ? '' : 's'}</b> configured</>,
      clear: { tableConfig: undefined },
    });
  }

  if (formType === 'voting' && field.isPollQuestion) {
    chips.push({ key: 'poll', icon: BarChart2, text: <><b>Counted in the poll</b></>, clear: { isPollQuestion: false } });
  }

  if (formType === 'assessment' && field.correctAnswer != null) {
    const answer = Array.isArray(field.correctAnswer)
      ? field.correctAnswer.map((val) => field.options?.find((o) => o.value === val)?.label ?? val).join(', ')
      : field.options?.find((o) => o.value === field.correctAnswer)?.label ?? String(field.correctAnswer);
    const points = field.points ?? 1;
    chips.push({
      key: 'score',
      icon: ClipboardCheck,
      text: <>Correct answer <b>{answer}</b> · <b>{points} pt{points !== 1 ? 's' : ''}</b></>,
      clear: { correctAnswer: undefined },
    });
  }

  return chips;
}

/* ---------------------------------------------------------------------------
 * Guess-from-the-label, offered never applied (v2 §3.2)
 * ------------------------------------------------------------------------- */
function guessFor(field: FormField): { to: FormField['type']; message: string } | null {
  if (field.type !== 'text' || !field.label) return null;
  const l = field.label.toLowerCase();
  if (/e-?mail/.test(l)) return { to: 'email', message: 'This looks like an email question. Check the address is valid?' };
  if (/(phone|mobile|contact number)/.test(l)) return { to: 'phone', message: 'This looks like a phone question. Use a phone field?' };
  if (/(how many|how much|number of|count)/.test(l)) return { to: 'number', message: 'This looks like it wants a number. Use a number field?' };
  if (/(when|date|day of)/.test(l)) return { to: 'date', message: 'This looks like it wants a date. Use a date field?' };
  return null;
}

/* ---------------------------------------------------------------------------
 * The card
 * ------------------------------------------------------------------------- */
export default function QuestionCard({
  field, index, isSelected, allFields, variables, formType,
  onOpenModal, onDelete, onDuplicate, className,
}: QuestionCardProps) {
  const dispatch = useAppDispatch();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const [menuOpen, setMenuOpen] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [guessDismissed, setGuessDismissed] = useState(false);
  const labelRef = useRef<HTMLInputElement | null>(null);

  const open = isSelected;
  const rules = rulesFor(field, allFields, formType);
  const guess = open && !guessDismissed ? guessFor(field) : null;

  useEffect(() => {
    if (open && labelRef.current && !field.label) {
      labelRef.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes the card menus, like every other popover in the editor.
  useEffect(() => {
    if (!menuOpen && !typeMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setTypeMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, typeMenuOpen]);

  const update = (updates: Partial<FormField>) => dispatch(updateField({ id: field.id, updates }));

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
    update(updates);
    setTypeMenuOpen(false);
  };

  const addOption = () => {
    const options = field.options ?? [];
    update({ options: [...options, { label: '', value: slugifyOptionValue('', `option_${options.length + 1}`) }] });
  };

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

  const hasChoice = HAS_OPTIONS(field.type);
  const isSurveyForm = formType === 'survey' || SURVEY_TYPES.includes(field.type as (typeof SURVEY_TYPES)[number]);
  const typeMenuTypes: FormField['type'][] = isSurveyForm
    ? [...TYPE_PICKER_ORDER, ...SURVEY_TYPES]
    : [...TYPE_PICKER_ORDER];

  const menuItem = (Icon: React.ElementType, label: string, onClick: () => void, set?: boolean) => (
    <button
      key={label}
      type="button"
      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onClick(); }}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-accent hover:text-accent-foreground"
    >
      <Icon className="h-4 w-4 flex-none text-ink-400" />
      <span className="flex-1">{label}</span>
      {set && (
        <span className="rounded-full bg-primary/[0.09] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-primary">Set</span>
      )}
    </button>
  );

  const validationSet = !!(field.validation && Object.entries(field.validation).some(([k, v]) => v != null && v !== '' && k !== 'allowClearAll' && k !== 'showCount'))
    || !!(field.rules?.length)
    || !!field.unique;

  return (
    <div
      ref={setNodeRef}
      id={`q-${field.id}`}
      data-question-card=""
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      className={cn(
        'group relative rounded-lg border bg-card transition-[border-color,box-shadow] duration-150',
        open
          ? 'z-10 border-primary shadow-[0_0_0_1px_hsl(var(--primary)),0_8px_26px_rgba(15,23,42,0.08)]'
          : 'border-border hover:border-primary/40',
        isDragging && 'opacity-50',
        className
      )}
      onClick={(e) => { e.stopPropagation(); if (!open) dispatch(selectField(field.id)); }}
      onKeyDown={(e) => {
        if (!open && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          dispatch(selectField(field.id));
        }
      }}
    >
      {/* click-outside backdrop for the card menus */}
      {(menuOpen || typeMenuOpen) && (
        <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setTypeMenuOpen(false); }} />
      )}

      <div className={cn('flex items-start gap-1', open ? 'px-5 pb-1 pt-3' : 'px-2 py-2.5')}>
        {/* Drag handle */}
        <button
          {...listeners}
          className={cn(
            'mt-0.5 flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground active:cursor-grabbing',
            open && 'mt-1'
          )}
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Question body */}
        <div className="min-w-0 flex-1 pr-1">
          {open ? (
            <>
              <input
                ref={labelRef}
                value={field.label}
                onChange={(e) => update({ label: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Type your question"
                aria-label="Question text"
                className="w-full rounded-t-md border-0 border-b-2 border-primary/25 bg-muted px-2.5 py-2 text-[15px] font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:bg-accent focus:outline-none"
              />
              {field.helpText || descOpen ? (
                <input
                  value={field.helpText ?? ''}
                  onChange={(e) => update({ helpText: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Add a description"
                  aria-label="Question description"
                  className="mt-1.5 w-full border-0 border-b border-border bg-transparent px-2.5 py-1 text-[12.5px] text-muted-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-muted focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDescOpen(true); }}
                  className="mt-1.5 inline-flex items-center gap-1 px-2.5 text-[11.5px] font-semibold text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  Add a description
                </button>
              )}

              {guess && (
                <div className="mx-0.5 mt-2 flex items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-accent px-2.5 py-1.5 text-[11.5px]">
                  <Info className="h-3.5 w-3.5 flex-none text-primary" />
                  <span className="flex-1 font-medium text-accent-foreground">{guess.message}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setType(guess.to); }}
                    className="h-6 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setGuessDismissed(true); }}
                    className="h-6 rounded-md px-2 text-[11px] font-medium text-muted-foreground hover:bg-muted"
                  >
                    No
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="flex-none text-[12px] font-semibold text-muted-foreground">{index + 1}.</span>
                <span className="truncate text-[13px] font-semibold text-foreground">{field.label || 'Untitled question'}</span>
                {field.required && <span className="text-destructive">*</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded border border-border bg-muted/50 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {TYPE_LABEL[field.type] || field.type}
                </span>
                {field.placeholder && (
                  <span className="truncate text-[11px] text-muted-foreground">{field.placeholder}</span>
                )}
                {field.width && field.width !== 'full' && (
                  <span className="rounded border border-border bg-muted/50 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {field.width === 'half' ? '50%' : '33%'}
                  </span>
                )}
              </div>
            </>
          )}

          {/* The live answer control */}
          <div className="mt-3.5">
            <LiveControl
              field={field}
              open={open}
              variables={variables}
              onAddOption={addOption}
              onBulkImport={() => onOpenModal('csv')}
            />
          </div>

          {/* Placeholder, edited where it appears (expanded only) */}
          {open && PLACEHOLDER_TYPES.includes(field.type) && (
            <input
              value={field.placeholder ?? ''}
              onChange={(e) => update({ placeholder: e.target.value || undefined })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Placeholder text (optional)"
              aria-label="Placeholder"
              className="mt-2 w-full rounded-md border border-dashed border-input bg-transparent px-2 py-1 text-[11.5px] text-muted-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
            />
          )}

          {/* Quiet notes with a real override */}
          {note && (
            <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-border bg-ink-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-px h-3.5 w-3.5 flex-none" />
              <span>
                {note.text}{' '}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setType(note.action.to); }}
                  className="whitespace-nowrap font-semibold text-primary hover:underline"
                >
                  {note.action.label}
                </button>
              </span>
            </div>
          )}
        </div>

        {/* Hover actions */}
        <div className={cn(
          'flex shrink-0 items-center gap-0.5 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            title="Duplicate"
            aria-label="Duplicate question"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Delete"
            aria-label="Delete question"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Rule summaries, on the question */}
      {rules.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-3.5 pt-1">
          {rules.map(({ key, icon: Icon, text, clear }) => (
            <span
              key={key}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary/15 bg-accent px-2 py-1 text-[11px] leading-snug text-accent-foreground"
            >
              <Icon className="h-3 w-3 flex-none" />
              <span className="min-w-0 truncate [&_b]:font-semibold">{text}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); update(clear); }}
                className="text-primary/50 hover:text-destructive"
                title="Remove this rule"
                aria-label="Remove rule"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Footer strip: type · width · required · ⋮ (expanded only) */}
      {open && (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-b-lg border-t border-border bg-ink-50 px-5 py-2">
            {/* Type picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setTypeMenuOpen((v) => !v); setMenuOpen(false); }}
                className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary"
                title="Change the question type"
              >
                {TYPE_FRIENDLY[field.type] || TYPE_LABEL[field.type] || field.type}
                <ChevronDown className="h-3 w-3" />
              </button>
              {typeMenuOpen && (
                <div className="absolute bottom-[calc(100%+6px)] left-0 z-40 max-h-[280px] w-60 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-xl shadow-foreground/10 scrollbar-subtle">
                  {typeMenuTypes.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-accent hover:text-accent-foreground',
                        t === field.type && 'font-semibold text-primary'
                      )}
                    >
                      {TYPE_FRIENDLY[t] || t}
                      {t === field.type && <span className="ml-auto text-[10px] font-bold">✓</span>}
                    </button>
                  ))}
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
                  onClick={() => update({ width: w.value })}
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
              onClick={() => update({ required: !field.required })}
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

            {/* ⋮ More */}
            <button
              type="button"
              onClick={() => { setMenuOpen((v) => !v); setTypeMenuOpen(false); }}
              className={cn(
                'relative grid h-[30px] w-[30px] place-items-center rounded-lg text-muted-foreground hover:bg-ink-200 hover:text-foreground',
                menuOpen && 'bg-ink-200 text-foreground'
              )}
              title="More"
              aria-label="More question options"
            >
              {rules.length > 0 && <span className="absolute right-[5px] top-[5px] h-1.5 w-1.5 rounded-full bg-primary" />}
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>

          {/* The ⋮ menu — one menu, in plain language (v2 §3.3) */}
          {menuOpen && (
            <div className="absolute bottom-[46px] right-3.5 z-40 max-h-[340px] w-[290px] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-2xl shadow-foreground/20 scrollbar-subtle">
              {menuItem(Copy, 'Duplicate', onDuplicate)}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-destructive/[0.07] hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 flex-none text-ink-400" />
                Delete
              </button>

              <div className="my-1 h-px bg-border" />
              <p className="px-2.5 pb-1 pt-1.5 text-[9.5px] font-bold uppercase tracking-wide text-ink-400">This question</p>

              {field.type !== 'table' && menuItem(Hash, 'Limit the answer…', () => onOpenModal('validation'), validationSet)}
              {menuItem(Eye, 'Only show this sometimes…', () => onOpenModal('visibility'), !!field.showWhen && countShowWhenLeaves(field.showWhen.conditions) > 0)}
              {menuItem(Link, 'Fill from another question…', () => onOpenModal('linking'), !!field.fieldLinking?.enabled)}
              {menuItem(Globe, 'Check with another system…', () => onOpenModal('external'), !!field.externalValidation?.enabled)}
              {menuItem(Calculator, 'Calculate from other answers…', () => onOpenModal('variables'), variables.length > 0)}
              {menuItem(AlertCircle, 'Show a message when…', () => onOpenModal('alerts'), !!field.alerts?.length)}
              {menuItem(FileText, 'Attach a document…', () => onOpenModal('documents'), !!field.supportDocuments?.length)}
              {field.type === 'file' && menuItem(FileUp, 'File types and size…', () => onOpenModal('file'), !!field.fileConfig)}
              {field.type === 'table' && menuItem(FileSpreadsheet, 'Table columns…', () => onOpenModal('table'), !!field.tableConfig?.columns?.length)}
              {field.type === 'display' && menuItem(Eye, 'Choose what to display…', () => onOpenModal('display'), !!field.displayConfig?.variableId)}
              {hasChoice && menuItem(FileSpreadsheet, 'Bulk import options (CSV)…', () => onOpenModal('csv'))}

              {formType === 'voting' && POLLABLE(field.type) && (
                <>
                  <div className="my-1 h-px bg-border" />
                  {menuItem(BarChart2, 'Count this in the poll', () => {
                    // A poll counts one question: selecting this one deselects the rest.
                    allFields.forEach((f) => {
                      if (f.id !== field.id && f.isPollQuestion) dispatch(updateField({ id: f.id, updates: { isPollQuestion: false } }));
                    });
                    update({ isPollQuestion: !field.isPollQuestion });
                  }, !!field.isPollQuestion)}
                </>
              )}
              {formType === 'assessment' && POLLABLE(field.type) && (
                <>
                  <div className="my-1 h-px bg-border" />
                  {menuItem(ClipboardCheck, 'Score this question…', () => onOpenModal('scoring'), field.correctAnswer != null)}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
