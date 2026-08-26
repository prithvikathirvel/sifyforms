import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Trash2, Plus, X, AlertCircle } from 'lucide-react';
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

export function CustomAlertModal({
    field,
    otherFields,
    isOpen,
    onClose,
    onUpdate,
    operators
}: CustomAlertModalProps) {
    const [localAlerts, setLocalAlerts] = useState<AlertRule[]>([]);

    useEffect(() => {
        if (isOpen) {
            setLocalAlerts(field.alerts || []);
        }
    }, [isOpen, field.alerts]);

    if (!isOpen) return null;

    const handleSave = () => {
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
            <select
                value={cond.tableColumnId || ''}
                onChange={(e) => updateCondition(alertIndex, condIndex, { tableColumnId: e.target.value || undefined })}
                className="w-28 h-8 rounded border px-2 text-[11px]"
            >
                <option value="">Any column</option>
                {columns.map(col => (
                    <option key={col.id} value={col.id}>{col.label || col.id}</option>
                ))}
            </select>
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
                    <select
                        value={String(cond.value || '')}
                        onChange={(e) => updateCondition(alertIndex, condIndex, { value: e.target.value })}
                        className="flex-1 min-w-0 h-8 rounded border px-2 text-xs"
                    >
                        <option value="">Select value...</option>
                        {col.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                );
            }
        }

        const hasOptions = sourceField && ['select', 'multiselect', 'radio', 'checkbox'].includes(sourceField.type) && sourceField.options && sourceField.options.length > 0;

        if (hasOptions) {
            return (
                <select
                    value={String(cond.value || '')}
                    onChange={(e) => updateCondition(alertIndex, condIndex, { value: e.target.value })}
                    className="flex-1 min-w-0 h-8 rounded border px-2 text-xs"
                >
                    <option value="">Select value...</option>
                    {sourceField.options!.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            );
        }

        return (
            <Input
                value={String(cond.value || '')}
                onChange={(e) => updateCondition(alertIndex, condIndex, { value: e.target.value })}
                placeholder="Value..."
                className="flex-1 min-w-0 h-8 text-xs"
            />
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                            <AlertCircle className="h-5 w-5 text-orange-500" />
                            Custom Field Alerts
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">Trigger messages dynamically based on user selection.</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <X className="h-5 w-5" />
                    </Button>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Configured Alerts</Label>
                        <Button variant="outline" size="sm" onClick={addAlert} className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100">
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add New Alert
                        </Button>
                    </div>

                    {localAlerts.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted">
                            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">No alerts configured</p>
                            <p className="text-xs text-muted-foreground mb-4">Add alerts to show helpful tips or warnings based on user input.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {localAlerts.map((alert, alertIndex) => (
                                <Card key={alert.id} className="border-border shadow-sm overflow-hidden">
                                    <div className={`h-1 w-full ${
                                        alert.type === 'info' ? 'bg-plum-500' :
                                        alert.type === 'warning' ? 'bg-orange-500' :
                                        alert.type === 'error' ? 'bg-red-500' : 'bg-green-500'
                                    }`} />
                                    <div className="p-4 space-y-4">
                                        <div className="flex gap-4">
                                            <div className="flex-1 space-y-4">
                                                <div className="grid grid-cols-4 gap-4">
                                                    <div className="col-span-1 space-y-2">
                                                        <Label className="text-xs">Type</Label>
                                                        <select
                                                            value={alert.type}
                                                            onChange={(e) => updateAlert(alertIndex, { type: e.target.value as any })}
                                                            className="w-full h-9 rounded-lg border-border px-3 text-xs"
                                                        >
                                                            <option value="info">Info (Blue)</option>
                                                            <option value="warning">Warning (Orange)</option>
                                                            <option value="error">Error (Red)</option>
                                                            <option value="success">Success (Green)</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-span-3 space-y-2">
                                                        <Label className="text-xs">Alert Message</Label>
                                                        <Input
                                                            value={alert.message}
                                                            onChange={(e) => updateAlert(alertIndex, { message: e.target.value })}
                                                            placeholder="Enter the alert content..."
                                                            className="h-9 text-xs"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Conditions to show this alert</Label>
                                                        <Button variant="ghost" size="sm" onClick={() => addCondition(alertIndex)} className="h-6 text-[10px] text-brand-600">
                                                            <Plus className="h-3 w-3 mr-1" /> Add Condition
                                                        </Button>
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                        {alert.conditions.map((cond, condIndex) => (
                                                            <div key={cond.id} className="flex items-center gap-2">
                                                                <select
                                                                    value={cond.fieldId}
                                                                    onChange={(e) => updateCondition(alertIndex, condIndex, { fieldId: e.target.value, tableColumnId: undefined })}
                                                                    className="flex-1 h-8 rounded border px-2 text-[11px]"
                                                                >
                                                                    <option value={field.id}>This Field ({field.label}) [{field.type}]</option>
                                                                    {otherFields.map(f => (
                                                                        <option key={f.id} value={f.id}>{f.label} [{f.type}]</option>
                                                                    ))}
                                                                </select>
                                                                {renderTableColumnPicker(cond, alertIndex, condIndex)}
                                                                <select
                                                                    value={cond.operator}
                                                                    onChange={(e) => updateCondition(alertIndex, condIndex, { operator: e.target.value as any })}
                                                                    className="w-24 h-8 rounded border px-2 text-[11px]"
                                                                >
                                                                    {operators.map(op => (
                                                                        <option key={op.value} value={op.value}>{op.label}</option>
                                                                    ))}
                                                                </select>
                                                                {renderConditionValueInput(cond, alertIndex, condIndex)}
                                                                <Button variant="ghost" size="sm" onClick={() => removeCondition(alertIndex, condIndex)} className="h-8 w-8 p-0 text-muted-foreground">
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => removeAlert(alertIndex)} className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex justify-between border-t py-4 bg-muted">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} className="bg-brand-600 hover:bg-brand-700 text-white">
                        Apply Alerts
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
