import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Trash2, Plus, Calculator, X, Code2, Play } from 'lucide-react';
import type { FormField, FormVariable } from '../../types';
import { CalculationEngine } from '../../lib/calculationEngine';

interface VariableManagerProps {
  variables: FormVariable[];
  fields: FormField[];
  onUpdateVariables: (variables: FormVariable[]) => void;
}

export default function VariableManager({ variables, fields, onUpdateVariables }: VariableManagerProps) {
  const [newVariable, setNewVariable] = useState({
    name: '',
    type: 'number' as const,
    description: '',
    mode: 'formula' as 'formula' | 'function' | 'mapping',
    calculation: '',
    functionParameters: [] as { fieldId: string; paramName: string }[],
    functionBody: '',
    valueMapping: {
      enabled: false,
      sourceFieldId: '',
      mappings: {} as Record<string, number | string>
    }
  });
  const [calcError, setCalcError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const addVariable = () => {
    if (!newVariable.name.trim()) {
      alert('Please enter a variable name');
      return;
    }

    let variable: FormVariable;

    if (newVariable.mode === 'function') {
      if (!newVariable.functionBody.trim()) {
        alert('Please enter a function body');
        return;
      }
      if (newVariable.functionParameters.some(p => !p.fieldId || !p.paramName.trim())) {
        alert('All parameters must have a field and a parameter name');
        return;
      }
      variable = {
        id: `var_${Date.now()}`,
        name: newVariable.name.trim(),
        type: newVariable.type,
        description: newVariable.description.trim(),
        mode: 'function',
        functionParameters: newVariable.functionParameters,
        functionBody: newVariable.functionBody.trim(),
        dependencies: newVariable.functionParameters.map(p => p.fieldId),
        value: undefined,
        computed: false,
      };
    } else if (newVariable.mode === 'mapping') {
      variable = {
        id: `var_${Date.now()}`,
        name: newVariable.name.trim(),
        type: newVariable.type,
        description: newVariable.description.trim(),
        mode: 'mapping',
        calculation: '',
        dependencies: [],
        value: undefined,
        computed: false,
        valueMapping: newVariable.valueMapping,
      };
    } else {
      if (!newVariable.calculation.trim()) {
        alert('Please enter a calculation formula');
        return;
      }
      const engine = new CalculationEngine(variables, {});
      const validation = engine.validateExpression(newVariable.calculation.trim());
      if (!validation.valid) {
        alert(`Formula error: ${validation.error || 'invalid syntax'}`);
        return;
      }
      const storedCalculation = convertLabelsToIds(newVariable.calculation.trim());
      variable = {
        id: `var_${Date.now()}`,
        name: newVariable.name.trim(),
        type: newVariable.type,
        description: newVariable.description.trim(),
        mode: 'formula',
        calculation: storedCalculation,
        dependencies: extractDependencies(storedCalculation),
        value: undefined,
        computed: false,
        valueMapping: undefined,
      };
    }

    const newVariables = [...variables, variable];
    onUpdateVariables(newVariables);

    setNewVariable({
      name: '',
      type: 'number',
      description: '',
      mode: 'formula',
      calculation: '',
      functionParameters: [],
      functionBody: '',
      valueMapping: { enabled: false, sourceFieldId: '', mappings: {} }
    });
    setTestResult(null);
  };

  const removeVariable = (id: string) => {
    const newVariables = variables.filter(v => v.id !== id);
    onUpdateVariables(newVariables);
    console.log('🗑️ Variable removed. Remaining:', newVariables.length);
  };

  const extractDependencies = (calculation: string): string[] => {
    const dependencies: string[] = [];

    // Extract field IDs (match by ID or label)
    fields.forEach(field => {
      if (calculation.includes(field.id) || calculation.includes(field.label)) {
        dependencies.push(field.id);
      }
    });

    // Extract other variable names (to allow cross-variable calculations)
    variables.forEach(v => {
      if (calculation.includes(v.name) || calculation.includes(v.id)) {
        dependencies.push(v.id);
      }
    });

    return [...new Set(dependencies)];
  };

  // Replace field IDs and table column IDs with readable labels for display
  const getDisplayFormula = (calculation: string): string => {
    let display = calculation;

    // Replace table aggregate calls: tableSum("fieldId", "colId") → tableSum("Field Label", "Col Label")
    fields.forEach(field => {
      if (field.type === 'table' && field.tableConfig?.columns) {
        field.tableConfig.columns.forEach(col => {
          // Replace quoted column IDs inside table function calls
          display = display.replaceAll(`"${col.id}"`, `"${col.label}"`);
        });
        // Replace quoted field IDs
        display = display.replaceAll(`"${field.id}"`, `"${field.label}"`);
      }
    });

    // Replace bare field IDs with labels
    fields.forEach(field => {
      if (display.includes(field.id)) {
        display = display.replaceAll(field.id, field.label);
      }
    });

    return display;
  };

  // Map a dependency ID to its field label (also checks table columns)
  const getDependencyLabel = (depId: string): string => {
    const field = fields.find(f => f.id === depId);
    if (field) return field.label;
    const variable = variables.find(v => v.id === depId);
    if (variable) return variable.name;
    // Check table column IDs
    for (const f of fields) {
      if (f.type === 'table' && f.tableConfig?.columns) {
        const col = f.tableConfig.columns.find(c => c.id === depId);
        if (col) return `${f.label} › ${col.label}`;
      }
    }
    return depId;
  };

  // Convert field labels back to IDs for internal storage
  const convertLabelsToIds = (formula: string): string => {
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let result = formula;
    // Sort by label length descending to avoid partial replacements
    // e.g., "Full Name" should be replaced before "Name"
    const sortedFields = [...fields].sort((a, b) => b.label.length - a.label.length);
    sortedFields.forEach(field => {
      const escapedLabel = escapeRegex(field.label);
      const regex = new RegExp(`\\b${escapedLabel}\\b`, 'g');
      result = result.replace(regex, field.id);
    });
    return result;
  };

  const addFunctionParam = () => {
    setNewVariable(prev => ({
      ...prev,
      functionParameters: [...prev.functionParameters, { fieldId: '', paramName: '' }]
    }));
  };

  const updateFunctionParam = (index: number, key: 'fieldId' | 'paramName', value: string) => {
    setNewVariable(prev => {
      const updated = [...prev.functionParameters];
      updated[index] = { ...updated[index], [key]: value };
      // auto-fill paramName from field label if not yet set
      if (key === 'fieldId' && !updated[index].paramName) {
        const field = fields.find(f => f.id === value);
        if (field) {
          updated[index].paramName = field.label.replace(/\s+/g, '_').replace(/[^\w]/g, '').toLowerCase();
        }
      }
      return { ...prev, functionParameters: updated };
    });
  };

  const removeFunctionParam = (index: number) => {
    setNewVariable(prev => ({
      ...prev,
      functionParameters: prev.functionParameters.filter((_, i) => i !== index)
    }));
  };

  const handleTestFunction = () => {
    try {
      const params = newVariable.functionParameters;
      const paramNames = params.map(p => p.paramName);
      // use sample values: numeric fields get 1, others get empty string
      const paramValues = params.map(p => {
        const field = fields.find(f => f.id === p.fieldId);
        return field?.type === 'number' ? 1 : '';
      });
      const fn = new Function(...paramNames, newVariable.functionBody);
      const result = fn(...paramValues);
      setTestResult(`Result: ${result}`);
    } catch (e: any) {
      setTestResult(`Error: ${e.message}`);
    }
  };

  const handleInsert = (value: string) => {
    // Append or insert at end
    setNewVariable(prev => ({
      ...prev,
      calculation: prev.calculation + (prev.calculation && !prev.calculation.endsWith(' ') ? ' ' : '') + value
    }));
  };

  const handleMappingChange = (optionValue: string, mappedValue: string) => {
    setNewVariable(prev => ({
      ...prev,
      valueMapping: {
        ...prev.valueMapping,
        mappings: {
          ...prev.valueMapping.mappings,
          [optionValue]: newVariable.type === 'number' ? Number(mappedValue) : mappedValue
        }
      }
    }));
  };

  const handleRemoveVariableMapping = (optionValue: string) => {
    const newMappings = { ...newVariable.valueMapping.mappings };
    delete newMappings[optionValue];
    setNewVariable(prev => ({
      ...prev,
      valueMapping: {
        ...prev.valueMapping,
        mappings: newMappings
      }
    }));
  };

  const getSourceFieldOptions = () => {
    if (!newVariable.valueMapping.sourceFieldId) return [];
    const field = fields.find(f => f.id === newVariable.valueMapping.sourceFieldId);
    return field?.options || [];
  };

  return (
    <div className="space-y-6">
      {/* (outer modal now supplies header/description) */}

      {/* Create New Variable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Create New Variable
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Variable Name *</Label>
              <Input
                value={newVariable.name}
                onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                placeholder="e.g., totalAmount, userAge"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <select
                value={newVariable.type}
                onChange={(e) => setNewVariable({ ...newVariable, type: e.target.value as any })}
                className="w-full rounded border px-3 py-2"
              >
                <option value="number">Number</option>
                <option value="string">Text</option>
                <option value="boolean">True/False</option>
                <option value="date">Date</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description (Optional)</Label>
            <Input
              value={newVariable.description}
              onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
              placeholder="What this variable calculates"
            />
          </div>


          {/* Calculation Mode Selector */}
          <div className="space-y-2">
            <Label>Calculation Mode</Label>
            <div className="flex gap-2">
              {(['formula', 'function', 'mapping'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setNewVariable(prev => ({ ...prev, mode: m }))}
                  className={`flex-1 py-2 px-3 rounded border text-sm font-medium transition-colors ${newVariable.mode === m ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted'}`}
                >
                  {m === 'formula' ? 'Formula' : m === 'function' ? 'Custom Function' : 'Value Mapping'}
                </button>
              ))}
            </div>
          </div>

          {/* Formula mode */}
          {newVariable.mode === 'formula' && (
            <div className="space-y-2">
              <Label>Calculation Formula *</Label>
              <textarea
                value={newVariable.calculation}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewVariable({ ...newVariable, calculation: val });
                  const engine = new CalculationEngine(variables, {});
                  const res = engine.validateExpression(val);
                  setCalcError(res.valid ? null : res.error || 'Invalid expression');
                }}
                placeholder="e.g., field1 + field2 * 0.25 or addMonths('2026-03-10', -60)"
                className="w-full h-24 rounded border px-3 py-2 font-mono text-sm"
              />
              <div className="text-xs text-muted-foreground">
                Click the fields below to insert them into your formula or use the buttons to add common functions.
                <div className="mt-1">
                  <div>Use <code className="rounded bg-muted px-1">'YYYY-MM-DD'</code> for dates (quotes required).</div>
                  <div>Example: <code className="rounded bg-muted px-1">ageFromDate(dob, '2001-01-01')</code></div>
                  <div>Example: <code className="rounded bg-muted px-1">concat(firstName, ' ', lastName)</code></div>
                </div>
              </div>
              {calcError && <div className="text-xs text-destructive mt-1">{calcError}</div>}
            </div>
          )}

          {/* Custom Function mode */}
          {newVariable.mode === 'function' && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted">
              {/* Parameters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Parameters</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addFunctionParam}>
                    <Plus className="h-3 w-3 mr-1" /> Add Parameter
                  </Button>
                </div>
                {newVariable.functionParameters.length === 0 && (
                  <p className="text-xs text-muted-foreground">No parameters added. Add form fields as inputs to your function.</p>
                )}
                <div className="space-y-2">
                  {newVariable.functionParameters.map((param, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={param.fieldId}
                        onChange={(e) => updateFunctionParam(i, 'fieldId', e.target.value)}
                        className="flex-1 h-8 rounded border border-input px-2 text-sm bg-background"
                      >
                        <option value="">— select field —</option>
                        {fields.map(f => (
                          <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                      </select>
                      <Input
                        value={param.paramName}
                        onChange={(e) => updateFunctionParam(i, 'paramName', e.target.value)}
                        placeholder="param name"
                        className="flex-1 h-8 text-sm font-mono"
                      />
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeFunctionParam(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Function Body */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1">
                  <Code2 className="h-3.5 w-3.5" /> Function Body
                </Label>
                {newVariable.functionParameters.length > 0 && (
                  <p className="text-xs text-muted-foreground font-mono">
                    // Available: {newVariable.functionParameters.map(p => p.paramName).filter(Boolean).join(', ')}
                  </p>
                )}
                <textarea
                  value={newVariable.functionBody}
                  onChange={(e) => setNewVariable(prev => ({ ...prev, functionBody: e.target.value }))}
                  placeholder={`// Write your logic and return a value\nif (quantity > 10) {\n  return quantity * unitPrice * 0.9;\n}\nreturn quantity * unitPrice;`}
                  className="w-full h-40 rounded border px-3 py-2 font-mono text-sm bg-white"
                  spellCheck={false}
                />
              </div>

              {/* Test */}
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={handleTestFunction} className="flex items-center gap-1">
                  <Play className="h-3.5 w-3.5" /> Test Function
                </Button>
                {testResult && (
                  <span className={`text-sm font-mono px-2 py-1 rounded ${testResult.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                    {testResult}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Test runs with sample values (numbers = 1, text = "").</p>
            </div>
          )}

          {/* Value Mapping mode */}
          {newVariable.mode === 'mapping' && (
            <div className="space-y-4 border p-4 rounded bg-muted">
              <div className="space-y-2">
                <Label>Source Field</Label>
                <select
                  value={newVariable.valueMapping.sourceFieldId}
                  onChange={(e) => setNewVariable({
                    ...newVariable,
                    valueMapping: { ...newVariable.valueMapping, sourceFieldId: e.target.value, enabled: true }
                  })}
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="">Select a field</option>
                  {fields.filter(f => ['select', 'radio', 'multiselect'].includes(f.type)).map(f => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              {newVariable.valueMapping.sourceFieldId && (
                <div className="space-y-2">
                  <Label>Map Options to Values</Label>
                  <div className="grid gap-2">
                    {getSourceFieldOptions().map(opt => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <span className="text-sm min-w-[100px]">{opt.label}:</span>
                        <Input
                          value={newVariable.valueMapping.mappings[opt.value] || ''}
                          onChange={(e) => handleMappingChange(opt.value, e.target.value)}
                          placeholder="Mapped Value"
                          type={newVariable.type === 'number' ? 'number' : 'text'}
                          className="flex-1"
                        />
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveVariableMapping(opt.value)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {newVariable.mode === 'formula' && (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium">Available Fields (Click to insert):</Label>

                {/* Regular (non-table) fields */}
                <div className="flex flex-wrap gap-2">
                  {fields.filter(f => f.type !== 'table').map(field => (
                    <button
                      key={field.id}
                      onClick={() => handleInsert(field.label)}
                      className="text-xs bg-muted hover:bg-secondary border border-border px-2 py-1 rounded flex items-center gap-1 transition-colors"
                      title={`Insert: ${field.label}`}
                    >
                      <span className="font-semibold">{field.label}</span>
                      <Plus className="h-3 w-3 ml-1 opacity-50" />
                    </button>
                  ))}
                </div>

                {/* Table fields — expanded into columns */}
                {fields.filter(f => f.type === 'table' && f.tableConfig?.columns?.length).map(field => (
                  <div key={field.id} className="rounded-md border border-border bg-muted p-3 space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {field.label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {/* Row count chip — available for any table */}
                      <button
                        onClick={() => handleInsert(`tableCount("${field.id}")`)}
                        className="text-xs bg-plum-50 hover:bg-plum-100 border border-plum-200 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        title={`Number of rows in ${field.label}`}
                      >
                        <span className="font-semibold text-plum-700">Row Count</span>
                        <Plus className="h-3 w-3 ml-1 opacity-50 text-plum-500" />
                      </button>

                      {/* Per-column aggregate chips — only number & calculated columns */}
                      {field.tableConfig!.columns
                        .filter(col => col.type === 'number' || col.type === 'calculated')
                        .map(col => (
                          <div key={col.id} className="flex items-center gap-1">
                            {/* Sum */}
                            <button
                              onClick={() => handleInsert(`tableSum("${field.id}", "${col.id}")`)}
                              className="text-xs bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                              title={`Sum of "${col.label}" in ${field.label}`}
                            >
                              <span className="font-semibold text-emerald-700">
                                Sum of {col.label}
                              </span>
                              <Plus className="h-3 w-3 ml-0.5 opacity-50 text-emerald-500" />
                            </button>
                            {/* Avg */}
                            <button
                              onClick={() => handleInsert(`tableAvg("${field.id}", "${col.id}")`)}
                              className="text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                              title={`Average of "${col.label}" in ${field.label}`}
                            >
                              <span className="font-semibold text-amber-700">
                                Avg of {col.label}
                              </span>
                              <Plus className="h-3 w-3 ml-0.5 opacity-50 text-amber-500" />
                            </button>
                          </div>
                        ))}
                    </div>
                    {field.tableConfig!.columns.filter(c => c.type === 'number' || c.type === 'calculated').length === 0 && (
                      <p className="text-[10px] text-muted-foreground italic">
                        No numeric columns — add a Number or Calculated column to use aggregate functions.
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {variables.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Available Variables (Click to insert):</Label>
                  <div className="flex flex-wrap gap-2">
                    {variables.map(v => (
                      <button
                        key={v.id}
                        onClick={() => handleInsert(v.name)}
                        className="text-xs bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        title={`Click to insert variable ${v.name}`}
                      >
                        <span className="font-semibold text-brand-700">{v.name}</span>
                        <Plus className="h-3 w-3 ml-1 opacity-50 text-brand-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Functions (Click to insert):</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Sum', insert: 'sum(', syntax: 'sum(a, b, ...)' },
                    { label: 'Avg', insert: 'avg(', syntax: 'avg(a, b, ...)' },
                    { label: 'Age', insert: 'age(', syntax: 'age(dob_field)' },
                    { label: 'Age From Date', insert: 'ageFromDate(', syntax: 'ageFromDate(dob, target)' },
                    { label: 'Add Days', insert: 'addDays(', syntax: 'addDays(date, n)' },
                    { label: 'Add Months', insert: 'addMonths(', syntax: 'addMonths(date, n)' },
                    { label: 'Add Years', insert: 'addYears(', syntax: 'addYears(date, n)' },
                    { label: 'Concat', insert: 'concat(', syntax: 'concat(s1, s2, ...)' },
                    { label: 'Abs', insert: 'abs(', syntax: 'abs(number)' },
                    { label: 'Floor', insert: 'floor(', syntax: 'floor(number)' },
                    { label: 'Ceil', insert: 'ceil(', syntax: 'ceil(number)' },
                    { label: 'Pow', insert: 'pow(', syntax: 'pow(base, exponent)' },
                    { label: 'Sqrt', insert: 'sqrt(', syntax: 'sqrt(number)' },
                    { label: 'Min', insert: 'Math.min(', syntax: 'Math.min(a, b)' },
                    { label: 'Max', insert: 'Math.max(', syntax: 'Math.max(a, b)' },
                  ].map(f => (
                    <button
                      key={f.label}
                      onClick={() => handleInsert(f.insert)}
                      className="text-xs bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-2 rounded flex flex-col items-start gap-0.5 transition-colors"
                      title={f.syntax}
                    >
                      <span className="font-semibold text-brand-700 leading-tight">{f.label}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{f.syntax}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Button onClick={addVariable} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Create Variable
          </Button>
        </CardContent>
      </Card>

      {/* Existing Variables */}
      {variables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Existing Variables ({variables.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {variables.map((variable) => (
              <div key={variable.id} className="p-4 border rounded-lg bg-muted">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium">{variable.name}</h4>
                    <div className="text-sm text-muted-foreground">{variable.description}</div>
                    <div className="text-xs text-muted-foreground">
                      Type: <span className="font-medium">{variable.type}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVariable(variable.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {variable.mode === 'function' ? (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      Params: {(variable.functionParameters || []).map(p => {
                        const f = fields.find(f => f.id === p.fieldId);
                        return `${p.paramName} (${f?.label || p.fieldId})`;
                      }).join(', ') || 'none'}
                    </div>
                    <pre className="font-mono text-xs bg-white p-2 rounded border overflow-x-auto">{variable.functionBody}</pre>
                  </div>
                ) : (
                  <div className="font-mono text-xs bg-white p-2 rounded border">
                    {variable.mode === 'mapping' ? `Value Mapping from ${getDependencyLabel(variable.valueMapping?.sourceFieldId || '')}` : getDisplayFormula(variable.calculation || '')}
                  </div>
                )}
                {(variable.dependencies || []).length > 0 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Depends on: {(variable.dependencies || []).map(dep => getDependencyLabel(dep)).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
