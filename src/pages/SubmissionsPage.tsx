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
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Trophy,
  ClipboardCheck,
  ShieldCheck,
  RefreshCw,
  EyeOff,
  Lock,
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
        .map((v: any) => v?.filename || v?.name)
        .filter(Boolean);
      if (names.length > 0) return `📎 ${names.join(', ')}`;
      return `${value.length} file${value.length > 1 ? 's' : ''}`;
    }
    return value.join(', ');
  }
  if (typeof value === 'object') {
    const obj = value as any;
    if (obj.filename) return `📎 ${obj.filename}`;
    if (obj.name) return `📎 ${obj.name}`;
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
  const { submissions, pagination, isLoading } = useAppSelector((state) => state.submissions);
  const { currentForm } = useAppSelector((state) => state.forms);
  const access = useAppSelector((state) => (formId ? state.formSharing.access[formId] : undefined));
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('submissions');
  const [tabInitialised, setTabInitialised] = useState(false);

  const formType = currentForm?.settings?.formType;

  useEffect(() => {
    if (formId) {
      dispatch(fetchForm(formId));
      dispatch(fetchFormAccess(formId));
      // A 403 here is expected and meaningful: it means this person may see
      // results but not responses, and the aggregate tab takes over below.
      dispatch(fetchSubmissions({ formId }));
    }
  }, [formId, dispatch]);

  // Land on Results rather than an empty Submissions tab when rows are not on
  // offer. Runs once, so it never fights a tab the user picked themselves.
  useEffect(() => {
    if (access && !tabInitialised) {
      if (access.level === 'NONE' || access.level === 'AGGREGATE') setActiveTab('results');
      setTabInitialised(true);
    }
  }, [access, tabInitialised]);

  const handleExport = async (format: 'csv' | 'json') => {
    if (!formId) return;
    try {
      const result = await dispatch(exportSubmissions({ formId, format })).unwrap();
      const blob = format === 'csv'
        ? new Blob([result.data], { type: 'text/csv' })
        : new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentForm?.name || 'submissions'}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* noop */ }
  };

  const handleDelete = async (submissionId: string) => {
    if (!formId) return;
    await dispatch(deleteSubmission({ formId, submissionId }));
    setDeleteConfirm(null);
    if (selectedSubmission === submissionId) setSelectedSubmission(null);
  };

  const handlePageChange = (page: number) => {
    if (formId) dispatch(fetchSubmissions({ formId, page }));
  };

  const filteredSubmissions = submissions.filter((sub) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return Object.values(sub.data).some((value) => formatValue(value).toLowerCase().includes(searchLower));
  });

  const selectedSub = submissions.find((s) => s.id === selectedSubmission);

  if (isLoading && submissions.length === 0) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // Someone at AGGREGATE or below cannot open a response at all; results become
  // the whole of what this page shows them.
  const canSeeRows = !!access && access.level !== 'NONE' && access.level !== 'AGGREGATE';
  const aggregateOnly = !!access && access.level === 'AGGREGATE';

  const policyNotice =
    access?.policy === 'ANONYMOUS'
      ? 'This form is anonymous. Individual responses are not viewable by anyone, including you — only the totals below.'
      : access?.policy === 'BLIND_REVIEW'
        ? 'Blind review: responses are readable, but identifying fields are hidden from everyone.'
        : aggregateOnly
          ? 'Your role gives you aggregate results for this form, not individual responses.'
          : undefined;

  // Build tab list based on form type
  const tabs = [
    ...(canSeeRows
      ? [{ id: 'submissions', label: 'Submissions', icon: <Eye className="h-4 w-4" /> }]
      : []),
    { id: 'results', label: 'Results', icon: <BarChart2 className="h-4 w-4" /> },
    ...(formType === 'assessment' ? [
      { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="h-4 w-4" /> },
      { id: 'analytics', label: 'Analytics', icon: <ClipboardCheck className="h-4 w-4" /> },
    ] : []),
    ...(formType === 'voting' ? [
      { id: 'poll-results', label: 'Poll Results', icon: <BarChart2 className="h-4 w-4" /> },
      { id: 'audit-log', label: 'Audit Log', icon: <ShieldCheck className="h-4 w-4" /> },
    ] : []),
  ];

  return (
    <div className="app-shell min-h-screen bg-workspace">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">{currentForm?.name} — Submissions</h1>
                {formType && (
                  <Badge variant="outline" className="text-xs capitalize">{formType}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{pagination.total} total submissions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {access && (
              <span
                className="hidden items-center gap-1.5 rounded border px-2 py-1 text-xs text-muted-foreground sm:inline-flex"
                title="Your access to this form's responses"
              >
                {access.level === 'FULL' || access.level === 'EXPORT' ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
                {RESPONSE_LEVEL_LABEL[access.level]}
                {access.policy !== 'STANDARD' && (
                  <>
                    <Lock className="ml-1 h-3 w-3" />
                    {access.policy === 'ANONYMOUS' ? 'Anonymous' : access.policy === 'BLIND_REVIEW' ? 'Blind review' : 'Restricted'}
                  </>
                )}
              </span>
            )}
            {access?.level === 'EXPORT' && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                  <Download className="h-4 w-4 mr-2" />Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
                  <Download className="h-4 w-4 mr-2" />Export JSON
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs — only shown when there are extra tabs */}
        {tabs.length > 1 && (
          <div className="flex border-t px-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Tab panels */}
      {activeTab === 'results' && formId && (
        <div className="p-4">
          <AggregateResults formId={formId} notice={policyNotice} />
        </div>
      )}
      {activeTab === 'leaderboard' && formId && <LeaderboardTab formId={formId} />}
      {activeTab === 'analytics' && formId && <AssessmentAnalyticsTab formId={formId} />}
      {activeTab === 'poll-results' && formId && <PollResultsTab formId={formId} />}
      {activeTab === 'audit-log' && formId && <AuditLogTab formId={formId} />}

      {/* Submissions list + detail (default tab) */}
      {activeTab === 'submissions' && (
        <div className="flex h-[calc(100vh-57px)]" style={{ height: tabs.length > 1 ? 'calc(100vh-97px)' : 'calc(100vh-57px)' }}>
          {/* List */}
          <div className="w-1/2 border-r overflow-y-auto">
            <div className="p-4 border-b bg-background sticky top-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search submissions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-4" />
                <p>No submissions yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredSubmissions.map((submission) => {
                  const firstField = Object.entries(submission.data)[0];
                  const secondField = Object.entries(submission.data)[1];
                  return (
                    <div
                      key={submission.id}
                      className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedSubmission === submission.id ? 'bg-muted' : ''}`}
                      onClick={() => setSelectedSubmission(submission.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {!submission.isRead && <Badge variant="default" className="text-xs">New</Badge>}
                            <span className="font-medium truncate">
                              {firstField ? formatValue(firstField[1]) : 'Submission'}
                            </span>
                          </div>
                          {secondField && (
                            <p className="text-sm text-muted-foreground truncate mt-1">{formatValue(secondField[1])}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">{formatDate(submission.createdAt)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(submission.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="p-4 border-t bg-background sticky bottom-0 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Detail */}
          <div className="w-1/2 overflow-y-auto">
            {selectedSub ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold">Submission Details</h2>
                    <p className="text-sm text-muted-foreground">{formatDate(selectedSub.createdAt)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedSubmission(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <SubmissionViewer
                    fields={currentForm?.schema.fields || []}
                    data={selectedSub.data}
                    redactedFields={selectedSub.redactedFields}
                  />

                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Metadata</h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">ID:</span> {selectedSub.id}</p>
                      {selectedSub.ip && <p><span className="text-muted-foreground">IP:</span> {selectedSub.ip}</p>}
                      {selectedSub.userAgent && (
                        <p className="truncate"><span className="text-muted-foreground">Browser:</span> {selectedSub.userAgent}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Eye className="h-12 w-12 mx-auto mb-4" />
                  <p>Select a submission to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <Card className="relative z-50 w-full max-w-md">
            <CardHeader><CardTitle>Delete Submission</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">Are you sure you want to delete this submission? This action cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
