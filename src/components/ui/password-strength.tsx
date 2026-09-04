import * as React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Password strength meter.
 *
 * Four segments rather than a single sliding bar: a discrete scale reads at a
 * glance and does not imply a false precision. Scoring is deliberately simple
 * and local — length first, then variety — because the authoritative rule
 * lives on the server, and this only has to tell someone whether they are on
 * the right track while they type.
 */

type PasswordStrength = 0 | 1 | 2 | 3 | 4;

interface Requirement {
  label: string;
  test: (value: string) => boolean;
}

const PASSWORD_REQUIREMENTS: Requirement[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One number', test: (v) => /\d/.test(v) },
  { label: 'One symbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function passwordStrength(value: string): PasswordStrength {
  if (!value) return 0;
  const met = PASSWORD_REQUIREMENTS.filter((requirement) => requirement.test(value)).length;
  // A long password earns a bonus step; a very short one is capped low however
  // varied its characters are.
  const bonus = value.length >= 12 ? 1 : 0;
  const score = Math.min(4, met + bonus);
  if (value.length < 8) return Math.min(1, score) as PasswordStrength;
  return Math.max(1, score) as PasswordStrength;
}

const LEVELS: { label: string; bar: string; text: string }[] = [
  { label: 'Too short', bar: 'bg-destructive', text: 'text-destructive' },
  { label: 'Weak', bar: 'bg-destructive', text: 'text-destructive' },
  { label: 'Fair', bar: 'bg-amber-500', text: 'text-amber-600' },
  { label: 'Good', bar: 'bg-primary/70', text: 'text-primary' },
  { label: 'Strong', bar: 'bg-[hsl(var(--success))]', text: 'text-[hsl(var(--success))]' },
];

interface PasswordStrengthMeterProps {
  value: string;
  /** Show the requirement checklist under the bar. */
  showChecklist?: boolean;
  className?: string;
  id?: string;
}

export function PasswordStrengthMeter({
  value,
  showChecklist = true,
  className,
  id,
}: PasswordStrengthMeterProps) {
  const score = passwordStrength(value);
  const level = LEVELS[score];
  const unmet = React.useMemo(
    () => PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.test(value)),
    [value]
  );

  if (!value) return null;

  return (
    <div id={id} className={cn('space-y-1.5', className)} aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-1" role="presentation">
          {[1, 2, 3, 4].map((segment) => (
            <span
              key={segment}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                segment <= score ? level.bar : 'bg-border'
              )}
            />
          ))}
        </div>
        <span className={cn('shrink-0 text-[11px] font-semibold tabular-nums', level.text)}>
          {level.label}
        </span>
      </div>

      {showChecklist && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {PASSWORD_REQUIREMENTS.map((requirement) => {
            const met = requirement.test(value);
            return (
              <li
                key={requirement.label}
                className={cn(
                  'flex items-center gap-1 text-[11px] font-medium',
                  met ? 'text-muted-foreground' : 'text-muted-foreground/80'
                )}
              >
                {met ? (
                  <Check className="h-3 w-3 shrink-0 text-[hsl(var(--success))]" strokeWidth={2.5} />
                ) : (
                  <X className="h-3 w-3 shrink-0 text-muted-foreground/50" strokeWidth={2.5} />
                )}
                {requirement.label}
              </li>
            );
          })}
        </ul>
      )}

      {!showChecklist && unmet.length > 0 && (
        <p className="text-[11px] font-medium text-muted-foreground">
          Add {unmet.map((requirement) => requirement.label.toLowerCase()).join(', ')}.
        </p>
      )}
    </div>
  );
}

export default PasswordStrengthMeter;
