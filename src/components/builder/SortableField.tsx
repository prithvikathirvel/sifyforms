import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../ui/button';
import { GripVertical, Trash2 } from 'lucide-react';
import type { FormField } from '../../types';
import { cn } from '../../lib/utils';

interface SortableFieldProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  email: 'Email',
  phone: 'Phone',
  number: 'Number',
  select: 'Dropdown',
  radio: 'Radio',
  checkbox: 'Checkbox',
  multiselect: 'Multi-Select',
  date: 'Date',
  time: 'Time',
  textarea: 'Long Text',
  file: 'File',
  rating: 'Rating',
  signature: 'Signature',
  html: 'HTML',
  display: 'Display Value',
  table: 'Table Grid',
};

export default function SortableField({ field, isSelected, onSelect, onDelete }: SortableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        'group relative rounded-lg border bg-card transition-all',
        isSelected
          ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary))]'
          : 'border-border hover:border-primary/40',
        isDragging && 'opacity-50'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-1 px-2 py-2.5">
        {/* Drag handle */}
        <button
          {...listeners}
          className="mt-0.5 flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Field body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-foreground">
              {field.label || 'Untitled field'}
            </span>
            {field.required && <span className="text-destructive">*</span>}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded border border-border bg-muted/50 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {FIELD_TYPE_LABELS[field.type] || field.type}
            </span>
            {field.placeholder && (
              <span className="truncate text-[11px] text-muted-foreground">
                {field.placeholder}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete field"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
