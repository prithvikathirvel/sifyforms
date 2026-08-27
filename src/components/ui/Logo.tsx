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
 * SifyForms brand mark.
 *
 * A solid brand-color form-and-check symbol stays recognizable at favicon size
 * and avoids decorative gradients. The lockup uses live text for crisp rendering,
 * accessibility, and easy theme-level color changes.
 */
export function Logo({
  variant = 'lockup',
  size = 'md',
  withWordmark = false,
  className = '',
}: LogoProps) {
  const showWordmark = variant === 'lockup' || withWordmark;

  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 64 64"
        className={`${MARK_SIZE[size]} shrink-0`}
        role={showWordmark ? undefined : 'img'}
        aria-hidden={showWordmark || undefined}
        aria-label={showWordmark ? undefined : 'SifyForms'}
      >
        <rect x="2" y="2" width="60" height="60" rx="15" fill="hsl(var(--logo-color))" />
        <path
          d="M19 13.5h17.2L47 24.3v23.2a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4v-30a4 4 0 0 1 4-4Z"
          fill="white"
        />
        <path d="M36.2 13.5v8.4a2.4 2.4 0 0 0 2.4 2.4H47L36.2 13.5Z" fill="hsl(var(--logo-color))" fillOpacity="0.16" />
        <circle cx="22.5" cy="30" r="1.8" fill="hsl(var(--logo-color))" />
        <rect x="27" y="28.3" width="13" height="3.4" rx="1.7" fill="hsl(var(--logo-color))" />
        <circle cx="22.5" cy="37.5" r="1.8" fill="hsl(var(--logo-color))" />
        <rect x="27" y="35.8" width="13" height="3.4" rx="1.7" fill="hsl(var(--logo-color))" />
        <circle cx="22.5" cy="45" r="3.7" fill="hsl(var(--logo-color))" />
        <path d="m20.6 44.9 1.35 1.35 2.55-2.9" fill="none" stroke="white" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="27" y="43.3" width="13" height="3.4" rx="1.7" fill="hsl(var(--logo-color))" />
      </svg>

      {showWordmark && (
        <span className={`${WORDMARK_SIZE[size]} truncate font-display font-bold leading-none tracking-[-0.045em] text-foreground`}>
          sifyforms<span style={{ color: 'hsl(var(--logo-color))' }}>.ai</span>
        </span>
      )}
    </span>
  );
}

export default Logo;
