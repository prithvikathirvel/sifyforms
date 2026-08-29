import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AccordionItemProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Renders a small status dot on the right (before the chevron). */
  status?: 'active' | 'configured' | 'empty';
  /** Force this section open (used by the modal inspector's single-section view). */
  active?: boolean;
  /** Hide this section (used by the modal inspector to show one section at a time). */
  inactive?: boolean;
}

export function AccordionItem({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  children,
  className,
  status,
  active,
  inactive,
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (inactive) return null;

  // When `active` is forced open (single-section modal inspector view) we keep
  // the section expanded regardless of local toggle state.
  const open = active ? true : isOpen;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-card shadow-sm transition-colors',
        open ? 'border-border' : 'border-border',
        className
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors',
          'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'bg-muted/30'
        )}
      >
        {icon && (
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
              open ? 'bg-brand-100 text-brand-700' : 'bg-muted text-muted-foreground'
            )}
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-tight text-foreground">
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
        {status === 'configured' && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" title="Configured" />
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
       {open && (
        <div className="border-t border-border bg-background px-3.5 pb-3.5 pt-3">{children}</div>
      )}
    </div>
  );
}

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

export function Accordion({ children, className }: AccordionProps) {
  return <div className={cn('space-y-2', className)}>{children}</div>;
}
