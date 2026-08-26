import type { ShowWhenRule, ShowWhenNode, ShowCondition, ShowConditionOperator, FormField, LinkingCondition, LinkingConditionNode } from '../types';
import { isShowWhenGroup, isLinkingGroup } from '../types';

export type FormValues = Record<string, unknown>;

/** Legacy conditionalLogic - migrate to ShowWhenRule when loading */
export function migrateConditionalLogicToShowWhen(
  field: FormField
): ShowWhenRule | undefined {
  if (field.showWhen) return field.showWhen;
  return undefined;
}

function getFieldValue(values: FormValues, fieldId: string): unknown {
  const val = values[fieldId];
  if (val === undefined || val === null) return val;
  return val;
}

function normalizeValue(val: unknown): unknown {
  if (val === undefined || val === null) return val;
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) return val;
  return val;
}

const isEmptyValue = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0);

const isIncluded = (container: unknown, value: unknown): boolean => {
  if (Array.isArray(container)) {
    return container.some((v) => String(v) === String(value));
  }
  return String(container) === String(value);
};

/** Evaluate a single primitive value against an operator + conditionValue. */
function evaluatePrimitive(
  actualValue: unknown,
  operator: ShowConditionOperator,
  conditionValue: unknown
): boolean {
  switch (operator) {
    case 'equals':
      if (actualValue === undefined || actualValue === null) return false;
      if (Array.isArray(actualValue)) {
        return actualValue.some((v) => String(v) === String(conditionValue));
      }
      return String(actualValue) === String(conditionValue);

    case 'notEquals':
      if (actualValue === undefined || actualValue === null) {
        return !isEmptyValue(conditionValue);
      }
      if (Array.isArray(actualValue)) {
        return !actualValue.some((v) => String(v) === String(conditionValue));
      }
      return String(actualValue) !== String(conditionValue);

    case 'contains':
      if (actualValue === undefined || actualValue === null) return false;
      if (Array.isArray(actualValue)) {
        return actualValue.some((v) => String(v).includes(String(conditionValue)));
      }
      return String(actualValue).toLowerCase().includes(String(conditionValue).toLowerCase());

    case 'notContains':
      if (actualValue === undefined || actualValue === null) return true;
      if (Array.isArray(actualValue)) {
        return !actualValue.some((v) => String(v).includes(String(conditionValue)));
      }
      return !String(actualValue).toLowerCase().includes(String(conditionValue).toLowerCase());

    case 'isEmpty':
      return isEmptyValue(actualValue);

    case 'isNotEmpty':
      return !isEmptyValue(actualValue);

    case 'greaterThan':
      if (actualValue === undefined || actualValue === null) return false;
      return Number(actualValue) > Number(conditionValue);

    case 'lessThan':
      if (actualValue === undefined || actualValue === null) return false;
      return Number(actualValue) < Number(conditionValue);

    case 'gte':
      if (actualValue === undefined || actualValue === null) return false;
      return Number(actualValue) >= Number(conditionValue);

    case 'lte':
      if (actualValue === undefined || actualValue === null) return false;
      return Number(actualValue) <= Number(conditionValue);

    case 'in': {
      if (actualValue === undefined || actualValue === null) return false;
      const inArr = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
      return inArr.some((v) => isIncluded(actualValue, v));
    }
    case 'notIn': {
      if (actualValue === undefined || actualValue === null) return true;
      const notInArr = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
      return !notInArr.some((v) => isIncluded(actualValue, v));
    }
    default:
      return false;
  }
}

function evaluateCondition(
  condition: ShowCondition,
  values: FormValues
): boolean {
  const raw = getFieldValue(values, condition.fieldId);

  // Table grid field: value is { rows: Record<string, any>[] }
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'rows' in (raw as object)) {
    const rows = ((raw as any).rows as Record<string, unknown>[]) || [];
    const { operator, value: conditionValue, tableColumnId } = condition;

    if (tableColumnId) {
      // Evaluate against each row's cell value; return true if ANY row matches
      if (operator === 'isEmpty') {
        return !rows.some(row => !isEmptyValue(row[tableColumnId]));
      }
      if (operator === 'isNotEmpty') {
        return rows.some(row => !isEmptyValue(row[tableColumnId]));
      }
      return rows.some(row => evaluatePrimitive(normalizeValue(row[tableColumnId]), operator, conditionValue));
    }

    // No column specified — only isEmpty / isNotEmpty make sense for the whole table
    if (operator === 'isEmpty') return rows.length === 0;
    if (operator === 'isNotEmpty') return rows.length > 0;
    return false;
  }

  // Regular field value
  return evaluatePrimitive(normalizeValue(raw), condition.operator, condition.value);
}

/** Evaluate a rule-tree node: a single condition or a nested AND/OR group */
function evaluateNode(node: ShowWhenNode, values: FormValues): boolean {
  if (isShowWhenGroup(node)) {
    // Empty groups match everything (same behavior as an empty top-level rule)
    if (!node.conditions || node.conditions.length === 0) return true;
    const results = node.conditions.map((child) => evaluateNode(child, values));
    return node.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
  }
  return evaluateCondition(node, values);
}

export function evaluateShowWhen(
  rule: ShowWhenRule | undefined,
  values: FormValues,
  field?: FormField
): boolean {
  const effectiveRule = rule ?? (field ? migrateConditionalLogicToShowWhen(field) : undefined);
  if (!effectiveRule || !effectiveRule.conditions || effectiveRule.conditions.length === 0) {
    return true;
  }
  return evaluateNode(effectiveRule, values);
}

export function getVisibleFields(
  fields: FormField[],
  values: FormValues
): FormField[] {
  return fields.filter((field) => evaluateShowWhen(field.showWhen, values));
}

// ---------------------------------------------------------------------------
// Smart Connection (field linking) condition evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single Smart Connection condition. Preserves the linking-specific
 * empty-value semantics: an unanswered field only matches `equals` when the
 * target value is also empty, and always satisfies `notContains`.
 */
export function evaluateLinkingCondition(
  condition: LinkingCondition,
  values: FormValues
): boolean {
  const currentVal = values[condition.fieldId];
  const targetVal = condition.value;

  if (currentVal === undefined || currentVal === null || currentVal === '') {
    switch (condition.operator) {
      case 'equals': return targetVal === '' || targetVal === undefined || targetVal === null;
      case 'notEquals': return targetVal !== '' && targetVal !== undefined && targetVal !== null;
      case 'contains': return false;
      case 'notContains': return true;
      default: return false;
    }
  }

  const currentStr = String(currentVal);
  const targetStr = String(targetVal);

  switch (condition.operator) {
    case 'equals': return currentStr === targetStr;
    case 'notEquals': return currentStr !== targetStr;
    case 'greaterThan': return Number(currentVal) > Number(targetVal);
    case 'lessThan': return Number(currentVal) < Number(targetVal);
    case 'contains': return currentStr.includes(targetStr);
    case 'notContains': return !currentStr.includes(targetStr);
    default: return false;
  }
}

/**
 * Evaluate a Smart Connection condition tree with the given top-level logic.
 * Nodes may be single conditions or nested AND/OR groups, e.g. `A AND (B OR C)`.
 * An empty list matches nothing (rules without conditions are handled by callers);
 * empty nested groups are neutral (match everything), mirroring showWhen.
 */
export function evaluateLinkingConditions(
  nodes: LinkingConditionNode[] | undefined,
  logic: 'and' | 'or',
  values: FormValues
): boolean {
  if (!nodes || nodes.length === 0) return false;
  const results = nodes.map((node) => {
    if (isLinkingGroup(node)) {
      if (!node.conditions || node.conditions.length === 0) return true;
      return evaluateLinkingConditions(node.conditions, node.logic, values);
    }
    return evaluateLinkingCondition(node, values);
  });
  return logic === 'or' ? results.some(Boolean) : results.every(Boolean);
}
