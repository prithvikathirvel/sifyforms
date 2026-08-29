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
}

export function AccordionItem({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  children,
  className,
  status,
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-card shadow-sm transition-colors',
        isOpen ? 'border-border' : 'border-border',
        className
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors',
          'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isOpen && 'bg-muted/30'
        )}
      >
        {icon && (
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
              isOpen ? 'bg-brand-100 text-brand-700' : 'bg-muted text-muted-foreground'
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
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && (
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
