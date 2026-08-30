import type { FormField } from '../../types';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { X, Plus, Trash2, Shield } from 'lucide-react';

interface ValidationModalProps {
    field: FormField;
    otherFields: FormField[];
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (updates: Partial<FormField>) => void;
}

const RULE_TYPES = [
    { value: 'required', label: 'Required' },
    { value: 'minLength', label: 'Min Length' },
    { value: 'maxLength', label: 'Max Length' },
    { value: 'min', label: 'Min Value' },
    { value: 'max', label: 'Max Value' },
    { value: 'pattern', label: 'Regex Pattern' },
    { value: 'email', label: 'Email Format' },
    { value: 'url', label: 'URL Format' },
    { value: 'contains', label: 'Contains String' },
    { value: 'notContains', label: 'Does Not Contain' },
    { value: 'startsWith', label: 'Starts With' },
    { value: 'endsWith', label: 'Ends With' },
    { value: 'greaterThan', label: 'Greater Than (>)' },
    { value: 'lessThan', label: 'Less Than (<)' },
    { value: 'gte', label: 'Greater Than or Equal (≥)' },
    { value: 'lte', label: 'Less Than or Equal (≤)' },
    { value: 'equals', label: 'Exactly Equals' },
    { value: 'notEquals', label: 'Does Not Equal' },
    { value: 'custom', label: 'Custom (Must match field)' },
];

const getPlaceholderForRuleType = (type: string) => {
    switch (type) {
        case 'minLength': return 'e.g. 5';
        case 'maxLength': return 'e.g. 100';
        case 'min': return 'e.g. 0';
        case 'max': return 'e.g. 100';
        case 'pattern': return 'e.g. ^[A-Za-z]+$';
        case 'custom': return 'Select field...';
        default: return 'Enter value...';
    }
};

const isInvalidRegex = (value: string | number | undefined): boolean => {
    if (value === undefined || value === '') return false;
    try {
        new RegExp(String(value));
        return false;
    } catch {
        return true;
    }
};

const getDefaultMessageForRuleType = (type: string) => {
    switch (type) {
        case 'required': return 'This field is required';
        case 'email': return 'Please enter a valid email address';
        case 'url': return 'Please enter a valid URL';
        case 'minLength': return 'Must be at least {value} characters';
        case 'maxLength': return 'Must be no more than {value} characters';
        case 'min': return 'Must be at least {value}';
        case 'max': return 'Must be no more than {value}';
        case 'pattern': return 'Please match the required format';
        case 'custom': return 'Fields must match';
        default: return 'Invalid input';
    }
};

export function ValidationModal({
    field,
    otherFields,
    isOpen,
    onClose,
    onUpdate
}: ValidationModalProps) {
    if (!isOpen) return null;

    const rules = field.rules || [];

    const addRule = () => {
        const newRule = {
            id: `rule_${Date.now()}`,
            type: 'required' as const,
            enabled: true,
            message: ''
        };
        onUpdate({ rules: [...rules, newRule] });
    };

    const removeRule = (ruleId: string) => {
        onUpdate({ rules: rules.filter(r => r.id !== ruleId) });
    };

    const updateRule = (ruleId: string, updates: Partial<any>) => {
        onUpdate({ rules: rules.map(r => r.id === ruleId ? { ...r, ...updates } : r) });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-100 text-brand-600 rounded-lg">
                            <Shield className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-foreground">Validation Rules</h2>
                            <p className="text-sm text-muted-foreground">Configure validation logic for "{field.label}"</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted">
                    {rules.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-border">
                            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                            <h3 className="text-lg font-medium text-foreground">No Validation Rules Added</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                                Add rules to ensure the data entered in this field meets your requirements.
                            </p>
                            <Button onClick={addRule}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add First Rule
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {rules.map((rule, index) => (
                                <div key={rule.id} className="p-4 bg-white rounded-xl border shadow-sm relative group">
                                    <div className="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full"
                                            onClick={() => removeRule(rule.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
                                            {index + 1}
                                        </span>
                                        <h4 className="font-medium text-foreground">Rule Configuration</h4>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold text-muted-foreground">Type</Label>
                                            <select
                                                value={rule.type}
                                                onChange={(e) => updateRule(rule.id, { type: e.target.value as any, value: '' })}
                                                className="w-full h-10 rounded-md border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
                                            >
                                                {RULE_TYPES.map(rt => (
                                                    <option key={rt.value} value={rt.value}>{rt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Rule Value Input */}
                                        {!['required', 'email', 'url'].includes(rule.type) && (
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-muted-foreground">
                                                    {rule.type === 'minLength' || rule.type === 'maxLength' ? 'Length' :
                                                        rule.type === 'min' || rule.type === 'max' ? 'Value' :
                                                            rule.type === 'pattern' ? 'Pattern' :
                                                                rule.type === 'custom' ? 'Target Field' : 'Value'}
                                                </Label>

                                                {rule.type === 'custom' ? (
                                                    <select
                                                        value={rule.value || ''}
                                                        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                                                        className="w-full h-10 rounded-md border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
                                                    >
                                                        <option value="">Select a field to match...</option>
                                                        {otherFields.map(f => (
                                                            <option key={f.id} value={f.id}>{f.label || f.id}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <>
                                                        <Input
                                                            type={rule.type === 'min' || rule.type === 'max' ? 'number' : 'text'}
                                                            value={rule.value || ''}
                                                            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                                                            placeholder={getPlaceholderForRuleType(rule.type)}
                                                            className={`h-10 text-sm ${(rule.type === 'pattern' || rule.type === 'regex') && isInvalidRegex(rule.value) ? 'border-red-400 focus:border-red-500' : ''}`}
                                                        />
                                                        {(rule.type === 'pattern' || rule.type === 'regex') && isInvalidRegex(rule.value) && (
                                                            <p className="text-xs text-red-600 font-medium">This pattern is invalid — the rule won't run until it's fixed.</p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Custom Message */}
                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="text-xs font-semibold text-muted-foreground">Custom Error Message (Optional)</Label>
                                            <Input
                                                value={rule.message || ''}
                                                onChange={(e) => updateRule(rule.id, { message: e.target.value })}
                                                placeholder={getDefaultMessageForRuleType(rule.type)}
                                                className="h-10 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <Button variant="outline" onClick={addRule} className="w-full mt-4 border-dashed border-border hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Another Rule
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-muted/50 flex justify-end">
                    <Button onClick={onClose} className="bg-brand-600 hover:bg-brand-700 text-white">
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
}
