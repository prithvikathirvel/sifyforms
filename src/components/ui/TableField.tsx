import { useEffect, useCallback } from 'react';
import { Button } from './button';
import { Input } from './input';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { FormField, TableColumn, TableNamedRow, ShowCondition, ShowWhenRule, ShowWhenNode } from '../../types';
import { isShowWhenGroup } from '../../types';
import { ALL_FORMULA_FUNCS, FORMULA_FUNC_NAMES } from '../builder/TableConfigModal';

interface TableRow {
  _id: string;
  [colId: string]: string | number;
}

interface TableFieldProps {
  field: FormField;
  value?: { rows: TableRow[] };
  onChange: (value: { rows: TableRow[] }) => void;
  disabled?: boolean;
  formValues?: Record<string, unknown>;
  /** Consolidated table validation errors shown below the table */
  validationErrors?: string[];
}

// Finding 5: resolve effective type, defaulting to 'text' when omitted
function colType(col: TableColumn): 'text' | 'number' | 'select' | 'calculated' | 'date' {
  return col.type || 'text';
}

function evaluateFormula(formula: string, row: TableRow, columns: TableColumn[]): number {
  try {
    const colMap = new Map(columns.map((c) => [c.id, c]));
    const expr = formula.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (match) => {
      if (FORMULA_FUNC_NAMES.has(match)) return match;
      const col = colMap.get(match);
      if (!col) return '0';
      const raw = row[match];
      if (colType(col) === 'date') return `'${String(raw ?? '')}'`;
      const v = Number(raw);
      return isNaN(v) ? '0' : String(v);
    });
    // eslint-disable-next-line no-new-func
    const fn = new Function(...Object.keys(ALL_FORMULA_FUNCS), `return (${expr})`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = fn(...Object.values(ALL_FORMULA_FUNCS));
    return typeof result === 'number' && isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

function formatValue(value: number, col: TableColumn): string {
  const num = col.decimals !== undefined ? value.toFixed(col.decimals) : String(value);
  return `${col.prefix ?? ''}${num}${col.suffix ?? ''}`;
}

function makeEmptyRow(columns: TableColumn[]): TableRow {
  const row: TableRow = { _id: crypto.randomUUID() };
  columns.forEach((col) => {
    if (colType(col) !== 'calculated') {
      row[col.id] = colType(col) === 'number' ? 0 : '';
    }
  });
  return row;
}

// Finding 6: seed a named row — only include its active column ids
function makeEmptyNamedRow(namedRow: TableNamedRow, allColumns: TableColumn[]): TableRow {
  const row: TableRow = { _id: namedRow.id };
  namedRow.columnIds.forEach((colId) => {
    const col = allColumns.find((c) => c.id === colId);
    if (col && colType(col) !== 'calculated') {
      row[colId] = colType(col) === 'number' ? 0 : '';
    }
  });
  return row;
}

function evalCondition(condition: ShowCondition, formValues: Record<string, unknown>): boolean {
  const raw = formValues[condition.fieldId];
  const fieldValue = raw !== undefined && raw !== null ? String(raw) : '';
  const condValue = condition.value !== undefined ? String(condition.value) : '';
  switch (condition.operator) {
    case 'equals': return fieldValue === condValue;
    case 'notEquals': return fieldValue !== condValue;
    case 'contains': return fieldValue.includes(condValue);
    case 'notContains': return !fieldValue.includes(condValue);
    case 'isEmpty': return fieldValue === '' || raw === undefined || raw === null;
    case 'isNotEmpty': return fieldValue !== '' && raw !== undefined && raw !== null;
    case 'greaterThan': return Number(fieldValue) > Number(condValue);
    case 'lessThan': return Number(fieldValue) < Number(condValue);
    case 'gte': return Number(fieldValue) >= Number(condValue);
    case 'lte': return Number(fieldValue) <= Number(condValue);
    case 'in': return Array.isArray(condition.value)
      ? (condition.value as string[]).includes(fieldValue)
      : condValue.split(',').map(s => s.trim()).includes(fieldValue);
    case 'notIn': return Array.isArray(condition.value)
      ? !(condition.value as string[]).includes(fieldValue)
      : !condValue.split(',').map(s => s.trim()).includes(fieldValue);
    default: return true;
  }
}

function evalNode(node: ShowWhenNode, formValues: Record<string, unknown>): boolean {
  if (isShowWhenGroup(node)) {
    if (!node.conditions || node.conditions.length === 0) return true;
    const results = node.conditions.map((child) => evalNode(child, formValues));
    return node.logic === 'or' ? results.some(Boolean) : results.every(Boolean);
  }
  return evalCondition(node, formValues);
}

function isColumnVisible(col: TableColumn, formValues: Record<string, unknown>): boolean {
  const rule: ShowWhenRule | undefined = col.showWhen;
  if (!rule || !rule.conditions || rule.conditions.length === 0) return true;
  return evalNode(rule, formValues);
}

export default function TableField({ field, value, onChange, disabled, formValues = {}, validationErrors }: TableFieldProps) {
  const cfg = field.tableConfig;
  if (!cfg || cfg.columns.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No columns configured.</p>;
  }

  const allColumns = cfg.columns;
  const visibleColumns = allColumns.filter((col) => isColumnVisible(col, formValues));
  const namedRows = cfg.namedRows && cfg.namedRows.length > 0 ? cfg.namedRows : null;

  const rows: TableRow[] = value?.rows ?? [];

  // Seed rows on mount
  useEffect(() => {
    if (namedRows) {
      // Finding 6: seed one row per named row, preserving existing data
      const seeded = namedRows.map((nr) => {
        const existing = rows.find((r) => r._id === nr.id);
        return existing ?? makeEmptyNamedRow(nr, allColumns);
      });
      // Only update if something is missing
      if (seeded.some((r) => !rows.find((ex) => ex._id === r._id))) {
        onChange({ rows: seeded });
      }
    } else if (rows.length === 0 && (cfg.defaultRows ?? 1) > 0) {
      const initial = Array.from({ length: cfg.defaultRows ?? 1 }, () => makeEmptyRow(allColumns));
      onChange({ rows: initial });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCell = useCallback(
    (rowIdx: number, colId: string, raw: string) => {
      const col = allColumns.find((c) => c.id === colId);
      const updated = rows.map((r, i) => {
        if (i !== rowIdx) return r;
        const cellValue = colType(col!) === 'number' ? (raw === '' ? 0 : Number(raw)) : raw;
        return { ...r, [colId]: cellValue };
      });
      onChange({ rows: updated });
    },
    [rows, allColumns, onChange]
  );

  const addRow = useCallback(() => {
    onChange({ rows: [...rows, makeEmptyRow(allColumns)] });
  }, [rows, allColumns, onChange]);

  const removeRow = useCallback(
    (idx: number) => { onChange({ rows: rows.filter((_, i) => i !== idx) }); },
    [rows, onChange]
  );

  const grandTotalColId = cfg.grandTotalColumn;
  const grandTotalCol = grandTotalColId ? visibleColumns.find((c) => c.id === grandTotalColId) : undefined;
  const grandTotal = grandTotalCol
    ? rows.reduce((sum, row) => {
        const v = colType(grandTotalCol) === 'calculated'
          ? evaluateFormula(grandTotalCol.formula ?? '', row, allColumns)
          : Number(row[grandTotalColId!]);
        return sum + (isNaN(v) ? 0 : v);
      }, 0)
    : null;

  const COL_MIN_WIDTH: Record<string, string> = {
    text: '120px', number: '100px', date: '150px', select: '130px', calculated: '110px',
  };

  // Finding 6: whether a given column is active for a named row
  const isActiveCell = (namedRow: TableNamedRow | null, colId: string): boolean => {
    if (!namedRow) return true;
    return namedRow.columnIds.includes(colId);
  };

  const allowAdd = !namedRows && !disabled && (cfg.allowAddRows ?? false);
  const allowDelete = !namedRows && !disabled && (cfg.allowAddRows ?? false);

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto rounded-md border border-input">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-input">
              {/* Finding 6: row-label column header when namedRows exist */}
              {namedRows && (
                <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground whitespace-nowrap" style={{ minWidth: '110px' }} />
              )}
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  className="px-3 py-2 text-left font-medium text-xs text-muted-foreground whitespace-nowrap"
                  style={{ width: col.width ?? undefined, minWidth: col.width ?? COL_MIN_WIDTH[colType(col)] ?? '100px' }}
                >
                  <span>{col.label}</span>
                  {col.required && <span className="text-destructive ml-0.5">*</span>}
                  {col.helpText && (
                    <p className="text-[10px] font-normal text-muted-foreground/70 mt-0.5">{col.helpText}</p>
                  )}
                </th>
              ))}
              {allowDelete && rows.length > 0 && (
                <th className="px-2 py-2" style={{ minWidth: '40px', width: '40px' }} />
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              // Finding 6: find which namedRow config corresponds to this data row
              const namedRowCfg = namedRows ? (namedRows.find((nr) => nr.id === row._id) ?? null) : null;

              return (
                <tr key={row._id} className="border-b border-input last:border-0 hover:bg-muted/20">
                  {/* Finding 6: row label cell */}
                  {namedRows && (
                    <td className="px-3 py-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap bg-muted/30">
                      {namedRowCfg?.label ?? ''}
                    </td>
                  )}

                  {visibleColumns.map((col) => {
                    // Finding 6: inactive cell for this row → locked empty cell
                    if (!isActiveCell(namedRowCfg, col.id)) {
                      return (
                        <td key={col.id} className="px-3 py-1.5">
                          <div className="h-8 rounded-md bg-muted/60 border border-dashed border-muted-foreground/20" />
                        </td>
                      );
                    }

                    if (colType(col) === 'calculated') {
                      const val = evaluateFormula(col.formula ?? '', row, allColumns);
                      return (
                        <td key={col.id} className="px-3 py-1.5">
                          <span className="text-sm font-medium">{formatValue(val, col)}</span>
                        </td>
                      );
                    }
                    if (colType(col) === 'date') {
                      return (
                        <td key={col.id} className="px-3 py-1.5">
                          <Input disabled={disabled} type="date" value={String(row[col.id] ?? '')}
                            onChange={(e) => updateCell(rowIdx, col.id, e.target.value)} className="h-8 text-xs" />
                        </td>
                      );
                    }
                    if (colType(col) === 'select') {
                      return (
                        <td key={col.id} className="px-3 py-1.5">
                          <select disabled={disabled} value={String(row[col.id] ?? '')}
                            onChange={(e) => updateCell(rowIdx, col.id, e.target.value)}
                            className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50">
                            <option value="">{col.placeholder ?? 'Select…'}</option>
                            {(col.options ?? []).map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                      );
                    }
                    if (colType(col) === 'number') {
                      return (
                        <td key={col.id} className="px-3 py-1.5">
                          <div className="flex items-center gap-1">
                            {col.prefix && <span className="text-xs text-muted-foreground shrink-0">{col.prefix}</span>}
                            <Input disabled={disabled} type="number" value={String(row[col.id] ?? '')}
                              placeholder={col.placeholder}
                              step={col.decimals !== undefined ? Math.pow(10, -col.decimals) : 'any'}
                              onChange={(e) => updateCell(rowIdx, col.id, e.target.value)} className="h-8 text-xs" />
                            {col.suffix && <span className="text-xs text-muted-foreground shrink-0">{col.suffix}</span>}
                          </div>
                        </td>
                      );
                    }
                    // Default: text (Finding 5 — label-only column falls here)
                    return (
                      <td key={col.id} className="px-3 py-1.5">
                        <Input disabled={disabled} type="text" value={String(row[col.id] ?? '')}
                          placeholder={col.placeholder}
                          onChange={(e) => updateCell(rowIdx, col.id, e.target.value)} className="h-8 text-xs" />
                      </td>
                    );
                  })}

                  {allowDelete && (
                    <td className="px-2 py-1.5">
                      <Button type="button" variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(rowIdx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumns.length + (namedRows ? 1 : 0) + (allowDelete ? 1 : 0)}
                  className="px-3 py-4 text-center text-xs text-muted-foreground"
                >
                  No rows yet.
                </td>
              </tr>
            )}
          </tbody>

          {grandTotal !== null && grandTotalCol && (
            <tfoot>
              <tr className="bg-muted/50 border-t border-input">
                {namedRows && <td className="px-3 py-2 text-xs font-semibold">{cfg.grandTotalLabel || 'Grand Total'}</td>}
                {visibleColumns.map((col, idx) => (
                  <td key={col.id} className="px-3 py-2 text-xs font-semibold">
                    {!namedRows && idx === 0
                      ? (cfg.grandTotalLabel || 'Grand Total')
                      : col.id === grandTotalColId
                      ? formatValue(grandTotal, grandTotalCol)
                      : ''}
                  </td>
                ))}
                {allowDelete && <td />}
              </tr>
            </tfoot>
          )}
        </table>

        {allowAdd && (
          <div className="p-2 border-t border-input">
            <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 text-xs gap-1">
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </Button>
          </div>
        )}
      </div>

      {/* Table validation error panel */}
      {validationErrors && validationErrors.length > 0 && (
        <div className="space-y-1">
          {validationErrors.map((msg, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
