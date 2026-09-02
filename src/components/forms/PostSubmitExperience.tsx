import type { ReactNode } from 'react';
import { Check, Heart, Loader2, Sparkles, ThumbsUp } from 'lucide-react';
import type { PostSubmitSettings } from '../../types';

interface Props {
  settings?: PostSubmitSettings;
  phase: 'loading' | 'success' | 'result';
  defaultTitle: string;
  defaultMessage: string;
  submissionId?: string | null;
  children?: ReactNode;
}

const templateDefaults: Record<NonNullable<PostSubmitSettings['template']>, { accent: string; background: string }> = {
  minimal: { accent: '#475569', background: '#f8fafc' },
  celebration: { accent: '#7c3aed', background: '#f5f3ff' },
  professional: { accent: '#0f766e', background: '#f0fdfa' },
  nextSteps: { accent: '#2563eb', background: '#eff6ff' },
};

function safeHref(value?: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

export default function PostSubmitExperience({ settings, phase, defaultTitle, defaultMessage, submissionId, children }: Props) {
  const template = settings?.template ?? 'minimal';
  const defaults = templateDefaults[template];
  const accent = settings?.accentColor ?? defaults.accent;
  const background = settings?.backgroundColor ?? defaults.background;
  const title = phase === 'loading' ? settings?.loadingTitle || defaultTitle : settings?.headline || defaultTitle;
  const message = phase === 'loading' ? settings?.loadingMessage || defaultMessage : settings?.message || defaultMessage;
  const align = template === 'nextSteps' ? 'text-left items-start' : 'text-center items-center';
  const Icon = settings?.icon === 'heart' ? Heart : settings?.icon === 'thumbsUp' ? ThumbsUp : settings?.icon === 'sparkles' ? Sparkles : Check;
  const primaryHref = safeHref(settings?.primaryAction?.enabled ? settings.primaryAction.url : undefined);
  const secondaryHref = safeHref(settings?.secondaryAction?.enabled ? settings.secondaryAction.url : undefined);

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-8" style={{ backgroundColor: background }}>
      <section className={`w-full ${children ? 'max-w-2xl' : 'max-w-lg'} overflow-hidden rounded-2xl border border-black/10 bg-white`} aria-live={phase === 'loading' ? 'polite' : undefined}>
        <div className={`flex flex-col px-5 py-8 sm:px-9 sm:py-10 ${align}`}>
          {phase === 'loading' ? (
            <div className="mb-5 w-full">
              {(settings?.loadingStyle ?? 'bar') === 'spinner' && <Loader2 className="mx-auto h-10 w-10 animate-spin" style={{ color: accent }} />}
              {(settings?.loadingStyle ?? 'bar') === 'pulse' && <div className="mx-auto h-12 w-12 animate-pulse rounded-full" style={{ backgroundColor: `${accent}22` }}><Sparkles className="m-3 h-6 w-6" style={{ color: accent }} /></div>}
              {(settings?.loadingStyle ?? 'bar') === 'bar' && <div className="mx-auto h-2 w-full max-w-sm overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 animate-pulse rounded-full" style={{ backgroundColor: accent }} /></div>}
            </div>
          ) : (
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${accent}16`, color: accent }}>
              <Icon className="h-7 w-7" strokeWidth={1.8} />
            </div>
          )}

          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {phase === 'loading' ? 'Processing response' : phase === 'result' ? 'Your result' : 'Response received'}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          {message && <p className="mt-3 max-w-xl whitespace-pre-line text-sm leading-6 text-slate-600">{message}</p>}

          {children && <div className="mt-7 w-full border-t border-slate-200 pt-6 text-left">{children}</div>}

          {phase !== 'loading' && (settings?.showSubmissionId || settings?.showTimestamp) && (
            <dl className="mt-6 grid w-full gap-2 rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-600 sm:grid-cols-2">
              {settings.showSubmissionId && submissionId && <div><dt className="font-medium text-slate-500">Response reference</dt><dd className="mt-0.5 break-all font-mono text-slate-800">{submissionId}</dd></div>}
              {settings.showTimestamp && <div><dt className="font-medium text-slate-500">Received</dt><dd className="mt-0.5 text-slate-800">{new Date().toLocaleString()}</dd></div>}
            </dl>
          )}

          {phase !== 'loading' && (primaryHref || secondaryHref) && (
            <div className={`mt-6 flex w-full flex-col gap-2 sm:flex-row ${template === 'nextSteps' ? '' : 'sm:justify-center'}`}>
              {primaryHref && <a href={primaryHref} className="inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-white" style={{ backgroundColor: accent }}>{settings?.primaryAction?.label || 'Continue'}</a>}
              {secondaryHref && <a href={secondaryHref} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">{settings?.secondaryAction?.label || 'Back to website'}</a>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
