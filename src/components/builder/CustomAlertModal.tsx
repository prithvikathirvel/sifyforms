import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Trash2, Plus, X, MessageSquareWarning } from 'lucide-react';
import type { FormField, ShowCondition, ShowConditionOperator } from '../../types';

interface AlertRule {
    id: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    logic: 'and' | 'or';
    conditions: ShowCondition[];
}

interface CustomAlertModalProps {
    field: FormField;
    otherFields: FormField[];
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (updates: Partial<FormField>) => void;
    operators: { label: string; value: ShowConditionOperator; needsValue?: boolean }[];
}

const ALERT_TYPE_OPTIONS: { value: AlertRule['type']; label: string }[] = [
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'error', label: 'Error' },
    { value: 'success', label: 'Success' },
];

/** Small, muted accents per severity — kept subtle so the modal reads as one theme, not four. */
const ALERT_TYPE_DOT: Record<AlertRule['type'], string> = {
    info: 'bg-sky-500',
    warning: 'bg-amber-500',
    error: 'bg-destructive',
    success: 'bg-emerald-500',
};

const LOGIC_OPTIONS = [
    { value: 'and', label: 'ALL conditions match (AND)' },
    { value: 'or', label: 'ANY condition matches (OR)' },
];

const selectBaseClass = 'h-10 text-[13px] font-medium hover:border-ink-300';
const compactSelectClass = 'h-9 text-[13px] font-medium hover:border-ink-300';

export function CustomAlertModal({
    field,
    otherFields,
    isOpen,
    onClose,
    onUpdate,
    operators
}: CustomAlertModalProps) {
    const [localAlerts, setLocalAlerts] = useState<AlertRule[]>([]);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLocalAlerts(field.alerts || []);
            setSaveError(null);
        }
    }, [isOpen, field.alerts]);

    if (!isOpen) return null;

    const handleSave = () => {
        // Every alert needs a message
        const missingMessage = localAlerts.some((a) => !a.message.trim());
        if (missingMessage) {
            setSaveError('Every alert needs a message before saving.');
            return;
        }

        // Conditions that require a value must have one (prevents false triggers)
        const missingValue = localAlerts.some((a) =>
            a.conditions.some((c) => {
                const opDef = operators.find((op) => op.value === c.operator);
                if (opDef?.needsValue !== true) return false;
                return c.value === undefined || c.value === null || c.value === '';
            })
        );
        if (missingValue) {
            setSaveError('Every condition needs a value (or choose "is empty / is not empty").');
            return;
        }

        setSaveError(null);
        onUpdate({ alerts: localAlerts });
        onClose();
    };

    const addAlert = () => {
        const newAlert: AlertRule = {
            id: `alert_${Date.now()}`,
            message: '',
            type: 'warning',
            logic: 'and',
            conditions: [{
                id: `condition_${Date.now()}`,
                fieldId: field.id, // Default to self
                operator: 'equals',
                value: ''
            }]
        };
        setLocalAlerts([...localAlerts, newAlert]);
    };

    const removeAlert = (index: number) => {
        setLocalAlerts(localAlerts.filter((_, i) => i !== index));
    };

    const updateAlert = (index: number, updates: Partial<AlertRule>) => {
        const updated = [...localAlerts];
        updated[index] = { ...updated[index], ...updates };
        setLocalAlerts(updated);
    };

    const addCondition = (alertIndex: number) => {
        const updated = [...localAlerts];
        updated[alertIndex].conditions.push({
            id: `condition_${Date.now()}`,
            fieldId: field.id,
            operator: 'equals',
            value: ''
        });
        setLocalAlerts(updated);
    };

    const removeCondition = (alertIndex: number, condIndex: number) => {
        const updated = [...localAlerts];
        updated[alertIndex].conditions = updated[alertIndex].conditions.filter((_, i) => i !== condIndex);
        setLocalAlerts(updated);
    };

    const updateCondition = (alertIndex: number, condIndex: number, updates: Partial<ShowCondition>) => {
        const updated = [...localAlerts];
        updated[alertIndex].conditions[condIndex] = { ...updated[alertIndex].conditions[condIndex], ...updates };
        setLocalAlerts(updated);
    };

    const allFields = [...otherFields, field];

    const getSourceField = (fieldId: string) => allFields.find(f => f.id === fieldId);

    const renderTableColumnPicker = (cond: ShowCondition, alertIndex: number, condIndex: number) => {
        const sourceField = getSourceField(cond.fieldId);
        if (sourceField?.type !== 'table') return null;
        const columns = sourceField.tableConfig?.columns || [];
        return (
            <Select
                value={cond.tableColumnId || ''}
                onChange={(e) => updateCondition(alertIndex, condIndex, { tableColumnId: e.target.value || undefined })}
                options={columns.map(col => ({ value: col.id, label: col.label || col.id }))}
                placeholder="Any column"
                className={`w-32 shrink-0 ${compactSelectClass}`}
            />
        );
    };

    const renderConditionValueInput = (cond: ShowCondition, alertIndex: number, condIndex: number) => {
        const opDef = operators.find(op => op.value === cond.operator);
        if (!opDef?.needsValue) return null;

        const sourceField = getSourceField(cond.fieldId);

        // Table column with options (select/dropdown type column)
        if (sourceField?.type === 'table' && cond.tableColumnId) {
            const col = sourceField.tableConfig?.columns?.find(c => c.id === cond.tableColumnId);
            if (col?.type === 'select' && col.options && col.options.length > 0) {
                return (
                    <Select
                        value={String(cond.value || '')}
                        onChange={(e) => updateCondition(alertIndex, condIndex, { value: e.target.value })}
                        options={col.options.map((opt) => ({ value: opt.value, label: opt.label }))}
                        placeholder="Select value…"
                        className={`min-w-0 flex-1 ${compactSelectClass}`}
                    />
                );
            }
        }

        const hasOptions = sourceField && ['select', 'multiselect', 'radio', 'checkbox'].includes(sourceField.type) && sourceField.options && sourceField.options.length > 0;

        if (hasOptions) {
            return (
                <Select
                    value={String(cond.value || '')}
                    onChange={(e) => updateCondition(alertIndex, condIndex, { value: e.target.value })}
                    options={sourceField.options!.map((opt) => ({ value: opt.value, label: opt.label }))}
                    placeholder="Select value…"
                    className={`min-w-0 flex-1 ${compactSelectClass}`}
                />
            );
        }

        return (
            <Input
                value={String(cond.value || '')}
                onChange={(e) => updateCondition(alertIndex, condIndex, { value: e.target.value })}
                placeholder="Value…"
                className="h-8 min-w-0 flex-1 text-[12px]"
            />
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary">
                            <MessageSquareWarning className="h-4 w-4" strokeWidth={1.9} />
                        </span>
                        <div>
                            <h2 className="font-display text-base font-bold text-foreground">Custom alerts</h2>
                            <p className="mt-0.5 text-xs font-medium leading-5 text-muted-foreground">
                                Show a message to respondents when “{field.label}” meets a condition.
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/30 px-5 py-4">
                    {localAlerts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/50 text-ink-400">
                                <MessageSquareWarning className="h-5 w-5" strokeWidth={1.7} />
                            </span>
                            <p className="mt-4 text-sm font-semibold text-foreground">No alerts configured</p>
                            <p className="mt-1 max-w-xs text-xs font-medium leading-5 text-muted-foreground">
                                Add an alert to show a helpful tip or warning based on what the respondent enters.
                            </p>
                            <Button onClick={addAlert} className="mt-5 h-9 rounded-lg px-3.5">
                                <Plus className="mr-2 h-4 w-4" strokeWidth={1.9} />
                                Add first alert
                            </Button>
                        </div>
                    ) : (
                        localAlerts.map((alert, alertIndex) => (
                            <div key={alert.id} className="rounded-xl border border-border/80 bg-card shadow-sm">
                                <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${ALERT_TYPE_DOT[alert.type]}`} />
                                        <span className="text-[13px] font-semibold text-foreground">Alert {alertIndex + 1}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeAlert(alertIndex)}
                                        className="h-7 w-7 rounded-md text-muted-foreground hover:bg-destructive/[0.06] hover:text-destructive"
                                        aria-label="Remove alert"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                <div className="space-y-3 px-4 py-3">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                                        <div className="space-y-1.5 sm:col-span-1">
                                            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</Label>
                                            <Select
                                                value={alert.type}
                                                onChange={(e) => updateAlert(alertIndex, { type: e.target.value as AlertRule['type'] })}
                                                options={ALERT_TYPE_OPTIONS}
                                                className={selectBaseClass}
                                            />
                                        </div>
                                        <div className="space-y-1.5 sm:col-span-3">
                                            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Message</Label>
                                            <Input
                                                value={alert.message}
                                                onChange={(e) => updateAlert(alertIndex, { message: e.target.value })}
                                                placeholder="Enter the alert content…"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/25 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Show this alert when…</Label>
                                            <div className="flex items-center gap-2">
                                                <Select
                                                    value={alert.logic}
                                                    onChange={(e) => updateAlert(alertIndex, { logic: e.target.value as 'and' | 'or' })}
                                                    options={LOGIC_OPTIONS}
                                                    className={`w-60 max-w-full ${compactSelectClass}`}
                                                />
                                                <Button variant="ghost" size="sm" onClick={() => addCondition(alertIndex)} className="h-8 shrink-0 rounded-md px-2 text-[12px] text-primary hover:bg-primary/[0.05] hover:text-primary">
                                                    <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={1.9} /> Add condition
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {alert.conditions.map((cond, condIndex) => (
                                                <div key={cond.id} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border/70 bg-card p-2 sm:grid-cols-[minmax(13rem,1.3fr)_minmax(9rem,0.8fr)_minmax(11rem,1fr)_2rem]">
                                                    <Select
                                                        value={cond.fieldId}
                                                        onChange={(e) => updateCondition(alertIndex, condIndex, { fieldId: e.target.value, tableColumnId: undefined })}
                                                        options={[
                                                            { value: field.id, label: `This field (${field.label})` },
                                                            ...otherFields.map(f => ({ value: f.id, label: f.label })),
                                                        ]}
                                                        className={`min-w-0 ${compactSelectClass}`}
                                                    />
                                                    {renderTableColumnPicker(cond, alertIndex, condIndex)}
                                                    <Select
                                                        value={cond.operator}
                                                        onChange={(e) => updateCondition(alertIndex, condIndex, { operator: e.target.value as ShowConditionOperator })}
                                                        options={operators}
                                                        className={`min-w-0 ${compactSelectClass}`}
                                                    />
                                                    {renderConditionValueInput(cond, alertIndex, condIndex)}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeCondition(alertIndex, condIndex)}
                                                        className="h-9 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-destructive/[0.06] hover:text-destructive"
                                                        aria-label="Remove condition"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {localAlerts.length > 0 && (
                        <button
                            type="button"
                            onClick={addAlert}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary"
                        >
                            <Plus className="h-4 w-4" strokeWidth={1.9} />
                            Add another alert
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div className="flex shrink-0 flex-col gap-3 border-t border-border/70 bg-muted/20 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    {saveError ? (
                        <p className="text-xs font-medium text-destructive">{saveError}</p>
                    ) : (
                        <span className="text-xs font-medium text-muted-foreground">
                            Alerts appear as popups while respondents fill out the form.
                        </span>
                    )}
                    <div className="flex shrink-0 gap-2">
                        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg px-3.5">Cancel</Button>
                        <Button onClick={handleSave} className="h-9 rounded-lg px-4">Apply alerts</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
