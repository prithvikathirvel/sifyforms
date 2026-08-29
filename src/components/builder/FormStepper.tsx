import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface StepperStep {
  id: string;
  title: string;
}

interface FormStepperProps {
  steps: StepperStep[];
  currentIndex: number;
  style?: 'progress' | 'circles' | 'minimal';
  /** Allows jumping to a previously visited step (respects back navigation). */
  onStepClick?: (index: number) => void;
  className?: string;
}

/**
 * Shared multi-step progress indicator used by both the editor Preview and the
 * published form so the two always render identically.
 */
export default function FormStepper({
  steps,
  currentIndex,
  style = 'progress',
  onStepClick,
  className,
}: FormStepperProps) {
  const total = steps.length;
  if (total <= 1) return null;
  const clamped = Math.max(0, Math.min(currentIndex, total - 1));

  /* ---------- Progress bar style ---------- */
  if (style === 'progress') {
    return (
      <div className={cn('mb-6', className)} aria-label={`Step ${clamped + 1} of ${total}`}>
        <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={clamped + 1}>
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= clamped ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
        <p className="mt-1.5 text-xs font-medium text-muted-foreground">
          Step {clamped + 1} of {total}
        </p>
      </div>
    );
  }

  /* ---------- Minimal style ---------- */
  if (style === 'minimal') {
    return (
      <div className={cn('mb-6', className)} aria-label={`Step ${clamped + 1} of ${total}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Step {clamped + 1} of {total}
          </p>
          <span className="text-xs font-medium text-foreground">{steps[clamped]?.title}</span>
        </div>
      </div>
    );
  }

  /* ---------- Circles style (default enterprise) ---------- */
  return (
    <ol className={cn('mb-6 flex w-full items-start', className)} aria-label={`Step ${clamped + 1} of ${total}`}>
      {steps.map((step, i) => {
        const isComplete = i < clamped;
        const isCurrent = i === clamped;
        const clickable = !!onStepClick && i < clamped;

        return (
          <li key={step.id} className={cn('flex items-start', i < total - 1 && 'flex-1')}>
            <div className="flex flex-col items-center">
              <button
                type="button"
                disabled={!clickable}
                onClick={clickable ? () => onStepClick?.(i) : undefined}
                tabIndex={clickable ? 0 : -1}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors',
                  isComplete && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-card text-primary',
                  !isComplete && !isCurrent && 'border-muted bg-card text-muted-foreground',
                  clickable && 'cursor-pointer hover:ring-2 hover:ring-primary/30'
                )}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={isComplete ? `Go to ${step.title}` : step.title}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
              </button>
              <span
                className={cn(
                  'mt-1.5 max-w-[7rem] truncate px-1 text-center text-[10px] font-medium leading-tight',
                  isCurrent || isComplete ? 'text-foreground' : 'text-muted-foreground'
                )}
                title={step.title}
              >
                {step.title}
              </span>
            </div>
            {i < total - 1 && (
              <div
                className={cn(
                  'mx-1 mt-3.5 h-0.5 flex-1 rounded-full transition-colors',
                  i < clamped ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
