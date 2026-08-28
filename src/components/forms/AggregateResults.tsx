import { useEffect } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Gauge,
  Loader2,
  MessageSquareText,
  Minus,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { fetchAggregate } from '../../store/formSharingSlice';
import type { FieldSummary } from '../../types';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tooltip } from '../ui/tooltip';

interface Props {
  formId: string;
  /** Shown above the results, e.g. why individual responses are unavailable. */
  notice?: string;
}

function shortDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fieldRate(field: FieldSummary, total: number) {
  return field.responseRate ?? (total > 0 ? Math.round((field.answered / total) * 100) : 0);
}

/** Aggregate-only results: useful insight without exposing an individual response. */
export default function AggregateResults({ formId, notice }: Props) {
  const dispatch = useAppDispatch();
  const summary = useAppSelector((state) => state.formSharing.aggregate[formId]);
  const isLoading = useAppSelector((state) => state.formSharing.isLoading);
  const error = useAppSelector((state) => state.formSharing.error);

  useEffect(() => {
    dispatch(fetchAggregate(formId));
  }, [dispatch, formId]);

  if (isLoading && !summary) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
          <p className="mt-2 text-xs font-medium text-muted-foreground">Preparing results…</p>
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return <div className="rounded-lg border border-destructive/20 bg-destructive/[0.05] p-3 text-xs font-medium text-destructive">{error}</div>;
  }

  if (!summary) return null;

  const trendSeries = summary.trend?.series ?? [];
  const recentResponses = summary.insights?.responsesLast7Days
    ?? trendSeries.slice(-7).reduce((sum, point) => sum + point.count, 0);
  const previousResponses = summary.insights?.responsesPrevious7Days
    ?? trendSeries.slice(-14, -7).reduce((sum, point) => sum + point.count, 0);
  const changePercent = summary.insights?.changePercent
    ?? (previousResponses > 0 ? Math.round(((recentResponses - previousResponses) / previousResponses) * 100) : recentResponses > 0 ? null : 0);
  const averageAnswerRate = summary.insights?.averageAnswerRate
    ?? (summary.fields.length > 0
      ? Math.round(summary.fields.reduce((sum, field) => sum + fieldRate(field, summary.total), 0) / summary.fields.length)
      : 0);
  const activeDays = summary.insights?.activeDays ?? trendSeries.filter((point) => point.count > 0).length;
  const maxTrend = Math.max(...trendSeries.map((point) => point.count), 1);

  const rankedByParticipation = [...summary.fields].sort(
    (a, b) => fieldRate(b, summary.total) - fieldRate(a, summary.total)
  );
  const strongestField = rankedByParticipation[0];
  const lowestField = rankedByParticipation[rankedByParticipation.length - 1];
  const leadingChoice = summary.fields
    .flatMap((field) => Object.entries(field.counts ?? {}).map(([option, count]) => ({ field, option, count })))
    .sort((a, b) => b.count - a.count)[0];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-foreground">Results overview</h2>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">
            Response activity, participation, and question-level distributions.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => dispatch(fetchAggregate(formId))} disabled={isLoading} className="h-8 self-start rounded-lg text-[11px]">
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh results
        </Button>
      </div>

      {notice && (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/10 bg-primary/[0.035] px-3.5 py-3 text-[11px] font-medium leading-5 text-ink-700">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{notice}</span>
        </div>
      )}

      {summary.total === 0 ? (
        <Card className="rounded-xl border-dashed border-border bg-card shadow-none">
          <CardContent className="py-16 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-ink-50 text-ink-400">
              <BarChart3 className="h-5 w-5" strokeWidth={1.7} />
            </span>
            <h3 className="mt-3 font-display text-sm font-bold text-foreground">No results yet</h3>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Insights will appear after this form receives responses.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <InsightStat
              icon={<MessageSquareText className="h-4 w-4" />}
              label="Total responses"
              value={summary.total.toLocaleString()}
              detail={`First received ${shortDate(summary.firstResponseAt)}`}
            />
            <InsightStat
              icon={<Activity className="h-4 w-4" />}
              label="Last 7 days"
              value={recentResponses.toLocaleString()}
              detail={<ChangeLabel change={changePercent} previous={previousResponses} />}
            />
            <InsightStat
              icon={<Gauge className="h-4 w-4" />}
              label="Average answer rate"
              value={summary.fields.length > 0 ? `${averageAnswerRate}%` : '—'}
              detail={summary.fields.length > 0 ? `Across ${summary.fields.length} measurable field${summary.fields.length === 1 ? '' : 's'}` : 'No safely measurable fields'}
            />
            <InsightStat
              icon={<CalendarDays className="h-4 w-4" />}
              label="Active days"
              value={`${activeDays}/${summary.trend?.rangeDays ?? 14}`}
              detail={`Latest response ${shortDate(summary.lastResponseAt)}`}
            />
          </div>

          {summary.suppressed ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <h3 className="text-xs font-semibold text-amber-900">Detailed insight is temporarily protected</h3>
                  <p className="mt-1 text-[11px] font-medium leading-5 text-amber-800">
                    This form has {summary.total} response{summary.total === 1 ? '' : 's'}. Trends and question breakdowns appear at {summary.minimumForBreakdown} responses so individual answers cannot be inferred from a small group.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
                <Card className="overflow-hidden rounded-xl border-border/90 bg-card shadow-none">
                  <CardHeader className="border-b border-border/70 px-4 py-3.5 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="font-display text-sm font-bold">Response activity</CardTitle>
                        <p className="mt-1 text-[10px] font-medium text-muted-foreground">Daily submissions over the last {summary.trend?.rangeDays ?? 14} days</p>
                      </div>
                      <ChangePill change={changePercent} />
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 py-4 sm:px-5">
                    {trendSeries.length > 0 ? (
                      <div>
                        <div
                          className="flex h-44 items-end gap-1.5 border-b border-border/70 px-1 pb-2 sm:gap-2"
                          role="img"
                          aria-label={`Daily response counts for the last ${summary.trend?.rangeDays ?? 14} days`}
                        >
                          {trendSeries.map((point) => {
                            const height = point.count > 0 ? Math.max((point.count / maxTrend) * 100, 5) : 2;
                            return (
                              <Tooltip
                                key={point.date}
                                content={`${new Date(`${point.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}: ${point.count} response${point.count === 1 ? '' : 's'}`}
                                side="top"
                                tone="dark"
                                delay="short"
                                className="h-full min-w-0 flex-1 items-end"
                              >
                                <span className="flex h-full w-full items-end rounded-sm px-px">
                                  <span className={`block w-full rounded-t-sm ${point.count > 0 ? 'bg-primary/65 hover:bg-primary/80' : 'bg-ink-100'}`} style={{ height: `${height}%` }} />
                                </span>
                              </Tooltip>
                            );
                          })}
                        </div>
                        <div className="mt-2 flex justify-between text-[9px] font-medium text-muted-foreground">
                          <span>{shortDate(trendSeries[0]?.date ?? null)}</span>
                          <span>{shortDate(trendSeries[trendSeries.length - 1]?.date ?? null)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-44 items-center justify-center text-xs font-medium text-muted-foreground">Trend data is unavailable from the current server version.</div>
                    )}
                  </CardContent>
                </Card>

                <Card className="overflow-hidden rounded-xl border-border/90 bg-card shadow-none">
                  <CardHeader className="border-b border-border/70 px-4 py-3.5">
                    <CardTitle className="font-display text-sm font-bold">Key observations</CardTitle>
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">Automatically derived from aggregate results</p>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 py-4">
                    {strongestField && (
                      <Observation icon={<TrendingUp className="h-3.5 w-3.5" />} label="Highest participation" value={`${strongestField.label} · ${fieldRate(strongestField, summary.total)}%`} />
                    )}
                    {lowestField && (
                      <Observation icon={<TrendingDown className="h-3.5 w-3.5" />} label="Most often skipped" value={`${lowestField.label} · ${lowestField.skipped ?? summary.total - lowestField.answered} skipped`} />
                    )}
                    {leadingChoice && (
                      <Observation icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Most selected answer" value={`${leadingChoice.option} · ${leadingChoice.count}`} />
                    )}
                    {!strongestField && !leadingChoice && (
                      <p className="py-5 text-center text-[11px] font-medium text-muted-foreground">No measurable question insight is available.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <section className="space-y-3" aria-labelledby="question-results-title">
                <div>
                  <h3 id="question-results-title" className="font-display text-sm font-bold text-foreground">Question results</h3>
                  <p className="mt-1 text-[10px] font-medium text-muted-foreground">Participation and distributions for fields that can be summarized safely.</p>
                </div>
                <div className="grid items-start gap-4 xl:grid-cols-2">
                  {summary.fields.map((field) => (
                    <QuestionResult key={field.key} field={field} total={summary.total} />
                  ))}
                </div>
                {summary.fields.length === 0 && (
                  <Card className="rounded-xl border-dashed border-border bg-card shadow-none">
                    <CardContent className="py-10 text-center">
                      <ShieldCheck className="mx-auto h-6 w-6 text-ink-300" />
                      <p className="mt-2 text-xs font-medium text-muted-foreground">No questions can be summarized without exposing identifying or free-text content.</p>
                    </CardContent>
                  </Card>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function InsightStat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: React.ReactNode }) {
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
        <div className="mt-2.5 truncate text-[9px] font-medium text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function ChangeLabel({ change, previous }: { change: number | null; previous: number }) {
  if (change === null) return <span>New activity · no responses in the previous week</span>;
  if (change === 0) return <span>Unchanged from the previous 7 days</span>;
  return <span>{change > 0 ? '+' : ''}{change}% versus the previous 7 days ({previous})</span>;
}

function ChangePill({ change }: { change: number | null }) {
  const Icon = change === null || (change ?? 0) > 0 ? TrendingUp : (change ?? 0) < 0 ? TrendingDown : Minus;
  const label = change === null ? 'New activity' : change === 0 ? 'No change' : `${change > 0 ? '+' : ''}${change}%`;
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-ink-50 px-2 py-1 text-[9px] font-semibold text-ink-600">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function Observation({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-500">{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-[11px] font-semibold text-foreground" title={value}>{value}</p>
      </div>
    </div>
  );
}

function QuestionResult({ field, total }: { field: FieldSummary; total: number }) {
  const rate = fieldRate(field, total);
  const counts = Object.entries(field.counts ?? {}).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...counts.map(([, count]) => count), 1);

  return (
    <Card className="overflow-hidden rounded-xl border-border/90 bg-card shadow-none">
      <CardHeader className="border-b border-border/70 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate font-display text-[13px] font-bold" title={field.label}>{field.label}</CardTitle>
            <p className="mt-1 text-[10px] font-medium text-muted-foreground">{field.answered} answered · {field.skipped ?? total - field.answered} skipped</p>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-ink-50 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{field.type}</span>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[9px] font-medium text-muted-foreground"><span>Answer rate</span><span>{rate}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-primary/65" style={{ width: `${rate}%` }} /></div>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-4">
        {counts.length > 0 ? (
          <div className="space-y-3">
            {counts.map(([option, count], index) => {
              const percentage = field.answered > 0 ? Math.round((count / field.answered) * 100) : 0;
              return (
                <div key={option} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-[11px]">
                    <span className="min-w-0 truncate font-medium text-foreground" title={option}>{option}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{count} · {percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                    <div className={`h-full rounded-full ${index === 0 ? 'bg-primary/70' : 'bg-ink-300'}`} style={{ width: `${Math.max((count / maxCount) * 100, count > 0 ? 3 : 0)}%` }} />
                  </div>
                </div>
              );
            })}
            {field.stats && (
              <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
                <div className="rounded-lg bg-ink-50/70 px-3 py-2">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Average</p>
                  <p className="mt-0.5 font-display text-sm font-bold tabular-nums text-foreground">{field.stats.mean}</p>
                </div>
                <div className="rounded-lg bg-ink-50/70 px-3 py-2">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Median</p>
                  <p className="mt-0.5 font-display text-sm font-bold tabular-nums text-foreground">{field.stats.median ?? field.stats.mean}</p>
                </div>
              </div>
            )}
          </div>
        ) : field.stats ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Average', field.stats.mean],
              ['Median', field.stats.median ?? field.stats.mean],
              ['Minimum', field.stats.min],
              ['Maximum', field.stats.max],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border/70 bg-ink-50/55 px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="mt-1 font-display text-base font-bold tabular-nums text-foreground">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-ink-50/70 px-3 py-2.5 text-[10px] font-medium leading-4 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Free-text values are not displayed in aggregate results. The answer rate is shown without exposing response content.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
