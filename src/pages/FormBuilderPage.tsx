import { useEffect, useState } from 'react';
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
import { Badge } from '../components/ui/badge';
import FieldPalette from '../components/builder/FieldPalette';
import SortableField from '../components/builder/SortableField';
import FieldInspector from '../components/builder/FieldInspector';
import LayoutModal from '../components/builder/LayoutModal';
import SettingsModal from '../components/builder/SettingsModal';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  Edit2,
  Eye,
  Globe,
  Layout,
  ListTree,
  Loader2,
  Maximize2,
  Monitor,
  MoreVertical,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  Save,
  Settings,
  Smartphone,
  Tablet,
  Undo2,
  Wand2,
} from 'lucide-react';
import type { FormField } from '../types';

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
function FieldsByWidth({ fields, canvasView = 'desktop' }: {
  fields: FormField[];
  canvasView?: 'desktop' | 'tablet' | 'mobile';
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
    if (canvasView === 'mobile') return 'space-y-3';
    if (width === 'half') return 'grid grid-cols-2 gap-3';
    if (width === 'third') return canvasView === 'tablet' ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-3 gap-3';
    return 'space-y-3';
  };

  const renderFieldItem = (field: FormField) => (
    <SortableField
      key={field.id}
      field={field}
      isSelected={field.id === builder.selectedFieldId}
      onSelect={() => dispatch(selectField(field.id))}
      onDelete={() => dispatch(removeField(field.id))}
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
      <div className="space-y-6">
        {steps.map(step => {
          const stepFields = fields.filter(f => step.fieldIds.includes(f.id));
          return (
            <section key={step.id} className="space-y-3" aria-labelledby={`step-${step.id}`}>
              <div className="flex items-start gap-3 border-b border-border/70 pb-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">{step.order + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 id={`step-${step.id}`} className="text-sm font-bold tracking-tight text-foreground">{step.title}</h2>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Step {step.order + 1}</span>
                    <span className="text-[11px] text-muted-foreground">{stepFields.length} {stepFields.length === 1 ? 'field' : 'fields'}</span>
                  </div>
                  {step.description && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{step.description}</p>}
                </div>
              </div>
              {stepFields.length > 0
                ? <div className="space-y-3">{renderGroups(stepFields)}</div>
                : <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs italic text-muted-foreground">No fields assigned to this step</p>
              }
            </section>
          );
        })}
        {unassigned.length > 0 && (
          <section className="space-y-3" aria-labelledby="unassigned-fields">
            <div className="flex items-start gap-3 border-b border-amber-200/70 pb-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <h2 id="unassigned-fields" className="text-sm font-bold tracking-tight text-foreground">Unassigned fields</h2>
                <p className="text-[11px] text-muted-foreground">{unassigned.length} field{unassigned.length === 1 ? '' : 's'} still need a step.</p>
              </div>
            </div>
            <div className="space-y-3">{renderGroups(unassigned)}</div>
          </section>
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
  const [showSettings, setShowSettings] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1100);
  const [isInspectorOpen, setIsInspectorOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1280);
  const [canvasView, setCanvasView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // AI modal state for global form editing
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAISubmitting, setIsAISubmitting] = useState(false);

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
      multiselect: 'Multi-select',
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

  const fieldCount = builder.schema.fields.length;
  const requiredCount = builder.schema.fields.filter((field) => field.required).length;
  const attentionCount = builder.schema.fields.filter((field) =>
    ['select', 'radio', 'checkbox', 'multiselect'].includes(field.type) && !(field.options?.length)
  ).length;
  const canvasModes: Array<{ id: 'desktop' | 'tablet' | 'mobile'; label: string; icon: typeof Monitor }> = [
    { id: 'desktop', label: 'Desktop', icon: Monitor },
    { id: 'tablet', label: 'Tablet', icon: Tablet },
    { id: 'mobile', label: 'Mobile', icon: Smartphone },
  ];

  return (
    <div className="flex h-screen min-h-[640px] flex-col overflow-hidden bg-muted/30">
      {/* Workspace header */}
      <header className="z-30 shrink-0 border-b border-border/80 bg-card/95 shadow-sm backdrop-blur">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-2.5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              aria-label="Back to dashboard"
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div className="hidden items-center gap-1.5 text-[11px] font-semibold text-muted-foreground md:flex">
              <span>Forms</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Editor</span>
            </div>
            <div className="hidden h-7 w-px bg-border md:block" />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <Input
                  value={builder.formName}
                  onChange={(e) => dispatch(setFormName(e.target.value))}
                  className="h-8 min-w-0 max-w-[min(42vw,420px)] border-none bg-transparent px-0 text-base font-bold tracking-tight shadow-none focus-visible:ring-0"
                  placeholder="Untitled form"
                  aria-label="Form name"
                />
                <Edit2 className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{fieldCount} {fieldCount === 1 ? 'field' : 'fields'}</span>
                <span aria-hidden="true">·</span>
                <span>{builder.layout.mode === 'multiStep' ? `${builder.layout.steps?.length || 0} steps` : 'Single page'}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-2 border-r border-border/80 pr-3 xl:flex">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className={`h-1.5 w-1.5 rounded-full ${builder.unsavedChanges ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden="true" />
                {builder.unsavedChanges ? 'Changes not saved' : 'All changes saved'}
              </span>
              {currentForm.isPublished && (
                <Badge variant="outline" className="h-6 border-emerald-200 bg-emerald-50 px-2 text-[10px] font-bold text-emerald-700">
                  <Globe className="mr-1 h-3 w-3" aria-hidden="true" /> Live
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" disabled aria-label="Undo last change" title="Undo">
              <Undo2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" disabled aria-label="Redo last change" title="Redo">
              <Redo2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAIModal(true)} className="hidden gap-1.5 px-2.5 text-xs font-semibold md:inline-flex">
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              AI assist
            </Button>
            <div className="group relative hidden sm:block">
              <Button variant="ghost" size="icon" aria-label="More form actions" title="More actions">
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="invisible absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-border bg-card p-1.5 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => { setNewName(`${builder.formName} (Copy)`); setShowNamingDialog('duplicate'); }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> Duplicate form
                </button>
                <button
                  type="button"
                  onClick={() => { setNewName(builder.formName); setShowNamingDialog('template'); }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <Layout className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> Save as template
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> Export JSON
                </button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!currentForm.isPublished}
              title={currentForm.isPublished ? 'Open the live form' : 'Publish the form to open the live preview'}
              onClick={() => {
                if (!currentForm.isPublished || !currentOrg) return;
                const orgSlug = currentOrg.slug || 'default-org';
                const BASE_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
                window.open(`${BASE_URL}/${orgSlug}/${currentForm.slug}`, '_blank', 'noopener,noreferrer');
              }}
              className="hidden sm:inline-flex"
            >
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
              <span className="hidden sm:inline">Save</span>
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Globe className="mr-2 h-4 w-4" aria-hidden="true" />}
              <span className="hidden sm:inline">Publish</span>
            </Button>
          </div>
        </div>

        <div className="flex min-h-10 items-center justify-between gap-3 border-t border-border/60 px-4 lg:px-6">
          <nav className="flex h-10 items-center gap-1" aria-label="Editor workspace">
            <button type="button" className="inline-flex h-8 items-center gap-1.5 border-b-2 border-primary px-2.5 text-xs font-bold text-primary">
              <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
              Build
            </button>
            <button type="button" onClick={() => setShowLayout(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Layout className="h-3.5 w-3.5" aria-hidden="true" />
              Layout
            </button>
            <button type="button" onClick={() => setShowSettings(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              Settings
            </button>
          </nav>
          <div className="flex items-center gap-1.5">
            <span className="hidden text-[11px] font-semibold text-muted-foreground xl:inline">{requiredCount} required</span>
            {attentionCount > 0 && (
              <span className="hidden items-center gap-1 text-[11px] font-semibold text-amber-700 md:inline-flex">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {attentionCount} needs attention
              </span>
            )}
            <div className="ml-1 h-5 w-px bg-border/80" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsPaletteOpen((open) => !open);
                if (typeof window !== 'undefined' && window.innerWidth < 1024) setIsInspectorOpen(false);
              }}
              aria-pressed={isPaletteOpen}
              className="h-8 gap-1.5 px-2 text-xs"
            >
              <PanelLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden md:inline">Fields</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsInspectorOpen((open) => !open);
                if (typeof window !== 'undefined' && window.innerWidth < 1024) setIsPaletteOpen(false);
              }}
              aria-pressed={isInspectorOpen}
              className="h-8 gap-1.5 px-2 text-xs"
            >
              <PanelRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden md:inline">Inspector</span>
            </Button>
          </div>
        </div>
      </header>

      {/* AI Prompt Dialog - global */}
      <Dialog open={showAIModal} onOpenChange={setShowAIModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Build with AI</DialogTitle>
            <DialogDescription>Describe the change you want to make to the entire form.</DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="h-32 w-full"
              placeholder="e.g. add a DOB field"
              disabled={isAISubmitting}
            />
          </div>
          {isAISubmitting && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              AI is updating your form…
            </div>
          )}
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowAIModal(false)}>Cancel</Button>
            <Button variant="secondary" onClick={handleFormAISubmit} disabled={isAISubmitting || aiPrompt.trim() === ''}>
              {isAISubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Wand2 className="mr-2 h-4 w-4" aria-hidden="true" />}
              {isAISubmitting ? 'Applying…' : 'Apply changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Naming Dialog */}
      <Dialog open={!!showNamingDialog} onOpenChange={() => setShowNamingDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{showNamingDialog === 'duplicate' ? 'Duplicate form' : 'Save as template'}</DialogTitle>
            <DialogDescription>
              {showNamingDialog === 'duplicate' ? 'Give the duplicated form a clear name.' : 'Choose a name for this organization template.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter a name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  if (showNamingDialog === 'duplicate') {
                    void handleDuplicateForm(newName);
                  } else {
                    void handleSaveAsTemplate(newName);
                  }
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNamingDialog(null)}>Cancel</Button>
            <Button
              onClick={() => showNamingDialog === 'duplicate' ? handleDuplicateForm(newName) : handleSaveAsTemplate(newName)}
              disabled={!newName.trim() || isProcessingAction}
            >
              {isProcessingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Published URL Modal */}
      {publishedUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Published form">
          <button type="button" className="fixed inset-0 bg-foreground/30 backdrop-blur-[2px]" onClick={() => setPublishedUrl(null)} aria-label="Close published form dialog" />
          <Card className="relative z-50 w-full max-w-md shadow-xl">
            <CardHeader className="border-b border-border/70 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-4 w-4" aria-hidden="true" /></span>
                Form published
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <p className="text-sm text-muted-foreground">Your form is live and ready to collect submissions.</p>
              <div className="flex items-center gap-2">
                <Input value={publishedUrl} readOnly className="min-w-0 flex-1 text-xs" aria-label="Published form URL" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(publishedUrl)} aria-label="Copy published form URL">
                  {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(publishedUrl, '_blank', 'noopener,noreferrer')}
                >
                  <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                  View live form
                </Button>
                <Button className="flex-1" onClick={() => setPublishedUrl(null)}>Done</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {(isPaletteOpen || isInspectorOpen) && (
          <button
            type="button"
            className="fixed inset-0 top-[108px] z-30 bg-foreground/20 backdrop-blur-[1px] lg:hidden"
            onClick={() => { setIsPaletteOpen(false); setIsInspectorOpen(false); }}
            aria-label="Close editor panels"
          />
        )}

        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Field library */}
          <aside
            className={`${isPaletteOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 top-[108px] z-40 w-[min(88vw,300px)] flex-col border-r border-border/80 bg-card shadow-xl lg:static lg:z-auto lg:top-auto lg:w-[272px] lg:shrink-0 lg:shadow-none`}
          >
            <FieldPalette onAddField={handleAddField} />
          </aside>

          {/* Canvas */}
          <main className="min-w-0 flex-1 overflow-y-auto bg-muted/35" aria-label="Form canvas">
            <div className="sticky top-0 z-20 flex min-h-12 items-center justify-between gap-3 border-b border-border/70 bg-background/90 px-4 py-2 backdrop-blur lg:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
                  <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-foreground">Form canvas</p>
                  <p className="truncate text-[10px] text-muted-foreground">Arrange fields and select a node to configure it</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className="hidden items-center rounded-md border border-border/80 bg-card p-0.5 sm:flex" role="group" aria-label="Canvas preview size">
                  {canvasModes.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCanvasView(id)}
                      aria-pressed={canvasView === id}
                      title={`${label} canvas`}
                      className={`flex h-7 items-center gap-1.5 rounded px-2 text-[11px] font-semibold transition-colors ${canvasView === id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden xl:inline">{label}</span>
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Fit canvas to window" aria-label="Fit canvas to window">
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Canvas help" aria-label="Canvas help">
                  <CircleHelp className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div className="px-3 py-5 sm:px-6 lg:px-8 lg:py-7">
              <div className={`mx-auto w-full transition-[max-width] duration-200 ${canvasView === 'mobile' ? 'max-w-[390px]' : canvasView === 'tablet' ? 'max-w-[720px]' : 'max-w-[960px]'}`}>
                <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
                  <div className="border-b border-border/70 bg-background px-5 py-5 sm:px-7 sm:py-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                        Form setup
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                        <span>{fieldCount} {fieldCount === 1 ? 'field' : 'fields'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{requiredCount} required</span>
                        {currentForm.isPublished && <Badge variant="outline" className="h-5 border-emerald-200 bg-emerald-50 px-1.5 text-[10px] text-emerald-700">Live</Badge>}
                      </div>
                    </div>
                    <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">{builder.formName || 'Untitled form'}</h1>
                    <Textarea
                      value={builder.formDescription}
                      onChange={(e) => dispatch(setFormDescription(e.target.value))}
                      placeholder="Add a short description to orient respondents"
                      aria-label="Form description"
                      className="mt-2 min-h-0 resize-none border-none bg-transparent px-0 text-sm leading-6 text-muted-foreground shadow-none focus-visible:ring-0"
                      rows={2}
                    />
                  </div>

                  <div className="px-4 py-5 sm:px-7 sm:py-7">
                    <DroppableCanvas>
                      <SortableContext
                        items={builder.schema.fields.map((f) => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {builder.schema.fields.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.025] px-6 py-16 text-center">
                            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary">
                              <Plus className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <h2 className="mt-4 text-sm font-bold text-foreground">Start with your first field</h2>
                            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">Choose a field from the library or use the quick add buttons to create a clear respondent flow.</p>
                            <div className="mt-5 flex flex-wrap justify-center gap-2">
                              {['text', 'email', 'select'].map((type) => (
                                <Button key={type} type="button" variant="outline" size="sm" onClick={() => handleAddField(type as FormField['type'])}>
                                  <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                  {getDefaultLabel(type as FormField['type'])}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <FieldsByWidth fields={builder.schema.fields} canvasView={canvasView} />
                        )}
                      </SortableContext>
                    </DroppableCanvas>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-5 py-3.5 text-[11px] text-muted-foreground sm:px-7">
                    <span className="inline-flex items-center gap-1.5"><CircleHelp className="h-3.5 w-3.5" aria-hidden="true" /> Select a field to edit its properties.</span>
                    <span className="font-medium">Changes are saved when you select Save.</span>
                  </div>
                </section>
              </div>
            </div>
          </main>

          {/* Inspector */}
          <aside
            className={`${isInspectorOpen ? 'flex' : 'hidden'} fixed inset-y-0 right-0 top-[108px] z-40 w-[min(94vw,390px)] flex-col border-l border-border/80 bg-card shadow-xl lg:static lg:z-auto lg:top-auto lg:w-[380px] lg:shrink-0 lg:shadow-none`}
          >
            <FieldInspector
              key={selectedField?.id || 'form-actions'}
              field={selectedField}
              allFields={builder.schema.fields}
              variables={builder.schema.variables}
              formId={formId}
              onUpdate={(updates) => selectedField && dispatch(updateField({ id: selectedField.id, updates }))}
              onUpdateVariables={(newVariables) => dispatch(updateVariables(newVariables))}
              onClose={() => {
                dispatch(selectField(null));
                if (typeof window !== 'undefined' && window.innerWidth < 1024) setIsInspectorOpen(false);
              }}
            />
          </aside>
        </DndContext>
      </div>

      <LayoutModal open={showLayout} onClose={() => setShowLayout(false)} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} formId={formId} />
    </div>
  );

}
