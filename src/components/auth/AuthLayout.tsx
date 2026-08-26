import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { cn } from '../../lib/utils';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
  highlights: string[];
  contentClassName?: string;
}

export function AuthLayout({
  children,
  title,
  description,
  highlights,
  contentClassName,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(22rem,0.82fr)_minmax(0,1.18fr)]">
      <aside className="relative hidden h-screen overflow-hidden bg-brand-gradient text-white lg:sticky lg:top-0 lg:flex lg:flex-col lg:px-10 lg:py-9 xl:px-14 xl:py-11">
        <div className="auth-panel-pattern absolute inset-0 opacity-40" aria-hidden="true" />
        <div
          className="absolute -right-28 top-24 h-72 w-72 rounded-full border border-white/10 bg-white/[0.04] blur-[1px]"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-36 -left-28 h-80 w-80 rounded-full bg-brand-400/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10">
          <Link
            to="/"
            aria-label="SifyForms home"
            className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <Logo variant="icon" withWordmark size="lg" className="text-white" />
          </Link>
        </div>

        <div className="relative z-10 my-auto max-w-lg py-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-300" strokeWidth={2.25} />
            Built for confident teams
          </div>
          <h1 className="text-4xl font-bold leading-[1.12] tracking-tight xl:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-white/70 xl:text-lg">
            {description}
          </p>

          <ul className="mt-9 space-y-4" aria-label="Product benefits">
            {highlights.map((highlight) => (
              <li key={highlight} className="flex items-center gap-3 text-sm text-white/90 xl:text-base">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-300/30 bg-brand-300/15 text-brand-200">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-3 border-t border-white/10 pt-6 text-sm text-white/60">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.07] text-brand-200">
            <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <div>
            <p className="font-bold text-white/90">Secure by design</p>
            <p className="mt-0.5 text-xs">A focused workspace for your forms and responses.</p>
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen min-w-0 flex-col bg-[hsl(var(--background))]">
        <header className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur sm:px-8 lg:justify-end lg:border-b-0 lg:px-10">
          <Link to="/" aria-label="SifyForms home" className="lg:hidden">
            <Logo size="md" />
          </Link>
          <Link
            to="/"
            className="group inline-flex items-center gap-2 rounded-md text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.25} />
            Back to home
          </Link>
        </header>

        <div
          className={cn(
            'flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-10 lg:py-10 xl:px-16',
            contentClassName
          )}
        >
          {children}
        </div>

        <footer className="px-5 pb-6 text-center text-xs text-muted-foreground sm:px-8 lg:px-10">
          © 2026 SifyForms.AI. All rights reserved.
        </footer>
      </main>
    </div>
  );
}

export default AuthLayout;
