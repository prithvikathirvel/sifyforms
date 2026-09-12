import { useEffect, useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchForms } from '../store/formsSlice';
import { getSession } from '../store/authSlice';
import { usePermissions, ACTIONS } from '../hooks/usePermissions';
import { fetchTeams } from '../store/teamsSlice';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import CreateFormModal from '../components/forms/CreateFormModal';
import FormWorkspaceCard from '../components/forms/FormWorkspaceCard';
import FormWorkspaceTable from '../components/forms/FormWorkspaceTable';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { DropdownSelect, type DropdownSelectOption } from '../components/ui/dropdown-select';
import { Pagination } from '../components/ui/pagination';
import { ViewToggle, type CollectionViewMode } from '../components/ui/view-toggle';
import {
  FileText,
  Loader2,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';

type StatusFilter = 'all' | 'published' | 'draft';
type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'submissions';

const PAGE_SIZE = 10;
const STATUS_OPTIONS: DropdownSelectOption<StatusFilter>[] = [
  { value: 'all', label: 'All status' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
];
const SORT_OPTIONS: DropdownSelectOption<SortOption>[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'submissions', label: 'Most submissions' },
];

export default function FormsListPage() {
  const dispatch = useAppDispatch();
  const { currentOrg } = useAppSelector((state) => state.org);
  const { forms, isLoading } = useAppSelector((state) => state.forms);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<CollectionViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);

  const teams = useAppSelector((state) => state.teams.teams);
  // Until the permission set has landed `can()` answers false for everything;
  // waiting avoids flashing the viewer's copy at someone who can create forms.
  const { can, isLoading: permissionsLoading } = usePermissions();
  const canCreateForm = can(ACTIONS.CREATE_FORM);

  useEffect(() => {
    if (!currentOrg?.id) return;
    dispatch(getSession());
    dispatch(fetchForms());
    setCurrentPage(1);
    setTeamFilter('all');
  }, [dispatch, currentOrg?.id]);

  useEffect(() => {
    if (currentOrg?.id) dispatch(fetchTeams(currentOrg.id));
  }, [dispatch, currentOrg?.id]);

  // Hierarchical handling: flatten tree and build path map for display
  const { teamsById, teamsByIdPath, descendantMap } = useMemo(() => {
    const nameMap = new Map<string, string>();
    const pathMap = new Map<string, string>();
    const descMap = new Map<string, Set<string>>();

    function flattenWithPath(list: typeof teams, parentPath: string[] = []): void {
      for (const t of list) {
        nameMap.set(t.id, t.name);
        const path = [...parentPath, t.name].join(' > ');
        pathMap.set(t.id, path);
        if (t.children) flattenWithPath(t.children, [...parentPath, t.name]);
      }
    }

    // If teams are tree (have children), use tree walk, else flat
    const hasTree = teams.some((t) => t.children && t.children.length > 0);
    if (hasTree) {
      flattenWithPath(teams);
    } else {
      // Flat list with parentId — need to build tree to get paths
      const flatList = teams as any[];
      const byId = new Map<string, any>();
      flatList.forEach((t) => byId.set(t.id, { ...t, children: [] }));
      const roots: any[] = [];
      flatList.forEach((t) => {
        if (t.parentId && byId.has(t.parentId)) {
          byId.get(t.parentId).children.push(byId.get(t.id));
        } else {
          roots.push(byId.get(t.id));
        }
      });
      flattenWithPath(roots);
    }

    // Build descendant map for Option B filtering: filtering by parent includes children forms
    function buildDescendants(list: typeof teams) {
      const allFlat: any[] = [];
      function collect(nodes: any[]) {
        for (const n of nodes) {
          allFlat.push(n);
          if (n.children) collect(n.children);
        }
      }
      collect(list as any);

      // For each team, find all descendants
      for (const team of allFlat) {
        const descendants = new Set<string>();
        function walkDescendants(node: any) {
          if (node.children) {
            for (const child of node.children) {
              descendants.add(child.id);
              walkDescendants(child);
            }
          }
        }
        walkDescendants(team);
        descMap.set(team.id, descendants);
      }
    }

    buildDescendants(teams);

    return { teamsById: nameMap, teamsByIdPath: pathMap, descendantMap: descMap };
  }, [teams]);

  const teamOptions = useMemo<DropdownSelectOption<string>[]>(() => {
    const entries = [...teamsByIdPath.entries()].map(([value, label]) => ({ value, label }));
    // Sort by label (path) for hierarchical display
    entries.sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: 'all', label: 'All teams' }, ...entries];
  }, [teamsByIdPath]);

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

    if (teamFilter !== 'all') {
      // Option B: filtering by parent team includes its sub-teams forms
      const descendants = descendantMap.get(teamFilter);
      if (descendants && descendants.size > 0) {
        result = result.filter((f) => f.teamId === teamFilter || (f.teamId && descendants.has(f.teamId)));
      } else {
        result = result.filter((f) => f.teamId === teamFilter);
      }
    }

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
    <div className="app-shell flex h-screen bg-workspace">
      <Sidebar onCreateForm={() => setShowCreateModal(true)} />

      <main className="min-w-0 flex-1 overflow-y-auto bg-workspace">
        <PageHeader
          title="Forms"
          description={isLoading
            ? 'Loading your forms…'
            : `${filteredForms.length} of ${forms.length} form${forms.length !== 1 ? 's' : ''} in ${currentOrg.name}`}
          actions={canCreateForm ? (
            <Button onClick={() => setShowCreateModal(true)} className="h-9 rounded-lg px-3.5">
              <FileText className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">Create form</span>
              <span className="sm:hidden">Create</span>
            </Button>
          ) : undefined}
        />
        <div className="p-4 sm:p-5 lg:p-6">
          {/* Search, filters, sort, and view controls */}
          {!isLoading && forms.length > 0 && (
            <div className="mb-5 flex flex-col gap-2.5 lg:flex-row lg:items-start">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  aria-label="Search forms"
                  placeholder="Search forms…"
                  value={searchQuery}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-8 text-[12px] shadow-none outline-none transition-colors placeholder:text-muted-foreground focus:border-ink-400 focus:ring-4 focus:ring-primary/[0.06]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange('')}
                    aria-label="Clear form search"
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                <DropdownSelect
                  value={statusFilter}
                  options={STATUS_OPTIONS}
                  onValueChange={handleStatusChange}
                  ariaLabel="Filter forms by status"
                  icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                  className="w-full sm:w-36"
                />

                {teamsById.size > 1 && (
                  <DropdownSelect
                    value={teamFilter}
                    options={teamOptions}
                    onValueChange={(value) => {
                      setTeamFilter(value);
                      setCurrentPage(1);
                    }}
                    ariaLabel="Filter forms by team"
                    icon={<Users className="h-3.5 w-3.5" />}
                    className="w-full sm:w-40"
                  />
                )}

                <DropdownSelect
                  value={sortOption}
                  options={SORT_OPTIONS}
                  onValueChange={handleSortChange}
                  ariaLabel="Sort forms"
                  className="w-full sm:w-40"
                  align="right"
                />

                <ViewToggle
                  value={viewMode}
                  onValueChange={setViewMode}
                  className="col-span-2 justify-self-end sm:col-auto"
                />
              </div>
            </div>
          )}

          {/* Content */}
          {isLoading || permissionsLoading ? (
            <div className="flex items-center justify-center py-32">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading your forms...</p>
              </div>
            </div>
          ) : forms.length === 0 ? (
            <Card className="rounded-2xl border-border/80 bg-card shadow-sm">
              <CardContent className="flex flex-col items-center px-6 py-16 text-center sm:py-20">
                <div className="relative mb-6">
                  <div className="absolute -inset-3 rounded-[20px] bg-primary/[0.04] blur-[1px]" />
                  <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-border bg-gradient-to-b from-card to-muted/40 shadow-sm">
                    <FileText className="h-8 w-8 text-ink-700" strokeWidth={1.6} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                </div>
                <h3 className="font-display text-[17px] font-bold tracking-tight text-foreground">
                  {canCreateForm ? 'No forms yet' : 'No forms shared with you yet'}
                </h3>
                <p className="mx-auto mt-2 max-w-[360px] text-[13px] font-medium leading-[1.6] text-muted-foreground">
                  {canCreateForm
                    ? 'Create your first form to start collecting responses and analysing data.'
                    : 'Your role can view forms in this organization. Once a teammate shares one, it will appear here.'}
                </p>
                {canCreateForm && (
                  <div className="mt-7 flex flex-col items-center gap-3">
                    <Button onClick={() => setShowCreateModal(true)} className="h-10 rounded-xl px-5 text-[13px] font-semibold shadow-sm">
                      <FileText className="mr-2 h-4 w-4" strokeWidth={1.9} />
                      Create your first form
                    </Button>
                    <p className="text-[11px] font-medium text-muted-foreground">Takes less than a minute</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : filteredForms.length === 0 ? (
            <Card className="rounded-xl border-border bg-card shadow-none">
              <CardContent className="py-12 text-center">
                <Search className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">No forms match your search</h3>
                <p className="text-muted-foreground text-sm mb-4">Try a different keyword or clear the filters</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => { handleSearchChange(''); handleStatusChange('all'); }}
                >
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {paginatedForms.map((form) => (
                    <FormWorkspaceCard
                      key={form.id}
                      form={form}
                      orgSlug={currentOrg.slug || 'default-org'}
                      teamName={form.teamId ? teamsByIdPath.get(form.teamId) ?? teamsById.get(form.teamId) ?? 'Unknown team' : 'No team'}
                    />
                  ))}
                </div>
              ) : (
                <FormWorkspaceTable
                  forms={paginatedForms}
                  orgSlug={currentOrg.slug || 'default-org'}
                  getTeamName={(form) => form.teamId ? teamsByIdPath.get(form.teamId) ?? teamsById.get(form.teamId) ?? 'Unknown team' : 'No team'}
                />
              )}

              <Pagination
                page={safePage}
                totalPages={totalPages}
                totalItems={filteredForms.length}
                itemLabel="forms"
                onPageChange={setCurrentPage}
                className="mt-6"
              />
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
