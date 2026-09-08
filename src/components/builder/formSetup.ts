import type { FormField, FormLayout, FormSettings, FormVariable, ShowCondition, ShowConditionOperator, ShowWhenNode } from '../../types';
import { isShowWhenGroup } from '../../types';
import { isBotProtectionEnabled } from '../../lib/formPolicy';
import {
  Type, Mail, Phone, Hash, ChevronDown, Circle, CheckSquare, ListPlus,
  Calendar, Clock, AlignLeft, Upload, Star, PenTool, Code, Calculator, Table,
} from 'lucide-react';

/** Field types whose answer is a list of options. */
export const HAS_OPTIONS = (t: string) => ['select', 'multiselect', 'radio', 'checkbox', 'ranking'].includes(t);

/** Field types that offer a single answer from a list (radio semantics). */
export const SINGLE_CHOICE = (t: string) => t === 'radio' || t === 'select';

/** Survey-only field types. */
export const SURVEY_TYPES = ['nps', 'csat', 'ces', 'likert', 'ranking'] as const;

/** Field types usable as a counted poll question. */
export const POLLABLE = (t: string) => ['radio', 'select', 'checkbox', 'multiselect'].includes(t);

/** Short technical tag shown on the collapsed question card. */
export const TYPE_LABEL: Record<string, string> = {
  text: 'Text', email: 'Email', phone: 'Phone', number: 'Number', select: 'Dropdown',
  radio: 'Radio', checkbox: 'Checkbox', multiselect: 'Multi-Select', date: 'Date',
  time: 'Time', textarea: 'Long Text', file: 'File', rating: 'Rating',
  signature: 'Signature', html: 'HTML', display: 'Display Value', table: 'Table Grid',
  nps: 'NPS', csat: 'CSAT', ces: 'Effort Score', likert: 'Likert', ranking: 'Ranking',
};

/** v2 §3.2 — what the type is called in the question's own type picker.
 * These are the names the previous editor used (Text Input, Long Text,
 * Dropdown, Radio Buttons…), carried over verbatim so long-time users
 * find the same vocabulary in the new UI. */
export const TYPE_FRIENDLY: Record<string, string> = {
  text: 'Text Input', textarea: 'Long Text', email: 'Email', phone: 'Phone',
  number: 'Number', select: 'Dropdown', radio: 'Radio Buttons', checkbox: 'Checkboxes',
  multiselect: 'Multi-Select', date: 'Date Picker', time: 'Time Picker',
  file: 'File Upload', rating: 'Rating', signature: 'Signature', html: 'Custom HTML',
  display: 'Display Value', table: 'Table Grid', nps: 'NPS (0–10)', csat: 'CSAT',
  ces: 'Effort Score', likert: 'Likert Matrix', ranking: 'Ranking',
};

/** The icon each type carried in the previous editor's field list. */
export const TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type, textarea: AlignLeft, email: Mail, phone: Phone, number: Hash,
  select: ChevronDown, radio: Circle, checkbox: CheckSquare, multiselect: ListPlus,
  date: Calendar, time: Clock, file: Upload, rating: Star, signature: PenTool,
  html: Code, display: Calculator, table: Table, nps: Hash, csat: Star,
  ces: Calculator, likert: Table, ranking: ListPlus,
};

/** One-line contextual description shown in the field editor header. */
export const FIELD_DESCRIPTIONS: Record<string, string> = {
  text: 'A single-line text answer',
  textarea: 'A multi-line long answer',
  email: 'An email address, checked for format',
  phone: 'A phone number',
  number: 'A numeric answer',
  select: 'One answer picked from a dropdown list',
  radio: 'One answer picked from a visible list',
  checkbox: 'One or more answers from a list',
  multiselect: 'Several answers from a dropdown list',
  date: 'A date picked from a calendar',
  time: 'A time of day',
  file: 'Let people upload files',
  rating: 'A star rating out of five',
  signature: 'A drawn or typed signature',
  html: 'A block of custom markup',
  display: 'Show a calculated value on the form',
  table: 'A grid of rows and columns',
  nps: 'How likely people are to recommend you, 0–10',
  csat: 'A satisfaction score',
  ces: 'How easy something was, on a scale',
  likert: 'Agreement with each statement, in a matrix',
  ranking: 'Put items in order of preference',
};

/** Upload types offered for a file question's accepted list. */
export const FILE_ACCEPT_TYPES = ['image/*', '.pdf', '.doc,.docx', '.xls,.xlsx', '.txt'] as const;

/* ---------------------------------------------------------------------------
 * Field editor tabs — derived from the field type, not hard-coded per field
 * ------------------------------------------------------------------------- */
export type FieldEditorTab = 'content' | 'validation' | 'appearance' | 'advanced' | 'preview';

export const FIELD_EDITOR_TAB_LABELS: Record<FieldEditorTab, string> = {
  content: 'Content',
  validation: 'Validation',
  appearance: 'Appearance',
  advanced: 'Advanced',
  preview: 'Preview',
};

/**
 * Which tabs the field editor shows. Every field gets Content, Advanced and
 * Preview; Validation exists wherever answers can be limited (everything but
 * tables), and Appearance only where the type has real appearance settings
 * (the survey scales and labels).
 */
export function fieldEditorTabs(type: FormField['type']): FieldEditorTab[] {
  const tabs: FieldEditorTab[] = ['content'];
  if (type !== 'table') tabs.push('validation');
  if (SURVEY_TYPES.includes(type as (typeof SURVEY_TYPES)[number])) tabs.push('appearance');
  tabs.push('advanced', 'preview');
  return tabs;
}

/** Order used by the type picker — the previous editor's field-list order. */
export const TYPE_PICKER_ORDER = [
  'text', 'email', 'phone', 'number', 'select', 'radio', 'checkbox',
  'multiselect', 'date', 'time', 'textarea', 'file', 'rating', 'signature',
  'html', 'display', 'table',
] as const;

/** The type picker's sections — minimal grouping so the list scans quickly. */
export const TYPE_GROUPS: { label: string; types: FormField['type'][] }[] = [
  { label: 'Basic', types: ['text', 'textarea', 'email', 'phone', 'number'] },
  { label: 'Choice', types: ['select', 'radio', 'checkbox', 'multiselect'] },
  { label: 'Date & time', types: ['date', 'time'] },
  { label: 'Upload & sign', types: ['file', 'signature'] },
  { label: 'More', types: ['rating', 'table', 'html', 'display'] },
];

/** Survey question types, offered first when the form is a survey. */
export const TYPE_SURVEY_GROUP: { label: string; types: FormField['type'][] } = {
  label: 'Survey',
  types: ['nps', 'csat', 'ces', 'likert', 'ranking'],
};

/** Value for an option, derived from its label (v2 §3.2). */
export function slugifyOptionValue(label: string, fallback: string): string {
  const slug = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return slug || fallback;
}

/** Operators available to visibility and alert rules (shared by the modals). */
export const SHOW_OPERATORS: { value: ShowConditionOperator; label: string; needsValue?: boolean }[] = [
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

/* ---------------------------------------------------------------------------
 * "Limit the answer" rules — shared metadata for the field editor's
 * Validation tab (mirrors the ValidationModal definitions)
 * ------------------------------------------------------------------------- */
export const RULE_TYPES: { value: string; label: string }[] = [
  { value: 'required', label: 'Required' },
  { value: 'minLength', label: 'Min length' },
  { value: 'maxLength', label: 'Max length' },
  { value: 'min', label: 'Min value' },
  { value: 'max', label: 'Max value' },
  { value: 'pattern', label: 'Regex pattern' },
  { value: 'email', label: 'Email format' },
  { value: 'url', label: 'URL format' },
  { value: 'contains', label: 'Contains text' },
  { value: 'notContains', label: 'Does not contain' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'greaterThan', label: 'Greater than (>)' },
  { value: 'lessThan', label: 'Less than (<)' },
  { value: 'gte', label: 'Greater than or equal (≥)' },
  { value: 'lte', label: 'Less than or equal (≤)' },
  { value: 'equals', label: 'Exactly equals' },
  { value: 'notEquals', label: 'Does not equal' },
  { value: 'custom', label: 'Matches another field' },
];

/** Rule types that never need a value input. */
export const NO_VALUE_RULE_TYPES = new Set(['required', 'email', 'url']);

export function ruleValuePlaceholder(type: string): string {
  switch (type) {
    case 'minLength': return 'e.g. 5';
    case 'maxLength': return 'e.g. 100';
    case 'min': return 'e.g. 0';
    case 'max': return 'e.g. 100';
    case 'pattern': return 'e.g. ^[A-Za-z]+$';
    case 'custom': return 'Select field…';
    default: return 'Enter value…';
  }
}

export function ruleDefaultMessage(type: string): string {
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
}

export function isInvalidRegex(value: string | number | undefined): boolean {
  if (value === undefined || value === '') return false;
  try {
    new RegExp(String(value));
    return false;
  } catch {
    return true;
  }
}

/**
 * The rule types that make sense for each field type (the Validation tab's
 * select and quick-add chips). 'required' is excluded everywhere — the
 * Required toggle in the footer owns that. A type missing from this map gets
 * no generic rules at all.
 */
export const RULES_BY_TYPE: Record<string, string[]> = {
  text: ['minLength', 'maxLength', 'pattern', 'contains', 'notContains', 'startsWith', 'endsWith', 'equals', 'notEquals', 'url', 'custom'],
  textarea: ['minLength', 'maxLength', 'pattern', 'contains', 'notContains', 'custom'],
  email: ['minLength', 'maxLength', 'contains', 'notContains', 'equals', 'notEquals', 'custom'],
  phone: ['minLength', 'maxLength', 'pattern', 'contains', 'notContains', 'equals', 'notEquals', 'custom'],
  number: ['min', 'max', 'greaterThan', 'lessThan', 'gte', 'lte', 'equals', 'notEquals', 'custom'],
  select: ['equals', 'notEquals', 'custom'],
  radio: ['equals', 'notEquals', 'custom'],
  checkbox: ['equals', 'notEquals', 'custom'],
  multiselect: ['equals', 'notEquals', 'custom'],
  date: ['equals', 'notEquals', 'custom'],
  time: ['equals', 'notEquals', 'custom'],
  rating: ['min', 'max', 'equals', 'notEquals'],
  nps: ['min', 'max'],
  csat: ['min', 'max'],
  ces: ['min', 'max'],
};

/** What the Validation tab offers for a field type. */
export type ValidationTabMode = 'rules' | 'file' | 'none';

export function validationTabMode(type: string): ValidationTabMode {
  if (type === 'file') return 'file';
  return (RULES_BY_TYPE[type]?.length ?? 0) > 0 ? 'rules' : 'none';
}

/** The rules a field type offers, with a legacy rule's type kept selectable. */
export function ruleOptionsFor(type: string, current?: string): { value: string; label: string }[] {
  const list = RULES_BY_TYPE[type] ?? [];
  const options = RULE_TYPES.filter((r) => list.includes(r.value));
  if (current && !list.includes(current)) {
    const legacy = RULE_TYPES.find((r) => r.value === current);
    if (legacy) options.push(legacy);
  }
  return options;
}

/** A rule restated as the sentence a person would say out loud. */
export function ruleSentence(type: string, value: string | number | undefined, matchFieldLabel?: string): string {
  const v = value === undefined || value === '' ? '…' : String(value);
  switch (type) {
    case 'required': return 'Must be filled in';
    case 'minLength': return `At least ${v} characters`;
    case 'maxLength': return `At most ${v} characters`;
    case 'min': return `At least ${v}`;
    case 'max': return `At most ${v}`;
    case 'greaterThan': return `More than ${v}`;
    case 'lessThan': return `Less than ${v}`;
    case 'gte': return `${v} or more`;
    case 'lte': return `${v} or less`;
    case 'equals': return `Exactly ${v}`;
    case 'notEquals': return `Anything except ${v}`;
    case 'pattern': case 'regex': return 'Matches a pattern';
    case 'email': return 'A valid email address';
    case 'url': return 'A valid web address';
    case 'contains': return `Contains \u201C${v}\u201D`;
    case 'notContains': return `Does not contain \u201C${v}\u201D`;
    case 'startsWith': return `Starts with \u201C${v}\u201D`;
    case 'endsWith': return `Ends with \u201C${v}\u201D`;
    case 'custom': return `Same answer as \u201C${matchFieldLabel ?? 'another field'}\u201D`;
    default: return type;
  }
}

/** Count leaf conditions in a (possibly nested) show-when rule. */
export function countShowWhenLeaves(nodes: ShowWhenNode[] | undefined): number {
  if (!nodes) return 0;
  return nodes.reduce(
    (sum, node) => sum + (isShowWhenGroup(node) ? countShowWhenLeaves(node.conditions) : 1),
    0
  );
}

/** First leaf condition of a show-when rule, for one-line summaries. */
export function firstShowWhenLeaf(nodes: ShowWhenNode[] | undefined): ShowCondition | null {
  if (!nodes || !nodes.length) return null;
  for (const node of nodes) {
    if (isShowWhenGroup(node)) {
      const found = firstShowWhenLeaf(node.conditions);
      if (found) return found;
    } else {
      return node;
    }
  }
  return null;
}

/** Settings sections that exist in the Form settings workspace. */
export type SettingsSectionId =
  | 'general' | 'after-submit' | 'access' | 'team' | 'appearance'
  | 'authentication' | 'payment' | 'assessment' | 'voting' | 'survey';

export const SETTINGS_SECTIONS: { id: SettingsSectionId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'after-submit', label: 'After submission' },
  { id: 'access', label: 'Access & Security' },
  { id: 'team', label: 'Team & Sharing' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'payment', label: 'Payment' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'voting', label: 'Voting' },
  { id: 'survey', label: 'Survey' },
];

/** Where a "What's set up" row sends you when clicked. */
export type SetupTarget = SettingsSectionId | 'layout' | 'canvas' | 'variables' | null;

export interface SetupRow {
  text: string;
  warn?: boolean;
  target: SetupTarget;
}

/** True when a payment amount is resolvable from the current configuration. */
export function paymentAmountResolved(payment: FormSettings['payment'], fields: FormField[], variables: FormVariable[]): boolean {
  if (!payment?.enabled) return false;
  if (payment.amountType === 'static') return !!payment.staticAmount && Number(payment.staticAmount) > 0;
  if (payment.amountType === 'field') return !!payment.amountFieldId && fields.some((f) => f.id === payment.amountFieldId);
  if (payment.amountType === 'variable') return !!payment.amountVariableId && variables.some((v) => v.id === payment.amountVariableId);
  return false;
}

/**
 * v2 §3.4 — the "What's set up" map: every feature currently switched on,
 * each entry linking to the control that switched it on.
 */
export function getSetupRows(
  fields: FormField[],
  settings: FormSettings,
  layout: FormLayout,
  variables: FormVariable[]
): SetupRow[] {
  const rows: SetupRow[] = [];
  const formType = settings.formType;

  if (formType === 'voting') {
    const poll = fields.find((f) => f.isPollQuestion);
    rows.push({
      text: poll ? `Poll · counting “${poll.label || 'Untitled question'}”` : 'Poll · no counted question yet',
      warn: !poll,
      target: 'canvas',
    });
    if (settings.voting?.duplicatePrevention === 'email') {
      rows.push({ text: 'One vote per email address', target: 'voting' });
    }
  }
  if (formType === 'assessment') {
    const scored = fields.filter((f) => f.correctAnswer !== undefined && f.correctAnswer !== null).length;
    rows.push({
      text: scored > 0 ? `Quiz · ${scored} question${scored === 1 ? '' : 's'} scored` : 'Quiz · no correct answers set yet',
      warn: scored === 0,
      target: 'canvas',
    });
  }
  if (formType === 'survey') {
    rows.push({ text: 'Survey · NPS, CSAT and Likert available', target: 'survey' });
  }

  if (layout.mode === 'multiStep' && (layout.steps ?? []).length > 0) {
    rows.push({ text: `${(layout.steps ?? []).length} steps`, target: 'layout' });
  }
  if (isBotProtectionEnabled(settings)) {
    rows.push({ text: 'Bot protection on', target: 'access' });
  }
  if (settings.authentication?.enabled) {
    rows.push({ text: 'Email or phone verification required', target: 'authentication' });
  }
  if (settings.partialSubmission?.enabled) {
    rows.push({ text: 'Save and resume enabled', target: 'authentication' });
  }
  if (settings.payment?.enabled) {
    rows.push({
      text: paymentAmountResolved(settings.payment, fields, variables)
        ? 'Payment collected'
        : 'Payment on but no amount set',
      warn: !paymentAmountResolved(settings.payment, fields, variables),
      target: 'payment',
    });
  }

  const conditional = fields.filter((f) => f.showWhen && countShowWhenLeaves(f.showWhen.conditions) > 0).length;
  if (conditional) {
    rows.push({ text: `${conditional} question${conditional === 1 ? '' : 's'} shown conditionally`, target: null });
  }
  const external = fields.filter((f) => f.externalValidation?.enabled).length;
  if (external) {
    rows.push({ text: `${external} answer${external === 1 ? '' : 's'} checked with another system`, target: null });
  }
  if (variables.length) {
    rows.push({ text: `${variables.length} calculated variable${variables.length === 1 ? '' : 's'}`, target: 'variables' });
  }
  if (settings.isFormActive === false) {
    rows.push({ text: 'Not accepting responses', warn: true, target: 'general' });
  }

  return rows;
}

/** Default option pair seeded when a field becomes an options field. */
export function defaultOptions(): Array<{ label: string; value: string }> {
  return [
    { label: 'Option 1', value: 'option_1' },
    { label: 'Option 2', value: 'option_2' },
  ];
}
