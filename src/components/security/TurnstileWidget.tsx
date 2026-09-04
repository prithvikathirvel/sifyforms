import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface TurnstileOptions {
  sitekey: string;
  action: string;
  cData: string;
  appearance: 'interaction-only';
  size: 'flexible';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileWidgetProps {
  siteKey: string;
  formId: string;
  resetKey: number;
  onTokenChange: (token: string | null) => void;
}

const SCRIPT_ID = 'cloudflare-turnstile-script';
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const resolveApi = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Security check could not start'));
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', resolveApi, { once: true });
      existing.addEventListener('error', () => reject(new Error('Security check could not load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', resolveApi, { once: true });
    script.addEventListener('error', () => reject(new Error('Security check could not load')), { once: true });
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/** Invisible-until-needed Cloudflare Turnstile challenge for public forms. */
export function TurnstileWidget({
  siteKey,
  formId,
  resetKey,
  onTokenChange,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbackRef = useRef(onTokenChange);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    callbackRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let active = true;

    loadTurnstile()
      .then((turnstile) => {
        if (!active || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: 'form_submission',
          cData: formId,
          appearance: 'interaction-only',
          size: 'flexible',
          callback: (token) => {
            setLoadError('');
            callbackRef.current(token);
          },
          'expired-callback': () => callbackRef.current(null),
          'error-callback': () => {
            callbackRef.current(null);
            setLoadError('Security verification could not be completed. Please try again.');
          },
        });
      })
      .catch(() => {
        if (!active) return;
        callbackRef.current(null);
        setLoadError('Security verification could not load. Check your connection and refresh.');
      });

    return () => {
      active = false;
      callbackRef.current(null);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, formId]);

  useEffect(() => {
    if (resetKey > 0 && widgetIdRef.current && window.turnstile) {
      callbackRef.current(null);
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  if (!siteKey) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3 py-2.5 text-xs font-medium text-destructive">
        Security verification is not configured for this form.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="w-full" />
      {loadError ? (
        <p role="alert" className="text-xs font-medium text-destructive">{loadError}</p>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" strokeWidth={1.9} />
          Powered by Cloudflare
        </p>
      )}
    </div>
  );
}

export default TurnstileWidget;
