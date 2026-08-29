import { useDraggable } from '@dnd-kit/core';
import {
  Type,
  Mail,
  Phone,
  Hash,
  ChevronDown,
  Circle,
  CheckSquare,
  Calendar,
  Clock,
  AlignLeft,
  Upload,
  Star,
  PenTool,
  Code,
  Calculator,
  ListPlus,
  Table,
  GripVertical,
} from 'lucide-react';
import type { FormField } from '../../types';
import { cn } from '../../lib/utils';

interface FieldPaletteProps {
  onAddField: (type: FormField['type']) => void;
}

const fieldTypes: { type: FormField['type']; label: string; icon: React.ElementType }[] = [
  { type: 'text', label: 'Text Input', icon: Type },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'select', label: 'Dropdown', icon: ChevronDown },
  { type: 'radio', label: 'Radio Buttons', icon: Circle },
  { type: 'checkbox', label: 'Checkboxes', icon: CheckSquare },
  { type: 'multiselect', label: 'Multi-Select', icon: ListPlus },
  { type: 'date', label: 'Date Picker', icon: Calendar },
  { type: 'time', label: 'Time Picker', icon: Clock },
  { type: 'textarea', label: 'Long Text', icon: AlignLeft },
  { type: 'file', label: 'File Upload', icon: Upload },
  { type: 'rating', label: 'Rating', icon: Star },
  { type: 'signature', label: 'Signature', icon: PenTool },
  { type: 'html', label: 'Custom HTML', icon: Code },
  { type: 'display', label: 'Display Value', icon: Calculator },
  { type: 'table', label: 'Table Grid', icon: Table },
];

function DraggableFieldType({ type, label, icon: Icon, onAddField }: {
  type: FormField['type'];
  label: string;
  icon: React.ElementType;
  onAddField: (type: FormField['type']) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `new-${type}`,
    data: {
      type,
      isNew: true,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'group flex cursor-grab select-none items-center gap-2.5 rounded-lg border border-transparent bg-card px-2.5 py-2 transition-colors',
        'hover:border-border hover:bg-muted/60 active:cursor-grabbing active:border-primary/40 active:bg-accent',
        isDragging && 'opacity-50'
      )}
      onClick={() => onAddField(type)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAddField(type);
        }
      }}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/60 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-accent group-hover:text-primary">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
        {label}
      </span>
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-opacity group-hover:opacity-100 md:opacity-0" />
    </div>
  );
}

export default function FieldPalette({ onAddField }: FieldPaletteProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border/70 px-4 py-3.5">
        <h2 className="text-[13px] font-semibold text-foreground">Form Fields</h2>
        <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
          Drag fields to the canvas or click to add
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        <div className="space-y-1">
          {fieldTypes.map(({ type, label, icon: Icon }) => (
            <DraggableFieldType
              key={type}
              type={type}
              label={label}
              icon={Icon}
              onAddField={onAddField}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
