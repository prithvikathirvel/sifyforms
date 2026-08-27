import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchForms } from '../store/formsSlice';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import CreateFormModal from '../components/forms/CreateFormModal';
import FormCard from '../components/forms/FormCard';
import { usePermissions, ACTIONS } from '../hooks/usePermissions';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Activity,
  ArrowRight,
  BarChart3,
  FileText,
  Inbox,
  Loader2,
  Network,
  Sparkles,
  Users,
} from 'lucide-react';
import api from '../lib/api';
import type { Form } from '../types';

interface FormSummary {
  id: string;
  name: string;
  teamId: string | null;
  submissionCount: number;
  isPublished: boolean;
}

interface TeamSummary {
  id: string;
  name: string;
  parentId?: string | null;
  path?: string;
  depth: number;
  memberCount: number;
  forms: number;
  submissions: number;
}

/** Everything the dashboard shows, already scoped to what the viewer can reach. */
interface Stats {
  totalForms: number;
  publishedForms: number;
  draftForms: number;
  totalSubmissions: number;
  recentSubmissions: number;
  totalMembers: number;
  totalTeams: number;
  topForms: FormSummary[];
  recentForms: (FormSummary & { updatedAt: string })[];
  teamBreakdown: TeamSummary[];
}

const EMPTY_STATS: Stats = {
  totalForms: 0,
  publishedForms: 0,
  draftForms: 0,
  totalSubmissions: 0,
  recentSubmissions: 0,
  totalMembers: 0,
  totalTeams: 0,
  topForms: [],
  recentForms: [],
  teamBreakdown: [],
};

const RECENT_LIMIT = 5;
const CHART_LIMIT = 5;

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

function StatTile({
  icon,
  value,
  label,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  detail: string;
  tone: 'violet' | 'rose' | 'emerald' | 'amber';
}) {
  const toneStyles = {
    violet: 'border-primary/15 bg-primary/[0.055] text-primary',
    rose: 'border-fuchsia-200/70 bg-fuchsia-50/70 text-fuchsia-700',
    emerald: 'border-emerald-200/70 bg-emerald-50/70 text-emerald-700',
    amber: 'border-amber-200/70 bg-amber-50/70 text-amber-700',
  };

  return (
    <Card className="rounded-2xl border-border/80 bg-card shadow-[0_8px_28px_hsl(var(--foreground)/0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_14px_32px_hsl(var(--foreground)/0.06)]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-[28px] font-bold leading-none tabular-nums text-foreground">
              {formatNumber(value)}
            </p>
          </div>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneStyles[tone]}`}>
            {icon}
          </span>
        </div>
        <p className="mt-4 truncate text-xs font-medium text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function SubmissionLeaders({
  forms,
  totalSubmissions,
  onOpen,
}: {
  forms: FormSummary[];
  totalSubmissions: number;
  onOpen: (formId: string) => void;
}) {
  const visibleForms = forms.slice(0, CHART_LIMIT);
  const max = visibleForms[0]?.submissionCount || 1;

  return (
    <Card className="rounded-2xl border-border/80 bg-card shadow-[0_8px_28px_hsl(var(--foreground)/0.035)]">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b border-border/70 px-5 py-5 sm:px-6">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Response analytics</p>
          <CardTitle className="font-display text-base font-bold tracking-tight sm:text-lg">
            Top forms by submissions
          </CardTitle>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            A ranked view of where responses are landing.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-primary/10 bg-primary/[0.055] px-3 py-2 text-right">
          <p className="font-display text-lg font-bold leading-none tabular-nums text-primary">
            {formatNumber(totalSubmissions)}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Total responses</p>
        </div>
      </CardHeader>

      <CardContent className="px-5 py-5 sm:px-6">
        {visibleForms.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
              <BarChart3 className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <p className="text-sm font-semibold text-foreground">Your chart will appear here</p>
            <p className="mt-1 max-w-xs text-xs font-medium text-muted-foreground">
              Once a form receives responses, the busiest forms will be ranked here.
            </p>
          </div>
        ) : (
          <div className="space-y-4" aria-label="Top forms by submissions">
            {visibleForms.map((form, index) => {
              const count = form.submissionCount || 0;
              const barWidth = Math.max(8, Math.round((count / max) * 100));
              const share = totalSubmissions > 0 ? Math.round((count / totalSubmissions) * 100) : 0;

              return (
                <button
                  key={form.id}
                  type="button"
                  onClick={() => onOpen(form.id)}
                  className="group block w-full rounded-xl text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${index === 0 ? 'bg-primary text-primary-foreground' : 'border border-border bg-muted/45 text-muted-foreground'}`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground transition-colors group-hover:text-primary">
                      {form.name}
                    </span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                      {formatNumber(count)}
                    </span>
                    <span className="w-9 shrink-0 text-right text-[11px] font-medium tabular-nums text-muted-foreground">
                      {share}%
                    </span>
                  </div>
                  <div className="ml-10 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${index === 0 ? 'bg-brand-gradient' : 'bg-primary/50 group-hover:bg-primary/70'}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TeamActivity({
  teams,
  onOpen,
}: {
  teams: TeamSummary[];
  onOpen: () => void;
}) {
  const visibleTeams = [...teams]
    .sort((a, b) => b.submissions - a.submissions || b.forms - a.forms || a.name.localeCompare(b.name))
    .slice(0, CHART_LIMIT);
  const max = visibleTeams[0]?.submissions || 1;

  return (
    <Card className="rounded-2xl border-border/80 bg-card shadow-[0_8px_28px_hsl(var(--foreground)/0.035)]">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b border-border/70 px-5 py-5 sm:px-6">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Workspace coverage</p>
          <CardTitle className="font-display text-base font-bold tracking-tight sm:text-lg">Activity by team</CardTitle>
          <p className="mt-1 text-xs font-medium text-muted-foreground">See which groups are moving work forward.</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/45 text-ink-500">
          <Network className="h-4 w-4" strokeWidth={1.8} />
        </span>
      </CardHeader>

      <CardContent className="px-5 py-5 sm:px-6">
        {visibleTeams.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 text-center">
            <p className="text-sm font-semibold text-foreground">No team activity yet</p>
            <p className="mt-1 max-w-xs text-xs font-medium text-muted-foreground">
              Create teams and assign forms to understand activity by group.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleTeams.map((team) => {
              const width = Math.max(8, Math.round(((team.submissions || 0) / max) * 100));
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={onOpen}
                  className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/45 text-ink-500">
                      <Users className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground transition-colors group-hover:text-primary">
                        {team.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">
                        {team.forms} form{team.forms === 1 ? '' : 's'} · {team.memberCount} member{team.memberCount === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                      {formatNumber(team.submissions)}
                    </span>
                  </div>
                  <div className="ml-11 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-ink-400/70 transition-all duration-500 group-hover:bg-ink-500" style={{ width: `${width}%` }} />
                  </div>
                </button>
              );
            })}
            {teams.length > CHART_LIMIT && (
              <Button variant="ghost" size="sm" onClick={onOpen} className="mt-1 h-8 px-0 text-xs font-semibold text-primary hover:bg-transparent hover:text-primary">
                View all teams
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { currentOrg } = useAppSelector((state) => state.org);
  const { forms, isLoading } = useAppSelector((state) => state.forms);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { can } = usePermissions();
  const canCreateForm = can(ACTIONS.CREATE_FORM);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  useEffect(() => {
    let active = true;
    dispatch(fetchForms());
    api.get('/forms/stats')
      .then((response) => {
        if (!active) return;
        const data = response.data as Partial<Stats>;
        setStats({
          ...EMPTY_STATS,
          ...data,
          topForms: Array.isArray(data.topForms) ? data.topForms : [],
          teamBreakdown: Array.isArray(data.teamBreakdown) ? data.teamBreakdown : [],
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [dispatch]);

  const recentForms = useMemo(
    () => [...forms]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, RECENT_LIMIT),
    [forms]
  );

  const teamNames = useMemo(() => {
    const names = new Map<string, string>();
    stats.teamBreakdown.forEach((team) => names.set(team.id, team.name));
    return names;
  }, [stats.teamBreakdown]);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar onCreateForm={() => setShowCreateModal(true)} />

      <main className="min-w-0 flex-1 overflow-y-auto bg-muted/20">
        <PageHeader
          title="Dashboard"
          description={`${currentOrg?.name || 'Your workspace'} · Forms, responses, and team activity`}
          actions={canCreateForm ? (
            <Button onClick={() => setShowCreateModal(true)} className="h-9 rounded-lg px-3.5">
              <FileText className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">Create form</span>
              <span className="sm:hidden">Create</span>
            </Button>
          ) : undefined}
        />

        <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <section className="relative mb-6 overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.09] via-card to-card p-5 shadow-[0_8px_28px_hsl(var(--foreground)/0.03)] sm:p-6">
            <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-primary/[0.08] blur-2xl" />
            <div className="relative flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
                <Sparkles className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Workspace overview</p>
                <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Welcome back, {user?.firstName || user?.name || 'there'}
                </h2>
                <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-[13px]">
                  A clear view of your forms, responses, and the teams behind them.
                </p>
              </div>
            </div>
          </section>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <StatTile
              icon={<FileText className="h-[18px] w-[18px]" strokeWidth={1.9} />}
              value={stats.totalForms}
              label="Forms"
              detail={`${stats.publishedForms} published · ${stats.draftForms} draft`}
              tone="violet"
            />
            <StatTile
              icon={<Inbox className="h-[18px] w-[18px]" strokeWidth={1.9} />}
              value={stats.totalSubmissions}
              label="Submissions"
              detail={`${stats.recentSubmissions} in the last 30 days`}
              tone="rose"
            />
            <StatTile
              icon={<Users className="h-[18px] w-[18px]" strokeWidth={1.9} />}
              value={stats.totalMembers}
              label="Members"
              detail={stats.totalMembers === 1 ? 'Just you so far' : 'In this organization'}
              tone="emerald"
            />
            <StatTile
              icon={<Network className="h-[18px] w-[18px]" strokeWidth={1.9} />}
              value={stats.totalTeams}
              label="Teams"
              detail={stats.totalTeams === 1 ? 'Your organization structure' : 'Including sub-teams'}
              tone="amber"
            />
          </div>

          <div className="mb-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
            <SubmissionLeaders
              forms={stats.topForms}
              totalSubmissions={stats.totalSubmissions}
              onOpen={(formId) => navigate(`/forms/${formId}/submissions`)}
            />
            <TeamActivity teams={stats.teamBreakdown} onOpen={() => navigate('/teams')} />
          </div>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" strokeWidth={1.9} />
                  <h2 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">Recent forms</h2>
                </div>
                <p className="mt-1 text-xs font-medium text-muted-foreground">Your most recently updated forms, ready when you are.</p>
              </div>
              {forms.length > RECENT_LIMIT && (
                <Link to="/forms" className="shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-semibold text-primary hover:bg-primary/[0.06] hover:text-primary">
                    View all
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                  </Button>
                </Link>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm font-medium text-muted-foreground">Loading your forms…</p>
                </div>
              </div>
            ) : forms.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-border bg-card shadow-none">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.07] text-primary">
                    <FileText className="h-6 w-6" strokeWidth={1.8} />
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground">No forms yet</h3>
                  <p className="mx-auto mb-7 mt-2 max-w-md text-sm font-medium text-muted-foreground">
                    Create your first form to start collecting responses and understanding your audience.
                  </p>
                  {canCreateForm && (
                    <Button onClick={() => setShowCreateModal(true)} className="h-10 rounded-lg px-5">
                      <FileText className="mr-2 h-4 w-4" strokeWidth={1.9} />
                      Create your first form
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {recentForms.map((form: Form) => (
                  <FormCard
                    key={form.id}
                    form={form}
                    orgSlug={currentOrg?.slug || 'default-org'}
                    teamName={form.teamId ? teamNames.get(form.teamId) : null}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <CreateFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
