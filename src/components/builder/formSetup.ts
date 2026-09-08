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

/** Order used by the type picker — the previous editor's field-list order. */
export const TYPE_PICKER_ORDER = [
  'text', 'email', 'phone', 'number', 'select', 'radio', 'checkbox',
  'multiselect', 'date', 'time', 'textarea', 'file', 'rating', 'signature',
  'html', 'display', 'table',
] as const;

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
