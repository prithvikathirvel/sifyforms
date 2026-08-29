import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Plus, Trash2, FileText, Layers, Lock, AlignLeft, AlignHorizontalSpaceBetween } from 'lucide-react';
import type { FormLayout, FormStep, FormField } from '../../types';

interface LayoutConfigPanelProps {
  layout: FormLayout;
  fields: FormField[];
  onSetLayoutMode: (mode: 'singlePage' | 'multiStep') => void;
  onUpdateLayout: (updates: Partial<FormLayout>) => void;
  onAddStep: () => void;
  onRemoveStep: (stepId: string) => void;
  onUpdateStep: (stepId: string, updates: Partial<FormStep>) => void;
  onAssignFieldsToStep: (stepId: string, fieldIds: string[]) => void;
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
}: LayoutConfigPanelProps) {
  const steps = layout.steps || [];
  const unassignedFieldIds = fields
    .map((f) => f.id)
    .filter((id) => !steps.some((s) => s.fieldIds.includes(id)));

  return (
    <div className="space-y-6">
      {/* Layout Mode Toggle */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-semibold text-foreground mb-3 block">Form Type</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={layout.mode === 'singlePage' ? 'default' : 'outline'}
              size="sm"
              className="flex-col h-auto py-4 px-3 gap-2 relative"
              onClick={() => onSetLayoutMode('singlePage')}
            >
              <FileText className="h-5 w-5" />
              <span className="text-sm font-medium">Single Page</span>
              <span className="text-xs text-muted-foreground">All fields on one page</span>
              {layout.mode === 'singlePage' && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                </div>
              )}
            </Button>
            <Button
              variant={layout.mode === 'multiStep' ? 'default' : 'outline'}
              size="sm"
              className="flex-col h-auto py-4 px-3 gap-2 relative"
              onClick={() => onSetLayoutMode('multiStep')}
            >
              <Layers className="h-5 w-5" />
              <span className="text-sm font-medium">Multi-Step</span>
              <span className="text-xs text-muted-foreground">Split into steps</span>
              {layout.mode === 'multiStep' && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Orientation */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-semibold text-foreground mb-3 block">Label Orientation</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={(layout.orientation || 'vertical') === 'vertical' ? 'default' : 'outline'}
              size="sm"
              className="flex-col h-auto py-4 px-3 gap-2 relative"
              onClick={() => onUpdateLayout({ orientation: 'vertical' })}
            >
              <AlignLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Vertical</span>
              <span className="text-xs text-muted-foreground">Label above the field</span>
              {(layout.orientation || 'vertical') === 'vertical' && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                </div>
              )}
            </Button>
            <Button
              variant={(layout.orientation || 'vertical') === 'horizontal' ? 'default' : 'outline'}
              size="sm"
              className="flex-col h-auto py-4 px-3 gap-2 relative"
              onClick={() => onUpdateLayout({ orientation: 'horizontal' })}
            >
              <AlignHorizontalSpaceBetween className="h-5 w-5" />
              <span className="text-sm font-medium">Horizontal</span>
              <span className="text-xs text-muted-foreground">Label beside the field</span>
              {(layout.orientation || 'vertical') === 'horizontal' && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Allow Back Navigation (multi-step only) */}
      {layout.mode === 'multiStep' && (
        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between">
            <Label htmlFor="allowBack" className="text-sm font-medium cursor-pointer">
              Allow back to previous steps
            </Label>
            <input
              id="allowBack"
              type="checkbox"
              checked={layout.allowBackNavigation !== false}
              onChange={(e) => onUpdateLayout({ allowBackNavigation: e.target.checked })}
              className="h-4 w-4 rounded border-primary"
            />
          </div>
        </div>
      )}

      {/* Multi-Step Configuration */}
      {layout.mode === 'multiStep' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold text-foreground">Form Steps</Label>
              <p className="text-xs text-muted-foreground mt-1">Organize your fields into logical steps</p>
            </div>
            <Button variant="outline" size="sm" onClick={onAddStep} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Step
            </Button>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <Card key={step.id} className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full text-primary font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Input
                          value={step.title}
                          onChange={(e) => onUpdateStep(step.id, { title: e.target.value })}
                          placeholder={`Step ${index + 1} title`}
                          className="font-medium border-none shadow-none focus-visible:ring-0 p-0 h-auto text-base"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveStep(step.id)}
                        disabled={steps.length <= 1}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Input
                      value={step.description || ''}
                      onChange={(e) => onUpdateStep(step.id, { description: e.target.value })}
                      placeholder="Step description (optional)"
                      className="text-sm bg-muted/50 border-none"
                    />

                    {/* Lock on complete */}
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <div className="flex items-start gap-2 min-w-0">
                        <Lock className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-amber-900">Lock step after confirming</p>
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            Users will see a confirmation warning before advancing and cannot edit this step afterwards.
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={step.lockOnComplete === true}
                        onChange={(e) => onUpdateStep(step.id, { lockOnComplete: e.target.checked })}
                        className="h-4 w-4 rounded border-amber-400 mt-0.5 shrink-0 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Fields in this step</Label>
                        <span className="text-xs text-muted-foreground">
                          {step.fieldIds.length} of {fields.length} fields
                        </span>
                      </div>
                      <div className="border rounded-lg p-3 space-y-2 min-h-[80px] max-h-[30vh] overflow-y-auto bg-background">
                        {fields.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No fields available. Add fields to your form first.
                          </p>
                        ) : (
                          fields.map((field) => {
                            const isInStep = step.fieldIds.includes(field.id);
                            return (
                              <label
                                key={field.id}
                                className="flex items-center gap-3 text-sm cursor-pointer hover:bg-muted/50 rounded-md p-2 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isInStep}
                                  onChange={(e) => {
                                    const newIds = e.target.checked
                                      ? [...step.fieldIds, field.id]
                                      : step.fieldIds.filter((id) => id !== field.id);
                                    onAssignFieldsToStep(step.id, newIds);
                                  }}
                                  className="h-4 w-4 rounded border-primary"
                                />
                                <span className="truncate flex-1">{field.label}</span>
                                <span className="text-xs text-muted-foreground capitalize">
                                  {field.type}
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {unassignedFieldIds.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <p className="text-sm text-amber-800">
                {unassignedFieldIds.length} field(s) not assigned to any step
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
