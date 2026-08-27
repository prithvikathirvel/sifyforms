import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchForms, deleteForm } from '../store/formsSlice';
// import { getSession } from '../store/authSlice';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import CreateFormModal from '../components/forms/CreateFormModal';
import { usePermissions, ACTIONS } from '../hooks/usePermissions';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  FileText,
  BarChart3,
  Edit,
  Eye,
  Trash2,
  Inbox,
  Loader2,
  TrendingUp,
  Users,
  Network,
  Copy,
  CornerDownRight,
  Share2,
  MoreHorizontal,
  ArrowRight,
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
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-foreground sm:text-[28px]">{value}</p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/45 text-ink-600">
            {icon}
          </span>
        </div>
        <p className="mt-3 truncate text-[11px] font-medium text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function RecentFormCard({ form, orgSlug }: { form: Form; orgSlug: string }) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const publicUrl = `${import.meta.env.VITE_PUBLIC_URL || window.location.origin}/${orgSlug}/${form.slug}`;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);

  const remove = () => {
    setMenuOpen(false);
    if (window.confirm(`Are you sure you want to delete "${form.name}"?`)) {
      dispatch(deleteForm(form.id));
    }
  };

  return (
    <Card className="group flex min-h-[13rem] flex-col overflow-visible rounded-xl border-border/80 bg-card shadow-none transition-colors hover:border-ink-300">
      <CardHeader className="shrink-0 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/45 text-ink-600">
              <FileText className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 pt-0.5">
              <CardTitle className="line-clamp-2 font-display text-[15px] font-bold leading-5 text-foreground sm:text-base">
                {form.name}
              </CardTitle>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">Updated {formatDate(form.updatedAt)}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={form.isPublished
              ? 'shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'shrink-0 border-border bg-muted/50 text-muted-foreground'}
          >
            {form.isPublished ? 'Published' : 'Draft'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col px-4 pb-0 pt-1 sm:px-5">
        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <div>
            <p className="font-display text-lg font-bold tabular-nums text-foreground">{form.submissionCount || 0}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Responses</p>
          </div>
          <p className="text-right text-[11px] font-medium text-muted-foreground">
            {form.isPublished ? 'Published form' : 'Not published'}
          </p>
        </div>
      </CardContent>

      <div className="mt-4 flex items-center border-t border-border/70 p-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/forms/${form.id}/edit`)} className="h-8 rounded-md px-2.5 text-xs text-ink-700 hover:bg-muted">
          <Edit className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/forms/${form.id}/submissions`)} className="h-8 rounded-md px-2.5 text-xs text-ink-700 hover:bg-muted">
          <BarChart3 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
          Responses
        </Button>

        <div ref={menuRef} className="relative ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="More form actions"
            aria-expanded={menuOpen}
            className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div className="absolute bottom-full right-0 z-30 mb-1 w-44 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg">
              {form.isPublished && (
                <button type="button" onClick={() => { setMenuOpen(false); window.open(publicUrl, '_blank'); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted">
                  <Eye className="h-3.5 w-3.5" /> Preview
                </button>
              )}
              <button type="button" onClick={() => { setMenuOpen(false); void navigator.clipboard.writeText(publicUrl); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted">
                <Copy className="h-3.5 w-3.5" /> Copy link
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); window.open(publicUrl, '_blank'); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted">
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
              <button type="button" onClick={remove} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-destructive hover:bg-destructive/[0.06]">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
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
    .slice(0, RECENT_LIMIT);

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar onCreateForm={() => setShowCreateModal(true)} />

      <main className="min-w-0 flex-1 overflow-auto bg-muted/20">
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
        <div className="p-4 sm:p-6 lg:p-8">
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
          <div className="grid gap-4 lg:grid-cols-2 mb-6 sm:mb-8">
            <Card className="flex min-h-0 flex-col overflow-hidden rounded-xl border-border/80 bg-card shadow-none sm:h-64">
              <CardHeader className="shrink-0 border-b border-border/70 px-5 py-3.5">
                <CardTitle className="flex items-center gap-2 font-display text-sm font-bold">
                  <TrendingUp className="h-4 w-4 text-ink-400" strokeWidth={1.8} />
                  Top forms by submissions
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {stats.topForms.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No submissions yet. Once responses arrive, your busiest forms appear here.
                  </p>
                ) : (
                  stats.topForms.map((form) => {
                    const max = stats.topForms[0].submissionCount || 1;
                    const pct = Math.round((form.submissionCount / max) * 100);
                    return (
                      <button
                        key={form.id}
                        type="button"
                        onClick={() => navigate(`/forms/${form.id}/submissions`)}
                        className="group w-full space-y-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-medium group-hover:text-primary transition-colors">
                            {form.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {form.submissionCount}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary/75" style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="flex min-h-0 flex-col overflow-hidden rounded-xl border-border/80 bg-card shadow-none sm:h-64">
              <CardHeader className="shrink-0 border-b border-border/70 px-5 py-3.5">
                <CardTitle className="flex items-center gap-2 font-display text-sm font-bold">
                  <Network className="h-4 w-4 text-ink-400" strokeWidth={1.8} />
                  Activity by team
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 px-3 py-2">
                {stats.teamBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No teams yet.</p>
                ) : (
                  <div className="max-h-52 overflow-auto">
                    <div className="min-w-[20rem] divide-y divide-border/60">
                      {[...stats.teamBreakdown]
                        .sort((a, b) => (a.path && b.path ? a.path.localeCompare(b.path) : a.depth - b.depth || a.name.localeCompare(b.name)))
                        .map((team) => (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => navigate('/teams')}
                            className="group flex w-full items-center py-2 pr-2 text-left transition-colors hover:bg-muted/45"
                          >
                            <span
                              className="flex min-w-0 flex-1 items-center gap-2.5"
                              style={{ paddingLeft: `${10 + team.depth * 18}px` }}
                            >
                              {team.depth > 0 && (
                                <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-ink-300" strokeWidth={1.6} />
                              )}
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/45 text-ink-500">
                                <Network className="h-3.5 w-3.5" strokeWidth={1.7} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold text-foreground">{team.name}</span>
                                <span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">
                                  {team.memberCount} member{team.memberCount === 1 ? '' : 's'} · {team.forms} form{team.forms === 1 ? '' : 's'}
                                </span>
                              </span>
                            </span>
                            <span className="ml-3 shrink-0 text-xs font-semibold tabular-nums text-ink-700">
                              {team.submissions} <span className="font-medium text-muted-foreground">response{team.submissions === 1 ? '' : 's'}</span>
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Forms Section */}
          <div className="mb-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight text-foreground">Recent forms</h2>
                <p className="mt-1 text-xs font-medium text-muted-foreground">Your {RECENT_LIMIT} most recently updated forms</p>
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {recentForms.map((form) => (
                    <RecentFormCard
                      key={form.id}
                      form={form}
                      orgSlug={currentOrg?.slug || 'default-org'}
                    />
                  ))}
                </div>

                {/* View all link */}
                {forms.length > RECENT_LIMIT && (
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
