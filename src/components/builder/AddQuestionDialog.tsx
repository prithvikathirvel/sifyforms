import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { TYPE_FRIENDLY, TYPE_GROUPS, TYPE_ICONS, TYPE_SURVEY_GROUP } from './formSetup';
import type { FormField } from '../../types';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * The "Add a question" picker.
 *
 * The same question catalogue the type switcher offers, as a modal: grouped,
 * searchable, one click adds the question. (The footer type dropdown stays the
 * way to change an existing question.)
 */
export default function AddQuestionDialog({
  open,
  onOpenChange,
  onPick,
  formType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (type: FormField['type']) => void;
  formType?: string;
}) {
  const [query, setQuery] = useState('');
  // Fresh search every time the picker opens. Reset in render on the open
  // transition, not in an effect, so no cascading render is triggered.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery('');
  }

  const groups = useMemo(() => {
    const base = formType === 'survey'
      ? [TYPE_SURVEY_GROUP, ...TYPE_GROUPS]
      : TYPE_GROUPS;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base
      .map((g) => ({ ...g, types: g.types.filter((t) => (TYPE_FRIENDLY[t] ?? t).toLowerCase().includes(q)) }))
      .filter((g) => g.types.length > 0);
  }, [query, formType]);

  const totalMatches = groups.reduce((n, g) => n + g.types.length, 0);

  const pick = (type: FormField['type']) => {
    onOpenChange(false);
    onPick(type);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card p-0 shadow-2xl"
        onClose={() => onOpenChange(false)}
      >
        <DialogHeader className="border-b border-border/70 px-5 py-4 pr-12">
          <DialogTitle className="text-[15px] font-semibold text-foreground">Add a question</DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-2.5 transition-colors focus-within:border-primary">
            <Search className="h-4 w-4 flex-none text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && groups[0]?.types[0]) pick(groups[0].types[0]);
              }}
              placeholder="Search question types…"
              aria-label="Search question types"
              className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="grid h-5 w-5 flex-none place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-3 scrollbar-subtle">
          {totalMatches === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">
              No question type matches &ldquo;{query}&rdquo;.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-1 last:mb-0">
                <p className="px-2 pb-1 pt-1.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-400">
                  {group.label}
                </p>
                <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                  {group.types.map((t) => {
                    const Icon = TYPE_ICONS[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => pick(t)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left text-[13px] font-medium text-foreground',
                          'transition-colors hover:border-border hover:bg-accent'
                        )}
                      >
                        {Icon && <Icon className="h-4 w-4 flex-none text-ink-400" strokeWidth={1.7} />}
                        <span className="truncate">{TYPE_FRIENDLY[t] ?? t}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
