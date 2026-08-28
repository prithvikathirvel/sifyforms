import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DropdownSelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface DropdownSelectProps<T extends string = string> {
  value: T;
  options: DropdownSelectOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  icon?: ReactNode;
  size?: 'compact' | 'default';
  align?: 'left' | 'right';
  disabled?: boolean;
  portal?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
}

interface MenuPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

/** Compact custom select for status, roles, sort, and other short option lists. */
export function DropdownSelect<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  icon,
  size = 'compact',
  align = 'left',
  disabled = false,
  portal = true,
  className,
  triggerClassName,
  menuClassName,
}: DropdownSelectProps<T>) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(options.findIndex((option) => option.value === value), 0));
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ left: 0, width: 0, maxHeight: 256 });
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnResize = () => setOpen(false);
    const closeOnOutsideScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', closeOnResize);
    window.addEventListener('scroll', closeOnOutsideScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', closeOnResize);
      window.removeEventListener('scroll', closeOnOutsideScroll, true);
    };
  }, [open]);

  const calculateMenuPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportPadding = 8;
    const gap = 6;
    const below = window.innerHeight - rect.bottom - viewportPadding;
    const above = rect.top - viewportPadding;
    const openAbove = below < 180 && above > below;
    const width = rect.width;
    const left = align === 'right'
      ? Math.max(viewportPadding, rect.right - width)
      : Math.min(rect.left, window.innerWidth - width - viewportPadding);
    setMenuPosition({
      ...(openAbove ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }),
      left: Math.max(viewportPadding, left),
      width,
      maxHeight: Math.max(96, Math.min(256, (openAbove ? above : below) - gap)),
    });
  };

  const openMenu = () => {
    calculateMenuPosition();
    setActiveIndex(Math.max(options.findIndex((option) => option.value === value), 0));
    setOpen(true);
  };

  const move = (direction: 1 | -1) => {
    if (options.length === 0) return;
    if (!open) {
      openMenu();
      return;
    }
    let next = activeIndex;
    for (let count = 0; count < options.length; count += 1) {
      next = (next + direction + options.length) % options.length;
      if (!options[next]?.disabled) break;
    }
    setActiveIndex(next);
  };

  const choose = (option: DropdownSelectOption<T>) => {
    if (option.disabled) return;
    onValueChange(option.value);
    setActiveIndex(options.indexOf(option));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const menu = open ? (
    <div
      ref={menuRef}
      id={id}
      role="listbox"
      aria-label={ariaLabel}
      style={portal ? menuPosition : undefined}
      className={cn(
        'scrollbar-compact z-[140] min-w-full overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.12)]',
        portal ? 'fixed' : 'absolute top-full mt-1.5 max-h-64',
        !portal && (align === 'right' ? 'right-0' : 'left-0'),
        menuClassName
      )}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const isActive = index === activeIndex;
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={option.disabled}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(option)}
            className={cn(
              'flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45',
              isSelected ? 'bg-primary/[0.055]' : isActive ? 'bg-ink-50' : 'hover:bg-ink-50'
            )}
          >
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-[11px] font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                {option.label}
              </span>
              {option.description && <span className="mt-0.5 block truncate text-[9px] font-medium text-muted-foreground">{option.description}</span>}
            </span>
            {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={cn('relative', className)}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          move(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          move(-1);
        } else if (event.key === 'Enter' && open) {
          event.preventDefault();
          const option = options[activeIndex];
          if (option) choose(option);
        } else if (event.key === 'Home' && open) {
          event.preventDefault();
          setActiveIndex(0);
        } else if (event.key === 'End' && open) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => open ? setOpen(false) : openMenu()}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-border bg-card text-left font-medium text-foreground shadow-none transition-colors hover:border-ink-300 focus-visible:border-ink-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/[0.06] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
          size === 'compact' ? 'h-9 px-2.5 text-[11px]' : 'h-10 px-3 text-[13px]',
          triggerClassName
        )}
      >
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">{selected?.label || ariaLabel}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {portal ? (menu && createPortal(menu, document.body)) : menu}
    </div>
  );
}

export default DropdownSelect;
