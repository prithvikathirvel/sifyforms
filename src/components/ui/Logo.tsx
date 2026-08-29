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
  sm: 'text-[16px]',
  md: 'text-[18px]',
  lg: 'text-[24px]',
  xl: 'text-[28px]',
};

/**
 * SifyForms brand mark — a minimal "SF" monogram on a brand-gradient tile,
 * paired with a "Sify Forms" wordmark. The wordmark uses the Geist variable
 * font (a free, OFL-licensed geometric sans) for a clean, enterprise look,
 * with "Forms" picked out in the brand hue for a subtle two-tone lockup.
 */
export function Logo({
  variant = 'lockup',
  size = 'md',
  withWordmark = false,
  className = '',
}: LogoProps) {
  const showWordmark = variant === 'lockup' || withWordmark;
  const gradientId = useId();

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 64 64"
        className={`${MARK_SIZE[size]} shrink-0`}
        role={showWordmark ? undefined : 'img'}
        aria-hidden={showWordmark || undefined}
        aria-label={showWordmark ? undefined : 'Sify Forms'}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--brand-from))" />
            <stop offset="55%" stopColor="hsl(var(--brand-mid))" />
            <stop offset="100%" stopColor="hsl(var(--brand-to))" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${gradientId})`} />
        <text
          x="32"
          y="41.5"
          textAnchor="middle"
          fontFamily="'Geist Variable', 'Geist', Inter, system-ui, sans-serif"
          fontSize="25"
          fontWeight="700"
          letterSpacing="-0.5"
          fill="white"
        >
          SF
        </text>
      </svg>

      {showWordmark && (
        <span
          className={`${WORDMARK_SIZE[size]} truncate font-display font-bold leading-none tracking-[-0.035em] text-foreground`}
        >
          Sify<span style={{ color: 'hsl(var(--logo-color))' }}>Forms</span>
        </span>
      )}
    </span>
  );
}

export default Logo;
