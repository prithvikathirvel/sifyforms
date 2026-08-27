import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchForms, deleteForm } from '../store/formsSlice';
import { getSession } from '../store/authSlice';
import { usePermissions, ACTIONS } from '../hooks/usePermissions';
import { fetchTeams } from '../store/teamsSlice';
import type { TeamNode } from '../types';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import CreateFormModal from '../components/forms/CreateFormModal';
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
  MoreVertical,
  Copy,
  Share2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Users,
} from 'lucide-react';

type StatusFilter = 'all' | 'published' | 'draft';
type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'submissions';

const PAGE_SIZE = 12;

export default function FormsListPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentOrg } = useAppSelector((state) => state.org);
  const { forms, isLoading } = useAppSelector((state) => state.forms);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const teamTree = useAppSelector((state) => state.teams.tree);
  const { can } = usePermissions();

  useEffect(() => {
    dispatch(getSession());
    dispatch(fetchForms());
  }, [dispatch]);

  useEffect(() => {
    if (currentOrg?.id) dispatch(fetchTeams(currentOrg.id));
  }, [dispatch, currentOrg?.id]);

  // Flat list of every team, so a form can name its owner and the filter can
  // offer the whole tree.
  const teamsById = useMemo(() => {
    const map = new Map<string, string>();
    (function walk(nodes: TeamNode[]) {
      nodes.forEach((t) => {
        map.set(t.id, t.name);
        walk(t.children);
      });
    })(teamTree);
    return map;
  }, [teamTree]);

  const filteredForms = useMemo(() => {
    let result = [...forms];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.description || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter === 'published') result = result.filter((f) => f.isPublished);
    else if (statusFilter === 'draft') result = result.filter((f) => !f.isPublished);

    if (teamFilter !== 'all') result = result.filter((f) => f.teamId === teamFilter);

    result.sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'oldest':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'submissions':
          return (b.submissionCount || 0) - (a.submissionCount || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [forms, searchQuery, statusFilter, teamFilter, sortOption]);

  const totalPages = Math.max(1, Math.ceil(filteredForms.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedForms = filteredForms.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleSortChange = (value: SortOption) => {
    setSortOption(value);
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar onCreateForm={() => setShowCreateModal(true)} />

      <main className="min-w-0 flex-1 overflow-auto bg-muted/20">
        <PageHeader
          title="Forms"
          description={isLoading
            ? 'Loading your forms…'
            : `${filteredForms.length} of ${forms.length} form${forms.length !== 1 ? 's' : ''} in ${currentOrg.name}`}
          actions={can(ACTIONS.CREATE_FORM) ? (
            <Button onClick={() => setShowCreateModal(true)} className="h-9 rounded-lg px-3.5">
              <FileText className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">Create form</span>
              <span className="sm:hidden">Create</span>
            </Button>
          ) : undefined}
        />
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Search / Filter / Sort bar */}
          {!isLoading && forms.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search forms…"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-full bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status filter */}
              <div className="relative">
                <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
                  className="appearance-none pl-9 pr-8 py-2 text-sm border border-border rounded-full bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 cursor-pointer transition-all"
                >
                  <option value="all">All Status</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              {/* Team filter */}
              {teamsById.size > 1 && (
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <select
                    value={teamFilter}
                    onChange={(e) => {
                      setTeamFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="appearance-none pl-9 pr-8 py-2 text-sm border border-border rounded-full bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 cursor-pointer transition-all"
                  >
                    <option value="all">All Teams</option>
                    {[...teamsById.entries()].map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortOption}
                  onChange={(e) => handleSortChange(e.target.value as SortOption)}
                  className="appearance-none pl-4 pr-8 py-2 text-sm border border-border rounded-full bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 cursor-pointer transition-all"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name_asc">Name A–Z</option>
                  <option value="name_desc">Name Z–A</option>
                  <option value="submissions">Most Submissions</option>
                </select>
              </div>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-32">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-brand-600 mx-auto mb-4" />
                <p className="text-muted-foreground">Loading your forms...</p>
              </div>
            </div>
          ) : forms.length === 0 ? (
            <Card className="border-0 shadow-xl bg-white">
              <CardContent className="py-20 text-center">
                <div className="w-24 h-24 bg-primary/[0.07] rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText className="h-12 w-12 text-brand-600" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">No forms yet</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Create your first form to start collecting responses and analyzing data
                </p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-10 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 border-0 font-medium"
                  size="lg"
                >
                  <FileText className="h-5 w-5 mr-2" />
                  Create Your First Form
                </Button>
              </CardContent>
            </Card>
          ) : filteredForms.length === 0 ? (
            <Card className="border-0 shadow-lg bg-white">
              <CardContent className="py-12 text-center">
                <Search className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">No forms match your search</h3>
                <p className="text-muted-foreground text-sm mb-4">Try a different keyword or clear the filters</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => { handleSearchChange(''); handleStatusChange('all'); }}
                >
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                {paginatedForms.map((form) => (
                  <Card key={form.id} className="group border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-white overflow-hidden flex flex-col">
                    <div className="h-1 bg-primary"></div>

                    <CardHeader className="pb-4 flex-shrink-0">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 mr-2 sm:mr-3 min-w-0">
                          <CardTitle className="text-base sm:text-lg font-bold text-foreground mb-2 line-clamp-2 group-hover:text-brand-600 transition-colors">
                            {form.name}
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Users className="h-3 w-3 shrink-0" />
                            {form.teamId ? teamsById.get(form.teamId) ?? 'Unknown team' : 'No team'}
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
                      {/* Stats Row */}
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

                      {/* Action Buttons */}
                      <div className="space-y-2 sm:space-y-3 flex-1 flex flex-col justify-end mt-auto">
                        <div className="flex flex-col sm:flex-row gap-2">
                          {form.access?.canEdit !== false && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/forms/${form.id}/edit`)}
                              className="flex-1 border-border hover:border-brand-300 hover:bg-brand-50 transition-colors h-9 text-xs sm:text-sm rounded-full"
                            >
                              <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                              Edit
                            </Button>
                          )}
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
                          {(form.access?.canViewResponses !== false || form.access?.canViewResults) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/forms/${form.id}/submissions`)}
                              className="flex-1 border-border hover:border-brand-300 hover:bg-brand-50 transition-colors h-9 text-xs sm:text-sm rounded-full"
                            >
                              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                              {form.access && !form.access.canViewResponses ? 'Results' : 'Submissions'}
                            </Button>
                          )}

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

                            {form.access?.canDelete !== false && (
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
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Page {safePage} of {totalPages} &middot; {filteredForms.length} forms
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage === 1}
                      onClick={() => setCurrentPage(safePage - 1)}
                      className="rounded-full h-8 w-8 p-0 border-border"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                      .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                        if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
                        p === '...' ? (
                          <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm">…</span>
                        ) : (
                          <Button
                            key={p}
                            variant={p === safePage ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(p as number)}
                            className={`rounded-full h-8 w-8 p-0 text-xs ${
                              p === safePage
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border'
                            }`}
                          >
                            {p}
                          </Button>
                        )
                      )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage === totalPages}
                      onClick={() => setCurrentPage(safePage + 1)}
                      className="rounded-full h-8 w-8 p-0 border-border"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <CreateFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
