import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchForm, updateForm, publishForm, duplicateForm, saveFormAsTemplate } from '../store/formsSlice';
import {
  initializeBuilder,
  addField,
  removeField,
  updateField,
  reorderFields,
  selectField,
  setFormName,
  setFormDescription,
  markSaved,
  updateVariables,
  moveFieldToStep,
  updateLayout,
  setLayoutMode,
  setOrientation,
  addStep,
  removeStep,
  updateStep,
  assignFieldsToStep,
} from '../store/builderSlice';
import { DndContext, closestCenter, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import api from '../lib/api';
import { replaceSchema, setAISessionId } from '../store/builderSlice';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import FieldPalette from '../components/builder/FieldPalette';
import SortableField from '../components/builder/SortableField';
import FieldInspector from '../components/builder/FieldInspector';
import LayoutConfigPanel from '../components/builder/LayoutConfigPanel';
import { SettingsPanel } from '../components/builder/SettingsModal';
import type { FormSchema, FormLayout, FormField } from '../types';
import { cn } from '../lib/utils';
import {
  ArrowLeft, Save, Loader2, Download, MoreVertical, Copy,
  Globe, Check, Wand2, PenLine, Eye, Undo2, Redo2,
  Layout, Settings, MousePointerClick, CircleDot, Library, Rows3,
  X, AlertTriangle,
} from 'lucide-react';

// Droppable canvas component
function DroppableCanvas({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas',
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] transition-colors ${isOver ? 'bg-muted/50' : ''
        }`}
    >
      {children}
    </div>
  );
}

// Helper component to render fields by width with step information
function FieldsByWidth({ fields, onDuplicateField, readOnly }: {
  fields: FormField[];
  onDuplicateField?: (fieldId: string) => void;
  readOnly?: boolean;
}) {
  const dispatch = useAppDispatch();
  const builder = useAppSelector((state) => state.builder);
  const isMultiStep = builder.layout.mode === 'multiStep';

  const groupByWidth = (fieldList: FormField[]) => {
    const groups: Array<{ width: 'full' | 'half' | 'third'; fields: FormField[] }> = [];
    let currentGroup: typeof groups[0] | null = null;
    fieldList.forEach(field => {
      const width = (field.width || 'full') as 'full' | 'half' | 'third';
      if (!currentGroup || currentGroup.width !== width) {
        currentGroup = { width, fields: [] };
        groups.push(currentGroup);
      }
      currentGroup.fields.push(field);
    });
    return groups;
  };

  const getGridClass = (width: 'full' | 'half' | 'third') => {
    switch (width) {
      case 'half': return 'grid grid-cols-2 gap-4';
      case 'third': return 'grid grid-cols-3 gap-4';
      default: return 'space-y-3';
    }
  };

  const renderFieldItem = (field: FormField) => (
    <SortableField
      key={field.id}
      field={field}
      isSelected={field.id === builder.selectedFieldId}
      onSelect={() => dispatch(selectField(field.id))}
      onDelete={() => dispatch(removeField(field.id))}
      onDuplicate={onDuplicateField}
      readOnly={readOnly}
    />
  );

  const renderGroups = (fieldList: FormField[]) =>
    groupByWidth(fieldList).map((group, i) => (
      <div key={i} className={getGridClass(group.width)}>
        {group.fields.map(renderFieldItem)}
      </div>
    ));

  if (isMultiStep && builder.layout.steps && builder.layout.steps.length > 0) {
    const steps = [...builder.layout.steps].sort((a, b) => a.order - b.order);
    const assignedIds = new Set(steps.flatMap(s => s.fieldIds));
    const unassigned = fields.filter(f => !assignedIds.has(f.id));

    return (
      <div className="space-y-5">
        {steps.map(step => {
          const stepFields = fields.filter(f => step.fieldIds.includes(f.id));
          return (
            <div key={step.id} className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-700">
                  {step.order + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight text-foreground">{step.title}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground">
                    {stepFields.length} field{stepFields.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="ml-auto flex-1 h-px bg-border" />
                <span className="shrink-0 rounded-full bg-muted px-2 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Step {step.order + 1}
                </span>
              </div>
              {stepFields.length > 0
                ? <div className="space-y-3">{renderGroups(stepFields)}</div>
                : <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-3 text-[12px] text-muted-foreground italic">
                    No fields assigned to this step yet.
                  </p>
              }
            </div>
          );
        })}
        {unassigned.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="text-[13px] font-semibold text-amber-800">
                Unassigned field{unassigned.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[11px] text-amber-700">
                ({unassigned.length}) — not shown to respondents
              </span>
              <div className="flex-1 h-px bg-amber-200" />
            </div>
            <div className="space-y-3">{renderGroups(unassigned)}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupByWidth(fields).map((group, i) => (
        <div key={i} className={getGridClass(group.width)}>
          {group.fields.map(renderFieldItem)}
        </div>
      ))}
    </div>
  );
}

export default function FormBuilderPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentForm, isLoading: formLoading } = useAppSelector((state) => state.forms);
  const { currentOrg } = useAppSelector((state) => state.org);
  const builder = useAppSelector((state) => state.builder);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // function to submit AI prompt for entire form
  const handleFormAISubmit = async () => {
    if (!formId) return;
    setIsAISubmitting(true);
    const url = `/forms/${formId}/ai-edit`;
    const payload: any = { prompt: aiPrompt };
    if (builder.aiSessionId) payload.sessionId = builder.aiSessionId;
    console.log('🔗 AI form request url:', url);
    console.log('📤 AI form payload:', payload);
    try {
      const response = await api.post(url, payload);
      console.log('📥 AI form response data:', response.data);
      const { schema: newSchema, sessionId: newSession } = response.data;
      if (newSchema) dispatch(replaceSchema(newSchema));
      if (newSession) dispatch(setAISessionId(newSession));
      setShowAIModal(false);
      setAiPrompt('');
    } catch (err) {
      console.error('AI form edit failed', err);
    } finally {
      setIsAISubmitting(false);
    }
  };
  const [showNamingDialog, setShowNamingDialog] = useState<'duplicate' | 'template' | null>(null);
  const [newName, setNewName] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  // AI modal state for global form editing
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAISubmitting, setIsAISubmitting] = useState(false);

  // Workspace view — Build (canvas) / Layout / Settings. Pure navigation.
  const [workspace, setWorkspace] = useState<'build' | 'layout' | 'settings'>('build');
  // Floating field-library popover (Build only).
  const [showLibrary, setShowLibrary] = useState(false);
  // First-time layout choice (Vertical / Horizontal) for a brand-new empty form.
  const [showOrientationDialog, setShowOrientationDialog] = useState(false);
  const orientationPromptedRef = useRef(false);

  useEffect(() => {
    if (currentForm && !orientationPromptedRef.current) {
      orientationPromptedRef.current = true;
      if ((currentForm.schema.fields?.length ?? 0) === 0) {
        setShowOrientationDialog(true);
      }
    }
  }, [currentForm]);

  const handleDuplicateField = (fieldId: string) => {
    const source = builder.schema.fields.find((f) => f.id === fieldId);
    if (!source) return;
    const clone: FormField = {
      ...source,
      id: `field_${Date.now()}`,
      label: `${source.label} (copy)`,
    };
    // Reuse existing reducer + selection; pure UI convenience, no backend impact.
    dispatch(addField(clone));
    dispatch(selectField(clone.id));
  };

  // ---- Undo / Redo (UI affordance only; uses existing reducers) ----
  type Snap = { schema: FormSchema; layout: FormLayout; selected: string | null };
  const undoStack = useRef<Snap[]>([]);
  const redoStack = useRef<Snap[]>([]);
  const restoringRef = useRef(false);
  const lastSnapRef = useRef<Snap | null>(null);

  useEffect(() => {
    const s: Snap = { schema: builder.schema, layout: builder.layout, selected: builder.selectedFieldId };
    if (restoringRef.current) {
      restoringRef.current = false;
      lastSnapRef.current = s;
      return;
    }
    if (!lastSnapRef.current) {
      lastSnapRef.current = s;
      return;
    }
    if (JSON.stringify(lastSnapRef.current) === JSON.stringify(s)) return;
    undoStack.current.push(lastSnapRef.current);
    redoStack.current = [];
    lastSnapRef.current = s;
  }, [builder.schema, builder.layout, builder.selectedFieldId]);

  const applySnap = (s: Snap) => {
    restoringRef.current = true;
    dispatch(replaceSchema(s.schema));
    dispatch(updateLayout(s.layout));
    dispatch(selectField(s.selected));
  };

  const handleUndo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push({ schema: builder.schema, layout: builder.layout, selected: builder.selectedFieldId });
    applySnap(prev);
  };
  const handleRedo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push({ schema: builder.schema, layout: builder.layout, selected: builder.selectedFieldId });
    applySnap(next);
  };

  useEffect(() => {
    if (formId) {
      dispatch(fetchForm(formId));
    }
  }, [formId, dispatch]);

  useEffect(() => {
    if (currentForm) {
      dispatch(initializeBuilder({
        schema: currentForm.schema,
        settings: currentForm.settings,
        name: currentForm.name,
        description: currentForm.description || '',
      }));
    }
  }, [currentForm, dispatch]);


  const getSchemaWithLayout = () => {
    const schema = {
      ...builder.schema,
      layout: builder.layout,
    };

    // Ensure schema has required fields
    if (!schema.fields) {
      schema.fields = [];
    }

    // Ensure variables are included
    if (!schema.variables) {
      schema.variables = [];
    }

    // Validate and clean each field
    schema.fields = schema.fields.map((field, index) => {
      const validatedField = {
        ...field,
      };

      // Only set defaults if not already present
      if (!validatedField.id) {
        validatedField.id = `field_${index}`;
      }
      if (!validatedField.type) {
        validatedField.type = 'text';
      }
      if (!validatedField.label) {
        validatedField.label = `Field ${index + 1}`;
      }
      validatedField.required = !!validatedField.required;

      // Remove any invalid or undefined properties that might cause validation issues
      // Start with all field properties, then clean empty ones
      const cleanedField: any = {
        id: validatedField.id,
        type: validatedField.type,
        label: validatedField.label,
        required: validatedField.required,
      };

      // Add optional string/simple properties if they exist
      const optionalProps = ['placeholder', 'helpText', 'disabled', 'width', 'unique', 'defaultValue', 'minValue', 'maxValue', 'mutualExclusionGroup', 'correctAnswer', 'points', 'section', 'isPollQuestion'];
      optionalProps.forEach(prop => {
        const value = (validatedField as any)[prop];
        if (value !== undefined && value !== null && value !== '') {
          cleanedField[prop] = value;
        }
      });

      // Add options array for select, radio, checkbox, multiselect fields
      if (validatedField.options && Array.isArray(validatedField.options) && validatedField.options.length > 0) {
        cleanedField.options = validatedField.options;
      }

      // Add file configuration if present
      if (validatedField.fileConfig && Object.keys(validatedField.fileConfig).length > 0) {
        cleanedField.fileConfig = validatedField.fileConfig;
      }

      // Add validation rules if present
      if (validatedField.validation && Object.keys(validatedField.validation).length > 0) {
        cleanedField.validation = validatedField.validation;
      }

      // Add rules if present
      if (validatedField.rules && Array.isArray(validatedField.rules) && validatedField.rules.length > 0) {
        cleanedField.rules = validatedField.rules;
      }

      // Add showWhen if present
      if (validatedField.showWhen && Object.keys(validatedField.showWhen).length > 0) {
        cleanedField.showWhen = validatedField.showWhen;
      }

      // Add dynamicOptions if present
      if (validatedField.dynamicOptions && Object.keys(validatedField.dynamicOptions).length > 0) {
        cleanedField.dynamicOptions = validatedField.dynamicOptions;
      }

      // preserve display configuration (used by display fields to show variable values)
      if (validatedField.displayConfig && Object.keys(validatedField.displayConfig).length > 0) {
        cleanedField.displayConfig = validatedField.displayConfig;
      }

      // preserve table configuration
      if (validatedField.tableConfig && (validatedField.tableConfig.columns?.length ?? 0) > 0) {
        cleanedField.tableConfig = validatedField.tableConfig;
      }

      // preserve table validation rules
      if (validatedField.tableValidation && Array.isArray(validatedField.tableValidation) && validatedField.tableValidation.length > 0) {
        cleanedField.tableValidation = validatedField.tableValidation;
      }

      // preserve external validation configuration
      if (validatedField.externalValidation && Object.keys(validatedField.externalValidation).length > 0) {
        cleanedField.externalValidation = validatedField.externalValidation;
      }

      // Add custom alerts if present
      if (validatedField.alerts && Array.isArray(validatedField.alerts) && validatedField.alerts.length > 0) {
        cleanedField.alerts = validatedField.alerts;
      }

      // Add support documents if present
      if (validatedField.supportDocuments && Array.isArray(validatedField.supportDocuments) && validatedField.supportDocuments.length > 0) {
        cleanedField.supportDocuments = validatedField.supportDocuments;
      }

      // Clean up empty fieldLinking entries so we don't persist stale "enabled" flags.
      if (validatedField.fieldLinking) {
        const fl: any = { ...validatedField.fieldLinking };
        const hasContent = fl.enabled && (
          fl.sourceFieldId ||
          (fl.rules && fl.rules.length > 0) ||
          (fl.restrictionRules && fl.restrictionRules.length > 0) ||
          (fl.dynamicConfig && Object.keys(fl.dynamicConfig).length > 0)
        );
        if (hasContent) {
          cleanedField.fieldLinking = fl;
        }
      }

      return cleanedField;
    });

    // Validate and clean variables
    schema.variables = schema.variables.map((variable, index) => {
      const cleanedVariable: any = {
        id: variable.id || `variable_${index}`,
        name: variable.name,
        type: variable.type || 'string',
      };

      // Add optional properties
      const optionalProps: string[] = ['description', 'calculation', 'dependencies', 'value', 'computed', 'valueMapping', 'mode', 'functionParameters', 'functionBody'];

      optionalProps.forEach(prop => {
        const value = (variable as any)[prop];
        if (value !== undefined && value !== null) {
          (cleanedVariable as any)[prop] = value;
        }
      });

      return cleanedVariable;
    });

    return schema;
  };

  const checkBackendConnectivity = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:12001';
      const response = await fetch(`${API_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return true;
      } else {
        return false;
      }
    } catch (error: any) {
      return false;
    }
  };

  const handleSave = async () => {
    if (!formId) return;

    // Check backend connectivity first
    const isBackendAccessible = await checkBackendConnectivity();
    if (!isBackendAccessible) {
      alert('Backend server is not accessible. Please check if the server is running and try again.');
      return;
    }

    // Validate before saving
    if (!builder.formName || builder.formName.trim() === '') {
      alert('Form name is required. Please add a form name before saving.');
      return;
    }

    if (!builder.schema || !builder.schema.fields || builder.schema.fields.length === 0) {
      alert('Form must have at least one field before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const schema = getSchemaWithLayout();

      // Additional validation for schema structure
      // Check each field for required properties and correct fieldLinking rules
      const invalidFields = schema.fields.filter((field: any) => {
        const issues: string[] = [];
        if (!field.id) issues.push('missing id');
        if (!field.type) issues.push('missing type');
        if (!field.label) issues.push('missing label');

        // enforce advanced linking rule correctness on client side
        if (field.fieldLinking?.enabled && field.fieldLinking.mode === 'advanced') {
          const rules = field.fieldLinking.rules || [];
          rules.forEach((r: any) => {
            const hasStatic = r.targetValue !== undefined && r.targetValue !== '';
            const hasCopy = r.copyFromFieldId !== undefined && r.copyFromFieldId !== '';
            const hasDynamicOptions = Array.isArray(r.dynamicOptions) && r.dynamicOptions.length > 0;
            const hasDateRange = r.dateRange && (r.dateRange.min || r.dateRange.max);
            if (!hasStatic && !hasCopy && !hasDynamicOptions && !hasDateRange) {
              issues.push('rule missing value/copy');
            }
            if (hasStatic && hasCopy) {
              issues.push('rule has both value and copy');
            }
          });
        }

        return issues.length > 0;
      });

      if (invalidFields.length > 0) {
        alert('Form schema validation failed. Please check field configurations.');
        return;
      }

      const formData = {
        formId,
        data: {
          name: builder.formName.trim(),
          description: builder.formDescription?.trim() || '',
          schema: schema,
          settings: builder.settings || {},
        },
      };

      // Saving form
      await dispatch(updateForm({ id: formId, data: formData.data })).unwrap();
      // Form saved successfully
      dispatch(markSaved());
    } catch (error: any) {
      // Handle structured errors from Redux Toolkit
      let errorMessage = 'Failed to save form';
      let validationErrors = null;

      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Check if it's a structured error from Redux Toolkit
        if (error.error) {
          errorMessage = error.error;
          validationErrors = error.details;
        } else {
          // Check for network/CORS issues
          if (!error.response) {
            if (error.message && (error.message.includes('Network Error') || error.message.includes('ERR_NETWORK'))) {
              alert('Network Error: Unable to connect to the server. Please check if the backend server is running.');
              return;
            } else if (error.message && error.message.includes('CORS')) {
              alert('CORS Error: Server configuration issue. Please check backend CORS settings.');
              return;
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_CONNECTION_REFUSED') {
              alert('Connection Refused: Backend server is not running or not accessible.');
              return;
            }
          }

          errorMessage = error.response?.data?.error || error.message || 'Failed to save form';
          validationErrors = error.response?.data?.details;
        }
      }

      if (validationErrors) {
        alert(`Validation failed:\n${JSON.stringify(validationErrors, null, 2)}`);
      } else {
        alert(`Save failed: ${errorMessage}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!formId) return;

    // Check backend connectivity first
    const isBackendAccessible = await checkBackendConnectivity();
    if (!isBackendAccessible) {
      alert('Backend server is not accessible. Please check if the server is running and try again.');
      return;
    }

    // Validate before publishing
    if (!builder.formName || builder.formName.trim() === '') {
      alert('Form name is required. Please add a form name before publishing.');
      return;
    }

    if (!builder.schema || !builder.schema.fields || builder.schema.fields.length === 0) {
      alert('Form must have at least one field before publishing.');
      return;
    }

    setIsPublishing(true);
    try {
      const schema = getSchemaWithLayout();

      // Additional validation for schema structure
      // Validating schema structure for publish

      // Check each field for required properties and linking rules
      const invalidFields = schema.fields.filter((field: any) => {
        const issues: string[] = [];
        if (!field.id) issues.push('missing id');
        if (!field.type) issues.push('missing type');
        if (!field.label) issues.push('missing label');

        if (field.fieldLinking?.enabled && field.fieldLinking.mode === 'advanced') {
          const rules = field.fieldLinking.rules || [];
          rules.forEach((r: any) => {
            const hasStatic = r.targetValue !== undefined && r.targetValue !== '';
            const hasCopy = r.copyFromFieldId !== undefined && r.copyFromFieldId !== '';
            const hasDynamicOptions = Array.isArray(r.dynamicOptions) && r.dynamicOptions.length > 0;
            const hasDateRange = r.dateRange && (r.dateRange.min || r.dateRange.max);
            if (!hasStatic && !hasCopy && !hasDynamicOptions && !hasDateRange) {
              issues.push('rule missing value/copy');
            }
            if (hasStatic && hasCopy) {
              issues.push('rule has both value and copy');
            }
          });
        }

        return issues.length > 0;
      });

      if (invalidFields.length > 0) {
        const names = invalidFields.map((f: any) => f.label || f.id || '<unknown>').join(', ');
        alert(`Form schema validation failed for field(s): ${names}. Please check field configurations.`);
        return;
      }

      // Save first
      const formData = {
        formId,
        data: {
          name: builder.formName.trim(),
          description: builder.formDescription?.trim() || '',
          schema: schema,
          settings: builder.settings || {},
        },
      };

      await dispatch(updateForm({ id: formId, data: formData.data })).unwrap();

      // Then publish
      const result = await dispatch(publishForm(formId)).unwrap();
      dispatch(markSaved());

      // Fix undefined org slug issue
      const orgSlug = currentOrg?.slug || 'default-org';
      const BASE_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
      const url = `${BASE_URL}/${orgSlug}/${result.slug}`;
      setPublishedUrl(url);
    } catch (error: any) {
      // Handle structured errors from Redux Toolkit
      let errorMessage = 'Failed to publish form';
      let validationErrors = null;

      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Check if it's a structured error from Redux Toolkit
        if (error.error) {
          errorMessage = error.error;
          validationErrors = error.details;
        } else {
          // Check for network/CORS issues
          if (!error.response) {
            if (error.message && (error.message.includes('Network Error') || error.message.includes('ERR_NETWORK'))) {
              alert('Network Error: Unable to connect to the server. Please check if the backend server is running.');
              return;
            } else if (error.message && error.message.includes('CORS')) {
              alert('CORS Error: Server configuration issue. Please check backend CORS settings.');
              return;
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_CONNECTION_REFUSED') {
              alert('Connection Refused: Backend server is not running or not accessible.');
              return;
            }
          }

          errorMessage = error.response?.data?.error || error.message || 'Failed to publish form';
          validationErrors = error.response?.data?.details;
        }
      }

      if (validationErrors) {
        alert(`Validation failed:\n${JSON.stringify(validationErrors, null, 2)}`);
      } else {
        alert(`Publish failed: ${errorMessage}`);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDuplicateForm = async (confirmedName: string) => {
    if (!formId) return;

    setIsProcessingAction(true);
    try {
      const result = await dispatch(duplicateForm({ formId, name: confirmedName })).unwrap();
      alert('Form duplicated successfully!');
      setShowNamingDialog(null);
      navigate(`/forms/${result.id}/edit`);
    } catch (error: any) {
      alert(`Failed to duplicate form: ${error}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSaveAsTemplate = async (confirmedName: string) => {
    if (!formId) return;

    setIsProcessingAction(true);
    try {
      await dispatch(saveFormAsTemplate({ formId, name: confirmedName })).unwrap();
      alert('Template created successfully!');
      setShowNamingDialog(null);
    } catch (error: any) {
      alert(`Failed to create template: ${error}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleExportJSON = () => {
    if (!builder) return;

    const schema = getSchemaWithLayout();
    const exportData = {
      name: builder.formName,
      description: builder.formDescription,
      schema: schema,
      settings: builder.settings,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${builder.formName.replace(/\s+/g, '_')}_schema.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDragStart = (event: DragStartEvent) => {
    // Check if this is a new field from palette
    if (event.active.id.toString().startsWith('new-')) {
      // Could add visual feedback here if needed
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Handle dropping new field from palette
    if (active.id.toString().startsWith('new-')) {
      const fieldType = active.id.toString().replace('new-', '') as FormField['type'];
      handleAddField(fieldType);
      return;
    }

    // Handle reordering existing fields
    if (over && active.id !== over.id) {
      const oldIndex = builder.schema.fields.findIndex((f) => f.id === active.id);
      const newIndex = builder.schema.fields.findIndex((f) => f.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        dispatch(reorderFields({ oldIndex, newIndex }));

        // Cross-step drag: reassign field to the target field's step
        if (builder.layout.mode === 'multiStep' && builder.layout.steps) {
          const activeStep = builder.layout.steps.find(s => s.fieldIds.includes(active.id as string));
          const overStep = builder.layout.steps.find(s => s.fieldIds.includes(over.id as string));
          if (activeStep && overStep && activeStep.id !== overStep.id) {
            dispatch(moveFieldToStep({ fieldId: active.id as string, targetStepId: overStep.id }));
          }
        }
      }
    }
  };

  const handleAddField = (type: FormField['type']) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: getDefaultLabel(type),
      placeholder: '',
      required: false,
      options: type === 'select' || type === 'radio' || type === 'checkbox' || type === 'multiselect'
        ? [{ label: 'Option 1', value: 'option1' }]
        : undefined,
    };
    dispatch(addField(newField));
    dispatch(selectField(newField.id));
  };

  const getDefaultLabel = (type: FormField['type']): string => {
    const labels: Record<string, string> = {
      text: 'Text Field',
      email: 'Email Address',
      phone: 'Phone Number',
      number: 'Number',
      select: 'Dropdown',
      radio: 'Radio Buttons',
      checkbox: 'Checkboxes',
      date: 'Date',
      time: 'Time',
      textarea: 'Long Text',
      file: 'File Upload',
      rating: 'Rating',
      signature: 'Signature',
      html: 'Custom HTML',
      display: 'Display Value',
      table: 'Table Grid',
    };
    return labels[type] || 'New Field';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (formLoading || !currentForm) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const selectedField = builder.schema.fields.find((f) => f.id === builder.selectedFieldId);

  // Published form URL (only relevant once the form is live). The header shows
  // a small eye icon that jumps to this when published — there is no separate
  // "Preview" button because the canvas IS the live preview.
  const BASE_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
  const publishedFormUrl =
    currentForm.isPublished && currentForm.slug
      ? `${BASE_URL}/${currentOrg?.slug || 'default-org'}/${currentForm.slug}`
      : null;

  const isHorizontal = builder.orientation === 'horizontal';

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-workspace">
      {/* Header */}
      <header className="z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-[56px] items-center justify-between gap-3 px-4">
          {/* Left: back + transparent title input */}
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard" className="h-8 w-8 shrink-0 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <input
              value={builder.formName}
              onChange={(e) => dispatch(setFormName(e.target.value))}
              placeholder="Untitled form"
              aria-label="Form name"
              className="min-w-0 max-w-[420px] flex-1 truncate border-none bg-transparent px-1 py-1 text-[16px] font-semibold text-foreground outline-none placeholder:text-muted-foreground"
            />
            {builder.unsavedChanges && (
              <span className="hidden shrink-0 rounded-full bg-amber-500/10 px-2 py-px text-[10px] font-medium text-amber-700 sm:inline">
                Unsaved
              </span>
            )}
          </div>

          {/* Right: AI · Save · Publish (+ eye when published) */}
          <div className="flex shrink-0 items-center gap-1.5">
            {publishedFormUrl && (
              <a
                href={publishedFormUrl}
                target="_blank"
                rel="noreferrer"
                title="View published form"
                aria-label="View published form"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-emerald-700"
              >
                <Eye className="h-4 w-4" />
              </a>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAIModal(true)}
              className="h-8 gap-1.5 px-2 text-[13px]"
              title="Build with AI"
            >
              <Wand2 className="h-4 w-4 text-brand-600" />
              <span className="hidden md:inline">AI</span>
            </Button>

            <div className="mx-1 h-5 w-px bg-border" />

            <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving} className="h-8 gap-1.5 px-3 text-[13px]">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="hidden sm:inline">Save</span>
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={isPublishing} className="h-8 gap-1.5 px-3 text-[13px]">
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              <span className="hidden sm:inline">Publish</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main area: full-width canvas + floating controls */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {workspace === 'build' && (
            <main className="min-h-0 flex-1 overflow-y-auto scrollbar-subtle">
              <div
                className={cn(
                  'mx-auto px-6 py-16',
                  isHorizontal ? 'w-full max-w-[1600px]' : 'max-w-3xl'
                )}
              >
                {/* Canvas acts as the published-form preview */}
                <div className={cn('rounded-2xl border border-border bg-card p-6 shadow-sm', isHorizontal && 'sm:p-8')}>
                  {/* Form header */}
                  <div className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                      {builder.formName || 'Untitled form'}
                    </h1>
                    <Textarea
                      value={builder.formDescription}
                      onChange={(e) => dispatch(setFormDescription(e.target.value))}
                      placeholder="Add a description for your form (optional)"
                      className="mt-2 min-h-[56px] resize-none border-transparent bg-transparent p-0 text-[13px] text-muted-foreground shadow-none outline-none placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-0"
                    />
                  </div>

                  {/* Fields */}
                  <DroppableCanvas>
                    <SortableContext
                      items={builder.schema.fields.map((f) => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {builder.schema.fields.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-20 text-center">
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
                            <MousePointerClick className="h-6 w-6" />
                          </div>
                          <p className="text-[13px] font-medium text-foreground">Build your form</p>
                          <p className="mt-1 text-[12px] text-muted-foreground">
                            Click the field library on the left to add your first field.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowLibrary(true)}
                            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground shadow-sm hover:bg-muted"
                          >
                            <Library className="h-3.5 w-3.5" /> Open field library
                          </button>
                        </div>
                      ) : (
                        <FieldsByWidth
                          fields={builder.schema.fields}
                          onDuplicateField={handleDuplicateField}
                          readOnly={false}
                        />
                      )}
                    </SortableContext>
                  </DroppableCanvas>
                </div>
              </div>
            </main>
          )}

          {workspace === 'layout' && (
            <main className="min-h-0 flex-1 overflow-y-auto scrollbar-subtle">
              <div className={cn('mx-auto px-6 py-16', isHorizontal ? 'w-full max-w-[1600px]' : 'max-w-3xl')}>
                <div className="mb-5 flex items-center gap-2">
                  <Layout className="h-4 w-4 text-brand-600" />
                  <h1 className="text-lg font-semibold tracking-tight text-foreground">Layout settings</h1>
                </div>
                <LayoutConfigPanel
                  layout={builder.layout}
                  fields={builder.schema.fields}
                  onSetLayoutMode={(mode) => dispatch(setLayoutMode(mode))}
                  onUpdateLayout={(updates) => dispatch(updateLayout(updates))}
                  onAddStep={() => dispatch(addStep())}
                  onRemoveStep={(id) => dispatch(removeStep(id))}
                  onUpdateStep={(id, updates) => dispatch(updateStep({ id, updates }))}
                  onAssignFieldsToStep={(stepId, fieldIds) => dispatch(assignFieldsToStep({ stepId, fieldIds }))}
                />
              </div>
            </main>
          )}

          {workspace === 'settings' && (
            <main className="min-h-0 flex-1 overflow-hidden">
              <SettingsPanel formId={formId} />
            </main>
          )}

          {/* Floating centered Build | Layout | Settings pill */}
          <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2">
            <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-border bg-background/95 p-1 shadow-lg backdrop-blur">
              {([
                { id: 'build', label: 'Build', icon: PenLine },
                { id: 'layout', label: 'Layout', icon: Layout },
                { id: 'settings', label: 'Settings', icon: Settings },
              ] as const).map((tab) => {
                const Icon = tab.icon;
                const active = workspace === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWorkspace(tab.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors',
                      active ? 'bg-brand-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Floating Field library button (left) — Build only */}
          {workspace === 'build' && (
            <>
              <div className="absolute left-4 top-3 z-30">
                <button
                  type="button"
                  onClick={() => setShowLibrary((v) => !v)}
                  aria-label="Field library"
                  title="Field library"
                  className={cn(
                    'flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium shadow-lg backdrop-blur transition-colors',
                    showLibrary
                      ? 'border-brand-400 bg-background text-foreground'
                      : 'border-border bg-background/95 text-foreground hover:bg-muted'
                  )}
                >
                  <Library className="h-4 w-4 text-brand-600" />
                  <span className="hidden sm:inline">Field library</span>
                </button>
              </div>

              {/* Field library popover */}
              {showLibrary && (
                <div className="absolute left-4 top-[52px] z-30 w-72 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-[13px] font-semibold text-foreground">Field library</span>
                    <button type="button" onClick={() => setShowLibrary(false)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Close field library">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto p-2">
                    <FieldPalette onAddField={(t) => handleAddField(t)} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Floating undo / redo + more actions (right) */}
          <div className="absolute right-4 top-3 z-30 flex items-center gap-0.5 rounded-full border border-border bg-background/95 p-1 shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.current.length === 0}
              aria-label="Undo"
              title="Undo"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.current.length === 0}
              aria-label="Redo"
              title="Redo"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <div className="mx-0.5 h-5 w-px bg-border" />
            <details className="group relative">
              <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="More actions">
                <MoreVertical className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-border bg-background p-1 shadow-lg">
                <button
                  onClick={() => { setNewName(`${builder.formName} (Copy)`); setShowNamingDialog('duplicate'); }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-muted"
                >
                  <Copy className="h-4 w-4 text-muted-foreground" /> Duplicate form
                </button>
                <button
                  onClick={() => { setNewName(builder.formName); setShowNamingDialog('template'); }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-muted"
                >
                  <Rows3 className="h-4 w-4 text-muted-foreground" /> Save as template
                </button>
                <button
                  onClick={handleExportJSON}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-muted"
                >
                  <Download className="h-4 w-4 text-muted-foreground" /> Export JSON
                </button>
              </div>
            </details>
          </div>
        </DndContext>
      </div>

      {/* Field Inspector — opens as a modal when a field is selected */}
      {selectedField && (
        <FieldInspector
          key={selectedField.id}
          field={selectedField}
          allFields={builder.schema.fields}
          variables={builder.schema.variables}
          formId={formId}
          onUpdate={(updates) => dispatch(updateField({ id: selectedField.id, updates }))}
          onUpdateVariables={(newVariables) => dispatch(updateVariables(newVariables))}
          onClose={() => dispatch(selectField(null))}
        />
      )}

      {/* Orientation choice — first-time creation of an empty form */}
      <Dialog open={showOrientationDialog} onOpenChange={setShowOrientationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose your form layout</DialogTitle>
            <DialogDescription>
              Pick how your form should be laid out on screen. You can change this later in Layout.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4">
            <button
              type="button"
              onClick={() => { dispatch(setOrientation('vertical')); setShowOrientationDialog(false); }}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-brand-400 hover:bg-brand-50/30"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Rows3 className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-[14px] font-semibold text-foreground">Vertical</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                  A centered, narrow column — the classic Google Forms style. Best for forms with a few fields.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => { dispatch(setOrientation('horizontal')); setShowOrientationDialog(false); }}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-brand-400 hover:bg-brand-50/30"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Layout className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-[14px] font-semibold text-foreground">Horizontal</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                  Occupies the full horizontal screen — fields spread out wider. Best for spacious, data-dense forms.
                </span>
              </span>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrientationDialog(false)}>
              Skip for now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Prompt Dialog - global */}
      <Dialog open={showAIModal} onOpenChange={setShowAIModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Build with AI (form-level)</DialogTitle>
            <DialogDescription>Describe the change you want to make to the entire form.</DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="w-full h-32"
              placeholder="e.g. add a DOB field"
              disabled={isAISubmitting}
            />
          </div>

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

          <DialogFooter className="space-x-2 justify-center mt-8">
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleFormAISubmit}
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

      {/* Naming Dialog */}
      <Dialog open={!!showNamingDialog} onOpenChange={() => setShowNamingDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {showNamingDialog === 'duplicate' ? 'Duplicate Form' : 'Save as Template'}
            </DialogTitle>
            <DialogDescription>
              {showNamingDialog === 'duplicate'
                ? 'Check the name for your new duplicated form.'
                : 'Enter a name for this organization template.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  if (showNamingDialog === 'duplicate') {
                    handleDuplicateForm(newName);
                  } else {
                    handleSaveAsTemplate(newName);
                  }
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNamingDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => showNamingDialog === 'duplicate' ? handleDuplicateForm(newName) : handleSaveAsTemplate(newName)}
              disabled={!newName.trim() || isProcessingAction}
            >
              {isProcessingAction && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Published URL Modal */}
      {publishedUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setPublishedUrl(null)} />
          <Card className="relative z-50 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                Form Published!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your form is now live and ready to collect submissions.
              </p>
              <div className="flex items-center gap-2">
                <Input value={publishedUrl} readOnly className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(publishedUrl)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(publishedUrl, '_blank')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Form
                </Button>
                <Button className="flex-1" onClick={() => setPublishedUrl(null)}>
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status bar */}
      <footer className="flex items-center justify-between border-t border-border bg-background px-4 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{builder.schema.fields.length} field{builder.schema.fields.length !== 1 ? 's' : ''}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{builder.schema.fields.filter((f) => f.required).length} required</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="capitalize">{builder.orientation} layout</span>
        </div>
        <div className="flex items-center gap-2">
          {builder.unsavedChanges ? (
            <span className="flex items-center gap-1 text-amber-700">
              <CircleDot className="h-3 w-3" /> Unsaved changes
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-700">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
