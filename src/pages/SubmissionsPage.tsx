import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchSubmissions, deleteSubmission, exportSubmissions } from '../store/submissionsSlice';
import { fetchForm } from '../store/formsSlice';
import { fetchFormAccess } from '../store/formSharingSlice';
import AggregateResults from '../components/forms/AggregateResults';
import { RESPONSE_LEVEL_LABEL } from '../hooks/usePermissions';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { DataTable, type DataTableColumn } from '../components/ui/data-table';
import { Pagination } from '../components/ui/pagination';
import { Tooltip } from '../components/ui/tooltip';
import SubmissionViewer from '../components/ui/SubmissionViewer';
import api from '../lib/api';
import type { AssessmentResult, VotingResult } from '../types';
import {
  ArrowLeft,
  Download,
  Trash2,
  Eye,
  Search,
  Loader2,
  Inbox,
  X,
  BarChart2,
  Trophy,
  ClipboardCheck,
  ShieldCheck,
  RefreshCw,
  EyeOff,
  Lock,
  CalendarDays,
  CheckCircle2,
  Copy,
  FileText,
  Globe2,
  Hash,
  Monitor,
  Award,
  Percent,
  Target,
  UsersRound,
  Activity,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

// ── Shared helpers ──────────────────────────────────────────────────────────

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function shortDate(dateString: string | null) {
  if (!dateString) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? new Date(`${dateString}T00:00:00`)
    : new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    if (typeof value[0] === 'object' && value[0] !== null) {
      const names = value
        .map((item) => {
          if (!item || typeof item !== 'object') return undefined;
          const record = item as Record<string, unknown>;
          return typeof record.filename === 'string'
            ? record.filename
            : typeof record.name === 'string'
              ? record.name
              : undefined;
        })
        .filter((name): name is string => Boolean(name));
      if (names.length > 0) return `📎 ${names.join(', ')}`;
      return `${value.length} file${value.length > 1 ? 's' : ''}`;
    }
    return value.join(', ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.filename === 'string') return `📎 ${record.filename}`;
    if (typeof record.name === 'string') return `📎 ${record.name}`;
    return JSON.stringify(value);
  }
  return String(value);
}

// ── Assessment Analytics Panel ───────────────────────────────────────────────

interface AssessmentAnalytics {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  passThreshold?: number;
  avgScore: number;
  averageMaxScore?: number;
  avgPercentage: number;
  medianPercentage?: number;
  highestPercentage?: number;
  lowestPercentage?: number;
  scoreSpread?: number;
  distribution: Array<{ range: string; count: number; percentage?: number }>;
  trend?: Array<{ date: string; attempts: number; averagePercentage: number; passRate: number }>;
  recent?: {
    attemptsLast7Days: number;
    attemptsPrevious7Days: number;
    attemptChangePercent: number | null;
    averageLast7Days: number;
    averagePrevious7Days: number;
    scoreChange: number;
  };
  questionPerformance?: Array<{
    fieldId: string;
    label: string;
    attempts: number;
    correct: number;
    incorrect: number;
    accuracy: number;
    averagePoints: number;
    maxPoints: number;
  }>;
  sectionPerformance?: Array<{
    key: string;
    label: string;
    score: number;
    maxScore: number;
    percentage: number;
  }>;
  suppressed?: boolean;
  minimumForBreakdown?: number;
}

function AssessmentAnalyticsTab({ formId }: { formId: string }) {
  const [data, setData] = useState<AssessmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await api.get(`/processing/forms/${formId}/assessment-analytics`);
      setData(response.data as AssessmentAnalytics);
    } catch {
      setLoadError('Assessment analytics could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  if (loadError && !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-xs font-semibold text-destructive">{loadError}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} className="mt-4">Try again</Button>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center px-4 text-center">
        <div>
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-ink-50 text-ink-400">
            <ClipboardCheck className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <h2 className="mt-3 font-display text-sm font-bold text-foreground">No assessment analytics yet</h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground">Scored attempts will appear after assessment submissions are processed.</p>
        </div>
      </div>
    );
  }

  const trend = data.trend ?? [];
  const questions = data.questionPerformance ?? [];
  const sections = data.sectionPerformance ?? [];
  const maxDistribution = Math.max(...data.distribution.map(item => item.count), 1);
  const maxAttempts = Math.max(...trend.map(item => item.attempts), 1);
  const strongestQuestion = [...questions].sort((a, b) => b.accuracy - a.accuracy)[0];
  const toughestQuestion = [...questions].sort((a, b) => a.accuracy - b.accuracy)[0];
  const passThreshold = data.passThreshold ?? 60;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-foreground">Assessment analytics</h2>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">Score quality, outcomes, activity, and question-level performance.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="h-8 self-start rounded-lg text-[11px]">
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh analytics
        </Button>
      </div>

      {data.suppressed ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-4">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <h3 className="text-xs font-semibold text-amber-900">Detailed analytics are temporarily protected</h3>
              <p className="mt-1 text-[11px] font-medium leading-5 text-amber-800">
                This assessment has {data.total} processed attempt{data.total === 1 ? '' : 's'}. Score and question breakdowns appear at {data.minimumForBreakdown ?? 5} attempts for aggregate-only access.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <AnalyticsStat icon={<UsersRound className="h-4 w-4" />} label="Processed attempts" value={data.total.toLocaleString()} detail={data.recent ? `${data.recent.attemptsLast7Days} in the last 7 days` : 'All scored submissions'} />
            <AnalyticsStat icon={<Target className="h-4 w-4" />} label="Pass rate" value={`${data.passRate}%`} detail={`${data.passed} passed · ${data.failed} failed`} />
            <AnalyticsStat icon={<Award className="h-4 w-4" />} label="Average score" value={`${data.avgPercentage}%`} detail={data.averageMaxScore !== undefined ? `${data.avgScore} / ${data.averageMaxScore} average points` : `${data.avgScore} average points`} />
            <AnalyticsStat icon={<Percent className="h-4 w-4" />} label="Median score" value={`${data.medianPercentage ?? data.avgPercentage}%`} detail={`Pass threshold ${passThreshold}%`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden rounded-xl border-border/90 bg-card shadow-none">
              <CardHeader className="border-b border-border/70 px-4 py-3.5 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-sm font-bold">Outcome overview</CardTitle>
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">Passed and failed attempts against the configured threshold</p>
                  </div>
                  <span className="rounded-full border border-border bg-ink-50 px-2 py-1 text-[9px] font-semibold text-ink-600">Threshold {passThreshold}%</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 py-4 sm:px-5">
                <div className="flex h-3 overflow-hidden rounded-full bg-rose-100" role="img" aria-label={`${data.passed} passed and ${data.failed} failed`}>
                  <div className="h-full bg-emerald-500" style={{ width: `${data.passRate}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Passed</p>
                    <p className="mt-1 font-display text-xl font-bold tabular-nums text-foreground">{data.passed}</p>
                  </div>
                  <div className="rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-3">
                    <p className="text-[10px] font-semibold text-rose-700">Failed</p>
                    <p className="mt-1 font-display text-xl font-bold tabular-nums text-foreground">{data.failed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-xl border-border/90 bg-card shadow-none">
              <CardHeader className="border-b border-border/70 px-4 py-3.5 sm:px-5">
                <CardTitle className="font-display text-sm font-bold">Score profile</CardTitle>
                <p className="mt-1 text-[10px] font-medium text-muted-foreground">Range and consistency across processed attempts</p>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 px-4 py-4 sm:grid-cols-4 sm:px-5">
                {[
                  ['Highest', `${data.highestPercentage ?? data.avgPercentage}%`],
                  ['Median', `${data.medianPercentage ?? data.avgPercentage}%`],
                  ['Lowest', `${data.lowestPercentage ?? data.avgPercentage}%`],
                  ['Score variation', `${data.scoreSpread ?? 0} pts`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border/70 bg-ink-50/55 px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-1 font-display text-base font-bold tabular-nums text-foreground">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
            <Card className="overflow-hidden rounded-xl border-border/90 bg-card shadow-none">
              <CardHeader className="border-b border-border/70 px-4 py-3.5 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-sm font-bold">Attempt activity</CardTitle>
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">Daily attempts and average score over the last 14 days</p>
                  </div>
                  {data.recent && <AnalyticsChangePill change={data.recent.attemptChangePercent} />}
                </div>
              </CardHeader>
              <CardContent className="px-4 py-4 sm:px-5">
                {trend.length > 0 ? (
                  <div>
                    <div className="flex h-44 items-end gap-1.5 border-b border-border/70 pb-2 sm:gap-2" role="img" aria-label="Assessment attempts for the last 14 days">
                      {trend.map(day => {
                        const height = day.attempts > 0 ? Math.max((day.attempts / maxAttempts) * 100, 5) : 2;
                        return (
                          <Tooltip key={day.date} content={`${shortDate(day.date)}: ${day.attempts} attempt${day.attempts === 1 ? '' : 's'}, ${day.averagePercentage}% average`} side="top" tone="dark" delay="short" className="h-full min-w-0 flex-1 items-end">
                            <span className="relative flex h-full w-full items-end px-px">
                              {day.attempts > 0 && <span className="absolute left-1/2 w-1.5 -translate-x-1/2 rounded-full border border-card bg-ink-600" style={{ bottom: `${Math.min(day.averagePercentage, 100)}%` }} />}
                              <span className={`block w-full rounded-t-sm ${day.attempts > 0 ? 'bg-primary/60 hover:bg-primary/80' : 'bg-ink-100'}`} style={{ height: `${height}%` }} />
                            </span>
                          </Tooltip>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex justify-between text-[9px] font-medium text-muted-foreground"><span>{shortDate(trend[0]?.date ?? null)}</span><span>{shortDate(trend[trend.length - 1]?.date ?? null)}</span></div>
                  </div>
                ) : <div className="flex h-44 items-center justify-center text-xs font-medium text-muted-foreground">Trend data is unavailable from the current server version.</div>}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-xl border-border/90 bg-card shadow-none">
              <CardHeader className="border-b border-border/70 px-4 py-3.5">
                <CardTitle className="font-display text-sm font-bold">Performance signals</CardTitle>
                <p className="mt-1 text-[10px] font-medium text-muted-foreground">Useful changes and question-level observations</p>
              </CardHeader>
              <CardContent className="space-y-3 px-4 py-4">
                {data.recent && (
                  <AnalyticsObservation icon={<Activity className="h-3.5 w-3.5" />} label="Recent average" value={`${data.recent.averageLast7Days}% · ${data.recent.scoreChange >= 0 ? '+' : ''}${data.recent.scoreChange} points`} />
                )}
                {strongestQuestion && <AnalyticsObservation icon={<TrendingUp className="h-3.5 w-3.5" />} label="Strongest question" value={`${strongestQuestion.label} · ${strongestQuestion.accuracy}%`} />}
                {toughestQuestion && <AnalyticsObservation icon={<TrendingDown className="h-3.5 w-3.5" />} label="Needs review" value={`${toughestQuestion.label} · ${toughestQuestion.accuracy}%`} />}
                {!data.recent && !strongestQuestion && <p className="py-5 text-center text-[11px] font-medium text-muted-foreground">No additional performance signals are available.</p>}
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden rounded-xl border-border/90 bg-card shadow-none">
            <CardHeader className="border-b border-border/70 px-4 py-3.5 sm:px-5">
              <CardTitle className="font-display text-sm font-bold">Score distribution</CardTitle>
              <p className="mt-1 text-[10px] font-medium text-muted-foreground">Where participant scores are concentrated</p>
            </CardHeader>
            <CardContent className="px-4 py-4 sm:px-5">
              <div className="grid grid-cols-6 items-end gap-2 sm:grid-cols-11">
                {data.distribution.map(bucket => {
                  const height = bucket.count > 0 ? Math.max((bucket.count / maxDistribution) * 100, 8) : 3;
                  return (
                    <Tooltip key={bucket.range} content={`${bucket.range}%: ${bucket.count} attempt${bucket.count === 1 ? '' : 's'}`} side="top" tone="dark" delay="short" className="min-w-0">
                      <span className="flex min-w-0 flex-col items-center gap-1.5">
                        <span className="flex h-24 w-full items-end rounded-md bg-ink-50 px-1.5 pt-1"><span className={`block w-full rounded-sm ${bucket.count > 0 ? 'bg-primary/65' : 'bg-ink-100'}`} style={{ height: `${height}%` }} /></span>
                        <span className="truncate text-[8px] font-medium text-muted-foreground">{bucket.range}</span>
                      </span>
                    </Tooltip>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {questions.length > 0 && (
            <section className="space-y-3" aria-labelledby="question-performance-title">
              <div>
                <h3 id="question-performance-title" className="font-display text-sm font-bold text-foreground">Question performance</h3>
                <p className="mt-1 text-[10px] font-medium text-muted-foreground">Accuracy and average points without exposing submitted or correct answers.</p>
              </div>
              <Card className="overflow-hidden rounded-xl border-border/90 bg-card shadow-none">
                <CardContent className="divide-y divide-border/60 p-0">
                  {questions.map((question, index) => (
                    <div key={question.fieldId} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.7fr)_auto] sm:items-center sm:px-5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">{index + 1}. {question.label}</p>
                        <p className="mt-0.5 text-[9px] font-medium text-muted-foreground">{question.correct} correct · {question.incorrect} incorrect · {question.averagePoints}/{question.maxPoints} avg points</p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-primary/65" style={{ width: `${question.accuracy}%` }} /></div>
                      <span className="text-right font-display text-sm font-bold tabular-nums text-foreground">{question.accuracy}%</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}

          {sections.length > 1 && (
            <section className="space-y-3" aria-labelledby="section-performance-title">
              <div>
                <h3 id="section-performance-title" className="font-display text-sm font-bold text-foreground">Section performance</h3>
                <p className="mt-1 text-[10px] font-medium text-muted-foreground">Average achievement across configured assessment sections.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {sections.map(section => (
                  <Card key={section.key} className="rounded-xl border-border/90 bg-card shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-semibold text-foreground">{section.label}</p><span className="font-display text-sm font-bold tabular-nums">{section.percentage}%</span></div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-primary/65" style={{ width: `${section.percentage}%` }} /></div>
                      <p className="mt-2 text-[9px] font-medium text-muted-foreground">{section.score} of {section.maxScore} total points earned</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function AnalyticsStat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <Card className="rounded-xl border-border/90 bg-card shadow-none">
      <CardContent className="p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-semibold text-muted-foreground">{label}</p><p className="mt-1.5 font-display text-xl font-bold tabular-nums text-foreground sm:text-2xl">{value}</p></div><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-ink-50 text-ink-600">{icon}</span></div>
        <p className="mt-2.5 truncate text-[9px] font-medium text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function AnalyticsChangePill({ change }: { change: number | null }) {
  const Icon = change === null || (change ?? 0) > 0 ? TrendingUp : (change ?? 0) < 0 ? TrendingDown : Minus;
  const label = change === null ? 'New activity' : change === 0 ? 'No change' : `${change > 0 ? '+' : ''}${change}%`;
  return <span className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-ink-50 px-2 py-1 text-[9px] font-semibold text-ink-600"><Icon className="h-3 w-3" />{label}</span>;
}

function AnalyticsObservation({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-500">{icon}</span>
      <div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-0.5 truncate text-[11px] font-semibold text-foreground" title={value}>{value}</p></div>
    </div>
  );
}

// ── Assessment Leaderboard Tab ───────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  submissionId: string;
  submittedAt: string;
  result: AssessmentResult;
}

interface LeaderboardSummary {
  topScore: number;
  topPercentage: number;
  averagePercentage: number;
  passRate: number;
}

const LEADERBOARD_PAGE_SIZE = 10;

function LeaderboardTab({ formId }: { formId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [summary, setSummary] = useState<LeaderboardSummary | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await api.get(`/processing/forms/${formId}/leaderboard`);
      const leaderboard = (response.data.leaderboard ?? []) as LeaderboardEntry[];
      setEntries(leaderboard);
      setSummary(response.data.summary ?? null);
      setPage(1);
    } catch {
      setLoadError('The leaderboard could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => { void load(); }, [load]);

  if (loading && entries.length === 0) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  if (loadError && entries.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-xs font-semibold text-destructive">{loadError}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} className="mt-4">Try again</Button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center px-4 text-center">
        <div>
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-ink-50 text-ink-400">
            <Trophy className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <h2 className="mt-3 font-display text-sm font-bold text-foreground">No ranked results yet</h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground">Completed assessment submissions will appear here.</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(entries.length / LEADERBOARD_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleEntries = entries.slice((safePage - 1) * LEADERBOARD_PAGE_SIZE, safePage * LEADERBOARD_PAGE_SIZE);
  const derivedSummary: LeaderboardSummary = summary ?? {
    topScore: entries[0]?.result.totalScore ?? 0,
    topPercentage: entries[0]?.result.percentage ?? 0,
    averagePercentage: Math.round(entries.reduce((sum, entry) => sum + entry.result.percentage, 0) / entries.length),
    passRate: Math.round((entries.filter((entry) => entry.result.passed).length / entries.length) * 100),
  };

  const columns: DataTableColumn<LeaderboardEntry>[] = [
    {
      id: 'rank',
      header: 'Rank',
      headerClassName: 'w-20',
      cellClassName: 'w-20',
      cell: (entry) => (
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg border text-[11px] font-bold tabular-nums ${
          entry.rank === 1
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : entry.rank === 2
              ? 'border-ink-200 bg-ink-50 text-ink-600'
              : entry.rank === 3
                ? 'border-orange-200 bg-orange-50/70 text-orange-800'
                : 'border-border bg-card text-muted-foreground'
        }`}>
          {entry.rank}
        </span>
      ),
    },
    {
      id: 'submission',
      header: 'Submission',
      headerClassName: 'min-w-44',
      cellClassName: 'min-w-44',
      cell: (entry) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate font-mono text-[10px] font-semibold text-ink-700">{entry.submissionId}</span>
          <Tooltip content="Copy submission ID" side="top" tone="light">
            <button type="button" onClick={() => void navigator.clipboard.writeText(entry.submissionId)} aria-label="Copy submission ID" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
              <Copy className="h-3 w-3" />
            </button>
          </Tooltip>
        </div>
      ),
    },
    {
      id: 'score',
      header: 'Score',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      cell: (entry) => (
        <div>
          <p className="font-display text-[13px] font-bold tabular-nums text-foreground">{entry.result.percentage}%</p>
          <p className="mt-0.5 text-[9px] font-medium tabular-nums text-muted-foreground sm:hidden">{entry.result.totalScore}/{entry.result.maxScore} pts</p>
        </div>
      ),
    },
    {
      id: 'points',
      header: 'Points',
      headerClassName: 'hidden text-right sm:table-cell',
      cellClassName: 'hidden whitespace-nowrap text-right sm:table-cell',
      cell: (entry) => <span className="text-[11px] font-semibold tabular-nums text-ink-700">{entry.result.totalScore} / {entry.result.maxScore}</span>,
    },
    {
      id: 'result',
      header: 'Result',
      cell: (entry) => (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider ${entry.result.passed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {entry.result.passed ? 'Pass' : 'Fail'}
        </span>
      ),
    },
    {
      id: 'submitted',
      header: 'Submitted',
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden whitespace-nowrap lg:table-cell',
      cell: (entry) => <span className="text-[10px] font-medium text-muted-foreground">{formatDate(entry.submittedAt)}</span>,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-foreground">Assessment leaderboard</h2>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">Ranked by total score, with equal scores sharing the same rank.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="h-8 self-start rounded-lg text-[11px]">
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <LeaderboardStat icon={<UsersRound className="h-4 w-4" />} label="Participants" value={entries.length.toLocaleString()} detail="Ranked attempts" />
        <LeaderboardStat icon={<Award className="h-4 w-4" />} label="Highest score" value={`${derivedSummary.topPercentage}%`} detail={`${derivedSummary.topScore} points`} />
        <LeaderboardStat icon={<Target className="h-4 w-4" />} label="Average score" value={`${derivedSummary.averagePercentage}%`} detail="Across all attempts" />
        <LeaderboardStat icon={<Percent className="h-4 w-4" />} label="Pass rate" value={`${derivedSummary.passRate}%`} detail={`${entries.filter((entry) => entry.result.passed).length} passed`} />
      </div>

      <section className="space-y-3" aria-labelledby="rankings-title">
        <div>
          <h3 id="rankings-title" className="font-display text-sm font-bold text-foreground">Rankings</h3>
          <p className="mt-1 text-[10px] font-medium text-muted-foreground">Submission identifiers are shown instead of respondent identity.</p>
        </div>
        <DataTable data={visibleEntries} columns={columns} getRowId={(entry) => entry.submissionId} ariaLabel="Assessment rankings" />
        <Pagination page={safePage} totalPages={totalPages} totalItems={entries.length} itemLabel="participants" onPageChange={setPage} />
      </section>
    </div>
  );
}

function LeaderboardStat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <Card className="rounded-xl border-border/90 bg-card shadow-none">
      <CardContent className="p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
            <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-foreground sm:text-2xl">{value}</p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-ink-50 text-ink-600">{icon}</span>
        </div>
        <p className="mt-2.5 truncate text-[9px] font-medium text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

// ── Poll Results Tab ─────────────────────────────────────────────────────────

function PollResultsTab({ formId }: { formId: string }) {
  const [data, setData] = useState<VotingResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/processing/forms/${formId}/poll-results`);
      setData(res.data);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data || data.totalSubmissions === 0) return <div className="text-center py-16 text-muted-foreground"><BarChart2 className="h-12 w-12 mx-auto mb-3" /><p>No votes yet.</p></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Poll Results</h2>
          <p className="text-sm text-muted-foreground">{data.totalSubmissions} vote{data.totalSubmissions !== 1 ? 's' : ''} · Last updated {formatDate(data.lastUpdated)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
      </div>

      {data.tallies.map(tally => {
        const winner = tally.options.reduce((a, b) => a.count >= b.count ? a : b, tally.options[0]);
        return (
          <Card key={tally.fieldId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{tally.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{tally.totalVotes} response{tally.totalVotes !== 1 ? 's' : ''}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {tally.options.map(opt => (
                <div key={opt.value} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className={opt.value === winner.value && opt.count > 0 ? 'font-semibold' : ''}>{opt.label}</span>
                    <span className="text-muted-foreground">{opt.percentage}% <span className="text-xs">({opt.count})</span></span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${opt.value === winner.value && opt.count > 0 ? 'bg-primary' : 'bg-primary/40'}`}
                      style={{ width: `${opt.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Audit Log Tab ────────────────────────────────────────────────────────────

interface AuditEntry { id: string; submissionId: string; identifier: string; createdAt: string; }

function AuditLogTab({ formId }: { formId: string }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/processing/forms/${formId}/audit-log`);
      setLogs(res.data.logs ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (logs.length === 0) return <div className="text-center py-16 text-muted-foreground"><ShieldCheck className="h-12 w-12 mx-auto mb-3" /><p>No audit entries yet.</p></div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Audit Log</h2>
          <p className="text-sm text-muted-foreground">{total} vote record{total !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
      </div>
      <div className="divide-y border rounded-lg overflow-hidden">
        {logs.map(entry => (
          <div key={entry.id} className="flex items-center gap-4 px-4 py-3 bg-card text-sm">
            <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs text-muted-foreground truncate">{entry.identifier}</p>
            </div>
            <p className="text-xs text-muted-foreground shrink-0">{formatDate(entry.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SubmissionsPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { submissions, pagination, isLoading, error } = useAppSelector((state) => state.submissions);
  const { currentForm } = useAppSelector((state) => state.forms);
  const access = useAppSelector((state) => (formId ? state.formSharing.access[formId] : undefined));
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('submissions');

  const formType = currentForm?.settings?.formType;

  useEffect(() => {
    if (formId) {
      dispatch(fetchForm(formId));
      dispatch(fetchFormAccess(formId));
      // A 403 here means this person may see aggregate results but not rows.
      dispatch(fetchSubmissions({ formId }));
    }
  }, [formId, dispatch]);

  const handleExport = async (format: 'csv' | 'json') => {
    if (!formId) return;
    try {
      const result = await dispatch(exportSubmissions({ formId, format })).unwrap();
      const blob = format === 'csv'
        ? new Blob([result.data], { type: 'text/csv' })
        : new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${currentForm?.name || 'submissions'}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      // Existing export errors remain handled by the submissions store.
    }
  };

  const handleDelete = async (submissionId: string) => {
    if (!formId) return;
    await dispatch(deleteSubmission({ formId, submissionId }));
    setDeleteConfirm(null);
    if (selectedSubmission === submissionId) setSelectedSubmission(null);
  };

  const handlePageChange = (page: number) => {
    if (formId) {
      setSelectedSubmission(null);
      dispatch(fetchSubmissions({ formId, page }));
    }
  };

  const filteredSubmissions = submissions.filter((submission) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return Object.entries(submission.data).some(([fieldId, value]) => {
      const label = currentForm?.schema.fields.find((field) => field.id === fieldId)?.label || fieldId;
      return label.toLowerCase().includes(query) || formatValue(value).toLowerCase().includes(query);
    });
  });

  const selectedSub = submissions.find((submission) => submission.id === selectedSubmission);

  if (isLoading && submissions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-workspace">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-xs font-medium text-muted-foreground">Loading submissions…</p>
        </div>
      </div>
    );
  }

  const canSeeAggregate = !!access && access.level !== 'NONE';
  const canSeeRows = !!access && access.level !== 'NONE' && access.level !== 'AGGREGATE';
  const canDeleteRows = access?.canDeleteResponses === true;
  const aggregateOnly = !!access && access.level === 'AGGREGATE';
  const currentTab = !canSeeRows && activeTab === 'submissions' ? 'results' : activeTab;

  const policyNotice =
    access?.policy === 'ANONYMOUS'
      ? 'This form is anonymous. Individual responses are not viewable by anyone, including you — only the totals below.'
      : access?.policy === 'BLIND_REVIEW'
        ? 'Blind review: responses are readable, but identifying fields are hidden from everyone.'
        : aggregateOnly
          ? 'Your role gives you aggregate results for this form, not individual responses.'
          : undefined;

  const tabs = [
    ...(canSeeRows
      ? [{ id: 'submissions', label: 'Submissions', icon: <Eye className="h-3.5 w-3.5" /> }]
      : []),
    { id: 'results', label: 'Results', icon: <BarChart2 className="h-3.5 w-3.5" /> },
    ...(formType === 'assessment' && canSeeAggregate ? [
      ...(canSeeRows
        ? [{ id: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="h-3.5 w-3.5" /> }]
        : []),
      { id: 'analytics', label: 'Analytics', icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
    ] : []),
    ...(formType === 'voting' ? [
      { id: 'poll-results', label: 'Poll results', icon: <BarChart2 className="h-3.5 w-3.5" /> },
      { id: 'audit-log', label: 'Audit log', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
    ] : []),
  ];

  const responseNumber = (submissionId: string) => {
    const index = submissions.findIndex((submission) => submission.id === submissionId);
    const offset = (pagination.page - 1) * pagination.limit + Math.max(index, 0);
    return Math.max(pagination.total - offset, 1);
  };

  const previewField = (fieldId: string) =>
    currentForm?.schema.fields.find((field) => field.id === fieldId);

  const previewLabel = (fieldId: string) => previewField(fieldId)?.label || 'Answer';

  const previewValue = (fieldId: string, value: unknown) => {
    const field = previewField(fieldId);
    if (field?.options) {
      const labelFor = (item: unknown) => field.options?.find((option) => option.value === String(item))?.label ?? String(item);
      return Array.isArray(value) ? value.map(labelFor).join(', ') : labelFor(value);
    }
    return formatValue(value);
  };

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-workspace">
      <header className="z-20 shrink-0 border-b border-border/80 bg-card">
        <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-3 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Tooltip content="Back to forms" side="bottom" tone="dark" delay="short">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => navigate('/forms')}
                aria-label="Back to forms"
                className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Tooltip>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/[0.055] text-primary">
              <FileText className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate font-display text-sm font-bold text-foreground sm:text-[15px]">
                  {currentForm?.name || 'Form submissions'}
                </h1>
                {formType && (
                  <Badge variant="outline" className="hidden shrink-0 border-border bg-ink-50 text-muted-foreground capitalize sm:inline-flex">
                    {formType}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                {pagination.total} submission{pagination.total === 1 ? '' : 's'} · Responses and insights
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {access && (
              <Tooltip content={`Response access: ${RESPONSE_LEVEL_LABEL[access.level]}`} side="bottom" tone="light">
                <span className="hidden h-8 items-center gap-1.5 rounded-lg border border-border bg-ink-50 px-2.5 text-[10px] font-semibold text-ink-600 lg:inline-flex">
                  {access.level === 'FULL' || access.level === 'EXPORT'
                    ? <Eye className="h-3.5 w-3.5" />
                    : <EyeOff className="h-3.5 w-3.5" />}
                  {RESPONSE_LEVEL_LABEL[access.level]}
                  {access.policy !== 'STANDARD' && <Lock className="h-3 w-3" />}
                </span>
              </Tooltip>
            )}
            {access?.level === 'EXPORT' && (
              <>
                <Tooltip content="Export responses as CSV" side="bottom" tone="dark">
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleExport('csv')} className="h-8 rounded-lg px-2 sm:px-2.5">
                    <Download className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">CSV</span>
                  </Button>
                </Tooltip>
                <Tooltip content="Export responses as JSON" side="bottom" tone="dark">
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleExport('json')} className="h-8 rounded-lg px-2 sm:px-2.5">
                    <Download className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">JSON</span>
                  </Button>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        {tabs.length > 1 && (
          <nav className="scrollbar-compact flex gap-1 overflow-x-auto border-t border-border/60 px-3 py-2 sm:px-5 lg:px-6" aria-label="Submission views">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={currentTab === tab.id ? 'page' : undefined}
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold transition-colors ${
                  currentTab === tab.id
                    ? 'border-primary/15 bg-primary/[0.065] text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:bg-ink-50 hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {currentTab === 'results' && formId && (
          <div className="scrollbar-subtle h-full overflow-y-auto p-4 sm:p-5 lg:p-6">
            <AggregateResults formId={formId} notice={policyNotice} />
          </div>
        )}
        {currentTab === 'leaderboard' && formId && <div className="scrollbar-subtle h-full overflow-y-auto"><LeaderboardTab formId={formId} /></div>}
        {currentTab === 'analytics' && formId && <div className="scrollbar-subtle h-full overflow-y-auto"><AssessmentAnalyticsTab formId={formId} /></div>}
        {currentTab === 'poll-results' && formId && <div className="scrollbar-subtle h-full overflow-y-auto"><PollResultsTab formId={formId} /></div>}
        {currentTab === 'audit-log' && formId && <div className="scrollbar-subtle h-full overflow-y-auto"><AuditLogTab formId={formId} /></div>}

        {currentTab === 'submissions' && canSeeRows && (
          <div className="grid h-full min-h-0 gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(19rem,0.78fr)_minmax(0,1.22fr)] lg:p-5 xl:grid-cols-[minmax(22rem,0.7fr)_minmax(0,1.3fr)]">
            <section className={`${selectedSub ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col overflow-hidden rounded-xl border border-border/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.025)]`} aria-label="Submission list">
              <div className="shrink-0 border-b border-border/70 px-3.5 py-3">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xs font-bold text-foreground">Submissions</h2>
                    <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                      {searchQuery ? `${filteredSubmissions.length} matches on this page` : `${pagination.total} total responses`}
                    </p>
                  </div>
                  <span className="rounded-full border border-border bg-ink-50 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
                    Page {pagination.page}
                  </span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    aria-label="Search submissions on this page"
                    placeholder="Search responses…"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-9 rounded-lg border-ink-200 bg-ink-50/60 pl-9 pr-9 text-[11px] focus-visible:border-ink-400 focus-visible:ring-4 focus-visible:ring-primary/[0.06] focus-visible:ring-offset-0"
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear submission search" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto p-2">
                {error ? (
                  <div className="m-2 rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3 py-4 text-center text-xs font-medium text-destructive">{error}</div>
                ) : filteredSubmissions.length === 0 ? (
                  <div className="flex h-full min-h-48 items-center justify-center px-5 text-center">
                    <div>
                      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-ink-50 text-ink-400">
                        <Inbox className="h-4 w-4" strokeWidth={1.7} />
                      </span>
                      <p className="mt-3 text-xs font-semibold text-foreground">{searchQuery ? 'No matching responses' : 'No submissions yet'}</p>
                      <p className="mt-1 text-[10px] font-medium text-muted-foreground">{searchQuery ? 'Try another search term.' : 'New responses will appear here.'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredSubmissions.map((submission) => {
                      const previewEntries = Object.entries(submission.data).slice(0, 2);
                      const number = responseNumber(submission.id);
                      const isSelected = selectedSubmission === submission.id;
                      return (
                        <div
                          key={submission.id}
                          className={`group flex items-start gap-1 rounded-lg border p-1 transition-colors ${
                            isSelected
                              ? 'border-primary/15 bg-primary/[0.045]'
                              : 'border-transparent hover:border-border hover:bg-ink-50/75'
                          }`}
                        >
                          <button type="button" onClick={() => setSelectedSubmission(submission.id)} className="min-w-0 flex-1 rounded-md px-2 py-2 text-left">
                            <div className="flex min-w-0 items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="text-[11px] font-semibold text-foreground">Response #{number}</span>
                                {!submission.isRead && <span className="rounded-full border border-primary/10 bg-primary/[0.07] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">New</span>}
                              </span>
                              {submission.processingStatus === 'done' && (
                                <span className="flex shrink-0 items-center gap-1 text-[9px] font-medium text-muted-foreground">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Processed
                                </span>
                              )}
                            </div>
                            <div className="mt-2 space-y-1">
                              {previewEntries.map(([fieldId, value]) => (
                                <p key={fieldId} className="truncate text-[10px] font-medium text-muted-foreground">
                                  <span className="text-ink-600">{previewLabel(fieldId)}:</span> {previewValue(fieldId, value)}
                                </p>
                              ))}
                            </div>
                            <p className="mt-2 flex items-center gap-1 text-[9px] font-medium text-muted-foreground">
                              <CalendarDays className="h-3 w-3" /> {formatDate(submission.createdAt)}
                            </p>
                          </button>
                          {canDeleteRows && (
                            <Tooltip content="Delete submission" side="left" tone="dark">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete response ${number}`}
                                onClick={() => setDeleteConfirm(submission.id)}
                                className="h-8 w-8 shrink-0 rounded-md text-muted-foreground opacity-70 hover:bg-destructive/[0.06] hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </Tooltip>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {pagination.totalPages > 1 && (
                <div className="shrink-0 border-t border-border/70 px-3 pb-3">
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    totalItems={pagination.total}
                    itemLabel="submissions"
                    onPageChange={handlePageChange}
                    className="pt-3"
                  />
                </div>
              )}
            </section>

            <section className={`${selectedSub ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col overflow-hidden rounded-xl border border-border/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.025)]`} aria-label="Submission details">
              {selectedSub ? (
                <>
                  <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="font-display text-sm font-bold text-foreground">Response #{responseNumber(selectedSub.id)}</h2>
                        {!selectedSub.isRead && <Badge variant="outline" className="border-primary/10 bg-primary/[0.06] text-primary">New</Badge>}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                        <CalendarDays className="h-3 w-3" /> {formatDate(selectedSub.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {canDeleteRows && (
                        <Tooltip content="Delete submission" side="bottom" tone="dark">
                          <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteConfirm(selectedSub.id)} aria-label="Delete submission" className="h-8 w-8 rounded-md text-muted-foreground hover:bg-destructive/[0.06] hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip content="Copy submission ID" side="bottom" tone="light">
                        <Button type="button" variant="ghost" size="icon" onClick={() => void navigator.clipboard.writeText(selectedSub.id)} aria-label="Copy submission ID" className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Back to submission list" side="bottom" tone="dark">
                        <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedSubmission(null)} aria-label="Close submission details" className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                          <ArrowLeft className="h-4 w-4 lg:hidden" />
                          <X className="hidden h-4 w-4 lg:block" />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                    <div className="mx-auto max-w-4xl space-y-5">
                      <section>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="font-display text-xs font-bold text-foreground">Submitted answers</h3>
                          <span className="text-[9px] font-medium text-muted-foreground">{Object.keys(selectedSub.data).length} answered field{Object.keys(selectedSub.data).length === 1 ? '' : 's'}</span>
                        </div>
                        <SubmissionViewer
                          fields={currentForm?.schema.fields || []}
                          data={selectedSub.data}
                          redactedFields={selectedSub.redactedFields}
                        />
                      </section>

                      <section className="border-t border-border/70 pt-4">
                        <h3 className="mb-3 font-display text-xs font-bold text-foreground">Submission metadata</h3>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <MetadataItem icon={<Hash className="h-3.5 w-3.5" />} label="Submission ID" value={selectedSub.id} mono />
                          <MetadataItem icon={<CalendarDays className="h-3.5 w-3.5" />} label="Submitted" value={formatDate(selectedSub.createdAt)} />
                          <MetadataItem icon={<Globe2 className="h-3.5 w-3.5" />} label="IP address" value={selectedSub.ip || 'Not recorded'} />
                          <MetadataItem
                            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                            label="Processing"
                            value={selectedSub.processingStatus
                              ? selectedSub.processingStatus.charAt(0).toUpperCase() + selectedSub.processingStatus.slice(1)
                              : 'Not available'}
                          />
                          {selectedSub.userAgent && (
                            <div className="rounded-lg border border-border/70 bg-ink-50/55 px-3 py-2.5 sm:col-span-2">
                              <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"><Monitor className="h-3.5 w-3.5" /> Browser</p>
                              <p className="mt-1 break-words text-[10px] font-medium leading-4 text-ink-700">{selectedSub.userAgent}</p>
                            </div>
                          )}
                          {selectedSub.tags.length > 0 && (
                            <div className="rounded-lg border border-border/70 bg-ink-50/55 px-3 py-2.5 sm:col-span-2">
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Tags</p>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {selectedSub.tags.map((tag) => <span key={tag} className="rounded-full border border-border bg-card px-2 py-0.5 text-[9px] font-semibold text-ink-600">{tag}</span>)}
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <div>
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-ink-50 text-ink-400">
                      <Eye className="h-5 w-5" strokeWidth={1.6} />
                    </span>
                    <p className="mt-3 text-xs font-semibold text-foreground">Select a submission</p>
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">Choose a response from the list to review its answers.</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {deleteConfirm && canDeleteRows && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
          <button type="button" aria-label="Cancel deletion" className="absolute inset-0 bg-ink-950/35 backdrop-blur-[1px]" onClick={() => setDeleteConfirm(null)} />
          <Card role="dialog" aria-modal="true" aria-labelledby="delete-submission-title" className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border-border bg-card shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
            <CardHeader className="border-b border-border/70 px-5 py-4">
              <CardTitle id="delete-submission-title" className="font-display text-base font-bold">Delete submission?</CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-4">
              <p className="text-xs font-medium leading-5 text-muted-foreground">This response and its processed result will be permanently removed. This action cannot be undone.</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button type="button" variant="destructive" onClick={() => void handleDelete(deleteConfirm)}>Delete submission</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function MetadataItem({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-ink-50/55 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{icon}{label}</p>
      <p className={`mt-1 truncate text-[10px] font-semibold text-ink-700 ${mono ? 'font-mono' : ''}`} title={value}>{value}</p>
    </div>
  );
}
