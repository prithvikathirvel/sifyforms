import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { fetchAggregate } from '../../store/formSharingSlice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Loader2, ShieldCheck, BarChart3 } from 'lucide-react';

/**
 * Results without responses.
 *
 * What someone sees when they may know the outcome but not who said what: an
 * anonymous survey's organizer, or a Creator who built the form. Every number
 * here is computed on the server, so no individual response reaches the browser.
 */

interface Props {
  formId: string;
  /** Shown above the chart, e.g. why individual responses are unavailable. */
  notice?: string;
}

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
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !summary) {
    return <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>;
  }

  if (!summary) return null;

  return (
    <div className="space-y-4">
      {notice && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Responses" value={summary.total.toLocaleString()} />
        <Stat
          label="First response"
          value={summary.firstResponseAt ? new Date(summary.firstResponseAt).toLocaleDateString() : '—'}
        />
        <Stat
          label="Latest response"
          value={summary.lastResponseAt ? new Date(summary.lastResponseAt).toLocaleDateString() : '—'}
        />
      </div>

      {summary.suppressed && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Only {summary.total} response{summary.total === 1 ? '' : 's'} so far. A per-question
          breakdown needs at least {summary.minimumForBreakdown}, because with fewer than that the
          answers could be traced back to individuals.
        </div>
      )}

      {!summary.suppressed &&
        summary.fields.map((field) => (
          <Card key={field.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{field.label}</CardTitle>
              <CardDescription>
                {field.answered} answered
                {field.stats &&
                  ` · min ${field.stats.min} · max ${field.stats.max} · average ${field.stats.mean}`}
              </CardDescription>
            </CardHeader>
            {field.counts && (
              <CardContent className="space-y-2">
                {Object.entries(field.counts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([option, count]) => {
                    const pct = field.answered ? Math.round((count / field.answered) * 100) : 0;
                    return (
                      <div key={option} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate">{option}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {count} · {pct}%
                          </span>
                        </div>
                        <div
                          className="h-2 w-full overflow-hidden rounded-full bg-muted"
                          role="img"
                          aria-label={`${option}: ${count} of ${field.answered}`}
                        >
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            )}
          </Card>
        ))}

      {!summary.suppressed && summary.fields.length === 0 && summary.total > 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <BarChart3 className="h-8 w-8" />
          <p className="text-sm">
            No questions in this form can be summarised without risking identification.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
