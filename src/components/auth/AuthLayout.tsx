import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { cn } from '../../lib/utils';

interface AuthLayoutProps {
  children: ReactNode;
  contentClassName?: string;
}

/** A quiet, centered shell shared by sign-in and account creation. */
export function AuthLayout({ children, contentClassName }: AuthLayoutProps) {
  return (
    <div className="public-shell flex min-h-screen flex-col bg-background">
      <header className="shrink-0 border-b border-border/70 bg-background/95">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link to="/" aria-label="SifyForms home" className="rounded-md">
            <Logo size="sm" />
          </Link>
          <Link
            to="/"
            className="group inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={2} />
            Back to home
          </Link>
        </div>
      </header>

      <main
        className={cn(
          'flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-8',
          contentClassName
        )}
      >
        {children}
      </main>

      <footer className="shrink-0 px-5 pb-6 text-center text-[11px] font-medium text-muted-foreground">
        © 2026 SifyForms.AI. All rights reserved.
      </footer>
    </div>
  );
}

export default AuthLayout;
