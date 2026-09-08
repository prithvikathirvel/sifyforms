import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Type, AlignLeft, Circle, CheckSquare, Hash, Calendar, Upload, Star,
  Mail, Phone, Clock, ChevronDown, ListPlus, PenTool, Table, Code, Calculator,
  GripVertical, BarChart3,
} from 'lucide-react';
import type { FormField } from '../../types';
import { cn } from '../../lib/utils';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { TYPE_FRIENDLY } from './formSetup';

interface FieldPaletteProps {
  onAddField: (type: FormField['type']) => void;
}

/** v2 §3.2 — eight intentions in place of seventeen mechanisms. */
const INTENTS: { type: FormField['type']; title: string; sub: string; icon: React.ElementType }[] = [
  { type: 'text', title: 'A short answer', sub: 'Name, job title, a word or two', icon: Type },
  { type: 'textarea', title: 'A long answer', sub: 'A paragraph or more', icon: AlignLeft },
  { type: 'radio', title: 'One choice from a list', sub: 'Pick a single option', icon: Circle },
  { type: 'checkbox', title: 'Several choices', sub: 'Pick any number of options', icon: CheckSquare },
  { type: 'number', title: 'A number', sub: 'How many, how much', icon: Hash },
  { type: 'date', title: 'A date or time', sub: 'When something happens', icon: Calendar },
  { type: 'file', title: 'A file', sub: 'A document or picture', icon: Upload },
  { type: 'rating', title: 'A rating or score', sub: 'Stars, or 1 to 10', icon: Star },
];

/** Everything else, still here, behind “More question types” (v2 §4). */
const MORE_TYPES: { type: FormField['type']; icon: React.ElementType }[] = [
  { type: 'email', icon: Mail },
  { type: 'phone', icon: Phone },
  { type: 'time', icon: Clock },
  { type: 'select', icon: ChevronDown },
  { type: 'multiselect', icon: ListPlus },
  { type: 'signature', icon: PenTool },
  { type: 'table', icon: Table },
  { type: 'html', icon: Code },
  { type: 'display', icon: Calculator },
];

/** Survey questions, available when the form is a survey. */
const SURVEY_TYPES: { type: FormField['type']; icon: React.ElementType }[] = [
  { type: 'nps', icon: BarChart3 },
  { type: 'csat', icon: Star },
  { type: 'ces', icon: Calculator },
  { type: 'likert', icon: Table },
  { type: 'ranking', icon: ListPlus },
];

function IntentButton({ type, title, sub, icon: Icon, onAddField }: {
  type: FormField['type'];
  title: string;
  sub: string;
  icon: React.ElementType;
  onAddField: (type: FormField['type']) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `new-${type}`,
    data: { type, isNew: true },
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
        'group flex cursor-grab select-none items-center gap-2 rounded-lg border border-transparent bg-card px-2 py-1.5 text-left transition-colors',
        'hover:border-primary/20 hover:bg-accent active:cursor-grabbing',
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
      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md border border-border bg-muted text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-card group-hover:text-primary">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold leading-tight text-foreground">{title}</span>
        <span className="block truncate text-[10px] leading-snug text-muted-foreground">{sub}</span>
      </span>
      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/40 transition-opacity group-hover:opacity-100 md:opacity-0" />
    </div>
  );
}

function TypeChip({ type, icon: Icon, onAddField }: {
  type: FormField['type'];
  icon: React.ElementType;
  onAddField: (type: FormField['type']) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAddField(type)}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-ink-50 px-2.5 py-1 text-[10.5px] font-medium text-ink-600 transition-colors hover:border-primary/35 hover:bg-accent hover:text-primary"
    >
      <Icon className="h-3 w-3" strokeWidth={1.8} />
      {TYPE_FRIENDLY[type]}
    </button>
  );
}

export default function FieldPalette({ onAddField }: FieldPaletteProps) {
  const isSurvey = useAppSelector((state) => state.builder.settings.formType === 'survey');
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border/70 px-3.5 py-3">
        <h2 className="text-[12px] font-semibold text-foreground">Add a question</h2>
        <p className="mt-0.5 text-[10px] font-medium leading-snug text-muted-foreground">
          Drag onto the form, or click to add
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-subtle">
        <div className="space-y-px">
          {INTENTS.map((intent) => (
            <IntentButton key={intent.type} {...intent} onAddField={onAddField} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className="my-2 flex w-full items-center justify-between rounded-lg border border-dashed border-border px-2.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/35 hover:bg-accent hover:text-primary"
        >
          <span>More question types</span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', moreOpen && 'rotate-180')} />
        </button>
        {moreOpen && (
          <div className="flex flex-wrap gap-1 px-0.5 pb-2">
            {MORE_TYPES.map(({ type, icon }) => (
              <TypeChip key={type} type={type} icon={icon} onAddField={onAddField} />
            ))}
          </div>
        )}

        {isSurvey && (
          <div className="pb-2">
            <p className="px-1.5 pb-1.5 pt-2.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-400">
              Survey questions
            </p>
            <div className="flex flex-wrap gap-1 px-0.5">
              {SURVEY_TYPES.map(({ type, icon }) => (
                <TypeChip key={type} type={type} icon={icon} onAddField={onAddField} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
