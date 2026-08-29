import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Copy, Asterisk, EyeOff } from 'lucide-react';
import type { FormField } from '../../types';
import { cn } from '../../lib/utils';
import { FieldPreview } from './FieldPreview';
import { FIELD_ICONS, getFieldTypeLabel } from './fieldMeta';

interface SortableFieldProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate?: (fieldId: string) => void;
  /** Rendered read-only with edit chrome hidden (editor Preview mode). */
  readOnly?: boolean;
}

export default function SortableField({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  readOnly = false,
}: SortableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = FIELD_ICONS[field.type] || field.type;
  const hasVisibility = field.showWhen?.conditions && field.showWhen.conditions.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(readOnly ? {} : attributes)}
      className={cn(isDragging && 'opacity-40')}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Edit field: ${field.label}`}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          'group relative cursor-pointer rounded-lg border bg-card transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isSelected
            ? 'border-brand-400/70 shadow-[0_0_0_1px_hsl(var(--ring)/0.25),0_6px_16px_-8px_hsl(var(--primary)/0.35)]'
            : 'border-border hover:border-brand-200 hover:shadow-sm'
        )}
      >
        {/* Selection highlight bar */}
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand-600 transition-opacity',
            isSelected ? 'opacity-100' : 'opacity-0'
          )}
        />

        <div className={cn('px-4 py-3', isSelected && 'bg-brand-50/30')}>
          {/* Field header */}
          <div className="mb-2.5 flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <span className="truncate">{field.label}</span>
                {field.required && (
                  <Asterisk className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Required" />
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="rounded border border-border bg-muted/40 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {getFieldTypeLabel(field.type)}
                </span>
                {hasVisibility && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <EyeOff className="h-3 w-3" /> conditional
                  </span>
                )}
              </div>
            </div>

            {/* Action bar */}
            {!readOnly && (
              <div
                className={cn(
                  'flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 shadow-sm transition-opacity',
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  {...listeners}
                  aria-label="Drag to reorder"
                  className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
                {onDuplicate && (
                  <button
                    aria-label="Duplicate field"
                    onClick={() => onDuplicate(field.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  aria-label="Delete field"
                  onClick={onDelete}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Realistic control */}
          <FieldPreview field={field} />
        </div>
      </div>
    </div>
  );
}
