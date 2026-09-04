import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Check, ChevronDown, FileSpreadsheet, Plus, Search, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FormField } from '../../types';

interface MultiSelectFieldProps {
  field: FormField;
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  options?: { label: string; value: string }[];
}

/** How many chips are drawn before the rest collapse into a "+N more" pill. */
const MAX_VISIBLE_CHIPS = 6;
const MENU_MAX_HEIGHT = 288;
const MENU_GAP = 6;

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'top' | 'bottom';
}

/**
 * Multi-select.
 *
 * Two things were wrong with the previous version and both are structural, so
 * this is a rewrite rather than a restyle:
 *
 *  - The menu was an absolutely positioned child, so any scrolling ancestor -
 *    the builder canvas, a dialog body, the public form card - clipped it and
 *    the list spilled out of its container. It is now rendered into a portal
 *    and positioned against the control's viewport rectangle, flipping above
 *    the trigger when there is no room below.
 *  - The trigger grew without limit as options were chosen. Chips are capped,
 *    the overflow collapses into a count, and the control keeps a stable
 *    height so surrounding layout never jumps.
 *
 * The search box is focused on open and filters on both label and value, with
 * full keyboard support (arrows, enter, escape, backspace to unpick).
 */
export function MultiSelectField({
  field,
  value = [],
  onChange,
  placeholder = 'Select options',
  disabled = false,
  hideLabel = false,
  options: optionsProp,
}: MultiSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const resolvedOptions = useMemo(() => optionsProp ?? field.options ?? [], [optionsProp, field.options]);

  const selectedOptions = useMemo(
    () => resolvedOptions.filter((option) => value.includes(option.value)),
    [resolvedOptions, value]
  );

  const query = searchTerm.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      resolvedOptions.filter(
        (option) =>
          !query ||
          option.label.toLowerCase().includes(query) ||
          option.value.toLowerCase().includes(query)
      ),
    [resolvedOptions, query]
  );

  const allowClearAll = field.validation?.allowClearAll !== false;
  const showCount = field.validation?.showCount === true;

  const visibleChips = selectedOptions.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenChipCount = selectedOptions.length - visibleChips.length;

  // ------------------------------------------------------------- positioning
  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - MENU_GAP * 2;
    const above = rect.top - MENU_GAP * 2;
    // Flip above the trigger only when that genuinely gives more room.
    const placeAbove = below < Math.min(MENU_MAX_HEIGHT, 220) && above > below;
    const room = placeAbove ? above : below;

    setPosition({
      top: placeAbove ? rect.top - MENU_GAP : rect.bottom + MENU_GAP,
      left: rect.left,
      width: rect.width,
      // Never taller than the space it has: the list scrolls instead of
      // running off the edge of the viewport.
      maxHeight: Math.max(140, Math.min(MENU_MAX_HEIGHT, room)),
      placement: placeAbove ? 'top' : 'bottom',
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    reposition();
  }, [isOpen, reposition]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = () => reposition();
    // `true` so the menu tracks any scrolling ancestor, not just the window.
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [isOpen, reposition]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Focus after paint so the caret lands in the search field, not the trigger.
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  // Derived, not stored: filtering can shrink the list under the cursor, and
  // clamping here avoids a render pass that only exists to correct state.
  const highlightedIndex = Math.min(activeIndex, Math.max(filteredOptions.length - 1, 0));

  // ----------------------------------------------------------------- actions
  const openMenu = () => {
    if (disabled) return;
    setSearchTerm('');
    setActiveIndex(0);
    setIsOpen(true);
  };

  const toggleOption = (optionValue: string) => {
    if (disabled) return;
    const next = value.includes(optionValue)
      ? value.filter((item) => item !== optionValue)
      : [...value, optionValue];
    onChange?.(next);
  };

  const removeOption = (optionValue: string) => {
    if (disabled) return;
    onChange?.(value.filter((item) => item !== optionValue));
  };

  const clearAll = () => {
    if (disabled) return;
    onChange?.([]);
  };

  const selectAllVisible = () => {
    if (disabled) return;
    const merged = new Set(value);
    filteredOptions.forEach((option) => merged.add(option.value));
    onChange?.([...merged]);
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (filteredOptions.length ? (index + 1) % filteredOptions.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        filteredOptions.length ? (index - 1 + filteredOptions.length) % filteredOptions.length : 0
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) toggleOption(option.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    } else if (event.key === 'Backspace' && !searchTerm && value.length > 0) {
      removeOption(value[value.length - 1]);
    }
  };

  const summary = showCount && selectedOptions.length > 0
    ? `${selectedOptions.length} of ${resolvedOptions.length} selected`
    : null;

  // ------------------------------------------------------------------ render
  const menu = isOpen && position && !disabled
    ? createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          style={{
            position: 'fixed',
            top: position.placement === 'bottom' ? position.top : undefined,
            bottom: position.placement === 'top' ? window.innerHeight - position.top : undefined,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            zIndex: 130,
          }}
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-xl shadow-foreground/10"
        >
          <div className="shrink-0 border-b border-border/70 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search options…"
                aria-label="Search options"
                className="h-8 rounded-lg border-input pl-8 pr-7 text-[13px]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    searchRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="scrollbar-compact min-h-0 flex-1 overflow-y-auto p-1.5">
            {filteredOptions.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-[13px] font-medium text-muted-foreground">
                {resolvedOptions.length === 0 ? 'No options configured' : 'No options match your search'}
              </p>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = value.includes(option.value);
                const isActive = index === highlightedIndex;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => toggleOption(option.value)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                      isActive ? 'bg-muted' : 'bg-transparent',
                      isSelected ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-[0.25rem] border transition-colors',
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>

          {(allowClearAll || filteredOptions.length > 1) && resolvedOptions.length > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/70 px-2 py-1.5">
              <span className="truncate text-[11px] font-medium text-muted-foreground">
                {selectedOptions.length} selected
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {filteredOptions.length > 1 && (
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/[0.07]"
                  >
                    {query ? 'Select matches' : 'Select all'}
                  </button>
                )}
                {allowClearAll && selectedOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div className="min-w-0 space-y-2">
      {!hideLabel && (
        <Label>
          {field.label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </Label>
      )}

      <div
        ref={triggerRef}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        aria-disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            openMenu();
          }
        }}
        className={cn(
          'flex min-h-[2.5rem] w-full min-w-0 items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-left transition-colors',
          disabled
            ? 'cursor-not-allowed border-input opacity-60'
            : 'cursor-pointer border-input hover:border-primary/45',
          isOpen && !disabled && 'border-primary ring-2 ring-ring/25'
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selectedOptions.length === 0 ? (
            <span className="truncate text-[13px] text-muted-foreground">{placeholder}</span>
          ) : (
            <>
              {visibleChips.map((option) => (
                <span
                  key={option.value}
                  className="flex max-w-[12rem] items-center gap-1 rounded-md border border-primary/15 bg-primary/[0.07] py-0.5 pl-2 pr-1 text-[12px] font-medium text-primary"
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeOption(option.value);
                      }}
                      aria-label={`Remove ${option.label}`}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors hover:bg-primary/15"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {hiddenChipCount > 0 && (
                <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[12px] font-semibold text-muted-foreground">
                  +{hiddenChipCount} more
                </span>
              )}
            </>
          )}
        </div>

        {!disabled && selectedOptions.length > 0 && allowClearAll && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              clearAll();
            }}
            aria-label="Clear all selections"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </div>

      {summary && <p className="text-[11px] font-medium text-muted-foreground">{summary}</p>}

      {/* Help text belongs to the field wrapper, which already renders it; only
          a standalone instance (one drawing its own label) prints it here. */}
      {!hideLabel && field.helpText && (
        <p className="text-[13px] text-muted-foreground">{field.helpText}</p>
      )}

      {menu}
    </div>
  );
}

// Configuration component for multi-select field in the form builder
export function MultiSelectConfig({ field, onUpdate, onBulkImport }: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onBulkImport?: () => void;
}) {
  const handleAddOption = () => {
    const newOption = { label: `Option ${(field.options?.length || 0) + 1}`, value: `option_${Date.now()}` };
    const updatedOptions = [...(field.options || []), newOption];
    onUpdate({ options: updatedOptions });
  };

  const handleUpdateOption = (index: number, updates: { label?: string; value?: string }) => {
    const updatedOptions = [...(field.options || [])];
    updatedOptions[index] = { ...updatedOptions[index], ...updates };
    onUpdate({ options: updatedOptions });
  };

  const handleDeleteOption = (index: number) => {
    const updatedOptions = field.options?.filter((_, i) => i !== index) || [];
    onUpdate({ options: updatedOptions });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Options</Label>
          {onBulkImport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkImport}
              className="h-7 text-[10px] gap-1 px-2"
            >
              <FileSpreadsheet className="h-3 w-3" />
              Bulk Import (CSV)
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {field.options?.map((option, index) => (
            <div key={option.value} className="flex items-center gap-2">
              <Input
                value={option.label}
                onChange={(e) => handleUpdateOption(index, { label: e.target.value })}
                placeholder="Option label"
                className="flex-1"
              />
              <Input
                value={option.value}
                onChange={(e) => handleUpdateOption(index, { value: e.target.value })}
                placeholder="Option value"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteOption(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddOption}
            className="h-8 w-full text-[12px]"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Option
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Multi-Select Settings</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allow-clear-all"
              className="h-4 w-4"
              checked={field.validation?.allowClearAll !== false}
              onChange={(e) => onUpdate({
                validation: {
                  ...field.validation,
                  allowClearAll: e.target.checked
                }
              })}
            />
            <Label htmlFor="allow-clear-all" className="text-sm">
              Allow &quot;Clear all&quot;
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-count"
              className="h-4 w-4"
              checked={field.validation?.showCount || false}
              onChange={(e) => onUpdate({
                validation: {
                  ...field.validation,
                  showCount: e.target.checked
                }
              })}
            />
            <Label htmlFor="show-count" className="text-sm">
              Show selected count
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
