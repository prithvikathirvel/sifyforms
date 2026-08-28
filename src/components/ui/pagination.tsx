import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Tooltip } from './tooltip';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  className?: string;
}

function visiblePages(page: number, totalPages: number): Array<number | 'ellipsis'> {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((candidate) => candidate === 1 || candidate === totalPages || Math.abs(candidate - page) <= 1);

  return pages.reduce<Array<number | 'ellipsis'>>((result, candidate, index) => {
    if (index > 0 && (pages[index - 1] ?? 0) + 1 < candidate) result.push('ellipsis');
    result.push(candidate);
    return result;
  }, []);
}

/** Shared compact pagination for cards, tables, and other collections. */
export function Pagination({
  page,
  totalPages,
  totalItems,
  itemLabel = 'items',
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = visiblePages(page, totalPages);

  return (
    <nav aria-label={`${itemLabel} pagination`} className={cn('flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-[11px] font-medium text-muted-foreground">
        Page <span className="font-semibold text-foreground">{page}</span> of {totalPages}
        {typeof totalItems === 'number' && <> · {totalItems} {itemLabel}</>}
      </p>
      <div className="flex items-center gap-1">
        <Tooltip content="Previous page" side="top" tone="dark">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
            className="h-8 w-8 rounded-lg border-border p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Tooltip>

        {pages.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="flex h-8 w-7 items-center justify-center text-xs text-muted-foreground">…</span>
          ) : (
            <Button
              key={item}
              type="button"
              variant={item === page ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(item)}
              aria-label={`Go to page ${item}`}
              aria-current={item === page ? 'page' : undefined}
              className={cn('h-8 w-8 rounded-lg p-0 text-[11px]', item !== page && 'border-border')}
            >
              {item}
            </Button>
          )
        )}

        <Tooltip content="Next page" side="top" tone="dark">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
            className="h-8 w-8 rounded-lg border-border p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>
    </nav>
  );
}

export default Pagination;
