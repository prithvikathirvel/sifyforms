import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}

/** Compact, typography-led header shared by every sidebar destination. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="shrink-0 border-b border-border/70 bg-card">
      <div className="flex min-h-14 w-full min-w-0 items-center justify-between gap-3 px-4 py-2 sm:px-5 lg:px-6">
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
    </header>
  );
}

export default PageHeader;
