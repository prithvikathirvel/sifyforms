import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}

/** Compact application header shared by every sidebar destination. */
export function PageHeader({ icon: Icon, title, description, actions }: PageHeaderProps) {
  return (
    <header className="shrink-0 border-b border-border/70 bg-card">
      <div className="flex min-h-16 w-full items-stretch">
        <div className="flex w-14 shrink-0 items-center justify-center border-r border-border/70 sm:w-16">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/15">
            <Icon className="h-4 w-4" strokeWidth={1.9} />
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 sm:px-5 lg:px-6">
          <div className="min-w-0">
            <h1 className="truncate font-display text-[15px] font-bold leading-5 tracking-tight text-foreground sm:text-base">
              {title}
            </h1>
            <div className="mt-0.5 truncate text-[11px] font-medium leading-4 text-muted-foreground sm:text-xs">
              {description}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
}

export default PageHeader;
