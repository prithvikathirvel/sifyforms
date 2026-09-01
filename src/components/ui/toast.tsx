/* eslint-disable react-refresh/only-export-components -- a toast module must export both the imperative `toast` API and the `ToastProvider` component */
import * as React from 'react';
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Minimal, sleek toast system.
 *
 * A tiny dependency-free notifier in the spirit of sonner: a single viewport,
 * stacked cards with a tinted icon, a progress bar, auto-dismiss and a close
 * button. Exposed two ways so it is equally easy to call from components
 * (`useToast()`) and from anywhere else (`toast.success(...)`).
 */

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  title?: string;
  description?: string;
  /** Auto-dismiss delay in ms. Defaults to 4500. */
  duration?: number;
}

interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description: string;
  duration: number;
  leaving?: boolean;
}

let counter = 0;
type Listener = (item: ToastItem) => void;
let listeners: Listener[] = [];

function emit(variant: ToastVariant, opts: string | ToastOptions) {
  const o = typeof opts === 'string' ? { title: opts } : opts;
  const item: ToastItem = {
    id: ++counter,
    variant,
    title: o.title ?? '',
    description: o.description ?? '',
    duration: o.duration ?? 4500,
  };
  listeners.forEach((listener) => listener(item));
}

/**
 * Imperative API — callable from thunks, event handlers, or any non-React
 * module. The Toaster must be mounted once (see App.tsx) for these to render.
 */
export const toast = {
  success: (opts: string | ToastOptions) => emit('success', opts),
  error: (opts: string | ToastOptions) => emit('error', opts),
  info: (opts: string | ToastOptions) => emit('info', opts),
  warning: (opts: string | ToastOptions) => emit('warning', opts),
};

/** Hook form, for callers that prefer it. Returns the same API object. */
export function useToast() {
  return toast;
}

const VARIANT_STYLE: Record<ToastVariant, { icon: typeof Info; ring: string; iconColor: string }> = {
  success: { icon: CheckCircle2, ring: 'border-emerald-500/25', iconColor: 'text-emerald-600' },
  error: { icon: CircleAlert, ring: 'border-destructive/25', iconColor: 'text-destructive' },
  info: { icon: Info, ring: 'border-primary/25', iconColor: 'text-primary' },
  warning: { icon: TriangleAlert, ring: 'border-amber-500/25', iconColor: 'text-amber-600' },
};

interface ToastCardProps {
  item: ToastItem;
  onDismiss: (id: number) => void;
}

function ToastCard({ item, onDismiss }: ToastCardProps) {
  const { icon: Icon, ring, iconColor } = VARIANT_STYLE[item.variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'toast-enter pointer-events-auto relative w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover shadow-lg shadow-foreground/[0.08]',
        ring,
        item.leaving && 'toast-leave'
      )}
    >
      <div className="flex items-start gap-2.5 p-3 pr-8">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColor)} strokeWidth={2} />
        <div className="min-w-0 flex-1">
          {item.title && (
            <p className="text-[13px] font-semibold leading-5 text-foreground">{item.title}</p>
          )}
          {item.description && (
            <p className="mt-0.5 text-xs font-medium leading-5 text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          aria-label="Dismiss notification"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* progress bar */}
      <div
        className="toast-progress h-0.5 bg-current opacity-30"
        style={{ animationDuration: `${item.duration}ms`, color: 'hsl(var(--primary))' }}
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const push = (item: ToastItem) => {
      setToasts((prev) => [...prev.slice(-4), item]);
      if (item.duration > 0) {
        window.setTimeout(() => dismiss(item.id), item.duration);
      }
    };
    const dismiss = (id: number) => {
      setToasts((prev) => {
        const target = prev.find((t) => t.id === id);
        if (!target || target.leaving) return prev;
        // Mark leaving so the exit animation runs, then remove.
        window.setTimeout(() => {
          setToasts((current) => current.filter((t) => t.id !== id));
        }, 180);
        return prev.map((t) => (t.id === id ? { ...t, leaving: true } : t));
      });
    };
    listeners.push(push);
    return () => {
      listeners = listeners.filter((l) => l !== push);
    };
  }, []);

  return (
    <>
      {children}
      <div className="pointer-events-none fixed right-3 top-3 z-[120] flex flex-col items-end gap-2 sm:right-5 sm:top-5">
        {toasts.map((item) => (
          <ToastCard
            key={item.id}
            item={item}
            onDismiss={(id) =>
              setToasts((prev) => {
                const target = prev.find((t) => t.id === id);
                if (!target || target.leaving) return prev;
                window.setTimeout(() => {
                  setToasts((current) => current.filter((t) => t.id !== id));
                }, 180);
                return prev.map((t) => (t.id === id ? { ...t, leaving: true } : t));
              })
            }
          />
        ))}
      </div>
    </>
  );
}

export default ToastProvider;
