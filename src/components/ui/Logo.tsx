type Variant = 'lockup' | 'icon';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  variant?: Variant;
  size?: Size;
  withWordmark?: boolean;
  className?: string;
}

const MARK_SIZE: Record<Size, string> = {
  sm: 'h-5',
  md: 'h-6',
  lg: 'h-7',
  xl: 'h-8',
};

const WORDMARK_SIZE: Record<Size, string> = {
  sm: 'text-[13px]',
  md: 'text-[15px]',
  lg: 'text-[18px]',
  xl: 'text-[21px]',
};

/**
 * SifyForms brand mark, paired with a Sify Forms wordmark.
 */
export function Logo({
  variant = 'lockup',
  size = 'md',
  withWordmark = false,
  className = '',
}: LogoProps) {
  const showWordmark = variant === 'lockup' || withWordmark;

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <img
        src={`${import.meta.env.BASE_URL}sifyforms-mark.svg`}
        alt={showWordmark ? '' : 'Sify Forms'}
        className={`${MARK_SIZE[size]} w-auto shrink-0`}
      />

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
