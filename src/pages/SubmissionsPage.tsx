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
} from 'lucide-react';

// ── Shared helpers ──────────────────────────────────────────────────────────

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
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
  avgScore: number;
  avgPercentage: number;
  distribution: Array<{ range: string; count: number }>;
}

function AssessmentAnalyticsTab({ formId }: { formId: string }) {
  const [data, setData] = useState<AssessmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/processing/forms/${formId}/assessment-analytics`);
      setData(res.data);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data || data.total === 0) return <div className="text-center py-16 text-muted-foreground"><ClipboardCheck className="h-12 w-12 mx-auto mb-3" /><p>No assessed submissions yet.</p></div>;

  const maxBar = Math.max(...data.distribution.map(d => d.count), 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Assessment Analytics</h2>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Attempts', value: data.total },
          { label: 'Pass Rate', value: `${data.passRate}%` },
          { label: 'Avg Score', value: `${data.avgPercentage}%` },
          { label: 'Passed', value: `${data.passed} / ${data.total}` },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Score distribution */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Score Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.distribution.map(d => (
              <div key={d.range} className="flex items-center gap-3 text-sm">
                <span className="w-16 text-muted-foreground shrink-0">{d.range}%</span>
                <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-primary rounded transition-all"
                    style={{ width: `${(d.count / maxBar) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-muted-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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

function LeaderboardTab({ formId }: { formId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/processing/forms/${formId}/leaderboard`);
      setEntries(res.data.leaderboard ?? []);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (entries.length === 0) return <div className="text-center py-16 text-muted-foreground"><Trophy className="h-12 w-12 mx-auto mb-3" /><p>No results yet.</p></div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
      </div>
      <div className="space-y-2">
        {entries.map(entry => (
          <div
            key={entry.submissionId}
            className={`flex items-center gap-4 p-3 rounded-lg border text-sm ${entry.rank <= 3 ? 'bg-amber-50 border-amber-200' : 'bg-card'}`}
          >
            <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs shrink-0 ${entry.rank === 1 ? 'bg-yellow-400 text-yellow-900' : entry.rank === 2 ? 'bg-secondary text-muted-foreground' : entry.rank === 3 ? 'bg-orange-300 text-orange-900' : 'bg-muted text-muted-foreground'}`}>
              {entry.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{entry.submissionId.slice(0, 12)}… · {formatDate(entry.submittedAt)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-semibold ${entry.result.passed ? 'text-green-600' : 'text-red-500'}`}>{entry.result.percentage}%</p>
              <p className="text-xs text-muted-foreground">{entry.result.totalScore}/{entry.result.maxScore} pts</p>
            </div>
            <Badge variant={entry.result.passed ? 'default' : 'destructive'} className="shrink-0">
              {entry.result.passed ? 'Pass' : 'Fail'}
            </Badge>
          </div>
        ))}
      </div>
    </div>
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
    ...(formType === 'assessment' ? [
      { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="h-3.5 w-3.5" /> },
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
