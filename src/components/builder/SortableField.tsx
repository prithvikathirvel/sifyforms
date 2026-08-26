import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { GripVertical, Trash2 } from 'lucide-react';
import type { FormField } from '../../types';
import { cn } from '../../lib/utils';

interface SortableFieldProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

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

  const getFieldTypeLabel = (type: FormField['type']): string => {
    const labels: Record<string, string> = {
      text: 'Text',
      email: 'Email',
      phone: 'Phone',
      number: 'Number',
      select: 'Dropdown',
      radio: 'Radio',
      checkbox: 'Checkbox',
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
    return labels[type] || type;
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className={cn(
          'cursor-pointer transition-all',
          isSelected && 'ring-2 ring-primary',
          isDragging && 'opacity-50'
        )}
        onClick={onSelect}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <button
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{field.label}</span>
                {field.required && (
                  <span className="text-destructive">*</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {getFieldTypeLabel(field.type)}
                </Badge>
                {field.placeholder && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {field.placeholder}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
