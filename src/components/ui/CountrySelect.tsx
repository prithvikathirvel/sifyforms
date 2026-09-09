import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { COUNTRIES, countryByIso, flagForIso, type Country } from '../../lib/countries';

interface CountrySelectProps {
  value: string | undefined;
  onChange: (iso2: string | undefined) => void;
  /** Restrict the list (defaults to every country). */
  countries?: Country[];
  className?: string;
  /**
   * Render variant:
   * - 'field'  — a boxed select, for the builder's settings rows
   * - 'inline' — a compact flag + code button, joined to a phone input
   * - 'add'    — a dashed "Add country" chip that opens the same picker
   */
  variant?: 'field' | 'inline' | 'add';
  disabled?: boolean;
}

/** Search field + list height, used to place the popover and cap its height. */
const SEARCH_HEIGHT = 52;
const LIST_GAP = 12;

/**
 * A searchable country picker with flags. One component serves the builder's
 * phone settings and the public form's country-code dropdown, so both lists
 * behave identically. Searching matches name, dial code and ISO code.
 *
 * The popover is positioned from the button's live coordinates (fixed), never
 * from a relative parent: form cards and editor columns clip absolutely
 * positioned children, and a country list that ends mid-letter behind a
 * rounded corner looks broken. It opens below the button, or above it when
 * that is where the room is.
 */
export default function CountrySelect({
  value, onChange, countries = COUNTRIES, className, variant = 'field', disabled,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; listMax: number } | null>(null);
  const selected = countryByIso(value);

  const place = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const width = Math.max(r.width, 264);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 8 - width));
    const spaceBelow = window.innerHeight - r.bottom - LIST_GAP;
    const spaceAbove = r.top - LIST_GAP;
    const openUp = spaceBelow < Math.min(200, spaceAbove);
    const listMax = Math.max(120, (openUp ? spaceAbove : spaceBelow) - SEARCH_HEIGHT);
    setPos(openUp
      ? { left, bottom: window.innerHeight - r.top + 4, listMax }
      : { left, top: r.bottom + 4, listMax });
  };

  // Open by measuring first, so the very first paint of the popover is
  // already in place (and no state is set from an effect).
  const toggle = () => {
    if (!open) place();
    setOpen(!open);
  };

  // Close on outside click / Escape. Scrolling the page closes the popover
  // rather than letting it drift from its button — but scrolling the list
  // itself must not, so scrolls inside this root are ignored.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (rootRef.current && e.target instanceof Node && rootRef.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso2.toLowerCase() === q
    );
  }, [countries, query]);

  const pick = (c: Country) => {
    onChange(c.iso2);
    setOpen(false);
    setQuery('');
  };

  const popover = open && pos && (
    <div
      className="fixed z-50 w-[264px] overflow-hidden rounded-xl border border-border bg-popover shadow-xl shadow-foreground/10"
      style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
    >
      <div className="border-b border-border/70 bg-muted/40 p-2">
        <div className="flex items-center gap-2 rounded-lg bg-background px-2.5 py-1.5 ring-1 ring-inset ring-border/70 transition-shadow focus-within:ring-2 focus-within:ring-primary/50">
          <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) pick(results[0]); }}
            placeholder="Search country or code…"
            aria-label="Search country"
            className="h-6 min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="grid h-5 w-5 flex-none place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <div
        className="overflow-y-auto p-1 scrollbar-subtle"
        role="listbox"
        style={{ maxHeight: pos.listMax }}
      >
        {results.length ? (
          results.map((c) => {
            const active = c.iso2 === value;
            return (
              <button
                key={c.iso2}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pick(c)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-accent hover:text-accent-foreground',
                  active && 'bg-accent/60 font-semibold text-foreground'
                )}
              >
                <span className="text-base leading-none">{flagForIso(c.iso2)}</span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className={cn('flex-none text-[11.5px]', active ? 'text-foreground' : 'text-ink-400')}>+{c.dial}</span>
              </button>
            );
          })
        ) : (
          <p className="px-2.5 py-4 text-center text-[12px] text-muted-foreground">No country matches.</p>
        )}
      </div>
    </div>
  );

  if (variant === 'add') {
    return (
      <div ref={rootRef} className={cn('relative flex-none', className)}>
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed border-border bg-transparent px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/50 hover:text-primary disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" />
          Add country
        </button>
        {popover}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div ref={rootRef} className={cn('relative flex-none', className)}>
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="listbox"
          title={selected ? `${selected.name} (+${selected.dial})` : 'Choose country'}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 text-[13.5px] font-medium text-foreground transition-colors hover:border-ink-300 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
        >
          <span className="text-base leading-none">{selected ? flagForIso(selected.iso2) : '🌐'}</span>
          <span className="text-ink-500">+{selected?.dial ?? '—'}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {popover}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-left text-[13.5px] text-foreground transition-colors hover:border-ink-300 focus:outline-none focus:ring-2 focus:ring-primary/30',
          open && 'border-primary ring-2 ring-primary/20'
        )}
      >
        <span className="text-base leading-none">{selected ? flagForIso(selected.iso2) : '🌐'}</span>
        <span className="min-w-0 flex-1 truncate">
          {selected ? selected.name : 'Choose a country…'}
        </span>
        {selected && <span className="flex-none text-[12px] text-ink-400">+{selected.dial}</span>}
        <ChevronDown className="h-3.5 w-3.5 flex-none text-muted-foreground" />
      </button>
      {popover}
    </div>
  );
}
