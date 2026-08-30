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
import FieldPalette from '../components/builder/FieldPalette';
import SortableField from '../components/builder/SortableField';
import FieldInspector from '../components/builder/FieldInspector';
import SettingsPanel from '../components/builder/SettingsPanel';
import { ArrowLeft, Save, Loader2, Download, MoreVertical, Copy, Layout, Eye, Globe, Check, Edit2, Wand2, Plus, Settings } from 'lucide-react';
import type { FormField } from '../types';
import { cn } from '../lib/utils';
import FormPreview from '../components/builder/FormPreview';

// Droppable canvas component
function DroppableCanvas({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas',
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[360px] rounded-lg transition-colors',
        isOver && 'bg-primary/[0.04]'
      )}
    >
      {children}
    </div>
  );
}

type EditorMode = 'canvas' | 'preview' | 'settings';

const PANEL_MIN = 200;
const PANEL_MAX = 480;
const PALETTE_DEFAULT = 240;
const INSPECTOR_DEFAULT = 320;

// Helper component to render fields by width with step information
function FieldsByWidth({ fields }: { fields: FormField[] }) {
  const dispatch = useAppDispatch();
  const builder = useAppSelector((state) => state.builder);
  const isMultiStep = builder.layout.mode === 'multiStep';
  const isHorizontal = builder.layout.orientation === 'horizontal';

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

  // Horizontal layout: fields flow left-to-right on a 6-column grid and wrap by
  // their width (full = 6 cols, half = 3 cols, third = 2 cols). On mobile they
  // collapse to a single full-width column.
  const getSpanClass = (field: FormField) => {
    switch (field.width || 'full') {
      case 'half': return 'col-span-1 sm:col-span-3';
      case 'third': return 'col-span-1 sm:col-span-2';
      default: return 'col-span-1 sm:col-span-6';
    }
  };

  const renderFieldItem = (field: FormField) => (
    <SortableField
      key={field.id}
      field={field}
      isSelected={field.id === builder.selectedFieldId}
      className={isHorizontal ? getSpanClass(field) : undefined}
      onSelect={() => dispatch(selectField(field.id))}
      onDelete={() => dispatch(removeField(field.id))}
    />
  );

  const renderGroups = (fieldList: FormField[]) => {
    if (isHorizontal) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          {fieldList.map(renderFieldItem)}
        </div>
      );
    }
    return groupByWidth(fieldList).map((group, i) => (
      <div key={i} className={getGridClass(group.width)}>
        {group.fields.map(renderFieldItem)}
      </div>
    ));
  };

  if (isMultiStep && builder.layout.steps && builder.layout.steps.length > 0) {
    const steps = [...builder.layout.steps].sort((a, b) => a.order - b.order);
    const assignedIds = new Set(steps.flatMap(s => s.fieldIds));
    const unassigned = fields.filter(f => !assignedIds.has(f.id));

    return (
      <div className="space-y-6">
        {steps.map(step => {
          const stepFields = fields.filter(f => step.fieldIds.includes(f.id));
          return (
            <div key={step.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Step {step.order + 1}: {step.title}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {stepFields.length > 0
                ? <div className="space-y-3">{renderGroups(stepFields)}</div>
                : <p className="text-xs text-muted-foreground italic px-1">No fields assigned to this step</p>
              }
            </div>
          );
        })}
        {unassigned.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Unassigned
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-3">{renderGroups(unassigned)}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderGroups(fields)}
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
  const [mode, setMode] = useState<EditorMode>('canvas');
  const [isEditingName, setIsEditingName] = useState(false);
  const [paletteWidth, setPaletteWidth] = useState(PALETTE_DEFAULT);
  const [inspectorWidth, setInspectorWidth] = useState(INSPECTOR_DEFAULT);

  // Drag-to-resize handlers for the side panels.
  const beginResize = (side: 'palette' | 'inspector') => (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = side === 'palette' ? paletteWidth : inspectorWidth;

    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const next = side === 'palette' ? startW + dx : startW - dx;
      if (side === 'palette') {
        setPaletteWidth(Math.max(PANEL_MIN, Math.min(PANEL_MAX, next)));
      } else {
        setInspectorWidth(Math.max(PANEL_MIN, Math.min(PANEL_MAX, next)));
      }
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

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

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-workspace">
      {/* Header */}
      <header className="relative shrink-0 border-b border-border/70 bg-card">
        <div className="flex h-14 items-center gap-1 px-2.5 sm:px-3">
          {/* Left — back + form name + status */}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/dashboard')}
              title="Back to dashboard"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
            <div className="h-4 w-px shrink-0 bg-border/70" />

            {/* Inline-editable form name */}
            {isEditingName ? (
              <Input
                autoFocus
                value={builder.formName}
                onChange={(e) => dispatch(setFormName(e.target.value))}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') setIsEditingName(false);
                }}
                className="h-7 w-full max-w-[220px] min-w-[120px] border-input bg-background px-2 text-[12px] font-semibold shadow-none"
                placeholder="Untitled form"
                aria-label="Form name"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="group/name flex min-w-0 max-w-[240px] items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted/60"
                title="Rename form"
              >
                <span className="truncate text-[12px] font-semibold text-foreground">
                  {builder.formName || 'Untitled form'}
                </span>
                <Edit2 className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100" />
              </button>
            )}

            {/* Status pills */}
            <div className="flex shrink-0 items-center gap-1.5 pl-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  currentForm.isPublished
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', currentForm.isPublished ? 'bg-green-500' : 'bg-muted-foreground/50')} />
                {currentForm.isPublished ? 'Published' : 'Draft'}
              </span>
              {builder.unsavedChanges && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Unsaved
                </span>
              )}
            </div>
          </div>

          {/* Center — canvas/preview/settings toggle */}
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center rounded-lg bg-ink-100 p-0.5">
            {(['canvas', 'preview', 'settings'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-md px-3 text-[11px] font-medium capitalize transition-colors',
                  mode === value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {value === 'preview' && <Eye className="h-3 w-3" strokeWidth={1.8} />}
                {value === 'canvas' && <Layout className="h-3 w-3" strokeWidth={1.8} />}
                {value === 'settings' && <Settings className="h-3 w-3" strokeWidth={1.8} />}
                {value}
              </button>
            ))}
          </div>

          {/* Right — actions */}
          <div className="flex flex-1 items-center justify-end gap-1.5">
            <div className="relative group">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="More actions">
                <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.8} />
              </Button>
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-popover p-1 opacity-0 shadow-lg shadow-foreground/5 invisible transition-all group-hover:opacity-100 group-hover:visible">
                <button
                  onClick={() => {
                    setNewName(`${builder.formName} (Copy)`);
                    setShowNamingDialog('duplicate');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[12px] font-medium text-foreground hover:bg-muted"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  Duplicate Form
                </button>
                <button
                  onClick={() => {
                    setNewName(builder.formName);
                    setShowNamingDialog('template');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[12px] font-medium text-foreground hover:bg-muted"
                >
                  <Layout className="h-3.5 w-3.5 text-muted-foreground" />
                  Save as Template
                </button>
                <button
                  onClick={handleExportJSON}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[12px] font-medium text-foreground hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  Export JSON
                </button>
              </div>
            </div>

            <div className="mx-1 h-4 w-px bg-border/70" />

            <Button
              size="sm"
              className="h-7 w-7 rounded-lg p-0"
              variant="ghost"
              onClick={() => setShowAIModal(true)}
              title="AI Assist"
              aria-label="AI Assist"
            >
              <Wand2 className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
            </Button>

            <Button variant="outline" size="sm" className="h-7 gap-1.5 rounded-lg px-2.5 text-[12px]" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                  <span className="hidden sm:inline">Save</span>
                </>
              )}
            </Button>

            {currentForm.isPublished && currentOrg && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 rounded-lg px-2.5 text-[12px]"
                onClick={() => {
                  const orgSlug = currentOrg?.slug || 'default-org';
                  const BASE_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
                  window.open(`${BASE_URL}/${orgSlug}/${currentForm.slug}`, '_blank');
                }}
              >
                <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span className="hidden sm:inline">Preview</span>
              </Button>
            )}

            <Button size="sm" className="h-7 gap-1.5 rounded-lg px-3 text-[12px]" onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5" strokeWidth={1.8} />
                  <span className="hidden sm:inline">Publish</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

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
                  showNamingDialog === 'duplicate' ? handleDuplicateForm(newName) : handleSaveAsTemplate(newName);
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

      {/* Main Content */}
      {mode === 'preview' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FormPreview
            schema={builder.schema}
            settings={builder.settings}
            formId={formId}
            name={builder.formName}
            description={builder.formDescription}
            orientation={builder.layout.orientation}
            layout={builder.layout}
          />
        </div>
      ) : mode === 'settings' ? (
        <SettingsPanel formId={formId} />
      ) : (
        <div className="min-h-0 flex-1 flex">
          {/* Field Palette */}
          <aside
            className="relative shrink-0 overflow-hidden border-r border-border/70 bg-card"
            style={{ width: paletteWidth }}
          >
            <div className="flex h-full flex-col">
              <FieldPalette onAddField={handleAddField} />
            </div>
          </aside>

          {/* Palette resize handle */}
          <div
            onPointerDown={beginResize('palette')}
            className="z-10 w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40"
            role="separator"
            aria-orientation="vertical"
          />

          {/* Canvas */}
          <main className="min-w-0 flex-1 overflow-y-auto bg-workspace">
            <div className="min-h-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <div className={cn(
                'mx-auto rounded-xl border border-border bg-card shadow-sm',
                builder.layout.orientation === 'horizontal' ? 'w-full' : 'max-w-[900px]'
              )}>
                {/* Form title + description */}
                <div className="border-b border-border/70 px-5 py-6 sm:px-8">
                  <h1 className="min-w-0 break-words text-lg font-bold tracking-tight text-foreground sm:text-xl">
                    {builder.formName || 'Untitled form'}
                  </h1>
                  <Textarea
                    value={builder.formDescription}
                    onChange={(e) => dispatch(setFormDescription(e.target.value))}
                    placeholder="Add a description for your form (optional)"
                    className="mt-2 min-h-[40px] resize-none border-transparent bg-transparent p-0 text-[13px] text-muted-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>

                {/* Fields */}
                <div className="px-5 py-6 sm:px-8 sm:py-8">
                  <DndContext
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <DroppableCanvas>
                      <SortableContext
                        items={builder.schema.fields.map((f) => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {builder.schema.fields.length === 0 ? (
                            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-14 text-center">
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/[0.06] text-primary">
                                <Plus className="h-6 w-6" strokeWidth={1.8} />
                              </div>
                              <p className="mt-4 text-[14px] font-semibold text-foreground">
                                Drag and drop a field here
                              </p>
                              <p className="mt-1 text-[12px] text-muted-foreground">
                                Or click a field type from the library on the left to add it
                              </p>
                            </div>
                          ) : (
                            <FieldsByWidth fields={builder.schema.fields} />
                          )}
                        </div>
                      </SortableContext>
                    </DroppableCanvas>
                  </DndContext>
                </div>
              </div>
            </div>
          </main>

          {/* Inspector resize handle */}
          <div
            onPointerDown={beginResize('inspector')}
            className="z-10 w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40"
            role="separator"
            aria-orientation="vertical"
          />

          {/* Inspector Panel */}
          <aside
            className="relative shrink-0 overflow-hidden border-l border-border/70 bg-card"
            style={{ width: inspectorWidth }}
          >
            <FieldInspector
              key={selectedField?.id || 'form-actions'}
              field={selectedField}
              allFields={builder.schema.fields}
              variables={builder.schema.variables}
              formId={formId}
              onUpdate={(updates) => selectedField && dispatch(updateField({ id: selectedField.id, updates }))}
              onUpdateVariables={(newVariables) => dispatch(updateVariables(newVariables))}
              onClose={() => dispatch(selectField(null))}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
