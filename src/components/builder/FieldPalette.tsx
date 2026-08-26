import { Button } from '../ui/button';
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
        'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      <Button
        variant="ghost"
        className="w-full justify-start"
        onClick={() => onAddField(type)}
      >
        <Icon className="h-4 w-4 mr-3" />
        {label}
      </Button>
    </div>
  );
}

export default function FieldPalette({ onAddField }: FieldPaletteProps) {
  return (
    <div className="p-4">
      <h3 className="font-semibold mb-4">Form Fields</h3>
      <p className="text-xs text-muted-foreground mb-4">Drag fields to the canvas or click to add</p>
      <div className="space-y-2">
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
  );
}
