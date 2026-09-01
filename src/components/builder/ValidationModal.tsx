import type { FieldRule, FormField } from '../../types';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { X, Plus, Trash2, ShieldCheck } from 'lucide-react';

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
    { value: 'custom', label: 'Matches Another Field' },
];

/** Rule types that never need a value input. */
const NO_VALUE_TYPES = new Set(['required', 'email', 'url']);

const getPlaceholderForRuleType = (type: string) => {
    switch (type) {
        case 'minLength': return 'e.g. 5';
        case 'maxLength': return 'e.g. 100';
        case 'min': return 'e.g. 0';
        case 'max': return 'e.g. 100';
        case 'pattern': return 'e.g. ^[A-Za-z]+$';
        case 'custom': return 'Select field…';
        default: return 'Enter value…';
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

const selectBaseClass =
    'h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 text-[13px] font-medium shadow-none transition-colors hover:border-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0';

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

    const updateRule = (ruleId: string, updates: Partial<FieldRule>) => {
        onUpdate({ rules: rules.map(r => r.id === ruleId ? { ...r, ...updates } : r) });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary">
                            <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
                        </span>
                        <div>
                            <h2 className="font-display text-base font-bold text-foreground">Validation rules</h2>
                            <p className="mt-0.5 text-xs font-medium leading-5 text-muted-foreground">
                                Make sure “{field.label}” only accepts the data you expect.
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/30 px-5 py-4">
                    {rules.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/50 text-ink-400">
                                <ShieldCheck className="h-5 w-5" strokeWidth={1.7} />
                            </span>
                            <p className="mt-4 text-sm font-semibold text-foreground">No validation rules</p>
                            <p className="mt-1 max-w-xs text-xs font-medium leading-5 text-muted-foreground">
                                Add rules so this field only accepts data that meets your requirements.
                            </p>
                            <Button onClick={addRule} className="mt-5 h-9 rounded-lg px-3.5">
                                <Plus className="mr-2 h-4 w-4" strokeWidth={1.9} />
                                Add first rule
                            </Button>
                        </div>
                    ) : (
                        rules.map((rule, index) => (
                            <div key={rule.id} className="rounded-xl border border-border/80 bg-card shadow-sm">
                                <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/[0.09] text-[11px] font-bold text-primary">
                                            {index + 1}
                                        </span>
                                        <span className="text-[13px] font-semibold text-foreground">Rule</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeRule(rule.id)}
                                        className="h-7 w-7 rounded-md text-muted-foreground hover:bg-destructive/[0.06] hover:text-destructive"
                                        aria-label="Remove rule"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                <div className="space-y-3 px-4 py-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</Label>
                                        <select
                                            value={rule.type}
                                            onChange={(e) => updateRule(rule.id, { type: e.target.value as FieldRule['type'], value: '' })}
                                            className={selectBaseClass}
                                        >
                                            {RULE_TYPES.map(rt => (
                                                <option key={rt.value} value={rt.value}>{rt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Rule value input */}
                                    {!NO_VALUE_TYPES.has(rule.type) && (
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                {rule.type === 'minLength' || rule.type === 'maxLength' ? 'Length' :
                                                    rule.type === 'min' || rule.type === 'max' ? 'Value' :
                                                        rule.type === 'pattern' || rule.type === 'regex' ? 'Pattern' :
                                                            rule.type === 'custom' ? 'Target Field' : 'Value'}
                                            </Label>

                                            {rule.type === 'custom' ? (
                                                <select
                                                    value={rule.value || ''}
                                                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                                                    className={selectBaseClass}
                                                >
                                                    <option value="">Select a field to match…</option>
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
                                                    />
                                                    {(rule.type === 'pattern' || rule.type === 'regex') && isInvalidRegex(rule.value) && (
                                                        <p className="text-[11px] font-medium text-destructive">
                                                            This pattern is invalid — the rule won’t run until it’s fixed.
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Custom message */}
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Custom error message (optional)</Label>
                                        <Input
                                            value={rule.message || ''}
                                            onChange={(e) => updateRule(rule.id, { message: e.target.value })}
                                            placeholder={getDefaultMessageForRuleType(rule.type)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {rules.length > 0 && (
                        <button
                            type="button"
                            onClick={addRule}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary"
                        >
                            <Plus className="h-4 w-4" strokeWidth={1.9} />
                            Add another rule
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-between border-t border-border/70 bg-muted/20 px-5 py-3.5">
                    <span className="text-xs font-medium text-muted-foreground">
                        {rules.length} rule{rules.length === 1 ? '' : 's'}
                    </span>
                    <Button onClick={onClose} className="h-9 rounded-lg px-4">
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
}
