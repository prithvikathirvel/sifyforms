import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AuthLayoutProps {
  children: ReactNode;
  contentClassName?: string;
}

/** Full-viewport, distraction-free shell shared by authentication pages. */
export function AuthLayout({ children, contentClassName }: AuthLayoutProps) {
  return (
    <div className="public-shell flex min-h-[100dvh] flex-col overflow-x-hidden bg-background">
      <nav className="mx-auto flex w-full max-w-7xl shrink-0 px-3 pt-3 sm:px-5 sm:pt-4" aria-label="Authentication navigation">
        <Link
          to="/"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[11px] font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Back to home
        </Link>
      </nav>

      <main
        className={cn(
          'flex flex-1 items-center justify-center px-3 pb-3 pt-2 sm:px-5 sm:pb-5 sm:pt-3 lg:px-4 lg:pb-4',
          contentClassName
        )}
      >
        {children}
      </main>
    </div>
  );
}

export default AuthLayout;
