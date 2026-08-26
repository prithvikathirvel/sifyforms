import { useState, useEffect, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Trash2, Plus, X, Eye, FolderPlus } from 'lucide-react';
import type { FormField, ShowCondition, ShowWhenRule } from '../../types';
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
                    className="flex-1 min-w-0 h-8 rounded border px-2 text-xs"
                >
                    <option value="">Select value...</option>
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
                    className="flex-1 min-w-0 h-8 text-xs px-2"
                />
            );
        }

        return (
            <Input
                value={String(cond.value || '')}
                onChange={(e) => updateCondition(path, index, { value: e.target.value })}
                placeholder="Value..."
                className="flex-1 min-w-0 h-8 text-xs"
            />
        );
    };

    const renderConditionRow = (cond: ShowCondition, path: number[], index: number, displayNumber: number) => (
        <div key={cond.id || index} className="flex items-center gap-3 p-3 bg-white border border-border rounded-xl shadow-sm hover:border-brand-200 transition-colors">
            <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold shrink-0">
                {displayNumber}
            </div>

            <select
                value={cond.fieldId}
                onChange={(e) => updateCondition(path, index, { fieldId: e.target.value })}
                className="flex-1 min-w-0 h-9 rounded-lg border-border px-3 text-xs bg-muted/50 hover:bg-muted focus:bg-white transition-colors"
            >
                <option value="">Select field...</option>
                {otherFields.map(f => (
                    <option key={f.id} value={f.id}>{f.label} ({f.type})</option>
                ))}
            </select>

            <select
                value={cond.operator}
                onChange={(e) => updateCondition(path, index, { operator: e.target.value as any })}
                className="w-32 shrink-0 h-9 rounded-lg border-border px-2 text-xs font-medium bg-muted/50 hover:bg-muted focus:bg-white transition-colors"
            >
                {operators.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                ))}
            </select>

            <div className="flex-1 min-w-0">
                {renderConditionValueInput(cond, path, index)}
            </div>

            <Button
                variant="ghost"
                size="sm"
                onClick={() => removeChild(path, index)}
                className="shrink-0 h-9 w-9 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
            >
                <Trash2 className="h-4 w-4" />
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
                        ? 'space-y-4'
                        : 'space-y-3 border-l-4 border-brand-200 bg-brand-50/40 rounded-lg p-3 ml-2'
                }
            >
                <div className="flex items-center justify-between gap-3">
                    <div className={`flex items-center gap-3 ${isRoot ? 'bg-muted p-3 rounded-lg border border-border flex-1' : ''}`}>
                        <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                            {isRoot ? 'Combine conditions using:' : 'Group logic:'}
                        </Label>
                        <select
                            value={group.logic || 'and'}
                            onChange={(e) => setGroupLogic(path, e.target.value as 'and' | 'or')}
                            className="h-8 rounded-md border-border bg-white px-3 text-xs font-bold text-foreground shadow-sm focus:border-brand-300 focus:ring-1 focus:ring-brand-200"
                        >
                            <option value="and">ALL match (AND)</option>
                            <option value="or">ANY match (OR)</option>
                        </select>
                    </div>
                    {!isRoot && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeChild(path.slice(0, -1), path[path.length - 1])}
                            className="shrink-0 h-8 px-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg text-xs"
                            title="Remove this group"
                        >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Remove group
                        </Button>
                    )}
                </div>

                <div className="space-y-3">
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
                        className="bg-white text-brand-700 border-brand-200 hover:bg-brand-50 h-8 text-xs"
                    >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Condition
                    </Button>
                    {depth < MAX_GROUP_DEPTH && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addGroup(path)}
                            className="bg-white text-muted-foreground border-border hover:bg-muted h-8 text-xs"
                            title="Add a nested group of conditions with its own AND/OR logic"
                        >
                            <FolderPlus className="h-3.5 w-3.5 mr-1" />
                            Add Group
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                            <Eye className="h-5 w-5 text-brand-600" />
                            Conditional Visibility
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">Define when this field should be visible to users. Use groups for nested AND/OR logic, e.g. A AND (B OR C).</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <X className="h-5 w-5" />
                    </Button>
                </CardHeader>

                <CardContent className="flex-1 p-6 space-y-6 overflow-y-auto">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Visibility Conditions</Label>
                    </div>

                    {!localShowWhen || localShowWhen.conditions.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted">
                            <Eye className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                            <p className="text-sm font-medium text-muted-foreground mb-1">This field is always visible</p>
                            <p className="text-xs text-muted-foreground mb-4">Add a condition to hide this field under specific circumstances.</p>
                            <Button onClick={() => addCondition([])} size="sm" className="bg-brand-600 hover:bg-brand-700 text-white shadow-md">
                                <Plus className="h-4 w-4 mr-1.5" />
                                Add First Condition
                            </Button>
                        </div>
                    ) : (
                        renderGroup(localShowWhen, [], 1)
                    )}
                </CardContent>

                <CardFooter className="flex justify-between border-t py-4 bg-muted">
                    <Button variant="outline" onClick={onClose} className="rounded-lg font-medium">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium shadow-md shadow-brand-200">
                        Apply Visibility Settings
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
