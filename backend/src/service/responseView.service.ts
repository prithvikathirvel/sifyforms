import { ResponseLevel, ResponsePolicy } from '../config/rbac.config';

/**
 * Shaping a response for the person looking at it.
 *
 * The rule the rest of the codebase relies on: a submission is never handed to a
 * controller raw. It passes through here first, and what comes out is bounded by
 * the viewer's level and the form's policy.
 */

/** Field types that identify a person unless the form says otherwise. */
const IDENTIFYING_TYPES = new Set([
  'email',
  'phone',
  'tel',
  'name',
  'fullname',
  'firstname',
  'lastname',
  'address',
  'signature',
  'file',
  'fileupload',
  'aadhaar',
  'pan',
  'dob',
  'dateofbirth',
]);

/** Metadata that identifies the submitter even when no field does. */
const IDENTIFYING_META = ['ip', 'userAgent'] as const;

const MASK = '•••••';

interface SchemaField {
  id?: string;
  name?: string;
  type?: string;
  label?: string;
  options?: Array<{ label: string; value: string }>;
  /** Explicit override; when set it wins over the type heuristic. */
  isIdentifying?: boolean;
}

/**
 * Which keys of a response identify the submitter.
 *
 * Type-based detection is a default, not a policy: a form author can mark any
 * field `isIdentifying` (or clear it) in the builder, because only they know
 * that "Employee code" identifies someone and "Favourite colour" does not.
 */
export function identifyingKeys(schema: unknown): Set<string> {
  const keys = new Set<string>();
  const fields: SchemaField[] = (schema as any)?.fields ?? [];

  for (const field of fields) {
    const key = field.id ?? field.name;
    if (!key) continue;

    if (field.isIdentifying === true) {
      keys.add(key);
      continue;
    }
    if (field.isIdentifying === false) continue;

    const type = (field.type ?? '').toLowerCase().replace(/[^a-z]/g, '');
    if (IDENTIFYING_TYPES.has(type)) keys.add(key);
  }
  return keys;
}

export interface RawSubmission {
  id: string;
  formId: string;
  data: string;
  ip?: string | null;
  userAgent?: string | null;
  isRead?: boolean;
  tags?: string;
  processingStatus?: string;
  createdAt: Date;
}

export interface ViewedSubmission {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  isRead?: boolean;
  tags?: unknown;
  processingStatus?: string;
  ip?: string | null;
  userAgent?: string | null;
  /** Keys masked for this viewer, so the UI can label them rather than show blanks. */
  redactedFields?: string[];
}

function parseData(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}

/**
 * Shape one submission for a viewer.
 *
 * Returns null when the viewer may not see individual responses at all - callers
 * filter these out rather than emitting placeholders, so an aggregate-only user
 * cannot infer anything from row count or ordering.
 */
export function viewSubmission(
  submission: RawSubmission,
  schema: unknown,
  level: ResponseLevel,
  policy: ResponsePolicy
): ViewedSubmission | null {
  if (level === 'NONE' || level === 'AGGREGATE') return null;

  const data = parseData(submission.data);
  const base: ViewedSubmission = {
    id: submission.id,
    formId: submission.formId,
    data,
    createdAt: submission.createdAt,
    isRead: submission.isRead,
    tags: submission.tags ? safeParse(submission.tags) : undefined,
    processingStatus: submission.processingStatus,
  };

  const mustRedact = level === 'REDACTED' || policy === 'BLIND_REVIEW';
  if (!mustRedact) {
    return { ...base, ip: submission.ip ?? null, userAgent: submission.userAgent ?? null };
  }

  const identifying = identifyingKeys(schema);
  const redacted: string[] = [];
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (identifying.has(key) && value !== null && value !== undefined && value !== '') {
      masked[key] = MASK;
      redacted.push(key);
    } else {
      masked[key] = value;
    }
  }

  // IP and user agent re-identify a submitter on their own, so they go too.
  for (const meta of IDENTIFYING_META) {
    if (submission[meta]) redacted.push(meta);
  }

  return { ...base, data: masked, ip: null, userAgent: null, redactedFields: redacted };
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Aggregate view
// ---------------------------------------------------------------------------

export interface FieldSummary {
  key: string;
  label: string;
  type: string;
  answered: number;
  skipped: number;
  responseRate: number;
  /** Present for choice-like fields; absent for free text, which cannot be summarised safely. */
  counts?: Record<string, number>;
  /** Present for numeric fields. */
  stats?: { min: number; max: number; mean: number; median: number };
  /** Server-calculated survey metric; clients never supply these values. */
  surveyMetric?: {
    kind: 'nps' | 'csat' | 'ces' | 'likert' | 'ranking';
    score?: number;
    promoters?: number;
    passives?: number;
    detractors?: number;
    topBoxPercent?: number;
    rowMeans?: Record<string, number>;
    averageRanks?: Record<string, number>;
  };
}

export interface AggregateResult {
  formId: string;
  total: number;
  firstResponseAt: Date | null;
  lastResponseAt: Date | null;
  fields: FieldSummary[];
  insights: {
    responsesLast7Days: number;
    responsesPrevious7Days: number;
    changePercent: number | null;
    averageAnswerRate: number;
    activeDays: number;
  };
  trend: {
    rangeDays: number;
    series: Array<{ date: string; count: number }>;
  };
  /** Suppressed when too few responses exist to keep individuals unidentifiable. */
  suppressed: boolean;
  minimumForBreakdown: number;
}

/**
 * Responses below this count produce totals only, no per-field breakdown.
 *
 * With three answers to an anonymous survey in a team of four, a breakdown is a
 * guessing game. This is the difference between an anonymity claim that holds
 * and one that holds only on average.
 */
export const MIN_RESPONSES_FOR_BREAKDOWN = 5;

const SUMMARISABLE = new Set([
  'select',
  'radio',
  'checkbox',
  'multiselect',
  'dropdown',
  'rating',
  'nps',
  'csat',
  'ces',
  'scale',
  'boolean',
  'yesno',
]);

const NUMERIC = new Set(['number', 'rating', 'scale', 'currency', 'nps', 'csat', 'ces']);
const NON_RESPONSE_FIELDS = new Set(['html', 'display']);
const TREND_DAYS = 14;

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function responseTrend(submissions: RawSubmission[]) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (TREND_DAYS - 1));

  const counts = new Map<string, number>();
  for (const submission of submissions) {
    const time = submission.createdAt.getTime();
    if (time < start.getTime() || time >= end.getTime() + 86_400_000) continue;
    const key = utcDateKey(submission.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const series = Array.from({ length: TREND_DAYS }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = utcDateKey(date);
    return { date: key, count: counts.get(key) ?? 0 };
  });
  const responsesPrevious7Days = series.slice(0, 7).reduce((sum, point) => sum + point.count, 0);
  const responsesLast7Days = series.slice(7).reduce((sum, point) => sum + point.count, 0);
  const changePercent = responsesPrevious7Days > 0
    ? Math.round(((responsesLast7Days - responsesPrevious7Days) / responsesPrevious7Days) * 100)
    : responsesLast7Days === 0 ? 0 : null;

  return {
    series,
    responsesLast7Days,
    responsesPrevious7Days,
    changePercent,
    activeDays: series.filter(point => point.count > 0).length,
  };
}

/**
 * Counts and distributions computed server-side, so an aggregate-only viewer
 * gets real insight without a single individual response reaching the client.
 */
export function aggregateSubmissions(
  formId: string,
  submissions: RawSubmission[],
  schema: unknown
): AggregateResult {
  const total = submissions.length;
  const times = submissions.map(s => s.createdAt.getTime());

  const result: AggregateResult = {
    formId,
    total,
    firstResponseAt: total ? new Date(Math.min(...times)) : null,
    lastResponseAt: total ? new Date(Math.max(...times)) : null,
    fields: [],
    insights: {
      responsesLast7Days: 0,
      responsesPrevious7Days: 0,
      changePercent: 0,
      averageAnswerRate: 0,
      activeDays: 0,
    },
    trend: { rangeDays: TREND_DAYS, series: [] },
    suppressed: total > 0 && total < MIN_RESPONSES_FOR_BREAKDOWN,
    minimumForBreakdown: MIN_RESPONSES_FOR_BREAKDOWN,
  };

  // Date buckets can reveal activity patterns in a very small anonymous group,
  // so detailed insight follows the same minimum as per-question breakdowns.
  if (result.suppressed || total === 0) return result;

  const trend = responseTrend(submissions);
  result.trend.series = trend.series;
  result.insights.responsesLast7Days = trend.responsesLast7Days;
  result.insights.responsesPrevious7Days = trend.responsesPrevious7Days;
  result.insights.changePercent = trend.changePercent;
  result.insights.activeDays = trend.activeDays;

  const fields: SchemaField[] = (schema as any)?.fields ?? [];
  const identifying = identifyingKeys(schema);
  const parsed = submissions.map(s => parseData(s.data));

  for (const field of fields) {
    const key = field.id ?? field.name;
    if (!key) continue;

    // Free-text answers can quote a person verbatim; never summarise them.
    if (identifying.has(key)) continue;

    const type = (field.type ?? '').toLowerCase().replace(/[^a-z]/g, '');
    if (NON_RESPONSE_FIELDS.has(type)) continue;

    const values = parsed
      .map(row => row[key])
      .filter(v => v !== undefined && v !== null && v !== '');

    const summary: FieldSummary = {
      key,
      label: field.label ?? key,
      type: field.type ?? 'unknown',
      answered: values.length,
      skipped: Math.max(total - values.length, 0),
      responseRate: total > 0 ? Math.round((values.length / total) * 100) : 0,
    };

    if (SUMMARISABLE.has(type)) {
      const counts: Record<string, number> = {};
      const optionLabels = new Map((field.options ?? []).map(option => [option.value, option.label]));
      for (const value of values) {
        for (const one of Array.isArray(value) ? value : [value]) {
          const raw = String(one);
          const label = optionLabels.get(raw) ?? raw;
          counts[label] = (counts[label] ?? 0) + 1;
        }
      }
      summary.counts = counts;
    }

    if (NUMERIC.has(type)) {
      const numbers = values.map(Number).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
      if (numbers.length) {
        const middle = Math.floor(numbers.length / 2);
        const median = numbers.length % 2
          ? numbers[middle]
          : ((numbers[middle - 1] ?? 0) + (numbers[middle] ?? 0)) / 2;
        summary.stats = {
          min: Math.min(...numbers),
          max: Math.max(...numbers),
          mean: Number((numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2)),
          median: Number(median.toFixed(2)),
        };
      }
    }

    if (type === 'nps') {
      const scores = values.map(Number).filter(Number.isFinite);
      const promoters = scores.filter(score => score >= 9).length;
      const passives = scores.filter(score => score >= 7 && score <= 8).length;
      const detractors = scores.filter(score => score <= 6).length;
      summary.surveyMetric = { kind: 'nps', score: scores.length ? Number((((promoters - detractors) / scores.length) * 100).toFixed(1)) : 0, promoters, passives, detractors };
    } else if (type === 'csat') {
      const scores = values.map(Number).filter(Number.isFinite);
      const configuredMax = Number((field as any).surveyConfig?.scale?.max ?? 5);
      const topBox = configuredMax <= 5 ? configuredMax - 1 : Math.ceil(configuredMax * 0.8);
      summary.surveyMetric = { kind: 'csat', score: summary.stats?.mean, topBoxPercent: scores.length ? Number((scores.filter(score => score >= topBox).length / scores.length * 100).toFixed(1)) : 0 };
    } else if (type === 'ces') {
      summary.surveyMetric = { kind: 'ces', score: summary.stats?.mean };
    } else if (type === 'likert') {
      const totals: Record<string, number[]> = {};
      values.forEach((answer) => { if (answer && typeof answer === 'object' && !Array.isArray(answer)) Object.entries(answer).forEach(([row, score]) => { const n = Number(score); if (Number.isFinite(n)) (totals[row] ||= []).push(n); }); });
      summary.surveyMetric = { kind: 'likert', rowMeans: Object.fromEntries(Object.entries(totals).map(([row, scores]) => [row, Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))])) };
    } else if (type === 'ranking') {
      const ranks: Record<string, number[]> = {};
      values.forEach((answer) => { if (Array.isArray(answer)) answer.forEach((option, index) => (ranks[String(option)] ||= []).push(index + 1)); });
      summary.surveyMetric = { kind: 'ranking', averageRanks: Object.fromEntries(Object.entries(ranks).map(([option, positions]) => [option, Number((positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(2))])) };
    }

    result.fields.push(summary);
  }

  result.insights.averageAnswerRate = result.fields.length > 0
    ? Math.round(result.fields.reduce((sum, field) => sum + field.responseRate, 0) / result.fields.length)
    : 0;

  return result;
}
