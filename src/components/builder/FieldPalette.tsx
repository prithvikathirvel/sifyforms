import { useMemo, useState, type ElementType } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Code,
  FileText,
  Hash,
  ListPlus,
  Mail,
  PenTool,
  Phone,
  Plus,
  Search,
  Star,
  Table,
  Type,
  Upload,
  X,
} from 'lucide-react';
import type { FormField } from '../../types';
import { cn } from '../../lib/utils';

interface FieldPaletteProps {
  onAddField: (type: FormField['type']) => void;
}

type PaletteItem = {
  type: FormField['type'];
  label: string;
  description: string;
  icon: ElementType;
};

type PaletteGroup = {
  label: string;
  description: string;
  items: PaletteItem[];
};

const paletteGroups: PaletteGroup[] = [
  {
    label: 'Essentials',
    description: 'The building blocks for most forms',
    items: [
      { type: 'text', label: 'Text input', description: 'Short answer', icon: Type },
      { type: 'email', label: 'Email', description: 'Validated email', icon: Mail },
      { type: 'phone', label: 'Phone', description: 'Phone number', icon: Phone },
      { type: 'number', label: 'Number', description: 'Numeric value', icon: Hash },
      { type: 'textarea', label: 'Long text', description: 'Multi-line answer', icon: AlignLeft },
    ],
  },
  {
    label: 'Choices',
    description: 'Let respondents select an answer',
    items: [
      { type: 'select', label: 'Dropdown', description: 'One option from a list', icon: ChevronDown },
      { type: 'radio', label: 'Radio buttons', description: 'One visible option', icon: Circle },
      { type: 'checkbox', label: 'Checkboxes', description: 'Multiple options', icon: CheckSquare },
      { type: 'multiselect', label: 'Multi-select', description: 'Searchable choices', icon: ListPlus },
    ],
  },
  {
    label: 'Date & files',
    description: 'Structured inputs and documents',
    items: [
      { type: 'date', label: 'Date picker', description: 'Calendar date', icon: Calendar },
      { type: 'time', label: 'Time picker', description: 'Time of day', icon: Clock },
      { type: 'file', label: 'File upload', description: 'Collect a document', icon: Upload },
      { type: 'signature', label: 'Signature', description: 'Draw or sign', icon: PenTool },
    ],
  },
  {
    label: 'Advanced',
    description: 'Specialized form components',
    items: [
      { type: 'rating', label: 'Rating', description: 'Stars or scale', icon: Star },
      { type: 'table', label: 'Table grid', description: 'Repeatable rows', icon: Table },
      { type: 'display', label: 'Display value', description: 'Show a calculation', icon: FileText },
      { type: 'html', label: 'Instructions', description: 'Safe rich content', icon: Code },
    ],
  },
];

function DraggableFieldType({ item, onAddField }: {
  item: PaletteItem;
  onAddField: (type: FormField['type']) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `new-${item.type}`,
    data: {
      type: item.type,
      isNew: true,
    },
  });
  const Icon = item.icon;

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn('group', isDragging && 'opacity-60')}
      role="listitem"
    >
      <button
        type="button"
        onClick={() => onAddField(item.type)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-muted/60 focus-visible:border-ring focus-visible:bg-muted/60"
        aria-label={`Add ${item.label}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors group-hover:border-primary/25 group-hover:bg-primary/5 group-hover:text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-foreground">{item.label}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
        </span>
        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-primary group-focus-within:text-primary" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function FieldPalette({ onAddField }: FieldPaletteProps) {
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(paletteGroups.map((group) => [group.label, true]))
  );

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return paletteGroups;

    return paletteGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.label} ${item.description}`.toLowerCase().includes(normalizedQuery)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  const toggleGroup = (label: string) => {
    setOpenGroups((groups) => ({ ...groups, [label]: !groups[label] }));
  };

  return (
    <aside className="flex h-full min-h-0 flex-col bg-card" aria-label="Field library">
      <div className="border-b border-border/70 px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Build</p>
            <h2 className="mt-1 text-sm font-bold tracking-tight text-foreground">Field library</h2>
          </div>
          <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            {paletteGroups.reduce((count, group) => count + group.items.length, 0)} types
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Click to add or drag a field onto your form.</p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search fields"
            aria-label="Search field types"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear field search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3" role="list">
        {filteredGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center">
            <Search className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-xs font-semibold text-foreground">No fields found</p>
            <button type="button" onClick={() => setQuery('')} className="mt-1 text-xs font-semibold text-primary hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group) => {
              const isOpen = openGroups[group.label] ?? true;
              return (
                <section key={group.label} aria-labelledby={`palette-${group.label}`}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="mb-1 flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted/50"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span id={`palette-${group.label}`} className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground">{group.label}</span>
                    <span className="ml-auto text-[10px] font-semibold text-muted-foreground">{group.items.length}</span>
                  </button>
                  {isOpen && (
                    <div className="space-y-0.5" role="list">
                      {group.items.map((item) => (
                        <DraggableFieldType key={item.type} item={item} onAddField={onAddField} />
                      ))}
                    </div>
                  )}
                  <p className="px-7 text-[10px] leading-4 text-muted-foreground">{group.description}</p>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border/70 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-muted font-bold">+</span>
          <span>Click a field to add it to the end of the form</span>
        </div>
      </div>
    </aside>
  );
}
