import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { BuilderState, FormField, FormSchema, FormSettings, FormLayout, FormStep, FormVariable } from '../types';

const defaultLayout: FormLayout = {
  mode: 'singlePage',
  steps: [],
  allowBackNavigation: true,
  orientation: 'vertical',
  stepperStyle: 'progress',
};

let stepIdCounter = 0;
/** Collision-free step id: timestamp + monotonic counter + random suffix. */
const generateStepId = () => `step_${Date.now()}_${++stepIdCounter}_${Math.random().toString(36).slice(2, 7)}`;

const initialState: BuilderState & { aiSessionId?: string | null } = {
  schema: { fields: [], variables: [] },
  settings: {
    thankYouMessage: 'Thank you for your submission!',
    collectTimestamp: true,
    reCaptcha: false,
  },
  selectedFieldId: null,
  unsavedChanges: false,
  formName: '',
  formDescription: '',
  layout: defaultLayout,
  aiSessionId: null,
};

/**
 * Whether an update actually changes the draft.
 *
 * The editor dispatches updates from every toggle and picker; clicking the
 * option that is already selected must not mark the draft dirty, or the
 * autosave fires for buttons that changed nothing. A JSON round-trip is
 * deliberate here: field values are plain JSON (they round-trip through the
 * API), the objects are small, and it cannot be fooled by key order.
 */
function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const builderSlice = createSlice({
  name: 'builder',
  initialState,
  reducers: {
    initializeBuilder: (state, action: PayloadAction<{
      schema: FormSchema;
      settings: FormSettings;
      name: string;
      description: string;
    }>) => {
      state.schema = action.payload.schema;
      state.settings = action.payload.settings;
      state.formName = action.payload.name;
      state.formDescription = action.payload.description;
      state.layout = action.payload.schema.layout || defaultLayout;
      state.unsavedChanges = false;
      state.selectedFieldId = null;      state.aiSessionId = null;    },
    resetBuilder: (state) => {
      state.schema = { fields: [], variables: [] };
      state.settings = {
        thankYouMessage: 'Thank you for your submission!',
        collectTimestamp: true,
        reCaptcha: false,
      };
      state.layout = defaultLayout;
      state.selectedFieldId = null;
      state.unsavedChanges = false;
      state.formName = '';
      state.formDescription = '';
      state.aiSessionId = null;
    },
    addField: (state, action: PayloadAction<FormField>) => {
      state.schema.fields.push(action.payload);
      state.unsavedChanges = true;
    },
    removeField: (state, action: PayloadAction<string>) => {
      state.schema.fields = state.schema.fields.filter(f => f.id !== action.payload);
      if (state.selectedFieldId === action.payload) {
        state.selectedFieldId = null;
      }
      state.unsavedChanges = true;
    },
    updateField: (state, action: PayloadAction<{ id: string; updates: Partial<FormField> }>) => {
      const index = state.schema.fields.findIndex(f => f.id === action.payload.id);
      if (index !== -1) {
        const merged = { ...state.schema.fields[index], ...action.payload.updates };
        if (sameJson(merged, state.schema.fields[index])) return;
        state.schema.fields[index] = merged;
        state.unsavedChanges = true;
      }
    },
    /** v2 — duplicate a question in place, right below the original. */
    duplicateField: (state, action: PayloadAction<string>) => {
      const index = state.schema.fields.findIndex(f => f.id === action.payload);
      if (index === -1) return;
      const source = state.schema.fields[index];
      const copy: FormField = JSON.parse(JSON.stringify(source));
      copy.id = `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      state.schema.fields.splice(index + 1, 0, copy);
      // In multi-step forms the copy joins the same step, right after its source.
      if (state.layout.steps && state.layout.steps.length > 0) {
        state.layout.steps = state.layout.steps.map((step) => ({
          ...step,
          fieldIds: step.fieldIds.includes(action.payload)
            ? step.fieldIds.flatMap((id) => (id === action.payload ? [id, copy.id] : [id]))
            : step.fieldIds,
        }));
      }
      state.selectedFieldId = copy.id;
      state.unsavedChanges = true;
    },
    updateVariables: (state, action: PayloadAction<FormVariable[]>) => {
      if (sameJson(action.payload, state.schema.variables)) return;
      state.schema.variables = action.payload;
      state.unsavedChanges = true;
    },
    reorderFields: (state, action: PayloadAction<{ oldIndex: number; newIndex: number }>) => {
      const { oldIndex, newIndex } = action.payload;
      const [removed] = state.schema.fields.splice(oldIndex, 1);
      state.schema.fields.splice(newIndex, 0, removed);
      // Keep step.fieldIds in sync with the new schema.fields order
      if (state.layout.steps && state.layout.steps.length > 0) {
        const fieldOrder = new Map(state.schema.fields.map((f, i) => [f.id, i]));
        state.layout.steps = state.layout.steps.map((step) => ({
          ...step,
          fieldIds: [...step.fieldIds].sort((a, b) => (fieldOrder.get(a) ?? 0) - (fieldOrder.get(b) ?? 0)),
        }));
      }
      state.unsavedChanges = true;
    },
    selectField: (state, action: PayloadAction<string | null>) => {
      state.selectedFieldId = action.payload;
    },
    updateSettings: (state, action: PayloadAction<Partial<FormSettings>>) => {
      const merged = { ...state.settings, ...action.payload };
      if (sameJson(merged, state.settings)) return;
      state.settings = merged;
      state.unsavedChanges = true;
    },
    setFormName: (state, action: PayloadAction<string>) => {
      if (state.formName === action.payload) return;
      state.formName = action.payload;
      state.unsavedChanges = true;
    },
    setFormDescription: (state, action: PayloadAction<string>) => {
      if (state.formDescription === action.payload) return;
      state.formDescription = action.payload;
      state.unsavedChanges = true;
    },
    markSaved: (state) => {
      state.unsavedChanges = false;
    },
    loadTemplate: (state, action: PayloadAction<{ schema: FormSchema; settings: FormSettings; name: string }>) => {
      state.schema = action.payload.schema;
      state.settings = action.payload.settings;
      state.formName = action.payload.name;
      state.layout = action.payload.schema.layout || defaultLayout;
      state.unsavedChanges = true;
    },
    replaceSchema: (state, action: PayloadAction<FormSchema>) => {
      state.schema = action.payload;
      // if the new schema contains layout we adopt it
      if (action.payload.layout) {
        state.layout = action.payload.layout;
      }
      state.unsavedChanges = true;
    },
    setAISessionId: (state, action: PayloadAction<string | null>) => {
      state.aiSessionId = action.payload;
    },
    updateLayout: (state, action: PayloadAction<Partial<FormLayout>>) => {
      state.layout = { ...state.layout, ...action.payload };
      state.unsavedChanges = true;
    },
    setLayoutMode: (state, action: PayloadAction<'singlePage' | 'multiStep'>) => {
      state.layout.mode = action.payload;
      if (action.payload === 'multiStep' && (!state.layout.steps || state.layout.steps.length === 0)) {
        state.layout.steps = state.schema.fields.length > 0
          ? [{
            id: generateStepId(),
            title: 'Step 1',
            description: '',
            fieldIds: state.schema.fields.map((f) => f.id),
            order: 0,
          }]
          : [{ id: generateStepId(), title: 'Step 1', description: '', fieldIds: [], order: 0 }];
      } else if (action.payload === 'singlePage') {
        state.layout.steps = [];
      }
      state.unsavedChanges = true;
    },
    addStep: (state) => {
      const steps = state.layout.steps || [];
      const newStep: FormStep = {
        id: generateStepId(),
        title: `Step ${steps.length + 1}`,
        description: '',
        fieldIds: [],
        order: steps.length,
      };
      state.layout.steps = [...steps, newStep];
      state.layout.mode = 'multiStep';
      state.unsavedChanges = true;
    },
    removeStep: (state, action: PayloadAction<string>) => {
      const steps = (state.layout.steps || []).filter((s) => s.id !== action.payload);
      state.layout.steps = steps.map((s, i) => ({ ...s, order: i }));
      if (steps.length === 0) {
        state.layout.mode = 'singlePage';
      }
      state.unsavedChanges = true;
    },
    updateStep: (state, action: PayloadAction<{ id: string; updates: Partial<FormStep> }>) => {
      const steps = state.layout.steps || [];
      const idx = steps.findIndex((s) => s.id === action.payload.id);
      if (idx !== -1) {
        steps[idx] = { ...steps[idx], ...action.payload.updates };
        state.layout.steps = [...steps];
        state.unsavedChanges = true;
      }
    },
    assignFieldsToStep: (state, action: PayloadAction<{ stepId: string; fieldIds: string[] }>) => {
      const steps = state.layout.steps || [];
      const { stepId, fieldIds } = action.payload;
      const idx = steps.findIndex((s) => s.id === stepId);
      if (idx !== -1) {
        // Sort assigned fieldIds by schema.fields order so step order matches builder order
        const fieldOrder = new Map(state.schema.fields.map((f, i) => [f.id, i]));
        const sortedFieldIds = [...fieldIds].sort((a, b) => (fieldOrder.get(a) ?? 0) - (fieldOrder.get(b) ?? 0));
        const newSteps = steps.map((s, i) =>
          i === idx
            ? { ...s, fieldIds: sortedFieldIds }
            : { ...s, fieldIds: s.fieldIds.filter((id) => !fieldIds.includes(id)) }
        );
        state.layout.steps = newSteps;
        state.unsavedChanges = true;
      }
    },
    reorderSteps: (state, action: PayloadAction<{ oldIndex: number; newIndex: number }>) => {
      const steps = [...(state.layout.steps || [])];
      const [removed] = steps.splice(action.payload.oldIndex, 1);
      steps.splice(action.payload.newIndex, 0, removed);
      state.layout.steps = steps.map((s, i) => ({ ...s, order: i }));
      state.unsavedChanges = true;
    },
    moveFieldToStep: (state, action: PayloadAction<{ fieldId: string; targetStepId: string }>) => {
      if (!state.layout.steps) return;
      const { fieldId, targetStepId } = action.payload;
      // Remove from all steps
      state.layout.steps = state.layout.steps.map(step => ({
        ...step,
        fieldIds: step.fieldIds.filter(id => id !== fieldId),
      }));
      // Add to target step, sorted by schema.fields order
      const targetIdx = state.layout.steps.findIndex(s => s.id === targetStepId);
      if (targetIdx !== -1) {
        state.layout.steps[targetIdx].fieldIds.push(fieldId);
        const fieldOrder = new Map(state.schema.fields.map((f, i) => [f.id, i]));
        state.layout.steps[targetIdx].fieldIds.sort(
          (a, b) => (fieldOrder.get(a) ?? 0) - (fieldOrder.get(b) ?? 0)
        );
      }
      state.unsavedChanges = true;
    },
  },
});

export const {
  initializeBuilder,
  resetBuilder,
  addField,
  removeField,
  updateField,
  duplicateField,
  updateVariables,
  reorderFields,
  selectField,
  updateSettings,
  setFormName,
  setFormDescription,
  markSaved,
  loadTemplate,
  replaceSchema,
  setAISessionId,
  updateLayout,
  setLayoutMode,
  addStep,
  removeStep,
  updateStep,
  assignFieldsToStep,
  reorderSteps,
  moveFieldToStep,
} = builderSlice.actions;

export default builderSlice.reducer;
