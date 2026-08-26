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
    <div className="public-shell relative min-h-[100dvh] overflow-x-hidden bg-background">
      <Link
        to="/"
        className="absolute left-3 top-3 z-20 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background/95 px-2.5 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted hover:text-foreground sm:left-5 sm:top-5"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to home
      </Link>

      <main
        className={cn(
          'flex min-h-[100dvh] items-center justify-center px-3 pb-3 pt-14 sm:px-5 sm:pb-5 sm:pt-16 lg:p-4',
          contentClassName
        )}
      >
        {children}
      </main>
    </div>
  );
}

export default AuthLayout;
