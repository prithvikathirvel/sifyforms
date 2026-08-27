import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchForms } from '../store/formsSlice';
// import { getSession } from '../store/authSlice';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import CreateFormModal from '../components/forms/CreateFormModal';
import FormWorkspaceCard from '../components/forms/FormWorkspaceCard';
import { usePermissions, ACTIONS } from '../hooks/usePermissions';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  ArrowRight,
  BarChart3,
  CornerDownRight,
  FileText,
  Inbox,
  Loader2,
  Network,
  Users,
} from 'lucide-react';
import api from '../lib/api';

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

const DASHBOARD_FORM_LIMIT = 4;
const TEAM_PREVIEW_DEPTH = 1;
const TEAM_PREVIEW_LIMIT = 4;
const TOP_FORM_BAR_STYLES = [
  'bg-primary',
  'bg-primary/75',
  'bg-primary/55',
  'bg-primary/35',
];

function StatTile({
  icon,
  value,
  label,
  detail,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  detail: string;
}) {
  return (
    <Card className="rounded-xl border-border/80 bg-card shadow-none transition-colors hover:border-ink-300">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-foreground">{value}</p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-ink-50 text-ink-600">
            {icon}
          </span>
        </div>
        <p className="mt-2.5 truncate text-[11px] font-medium text-muted-foreground">{detail}</p>
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
        if (active) setStats({ ...EMPTY_STATS, ...response.data });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [dispatch]);

  const recentForms = [...forms]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, DASHBOARD_FORM_LIMIT);

  const topForms = stats.topForms.slice(0, DASHBOARD_FORM_LIMIT);
  const topFormMax = Math.max(...topForms.map((form) => form.submissionCount), 1);
  const topFormTotal = topForms.reduce((sum, form) => sum + form.submissionCount, 0);

  const sortedTeams = [...stats.teamBreakdown].sort((a, b) =>
    a.path && b.path
      ? a.path.localeCompare(b.path)
      : a.depth - b.depth || a.name.localeCompare(b.name)
  );
  const teamPreview = sortedTeams
    .filter((team) => team.depth <= TEAM_PREVIEW_DEPTH)
    .slice(0, TEAM_PREVIEW_LIMIT);
  const hiddenTeamCount = Math.max(stats.teamBreakdown.length - teamPreview.length, 0);

  return (
    <div className="app-shell flex h-screen bg-workspace">
      <Sidebar onCreateForm={() => setShowCreateModal(true)} />

      <main className="min-w-0 flex-1 overflow-auto bg-workspace">
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
        <div className="p-4 sm:p-5 lg:p-6">
          <div className="mb-5 sm:mb-6">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Welcome back, {user?.firstName || user?.name || 'there'}
            </h2>
            <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-[13px]">
              Here is the latest activity across your workspace.
            </p>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <StatTile
              icon={<FileText className="h-[18px] w-[18px]" strokeWidth={1.9} />}
              value={stats.totalForms}
              label="Forms"
              detail={`${stats.publishedForms} published · ${stats.draftForms} draft`}
            />
            <StatTile
              icon={<Inbox className="h-[18px] w-[18px]" strokeWidth={1.9} />}
              value={stats.totalSubmissions}
              label="Submissions"
              detail={`${stats.recentSubmissions} in the last 30 days`}
            />
            <StatTile
              icon={<Users className="h-[18px] w-[18px]" strokeWidth={1.9} />}
              value={stats.totalMembers}
              label="Members"
              detail={stats.totalMembers === 1 ? 'just you so far' : 'in this organization'}
            />
            <StatTile
              icon={<Network className="h-[18px] w-[18px]" strokeWidth={1.9} />}
              value={stats.totalTeams}
              label="Teams"
              detail={stats.totalTeams === 1 ? 'General only' : 'including sub-teams'}
            />
          </div>

          {/* Insights */}
          <div className="mb-6 grid gap-4 lg:grid-cols-2 sm:mb-7">
            <Card className="flex flex-col overflow-hidden rounded-xl border-border/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
              <CardHeader className="shrink-0 border-b border-border/70 px-4 py-3.5 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 font-display text-sm font-bold">
                      <BarChart3 className="h-4 w-4 text-primary" strokeWidth={1.8} />
                      Top forms by submissions
                    </CardTitle>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                      Relative response volume across your four busiest forms
                    </p>
                  </div>
                  {topForms.length > 0 && (
                    <span className="shrink-0 rounded-md border border-border bg-ink-50 px-2 py-1 text-[10px] font-semibold tabular-nums text-ink-600">
                      {topFormTotal} responses
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 px-3 py-3">
                {topForms.length === 0 ? (
                  <div className="flex min-h-40 items-center justify-center px-4 text-center">
                    <div>
                      <BarChart3 className="mx-auto h-5 w-5 text-ink-300" strokeWidth={1.6} />
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        Your highest-volume forms will appear after the first response.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {topForms.map((form, index) => {
                      const percentage = Math.round((form.submissionCount / topFormMax) * 100);
                      return (
                        <button
                          key={form.id}
                          type="button"
                          onClick={() => navigate(`/forms/${form.id}/submissions`)}
                          aria-label={`Open ${form.name}, ${form.submissionCount} responses`}
                          className="group/chart grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-ink-50 sm:grid-cols-[minmax(8.5rem,0.8fr)_minmax(8rem,1.2fr)_auto]"
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-card text-[10px] font-bold tabular-nums text-ink-500">
                              {index + 1}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground transition-colors group-hover/chart:text-primary">
                                {form.name}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                <span className={`h-1.5 w-1.5 rounded-full ${form.isPublished ? 'bg-emerald-500' : 'bg-ink-300'}`} />
                                {form.isPublished ? 'Published' : 'Draft'}
                              </span>
                            </span>
                          </span>

                          <span className="col-span-2 row-start-2 h-2 overflow-hidden rounded-full bg-ink-100 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                            <span
                              className={`block h-full rounded-full transition-[width] duration-500 ${TOP_FORM_BAR_STYLES[index]}`}
                              style={{ width: `${Math.max(percentage, 4)}%` }}
                            />
                          </span>

                          <span className="col-start-2 row-start-1 min-w-10 text-right sm:col-start-3">
                            <span className="block font-display text-sm font-bold tabular-nums text-foreground">
                              {form.submissionCount}
                            </span>
                            <span className="block text-[9px] font-medium text-muted-foreground">responses</span>
                          </span>
                        </button>
                      );
                    })}
                    <p className="px-2.5 pt-1 text-[10px] font-medium text-muted-foreground">
                      Bar length is relative to the highest-volume form.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col overflow-hidden rounded-xl border-border/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
              <CardHeader className="shrink-0 border-b border-border/70 px-4 py-3.5 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 font-display text-sm font-bold">
                      <Network className="h-4 w-4 text-primary" strokeWidth={1.8} />
                      Activity by team
                    </CardTitle>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                      A compact preview of the first two hierarchy levels
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/teams')}
                    className="h-7 shrink-0 rounded-md px-2 text-[10px] text-primary hover:bg-primary/[0.05] hover:text-primary"
                  >
                    Full hierarchy
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                {stats.teamBreakdown.length === 0 ? (
                  <div className="flex min-h-40 items-center justify-center px-4 text-center">
                    <p className="text-xs font-medium text-muted-foreground">No teams yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60 px-3 py-1.5">
                    {teamPreview.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => navigate('/teams')}
                        className="group flex w-full min-w-0 items-center rounded-md py-2 pr-2 text-left transition-colors hover:bg-ink-50"
                      >
                        <span
                          className="flex min-w-0 flex-1 items-center gap-2.5"
                          style={{ paddingLeft: `${8 + team.depth * 18}px` }}
                        >
                          {team.depth > 0 && (
                            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-ink-300" strokeWidth={1.6} />
                          )}
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-ink-50 text-ink-500">
                            <Network className="h-3.5 w-3.5" strokeWidth={1.7} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-foreground transition-colors group-hover:text-primary">{team.name}</span>
                            <span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">
                              {team.memberCount} member{team.memberCount === 1 ? '' : 's'} · {team.forms} form{team.forms === 1 ? '' : 's'}
                            </span>
                          </span>
                        </span>
                        <span className="ml-3 shrink-0 text-right">
                          <span className="block text-xs font-bold tabular-nums text-ink-700">{team.submissions}</span>
                          <span className="block text-[9px] font-medium text-muted-foreground">responses</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
              {hiddenTeamCount > 0 && (
                <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-ink-50/65 px-4 py-2.5">
                  <p className="min-w-0 text-[10px] font-medium text-muted-foreground">
                    <span className="font-semibold text-ink-600">{hiddenTeamCount} more team{hiddenTeamCount === 1 ? '' : 's'}</span>{' '}
                    continue in the full organization tree.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/teams')}
                    className="shrink-0 text-[10px] font-semibold text-primary hover:underline"
                  >
                    View all
                  </button>
                </div>
              )}
            </Card>
          </div>

          {/* Recent Forms Section */}
          <div className="mb-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight text-foreground">Recent forms</h2>
                <p className="mt-1 text-xs font-medium text-muted-foreground">Your {DASHBOARD_FORM_LIMIT} most recently updated forms</p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {canCreateForm && (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="h-9 w-full rounded-lg sm:w-auto"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Create Form
                  </Button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading your forms...</p>
                </div>
              </div>
            ) : forms.length === 0 ? (
              <Card className="rounded-xl border-dashed border-border bg-card shadow-none">
                <CardContent className="py-14 text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/[0.06]">
                    <FileText className="h-6 w-6 text-primary" strokeWidth={1.8} />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">No forms yet</h3>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    Create your first form to start collecting responses and analyzing data
                  </p>
                  {canCreateForm && (
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      className="h-10 rounded-lg px-5"
                      size="lg"
                    >
                      <FileText className="h-5 w-5 mr-2" />
                      Create Your First Form
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {recentForms.map((form) => (
                    <FormWorkspaceCard
                      key={form.id}
                      form={form}
                      orgSlug={currentOrg?.slug || 'default-org'}
                      teamName={stats.teamBreakdown.find((team) => team.id === form.teamId)?.name}
                    />
                  ))}
                </div>

                {/* View all link */}
                {forms.length > DASHBOARD_FORM_LIMIT && (
                  <div className="mt-6 text-center">
                    <Link to="/forms">
                      <Button variant="outline" className="rounded-lg border-border hover:border-primary/20 hover:bg-primary/[0.04] gap-2">
                        View all {forms.length} forms
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <CreateFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
