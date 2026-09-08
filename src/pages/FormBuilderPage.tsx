import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchForm, updateForm, publishForm, duplicateForm, saveFormAsTemplate } from '../store/formsSlice';
import { fetchFormAccess } from '../store/formSharingSlice';
import {
  initializeBuilder,
  addField,
  removeField,
  updateField,
  duplicateField,
  reorderFields,
  selectField,
  setFormName,
  setFormDescription,
  markSaved,
  updateVariables,
  moveFieldToStep,
  replaceSchema,
  setAISessionId,
} from '../store/builderSlice';
import { DndContext, closestCenter, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import FieldPalette from '../components/builder/FieldPalette';
import QuestionCard, { type FieldModalKind } from '../components/builder/QuestionCard';
import FormSetupPanel from '../components/builder/FormSetupPanel';
import FieldModals, { VariablesModal } from '../components/builder/FieldModals';
import PreflightDialog from '../components/builder/PreflightDialog';
import SettingsPanel from '../components/builder/SettingsPanel';
import {
  ArrowLeft, Loader2, Download, MoreVertical, Copy, LayoutTemplate, Eye, Globe, Check,
  Edit2, Wand2, Plus, Settings,
} from 'lucide-react';
import type { FormField } from '../types';
import { toast } from '../components/ui/toast';
import { cn } from '../lib/utils';
import FormPreview from '../components/builder/FormPreview';
import { getSetupRows, HAS_OPTIONS, POLLABLE, defaultOptions, type SettingsSectionId } from '../components/builder/formSetup';

// Droppable canvas component. Clicks on the empty canvas collapse the
// expanded question (v2 §3.3: editing happens on the question).
function DroppableCanvas({ children, onBackgroundClick }: { children: React.ReactNode; onBackgroundClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-question-card]')) return;
        onBackgroundClick();
      }}
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
type SaveStatus = 'saved' | 'saving' | 'error' | 'idle';
type PersistResult = 'saved' | 'invalid' | 'error';

const PANEL_MIN = 200;
const PANEL_MAX = 480;
const PALETTE_DEFAULT = 240;
const INSPECTOR_DEFAULT = 320;
/** How long after the last change the draft autosaves (v2 §3.6). */
const AUTOSAVE_DELAY_MS = 1200;

/** Default survey configuration when a question becomes a survey type. */
function surveyDefaultsFor(type: FormField['type']): Partial<FormField>['surveyConfig'] {
  switch (type) {
    case 'nps': return { kind: 'nps', scale: { min: 0, max: 10, minLabel: 'Not at all likely', maxLabel: 'Extremely likely' } };
    case 'csat': return { kind: 'csat', scale: { min: 1, max: 5, minLabel: 'Very dissatisfied', maxLabel: 'Very satisfied' } };
    case 'ces': return { kind: 'ces', scale: { min: 1, max: 7, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' } };
    case 'likert': return {
      kind: 'likert',
      scale: { min: 1, max: 5, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' },
      rows: [{ id: `row_${Date.now()}_1`, label: 'Statement 1' }, { id: `row_${Date.now()}_2`, label: 'Statement 2' }],
    };
    case 'ranking': return { kind: 'ranking', ranking: { requireAll: true } };
    default: return undefined;
  }
}

/** Step separator on the canvas when the form is multi-step (v2 §3.3). */
function StepSeparator({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="h-px flex-1 bg-border" />
      <span className={cn(
        'whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.07em]',
        muted
          ? 'border-border bg-muted text-muted-foreground'
          : 'border-primary/15 bg-accent text-primary'
      )}>
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

// Helper component to render fields by width with step information
function FieldsByWidth({ fields, allFields, onOpenModal }: {
  fields: FormField[];
  allFields: FormField[];
  onOpenModal: (kind: FieldModalKind) => void;
}) {
  const dispatch = useAppDispatch();
  const builder = useAppSelector((state) => state.builder);
  const variables = builder.schema.variables ?? [];
  const formType = builder.settings.formType;
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
    <QuestionCard
      key={field.id}
      field={field}
      index={allFields.findIndex((f) => f.id === field.id)}
      isSelected={field.id === builder.selectedFieldId}
      allFields={allFields}
      variables={variables}
      formType={formType}
      onOpenModal={onOpenModal}
      onDelete={() => dispatch(removeField(field.id))}
      onDuplicate={() => dispatch(duplicateField(field.id))}
      className={isHorizontal ? getSpanClass(field) : undefined}
    />
  );

  const renderGroups = (fieldList: FormField[]) => {
    if (isHorizontal) {
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
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
              <StepSeparator label={`Step ${step.order + 1}: ${step.title || 'Untitled step'}`} />
              {stepFields.length > 0
                ? <div className="space-y-3">{renderGroups(stepFields)}</div>
                : <p className="px-1 text-xs italic text-muted-foreground">No questions assigned to this step</p>
              }
            </div>
          );
        })}
        {unassigned.length > 0 && (
          <div className="space-y-3">
            <StepSeparator label="Unassigned" muted />
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
  const { currentForm, isLoading: formLoading, error: formError } = useAppSelector((state) => state.forms);
  const { currentOrg } = useAppSelector((state) => state.org);
  const formAccess = useAppSelector((state) => formId ? state.formSharing.access[formId] : undefined);
  const formAccessError = useAppSelector((state) => state.formSharing.error);
  const builder = useAppSelector((state) => state.builder);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  /** Latest builder state for the autosave race check. */
  const builderRef = useRef(builder);
  builderRef.current = builder;

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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // v2 — per-question modals (launched from the ⋮ menu) and data calculations
  const [fieldModal, setFieldModal] = useState<FieldModalKind | null>(null);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [preflightOpen, setPreflightOpen] = useState(false);

  const openFieldModal = (kind: FieldModalKind) => {
    if (kind === 'variables') setVariablesOpen(true);
    else setFieldModal(kind);
  };

  // AI modal state for global form editing
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAISubmitting, setIsAISubmitting] = useState(false);

  useEffect(() => {
    if (formId && currentOrg?.id) {
      dispatch(fetchForm(formId));
      dispatch(fetchFormAccess(formId));
    }
  }, [formId, currentOrg?.id, dispatch]);

  /**
   * Load the fetched form into the builder — once per form.
   *
   * `updateForm.fulfilled` replaces `currentForm` with the server's copy, so
   * keying this on `currentForm` alone would tear the builder down after every
   * save. With autosave (v2 §3.6) that would collapse the question being
   * edited every second, so the form id is what decides when to (re)load.
   */
  const initializedFormRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentForm || initializedFormRef.current === currentForm.id) return;
    initializedFormRef.current = currentForm.id;
    dispatch(initializeBuilder({
      schema: currentForm.schema,
      settings: currentForm.settings,
      name: currentForm.name,
      description: currentForm.description || '',
    }));
    // v2 §3.1 — a brand-new form opens with its one empty question already
    // expanded, cursor in the label, so the first interaction is typing.
    const fields = currentForm.schema?.fields ?? [];
    if (fields.length === 1 && fields[0].type === 'text' && !fields[0].label && !currentForm.isPublished) {
      dispatch(selectField(fields[0].id));
    }
  }, [currentForm, dispatch]);

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
        validatedField.label = 'Untitled question';
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

      // Preserve survey configuration
      if (validatedField.surveyConfig && Object.keys(validatedField.surveyConfig).length > 0) {
        cleanedField.surveyConfig = validatedField.surveyConfig;
      }

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

  /**
   * Persist the form. `silent` is used by the autosave (v2 §3.6): validation
   * hiccups are not toasted, only real failures surface in the status line.
   */
  const persistForm = async (silent: boolean): Promise<PersistResult> => {
    if (!formId) return 'invalid';

    if (!builder.formName || builder.formName.trim() === '') {
      if (!silent) toast.error('Form name is required. Please add a form name before saving.');
      return 'invalid';
    }

    if (!builder.schema || !builder.schema.fields || builder.schema.fields.length === 0) {
      if (!silent) toast.error('Form must have at least one field before saving.');
      return 'invalid';
    }

    const isBackendAccessible = await checkBackendConnectivity();
    if (!isBackendAccessible) {
      if (!silent) toast.error('Backend server is not accessible. Please check if the server is running and try again.');
      return 'error';
    }

    setIsSaving(true);
    const stateAtSave = builder;
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
        if (!silent) toast.error('Form schema validation failed. Please check field configurations.');
        return 'invalid';
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

      await dispatch(updateForm({ id: formId, data: formData.data })).unwrap();
      // Only clear the dirty flag when nothing changed while the request was
      // in flight — otherwise a keystroke made during the save would be
      // silently marked as saved.
      if (builderRef.current === stateAtSave) {
        dispatch(markSaved());
      }
      if (!silent) toast.success({ title: 'Form saved', description: 'Your changes are saved.' });
      return 'saved';
    } catch (error: any) {
      if (!silent) {
        // Handle structured errors from Redux Toolkit
        let errorMessage = 'Failed to save form';
        let validationErrors = null;

        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object') {
          if (error.error) {
            errorMessage = error.error;
            validationErrors = error.details;
          } else {
            if (!error.response) {
              if (error.message && (error.message.includes('Network Error') || error.message.includes('ERR_NETWORK'))) {
                toast.error('Network Error: Unable to connect to the server. Please check if the backend server is running.');
                return 'error';
              } else if (error.message && error.message.includes('CORS')) {
                toast.error('CORS Error: Server configuration issue. Please check backend CORS settings.');
                return 'error';
              } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_CONNECTION_REFUSED') {
                toast.error('Connection Refused: Backend server is not running or not accessible.');
                return 'error';
              }
            }

            errorMessage = error.response?.data?.error || error.message || 'Failed to save form';
            validationErrors = error.response?.data?.details;
          }
        }

        if (validationErrors) {
          toast.error({ title: 'Validation failed', description: JSON.stringify(validationErrors, null, 2) });
        } else {
          toast.error(`Save failed: ${errorMessage}`);
        }
      }
      return 'error';
    } finally {
      setIsSaving(false);
    }
  };

  /* v2 §3.6 — the draft autosaves; the Save button is gone. */
  const persistRef = useRef(persistForm);
  persistRef.current = persistForm;
  const autoSaveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!builder.unsavedChanges) return;
    setSaveStatus('saving');
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(async () => {
      autoSaveTimer.current = null;
      const result = await persistRef.current(true);
      setSaveStatus(result === 'saved' ? 'saved' : result === 'invalid' ? 'idle' : 'error');
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
    };
  }, [builder.unsavedChanges, builder.schema, builder.settings, builder.formName, builder.formDescription]);

  // Leaving the editor with a save still pending flushes it, so switching to
  // the dashboard right after typing cannot drop the last edit.
  useEffect(() => {
    const flush = () => {
      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
        void persistRef.current(true);
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, []);

  const retrySave = async () => {
    setSaveStatus('saving');
    const result = await persistForm(false);
    setSaveStatus(result === 'saved' ? 'saved' : result === 'invalid' ? 'idle' : 'error');
  };

  const handlePublish = async () => {
    if (!formId) return;

    // Check backend connectivity first
    const isBackendAccessible = await checkBackendConnectivity();
    if (!isBackendAccessible) {
      toast.error('Backend server is not accessible. Please check if the server is running and try again.');
      return;
    }

    // Validate before publishing
    if (!builder.formName || builder.formName.trim() === '') {
      toast.error('Form name is required. Please add a form name before publishing.');
      return;
    }

    if (!builder.schema || !builder.schema.fields || builder.schema.fields.length === 0) {
      toast.error('Form must have at least one field before publishing.');
      return;
    }

    setIsPublishing(true);
    try {
      const schema = getSchemaWithLayout();

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
        toast.error(`Form schema validation failed for field(s): ${names}. Please check field configurations.`);
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
      setSaveStatus('saved');
      setPreflightOpen(false);
      toast.success({ title: 'Form published', description: 'It is now live and accepting responses.' });

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
        if (error.error) {
          errorMessage = error.error;
          validationErrors = error.details;
        } else {
          if (!error.response) {
            if (error.message && (error.message.includes('Network Error') || error.message.includes('ERR_NETWORK'))) {
              toast.error('Network Error: Unable to connect to the server. Please check if the backend server is running.');
              return;
            } else if (error.message && error.message.includes('CORS')) {
              toast.error('CORS Error: Server configuration issue. Please check backend CORS settings.');
              return;
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_CONNECTION_REFUSED') {
              toast.error('Connection Refused: Backend server is not running or not accessible.');
              return;
            }
          }

          errorMessage = error.response?.data?.error || error.message || 'Failed to publish form';
          validationErrors = error.response?.data?.details;
        }
      }

      if (validationErrors) {
        toast.error({ title: 'Validation failed', description: JSON.stringify(validationErrors, null, 2) });
      } else {
        toast.error(`Publish failed: ${errorMessage}`);
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
      toast.success('Form duplicated successfully!');
      setShowNamingDialog(null);
      navigate(`/forms/${result.id}/edit`);
    } catch (error: any) {
      toast.error(`Failed to duplicate form: ${error}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSaveAsTemplate = async (confirmedName: string) => {
    if (!formId) return;

    setIsProcessingAction(true);
    try {
      await dispatch(saveFormAsTemplate({ formId, name: confirmedName })).unwrap();
      toast.success('Template created successfully!');
      setShowNamingDialog(null);
    } catch (error: any) {
      toast.error(`Failed to create template: ${error}`);
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

  /** v2 — new questions start empty and focused, not pre-labelled. */
  const handleAddField = (type: FormField['type']) => {
    const newField: FormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      label: '',
      placeholder: '',
      required: false,
      options: HAS_OPTIONS(type) ? defaultOptions() : undefined,
      surveyConfig: surveyDefaultsFor(type),
    };
    dispatch(addField(newField));
    dispatch(selectField(newField.id));
    // Bring the new question into view, cursor ready in its label.
    window.setTimeout(() => {
      document.getElementById(`q-${newField.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /** Jump from the Form setup panel into a settings section. */
  const goToSettingsSection = (target: 'layout' | SettingsSectionId) => {
    try {
      const scope = formId ?? 'draft';
      window.sessionStorage.setItem(`sifyforms.builder.${scope}.settingsTab`, JSON.stringify(target === 'layout' ? 'layout' : 'form'));
      if (target !== 'layout') {
        window.sessionStorage.setItem(`sifyforms.builder.${scope}.formSettingsTab`, JSON.stringify(target));
      }
    } catch {
      // Storage unavailable: the settings workspace simply opens on its last tab.
    }
    setMode('settings');
  };

  /** Pre-flight “Fix this” actions (v2 §3.6). */
  const handlePreflightFix = (action: 'poll' | 'payment' | 'scoring') => {
    if (action === 'payment') {
      goToSettingsSection('payment');
    } else if (action === 'poll') {
      setMode('canvas');
    } else if (action === 'scoring') {
      const firstChoice = builder.schema.fields.find((f) => POLLABLE(f.type));
      setMode('canvas');
      if (firstChoice) {
        dispatch(selectField(firstChoice.id));
        setFieldModal('scoring');
      }
    }
  };

  if (formLoading || (currentForm && !formAccess && !formAccessError)) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!currentForm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">Form unavailable in this organization</h1>
          <p className="mt-2 text-sm text-muted-foreground">{formError || 'The form may belong to another organization or you may not have access.'}</p>
          <Button type="button" className="mt-5" onClick={() => navigate('/forms')}>Back to forms</Button>
        </div>
      </div>
    );
  }

  if (!formAccess?.canEdit) {
    const canOpenResults = formAccess?.level !== undefined && formAccess.level !== 'NONE';
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">View-only access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You can access this form, but your role or share does not allow editing it.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/forms')}>Back to forms</Button>
            {canOpenResults && <Button type="button" onClick={() => navigate(`/forms/${formId}/submissions`)}>Open results</Button>}
          </div>
        </div>
      </div>
    );
  }

  const selectedField = builder.schema.fields.find((f) => f.id === builder.selectedFieldId) ?? null;
  const variables = builder.schema.variables ?? [];
  const setupBadge = getSetupRows(builder.schema.fields, builder.settings, builder.layout, variables)
    .filter((row) => !row.warn).length;

  const publicFormUrl = currentOrg
    ? `${import.meta.env.VITE_PUBLIC_URL || window.location.origin}/${currentOrg.slug || 'default-org'}/${currentForm.slug}`
    : null;

  const autosaveSentence = (() => {
    if (saveStatus === 'saving' || isSaving) {
      return { className: 'text-muted-foreground', dot: 'bg-warning animate-pulse', text: 'Saving…' };
    }
    if (saveStatus === 'error') {
      return { className: 'text-destructive', dot: 'bg-destructive', text: "Couldn't save — retrying", clickable: true };
    }
    if (saveStatus === 'idle') {
      return { className: 'text-muted-foreground', dot: 'bg-muted-foreground/40', text: 'Nothing to save yet' };
    }
    return { className: 'text-muted-foreground', dot: 'bg-success', text: currentForm.isPublished ? 'All changes published' : 'All changes saved' };
  })();

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-workspace">
      {/* Header (v2: the mode switch sits after the name, autosave replaces Save) */}
      <header className="relative shrink-0 border-b border-border/70 bg-card">
        <div className="flex h-14 items-center gap-2 px-2.5 sm:px-3">
          {/* Left — back, name, status, mode switch */}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 flex-none p-0 text-muted-foreground hover:text-foreground"
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
                className="group/name flex min-w-0 max-w-[240px] flex-none items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted/60"
                title="Rename form"
              >
                <span className="truncate text-[12px] font-semibold text-foreground">
                  {builder.formName || 'Untitled form'}
                </span>
                <Edit2 className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100" />
              </button>
            )}

            {/* Status pill + autosave sentence (v2 §3.6) */}
            <div className="hidden items-center gap-1.5 pl-1 sm:flex">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                  currentForm.isPublished && !builder.unsavedChanges
                    ? 'bg-green-500/10 text-green-600'
                    : currentForm.isPublished && builder.unsavedChanges
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                <span className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  currentForm.isPublished && !builder.unsavedChanges ? 'bg-green-500'
                    : currentForm.isPublished && builder.unsavedChanges ? 'bg-amber-500'
                      : 'bg-muted-foreground/50'
                )} />
                {currentForm.isPublished
                  ? builder.unsavedChanges ? 'Published · unpublished changes' : 'Published'
                  : 'Draft'}
              </span>
              {autosaveSentence.clickable ? (
                <button
                  type="button"
                  onClick={retrySave}
                  className="inline-flex items-center gap-1.5 text-[10.5px] whitespace-nowrap text-destructive hover:underline"
                  title="Try saving again"
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', autosaveSentence.dot)} />
                  {autosaveSentence.text}
                </button>
              ) : (
                <span className={cn('inline-flex items-center gap-1.5 text-[10.5px] whitespace-nowrap', autosaveSentence.className)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', autosaveSentence.dot)} />
                  {autosaveSentence.text}
                </span>
              )}
            </div>

            <div className="w-2 flex-none" />

            {/* Mode switch — after the name, out of the absolute-centre collision (v2 §1.3) */}
            <div className="flex flex-none items-center rounded-lg bg-ink-100 p-0.5">
              {([
                { value: 'canvas' as const, icon: LayoutTemplate, label: 'canvas' },
                { value: 'preview' as const, icon: Eye, label: 'preview' },
                { value: 'settings' as const, icon: Settings, label: 'Form setup' },
              ]).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-colors sm:px-3',
                    mode === value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-3 w-3" strokeWidth={1.8} />
                  <span className="hidden lg:inline">{label}</span>
                  {value === 'settings' && (
                    <span className="inline-grid h-[15px] min-w-[15px] place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
                      {setupBadge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right — actions */}
          <div className="flex flex-1 items-center justify-end gap-1.5">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                aria-label="More actions"
                aria-expanded={moreMenuOpen}
                onClick={() => setMoreMenuOpen((v) => !v)}
              >
                <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.8} />
              </Button>
              {moreMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-popover p-1 shadow-lg shadow-foreground/5">
                    <button
                      onClick={() => { setMoreMenuOpen(false); setNewName(`${builder.formName} (Copy)`); setShowNamingDialog('duplicate'); }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[12px] font-medium text-foreground hover:bg-muted"
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      Duplicate Form
                    </button>
                    <button
                      onClick={() => { setMoreMenuOpen(false); setNewName(builder.formName); setShowNamingDialog('template'); }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[12px] font-medium text-foreground hover:bg-muted"
                    >
                      <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
                      Save as Template
                    </button>
                    <button
                      onClick={() => { setMoreMenuOpen(false); handleExportJSON(); }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[12px] font-medium text-foreground hover:bg-muted"
                    >
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      Export JSON
                    </button>
                  </div>
                </>
              )}
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

            {currentForm.isPublished && publicFormUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 rounded-lg px-2.5 text-[12px]"
                onClick={() => window.open(publicFormUrl, '_blank')}
                title="Opens the live public form in a new tab"
              >
                <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span className="hidden sm:inline">Open form</span>
              </Button>
            )}

            {/* v2 §3.6 — Publish is the only button; it runs the pre-flight first */}
            <Button
              size="sm"
              className="h-7 gap-1.5 rounded-lg px-3 text-[12px]"
              onClick={() => setPreflightOpen(true)}
              disabled={isPublishing}
            >
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

      {/* Pre-flight check before publishing (v2 §3.6) */}
      <PreflightDialog
        open={preflightOpen}
        onOpenChange={setPreflightOpen}
        fields={builder.schema.fields}
        settings={builder.settings}
        layout={builder.layout}
        variables={variables}
        isPublishing={isPublishing}
        onPublish={handlePublish}
        onFix={handlePreflightFix}
      />

      {/* Per-question modals, launched from the ⋮ menu (v2 §3.3) */}
      {selectedField && (
        <FieldModals
          key={selectedField.id}
          field={selectedField}
          allFields={builder.schema.fields}
          variables={variables}
          formId={formId}
          activeModal={fieldModal}
          onClose={() => setFieldModal(null)}
          onUpdate={(updates) => dispatch(updateField({ id: selectedField.id, updates }))}
        />
      )}

      {/* Data calculations — reachable from the ⋮ menu and the Form setup panel */}
      {variablesOpen && (
        <VariablesModal
          variables={variables}
          fields={builder.schema.fields}
          onClose={() => setVariablesOpen(false)}
          onUpdateVariables={(newVariables) => dispatch(updateVariables(newVariables))}
        />
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
          {/* Field Palette — eight intentions (v2 §3.2) */}
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
          <main
            className="min-w-0 flex-1 overflow-y-auto bg-workspace scrollbar-subtle"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('[data-question-card]')) return;
              dispatch(selectField(null));
            }}
          >
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

                {/* Questions */}
                <div className="px-5 py-6 sm:px-8 sm:py-8">
                  <DndContext
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <DroppableCanvas onBackgroundClick={() => dispatch(selectField(null))}>
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
                                Drag and drop a question here
                              </p>
                              <p className="mt-1 text-[12px] text-muted-foreground">
                                Or click a question type from the panel on the left to add it
                              </p>
                            </div>
                          ) : (
                            <FieldsByWidth
                              fields={builder.schema.fields}
                              allFields={builder.schema.fields}
                              onOpenModal={openFieldModal}
                            />
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleAddField('text'); }}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-border px-4 py-3.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary/45 hover:bg-accent/60 hover:text-primary"
                          >
                            <Plus className="h-4 w-4" strokeWidth={2} />
                            Add a question
                          </button>
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

          {/* Right panel — Form setup, for the form rather than the field (v2 §3.3) */}
          <aside
            className="relative shrink-0 overflow-hidden border-l border-border/70 bg-card"
            style={{ width: inspectorWidth }}
          >
            <FormSetupPanel
              onOpenVariables={() => setVariablesOpen(true)}
              onGoToSettings={(target) => {
                if (target === 'canvas') setMode('canvas');
                else goToSettingsSection(target);
              }}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
