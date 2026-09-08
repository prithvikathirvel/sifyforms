import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { COUNTRIES, countryByIso, countryLabel, flagForIso, type Country } from '../../lib/countries';

interface CountrySelectProps {
  value: string | undefined;
  onChange: (iso2: string | undefined) => void;
  /** Restrict the list (defaults to every country). */
  countries?: Country[];
  className?: string;
  /** Render variant: a boxed field (builder) or a compact inline button (public form). */
  variant?: 'field' | 'inline';
  disabled?: boolean;
}

/**
 * A searchable country picker with flags. One component serves the builder's
 * phone settings and the public form's country-code dropdown, so both lists
 * behave identically. Searching matches name, dial code and ISO code.
 */
export default function CountrySelect({
  value, onChange, countries = COUNTRIES, className, variant = 'field', disabled,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = countryByIso(value);

  // Close on outside click / Escape, like every other popover in the app.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
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
    onChange(c.iso2 === value ? c.iso2 : c.iso2);
    setOpen(false);
    setQuery('');
  };

  if (variant === 'inline') {
    return (
      <div ref={rootRef} className={cn('relative flex-none', className)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
          title={selected ? countryLabel(selected) : 'Choose country'}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 text-[13.5px] font-medium text-foreground transition-colors hover:border-ink-300 disabled:opacity-60"
        >
          <span className="text-base leading-none">{selected ? flagForIso(selected.iso2) : '🌐'}</span>
          <span className="text-ink-500">+{selected?.dial ?? '—'}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {open && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-xl shadow-foreground/10">
            <CountrySearch value={query} onChange={setQuery} />
            <CountryList results={results} selectedIso={value} onPick={pick} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-left text-[13.5px] text-foreground transition-colors hover:border-ink-300',
          open && 'border-primary ring-2 ring-primary/20'
        )}
      >
        <span className="text-base leading-none">{selected ? flagForIso(selected.iso2) : '🌐'}</span>
        <span className="min-w-0 flex-1 truncate">
          {selected ? countryLabel(selected) : 'Choose a country…'}
        </span>
        <ChevronDown className="h-3.5 w-3.5 flex-none text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[260px] overflow-hidden rounded-xl border border-border bg-popover shadow-xl shadow-foreground/10">
          <CountrySearch value={query} onChange={setQuery} />
          <CountryList results={results} selectedIso={value} onPick={pick} />
        </div>
      )}
    </div>
  );
}

function CountrySearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="border-b border-border/70 p-2">
      <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-2.5 transition-colors focus-within:border-primary">
        <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" />
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search country or code…"
          aria-label="Search country"
          className="h-8 min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="grid h-5 w-5 flex-none place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function CountryList({ results, selectedIso, onPick }: {
  results: Country[];
  selectedIso: string | undefined;
  onPick: (c: Country) => void;
}) {
  return (
    <div className="max-h-[264px] overflow-y-auto p-1 scrollbar-subtle" role="listbox">
      {results.length ? (
        results.map((c) => {
          const active = c.iso2 === selectedIso;
          return (
            <button
              key={c.iso2}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onPick(c)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-accent hover:text-accent-foreground',
                active && 'font-semibold text-primary'
              )}
            >
              <span className="text-base leading-none">{flagForIso(c.iso2)}</span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className={cn('flex-none text-[11.5px]', active ? 'text-primary' : 'text-ink-400')}>+{c.dial}</span>
            </button>
          );
        })
      ) : (
        <p className="px-2.5 py-4 text-center text-[12px] text-muted-foreground">No country matches.</p>
      )}
    </div>
  );
}
