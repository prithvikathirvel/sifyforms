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
    <div className="space-y-7">
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
            <button
              type="button"
              role="switch"
              aria-checked={layout.allowBackNavigation !== false}
              onClick={() => onUpdateLayout({ allowBackNavigation: layout.allowBackNavigation === false })}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors overflow-hidden',
                layout.allowBackNavigation !== false ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  layout.allowBackNavigation !== false ? 'translate-x-[20px]' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>
        </section>
      )}

      {/* ── Steps configuration (multi-step only) ─────────────── */}
      {isMultiStep && (
        <section>
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
                <Card key={step.id} className="border shadow-sm">
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
                        <button
                          type="button"
                          role="switch"
                          aria-checked={step.lockOnComplete === true}
                          onClick={() => onUpdateStep(step.id, { lockOnComplete: step.lockOnComplete !== true })}
                          className={cn(
                            'relative h-5 w-9 shrink-0 rounded-full transition-colors overflow-hidden',
                            step.lockOnComplete === true ? 'bg-amber-500' : 'bg-muted'
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                              step.lockOnComplete === true ? 'translate-x-[16px]' : 'translate-x-0.5'
                            )}
                          />
                        </button>
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
                              const isAssignedToOtherStep = !!otherStep;

                              return (
                                <label
                                  key={field.id}
                                  className={cn(
                                    'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50',
                                    checked && 'bg-primary/[0.04]',
                                    isAssignedToOtherStep && 'cursor-not-allowed opacity-60'
                                  )}
                                >
                                  {!isAssignedToOtherStep ? (
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
                                  ) : (
                                    <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 flex items-center gap-1">
                                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <path d="M17 8l-5-5-5 5"/>
                                        <path d="M12 3v12"/>
                                      </svg>
                                      Allocated
                                    </span>
                                  )}
                                  <span className="min-w-0 flex-1 truncate">{field.label || 'Untitled field'}</span>
                                  <span className="shrink-0 text-[10px] font-medium uppercase text-muted-foreground">{field.type}</span>
                                  {otherStep && (
                                    <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 text-[9px] font-semibold text-ink-600">
                                      Step {otherStep.order + 1}
                                    </span>
                                  )}
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
