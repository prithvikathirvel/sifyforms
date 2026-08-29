import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AccordionItemProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function AccordionItem({ title, subtitle, icon, defaultOpen = false, children, className }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm', className)}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 bg-card px-3.5 py-3 text-left transition-colors hover:bg-muted/45"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <div className="shrink-0 text-muted-foreground">{icon}</div>}
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-foreground">{title}</div>
            {subtitle && <div className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">{subtitle}</div>}
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground" aria-hidden="true">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-border/70 bg-muted/25 px-3.5 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

export function Accordion({ children, className }: AccordionProps) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {children}
    </div>
  );
}
