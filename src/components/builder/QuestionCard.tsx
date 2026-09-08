import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Trash2, Copy, X, Hash, Eye, Globe, Link, AlertCircle, FileText,
  FileSpreadsheet, ClipboardCheck, BarChart2, FileUp,
} from 'lucide-react';
import type { FormField, FormVariable, ShowConditionOperator } from '../../types';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { updateField, selectField } from '../../store/builderSlice';
import { cn } from '../../lib/utils';
import LiveControl from './LiveControl';
import FieldEditor from './FieldEditor';
import { countShowWhenLeaves, firstShowWhenLeaf, TYPE_LABEL, type FieldEditorTab } from './formSetup';

/** The modals reachable from the Advanced tab (opened at page level). */
export type FieldModalKind =
  'validation' | 'visibility' | 'linking' | 'external' | 'variables'
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

/* ---------------------------------------------------------------------------
 * The rules a question carries, stated on the collapsed card (v2 §3.3)
 * ------------------------------------------------------------------------- */
interface RuleChip {
  key: string;
  icon: React.ElementType;
  text: React.ReactNode;
  clear: Partial<FormField>;
  /** The editor tab that configures this rule — where a click lands. */
  tab: FieldEditorTab;
}

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
      tab: 'advanced',
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
      tab: 'validation',
    });
  }

  if (field.externalValidation?.enabled && field.externalValidation.url) {
    let host = field.externalValidation.url;
    try { host = new URL(field.externalValidation.url.startsWith('http') ? field.externalValidation.url : `https://${field.externalValidation.url}`).host; } catch { /* keep raw */ }
    chips.push({ key: 'ext', icon: Globe, text: <>Checked against <b>{host}</b></>, clear: { externalValidation: undefined }, tab: 'advanced' });
  }

  if (field.fieldLinking?.enabled) {
    const source = allFields.find((f) => f.id === field.fieldLinking?.sourceFieldId);
    chips.push({
      key: 'lnk',
      icon: Link,
      text: <>Filled from <b>{source?.label || 'another question'}</b></>,
      clear: { fieldLinking: undefined },
      tab: 'advanced',
    });
  }

  if (field.alerts?.length) {
    const first = field.alerts[0].message;
    chips.push({
      key: 'alr',
      icon: AlertCircle,
      text: <>Shows a message: <b>{first.length > 42 ? `${first.slice(0, 42)}…` : first}</b>{field.alerts.length > 1 ? <> +{field.alerts.length - 1}</> : null}</>,
      clear: { alerts: undefined },
      tab: 'advanced',
    });
  }

  if (field.supportDocuments?.length) {
    const first = field.supportDocuments[0].label;
    chips.push({
      key: 'doc',
      icon: FileText,
      text: <><b>{first}</b> attached{field.supportDocuments.length > 1 ? <> +{field.supportDocuments.length - 1}</> : null}</>,
      clear: { supportDocuments: undefined },
      tab: 'advanced',
    });
  }

  if (field.fileConfig && (field.fileConfig.accept?.length || field.fileConfig.maxSize)) {
    chips.push({
      key: 'file',
      icon: FileUp,
      text: <>Accepts <b>{field.fileConfig.accept?.length ? field.fileConfig.accept.join(', ') : 'any allowed type'}</b>, up to <b>{Math.round((field.fileConfig.maxSize ?? 5242880) / 1048576)} MB</b></>,
      clear: { fileConfig: undefined },
      tab: 'validation',
    });
  }

  if (field.tableConfig?.columns?.length) {
    chips.push({
      key: 'tbl',
      icon: FileSpreadsheet,
      text: <><b>{field.tableConfig.columns.length} column{field.tableConfig.columns.length === 1 ? '' : 's'}</b> configured</>,
      clear: { tableConfig: undefined },
      tab: 'advanced',
    });
  }

  if (formType === 'voting' && field.isPollQuestion) {
    chips.push({ key: 'poll', icon: BarChart2, text: <><b>Counted in the poll</b></>, clear: { isPollQuestion: false }, tab: 'advanced' });
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
      tab: 'advanced',
    });
  }

  return chips;
}

/* ---------------------------------------------------------------------------
 * The card: collapsed = the question at a glance; open = the field editor
 * ------------------------------------------------------------------------- */
export default function QuestionCard({
  field, index, isSelected, allFields, variables, formType,
  onOpenModal, onDelete, onDuplicate, className,
}: QuestionCardProps) {
  const dispatch = useAppDispatch();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });

  const open = isSelected;
  const [editorTab, setEditorTab] = useState<FieldEditorTab | null>(null);
  const rules = rulesFor(field, allFields, formType);

  /** A rule chip opens this question's editor on the tab that owns the rule. */
  const openOnTab = (tab: FieldEditorTab) => {
    if (!open) dispatch(selectField(field.id));
    setEditorTab(tab);
    document.getElementById(`q-${field.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const onUpdateField = (id: string, updates: Partial<FormField>) =>
    dispatch(updateField({ id, updates }));

  const dragHandle = (extra: string) => (
    <button
      {...listeners}
      className={cn(
        'flex h-7 w-6 flex-none cursor-grab items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground active:cursor-grabbing',
        extra
      )}
      aria-label="Drag to reorder"
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

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
          ? 'z-10 border-primary/70 shadow-[0_6px_18px_rgba(15,23,42,0.07)]'
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
      {open ? (
        /* Expanded — the tabbed field editor (v2 §3.3) */
        <div className="flex">
          <div className="flex w-8 shrink-0 flex-col items-center self-stretch border-r border-border/60 pt-3">
            {dragHandle('')}
          </div>
          <FieldEditor
            field={field}
            initialTab={editorTab ?? undefined}
            allFields={allFields}
            variables={variables}
            formType={formType}
            onOpenModal={onOpenModal}
            onUpdateField={onUpdateField}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onClose={() => dispatch(selectField(null))}
          />
        </div>
      ) : (
        /* Collapsed — the question as a glance (v2 §3.3) */
        <>
          <div className="flex items-start gap-1 px-2 py-2.5">
            {dragHandle('mt-0.5')}

            <div className="min-w-0 flex-1 pr-1">
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
                  <span className="max-w-[220px] truncate text-[11px] text-muted-foreground">{field.placeholder}</span>
                )}
                {field.width && field.width !== 'full' && (
                  <span className="rounded border border-border bg-muted/50 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {field.width === 'half' ? '50%' : '33%'}
                  </span>
                )}
              </div>
              <div className="mt-2.5">
                <LiveControl field={field} variables={variables} variant="compact" />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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

          {rules.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-5 pb-3 pt-1">
              {rules.map(({ key, icon: Icon, text, clear, tab }) => (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); openOnTab(tab); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      openOnTab(tab);
                    }
                  }}
                  title={`Edit — ${tab === 'validation' ? 'Validation' : 'Advanced'}`}
                  className="group/chip inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md border border-border bg-ink-50/70 px-2 py-1 text-[11px] leading-snug text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/50 hover:text-foreground"
                >
                  <Icon className="h-3 w-3 flex-none text-ink-400 transition-colors group-hover/chip:text-primary" />
                  <span className="min-w-0 truncate [&_b]:font-medium [&_b]:text-foreground/80">{text}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onUpdateField(field.id, clear); }}
                    className="text-ink-300 opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover/chip:opacity-100"
                    title="Remove this rule"
                    aria-label="Remove rule"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
