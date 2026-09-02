type Variant = 'lockup' | 'icon';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  variant?: Variant;
  size?: Size;
  withWordmark?: boolean;
  className?: string;
}

const MARK_SIZE: Record<Size, string> = {
  sm: 'h-6',
  md: 'h-7',
  lg: 'h-8',
  xl: 'h-10',
};

const WORDMARK_SIZE: Record<Size, string> = {
  sm: 'text-[15px]',
  md: 'text-[17px]',
  lg: 'text-[22px]',
  xl: 'text-[26px]',
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
