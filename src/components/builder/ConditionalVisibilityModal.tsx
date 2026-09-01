import { useState, useEffect, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { Trash2, Plus, X, Eye, GitBranch, CornerDownRight } from 'lucide-react';
import type { FormField, ShowCondition, ShowConditionOperator, ShowWhenRule } from '../../types';
import { isShowWhenGroup } from '../../types';

interface ConditionalVisibilityModalProps {
    field: FormField;
    otherFields: FormField[];
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (updates: Partial<FormField>) => void;
    operators: { label: string; value: string; needsValue?: boolean }[];
}

/** Maximum nesting depth for condition groups (root group = depth 1) */
const MAX_GROUP_DEPTH = 3;

const newCondition = (): ShowCondition => ({
    id: `condition_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    fieldId: '',
    operator: 'equals',
    value: ''
});

const newGroup = (logic: 'and' | 'or' = 'and'): ShowWhenRule => ({
    id: `group_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    logic,
    conditions: [newCondition()]
});

/** Immutably apply `updater` to the group at `path` (path = child indices from the root). */
function updateGroupAtPath(
    root: ShowWhenRule,
    path: number[],
    updater: (group: ShowWhenRule) => ShowWhenRule
): ShowWhenRule {
    if (path.length === 0) return updater(root);
    const [head, ...rest] = path;
    const child = root.conditions[head];
    if (!child || !isShowWhenGroup(child)) return root;
    const conditions = [...root.conditions];
    conditions[head] = updateGroupAtPath(child, rest, updater);
    return { ...root, conditions };
}

/** Remove nested groups that have no children left (root is preserved). */
function pruneEmptyGroups(group: ShowWhenRule): ShowWhenRule {
    const conditions = group.conditions
        .map((node) => (isShowWhenGroup(node) ? pruneEmptyGroups(node) : node))
        .filter((node) => !isShowWhenGroup(node) || node.conditions.length > 0);
    return { ...group, conditions };
}

export function ConditionalVisibilityModal({
    field,
    otherFields,
    isOpen,
    onClose,
    onUpdate,
    operators
}: ConditionalVisibilityModalProps) {
    // Local state for the showWhen rule being edited
    const [localShowWhen, setLocalShowWhen] = useState<ShowWhenRule | undefined>(field.showWhen);

    // Sync from props when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalShowWhen(field.showWhen);
        }
    }, [isOpen, field.showWhen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onUpdate({ showWhen: localShowWhen });
        onClose();
    };

    const mutateGroup = (path: number[], updater: (group: ShowWhenRule) => ShowWhenRule) => {
        setLocalShowWhen((prev) => {
            const root = prev ?? { id: `showwhen_${Date.now()}`, logic: 'and' as const, conditions: [] };
            const updated = pruneEmptyGroups(updateGroupAtPath(root, path, updater));
            return updated.conditions.length === 0 ? undefined : updated;
        });
    };

    const addCondition = (path: number[]) => {
        if (!localShowWhen) {
            setLocalShowWhen({ id: `showwhen_${Date.now()}`, logic: 'and', conditions: [newCondition()] });
            return;
        }
        mutateGroup(path, (g) => ({ ...g, conditions: [...g.conditions, newCondition()] }));
    };

    const addGroup = (path: number[]) => {
        if (!localShowWhen) {
            setLocalShowWhen({ id: `showwhen_${Date.now()}`, logic: 'and', conditions: [newGroup('or')] });
            return;
        }
        // Nested groups default to the opposite logic of their parent (the common use case)
        mutateGroup(path, (g) => ({
            ...g,
            conditions: [...g.conditions, newGroup(g.logic === 'and' ? 'or' : 'and')]
        }));
    };

    const removeChild = (path: number[], index: number) => {
        mutateGroup(path, (g) => ({ ...g, conditions: g.conditions.filter((_, i) => i !== index) }));
    };

    const updateCondition = (path: number[], index: number, updates: Partial<ShowCondition>) => {
        mutateGroup(path, (g) => {
            const conditions = [...g.conditions];
            const existing = conditions[index];
            if (!existing || isShowWhenGroup(existing)) return g;
            conditions[index] = { ...existing, ...updates };
            return { ...g, conditions };
        });
    };

    const setGroupLogic = (path: number[], logic: 'and' | 'or') => {
        mutateGroup(path, (g) => ({ ...g, logic }));
    };

    const renderConditionValueInput = (cond: ShowCondition, path: number[], index: number) => {
        const opDef = operators.find(op => op.value === cond.operator);
        if (!opDef?.needsValue) return null;

        const sourceField = otherFields.find(f => f.id === cond.fieldId);
        const hasOptions = sourceField && ['select', 'multiselect', 'radio', 'checkbox'].includes(sourceField.type) && sourceField.options && sourceField.options.length > 0;

        if (hasOptions) {
            return (
                <select
                    value={String(cond.value || '')}
                    onChange={(e) => updateCondition(path, index, { value: e.target.value })}
                    className="h-8 w-full min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs font-medium"
                >
                    <option value="">Select value…</option>
                    {sourceField.options!.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            );
        }

        if (sourceField?.type === 'date') {
            return (
                <Input
                    type="date"
                    value={String(cond.value || '')}
                    onChange={(e) => updateCondition(path, index, { value: e.target.value })}
                    className="h-8 min-w-0 flex-1 px-2 text-xs"
                />
            );
        }

        return (
            <Input
                value={String(cond.value || '')}
                onChange={(e) => updateCondition(path, index, { value: e.target.value })}
                placeholder="Value…"
                className="h-8 min-w-0 flex-1 text-xs"
            />
        );
    };

    const renderConditionRow = (cond: ShowCondition, path: number[], index: number, displayNumber: number) => (
        <div key={cond.id || index} className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-2 shadow-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/[0.09] text-[11px] font-bold text-primary">
                {displayNumber}
            </span>

            <select
                value={cond.fieldId}
                onChange={(e) => updateCondition(path, index, { fieldId: e.target.value })}
                className="h-8 w-full min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs font-medium"
            >
                <option value="">Select field…</option>
                {otherFields.map(f => (
                    <option key={f.id} value={f.id}>{f.label} ({f.type})</option>
                ))}
            </select>

            <select
                value={cond.operator}
                onChange={(e) => updateCondition(path, index, { operator: e.target.value as ShowConditionOperator })}
                className="h-8 w-32 shrink-0 rounded-md border border-input bg-background px-2 text-xs font-medium"
            >
                {operators.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                ))}
            </select>

            {renderConditionValueInput(cond, path, index)}

            <Button
                variant="ghost"
                size="icon"
                onClick={() => removeChild(path, index)}
                className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-destructive/[0.06] hover:text-destructive"
                aria-label="Remove condition"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    );

    const renderGroup = (group: ShowWhenRule, path: number[], depth: number): ReactNode => {
        const isRoot = depth === 1;
        let conditionNumber = 0;

        return (
            <div
                className={
                    isRoot
                        ? 'space-y-3'
                        : 'space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3'
                }
            >
                {/* Group logic control */}
                <div className="flex items-center justify-between gap-3">
                    {isRoot ? (
                        <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
                            {(['and', 'or'] as const).map((logic) => (
                                <button
                                    key={logic}
                                    type="button"
                                    onClick={() => setGroupLogic(path, logic)}
                                    className={cn(
                                        'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                                        group.logic === logic
                                            ? 'bg-card text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {logic === 'and' ? 'ALL' : 'ANY'}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                            <CornerDownRight className="h-3.5 w-3.5" />
                            Group: match {group.logic === 'and' ? 'ALL' : 'ANY'}
                        </span>
                    )}

                    {isRoot && (
                        <span className="text-[11px] font-medium text-muted-foreground">
                            Show when {group.logic === 'and' ? 'all' : 'any'} conditions match
                        </span>
                    )}

                    {!isRoot && (
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setGroupLogic(path, group.logic === 'and' ? 'or' : 'and')}
                                className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                            >
                                {group.logic === 'and' ? 'ALL' : 'ANY'}
                            </button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeChild(path.slice(0, -1), path[path.length - 1])}
                                className="h-7 w-7 rounded-md text-muted-foreground hover:bg-destructive/[0.06] hover:text-destructive"
                                title="Remove this group"
                                aria-label="Remove group"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    {group.conditions.map((node, index) => {
                        if (isShowWhenGroup(node)) {
                            return (
                                <div key={node.id || `group-${index}`}>
                                    {renderGroup(node, [...path, index], depth + 1)}
                                </div>
                            );
                        }
                        conditionNumber += 1;
                        return renderConditionRow(node, path, index, conditionNumber);
                    })}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addCondition(path)}
                        className="h-8 rounded-lg text-xs"
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add condition
                    </Button>
                    {depth < MAX_GROUP_DEPTH && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addGroup(path)}
                            className="h-8 rounded-lg text-xs"
                            title="Add a nested group of conditions with its own ALL/ANY logic"
                        >
                            <GitBranch className="mr-1 h-3.5 w-3.5" />
                            Add group
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary">
                            <Eye className="h-4 w-4" strokeWidth={1.9} />
                        </span>
                        <div>
                            <h2 className="font-display text-base font-bold text-foreground">Conditional visibility</h2>
                            <p className="mt-0.5 text-xs font-medium leading-5 text-muted-foreground">
                                Choose when “{field.label}” is shown. Use groups for nested logic like A AND (B OR C).
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {!localShowWhen || localShowWhen.conditions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-ink-400">
                                <Eye className="h-5 w-5" strokeWidth={1.7} />
                            </span>
                            <p className="mt-4 text-sm font-semibold text-foreground">This field is always visible</p>
                            <p className="mt-1 max-w-xs text-xs font-medium leading-5 text-muted-foreground">
                                Add a condition to show this field only when specific criteria are met.
                            </p>
                            <Button onClick={() => addCondition([])} className="mt-5 h-9 rounded-lg px-3.5">
                                <Plus className="mr-2 h-4 w-4" strokeWidth={1.9} />
                                Add first condition
                            </Button>
                        </div>
                    ) : (
                        renderGroup(localShowWhen, [], 1)
                    )}
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-between border-t border-border/70 bg-muted/20 px-5 py-3.5">
                    <span className="text-xs font-medium text-muted-foreground">
                        The field is hidden until its conditions are met.
                    </span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg px-3.5">
                            Cancel
                        </Button>
                        <Button onClick={handleSave} className="h-9 rounded-lg px-4">
                            Apply visibility
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
