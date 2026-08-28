import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';
type TooltipTone = 'dark' | 'light';
type TooltipDelay = 'none' | 'short' | 'default';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  tone?: TooltipTone;
  delay?: TooltipDelay;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}

const delayMs: Record<TooltipDelay, number> = {
  none: 0,
  short: 150,
  default: 300,
};

const toneClasses: Record<TooltipTone, string> = {
  dark: 'border-white/10 bg-ink-900 text-white shadow-[0_8px_24px_rgba(15,23,42,0.2)] after:bg-ink-900',
  light: 'border-border bg-card text-foreground shadow-[0_8px_24px_rgba(15,23,42,0.12)] after:bg-card',
};

const arrowClasses: Record<TooltipSide, string> = {
  top: 'after:left-1/2 after:top-full after:-translate-x-1/2 after:-translate-y-1/2',
  right: 'after:right-full after:top-1/2 after:-translate-y-1/2 after:translate-x-1/2',
  bottom: 'after:bottom-full after:left-1/2 after:-translate-x-1/2 after:translate-y-1/2',
  left: 'after:left-full after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2',
};

function tooltipPosition(rect: DOMRect, side: TooltipSide) {
  switch (side) {
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.right + 8, transform: 'translateY(-50%)' };
    case 'bottom':
      return { top: rect.bottom + 8, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' };
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - 8, transform: 'translate(-100%, -50%)' };
    default:
      return { top: rect.top - 8, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' };
  }
}

/** Portal-based premium tooltip that is not clipped by tables, sidebars, or dialogs. */
export function Tooltip({
  content,
  children,
  side = 'top',
  tone = 'dark',
  delay = 'default',
  disabled = false,
  className,
  contentClassName,
}: TooltipProps) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, transform: '' });

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const show = () => {
    if (disabled) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(tooltipPosition(rect, side));
      setVisible(true);
    }, delayMs[delay]);
  };

  const hide = () => {
    clearTimer();
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;
    const dismiss = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setVisible(false);
    };
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [visible]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  if (disabled || !content) return <>{children}</>;

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': [
          (children as ReactElement<{ 'aria-describedby'?: string }>).props['aria-describedby'],
          id,
        ].filter(Boolean).join(' '),
      })
    : children;

  return (
    <span
      ref={rootRef}
      className={cn('inline-flex', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {trigger}
      {visible && createPortal(
        <span
          id={id}
          role="tooltip"
          style={position}
          className={cn(
            'pointer-events-none fixed z-[150] w-max max-w-64 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold leading-4 after:absolute after:h-2 after:w-2 after:rotate-45 after:border-0',
            toneClasses[tone],
            arrowClasses[side],
            contentClassName
          )}
        >
          {content}
        </span>,
        document.body
      )}
    </span>
  );
}

export default Tooltip;
