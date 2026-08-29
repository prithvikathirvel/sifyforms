import { useState, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { X, Plus, Trash2, Shield, Settings, Calculator, Link, Eye, EyeOff, Database, Loader2, Wand2, Globe, FileSpreadsheet, AlertCircle, FileText, ClipboardCheck, BarChart2 } from 'lucide-react';
import type { FormField, ShowConditionOperator, ShowWhenNode, FormVariable, DateConstraint, TableValidationRule, TableValidationRuleType, LinkingConditionNode } from '../../types';
import { isShowWhenGroup, isLinkingGroup } from '../../types';
import { AdvancedLinkingModal } from './AdvancedLinkingModal';
import { replaceSchema, setAISessionId } from '../../store/builderSlice';
import api from '../../lib/api';
import { ConditionalVisibilityModal } from './ConditionalVisibilityModal';
import VariableManager from './VariableManager';
import { MultiSelectConfig } from './MultiSelectField';
import { DisplayFieldConfig } from './DisplayField';
import { ValidationModal } from './ValidationModal';
import { ExternalValidationModal } from './ExternalValidationModal';
import { CustomAlertModal } from './CustomAlertModal';
import { SupportDocumentsModal } from './SupportDocumentsModal';
import { TableConfigModal } from './TableConfigModal';
import { Accordion, AccordionItem } from '../ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';

/** Human-readable summary of a Smart Connection condition tree, e.g. `A equals 1 AND (B equals 2 OR C equals 3)` */
function describeLinkingConditions(
  nodes: LinkingConditionNode[],
  logic: 'and' | 'or',
  fields: FormField[]
): string {
  return nodes
    .map((node) =>
      isLinkingGroup(node)
        ? `(${describeLinkingConditions(node.conditions || [], node.logic, fields)})`
        : `${fields.find(f => f.id === node.fieldId)?.label || node.fieldId} ${node.operator} ${node.value}`
    )
    .join(` ${logic.toUpperCase()} `);
}

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

/** Count leaf conditions in a (possibly nested) show-when rule */
const countShowWhenConditions = (nodes: ShowWhenNode[]): number =>
  nodes.reduce(
    (sum, node) => sum + (isShowWhenGroup(node) ? countShowWhenConditions(node.conditions) : 1),
    0
  );

import CSVImportModal from './CSVImportModal';

interface FieldInspectorProps {
  field?: FormField | null;
  allFields?: FormField[];
  variables?: FormVariable[];
  formId?: string; // needed when invoking AI editing endpoint
  onUpdate: (updates: Partial<FormField>) => void;
  onUpdateVariables?: (variables: FormVariable[]) => void;
  onClose: () => void;
  onDelete?: (fieldId: string) => void;
  onDuplicate?: (fieldId: string) => void;
}

export function DateConstraintPicker({ label, constraint, onChange, variables, dateFields, onClear }: {
  label: string;
  constraint?: DateConstraint;
  onChange: (constraint: DateConstraint) => void;
  variables: FormVariable[];
  dateFields: FormField[];
  onClear?: () => void;
}) {
  const type = constraint?.type || 'static';
  const value = constraint?.value || '';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</Label>
        {onClear && constraint && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-4 px-1 text-[10px] text-destructive hover:bg-destructive/10">
            Clear
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">
        <select
          className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm"
          value={type}
          onChange={(e) => onChange({ type: e.target.value as any, value: '' })}
        >
          <option value="static">Static Date</option>
          <option value="variable">Variable</option>
          <option value="field">Date Field</option>
        </select>
        <div className="flex-1 min-w-0">
          {type === 'static' && (
            <Input
              type="date"
              className="h-8 text-xs px-2"
              value={value}
              onChange={(e) => onChange({ type, value: e.target.value })}
            />
          )}
          {type === 'variable' && (
            <select
              className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm"
              value={value}
              onChange={(e) => onChange({ type, value: e.target.value })}
            >
              <option value="">Select Variable</option>
              {variables.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          )}
          {type === 'field' && (
            <select
              className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm"
              value={value}
              onChange={(e) => onChange({ type, value: e.target.value })}
            >
              <option value="">Select Field</option>
              {dateFields.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FieldInspector({
  field,
  allFields = [],
  variables = [],
  formId,
  onUpdate,
  onUpdateVariables,
  onClose,
}: FieldInspectorProps) {
  const dispatch = useAppDispatch();
  const aiSessionId = useAppSelector((state) => state.builder.aiSessionId);
  const formType = useAppSelector((state) => state.builder.settings.formType);
  const dmsEnabled = useAppSelector((state) => state.builder.settings.dms?.enabled) || false;
  const currentOrg = useAppSelector((state) => state.org.currentOrg);

  const [showAdvancedLinkingModal, setShowAdvancedLinkingModal] = useState(false);
  const [showVariableManager, setShowVariableManager] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [isExtValidationModalOpen, setIsExtValidationModalOpen] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showTableConfigModal, setShowTableConfigModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);

  // AI prompt modal state
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [isAISubmitting, setIsAISubmitting] = useState(false);

  const handleUpdateVariables = (newVariables: FormVariable[]) => {
    console.log('🔄 handleUpdateVariables called with:', newVariables.length, 'variables');
    if (onUpdateVariables) {
      onUpdateVariables(newVariables);
    } else {
      console.error('❌ onUpdateVariables is undefined');
    }
  };

  if (!field) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3.5">
          <h3 className="text-[13px] font-semibold text-foreground">Field Inspector</h3>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Settings className="h-6 w-6" />
          </div>
          <p className="text-[13px] leading-5 text-muted-foreground">
            Select any field on the canvas to edit its properties, validation rules, and smart connections.
          </p>
        </div>
      </div>
    );
  }

  const hasOptions = ['select', 'multiselect', 'radio', 'checkbox'].includes(field.type);
  const otherFields = allFields.filter(f => f.id !== field.id);
  // TODO: Task List
  // - [x] Fix template visibility (protected routes & backend logic) [/]
  // - [x] Move form actions to a dropdown menu in FormBuilderPage header [/]
  // - [x] Add JSON export functionality to the form actions menu [/]
  // - [x] Enhance theme selection with color swatches in SettingsModal [/]
  // - [x] Fix theme reflection issue in PublicFormPage [/]
  // - [x] Unify Template Selection into Create Form Modal flow [/]
  // - [x] Simplify Template Selection UI (remove categories) and order by Organization templates first [/]
  // - [x] Verify all changes and ensure correct behavior [/]

  const addOption = () => {
    const options = field.options || [];
    const newOption = {
      label: `Option ${options.length + 1}`,
      value: `option${options.length + 1}`,
    };
    onUpdate({ options: [...options, newOption] });
  };

  const removeOption = (index: number) => {
    const options = field.options?.filter((_, i) => i !== index) || [];
    onUpdate({ options });
  };

  const updateOption = (index: number, updates: { label?: string; value?: string }) => {
    const options = field.options?.map((opt, i) =>
      i === index ? { ...opt, ...updates } : opt
    ) || [];
    onUpdate({ options });
  };

  // call backend AI endpoint to modify current form schema
  const handleAISubmit = async () => {
    if (!formId) {
      console.error('No form id available for AI request');
      return;
    }
    setIsAISubmitting(true);
    const url = `/forms/${formId}/ai-edit`;
    const payload: any = { prompt: aiPrompt };
    if (aiSessionId) {
      payload.sessionId = aiSessionId;
    }

    console.log('🔗 AI edit request url:', url);
    console.log('📤 AI edit payload:', payload);

    try {
      const response = await api.post(url, payload);
      console.log('📥 AI edit response data:', response.data);
      const { schema: newSchema, sessionId: newSession } = response.data;
      if (newSchema) {
        dispatch(replaceSchema(newSchema));
      }
      if (newSession) {
        dispatch(setAISessionId(newSession));
      }
      setShowAIModal(false);
      setAIPrompt('');
    } catch (err) {
      console.error('AI edit request failed', err);
      // Optionally show a user notification here
    } finally {
      setIsAISubmitting(false);
    }
  };

  // Show When (Field Visibility) state
  const showWhen = field.showWhen;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3.5">
        <h3 className="text-[13px] font-semibold text-foreground">Field Inspector</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <Accordion>
        {/* Basic Properties */}
        <AccordionItem
          title="Basic Properties"
          subtitle="Label, placeholder, and help text"
          icon={<Settings className="h-4 w-4" />}
          defaultOpen={true}
        >
          <div className="space-y-4">
            {/* Label */}
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder="Field label"
              />
            </div>

            {/* Placeholder */}
            {!['checkbox', 'radio', 'file', 'rating', 'signature', 'display', 'table'].includes(field.type) && (
              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={field.placeholder || ''}
                  onChange={(e) => onUpdate({ placeholder: e.target.value })}
                  placeholder="Placeholder text"
                />
              </div>
            )}

            {/* Help Text */}
            <div className="space-y-2">
              <Label>Help Text</Label>
              <Input
                value={field.helpText || ''}
                onChange={(e) => onUpdate({ helpText: e.target.value })}
                placeholder="Additional instructions"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="required"
                checked={field.required}
                onChange={(e) => {
                  const required = e.target.checked;
                  onUpdate({
                    required,
                    unique: required ? field.unique : false
                  });
                }}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="required">Required field</Label>
            </div>

            {/* Unique — not applicable for table fields */}
            {field.type !== 'table' && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="unique"
                  checked={field.unique || false}
                  disabled={!field.required}
                  onChange={(e) => onUpdate({ unique: e.target.checked })}
                  className="h-4 w-4 rounded border-border disabled:opacity-50"
                />
                <Label
                  htmlFor="unique"
                  className={!field.required ? 'text-muted-foreground' : ''}
                >
                  Unique submission value
                </Label>
              </div>
            )}

            {/* Mutual Exclusion Group — only for option-based fields */}
            {['select', 'multiselect', 'radio', 'checkbox'].includes(field.type) && (
              <div className="space-y-2">
                <Label>Mutual Exclusion Group</Label>
                <Input
                  value={field.mutualExclusionGroup ?? ''}
                  onChange={(e) => onUpdate({ mutualExclusionGroup: e.target.value || undefined })}
                  placeholder="e.g. center_group"
                />
                <p className="text-[10px] text-muted-foreground">
                  Fields sharing the same group name will automatically hide each other's selected values from their options.
                </p>
              </div>
            )}

            {/* Field Width — not applicable for table fields (always full-width) */}
            {field.type !== 'table' && (
              <div className="space-y-2">
                <Label>Field Width</Label>
                <div className="flex gap-2">
                  {[
                    { value: 'full' as const, label: '100%', icon: '█' },
                    { value: 'half' as const, label: '50%', icon: '▌' },
                    { value: 'third' as const, label: '33%', icon: '▎' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onUpdate({ width: option.value })}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${(field.width || 'full') === option.value
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background text-muted-foreground border-input hover:bg-muted'
                        }`}
                    >
                      <div className="text-center">
                        <div className="text-sm mb-0.5">{option.icon}</div>
                        <div>{option.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Consecutive fields with the same width will appear side by side
                </p>
              </div>
            )}
          </div>
        </AccordionItem>

        {/* Constraints & Defaults Section */}
        {['text', 'email', 'phone', 'number', 'date', 'time', 'textarea'].includes(field.type) && (
          <AccordionItem
            title="Constraints & Defaults"
            subtitle="Set default values and min/max limits"
            icon={<Database className="h-4 w-4" />}
            defaultOpen={false}
          >
            <div className="space-y-4">
              {/* Default Value */}
              {['text', 'email', 'phone', 'number', 'date', 'time', 'textarea'].includes(field.type) && (
                <div className="space-y-2">
                  <Label>Default Value</Label>
                  <Input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
                    value={(field as any).defaultValue || ''}
                    onChange={(e) => onUpdate({ defaultValue: e.target.value || undefined })}
                    placeholder={`Enter default ${field.type}`}
                  />
                  <p className="text-[10px] text-muted-foreground">This value will appear when the form loads</p>
                </div>
              )}

              {/* Min Length / Min Value / Min Date */}
              {['text', 'email', 'phone', 'textarea'].includes(field.type) && (
                <div className="space-y-2">
                  <Label>Minimum Length (characters)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={(field.validation?.minLength) || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      onUpdate({
                        validation: {
                          ...field.validation,
                          minLength: val,
                        }
                      });
                    }}
                    placeholder="No minimum"
                  />
                </div>
              )}

              {field.type === 'number' && (
                <div className="space-y-2">
                  <Label>Minimum Value</Label>
                  <Input
                    type="number"
                    value={(field.validation?.min) ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseFloat(e.target.value) : undefined;
                      onUpdate({
                        validation: {
                          ...field.validation,
                          min: val,
                        }
                      });
                    }}
                    placeholder="No minimum"
                    step="any"
                  />
                </div>
              )}

              {['date', 'time'].includes(field.type) && (
                <div className="space-y-2">
                  <Label>Minimum {field.type === 'date' ? 'Date' : 'Time'}</Label>
                  <Input
                    type={field.type}
                    value={(field as any).minValue || ''}
                    onChange={(e) => onUpdate({ minValue: e.target.value || undefined })}
                    placeholder={`No minimum`}
                  />
                </div>
              )}

              {/* Max Length / Max Value / Max Date */}
              {['text', 'email', 'phone', 'textarea'].includes(field.type) && (
                <div className="space-y-2">
                  <Label>Maximum Length (characters)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={(field.validation?.maxLength) || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      onUpdate({
                        validation: {
                          ...field.validation,
                          maxLength: val,
                        }
                      });
                    }}
                    placeholder="No maximum"
                  />
                </div>
              )}

              {field.type === 'number' && (
                <div className="space-y-2">
                  <Label>Maximum Value</Label>
                  <Input
                    type="number"
                    value={(field.validation?.max) ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseFloat(e.target.value) : undefined;
                      onUpdate({
                        validation: {
                          ...field.validation,
                          max: val,
                        }
                      });
                    }}
                    placeholder="No maximum"
                    step="any"
                  />
                </div>
              )}

              {['date', 'time'].includes(field.type) && (
                <div className="space-y-2">
                  <Label>Maximum {field.type === 'date' ? 'Date' : 'Time'}</Label>
                  <Input
                    type={field.type}
                    value={(field as any).maxValue || ''}
                    onChange={(e) => onUpdate({ maxValue: e.target.value || undefined })}
                    placeholder={`No maximum`}
                  />
                </div>
              )}

              <div className="p-3 bg-plum-50 rounded-lg border border-plum-200">
                <p className="text-[10px] text-plum-800">
                  <strong>Note:</strong> These defaults apply when Smart Connections are not enabled. Smart Connection settings will override these values.
                </p>
              </div>
            </div>
          </AccordionItem>
        )}


        {hasOptions && (
          <AccordionItem
            title="Options Configuration"
            subtitle={`${field.options?.length || 0} option(s) configured`}
            icon={<Database className="h-4 w-4" />}
            defaultOpen={field.options && field.options.length > 0}
          >
            {field.type === 'multiselect' ? (
              <MultiSelectConfig 
                field={field} 
                onUpdate={onUpdate} 
                onBulkImport={() => setShowCSVImport(true)} 
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Options</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowCSVImport(true)}
                    className="h-7 text-[10px] gap-1 px-2"
                  >
                    <FileSpreadsheet className="h-3 w-3" />
                    Bulk Import (CSV)
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="space-y-2">
                    {(field.options || []).map((option, index) => (
                      <div key={`option-${index}`} className="flex items-center gap-2">
                        <Input
                          value={option.label}
                          onChange={(e) => updateOption(index, { label: e.target.value })}
                          placeholder="Option label"
                          className="flex-1"
                        />
                        <Input
                          value={option.value}
                          onChange={(e) => updateOption(index, { value: e.target.value })}
                          placeholder="Option value"
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={addOption}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </AccordionItem>
        )}

        {/* Display Field Configuration */}
        {field.type === 'display' && (
          <AccordionItem
            title="Display Configuration"
            subtitle="Variable display settings"
            icon={<Eye className="h-4 w-4" />}
            defaultOpen={true}
          >
            <DisplayFieldConfig
              field={field}
              variables={variables}
              onUpdate={onUpdate}
            />
          </AccordionItem>
        )}

        {/* Table Field Configuration */}
        {field.type === 'table' && (
          <AccordionItem
            title="Table Configuration"
            subtitle={`${field.tableConfig?.columns?.length ?? 0} column(s) configured`}
            icon={<Database className="h-4 w-4" />}
            defaultOpen={true}
          >
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => setShowTableConfigModal(true)}
                className="w-full bg-plum-50 hover:bg-plum-100 text-plum-700 border-plum-200"
              >
                <Database className="h-4 w-4 mr-2" />
                Configure Table Columns &amp; Settings
              </Button>

              {(field.tableConfig?.columns?.length ?? 0) > 0 && (
                <div className="text-xs text-muted-foreground bg-plum-50/50 p-3 rounded-lg border border-plum-100 space-y-1">
                  <p className="font-medium text-plum-800">
                    {field.tableConfig!.columns.length} column(s) &nbsp;·&nbsp;
                    {field.tableConfig!.defaultRows ?? 1} default row(s)
                    {field.tableConfig!.allowAddRows !== false ? ' · rows addable' : ''}
                    {field.tableConfig!.grandTotalColumn ? ' · grand total enabled' : ''}
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {field.tableConfig!.columns.map((c) => (
                      <li key={c.id}>
                        <span className="font-medium">{c.label}</span>{' '}
                        <span className="text-muted-foreground">({c.type})</span>
                        {c.type === 'calculated' && c.formula && (
                          <span className="font-mono ml-1 text-plum-700">= {c.formula}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AccordionItem>
        )}

        {/* File Configuration */}
        {field.type === 'file' && (
          <AccordionItem
            title="File Upload Settings"
            subtitle="Allowed file types and size limits"
            icon={<Database className="h-4 w-4" />}
            defaultOpen={true}
          >
            <div className="space-y-4">
              {/* Accept Types */}
              <div className="space-y-2">
                <Label>Allowed File Types</Label>
                <div className="space-y-2">
                  {(['image/*', '.pdf', '.doc,.docx', '.xls,.xlsx', '.txt'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.fileConfig?.accept?.includes(type) || false}
                        onChange={(e) => {
                          const current = field.fileConfig?.accept || [];
                          const updated = e.target.checked
                            ? [...current, type]
                            : current.filter(t => t !== type);
                          onUpdate({
                            fileConfig: {
                              ...field.fileConfig,
                              accept: updated.length > 0 ? updated : undefined
                            }
                          });
                        }}
                        className="h-4 w-4 rounded"
                      />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Min Size */}
              <div className="space-y-2">
                <Label>Minimum File Size (MB)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={(field.fileConfig?.minSize || 0) / (1024 * 1024)}
                  onChange={(e) => {
                    const sizeMB = parseInt(e.target.value) || 0;
                    onUpdate({
                      fileConfig: {
                        ...field.fileConfig,
                        minSize: sizeMB * 1024 * 1024
                      }
                    });
                  }}
                  placeholder="0"
                />
              </div>

              {/* Max Size */}
              <div className="space-y-2">
                <Label>Maximum File Size (MB)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={(field.fileConfig?.maxSize || 5242880) / (1024 * 1024)}
                  onChange={(e) => {
                    const sizeMB = parseInt(e.target.value) || 5;
                    onUpdate({
                      fileConfig: {
                        ...field.fileConfig,
                        maxSize: sizeMB * 1024 * 1024
                      }
                    });
                  }}
                  placeholder="5"
                />
              </div>

              {/* Multiple Files */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="multiple"
                  checked={field.fileConfig?.multiple || false}
                  onChange={(e) => onUpdate({
                    fileConfig: {
                      ...field.fileConfig,
                      multiple: e.target.checked
                    }
                  })}
                  className="h-4 w-4 rounded"
                />
                <Label htmlFor="multiple">Allow multiple files</Label>
              </div>
            </div>
          </AccordionItem>
        )}

        {/* External Validation */}
        <AccordionItem
          title="External Validation"
          subtitle={field.externalValidation?.enabled ? "Connected to " + field.externalValidation.url : "Verify value with a 3rd party API"}
          icon={<Globe className="h-4 w-4" />}
          defaultOpen={field.externalValidation?.enabled}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border gap-2">
              <div className="space-y-0.5 min-w-0 flex-1">
                <Label>API Configuration</Label>
                <p className="text-xs text-muted-foreground truncate" title={field.externalValidation?.url}>
                  {field.externalValidation?.enabled 
                    ? `Enabled (${field.externalValidation.method || 'POST'} ${field.externalValidation.url})` 
                    : 'Currently disabled.'}
                </p>
              </div>
              <Button size="sm" className="shrink-0" variant={field.externalValidation?.enabled ? "default" : "outline"} onClick={() => setIsExtValidationModalOpen(true)}>
                <Globe className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </div>
          </div>
        </AccordionItem>

        {/* Smart Connections - Renamed from Field Linking */}
        <AccordionItem
          title="Smart Connections"
          subtitle={
            field.fieldLinking?.enabled
              ? `Connected to "${otherFields.find(f => f.id === field.fieldLinking?.sourceFieldId)?.label || 'Unknown'}"`
              : "Connect fields with dynamic behavior"
          }
          icon={<Link className="h-4 w-4" />}
          defaultOpen={field.fieldLinking?.enabled}
        >
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => {
                console.log('Opening Advanced Linking Modal');
                setShowAdvancedLinkingModal(true);
              }}
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure Smart Connections
            </Button>

            {field.fieldLinking?.enabled && (
              <div className="text-xs text-muted-foreground bg-brand-50 p-3 rounded space-y-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-brand-500 rounded-full"></div>
                  <strong className="text-brand-900">Active Connection Configuration</strong>
                </div>

                {/* Mode and Source Field */}
                <div className="pl-3 space-y-1">
                  <div>
                    <span className="font-medium text-brand-800">Mode:</span>
                    <span className="ml-1 px-2 py-0.5 bg-brand-100 rounded text-brand-800 capitalize">
                      {field.fieldLinking.mode || 'basic'}
                    </span>
                  </div>

                  {field.fieldLinking.sourceFieldId && (
                    <div>
                      <span className="font-medium text-brand-800">Source:</span>
                      <span className="ml-1 text-brand-700">
                        "{otherFields.find(f => f.id === field.fieldLinking?.sourceFieldId)?.label || 'Unknown Field'}"
                      </span>
                    </div>
                  )}
                </div>

                {/* Auto-fill Rules */}
                {field.fieldLinking.rules && field.fieldLinking.rules.length > 0 && (
                  <div className="pl-3 border-l-2 border-brand-200">
                    <div className="font-medium text-brand-800 mb-1">Auto-fill Rules ({field.fieldLinking.rules.length}):</div>
                    {field.fieldLinking.rules.map((rule, index) => (
                      <div key={rule.id || index} className="text-brand-700 ml-2">
                        • {rule.conditions && rule.conditions.length > 0 ? (
                          <span>
                            {describeLinkingConditions(rule.conditions, rule.logic || 'and', otherFields)}
                          </span>
                        ) : rule.copyFromFieldId ? (
                          <span>
                            Copy from "{otherFields.find(f => f.id === rule.copyFromFieldId)?.label || rule.copyFromFieldId}"
                          </span>
                        ) : rule.sourceValue !== undefined ? (
                          <span>
                            Source {rule.operator || 'equals'} "{rule.sourceValue}" → "{rule.targetValue}"
                          </span>
                        ) : (
                          <span>Rule {index + 1}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Restriction Rules */}
                {field.fieldLinking.restrictionRules && field.fieldLinking.restrictionRules.length > 0 && (
                  <div className="pl-3 border-l-2 border-orange-200">
                    <div className="font-medium text-orange-800 mb-1">Restriction Rules ({field.fieldLinking.restrictionRules.length}):</div>
                    {field.fieldLinking.restrictionRules.map((rule, index) => (
                      <div key={rule.id || index} className="text-orange-700 ml-2">
                        • {rule.conditions && rule.conditions.length > 0 ? (
                          <span>
                            When {describeLinkingConditions(rule.conditions, rule.logic || 'and', otherFields)} →
                            <span className={`ml-1 px-1 py-0.5 rounded text-xs ${rule.action === 'required' ? 'bg-red-100 text-red-800' : 'bg-muted text-foreground'
                              }`}>
                              {rule.action.toUpperCase()}
                            </span>
                          </span>
                        ) : (
                          <span>Restriction Rule {index + 1}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Dynamic Config */}
                {field.fieldLinking.dynamicConfig && (
                  <div className="pl-3 border-l-2 border-green-200">
                    <div className="font-medium text-green-800 mb-1">Dynamic Configuration:</div>
                    {field.fieldLinking.dynamicConfig.options && (
                      <div className="text-green-700 ml-2">
                        • Dynamic Options: {Object.keys(field.fieldLinking.dynamicConfig.options).length} mappings
                      </div>
                    )}
                    {field.fieldLinking.dynamicConfig.dateRange && (
                      <div className="text-green-700 ml-2">
                        • Dynamic Date Range: {field.fieldLinking.dynamicConfig.dateRange.enabled ? 'Enabled' : 'Disabled'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </AccordionItem>

        {/* Data Calculations - Renamed from Variable Creation */}
        <AccordionItem
          title="Data Calculations"
          subtitle={`${variables.length} variable(s) available`}
          icon={<Calculator className="h-4 w-4" />}
          defaultOpen={variables.length > 0}
        >
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => {
                console.log('Opening Variable Manager');
                console.log('Current variables:', variables);
                setShowVariableManager(true);
              }}
              className="w-full"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Manage Data Calculations
            </Button>
            {variables.length > 0 && (
              <div className="text-xs text-muted-foreground bg-green-50 p-2 rounded">
                <strong>Active Variables:</strong> {variables.map(v => v.name).join(', ')}
              </div>
            )}
          </div>
        </AccordionItem>

        {/* Conditional Visibility - Renamed from Show When */}
        <AccordionItem
          title="Conditional Visibility"
          subtitle={
            showWhen && showWhen.conditions && showWhen.conditions.length > 0
              ? `Visible when ${countShowWhenConditions(showWhen.conditions)} condition(s) match`
              : "Always visible"
          }
          icon={showWhen && showWhen.conditions && showWhen.conditions.length > 0 ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          defaultOpen={showWhen && showWhen.conditions && showWhen.conditions.length > 0}
        >
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => setShowVisibilityModal(true)}
              className="w-full bg-brand-50 hover:bg-brand-100 text-brand-700 border-brand-200"
            >
              <Eye className="h-4 w-4 mr-2" />
              Manage Conditional Visibility
            </Button>
            {showWhen && showWhen.conditions && showWhen.conditions.length > 0 && (
              <div className="text-xs text-muted-foreground bg-brand-50/50 p-3 rounded-lg border border-brand-100">
                <strong>Rule Summary: </strong>
                This field is visible when <strong>{showWhen.logic?.toUpperCase() || 'AND'}</strong> of the following conditions match:
                {(() => {
                  const renderNodes = (nodes: ShowWhenNode[]): ReactNode => (
                    <ul className="list-disc pl-4 mt-1 space-y-1">
                      {nodes.map((node, i) => {
                        if (isShowWhenGroup(node)) {
                          return (
                            <li key={node.id || i}>
                              <span className="font-semibold text-brand-700">{(node.logic || 'and').toUpperCase()}</span> group:
                              {renderNodes(node.conditions)}
                            </li>
                          );
                        }
                        const srcField = otherFields.find(f => f.id === node.fieldId)?.label || node.fieldId;
                        const opDef = SHOW_OPERATORS.find(op => op.value === node.operator);
                        const opLabel = opDef?.label || node.operator;
                        return (
                          <li key={node.id || i}>
                            {srcField} <span className="font-semibold text-brand-700">{opLabel.toLowerCase()}</span> {node.value ? `"${node.value}"` : ''}
                          </li>
                        );
                      })}
                    </ul>
                  );
                  return renderNodes(showWhen.conditions);
                })()}
              </div>
            )}
          </div>
        </AccordionItem>

        {/* Validation Rules Section — hidden for table fields */}
        {field.type !== 'table' && (
          <AccordionItem
            title="Input Validation"
            subtitle={
              (field.rules && field.rules.length > 0)
                ? `${field.rules.length} validation rule(s) active`
                : "No validation rules"
            }
            icon={<Shield className="h-4 w-4" />}
            defaultOpen={field.rules && field.rules.length > 0}
          >
            <div className="space-y-4">
              <Button
                variant="outline"
                onClick={() => setShowValidationModal(true)}
                className="w-full bg-brand-50 hover:bg-brand-100 text-brand-700 border-brand-200"
              >
                <Shield className="h-4 w-4 mr-2" />
                Manage Validation Rules
              </Button>

              {(field.rules || []).length > 0 && (
                <div className="text-xs text-muted-foreground bg-brand-50/50 p-3 rounded-lg border border-brand-100">
                  <strong>Active Rules: </strong>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {(field.rules || []).map((rule, i) => {
                      let ruleDesc: any = rule.type;
                      if (rule.type === 'custom') {
                        const targetField = otherFields.find(f => f.id === rule.value);
                        ruleDesc = `Must match: ${targetField ? targetField.label : 'Unknown Field'}`;
                      } else if (rule.value) {
                        ruleDesc = `${rule.type}: ${rule.value}`;
                      }
                      return (
                        <li key={rule.id || i}>
                          {ruleDesc} {rule.message ? `(Custom message)` : ''}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </AccordionItem>
        )}

        {/* Table Validation — only for table fields */}
        {field.type === 'table' && (() => {
          const rules: TableValidationRule[] = field.tableValidation ?? [];
          const tableCols = field.tableConfig?.columns ?? [];
          const tableNamedRows = field.tableConfig?.namedRows ?? [];

          const addRule = () => {
            const newRule: TableValidationRule = {
              id: `tvr_${Date.now()}`,
              type: 'any-row-complete',
              enabled: true,
              message: 'Please complete at least one row.',
            };
            onUpdate({ tableValidation: [...rules, newRule] });
          };

          const removeRule = (id: string) => {
            onUpdate({ tableValidation: rules.filter((r) => r.id !== id) });
          };

          const updateRule = (id: string, patch: Partial<TableValidationRule>) => {
            onUpdate({ tableValidation: rules.map((r) => r.id === id ? { ...r, ...patch } : r) });
          };

          const RULE_TYPE_LABELS: Record<TableValidationRuleType, string> = {
            'any-row-complete': 'Any row complete',
            'all-rows-complete': 'All rows complete',
            'min-rows-filled': 'Minimum rows filled',
            'column-value': 'Column value check',
            'aggregate': 'Aggregate expression',
          };

          const OPERATORS = [
            { value: 'gt', label: '>' },
            { value: 'gte', label: '>=' },
            { value: 'lt', label: '<' },
            { value: 'lte', label: '<=' },
            { value: 'eq', label: '=' },
            { value: 'neq', label: '≠' },
          ];

          const AGGREGATE_FUNCS = [
            { value: 'tableSum', label: 'Sum of column', needsCol: true },
            { value: 'tableAvg', label: 'Average of column', needsCol: true },
            { value: 'tableMin', label: 'Min of column', needsCol: true },
            { value: 'tableMax', label: 'Max of column', needsCol: true },
            { value: 'tableCount', label: 'Total row count', needsCol: false },
            { value: 'tableCountFilled', label: 'Count filled in column', needsCol: true },
          ];

          const parseAggExpr = (expr: string) => {
            const m = expr?.match(/^(\w+)\("([^"]*)"(?:,"([^"]*)")?\)$/);
            if (!m) return { fn: '', colId: '' };
            return { fn: m[1], colId: m[3] ?? '' };
          };

          const buildAggExpr = (fn: string, colId: string) => {
            if (!fn) return '';
            const needsCol = AGGREGATE_FUNCS.find((f) => f.value === fn)?.needsCol;
            return needsCol
              ? `${fn}("${field.id}","${colId}")`
              : `${fn}("${field.id}")`;
          };

          return (
            <AccordionItem
              title="Table Validation"
              subtitle={rules.length > 0 ? `${rules.filter(r => r.enabled !== false).length} active rule(s)` : 'No validation rules'}
              icon={<Shield className="h-4 w-4" />}
              defaultOpen={rules.length > 0}
            >
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div key={rule.id} className="border rounded-md p-2.5 space-y-2 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded"
                        checked={rule.enabled !== false}
                        onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                      />
                      <select
                        className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs"
                        value={rule.type}
                        onChange={(e) => {
                          const newType = e.target.value as TableValidationRuleType;
                          const patch: Partial<TableValidationRule> = { type: newType };
                          if ((newType === 'column-value' || newType === 'aggregate') && !rule.operator) {
                            patch.operator = 'gt';
                          }
                          updateRule(rule.id, patch);
                        }}
                      >
                        {(Object.keys(RULE_TYPE_LABELS) as TableValidationRuleType[]).map((t) => (
                          <option key={t} value={t}>{RULE_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => removeRule(rule.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Named row scope — for any row-based rule when named rows exist */}
                    {(rule.type === 'any-row-complete' || rule.type === 'all-rows-complete' || rule.type === 'min-rows-filled' || rule.type === 'column-value') && tableNamedRows.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-medium">Named rows to check <span className="font-normal">(blank = all)</span></p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {tableNamedRows.map((nr) => (
                            <label key={nr.id} className="flex items-center gap-1 text-[10px] cursor-pointer select-none">
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded"
                                checked={(rule.namedRowIds ?? []).includes(nr.id)}
                                onChange={(e) => {
                                  const ids = rule.namedRowIds ?? [];
                                  updateRule(rule.id, { namedRowIds: e.target.checked ? [...ids, nr.id] : ids.filter((i) => i !== nr.id) });
                                }}
                              />
                              {nr.label || nr.id}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rule-specific fields */}
                    {(rule.type === 'any-row-complete' || rule.type === 'all-rows-complete' || rule.type === 'min-rows-filled') && tableCols.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">Columns to check <span className="font-normal">(blank = all)</span></p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {tableCols.map((col) => (
                            <label key={col.id} className="flex items-center gap-1 text-[10px] cursor-pointer select-none">
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded"
                                checked={(rule.columnIds ?? []).includes(col.id)}
                                onChange={(e) => {
                                  const ids = rule.columnIds ?? [];
                                  updateRule(rule.id, { columnIds: e.target.checked ? [...ids, col.id] : ids.filter((i) => i !== col.id) });
                                }}
                              />
                              {col.label || col.id}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {rule.type === 'min-rows-filled' && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">Minimum count</p>
                        <Input type="number" min={1} value={rule.minCount ?? 1} className="h-7 text-xs"
                          onChange={(e) => updateRule(rule.id, { minCount: Math.max(1, Number(e.target.value)) })} />
                      </div>
                    )}

                    {rule.type === 'column-value' && (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">Column</p>
                            <select className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs"
                              value={rule.columnId ?? ''} onChange={(e) => updateRule(rule.id, { columnId: e.target.value || undefined })}>
                              <option value="">Select column</option>
                              {tableCols.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">Scope</p>
                            <select className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs"
                              value={rule.scope ?? 'any'} onChange={(e) => updateRule(rule.id, { scope: e.target.value as 'any' | 'all' })}>
                              <option value="any">Any row</option>
                              <option value="all">All rows</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">Operator</p>
                            <select className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs"
                              value={rule.operator ?? 'gt'} onChange={(e) => updateRule(rule.id, { operator: e.target.value as TableValidationRule['operator'] })}>
                              {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">Value</p>
                            <Input type="number" value={rule.value ?? ''} className="h-7 text-xs"
                              onChange={(e) => updateRule(rule.id, { value: e.target.value })} />
                          </div>
                        </div>
                      </div>
                    )}

                    {rule.type === 'aggregate' && (() => {
                      const { fn: aggFn, colId: aggColId } = parseAggExpr(rule.expression ?? '');
                      const aggDef = AGGREGATE_FUNCS.find((f) => f.value === aggFn);
                      return (
                        <div className="space-y-1.5">
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground">Function</p>
                            <select className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs"
                              value={aggFn}
                              onChange={(e) => updateRule(rule.id, { expression: buildAggExpr(e.target.value, aggColId) })}>
                              <option value="">Select function…</option>
                              {AGGREGATE_FUNCS.map((f) => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>
                          </div>
                          {aggDef?.needsCol && tableCols.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground">Column</p>
                              <select className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs"
                                value={aggColId}
                                onChange={(e) => updateRule(rule.id, { expression: buildAggExpr(aggFn, e.target.value) })}>
                                <option value="">Select column…</option>
                                {tableCols.map((c) => (
                                  <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-0.5">Operator</p>
                              <select className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs"
                                value={rule.operator ?? 'gte'} onChange={(e) => updateRule(rule.id, { operator: e.target.value as TableValidationRule['operator'] })}>
                                {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-0.5">Value</p>
                              <Input type="number" value={rule.value ?? ''} className="h-7 text-xs"
                                onChange={(e) => updateRule(rule.id, { value: e.target.value })} />
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Error message */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">Error message</p>
                      <Input value={rule.message} className="h-7 text-xs"
                        placeholder="Validation error message…"
                        onChange={(e) => updateRule(rule.id, { message: e.target.value })} />
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addRule}>
                  <Plus className="h-3.5 w-3.5" /> Add Validation Rule
                </Button>
              </div>
            </AccordionItem>
          );
        })()}

        {/* Custom Alerts Section */}
        <AccordionItem
          title="Custom Alerts"
          subtitle={
            field.alerts && field.alerts.length > 0
              ? `${field.alerts.length} alert rule(s) configured`
              : "Show dynamic messages based on input"
          }
          icon={<AlertCircle className="h-4 w-4" />}
          defaultOpen={field.alerts && field.alerts.length > 0}
        >
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => setShowAlertModal(true)}
              className="w-full"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Manage Field Alerts
            </Button>
            {field.alerts && field.alerts.length > 0 && (
              <div className="text-xs text-muted-foreground bg-orange-50 p-3 rounded-lg border border-orange-100">
                <strong>Active Alerts:</strong> {field.alerts.length} rule(s)
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  {field.alerts.map((alert, i) => (
                    <li key={alert.id || i} className="truncate">
                      {alert.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </AccordionItem>

        {/* Support Documents Section */}
        <AccordionItem
          title="Support Documents"
          subtitle={
            field.supportDocuments && field.supportDocuments.length > 0
              ? `${field.supportDocuments.length} document(s) attached`
              : "Attach reference guides or links"
          }
          icon={<FileText className="h-4 w-4" />}
          defaultOpen={field.supportDocuments && field.supportDocuments.length > 0}
        >
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => setShowDocsModal(true)}
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              Manage Reference Documents
            </Button>
            {field.supportDocuments && field.supportDocuments.length > 0 && (
              <div className="text-xs text-muted-foreground bg-plum-50 p-3 rounded-lg border border-plum-100">
                <strong>Attached Files:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  {field.supportDocuments.map((doc, i) => (
                    <li key={doc.id || i} className="truncate">
                      {doc.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </AccordionItem>

        {/* Poll Question toggle — only visible when form type is voting and field has options */}
        {formType === 'voting' && ['radio', 'select', 'checkbox', 'multiselect'].includes(field.type) && (
          <AccordionItem
            title="Poll Question"
            subtitle={field.isPollQuestion ? 'Votes on this field are counted' : 'Not included in vote tally'}
            icon={<BarChart2 className="h-4 w-4" />}
            defaultOpen={!!field.isPollQuestion}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div>
                  <Label className="text-sm font-medium cursor-pointer">Count votes on this field</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Include this field in the vote tally and poll results chart.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={!!field.isPollQuestion}
                  onChange={(e) => onUpdate({ isPollQuestion: e.target.checked })}
                  className="h-4 w-4 accent-primary cursor-pointer"
                />
              </div>
              {!field.isPollQuestion && (
                <p className="text-xs text-muted-foreground px-1">
                  Leave OFF for fields like Name or Email that are not vote questions.
                </p>
              )}
            </div>
          </AccordionItem>
        )}

        {/* Assessment Scoring — only visible when form type is assessment and field has options */}
        {formType === 'assessment' && ['radio', 'select', 'checkbox', 'multiselect'].includes(field.type) && (
          <AccordionItem
            title="Assessment Scoring"
            subtitle={field.correctAnswer ? `Correct answer set · ${field.points ?? 1} pt${(field.points ?? 1) !== 1 ? 's' : ''}` : 'Set correct answer and point value'}
            icon={<ClipboardCheck className="h-4 w-4" />}
            defaultOpen={!!field.correctAnswer}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Correct Answer</Label>
                <p className="text-xs text-muted-foreground">Select the option(s) that count as correct.</p>
                {(field.options ?? []).length === 0 ? (
                  <p className="text-xs text-amber-600">Add options to this field first.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(field.options ?? []).map(opt => {
                      const isSelected = Array.isArray(field.correctAnswer)
                        ? field.correctAnswer.includes(opt.value)
                        : field.correctAnswer === opt.value;
                      const isMulti = ['checkbox', 'multiselect'].includes(field.type);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            if (isMulti) {
                              const current = Array.isArray(field.correctAnswer) ? field.correctAnswer : field.correctAnswer ? [field.correctAnswer] : [];
                              const updated = isSelected ? current.filter(v => v !== opt.value) : [...current, opt.value];
                              onUpdate({ correctAnswer: updated.length > 0 ? updated : undefined });
                            } else {
                              onUpdate({ correctAnswer: isSelected ? undefined : opt.value });
                            }
                          }}
                          className={`flex items-center gap-2 w-full px-3 py-2 rounded border text-sm text-left transition-colors ${isSelected ? 'border-green-500 bg-green-50 text-green-800' : 'border-input hover:bg-muted'}`}
                        >
                          <span className={`w-3.5 h-3.5 flex-shrink-0 rounded-${isMulti ? 'sm' : 'full'} border-2 ${isSelected ? 'border-green-500 bg-green-500' : 'border-muted-foreground'}`} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Point Value</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={field.points ?? 1}
                    onChange={(e) => onUpdate({ points: Math.max(0, Number(e.target.value)) })}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">points</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Section (Optional)</Label>
                <Input
                  value={field.section || ''}
                  onChange={(e) => onUpdate({ section: e.target.value || undefined })}
                  placeholder="e.g. Mathematics, Part A"
                />
                <p className="text-xs text-muted-foreground">Group questions into sections for section-wise scoring in the report.</p>
              </div>
            </div>
          </AccordionItem>
        )}
      </Accordion>
      </div>

      {/* AI Prompt Dialog */}
      <Dialog open={showAIModal} onOpenChange={setShowAIModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Build with AI</DialogTitle>
            <DialogDescription>Describe the changes you want (e.g. "add a DOB field").</DialogDescription>
          </DialogHeader>
          {/* spacing above textarea */}
          <div className="mt-6">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAIPrompt(e.target.value)}
              className="w-full h-32"
              placeholder="Type your instructions..."
              disabled={isAISubmitting}
            />
          </div>

          {/* loading gimmick similar to AI creation */}
          {isAISubmitting && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="relative">
                <div className="w-12 h-12 bg-primary rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-12 h-12 bg-primary rounded-full animate-ping opacity-20"></div>
                <Wand2 className="absolute inset-0 w-12 h-12 text-white flex items-center justify-center" />
              </div>
              <p className="text-center text-brand-600 font-medium">
                AI is updating your form...
              </p>
            </div>
          )}

          {/* increased space above footer */}
          <DialogFooter className="space-x-2 justify-center mt-8">
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleAISubmit}
              disabled={isAISubmitting || aiPrompt.trim() === ''}
            >
              {isAISubmitting ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Applying AI edits...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Submit
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={() => setShowAIModal(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      {showAdvancedLinkingModal && (
        <AdvancedLinkingModal
          field={field}
          otherFields={otherFields}
          variables={variables}
          isOpen={showAdvancedLinkingModal}
          onClose={() => setShowAdvancedLinkingModal(false)}
          onUpdate={onUpdate}
        />
      )}

      {/* Variable Manager Modal */}
      {showVariableManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-lg p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-medium">Data Calculations</h3>
              <Button variant="ghost" onClick={() => setShowVariableManager(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Create variables to perform calculations or store values.
            </p>
            <VariableManager
              variables={variables}
              fields={allFields}
              onUpdateVariables={handleUpdateVariables}
            />
          </div>
        </div>
      )}

      {/* Conditional Visibility Modal */}
      {showVisibilityModal && (
        <ConditionalVisibilityModal
          field={field}
          otherFields={otherFields}
          isOpen={showVisibilityModal}
          onClose={() => setShowVisibilityModal(false)}
          onUpdate={onUpdate}
          operators={SHOW_OPERATORS}
        />
      )}

      {/* Validation Rules Modal */}
      {showValidationModal && (
        <ValidationModal
          field={field}
          otherFields={otherFields}
          isOpen={showValidationModal}
          onClose={() => setShowValidationModal(false)}
          onUpdate={onUpdate}
        />
      )}

      <ExternalValidationModal
        isOpen={isExtValidationModalOpen}
        onClose={() => setIsExtValidationModalOpen(false)}
        field={field}
        onUpdate={onUpdate}
      />
      <CSVImportModal
        open={showCSVImport}
        onClose={() => setShowCSVImport(false)}
        onImport={(newOptions) => {
          onUpdate({ options: [...(field.options || []), ...newOptions] });
        }}
      />
      <CustomAlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        field={field}
        otherFields={otherFields}
        onUpdate={onUpdate}
        operators={SHOW_OPERATORS}
      />
      <SupportDocumentsModal
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
        field={field}
        onUpdate={onUpdate}
        orgId={currentOrg?.id}
        formId={formId}
        dmsEnabled={dmsEnabled}
      />
      <TableConfigModal
        isOpen={showTableConfigModal}
        onClose={() => setShowTableConfigModal(false)}
        field={field}
        onUpdate={onUpdate}
        allFields={allFields}
        variables={variables}
      />
    </div>
  );
}
