import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  LayoutTemplate,
  Loader2,
  MessageSquareText,
  Search,
  Shapes,
  UsersRound,
  X,
} from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

export interface TemplateSummary {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  type: 'static' | 'organization';
  createdAt?: string;
  createdBy?: string;
  schema?: { fields?: unknown[] };
}

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: TemplateSummary) => void;
}

interface TemplateSelectionContentProps {
  onSelectTemplate: (template: TemplateSummary) => void;
  isSelecting?: boolean;
}

type SourceFilter = 'all' | 'static' | 'organization';

function categoryLabel(category: string) {
  return category
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function CategoryIcon({ category }: { category: string }) {
  const key = category.toLowerCase();
  const Icon = key.includes('event')
    ? CalendarDays
    : key.includes('education') || key.includes('course')
      ? GraduationCap
      : key.includes('business') || key.includes('job') || key.includes('hr')
        ? BriefcaseBusiness
        : key.includes('feedback') || key.includes('contact')
          ? MessageSquareText
          : key.includes('membership') || key.includes('volunteer')
            ? UsersRound
            : Shapes;
  return <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />;
}

export function TemplateSelectionContent({ onSelectTemplate, isSelecting = false }: TemplateSelectionContentProps) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [requestVersion, setRequestVersion] = useState(0);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.get('/templates')
      .then((response) => {
        if (!active) return;
        setTemplates(response.data as TemplateSummary[]);
        setLoadError('');
      })
      .catch(() => {
        if (active) setLoadError('Templates could not be loaded. Check your connection and try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestVersion]);

  const categories = useMemo(
    () => [...new Set(templates.map((template) => template.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
    [templates]
  );

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesSearch = !query ||
        template.name.toLowerCase().includes(query) ||
        (template.description || '').toLowerCase().includes(query) ||
        template.category.toLowerCase().includes(query);
      const matchesSource = sourceFilter === 'all' || template.type === sourceFilter;
      const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
      return matchesSearch && matchesSource && matchesCategory;
    });
  }, [categoryFilter, searchQuery, sourceFilter, templates]);

  const retry = () => {
    setLoading(true);
    setLoadError('');
    setRequestVersion((version) => version + 1);
  };

  return (
    <div className="space-y-3.5">
      <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search templates by name, purpose, or category…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-9 text-[13px] outline-none placeholder:text-muted-foreground focus:border-primary/35 focus:ring-2 focus:ring-primary/10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear template search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex rounded-lg border border-border bg-ink-50/70 p-1" aria-label="Template source">
          {([
            ['all', 'All'],
            ['static', 'System'],
            ['organization', 'My templates'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSourceFilter(value)}
              className={cn(
                'h-8 rounded-md px-3 text-[11px] font-semibold transition-colors',
                sourceFilter === value
                  ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {categories.length > 1 && (
        <div className="scrollbar-compact flex gap-1.5 overflow-x-auto pb-1.5" aria-label="Template categories">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors',
              categoryFilter === 'all'
                ? 'border-primary/20 bg-primary/[0.055] text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-ink-300 hover:text-foreground'
            )}
          >
            All categories
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setCategoryFilter(category)}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors',
                categoryFilter === category
                  ? 'border-primary/20 bg-primary/[0.055] text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-ink-300 hover:text-foreground'
              )}
            >
              {categoryLabel(category)}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-ink-50/60 px-3.5 py-2.5">
          <div>
            <h3 className="font-display text-xs font-bold text-foreground">Available templates</h3>
            <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
              {loading ? 'Loading templates…' : `${filteredTemplates.length} of ${templates.length} shown`}
            </p>
          </div>
          <LayoutTemplate className="h-4 w-4 text-ink-400" strokeWidth={1.7} />
        </div>

        {loading ? (
          <div className="divide-y divide-border/60">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex animate-pulse items-center gap-3 p-3.5">
                <div className="h-10 w-10 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-muted" />
                  <div className="h-2.5 w-2/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="px-5 py-10 text-center">
            <p className="text-xs font-semibold text-foreground">Unable to load templates</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={retry} className="mt-4">Try again</Button>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Search className="mx-auto h-5 w-5 text-ink-300" />
            <p className="mt-2 text-xs font-semibold text-foreground">No templates match these filters</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSourceFilter('all');
                setCategoryFilter('all');
              }}
              className="mt-2 text-[11px] font-semibold text-primary hover:underline"
            >
              Clear search and filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredTemplates.map((template) => {
              const fieldCount = template.schema?.fields?.length;
              return (
                <button
                  key={template.id}
                  type="button"
                  disabled={isSelecting}
                  onClick={() => {
                    setSelectingId(template.id);
                    onSelectTemplate(template);
                  }}
                  className="group flex w-full min-w-0 items-center gap-3 p-3.5 text-left transition-colors hover:bg-ink-50/75 disabled:pointer-events-none disabled:opacity-60 sm:px-4"
                >
                  <span className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                    template.type === 'organization'
                      ? 'border-primary/10 bg-primary/[0.055] text-primary'
                      : 'border-border bg-ink-50 text-ink-600'
                  )}>
                    <CategoryIcon category={template.category} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="truncate font-display text-[13px] font-bold text-foreground transition-colors group-hover:text-primary">
                        {template.name}
                      </span>
                      <span className={cn(
                        'shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider',
                        template.type === 'organization'
                          ? 'border-primary/15 bg-primary/[0.04] text-primary'
                          : 'border-border bg-card text-muted-foreground'
                      )}>
                        {template.type === 'organization' ? 'My template' : 'System'}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">
                      {template.description || 'Reusable form template'}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold text-muted-foreground">
                      <span className="rounded border border-border bg-card px-1.5 py-0.5">{categoryLabel(template.category || 'General')}</span>
                      {typeof fieldCount === 'number' && (
                        <span>{fieldCount} field{fieldCount === 1 ? '' : 's'}</span>
                      )}
                    </span>
                  </span>

                  {template.createdAt && (
                    <span className="hidden shrink-0 text-right md:block">
                      <span className="flex items-center justify-end gap-1 text-[9px] font-medium text-muted-foreground">
                        <CalendarDays className="h-3 w-3" /> Created
                      </span>
                      <span className="mt-1 block text-[10px] font-semibold tabular-nums text-ink-600">
                        {new Date(template.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </span>
                  )}

                  {isSelecting && selectingId === template.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function TemplateSelectionModal({ isOpen, onClose, onSelectTemplate }: TemplateSelectionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90dvh] max-w-5xl flex-col overflow-hidden rounded-2xl border-border bg-card p-0" onClose={onClose}>
        <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4 pr-14 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/10 bg-primary/[0.06] text-primary">
              <Building2 className="h-[18px] w-[18px]" />
            </span>
            <div>
              <DialogTitle className="font-display text-lg font-bold">Choose a template</DialogTitle>
              <DialogDescription className="mt-1 text-xs font-medium">Start with a reusable form and customize it in the builder.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <TemplateSelectionContent onSelectTemplate={(template) => {
            onSelectTemplate(template);
            onClose();
          }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TemplateSelectionModal;
