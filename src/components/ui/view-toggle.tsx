import { Grid2X2, List } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Tooltip } from './tooltip';

export type CollectionViewMode = 'grid' | 'list';

interface ViewToggleProps {
  value: CollectionViewMode;
  onValueChange: (value: CollectionViewMode) => void;
  className?: string;
}

/** Shared compact Grid/List control for collection pages. */
export function ViewToggle({ value, onValueChange, className }: ViewToggleProps) {
  return (
    <div className={cn('flex h-9 items-center rounded-lg border border-border bg-card p-1', className)} role="group" aria-label="View layout">
      <Tooltip content="Grid view" side="top" tone="dark" delay="short">
        <button
          type="button"
          onClick={() => onValueChange('grid')}
          aria-label="Show grid view"
          aria-pressed={value === 'grid'}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-semibold transition-colors',
            value === 'grid'
              ? 'bg-primary/[0.07] text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Grid2X2 className="h-3.5 w-3.5" strokeWidth={1.8} />
          Grid
        </button>
      </Tooltip>
      <Tooltip content="List view" side="top" tone="light" delay="short">
        <button
          type="button"
          onClick={() => onValueChange('list')}
          aria-label="Show list view"
          aria-pressed={value === 'list'}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-semibold transition-colors',
            value === 'list'
              ? 'bg-primary/[0.07] text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <List className="h-3.5 w-3.5" strokeWidth={1.8} />
          List
        </button>
      </Tooltip>
    </div>
  );
}

export default ViewToggle;
