import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, Trash2, X, Table, Shield, Eye, EyeOff, Link, AlertCircle, Settings, GripVertical } from 'lucide-react';
import type { FormField, TableColumn, TableConfig, FormVariable, ShowConditionOperator } from '../../types';
import { ValidationModal } from './ValidationModal';
import { ConditionalVisibilityModal } from './ConditionalVisibilityModal';
import { AdvancedLinkingModal } from './AdvancedLinkingModal';
import { CustomAlertModal } from './CustomAlertModal';

interface TableConfigModalProps {
  field: FormField;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
  allFields?: FormField[];
  variables?: FormVariable[];
}

function emptyConfig(): TableConfig {
  return { columns: [], defaultRows: 1, allowAddRows: true };
}

// ─── Formula engine (shared with TableField) ────────────────────────────────

/** Parse a date string, return null if invalid */
function parseDate(d: string): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** All functions available inside formulas */
export const ALL_FORMULA_FUNCS: Record<string, (...args: any[]) => number> = {
  // Math
  round: (x: number, d = 0) => Math.round(x * Math.pow(10, d)) / Math.pow(10, d),
  abs: Math.abs,
  min: (...args: number[]) => Math.min(...args),
  max: (...args: number[]) => Math.max(...args),
  floor: Math.floor,
  ceil: Math.ceil,
  sqrt: Math.sqrt,
  // Date
  yearsBetween: (d1: string, d2: string) => {
    const a = parseDate(d1), b = parseDate(d2);
    if (!a || !b) return 0;
    let y = b.getFullYear() - a.getFullYear();
    const m = b.getMonth() - a.getMonth();
    if (m < 0 || (m === 0 && b.getDate() < a.getDate())) y--;
    return y;
  },
  monthsBetween: (d1: string, d2: string) => {
    const a = parseDate(d1), b = parseDate(d2);
    if (!a || !b) return 0;
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  },
  daysBetween: (d1: string, d2: string) => {
    const a = parseDate(d1), b = parseDate(d2);
    if (!a || !b) return 0;
    return Math.floor((b.getTime() - a.getTime()) / 86400000);
  },
  ageInYears: (dob: string) => {
    const a = parseDate(dob), b = new Date();
    if (!a) return 0;
    let y = b.getFullYear() - a.getFullYear();
    const m = b.getMonth() - a.getMonth();
    if (m < 0 || (m === 0 && b.getDate() < a.getDate())) y--;
    return y;
  },
};
export const FORMULA_FUNC_NAMES = new Set(Object.keys(ALL_FORMULA_FUNCS));

/** Build a formula expression with column values substituted */
function buildExpr(formula: string, columns: TableColumn[], row: Record<string, string | number>): string {
  const colMap = new Map(columns.map((c) => [c.id, c]));
  return formula.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (match) => {
    if (FORMULA_FUNC_NAMES.has(match)) return match;
    const col = colMap.get(match);
    if (!col) return '0';
    const raw = row[match];
    if (col.type === 'date') return `'${String(raw ?? '')}'`;
    const v = Number(raw);
    return isNaN(v) ? '0' : String(v);
  });
}

function FormulaPreview({ formula, columns }: { formula: string; columns: TableColumn[] }) {
  if (!formula.trim()) return null;
  try {
    // Use dummy values: numbers = 1, dates = today
    const today = new Date().toISOString().split('T')[0];
    const dummyRow: Record<string, string | number> = {};
    columns.filter((c) => c.type !== 'calculated').forEach((c) => {
      dummyRow[c.id] = c.type === 'date' ? today : 1;
    });
    const expr = buildExpr(formula, columns, dummyRow);
    const fn = new Function(...Object.keys(ALL_FORMULA_FUNCS), `return (${expr})`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = fn(...Object.values(ALL_FORMULA_FUNCS));
    if (typeof result === 'number' && isFinite(result)) {
      return (
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
          Preview: <span className="font-mono font-bold">{result}</span>
        </p>
      );
    }
    return <p className="text-[10px] text-destructive">Formula returned a non-numeric result</p>;
  } catch {
    return <p className="text-[10px] text-destructive">Invalid formula expression</p>;
  }
}

const OPERATORS = ['+', '-', '*', '/', '(', ')'];
const MATH_FUNCTIONS: { label: string; insert: string }[] = [
  { label: 'round(x, 2)', insert: 'round(' },
  { label: 'abs(x)', insert: 'abs(' },
  { label: 'min(x, y)', insert: 'min(' },
  { label: 'max(x, y)', insert: 'max(' },
  { label: 'floor(x)', insert: 'floor(' },
  { label: 'ceil(x)', insert: 'ceil(' },
  { label: 'sqrt(x)', insert: 'sqrt(' },
];
const DATE_FUNCTIONS: { label: string; insert: string; desc: string }[] = [
  { label: 'yearsBetween(start, end)', insert: 'yearsBetween(', desc: 'Full years between two date columns' },
  { label: 'monthsBetween(start, end)', insert: 'monthsBetween(', desc: 'Total months between two date columns' },
  { label: 'daysBetween(start, end)', insert: 'daysBetween(', desc: 'Total days between two date columns' },
  { label: 'ageInYears(dob)', insert: 'ageInYears(', desc: 'Age in years from a date-of-birth column to today' },
];

const SHOW_OPERATORS: { value: ShowConditionOperator; label: string; needsValue?: boolean }[] = [
  { value: 'equals', label: 'equals', needsValue: true },
  { value: 'notEquals', label: 'not equals', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'notContains', label: 'does not contain', needsValue: true },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
  { value: 'greaterThan', label: 'greater than', needsValue: true },
  { value: 'lessThan', label: 'less than', needsValue: true },
  { value: 'gte', label: '≥ (gte)', needsValue: true },
  { value: 'lte', label: '≤ (lte)', needsValue: true },
  { value: 'in', label: 'is one of', needsValue: true },
  { value: 'notIn', label: 'is not one of', needsValue: true },
];

/** Cast a TableColumn to FormField shape so existing modals can consume it */
function columnAsFormField(col: TableColumn): FormField {
  return {
    id: col.id,
    label: col.label,
    type: col.type === 'calculated' ? 'number' : col.type,
    placeholder: col.placeholder,
    helpText: col.helpText,
    required: col.required,
    options: col.options,
    rules: col.rules,
    showWhen: col.showWhen,
    fieldLinking: col.fieldLinking as FormField['fieldLinking'],
    alerts: col.alerts,
  } as FormField;
}

/** Merge updates from a modal back into a TableColumn */
function applyFormFieldUpdates(col: TableColumn, updates: Partial<FormField>): TableColumn {
  const { rules, showWhen, fieldLinking, alerts, placeholder, helpText, required, options } = updates;
  return {
    ...col,
    ...(rules !== undefined && { rules }),
    ...(showWhen !== undefined && { showWhen }),
    ...(fieldLinking !== undefined && { fieldLinking: fieldLinking as TableColumn['fieldLinking'] }),
    ...(alerts !== undefined && { alerts }),
    ...(placeholder !== undefined && { placeholder }),
    ...(helpText !== undefined && { helpText }),
    ...(required !== undefined && { required }),
    ...(options !== undefined && { options }),
  };
}

interface ColumnInspectorProps {
  col: TableColumn;
  allColumns: TableColumn[];
  allFields: FormField[];
  variables: FormVariable[];
  onUpdate: (patch: Partial<TableColumn>) => void;
}

function ColumnInspector({ col, allColumns, allFields, variables, onUpdate }: ColumnInspectorProps) {
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showLinkingModal, setShowLinkingModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  const nonCalcCols = allColumns.filter((c) => c.type !== 'calculated');

  const appendToFormula = (text: string) => {
    onUpdate({ formula: (col.formula ?? '') + text });
  };

  const addOption = () => {
    const opts = [...(col.options ?? [])];
    opts.push({ label: `Option ${opts.length + 1}`, value: `opt${opts.length + 1}` });
    onUpdate({ options: opts });
  };

  const removeOption = (oi: number) => {
    onUpdate({ options: (col.options ?? []).filter((_, i) => i !== oi) });
  };

  const updateOption = (oi: number, patch: { label?: string; value?: string }) => {
    onUpdate({ options: (col.options ?? []).map((o, i) => (i === oi ? { ...o, ...patch } : o)) });
  };

  const colAsField = columnAsFormField(col);

  return (
    <div className="flex flex-col h-full overflow-y-auto space-y-4 pr-1">

      {/* Basic Settings */}
      <div className="space-y-3 rounded-lg border border-input p-4 bg-muted/10">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Basic Settings</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input
              value={col.label}
              placeholder="Column label"
              className="h-8 text-sm"
              onChange={(e) => onUpdate({ label: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <select
              value={col.type}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              onChange={(e) => onUpdate({ type: e.target.value as TableColumn['type'] })}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Dropdown</option>
              <option value="calculated">Calculated</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Placeholder</Label>
            <Input
              value={col.placeholder ?? ''}
              placeholder="Hint text..."
              className="h-8 text-sm"
              onChange={(e) => onUpdate({ placeholder: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Width</Label>
            <Input
              value={col.width ?? ''}
              placeholder="150px or 20%"
              className="h-8 text-sm"
              onChange={(e) => onUpdate({ width: e.target.value || undefined })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Help Text</Label>
          <Input
            value={col.helpText ?? ''}
            placeholder="Shown below the column header..."
            className="h-8 text-sm"
            onChange={(e) => onUpdate({ helpText: e.target.value || undefined })}
          />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={col.required ?? false}
            className="h-4 w-4 rounded"
            onChange={(e) => onUpdate({ required: e.target.checked || undefined })}
          />
          Required field
        </label>
      </div>

      {/* Number Format */}
      {(col.type === 'number' || col.type === 'calculated') && (
        <div className="space-y-2 rounded-lg border border-input p-4 bg-muted/10">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Number Format</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">Decimals</Label>
              <Input
                type="number" min={0} max={10}
                value={col.decimals ?? ''}
                placeholder="auto"
                className="h-8 text-sm"
                onChange={(e) => onUpdate({ decimals: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">Prefix</Label>
              <Input
                value={col.prefix ?? ''}
                placeholder="$"
                className="h-8 text-sm"
                onChange={(e) => onUpdate({ prefix: e.target.value || undefined })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">Suffix</Label>
              <Input
                value={col.suffix ?? ''}
                placeholder="%"
                className="h-8 text-sm"
                onChange={(e) => onUpdate({ suffix: e.target.value || undefined })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Calculated — Formula Builder */}
      {col.type === 'calculated' && (
        <div className="space-y-3 rounded-lg border border-input p-4 bg-muted/10">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Formula Builder</p>

          {/* Column chips — colour-coded by type */}
          {nonCalcCols.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">Click a column to insert its ID:</p>
              <div className="flex flex-wrap gap-1">
                {nonCalcCols.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={`${c.type} · ID: ${c.id}`}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono transition-colors ${
                      c.type === 'date'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-plum-100 text-plum-700 hover:bg-plum-200 dark:bg-plum-900/40 dark:text-plum-300'
                    }`}
                    onClick={() => appendToFormula(c.id)}
                  >
                    {c.label}
                    {c.type === 'date' && <span className="ml-1 opacity-60">📅</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Operators */}
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">Operators:</p>
            <div className="flex flex-wrap gap-1">
              {OPERATORS.map((op) => (
                <button
                  key={op}
                  type="button"
                  className="text-[10px] px-2 py-0.5 rounded bg-muted font-mono hover:bg-muted/60 transition-colors"
                  onClick={() => appendToFormula(op)}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>

          {/* Math Functions */}
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">Math functions:</p>
            <div className="flex flex-wrap gap-1">
              {MATH_FUNCTIONS.map((fn) => (
                <button
                  key={fn.label}
                  type="button"
                  className="text-[10px] px-2 py-0.5 rounded bg-brand-100 text-brand-700 font-mono hover:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-300 transition-colors"
                  onClick={() => appendToFormula(fn.insert)}
                >
                  {fn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Functions */}
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">Date functions <span className="text-green-600">(use green date columns as arguments)</span>:</p>
            <div className="flex flex-wrap gap-1">
              {DATE_FUNCTIONS.map((fn) => (
                <button
                  key={fn.label}
                  type="button"
                  title={fn.desc}
                  className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700 font-mono hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 transition-colors"
                  onClick={() => appendToFormula(fn.insert)}
                >
                  {fn.label}
                </button>
              ))}
            </div>
            {/* Date formula examples */}
            <div className="mt-2 rounded-md bg-green-50 border border-green-200 p-2 space-y-1">
              <p className="text-[10px] font-semibold text-green-800">Example formulas:</p>
              <ul className="space-y-1 text-[10px] text-green-700">
                <li><code className="font-mono bg-green-100 px-1 rounded">yearsBetween(startDate, endDate)</code> — years between two date columns</li>
                <li><code className="font-mono bg-green-100 px-1 rounded">monthsBetween(startDate, endDate)</code> — total months between two date columns</li>
                <li><code className="font-mono bg-green-100 px-1 rounded">daysBetween(startDate, endDate)</code> — total days between two date columns</li>
                <li><code className="font-mono bg-green-100 px-1 rounded">ageInYears(dob)</code> — age calculated from a date-of-birth column to today</li>
                <li><code className="font-mono bg-green-100 px-1 rounded">floor(monthsBetween(start, end) / 12)</code> — complete years (floor)</li>
                <li><code className="font-mono bg-green-100 px-1 rounded">monthsBetween(start, end) - (yearsBetween(start, end) * 12)</code> — remaining months</li>
              </ul>
            </div>
          </div>

          {/* Expression input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground uppercase">Expression</Label>
              {col.formula && (
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={() => onUpdate({ formula: '' })}
                >
                  Clear
                </button>
              )}
            </div>
            <Input
              value={col.formula ?? ''}
              placeholder="e.g. qty * rate   or   yearsBetween(startDate, endDate)"
              className="h-9 text-sm font-mono"
              onChange={(e) => onUpdate({ formula: e.target.value })}
            />
            <FormulaPreview formula={col.formula ?? ''} columns={allColumns} />
          </div>
        </div>
      )}

      {/* Select Options */}
      {col.type === 'select' && (
        <div className="space-y-2 rounded-lg border border-input p-4 bg-muted/10">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Options</p>
          <div className="space-y-1.5">
            {(col.options ?? []).map((opt, oi) => (
              <div key={oi} className="flex gap-2">
                <Input
                  value={opt.label}
                  placeholder="Label"
                  className="flex-1 h-7 text-xs"
                  onChange={(e) => updateOption(oi, { label: e.target.value })}
                />
                <Input
                  value={opt.value}
                  placeholder="Value"
                  className="flex-1 h-7 text-xs"
                  onChange={(e) => updateOption(oi, { value: e.target.value })}
                />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => removeOption(oi)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addOption}>
              <Plus className="h-3 w-3 mr-1" /> Add Option
            </Button>
          </div>
        </div>
      )}

      {/* Constraints & Defaults */}
      {col.type && ['text', 'number', 'date'].includes(col.type) && (
        <div className="space-y-3 rounded-lg border border-input p-4 bg-muted/10">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Constraints &amp; Default</p>

          {/* Default Value */}
          <div className="space-y-1">
            <Label className="text-xs">Default Value</Label>
            <Input
              type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
              value={col.defaultValue ?? ''}
              placeholder="Pre-filled when a new row is added"
              className="h-8 text-sm"
              onChange={(e) => onUpdate({ defaultValue: e.target.value || undefined })}
            />
          </div>

          {/* Text constraints */}
          {col.type === 'text' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Min Length</Label>
                <Input
                  type="number" min={0}
                  value={col.validation?.minLength ?? ''}
                  placeholder="No min"
                  className="h-8 text-sm"
                  onChange={(e) => onUpdate({ validation: { ...col.validation, minLength: e.target.value ? Number(e.target.value) : undefined } })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Length</Label>
                <Input
                  type="number" min={1}
                  value={col.validation?.maxLength ?? ''}
                  placeholder="No max"
                  className="h-8 text-sm"
                  onChange={(e) => onUpdate({ validation: { ...col.validation, maxLength: e.target.value ? Number(e.target.value) : undefined } })}
                />
              </div>
            </div>
          )}

          {/* Number constraints */}
          {col.type === 'number' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Min Value</Label>
                <Input
                  type="number" step="any"
                  value={col.validation?.min ?? ''}
                  placeholder="No min"
                  className="h-8 text-sm"
                  onChange={(e) => onUpdate({ validation: { ...col.validation, min: e.target.value ? Number(e.target.value) : undefined } })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Value</Label>
                <Input
                  type="number" step="any"
                  value={col.validation?.max ?? ''}
                  placeholder="No max"
                  className="h-8 text-sm"
                  onChange={(e) => onUpdate({ validation: { ...col.validation, max: e.target.value ? Number(e.target.value) : undefined } })}
                />
              </div>
            </div>
          )}

          {/* Date constraints */}
          {col.type === 'date' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Min Date</Label>
                <Input
                  type="date"
                  value={col.minValue ?? ''}
                  className="h-8 text-sm"
                  onChange={(e) => onUpdate({ minValue: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Date</Label>
                <Input
                  type="date"
                  value={col.maxValue ?? ''}
                  className="h-8 text-sm"
                  onChange={(e) => onUpdate({ maxValue: e.target.value || undefined })}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Advanced capabilities (same as normal fields) ── */}

      {/* Input Validation */}
      <div className="rounded-lg border border-input p-4 bg-muted/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-600" />
            <div>
              <p className="text-sm font-medium">Input Validation</p>
              <p className="text-[10px] text-muted-foreground">
                {col.rules && col.rules.length > 0 ? `${col.rules.length} rule(s) active` : 'No validation rules'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 border-brand-200"
            onClick={() => setShowValidationModal(true)}
          >
            Configure
          </Button>
        </div>
        {col.rules && col.rules.length > 0 && (
          <ul className="list-disc pl-4 text-[10px] text-muted-foreground space-y-0.5">
            {col.rules.map((r, i) => (
              <li key={r.id || i}>{r.type}{r.value !== undefined ? `: ${r.value}` : ''}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Conditional Visibility */}
      <div className="rounded-lg border border-input p-4 bg-muted/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {col.showWhen?.conditions?.length ? <Eye className="h-4 w-4 text-brand-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium">Conditional Visibility</p>
              <p className="text-[10px] text-muted-foreground">
                {col.showWhen?.conditions?.length
                  ? `Visible when ${col.showWhen.conditions.length} condition(s) match`
                  : 'Always visible'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 border-brand-200"
            onClick={() => setShowVisibilityModal(true)}
          >
            Configure
          </Button>
        </div>
      </div>

      {/* Smart Connections */}
      <div className="rounded-lg border border-input p-4 bg-muted/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link className="h-4 w-4 text-brand-600" />
            <div>
              <p className="text-sm font-medium">Smart Connections</p>
              <p className="text-[10px] text-muted-foreground">
                {col.fieldLinking?.enabled
                  ? `Connected to field`
                  : 'Auto-fill or restrict based on other fields'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowLinkingModal(true)}
          >
            <Settings className="h-3 w-3 mr-1" />
            Configure
          </Button>
        </div>
        {col.fieldLinking?.enabled && (
          <p className="text-[10px] text-brand-700 bg-brand-50 px-2 py-1 rounded">
            Active — mode: {col.fieldLinking.mode || 'basic'}
          </p>
        )}
      </div>

      {/* Custom Alerts */}
      <div className="rounded-lg border border-input p-4 bg-muted/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-sm font-medium">Custom Alerts</p>
              <p className="text-[10px] text-muted-foreground">
                {col.alerts?.length ? `${col.alerts.length} alert(s)` : 'No alerts configured'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowAlertModal(true)}
          >
            Configure
          </Button>
        </div>
      </div>

      {/* Modals */}
      <ValidationModal
        field={colAsField}
        otherFields={allFields}
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        onUpdate={(updates) => onUpdate(applyFormFieldUpdates(col, updates) as Partial<TableColumn>)}
      />
      <ConditionalVisibilityModal
        field={colAsField}
        otherFields={allFields}
        isOpen={showVisibilityModal}
        onClose={() => setShowVisibilityModal(false)}
        onUpdate={(updates) => onUpdate(applyFormFieldUpdates(col, updates) as Partial<TableColumn>)}
        operators={SHOW_OPERATORS}
      />
      <AdvancedLinkingModal
        field={colAsField}
        otherFields={allFields}
        variables={variables}
        isOpen={showLinkingModal}
        onClose={() => setShowLinkingModal(false)}
        onUpdate={(updates) => onUpdate(applyFormFieldUpdates(col, updates) as Partial<TableColumn>)}
      />
      <CustomAlertModal
        field={colAsField}
        otherFields={allFields}
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        onUpdate={(updates) => onUpdate(applyFormFieldUpdates(col, updates) as Partial<TableColumn>)}
        operators={SHOW_OPERATORS}
      />
    </div>
  );
}

export function TableConfigModal({ field, isOpen, onClose, onUpdate, allFields = [], variables = [] }: TableConfigModalProps) {
  const [cfg, setCfg] = useState<TableConfig>(() => ({
    ...emptyConfig(),
    ...field.tableConfig,
    columns: (field.tableConfig?.columns ?? []).map((c) => ({ ...c })),
  }));
  const [selectedColId, setSelectedColId] = useState<string | null>(
    () => field.tableConfig?.columns?.[0]?.id ?? null
  );

  const updateCols = (cols: TableColumn[]) => setCfg((prev) => ({ ...prev, columns: cols }));

  // Named rows helpers
  const addNamedRow = () => {
    const id = `row_${Date.now()}`;
    const newRow = { id, label: `Row ${(cfg.namedRows?.length ?? 0) + 1}`, columnIds: cfg.columns.map((c) => c.id) };
    setCfg((prev) => ({ ...prev, namedRows: [...(prev.namedRows ?? []), newRow] }));
  };
  const removeNamedRow = (id: string) =>
    setCfg((prev) => ({ ...prev, namedRows: (prev.namedRows ?? []).filter((r) => r.id !== id) }));
  const updateNamedRow = (id: string, patch: Partial<{ label: string; columnIds: string[] }>) =>
    setCfg((prev) => ({
      ...prev,
      namedRows: (prev.namedRows ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));

  const addColumn = () => {
    const id = `col${Date.now()}`;
    const newCol: TableColumn = { id, label: `Column ${cfg.columns.length + 1}`, type: 'text' };
    updateCols([...cfg.columns, newCol]);
    setSelectedColId(id);
  };

  const removeColumn = (id: string) => {
    const remaining = cfg.columns.filter((c) => c.id !== id);
    updateCols(remaining);
    if (selectedColId === id) {
      setSelectedColId(remaining[0]?.id ?? null);
    }
  };

  const updateColumn = (id: string, patch: Partial<TableColumn>) => {
    updateCols(cfg.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handleSave = () => {
    onUpdate({ tableConfig: cfg });
    onClose();
  };

  const selectedCol = cfg.columns.find((c) => c.id === selectedColId) ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex h-[min(46rem,90dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card p-0 shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary">
              <Table className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Table configuration</h2>
              <p className="mt-0.5 text-xs font-medium leading-5 text-muted-foreground">
                Configure columns with validation, smart connections, and conditional visibility.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 gap-4 p-5">
          {/* Left: Column list */}
          <div className="w-56 shrink-0 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Columns</Label>
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={addColumn}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {cfg.columns.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic px-1">No columns yet.</p>
              )}
              {cfg.columns.map((col) => (
                <div
                  key={col.id}
                  onClick={() => setSelectedColId(col.id)}
                  className={`group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer border transition-colors ${
                    selectedColId === col.id
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'border-transparent hover:bg-muted/50'
                  }`}
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{col.label}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{col.type}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={(e) => { e.stopPropagation(); removeColumn(col.id); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Row settings */}
            <div className="border-t pt-3 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Row Settings</p>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Default Rows</Label>
                <Input
                  type="number"
                  min={0}
                  value={cfg.defaultRows ?? 1}
                  className="h-7 text-xs"
                  onChange={(e) => setCfg((prev) => ({ ...prev, defaultRows: Math.max(0, Number(e.target.value)) }))}
                />
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cfg.allowAddRows ?? true}
                  className="h-3.5 w-3.5 rounded"
                  onChange={(e) => setCfg((prev) => ({ ...prev, allowAddRows: e.target.checked }))}
                />
                Allow adding rows
              </label>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Grand Total Column</Label>
                <select
                  className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs"
                  value={cfg.grandTotalColumn ?? ''}
                  onChange={(e) => setCfg((prev) => ({ ...prev, grandTotalColumn: e.target.value || undefined }))}
                >
                  <option value="">None</option>
                  {cfg.columns
                    .filter((c) => c.type === 'number' || c.type === 'calculated')
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                </select>
              </div>
              {cfg.grandTotalColumn && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Grand Total Label</Label>
                  <Input
                    value={cfg.grandTotalLabel ?? ''}
                    placeholder="Grand Total"
                    className="h-7 text-xs"
                    onChange={(e) => setCfg((prev) => ({ ...prev, grandTotalLabel: e.target.value || undefined }))}
                  />
                </div>
              )}
            </div>

            {/* ── Named Rows ─────────────────────────────────────────────── */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Named Rows</p>
                <Button
                  variant="outline" size="sm" className="h-5 text-[10px] px-2 gap-1"
                  onClick={addNamedRow} disabled={cfg.columns.length === 0}
                >
                  <Plus className="h-2.5 w-2.5" /> Add
                </Button>
              </div>
              {cfg.columns.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">Add columns first.</p>
              )}
              {(cfg.namedRows ?? []).length === 0 && cfg.columns.length > 0 && (
                <p className="text-[10px] text-muted-foreground italic">No named rows — rows are dynamic.</p>
              )}
              {(cfg.namedRows ?? []).map((nr) => (
                <div key={nr.id} className="border rounded-md p-2 space-y-1.5 bg-muted/20">
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={nr.label}
                      placeholder="Row label (e.g. SSC)"
                      className="h-6 text-xs flex-1"
                      onChange={(e) => updateNamedRow(nr.id, { label: e.target.value })}
                    />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => removeNamedRow(nr.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {cfg.columns.map((col) => (
                      <label key={col.id} className="flex items-center gap-1 text-[10px] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded"
                          checked={nr.columnIds.includes(col.id)}
                          onChange={(e) => {
                            const newIds = e.target.checked
                              ? [...nr.columnIds, col.id]
                              : nr.columnIds.filter((id) => id !== col.id);
                            updateNamedRow(nr.id, { columnIds: newIds });
                          }}
                        />
                        {col.label || col.id}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {(cfg.namedRows ?? []).length > 0 && (
                <p className="text-[10px] text-muted-foreground">When named rows are set, Dynamic Row and Allow Adding Rows settings are ignored.</p>
              )}
            </div>

          </div>

          {/* Right: Column inspector */}
          <div className="flex-1 min-w-0 overflow-hidden border-l pl-4">
            {selectedCol ? (
              <ColumnInspector
                key={selectedCol.id}
                col={selectedCol}
                allColumns={cfg.columns}
                allFields={allFields}
                variables={variables}
                onUpdate={(patch) => updateColumn(selectedCol.id, patch)}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground italic">
                  {cfg.columns.length === 0
                    ? 'Add a column to get started.'
                    : 'Select a column to configure it.'}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-5 py-3.5">
          <span className="text-xs font-medium text-muted-foreground">Changes apply to this table only.</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-9 rounded-lg px-3">Cancel</Button>
            <Button size="sm" onClick={handleSave} className="h-9 rounded-lg px-3">Save configuration</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
