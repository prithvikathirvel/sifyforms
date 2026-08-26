import { useId } from 'react';

type Variant = 'lockup' | 'icon';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  variant?: Variant;
  size?: Size;
  withWordmark?: boolean;
  className?: string;
}

const MARK_SIZE: Record<Size, string> = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
};

const WORDMARK_SIZE: Record<Size, string> = {
  sm: 'text-[17px]',
  md: 'text-xl',
  lg: 'text-[26px]',
  xl: 'text-[30px]',
};

/**
 * SifyForms logo rendered as a responsive vector.
 *
 * The mark follows the supplied form-document artwork and reads its gradient
 * from the central design tokens. The wordmark stays as live text so it is
 * sharp, accessible, and easy to recolor with the rest of the public theme.
 */
export function Logo({
  variant = 'lockup',
  size = 'md',
  withWordmark = false,
  className = '',
}: LogoProps) {
  const gradientId = `sifyforms-gradient-${useId().replace(/:/g, '')}`;
  const showWordmark = variant === 'lockup' || withWordmark;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 64 64"
        className={`${MARK_SIZE[size]} shrink-0`}
        role={showWordmark ? undefined : 'img'}
        aria-hidden={showWordmark || undefined}
        aria-label={showWordmark ? undefined : 'SifyForms'}
      >
        <defs>
          <linearGradient id={gradientId} x1="7" y1="57" x2="57" y2="7" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="hsl(var(--brand-from))" />
            <stop offset="0.52" stopColor="hsl(var(--brand-mid))" />
            <stop offset="1" stopColor="hsl(var(--brand-to))" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="15" fill={`url(#${gradientId})`} />
        <path
          d="M19.25 13.5h17.2L46.75 23.8v23.7a4 4 0 0 1-4 4h-23.5a4 4 0 0 1-4-4v-30a4 4 0 0 1 4-4Z"
          fill="white"
        />
        <path d="M36.25 13.5v8.1a2.4 2.4 0 0 0 2.4 2.4h8.1" fill="hsl(var(--brand-to) / 0.18)" />
        <path d="m36.25 13.5 10.5 10.5h-8.1a2.4 2.4 0 0 1-2.4-2.4v-8.1Z" fill="white" fillOpacity="0.82" />
        <circle cx="22.25" cy="29.5" r="2" fill={`url(#${gradientId})`} />
        <rect x="27" y="27.6" width="13.75" height="3.8" rx="1.9" fill={`url(#${gradientId})`} />
        <circle cx="22.25" cy="37.25" r="2" fill={`url(#${gradientId})`} />
        <rect x="27" y="35.35" width="13.75" height="3.8" rx="1.9" fill={`url(#${gradientId})`} />
        <circle cx="22.25" cy="45" r="3.65" fill={`url(#${gradientId})`} />
        <path d="m20.3 44.9 1.35 1.4 2.65-3" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="27" y="43.1" width="13.75" height="3.8" rx="1.9" fill={`url(#${gradientId})`} />
      </svg>

      {showWordmark && (
        <span
          className={`${WORDMARK_SIZE[size]} font-display font-bold leading-none tracking-[-0.045em]`}
          style={{ color: 'hsl(var(--brand-from))' }}
        >
          sifyforms<span className="text-brand-gradient">.ai</span>
        </span>
      )}
    </span>
  );
}

export default Logo;
