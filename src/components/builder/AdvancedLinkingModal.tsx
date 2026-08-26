import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Trash2, Plus, X, FolderPlus } from 'lucide-react';
import type { FormField, FormVariable, AdvancedDateRange } from '../../types';
import { isLinkingGroup } from '../../types';

import { DateConstraintPicker } from './FieldInspector';

interface AdvancedLinkingModalProps {
  field: FormField;
  otherFields: FormField[];
  variables: FormVariable[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
}

/** Maximum nesting depth for condition groups (rule root = depth 1) */
const MAX_LINK_GROUP_DEPTH = 3;

const newLinkingCondition = () => ({ fieldId: '', operator: 'equals', value: '' });

const newLinkingGroup = (logic: 'and' | 'or') => ({
  id: `group_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
  logic,
  conditions: [newLinkingCondition()]
});

const TREE_ACCENTS = {
  purple: {
    focus: 'focus:border-brand-300',
    groupBorder: 'border-brand-200',
    groupBg: 'bg-brand-50/40',
    badge: 'bg-brand-100 text-brand-700',
    btn: 'border-brand-100 text-brand-700 hover:bg-brand-50'
  },
  orange: {
    focus: 'focus:border-orange-300',
    groupBorder: 'border-orange-200',
    groupBg: 'bg-orange-50/40',
    badge: 'bg-orange-100 text-orange-700',
    btn: 'border-orange-100 text-orange-700 hover:bg-orange-50'
  }
} as const;

/**
 * Recursive editor for a Smart Connection condition tree. Nodes are either
 * single conditions or nested AND/OR groups (`A AND (B OR C)`), matching the
 * grouping already supported by Conditional Visibility.
 */
function LinkingConditionTree({
  nodes,
  onChange,
  otherFields,
  depth,
  accent
}: {
  nodes: any[];
  onChange: (nodes: any[]) => void;
  otherFields: FormField[];
  depth: number;
  accent: keyof typeof TREE_ACCENTS;
}) {
  const a = TREE_ACCENTS[accent];

  const updateNode = (index: number, node: any) => {
    const next = [...nodes];
    next[index] = node;
    onChange(next);
  };
  const removeNode = (index: number) => onChange(nodes.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      {nodes.map((node: any, index: number) => {
        if (node && isLinkingGroup(node)) {
          return (
            <div key={node.id || index} className={`p-3 rounded-xl border-2 ${a.groupBorder} ${a.groupBg} space-y-2`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${a.badge}`}>Group</span>
                  <select
                    className={`h-7 text-xs rounded-md border-2 border-border bg-white px-2 font-bold ${a.focus} outline-none`}
                    value={node.logic || 'and'}
                    onChange={(e) => updateNode(index, { ...node, logic: e.target.value })}
                  >
                    <option value="and">ALL (AND)</option>
                    <option value="or">ANY (OR)</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-7 px-2 text-xs border-2 ${a.btn}`}
                    onClick={() => updateNode(index, { ...node, conditions: [...(node.conditions || []), newLinkingCondition()] })}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                  {depth < MAX_LINK_GROUP_DEPTH && (
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-7 px-2 text-xs border-2 ${a.btn}`}
                      onClick={() => updateNode(index, {
                        ...node,
                        conditions: [...(node.conditions || []), newLinkingGroup(node.logic === 'and' ? 'or' : 'and')]
                      })}
                    >
                      <FolderPlus className="h-3 w-3 mr-1" />
                      Group
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded-full"
                    onClick={() => removeNode(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <LinkingConditionTree
                nodes={node.conditions || []}
                onChange={(conditions) => updateNode(index, { ...node, conditions })}
                otherFields={otherFields}
                depth={depth + 1}
                accent={accent}
              />
            </div>
          );
        }

        const cond = node || newLinkingCondition();
        return (
          <div key={index} className="flex items-center gap-2 group p-1 hover:bg-muted rounded-lg transition-colors">
            <select
              className={`flex-1 min-w-[140px] rounded-lg border-2 border-border h-8 text-xs font-medium px-2 ${a.focus} outline-none`}
              value={cond.fieldId}
              onChange={(e) => updateNode(index, { ...cond, fieldId: e.target.value })}
            >
              <option value="">Field...</option>
              {otherFields.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>

            <select
              className={`w-[100px] rounded-lg border-2 border-border h-8 text-xs font-bold px-2 ${a.focus} outline-none bg-muted`}
              value={cond.operator}
              onChange={(e) => updateNode(index, { ...cond, operator: e.target.value })}
            >
              <option value="equals">==</option>
              <option value="notEquals">!=</option>
              <option value="contains">~</option>
              <option value="notContains">!~</option>
              <option value="greaterThan">&gt;</option>
              <option value="lessThan">&lt;</option>
            </select>

            <div className="flex-[1.5] min-w-[120px]">
              {(() => {
                const sourceField = otherFields.find(f => f.id === cond.fieldId);
                if (sourceField?.options) {
                  return (
                    <select
                      className={`w-full rounded-lg border-2 border-border h-8 text-xs font-medium px-2 ${a.focus} outline-none`}
                      value={String(cond.value || '')}
                      onChange={(e) => updateNode(index, { ...cond, value: e.target.value })}
                    >
                      <option value="">Value...</option>
                      {sourceField.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  );
                }
                return (
                  <Input
                    className={`h-8 text-xs border-2 border-border rounded-lg ${a.focus} focus:ring-0`}
                    value={String(cond.value || '')}
                    onChange={(e) => updateNode(index, { ...cond, value: e.target.value })}
                    placeholder="Type value..."
                  />
                );
              })()}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all rounded-full"
              onClick={() => removeNode(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export function AdvancedLinkingModal({
  field,
  otherFields,
  variables,
  isOpen,
  onClose,
  onUpdate
}: AdvancedLinkingModalProps) {
  const [selectedSourceField, setSelectedSourceField] = useState(field.fieldLinking?.sourceFieldId || '');
  
  // Separate restriction rules from regular rules on initial load
  const initialRules = field.fieldLinking?.rules || [];
  const initialRestrictionRules = field.fieldLinking?.restrictionRules || [];
  
  console.log('🔍 [AdvancedLinkingModal] Initial field linking:', field.fieldLinking);
  console.log('🔍 [AdvancedLinkingModal] Initial rules:', initialRules);
  console.log('🔍 [AdvancedLinkingModal] Initial restrictionRules:', initialRestrictionRules);
  
  // Check if any rules in the 'rules' array are actually restriction rules (have 'action' property)
  const restrictionRulesInRulesArray = initialRules.filter((rule: any) => rule && (rule.action === 'required' || rule.action === 'disabled'));
  const regularRules = initialRules.filter((rule: any) => !rule || !(rule.action === 'required' || rule.action === 'disabled'));
  
  console.log('🔍 [AdvancedLinkingModal] Restriction rules found in rules array:', restrictionRulesInRulesArray);
  console.log('🔍 [AdvancedLinkingModal] Regular rules:', regularRules);
  
  // Combine restriction rules from both arrays
  const allRestrictionRules = [...initialRestrictionRules, ...restrictionRulesInRulesArray];
  
  console.log('🔍 [AdvancedLinkingModal] All restriction rules:', allRestrictionRules);
  
  const [linkingRules, setLinkingRules] = useState(regularRules as any[]);
  const [restrictionRules, setRestrictionRules] = useState(allRestrictionRules as any[]);
  // track whether each auto-fill rule is in "value" or "copy" mode
  const [ruleModes, setRuleModes] = useState<Array<'value' | 'copy'>>(
    regularRules.map((r: any) => (r.copyFromFieldId ? 'copy' : 'value'))
  );

  // whenever rules array length changes, keep modes array in sync
  useEffect(() => {
    setRuleModes(prev => {
      const next = [...prev];
      while (next.length < linkingRules.length) next.push('value');
      while (next.length > linkingRules.length) next.pop();
      return next;
    });
  }, [linkingRules.length]);

  // If we found restriction rules in the wrong place, update the field linking
  if (restrictionRulesInRulesArray.length > 0) {
    console.log('🔄 [AdvancedLinkingModal] Moving restriction rules from rules array to restrictionRules array');
    onUpdate({
      fieldLinking: {
        enabled: true,
        sourceFieldId: selectedSourceField,
        ...field.fieldLinking,
        rules: regularRules as any,
        restrictionRules: allRestrictionRules as any,
      }
    });
  } else {
    console.log('✅ [AdvancedLinkingModal] Restriction rules are already in correct place');
  }



  const validateRules = (): boolean => {
    const errors = linkingRules.map(r => {
      const hasStatic = r.targetValue !== undefined && r.targetValue !== '';
      const hasCopy = r.copyFromFieldId && r.copyFromFieldId !== '';
      const hasDynamicOptions = Array.isArray(r.dynamicOptions) && r.dynamicOptions.length > 0;
      const hasDateRange = r.dateRange && (r.dateRange.min || r.dateRange.max);
      if (!hasStatic && !hasCopy && !hasDynamicOptions && !hasDateRange) {
        return 'Provide either a value, choose a field to copy from, configure dynamic options, or set a date range.';
      }
      return null;
    });
    setRuleErrors(errors);
    return errors.every(e => e === null);
  };

  const handleSave = () => {
    // validate before closing
    if (linkingMode === 'advanced') {
      if (!validateRules()) {
        console.warn('Validation failed, not saving');
        return;
      }
    }

    // Ensure all current state is saved before closing
    console.log('💾 [AdvancedLinkingModal] Saving final field linking state:', {
      enabled: true,
      sourceFieldId: selectedSourceField,
      mode: linkingMode,
      rulesCount: linkingRules.length,
      restrictionRulesCount: restrictionRules.length,
      hasDynamicConfig: !!(dynamicOptionsEnabled || defaultDateRange || dateMappings)
    });

    // Construct dynamicConfig from state variables
    const dynamicConfig = {
      ...(dynamicOptionsEnabled && { options: optionMappings }),
      ...((defaultDateRange || Object.keys(dateMappings).length > 0) && {
        dateRange: {
          ...(defaultDateRange && (Object.keys(defaultDateRange).length > 0) && { default: defaultDateRange }),
          ...(Object.keys(dateMappings).length > 0 && { mappings: dateMappings })
        }
      })
    };

    const fieldLinking = {
      enabled: true,
      sourceFieldId: selectedSourceField,
      mode: linkingMode,
      rules: linkingRules,
      restrictionRules: restrictionRules,
      ...(Object.keys(dynamicConfig).length > 0 && { dynamicConfig })
    };

    console.log('🔗 [AdvancedLinkingModal] Final field linking to save:', fieldLinking);
    onUpdate({ fieldLinking });
    onClose();
  };

  const handleUpdateFieldLinking = (updates: any) => {
    // Construct dynamicConfig from state variables
    const dynamicConfig = {
      ...(dynamicOptionsEnabled && { options: optionMappings }),
      ...((defaultDateRange || Object.keys(dateMappings).length > 0) && {
        dateRange: {
          ...(defaultDateRange && (Object.keys(defaultDateRange).length > 0) && { default: defaultDateRange }),
          ...(Object.keys(dateMappings).length > 0 && { mappings: dateMappings })
        }
      })
    };

    const fieldLinking = {
      enabled: true,
      sourceFieldId: selectedSourceField,
      mode: linkingMode,
      rules: linkingRules,
      restrictionRules: restrictionRules,
      ...(Object.keys(dynamicConfig).length > 0 && { dynamicConfig }),
      ...updates
    };

    console.log('🔗 Updating field linking:', fieldLinking);
    onUpdate({ fieldLinking });
  };

  const handleAddRule = () => {
    const newRule = {
      id: `rule_${Date.now()}`,
      logic: 'and' as const,
      conditions: [{
        fieldId: selectedSourceField || '',
        operator: 'equals' as const,
        value: ''
      }],
      targetValue: '',
      copyFromFieldId: ''
    };

    const updatedRules = [...linkingRules, newRule];
    setLinkingRules(updatedRules);
    handleUpdateFieldLinking({ rules: updatedRules });
    if (linkingMode === 'advanced') validateRules();
  };

  const handleUpdateRule = (index: number, updates: any) => {
    const updatedRules = [...linkingRules];
    // if a copy-from-field id is added, clear any previously entered static value
    if (updates.copyFromFieldId && updates.copyFromFieldId !== '') {
      updates = { ...updates, targetValue: '' };
    }
    // if a static value is entered, clear the copy-from setting
    if (updates.targetValue && updates.targetValue !== '') {
      updates = { ...updates, copyFromFieldId: '' };
    }
    updatedRules[index] = { ...updatedRules[index], ...updates };
    setLinkingRules(updatedRules);
    handleUpdateFieldLinking({ rules: updatedRules });
  };

  // validation helper already called from handlers; no need for effect

  const handleDeleteRule = (index: number) => {
    const updatedRules = linkingRules.filter((_, i) => i !== index);
    setLinkingRules(updatedRules);
    setRuleModes(prev => prev.filter((_, i) => i !== index));
    handleUpdateFieldLinking({ rules: updatedRules });
    if (linkingMode === 'advanced') validateRules();
  };

  // Restriction Rules Handlers
  const handleAddRestrictionRule = () => {
    // Switch to restriction mode when adding restriction rules
    setLinkingMode('restriction');
    
    const newRule = {
      id: `restriction_${Date.now()}`,
      logic: 'and' as const,
      conditions: [{
        fieldId: '',
        operator: 'equals' as const,
        value: ''
      }],
      action: 'required' as const,
      apply: true
    };

    const updatedRules = [...restrictionRules, newRule];
    setRestrictionRules(updatedRules);
    handleUpdateFieldLinking({ 
      restrictionRules: updatedRules,
      mode: 'restriction'
    });
  };

  const handleUpdateRestrictionRule = (index: number, updates: any) => {
    const updatedRules = [...restrictionRules];
    updatedRules[index] = { ...updatedRules[index], ...updates };
    setRestrictionRules(updatedRules);
    handleUpdateFieldLinking({ 
      restrictionRules: updatedRules,
      mode: 'restriction'
    });
  };

  const handleDeleteRestrictionRule = (index: number) => {
    const updatedRules = restrictionRules.filter((_, i) => i !== index);
    setRestrictionRules(updatedRules);
    
    // If no more restriction rules, switch back to basic mode
    const newMode = updatedRules.length > 0 ? 'restriction' : 'basic';
    setLinkingMode(newMode as any);
    
    handleUpdateFieldLinking({ 
      restrictionRules: updatedRules,
      mode: newMode
    });
  };

  const handleSourceFieldChange = (sourceFieldId: string) => {
    setSelectedSourceField(sourceFieldId);
    handleUpdateFieldLinking({ sourceFieldId });
  };



  // State for Dynamic Options
  // Initialize as enabled if options exist OR if explicitly marked as enabled
  const [dynamicOptionsEnabled, setDynamicOptionsEnabled] = useState(
    field.fieldLinking?.dynamicConfig?.options ? true : false
  );
  const [optionMappings, setOptionMappings] = useState<Record<string, { label: string; value: string }[]>>(
    field.fieldLinking?.dynamicConfig?.options || {}
  );

  // State for Date Constraints
  const [defaultDateRange, setDefaultDateRange] = useState<AdvancedDateRange>(
    field.fieldLinking?.dynamicConfig?.dateRange?.default || {}
  );
  const [dateMappings, setDateMappings] = useState<Record<string, AdvancedDateRange>>(
    field.fieldLinking?.dynamicConfig?.dateRange?.mappings || {}
  );

  // Linking Mode (basic vs advanced vs restriction)
  const [linkingMode, setLinkingMode] = useState<'basic' | 'advanced' | 'restriction'>(
    field.fieldLinking?.mode || 'basic'
  );

  // validation for auto-fill rules - ensure each has either static value or copy-from field
  const [ruleErrors, setRuleErrors] = useState<(string | null)[]>(
    linkingRules.map(() => null)
  );

  if (!isOpen) return null;

  const handleUpdateDynamicOptions = (newMappings: typeof optionMappings) => {
    setOptionMappings(newMappings);
    updateFieldLinking({ options: newMappings });
  };

  const handleToggleDynamicOptions = (enabled: boolean) => {
    setDynamicOptionsEnabled(enabled);
    if (enabled) {
      // When enabling, save with current options (might be empty)
      updateFieldLinking({ options: optionMappings });
    } else {
      // When disabling, clear the options entirely
      setOptionMappings({});
      updateFieldLinking({ 
        options: undefined
      });
    }
  };

  const handleUpdateDefaultDateRange = (updates: Partial<AdvancedDateRange>) => {
    const newRange = { ...defaultDateRange, ...updates };
    setDefaultDateRange(newRange);
    updateFieldLinking({
      dateRange: {
        ...field.fieldLinking?.dynamicConfig?.dateRange,
        default: newRange,
        enabled: true
      }
    });
  };

  const handleUpdateDateMapping = (optionValue: string, updates: Partial<AdvancedDateRange>) => {
    const newMappings = {
      ...dateMappings,
      [optionValue]: {
        ...(dateMappings[optionValue] || {}),
        ...updates
      }
    };
    setDateMappings(newMappings);
    updateFieldLinking({
      dateRange: {
        ...field.fieldLinking?.dynamicConfig?.dateRange,
        mappings: newMappings,
        enabled: true
      }
    });
  };

  const updateFieldLinking = (dynamicConfigUpdates: any) => {
    onUpdate({
      fieldLinking: {
        ...field.fieldLinking,
        enabled: true,
        mode: linkingMode,
        sourceFieldId: selectedSourceField,
        rules: linkingRules,
        dynamicConfig: {
          ...field.fieldLinking?.dynamicConfig,
          ...dynamicConfigUpdates
        }
      }
    });
  };

  const handleModeChange = (mode: 'basic' | 'advanced' | 'restriction') => {
    setLinkingMode(mode);
    onUpdate({
      fieldLinking: {
        ...field.fieldLinking,
        enabled: true,
        mode: mode,
        sourceFieldId: selectedSourceField,
        rules: linkingRules,
        restrictionRules: restrictionRules,
      }
    });
  };

  const isSelectOrRadio = ['select', 'radio', 'multiselect', 'checkbox'].includes(field.type);
  const isDateOrTime = ['date', 'time'].includes(field.type);
  const isTextInput = ['text', 'email', 'tel', 'number', 'textarea'].includes(field.type);
  const dateFields = otherFields.filter(f => ['date', 'time'].includes(f.type));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl h-[95vh] flex flex-col shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between border-b py-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold">Field Linking Configuration</CardTitle>
            <p className="text-xs text-muted-foreground">Manage how this field reacts to other inputs.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden flex flex-col p-6">
          <div className="flex-1 overflow-y-auto space-y-8">
            {/* Modal Header Explanation */}
            <div className="p-4 bg-muted/50 rounded-lg border border-muted-foreground/10 text-sm leading-relaxed">
              <span className="font-semibold text-foreground">Rule Priority:</span> Mappings (Cascading/Ranges) restrict what a user can enter, while Rules automatically set a value. If both apply, the Rule's auto-filled value will take precedence.
            </div>

            {/* Linking Mode Selector */}
            <div className="flex p-1 bg-muted rounded-xl max-w-md mx-auto">
              <button
                onClick={() => handleModeChange('basic')}
                className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-all ${linkingMode === 'basic'
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-muted-foreground hover:text-muted-foreground'
                  }`}
              >
                Basic Mappings
              </button>
              <button
                onClick={() => handleModeChange('advanced')}
                className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-all ${linkingMode === 'advanced'
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-muted-foreground hover:text-muted-foreground'
                  }`}
              >
                Auto-fill Rules
              </button>
              <button
                onClick={() => handleModeChange('restriction')}
                className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-all ${linkingMode === 'restriction'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-muted-foreground hover:text-muted-foreground'
                  }`}
              >
                Restriction Rules
              </button>
            </div>

            {linkingMode === 'basic' && (
              /* Section 1: Basic Mappings (Primary Source Dependent) */
              <div className="space-y-4 p-5 border rounded-2xl bg-muted/50 shadow-sm">
                <div className="flex flex-col gap-1">
                  <Label className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <div className="h-6 w-1 bg-brand-600 rounded-full" />
                    Primary Mappings
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Configurations that depend on a single "Parent" field. Use this for standard Cascading or Dynamic Date Ranges.
                  </p>
                </div>

                <div className="space-y-4 bg-white p-5 rounded-xl border-2 border-border shadow-inner">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">1. Select Primary Source Field</Label>
                    <select
                      value={selectedSourceField}
                      onChange={(e) => handleSourceFieldChange(e.target.value)}
                      className="w-full rounded-lg border-2 border-border px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
                    >
                      <option value="">Select a parent field...</option>
                      {otherFields.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.label} ({f.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedSourceField && (
                    <div className="space-y-6 pt-4 mt-2 border-t border-border">
                      {/* Cascading Options Inside Primary Section */}
                      {isSelectOrRadio && (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="enableDynamicOptions"
                              checked={dynamicOptionsEnabled}
                              onChange={(e) => handleToggleDynamicOptions(e.target.checked)}
                              className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                            />
                            <Label htmlFor="enableDynamicOptions" className="text-sm font-bold cursor-pointer text-muted-foreground">
                              Enable Cascading Options
                            </Label>
                          </div>

                          {dynamicOptionsEnabled && (
                            <div className="space-y-4 pl-6 border-l-2 border-brand-200 py-1">
                              <p className="text-xs text-muted-foreground italic">Filter which options are available based on the parent selection.</p>
                              <div className="grid grid-cols-1 gap-3">
                                {otherFields.find(f => f.id === selectedSourceField)?.options?.map(sourceOpt => (
                                  <div key={sourceOpt.value} className="space-y-2 border border-border p-3 rounded-xl bg-muted/30">
                                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">When source is "{sourceOpt.label}":</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                      {(field.options || []).map(targetOpt => {
                                        const currentMapping = optionMappings[sourceOpt.value] || [];
                                        const isSelected = currentMapping.some(o => o.value === targetOpt.value);

                                        return (
                                          <div
                                            key={targetOpt.value}
                                            onClick={() => {
                                              const newMapping = { ...optionMappings };
                                              const currentList = newMapping[sourceOpt.value] || [];

                                              if (isSelected) {
                                                newMapping[sourceOpt.value] = currentList.filter(o => o.value !== targetOpt.value);
                                              } else {
                                                newMapping[sourceOpt.value] = [...currentList, targetOpt];
                                              }
                                              handleUpdateDynamicOptions(newMapping);
                                            }}
                                            className={`cursor-pointer px-3 py-1.5 rounded-lg text-[10px] uppercase font-black border-2 transition-all duration-200 ${isSelected
                                              ? 'bg-brand-600 border-brand-700 text-white shadow-md transform scale-105'
                                              : 'bg-white border-border text-muted-foreground hover:border-brand-200 hover:bg-brand-50/50'
                                              }`}
                                          >
                                            {targetOpt.label}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Date Ranges Inside Primary Section */}
                      {isDateOrTime && (
                        <div className="space-y-4">
                          <Label className="text-sm font-bold text-muted-foreground">2. Date Constraint Mappings</Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3 p-4 border-2 border-orange-100 rounded-xl bg-orange-50/20">
                              <Label className="text-xs font-black text-orange-800 uppercase tracking-widest">Global Defaults</Label>
                              <div className="space-y-3">
                                <DateConstraintPicker
                                  label="Min Default"
                                  constraint={undefined}
                                  variables={variables}
                                  dateFields={dateFields}
                                  onChange={(min) => handleUpdateDefaultDateRange({ min })}
                                  onClear={() => handleUpdateDefaultDateRange({ min: undefined })}
                                />
                                <DateConstraintPicker
                                  label="Max Default"
                                  constraint={undefined}
                                  variables={variables}
                                  dateFields={dateFields}
                                  onChange={(max) => handleUpdateDefaultDateRange({ max })}
                                  onClear={() => handleUpdateDefaultDateRange({ max: undefined })}
                                />
                              </div>
                              <p className="text-[10px] text-orange-600/70 italic mt-2">Note: These are also editable in the field sidebar.</p>
                            </div>

                            {['select', 'radio', 'multiselect', 'checkbox'].includes(otherFields.find(f => f.id === selectedSourceField)?.type || '') && (
                              <div className="space-y-3">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Option Overrides</Label>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                  {otherFields.find(f => f.id === selectedSourceField)?.options?.map(option => (
                                    <div key={option.value} className="p-4 border-2 border-border rounded-xl bg-white space-y-4 shadow-sm hover:border-brand-100 transition-colors">
                                      <Label className="text-[12px] font-bold text-foreground flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                                        If source is "{option.label}"
                                      </Label>
                                      <div className="space-y-4">
                                        <DateConstraintPicker
                                          label="Min Override"
                                          constraint={dateMappings[option.value]?.min || undefined}
                                          variables={variables}
                                          dateFields={dateFields}
                                          onChange={(min) => handleUpdateDateMapping(option.value, { min })}
                                        />
                                        <DateConstraintPicker
                                          label="Max Override"
                                          constraint={dateMappings[option.value]?.max || undefined}
                                          variables={variables}
                                          dateFields={dateFields}
                                          onChange={(max) => handleUpdateDateMapping(option.value, { max })}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!selectedSourceField && (
                    <div className="py-8 text-center bg-muted/50 rounded-xl border border-dashed border-border">
                      <p className="text-sm text-muted-foreground font-medium">Please select a primary source field to enable mappings.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {linkingMode === 'advanced' && (
              /* Section 2: Advanced Auto-fill Rules */
              <div className="space-y-4 p-5 border rounded-2xl bg-brand-50/30 border-brand-100 shadow-sm">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-bold flex items-center gap-2 text-brand-900">
                      <div className="h-6 w-1 bg-brand-600 rounded-full" />
                      Advanced Auto-fill Rules
                    </Label>
                    <Button onClick={handleAddRule} size="sm" className="bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-200 text-xs h-8">
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Rule
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Define complex logic triggered by one or more fields to set this field's value.
                  </p>
                </div>

                <div className="space-y-4">
                  {linkingRules.map((rule, ruleIndex) => (
                    <Card key={ruleIndex} className="p-0 border-2 border-brand-100 overflow-hidden shadow-sm bg-white">
                      <div className="p-4 bg-brand-50/50 border-b border-brand-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">
                            {ruleIndex + 1}
                          </div>
                          <Label className="font-bold text-brand-900">Auto-fill Policy</Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRule(ruleIndex)}
                          className="text-destructive hover:text-white hover:bg-destructive h-8 px-2"
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" />
                          <span className="text-xs font-bold">Delete</span>
                        </Button>
                      </div>

                      <div className="p-5 space-y-6">
                        {/* Conditions Block */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Trigger Conditions</Label>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">Match Type:</span>
                              <select
                                className="h-7 text-xs rounded-md border-2 border-border bg-white px-2 font-bold focus:border-brand-300 outline-none"
                                value={rule.logic || 'and'}
                                onChange={(e) => handleUpdateRule(ruleIndex, { logic: e.target.value })}
                              >
                                <option value="and">ALL (AND)</option>
                                <option value="or">ANY (OR)</option>
                              </select>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs border-2 border-brand-100 text-brand-700 hover:bg-brand-50"
                                onClick={() => {
                                  const conditions = rule.conditions || [];
                                  handleUpdateRule(ruleIndex, {
                                    conditions: [...conditions, newLinkingCondition()]
                                  });
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs border-2 border-brand-100 text-brand-700 hover:bg-brand-50"
                                onClick={() => {
                                  const conditions = rule.conditions || [];
                                  handleUpdateRule(ruleIndex, {
                                    conditions: [...conditions, newLinkingGroup((rule.logic || 'and') === 'and' ? 'or' : 'and')]
                                  });
                                }}
                              >
                                <FolderPlus className="h-3 w-3 mr-1" />
                                Add Group
                              </Button>
                            </div>
                          </div>

                          <LinkingConditionTree
                            nodes={rule.conditions && rule.conditions.length > 0 ? rule.conditions : [newLinkingCondition()]}
                            onChange={(conditions) => handleUpdateRule(ruleIndex, { conditions })}
                            otherFields={otherFields}
                            depth={1}
                            accent="purple"
                          />
                        </div>

                        {/* Action Block */}
                        <div className="pt-5 border-t border-brand-50 space-y-4">
                          <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Then...</Label>

                          {/* Auto-fill Value (for text-based fields only) */}
                          {isTextInput && (
                            <>
                              {/* mode selector */}
                              <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground">Auto-fill Mode</Label>
                                <select
                                  value={ruleModes[ruleIndex]}
                                  onChange={(e) => {
                                    const mode = e.target.value as 'value' | 'copy';
                                    setRuleModes(prev => {
                                      const arr = [...prev]; arr[ruleIndex] = mode; return arr;
                                    });
                                    // when switching modes we want to clear the value that is no longer relevant
                                    if (mode === 'copy') {
                                      // keep any previously entered targetValue so user can switch back
                                      handleUpdateRule(ruleIndex, { targetValue: '' });
                                    } else {
                                      handleUpdateRule(ruleIndex, { copyFromFieldId: '' });
                                    }
                                  }}
                                  className="w-full rounded-lg border-2 border-brand-50 h-10 text-xs px-2 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                                >
                                  <option value="value">Enter value</option>
                                  <option value="copy">Copy from field</option>
                                </select>
                              </div>

                              {ruleModes[ruleIndex] === 'value' && (
                                <div className="space-y-2">
                                  <Label className="text-xs font-semibold text-muted-foreground">Auto-fill Value (Optional)</Label>
                                  <Input
                                    value={String(rule.targetValue || '')}
                                    onChange={(e) => handleUpdateRule(ruleIndex, { targetValue: e.target.value })}
                                    placeholder="Automatically set this value..."
                                    className="h-10 border-2 border-brand-50 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 rounded-xl font-medium"
                                  />
                                  <p className="text-[10px] text-muted-foreground">This value will be automatically filled when conditions match.</p>
                                </div>
                              )}

                              {ruleModes[ruleIndex] === 'copy' && (
                                <div className="space-y-2">
                                  <Label className="text-xs font-semibold text-muted-foreground">Copy value from field</Label>
                                  <select
                                    value={rule.copyFromFieldId || ''}
                                    onChange={(e) => handleUpdateRule(ruleIndex, { copyFromFieldId: e.target.value })}
                                    className="w-full rounded-lg border-2 border-brand-50 h-10 text-xs px-2 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                                  >
                                    <option value="">(none)</option>
                                    {otherFields.map(f => (
                                      <option key={f.id} value={f.id}>{f.label}</option>
                                    ))}
                                  </select>
                                  <p className="text-[10px] text-muted-foreground">This field's current value will be copied when conditions match.</p>
                                </div>
                              )}

                              {ruleErrors[ruleIndex] && (
                                <div className="text-red-500 text-xs mt-1">{ruleErrors[ruleIndex]}</div>
                              )}
                            </>
                          )}

                          {/* Dynamic Options (for select/radio/checkbox only) */}
                          {isSelectOrRadio && (
                            <div className="space-y-3 p-4 bg-brand-50/30 rounded-xl border border-brand-100">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-brand-900">Available Options</Label>
                                <span className="text-[10px] text-brand-600 bg-brand-100 px-2 py-1 rounded">
                                  {field.options?.length || 0} total options
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">When conditions match, only these options will be available.</p>

                              <div className="space-y-2">
                                {field.options?.map((option: any, optIndex: number) => {
                                  const currentOptions = rule.dynamicOptions || [];
                                  const isSelected = currentOptions.some((opt: any) => opt.value === option.value);

                                  return (
                                    <div key={optIndex} className="flex items-center gap-2 group">
                                      <input
                                        type="checkbox"
                                        id={`option-${ruleIndex}-${optIndex}`}
                                        checked={isSelected}
                                        onChange={(e) => {
                                          let newOptions: any[] = [...currentOptions];
                                          if (e.target.checked) {
                                            newOptions.push(option);
                                          } else {
                                            newOptions = newOptions.filter((opt: any) => opt.value !== option.value);
                                          }
                                          handleUpdateRule(ruleIndex, { dynamicOptions: newOptions });
                                        }}
                                        className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
                                      />
                                      <Label 
                                        htmlFor={`option-${ruleIndex}-${optIndex}`}
                                        className="flex-1 text-sm cursor-pointer flex items-center justify-between"
                                      >
                                        <span>{option.label}</span>
                                        <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                                          {option.value}
                                        </span>
                                      </Label>
                                    </div>
                                  );
                                })}
                              </div>

                              {field.options?.length === 0 && (
                                <div className="text-center py-4 text-xs text-muted-foreground">
                                  No options defined. Add options in the field configuration panel.
                                </div>
                              )}
                            </div>
                          )}

                          {/* Date Range Constraints (for date/time only) */}
                          {isDateOrTime && (
                            <div className="grid grid-cols-2 gap-3 p-4 bg-brand-50/30 rounded-xl border border-brand-100">
                              <DateConstraintPicker
                                label="Limit Min"
                                constraint={rule.dateRange?.min}
                                variables={variables}
                                dateFields={dateFields}
                                onChange={(min) => handleUpdateRule(ruleIndex, { dateRange: { ...rule.dateRange, min } })}
                              />
                              <DateConstraintPicker
                                label="Limit Max"
                                constraint={rule.dateRange?.max}
                                variables={variables}
                                dateFields={dateFields}
                                onChange={(max) => handleUpdateRule(ruleIndex, { dateRange: { ...rule.dateRange, max } })}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}

                  {linkingRules.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-brand-100 rounded-2xl bg-white/50">
                      <p className="text-sm text-brand-300 font-bold uppercase tracking-widest">No Custom Rules Active</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {linkingMode === 'restriction' && (
              /* Section 3: Restriction Rules */
              <div className="space-y-4 p-5 border rounded-2xl bg-orange-50/30 border-orange-100 shadow-sm">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-bold flex items-center gap-2 text-orange-900">
                      <div className="h-6 w-1 bg-orange-600 rounded-full" />
                      Restriction Rules
                    </Label>
                    <Button onClick={handleAddRestrictionRule} size="sm" className="bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-200 text-xs h-8">
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Rule
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Define conditions to make fields required or disabled based on other field values.
                  </p>
                </div>

                <div className="space-y-4">
                  {restrictionRules.map((rule, ruleIndex) => (
                    <Card key={ruleIndex} className="p-0 border-2 border-orange-100 overflow-hidden shadow-sm bg-white">
                      <div className="p-4 bg-orange-50/50 border-b border-orange-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-bold">
                            {ruleIndex + 1}
                          </div>
                          <Label className="font-bold text-orange-900">Restriction Policy</Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRestrictionRule(ruleIndex)}
                          className="text-destructive hover:text-white hover:bg-destructive h-8 px-2"
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" />
                          <span className="text-xs font-bold">Delete</span>
                        </Button>
                      </div>

                      <div className="p-5 space-y-6">
                        {/* Conditions Block */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">When Conditions Match</Label>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">Match Type:</span>
                              <select
                                className="h-7 text-xs rounded-md border-2 border-border bg-white px-2 font-bold focus:border-orange-300 outline-none"
                                value={rule.logic || 'and'}
                                onChange={(e) => handleUpdateRestrictionRule(ruleIndex, { logic: e.target.value })}
                              >
                                <option value="and">ALL (AND)</option>
                                <option value="or">ANY (OR)</option>
                              </select>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs border-2 border-orange-100 text-orange-700 hover:bg-orange-50"
                                onClick={() => {
                                  const conditions = rule.conditions || [];
                                  handleUpdateRestrictionRule(ruleIndex, {
                                    conditions: [...conditions, newLinkingCondition()]
                                  });
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs border-2 border-orange-100 text-orange-700 hover:bg-orange-50"
                                onClick={() => {
                                  const conditions = rule.conditions || [];
                                  handleUpdateRestrictionRule(ruleIndex, {
                                    conditions: [...conditions, newLinkingGroup((rule.logic || 'and') === 'and' ? 'or' : 'and')]
                                  });
                                }}
                              >
                                <FolderPlus className="h-3 w-3 mr-1" />
                                Add Group
                              </Button>
                            </div>
                          </div>

                          <LinkingConditionTree
                            nodes={rule.conditions && rule.conditions.length > 0 ? rule.conditions : [newLinkingCondition()]}
                            onChange={(conditions) => handleUpdateRestrictionRule(ruleIndex, { conditions })}
                            otherFields={otherFields}
                            depth={1}
                            accent="orange"
                          />
                        </div>

                        {/* Action Block */}
                        <div className="pt-5 border-t border-orange-50 space-y-4">
                          <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Then Apply...</Label>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold text-muted-foreground">Action Type</Label>
                              <select
                                className="w-full h-10 border-2 border-orange-50 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 rounded-xl font-medium"
                                value={(rule as any).action || 'required'}
                                onChange={(e) => handleUpdateRestrictionRule(ruleIndex, { action: e.target.value as 'required' | 'disabled' })}
                              >
                                <option value="required">Make Field Required</option>
                                <option value="disabled">Disable Field</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs font-semibold text-muted-foreground">Apply Action</Label>
                              <select
                                className="w-full h-10 border-2 border-orange-50 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 rounded-xl font-medium"
                                value={(rule as any).apply !== false ? 'true' : 'false'}
                                onChange={(e) => handleUpdateRestrictionRule(ruleIndex, { apply: e.target.value === 'true' })}
                              >
                                <option value="true">Enable (Apply Action)</option>
                                <option value="false">Disable (Remove Action)</option>
                              </select>
                            </div>
                          </div>

                          <div className="p-3 bg-orange-100/50 rounded-lg border border-orange-200">
                            <p className="text-xs text-orange-800">
                              <strong>{(rule as any).action === 'required' ? 'Required' : 'Disabled'} Field:</strong> This field will be {(rule as any).apply !== false ? '' : 'NOT '} {(rule as any).action === 'required' ? 'required' : 'disabled'} when the above conditions are met.
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {restrictionRules.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-orange-100 rounded-2xl bg-white/50">
                      <p className="text-sm text-orange-300 font-bold uppercase tracking-widest">No Restriction Rules Active</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <div className="p-6 border-t bg-muted/80 flex items-center justify-between">
          <div className="text-[10px] text-muted-foreground max-w-[50%] leading-tight">
            Changes are applied only when you click <span className="font-bold">Save Changes</span>. Source fields must exist for linking to work in production.
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="rounded-xl border-2 hover:bg-white text-xs font-bold px-6">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={linkingMode === 'advanced' && ruleErrors.some(e => e !== null)}
              className="bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-200 rounded-xl text-xs font-bold px-8 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
