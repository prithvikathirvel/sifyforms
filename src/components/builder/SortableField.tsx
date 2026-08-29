import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlignLeft,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  Circle,
  Clock,
  Code,
  FileText,
  GripVertical,
  Hash,
  ListPlus,
  Mail,
  MoreHorizontal,
  PenTool,
  Phone,
  Star,
  Table,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import type { FormField } from '../../types';
import { cn } from '../../lib/utils';

interface SortableFieldProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

type FieldMeta = {
  label: string;
  icon: ElementType;
};

const FIELD_META: Record<FormField['type'], FieldMeta> = {
  text: { label: 'Text input', icon: Type },
  email: { label: 'Email', icon: Mail },
  phone: { label: 'Phone', icon: Phone },
  number: { label: 'Number', icon: Hash },
  select: { label: 'Dropdown', icon: ChevronDown },
  radio: { label: 'Radio buttons', icon: Circle },
  checkbox: { label: 'Checkboxes', icon: CheckSquare },
  multiselect: { label: 'Multi-select', icon: ListPlus },
  date: { label: 'Date picker', icon: Calendar },
  time: { label: 'Time picker', icon: Clock },
  textarea: { label: 'Long text', icon: AlignLeft },
  file: { label: 'File upload', icon: Upload },
  rating: { label: 'Rating', icon: Star },
  signature: { label: 'Signature', icon: PenTool },
  html: { label: 'Instructions', icon: Code },
  display: { label: 'Display value', icon: FileText },
  table: { label: 'Table grid', icon: Table },
};

function PreviewControl({ field }: { field: FormField }): ReactNode {
  const options = field.options?.slice(0, 3) ?? [];

  switch (field.type) {
    case 'textarea':
      return (
        <div className="h-12 rounded-md border border-input bg-background px-3 py-2">
          <div className="h-1.5 w-3/4 rounded-full bg-muted" />
          <div className="mt-2 h-1.5 w-1/2 rounded-full bg-muted" />
        </div>
      );
    case 'select':
      return (
        <div className="flex h-9 items-center justify-between rounded-md border border-input bg-background px-3 text-xs text-muted-foreground">
          <span>{field.placeholder || 'Select an option'}</span>
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
      );
    case 'radio':
    case 'checkbox':
    case 'multiselect':
      return (
        <div className="space-y-1.5">
          {options.length > 0 ? options.map((option, index) => (
            <div key={`${option.value}-${index}`} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn('h-3.5 w-3.5 rounded border border-input bg-background', field.type === 'radio' && 'rounded-full')} />
              <span className="truncate">{option.label}</span>
            </div>
          )) : <span className="text-xs text-muted-foreground">Add options in the inspector</span>}
          {(field.options?.length ?? 0) > 3 && <span className="text-[11px] font-semibold text-primary">+{field.options!.length - 3} more options</span>}
        </div>
      );
    case 'file':
      return (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Choose a file or drop it here</span>
        </div>
      );
    case 'signature':
      return (
        <div className="flex h-12 items-end rounded-md border border-input bg-background px-3 pb-2">
          <div className="w-1/2 border-b border-dashed border-muted-foreground/50" />
          <span className="ml-auto text-[10px] text-muted-foreground">Signature</span>
        </div>
      );
    case 'rating':
      return (
        <div className="flex items-center gap-1 text-primary/70" aria-label="Rating scale preview">
          {[0, 1, 2, 3, 4].map((star) => <Star key={star} className="h-4 w-4" fill="currentColor" aria-hidden="true" />)}
        </div>
      );
    case 'table':
      return (
        <div className="overflow-hidden rounded-md border border-input bg-background text-[10px] text-muted-foreground">
          <div className="grid grid-cols-3 border-b border-border bg-muted/50 px-2 py-1 font-semibold">
            <span>Column 1</span><span>Column 2</span><span>Column 3</span>
          </div>
          <div className="grid grid-cols-3 gap-1 px-2 py-1.5"><span className="h-2 rounded bg-muted" /><span className="h-2 rounded bg-muted" /><span className="h-2 rounded bg-muted" /></div>
        </div>
      );
    case 'display':
      return (
        <div className="flex items-center gap-2 rounded-md border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-primary">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Calculated value</span>
        </div>
      );
    case 'html':
      return (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Instructions or supporting content
        </div>
      );
    case 'date':
    case 'time':
    case 'email':
    case 'phone':
    case 'number':
    case 'text':
    default:
      return (
        <div className="flex h-9 items-center rounded-md border border-input bg-background px-3 text-xs text-muted-foreground">
          {field.placeholder || `Enter ${FIELD_META[field.type].label.toLowerCase()}`}
        </div>
      );
  }
}

function getStateBadges(field: FormField): string[] {
  const badges: string[] = [];
  if (field.required) badges.push('Required');
  if (field.unique) badges.push('Unique');
  if (field.showWhen?.conditions?.length) badges.push('Logic');
  if (field.rules?.length || field.validation) badges.push('Validated');
  if (field.fileConfig || field.supportDocuments?.length) badges.push('File policy');
  if (field.correctAnswer !== undefined || field.points !== undefined) badges.push('Score');
  if (field.isPollQuestion) badges.push('Poll');
  return badges;
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
  const MetaIcon = FIELD_META[field.type].icon;
  const stateBadges = getStateBadges(field);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      data-selected={isSelected}
      aria-label={`${field.label}, ${FIELD_META[field.type].label}${field.required ? ', required' : ''}`}
      className={cn(
        'group relative rounded-xl border bg-card p-3.5 shadow-sm outline-none transition-[border-color,box-shadow,background-color,transform] duration-150',
        'hover:border-primary/30 hover:shadow-md',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isSelected && 'border-primary/70 bg-primary/[0.025] shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]',
        isDragging && 'z-20 opacity-70 shadow-lg'
      )}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Reorder ${field.label}`}
          className="mt-0.5 flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/5 text-primary" aria-hidden="true">
          <MetaIcon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold tracking-tight text-foreground">{field.label || 'Untitled field'}</span>
                {field.required && <span className="text-sm font-bold text-destructive" aria-label="required">*</span>}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{FIELD_META[field.type].label}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate font-mono text-[10px]">{field.id}</span>
              </div>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`More actions for ${field.label}`}>
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                aria-label={`Delete ${field.label}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="ml-[4.75rem] mt-3">
        <PreviewControl field={field} />
        {(field.helpText || stateBadges.length > 0) && (
          <div className="mt-2.5 flex min-h-5 flex-wrap items-center gap-1.5">
            {field.helpText && <span className="mr-1 truncate text-[11px] text-muted-foreground">{field.helpText}</span>}
            {stateBadges.map((badge) => (
              <span key={badge} className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                badge === 'Required' ? 'border-destructive/20 bg-destructive/5 text-destructive' : 'border-border bg-muted/60 text-muted-foreground'
              )}>
                {badge === 'Required' && <Check className="h-2.5 w-2.5" aria-hidden="true" />}
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>

      {isSelected && <span className="absolute -left-px top-4 h-8 w-0.5 rounded-r-full bg-primary" aria-hidden="true" />}
    </article>
  );
}
