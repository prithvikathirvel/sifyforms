import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchForms } from '../store/formsSlice';
import { usePermissions, ACTIONS } from '../hooks/usePermissions';
import { fetchTeams } from '../store/teamsSlice';
import type { TeamNode } from '../types';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import CreateFormModal from '../components/forms/CreateFormModal';
import FormCard from '../components/forms/FormCard';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Loader2,
  Search,
  Users,
  X,
} from 'lucide-react';

type StatusFilter = 'all' | 'published' | 'draft';
type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'submissions';

const PAGE_SIZE = 12;

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

function flattenTeams(nodes: TeamNode[], map = new Map<string, string>(), prefix = '') {
  nodes.forEach((team) => {
    map.set(team.id, prefix ? `${prefix} / ${team.name}` : team.name);
    flattenTeams(team.children, map, prefix ? `${prefix} / ${team.name}` : team.name);
  });
  return map;
}

export default function FormsListPage() {
  const dispatch = useAppDispatch();
  const { currentOrg } = useAppSelector((state) => state.org);
  const { forms, isLoading } = useAppSelector((state) => state.forms);
  const teamTree = useAppSelector((state) => state.teams.tree);
  const { can } = usePermissions();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    dispatch(fetchForms());
  }, [dispatch]);

  useEffect(() => {
    if (currentOrg?.id) dispatch(fetchTeams(currentOrg.id));
  }, [dispatch, currentOrg?.id]);

  const teamsById = useMemo(() => flattenTeams(teamTree), [teamTree]);

  const filteredForms = useMemo(() => {
    let result = [...forms];
    const query = searchQuery.trim().toLowerCase();

    if (query) {
      result = result.filter(
        (form) =>
          form.name.toLowerCase().includes(query) ||
          (form.description || '').toLowerCase().includes(query)
      );
    }

    if (statusFilter === 'published') result = result.filter((form) => form.isPublished);
    if (statusFilter === 'draft') result = result.filter((form) => !form.isPublished);
    if (teamFilter !== 'all') result = result.filter((form) => form.teamId === teamFilter);

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
  const publishedCount = forms.filter((form) => form.isPublished).length;
  const draftCount = forms.length - publishedCount;
  const totalResponses = forms.reduce((total, form) => total + (form.submissionCount || 0), 0);
  const hasFilters = Boolean(searchQuery || statusFilter !== 'all' || teamFilter !== 'all');

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTeamFilter('all');
    setCurrentPage(1);
  };

  if (!currentOrg) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar onCreateForm={() => setShowCreateModal(true)} />

      <main className="min-w-0 flex-1 overflow-y-auto bg-muted/20">
        <PageHeader
          title="Forms"
          description={isLoading
            ? 'Loading your forms…'
            : `${formatNumber(filteredForms.length)} of ${formatNumber(forms.length)} form${forms.length !== 1 ? 's' : ''} in ${currentOrg.name}`}
          actions={can(ACTIONS.CREATE_FORM) ? (
            <Button onClick={() => setShowCreateModal(true)} className="h-9 rounded-lg px-3.5">
              <FileText className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">Create form</span>
              <span className="sm:hidden">Create</span>
            </Button>
          ) : undefined}
        />

        <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <section className="mb-6">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Form library</p>
                <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Build, share, and learn</h2>
                <p className="mt-1 max-w-xl text-sm font-medium text-muted-foreground">
                  Keep every collection point organized and easy to pick up again.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span className="rounded-full border border-border bg-card px-3 py-1.5">
                  {formatNumber(totalResponses)} responses
                </span>
                <span className="rounded-full border border-border bg-card px-3 py-1.5">
                  {formatNumber(teamsById.size)} {teamsById.size === 1 ? 'team' : 'teams'}
                </span>
              </div>
            </div>

            <Card className="rounded-2xl border-border/80 bg-card shadow-[0_8px_28px_hsl(var(--foreground)/0.03)]">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
                    <input
                      type="search"
                      placeholder="Search by form name or description"
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setCurrentPage(1);
                      }}
                      className="h-11 w-full rounded-xl border border-border bg-muted/20 pl-10 pr-10 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/35 focus:bg-background focus:ring-2 focus:ring-ring/20"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => {
                          setSearchQuery('');
                          setCurrentPage(1);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2 overflow-x-auto rounded-xl border border-border bg-muted/25 p-1" role="tablist" aria-label="Filter forms by status">
                    {([
                      ['all', 'All', forms.length],
                      ['published', 'Published', publishedCount],
                      ['draft', 'Drafts', draftCount],
                    ] as const).map(([value, label, count]) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={statusFilter === value}
                        onClick={() => handleStatusChange(value)}
                        className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-colors ${statusFilter === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {label}
                        <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {teamsById.size > 0 && (
                      <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Users className="h-3.5 w-3.5 text-ink-400" strokeWidth={1.8} />
                        <span className="sr-only">Filter by team</span>
                        <select
                          value={teamFilter}
                          onChange={(event) => {
                            setTeamFilter(event.target.value);
                            setCurrentPage(1);
                          }}
                          className="h-9 max-w-[16rem] rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none transition-colors focus:border-primary/35 focus:ring-2 focus:ring-ring/20"
                        >
                          <option value="all">All teams</option>
                          {[...teamsById.entries()].map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Filter className="h-3.5 w-3.5 text-ink-400" strokeWidth={1.8} />
                      <span className="sr-only">Sort forms</span>
                      <select
                        value={sortOption}
                        onChange={(event) => {
                          setSortOption(event.target.value as SortOption);
                          setCurrentPage(1);
                        }}
                        className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none transition-colors focus:border-primary/35 focus:ring-2 focus:ring-ring/20"
                      >
                        <option value="newest">Recently updated</option>
                        <option value="oldest">Oldest updated</option>
                        <option value="name_asc">Name A–Z</option>
                        <option value="name_desc">Name Z–A</option>
                        <option value="submissions">Most responses</option>
                      </select>
                    </label>
                  </div>

                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 self-start px-2 text-xs font-semibold text-primary hover:bg-primary/[0.06] hover:text-primary sm:self-auto">
                      Clear filters
                      <X className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {isLoading ? (
            <div className="flex items-center justify-center py-28">
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
                <h3 className="font-display text-xl font-bold text-foreground">Start with your first form</h3>
                <p className="mx-auto mb-7 mt-2 max-w-md text-sm font-medium text-muted-foreground">
                  Turn a question, workflow, or application into a polished collection experience.
                </p>
                {can(ACTIONS.CREATE_FORM) && (
                  <Button onClick={() => setShowCreateModal(true)} className="h-10 rounded-lg px-5">
                    <FileText className="mr-2 h-4 w-4" strokeWidth={1.9} />
                    Create your first form
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : filteredForms.length === 0 ? (
            <Card className="rounded-2xl border-border bg-card shadow-none">
              <CardContent className="py-14 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Search className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground">No forms match these filters</h3>
                <p className="mb-5 mt-1 text-sm font-medium text-muted-foreground">Try another search or reset the filters.</p>
                <Button variant="outline" size="sm" className="rounded-lg" onClick={clearFilters}>
                  Reset filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {paginatedForms.map((form) => (
                  <FormCard
                    key={form.id}
                    form={form}
                    orgSlug={currentOrg.slug || 'default-org'}
                    teamName={form.teamId ? teamsById.get(form.teamId) : null}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-7 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Page {safePage} of {totalPages} · {formatNumber(filteredForms.length)} forms
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={safePage === 1}
                      onClick={() => setCurrentPage(safePage - 1)}
                      className="h-8 w-8 rounded-lg"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1)
                      .filter((page) => page === 1 || page === totalPages || Math.abs(page - safePage) <= 1)
                      .reduce<(number | '...')[]>((pages, page, index, visiblePages) => {
                        if (index > 0 && (visiblePages[index - 1] as number) + 1 < page) pages.push('...');
                        pages.push(page);
                        return pages;
                      }, [])
                      .map((page, index) => page === '...' ? (
                        <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">…</span>
                      ) : (
                        <Button
                          key={page}
                          variant={page === safePage ? 'default' : 'outline'}
                          size="icon"
                          onClick={() => setCurrentPage(page as number)}
                          className="h-8 w-8 rounded-lg text-xs"
                          aria-label={`Go to page ${page}`}
                        >
                          {page}
                        </Button>
                      ))}
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={safePage === totalPages}
                      onClick={() => setCurrentPage(safePage + 1)}
                      className="h-8 w-8 rounded-lg"
                      aria-label="Next page"
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
