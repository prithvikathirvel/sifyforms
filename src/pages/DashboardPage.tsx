import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchForms, deleteForm } from '../store/formsSlice';
// import { getSession } from '../store/authSlice';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import CreateFormModal from '../components/forms/CreateFormModal';
import { usePermissions, ACTIONS } from '../hooks/usePermissions';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  FileText,
  BarChart3,
  Clock,
  Edit,
  Eye,
  Trash2,
  Inbox,
  Loader2,
  TrendingUp,
  Users,
  Network,
  MoreVertical,
  Copy,
  Share2,
  Settings,
  ArrowRight,
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
    <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
      <CardHeader className="pb-2 sm:pb-3">
        <div className="p-2 sm:p-3 bg-brand-100 rounded-lg w-fit">{icon}</div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground tabular-nums">{value}</div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">{label}</p>
        <p className="text-xs text-muted-foreground/80 mt-0.5">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar onCreateForm={() => setShowCreateModal(true)} />

      <main className="min-w-0 flex-1 overflow-auto bg-gradient-to-br from-ink-50 to-ink-100">
        <PageHeader
          title="Overview"
          description={`${currentOrg?.name || 'Your workspace'} · Forms, submissions, and recent activity`}
          actions={canCreateForm ? (
            <Button onClick={() => setShowCreateModal(true)} className="h-9 rounded-lg px-3.5">
              <FileText className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">Create form</span>
              <span className="sm:hidden">Create</span>
            </Button>
          ) : undefined}
        />
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
            <StatTile
              icon={<FileText className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />}
              value={stats.totalForms}
              label="Forms"
              detail={`${stats.publishedForms} published · ${stats.draftForms} draft`}
            />
            <StatTile
              icon={<Inbox className="h-5 w-5 sm:h-6 sm:w-6 text-brand-500" />}
              value={stats.totalSubmissions}
              label="Submissions"
              detail={`${stats.recentSubmissions} in the last 30 days`}
            />
            <StatTile
              icon={<Users className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />}
              value={stats.totalMembers}
              label="Members"
              detail={stats.totalMembers === 1 ? 'just you so far' : 'in this organization'}
            />
            <StatTile
              icon={<Network className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />}
              value={stats.totalTeams}
              label="Teams"
              detail={stats.totalTeams === 1 ? 'General only' : 'including sub-teams'}
            />
          </div>

          {/* Insights */}
          <div className="grid gap-4 lg:grid-cols-2 mb-6 sm:mb-8">
            <Card className="bg-white border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-brand-600" />
                  Top forms by submissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                        className="w-full text-left space-y-1.5 group"
                      >
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-medium group-hover:text-brand-600 transition-colors">
                            {form.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {form.submissionCount}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="h-4 w-4 text-brand-600" />
                  Activity by team
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.teamBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No teams yet.</p>
                ) : (
                  <div className="space-y-1">
                    {stats.teamBreakdown.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => navigate('/teams')}
                        className="w-full flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted transition-colors text-left"
                        style={{ paddingLeft: `${team.depth * 14 + 8}px` }}
                      >
                        <span className="truncate font-medium">{team.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {team.memberCount} member{team.memberCount === 1 ? '' : 's'} ·{' '}
                          {team.forms} form{team.forms === 1 ? '' : 's'} · {team.submissions} sub
                          {team.submissions === 1 ? '' : 's'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Forms Section */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Recent Forms</h2>
                <p className="text-muted-foreground mt-1">Your {RECENT_LIMIT} most recently updated forms</p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <Button variant="outline" className="border-border w-full sm:w-auto">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
                {canCreateForm && (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-gradient-to-r from-plum-800 to-brand-500 hover:from-plum-900 hover:to-brand-600 text-white w-full sm:w-auto border-0 rounded-full font-medium"
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
                  <Loader2 className="h-12 w-12 animate-spin text-brand-600 mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading your forms...</p>
                </div>
              </div>
            ) : forms.length === 0 ? (
              <Card className="border-0 shadow-xl bg-white">
                <CardContent className="py-16 text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-brand-100 to-brand-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-12 w-12 text-brand-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">No forms yet</h3>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    Create your first form to start collecting responses and analyzing data
                  </p>
                  {canCreateForm && (
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      className="bg-gradient-to-r from-plum-800 to-brand-500 hover:from-plum-900 hover:to-brand-600 text-white px-10 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 border-0 font-medium"
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                  {recentForms.map((form) => (
                    <Card key={form.id} className="group border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-white overflow-hidden flex flex-col">
                      <div className="h-2 bg-gradient-to-r from-plum-800 to-brand-500"></div>

                      <CardHeader className="pb-4 flex-shrink-0">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 mr-2 sm:mr-3 min-w-0">
                            <CardTitle className="text-base sm:text-lg font-bold text-foreground mb-2 line-clamp-2 group-hover:text-brand-600 transition-colors">
                              {form.name}
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                              ID: {form.id.slice(0, 8)}...
                            </CardDescription>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <Badge
                              variant={form.isPublished ? 'success' : 'secondary'}
                              className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                                form.isPublished
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : 'bg-muted text-foreground border-border'
                              }`}
                            >
                              {form.isPublished ? '🟢 Published' : '📝 Draft'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3 sm:space-y-4 flex-1 flex flex-col">
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 flex-shrink-0">
                          <div className="flex items-center space-x-2">
                            <div className="p-1.5 sm:p-2 bg-brand-50 rounded-lg flex-shrink-0">
                              <Inbox className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-base sm:text-lg font-bold text-foreground truncate">
                                {form.submissionCount || 0}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">Submissions</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <div className="p-1.5 sm:p-2 bg-brand-50 rounded-lg flex-shrink-0">
                              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs sm:text-sm font-bold text-foreground truncate">
                                {formatDate(form.updatedAt)}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">Updated</div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 sm:space-y-3 flex-1 flex flex-col justify-end mt-auto">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/forms/${form.id}/edit`)}
                              className="flex-1 border-border hover:border-brand-300 hover:bg-brand-50 transition-colors h-9 text-xs sm:text-sm rounded-full"
                            >
                              <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                              Edit
                            </Button>
                            {form.isPublished && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const orgSlug = currentOrg?.slug || 'default-org';
                                  const BASE_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
                                  window.open(`${BASE_URL}/${orgSlug}/${form.slug}`, '_blank');
                                }}
                                className="flex-1 border-border hover:border-brand-300 hover:bg-brand-50 transition-colors h-9 text-xs sm:text-sm rounded-full"
                              >
                                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                                Preview
                              </Button>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/forms/${form.id}/submissions`)}
                              className="flex-1 border-border hover:border-brand-300 hover:bg-brand-50 transition-colors h-9 text-xs sm:text-sm rounded-full"
                            >
                              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                              Submissions
                            </Button>

                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const orgSlug = currentOrg?.slug || 'default-org';
                                  const BASE_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
                                  navigator.clipboard.writeText(`${BASE_URL}/${orgSlug}/${form.slug}`);
                                }}
                                className="border-border hover:border-brand-300 hover:bg-brand-50 transition-colors h-9 px-2 text-xs sm:text-sm rounded-full"
                                title="Copy link"
                              >
                                <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const orgSlug = currentOrg?.slug || 'default-org';
                                  const BASE_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
                                  window.open(`${BASE_URL}/${orgSlug}/${form.slug}`, '_blank');
                                }}
                                className="border-border hover:border-brand-300 hover:bg-brand-50 transition-colors h-9 px-2 text-xs sm:text-sm rounded-full"
                                title="Share form"
                              >
                                <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete "${form.name}"?`)) {
                                    dispatch(deleteForm(form.id));
                                  }
                                }}
                                className="border-red-200 hover:border-red-300 hover:bg-red-50 transition-colors h-9 px-2 text-xs sm:text-sm rounded-full"
                                title="Delete form"
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* View all link */}
                {forms.length > RECENT_LIMIT && (
                  <div className="mt-6 text-center">
                    <Link to="/forms">
                      <Button variant="outline" className="rounded-full border-border hover:border-brand-300 hover:bg-brand-50 gap-2">
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
