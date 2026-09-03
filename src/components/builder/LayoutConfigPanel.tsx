import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import {
  Plus,
  Trash2,
  FileText,
  Layers,
  Lock,
  RectangleVertical,
  RectangleHorizontal,
  ChevronUp,
  ChevronDown,
  Check,
} from 'lucide-react';
import type { FormLayout, FormStep, FormField } from '../../types';
import { cn } from '../../lib/utils';

interface LayoutConfigPanelProps {
  layout: FormLayout;
  fields: FormField[];
  onSetLayoutMode: (mode: 'singlePage' | 'multiStep') => void;
  onUpdateLayout: (updates: Partial<FormLayout>) => void;
  onAddStep: () => void;
  onRemoveStep: (stepId: string) => void;
  onUpdateStep: (stepId: string, updates: Partial<FormStep>) => void;
  onAssignFieldsToStep: (stepId: string, fieldIds: string[]) => void;
  onReorderStep: (oldIndex: number, newIndex: number) => void;
}

/** A selectable option card used for the two/three-way layout pickers. */
function OptionCard({
  selected,
  onClick,
  icon,
  title,
  subtitle,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'relative flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center transition-all',
        selected
          ? 'border-primary bg-primary/[0.04] shadow-[0_0_0_1px_hsl(var(--primary))]'
          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
      )}
    >
      {selected && (
        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      )}
      {icon !== null && (
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', selected ? 'text-primary' : 'text-muted-foreground')}>
          {icon}
        </span>
      )}
      <span className="text-sm font-semibold text-foreground">{title}</span>
      {subtitle && <span className="text-[11px] leading-snug text-muted-foreground">{subtitle}</span>}
      {children}
    </button>
  );
}

function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <Label className="block text-sm font-semibold text-foreground">{title}</Label>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Accessible switch. Uses rem-based sizing and a padded track so the thumb stays
 * contained at every breakpoint (the app's density scaling shrinks rems on
 * laptops, so fixed-px offsets previously let the thumb escape the track).
 */
function Toggle({
  checked,
  onChange,
  activeClass = 'bg-primary',
  size = 'md',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  activeClass?: string;
  size?: 'md' | 'sm';
}) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const thumb = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const travel = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('relative shrink-0 rounded-full p-0.5 transition-colors', track, checked ? activeClass : 'bg-muted')}
    >
      <span className={cn('block rounded-full bg-white shadow-sm transition-transform', thumb, checked ? travel : 'translate-x-0')} />
    </button>
  );
}

export default function LayoutConfigPanel({
  layout,
  fields,
  onSetLayoutMode,
  onUpdateLayout,
  onAddStep,
  onRemoveStep,
  onUpdateStep,
  onAssignFieldsToStep,
  onReorderStep,
}: LayoutConfigPanelProps) {
  const steps = [...(layout.steps || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const isMultiStep = layout.mode === 'multiStep';
  const orientation = layout.orientation || 'vertical';
  const stepperStyle = layout.stepperStyle || 'progress';
  const assignedIds = new Set(steps.flatMap((s) => s.fieldIds));
  const unassignedFields = fields.filter((f) => !assignedIds.has(f.id));

  return (
    <div className="grid min-h-full grid-cols-1 content-start bg-card lg:grid-cols-2 [&>section]:border-b [&>section]:border-border/70 [&>section]:p-5 sm:[&>section]:p-6 lg:[&>section:nth-child(odd)]:border-r lg:[&>section:only-child]:col-span-2 lg:[&>section:only-child]:!border-r-0">
      {/* ── Form type ─────────────────────────────────────────── */}
      <section>
        <SectionLabel title="Form type" hint="Choose how respondents move through your form." />
        <div className="grid grid-cols-2 gap-3">
          <OptionCard
            selected={layout.mode === 'singlePage'}
            onClick={() => onSetLayoutMode('singlePage')}
            icon={<FileText className="h-5 w-5" />}
            title="Single page"
            subtitle="All fields on one scrollable page"
          />
          <OptionCard
            selected={layout.mode === 'multiStep'}
            onClick={() => onSetLayoutMode('multiStep')}
            icon={<Layers className="h-5 w-5" />}
            title="Multi-step"
            subtitle="Split fields into guided steps"
          />
        </div>
      </section>

      {/* ── Page width ────────────────────────────────────────── */}
      <section>
        <SectionLabel title="Page layout" hint="Controls how wide the form renders." />
        <div className="grid grid-cols-2 gap-3">
          <OptionCard
            selected={orientation === 'vertical'}
            onClick={() => onUpdateLayout({ orientation: 'vertical' })}
            icon={<RectangleVertical className="h-5 w-5" />}
            title="Vertical"
            subtitle="Narrow, centered card"
          />
          <OptionCard
            selected={orientation === 'horizontal'}
            onClick={() => onUpdateLayout({ orientation: 'horizontal' })}
            icon={<RectangleHorizontal className="h-5 w-5" />}
            title="Horizontal"
            subtitle="Full width, fields side by side"
          />
        </div>
      </section>

      {/* ── Stepper style (multi-step only) ───────────────────── */}
      {isMultiStep && (
        <section>
          <SectionLabel title="Progress indicator" hint="How step progress is shown to respondents." />
          <div className="grid grid-cols-3 gap-3">
            <OptionCard
              selected={stepperStyle === 'progress'}
              onClick={() => onUpdateLayout({ stepperStyle: 'progress' })}
              icon={null}
              title="Progress"
              subtitle="Segmented bar"
            >
              <span className="flex w-full gap-1">
                <span className="h-1.5 flex-1 rounded-full bg-primary" />
                <span className="h-1.5 flex-1 rounded-full bg-primary/40" />
                <span className="h-1.5 flex-1 rounded-full bg-muted" />
              </span>
            </OptionCard>
            <OptionCard
              selected={stepperStyle === 'circles'}
              onClick={() => onUpdateLayout({ stepperStyle: 'circles' })}
              icon={null}
              title="Steps"
              subtitle="Numbered circles"
            >
              <span className="flex w-full items-center gap-1">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">1</span>
                <span className="h-0.5 flex-1 rounded-full bg-primary/40" />
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted text-[9px] font-bold text-muted-foreground">2</span>
                <span className="h-0.5 flex-1 rounded-full bg-muted" />
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted text-[9px] font-bold text-muted-foreground">3</span>
              </span>
            </OptionCard>
            <OptionCard
              selected={stepperStyle === 'minimal'}
              onClick={() => onUpdateLayout({ stepperStyle: 'minimal' })}
              icon={null}
              title="Minimal"
              subtitle="Step X of Y text"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Step 1 of 3</span>
            </OptionCard>
          </div>
        </section>
      )}

      {/* ── Back navigation (multi-step only) ─────────────────── */}
      {isMultiStep && (
        <section>
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Allow going back</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Respondents can return to previous steps.</p>
            </div>
            <Toggle
              checked={layout.allowBackNavigation !== false}
              onChange={(next) => onUpdateLayout({ allowBackNavigation: next })}
            />
          </div>
        </section>
      )}

      {/* ── Steps configuration (multi-step only) ─────────────── */}
      {isMultiStep && (
        <section className="lg:col-span-2 lg:!border-r-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionLabel title="Steps" hint="Organize fields into the order respondents see them." />
            <Button variant="outline" size="sm" onClick={onAddStep} className="h-8 shrink-0 gap-1.5 rounded-lg px-3 text-[12px]">
              <Plus className="h-3.5 w-3.5" />
              Add step
            </Button>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => {
              const stepFieldIds = new Set(step.fieldIds);
              return (
                <Card key={step.id} className="rounded-lg border border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {/* Header row: number, title, controls */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Input
                            value={step.title ?? ''}
                            onChange={(e) => onUpdateStep(step.id, { title: e.target.value })}
                            placeholder={`Step ${index + 1} title`}
                            className="h-8 border-none px-1 text-sm font-semibold shadow-none focus-visible:ring-0"
                          />
                        </div>
                        <div className="flex shrink-0 items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onReorderStep(index, index - 1)}
                            disabled={index === 0}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            aria-label="Move step up"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onReorderStep(index, index + 1)}
                            disabled={index === steps.length - 1}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            aria-label="Move step down"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveStep(step.id)}
                            disabled={steps.length <= 1}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            aria-label="Delete step"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <Input
                        value={step.description || ''}
                        onChange={(e) => onUpdateStep(step.id, { description: e.target.value })}
                        placeholder="Step description (optional)"
                        className="text-sm"
                      />

                      {/* Lock on complete */}
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <div className="flex min-w-0 items-start gap-2">
                          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                          <div>
                            <p className="text-xs font-medium text-amber-900">Lock step after confirming</p>
                            <p className="mt-0.5 text-[11px] text-amber-700">
                              Respondents confirm before advancing and cannot edit this step afterwards.
                            </p>
                          </div>
                        </div>
                        <Toggle
                          checked={step.lockOnComplete === true}
                          onChange={(next) => onUpdateStep(step.id, { lockOnComplete: next })}
                          activeClass="bg-amber-500"
                          size="sm"
                        />
                      </div>

                      {/* Field assignment */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-muted-foreground">Fields in this step</Label>
                          <span className="text-[11px] text-muted-foreground">{step.fieldIds.length} fields</span>
                        </div>
                        <div className="max-h-[26vh] space-y-1 overflow-y-auto rounded-lg border bg-background p-2">
                          {fields.length === 0 ? (
                            <p className="py-6 text-center text-xs text-muted-foreground">No fields yet — add fields to your form first.</p>
                          ) : (
                            fields.map((field) => {
                              const checked = stepFieldIds.has(field.id);
                              const otherStep = !checked
                                ? steps.find((s) => s.id !== step.id && s.fieldIds.includes(field.id))
                                : undefined;

                              // Field already lives in another step — not selectable here.
                              if (otherStep) {
                                return (
                                  <div
                                    key={field.id}
                                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
                                    title={`Allocated to ${otherStep.title || `Step ${otherStep.order + 1}`}`}
                                  >
                                    <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                                    <span className="min-w-0 flex-1 truncate">{field.label || 'Untitled field'}</span>
                                    <span className="shrink-0 text-[10px] font-medium uppercase text-muted-foreground">{field.type}</span>
                                    <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 text-[9px] font-semibold text-ink-600">
                                      In {otherStep.title || `Step ${otherStep.order + 1}`}
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <label
                                  key={field.id}
                                  className={cn(
                                    'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50',
                                    checked && 'bg-primary/[0.04]'
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const newIds = e.target.checked
                                        ? [...step.fieldIds, field.id]
                                        : step.fieldIds.filter((id) => id !== field.id);
                                      onAssignFieldsToStep(step.id, newIds);
                                    }}
                                    className="h-4 w-4 rounded border-primary"
                                  />
                                  <span className="min-w-0 flex-1 truncate">{field.label || 'Untitled field'}</span>
                                  <span className="shrink-0 text-[10px] font-medium uppercase text-muted-foreground">{field.type}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {unassignedFields.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">{unassignedFields.length} field{unassignedFields.length === 1 ? '' : 's'}</span>{' '}
                not assigned to any step and will be hidden on the published form.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
