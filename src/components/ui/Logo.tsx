import iconSrc from '../../assets/brand/sifyforms-icon.png';
import lockupSrc from '../../assets/brand/sifyforms-lockup.png';

/**
 * The sifyforms.ai brand mark.
 *
 * One component so the logo is defined once. Every header, auth screen and
 * empty state renders through this rather than pairing an arbitrary icon with
 * hand-typed text, which is how the wordmark drifted before.
 *
 *   <Logo />                     the full lockup, for light surfaces
 *   <Logo variant="icon" />      the mark alone, for tight or dark spaces
 *   <Logo variant="icon" withWordmark />   mark plus themed text, works on any ground
 */

type Variant = 'lockup' | 'icon';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  variant?: Variant;
  size?: Size;
  /** Render the wordmark as live text beside the icon. Use on dark grounds,
   *  where the lockup's dark-purple wordmark would disappear. */
  withWordmark?: boolean;
  className?: string;
}

/**
 * Heights, so the lockup and the bare icon line up at the same nominal size.
 *
 * Both source images are cropped to their artwork - the originals carried a
 * transparent margin that made everything render about a third smaller than the
 * height class suggested.
 */
const LOCKUP_HEIGHT: Record<Size, string> = {
  sm: 'h-7',
  md: 'h-9',
  lg: 'h-11',
  xl: 'h-14',
};

const ICON_SIZE: Record<Size, string> = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10',
  xl: 'h-12',
};

const WORDMARK_SIZE: Record<Size, string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

export function Logo({
  variant = 'lockup',
  size = 'md',
  withWordmark = false,
  className = '',
}: LogoProps) {
  if (variant === 'lockup' && !withWordmark) {
    return (
      <img
        src={lockupSrc}
        alt="sifyforms.ai"
        className={`${LOCKUP_HEIGHT[size]} w-auto ${className}`}
        // Intrinsic size of the 2x asset, so the browser reserves the right box
        // and the header does not jump while it loads.
        width={740}
        height={168}
      />
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={iconSrc}
        alt={withWordmark ? '' : 'sifyforms.ai'}
        aria-hidden={withWordmark || undefined}
        className={`${ICON_SIZE[size]} w-auto`}
        width={256}
        height={256}
      />
      {withWordmark && (
        <span className={`${WORDMARK_SIZE[size]} font-bold tracking-tight`}>
          sifyforms<span className="text-primary">.ai</span>
        </span>
      )}
    </span>
  );
}

export default Logo;
