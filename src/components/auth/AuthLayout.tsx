import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AuthLayoutProps {
  children: ReactNode;
  contentClassName?: string;
}

/** Full-viewport authentication shell with a quiet, contextual route home. */
export function AuthLayout({ children, contentClassName }: AuthLayoutProps) {
  return (
    <div className="public-shell flex min-h-[100dvh] flex-col overflow-x-hidden bg-background">
      <main
        className={cn(
          'flex flex-1 items-center justify-center px-3 py-4 sm:px-5 sm:py-5 lg:px-4',
          contentClassName
        )}
      >
        <div className="flex w-full flex-col items-center">
          {children}
          <Link
            to="/"
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
            Back to SifyForms home
          </Link>
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
