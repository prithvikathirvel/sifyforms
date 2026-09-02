import type { FormField } from '../types';

export type SurveyAnswer = number | string[] | Record<string, number | null> | null;

export function surveyScale(field: FormField): { min: number; max: number } {
  const fallback = field.type === 'nps' ? { min: 0, max: 10 } : { min: 1, max: 5 };
  return field.surveyConfig?.scale ?? fallback;
}

/** Canonicalizes a survey answer before preview/public state or export uses it. */
export function normalizeSurveyAnswer(field: FormField, input: unknown): SurveyAnswer {
  if (['nps', 'csat', 'ces'].includes(field.type)) {
    const n = typeof input === 'number' ? input : Number(input);
    const { min, max } = surveyScale(field);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  }
  if (field.type === 'ranking') {
    const allowed = new Set((field.options ?? []).map((option) => option.value));
    const unique = Array.from(new Set(Array.isArray(input) ? input.filter((v): v is string => typeof v === 'string' && allowed.has(v)) : []));
    return unique.length ? unique : null;
  }
  if (field.type === 'likert') {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const { min, max } = surveyScale(field);
    const answer: Record<string, number | null> = {};
    for (const row of field.surveyConfig?.rows ?? []) {
      const raw = (input as Record<string, unknown>)[row.id];
      const n = typeof raw === 'number' ? raw : Number(raw);
      answer[row.id] = Number.isInteger(n) && n >= min && n <= max ? n : null;
    }
    return Object.values(answer).some((value) => value !== null) ? answer : null;
  }
  return null;
}

export function stableSurveyShuffle<T>(items: T[], seed: string): T[] {
  let state = Array.from(seed).reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const next = state % (index + 1);
    [shuffled[index], shuffled[next]] = [shuffled[next], shuffled[index]];
  }
  return shuffled;
}

export function isSurveyField(field: FormField): boolean {
  return ['nps', 'csat', 'ces', 'likert', 'ranking'].includes(field.type);
}
