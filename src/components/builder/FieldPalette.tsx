import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Search, GripVertical, Plus } from 'lucide-react';
import type { FormField } from '../../types';
import { cn } from '../../lib/utils';
import { FIELD_ICONS, getFieldTypeLabel } from './fieldMeta';

interface FieldPaletteProps {
  onAddField: (type: FormField['type']) => void;
}

type Category = {
  id: string;
  label: string;
  types: FormField['type'][];
};

const CATEGORIES: Category[] = [
  {
    id: 'inputs',
    label: 'Inputs',
    types: ['text', 'email', 'phone', 'number', 'date', 'time', 'textarea'],
  },
  {
    id: 'choices',
    label: 'Choices',
    types: ['select', 'radio', 'checkbox', 'multiselect'],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    types: ['file', 'rating', 'signature', 'display', 'html', 'table'],
  },
];

function FieldTile({ type, onAddField, search }: {
  type: FormField['type'];
  onAddField: (type: FormField['type']) => void;
  search: string;
}) {
  const Icon = FIELD_ICONS[type] || type;
  const label = getFieldTypeLabel(type);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `new-${type}`,
    data: { type, isNew: true },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 40 }
    : undefined;

  // Filter on search
  if (search && !label.toLowerCase().includes(search.toLowerCase())) {
    return null;
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Add ${label} field`}
        onClick={() => onAddField(type)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAddField(type);
          }
        }}
        className={cn(
          'group flex cursor-grab items-center gap-2.5 rounded-md border border-border bg-background px-2.5 py-2',
          'text-[13px] font-medium text-foreground shadow-sm transition-all',
          'hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-sm active:cursor-grabbing',
          isDragging && 'opacity-50'
        )}
      >
        <button
          {...listeners}
          aria-hidden="true"
          tabIndex={-1}
          className="cursor-grab touch-none p-0.5 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 truncate">{label}</span>
        <Plus className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-hover:text-brand-600" />
      </div>
    </div>
  );
}

export default function FieldPalette({ onAddField }: FieldPaletteProps) {
  const [search, setSearch] = useState('');

  const visibleCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.map((c) => ({
      ...c,
      types: c.types.filter((t) => getFieldTypeLabel(t).toLowerCase().includes(q)),
    })).filter((c) => c.types.length > 0);
  }, [search]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground">Form Fields</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Click to add or drag to the canvas
        </p>
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields…"
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-[13px] shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 scrollbar-subtle">
        {visibleCategories.length === 0 && (
          <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">
            No fields match “{search}”.
          </p>
        )}
        {visibleCategories.map((cat) => (
          <div key={cat.id}>
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {cat.label}
            </p>
            <div className="space-y-1.5">
              {cat.types.map((type) => (
                <FieldTile key={type} type={type} onAddField={onAddField} search={search} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
