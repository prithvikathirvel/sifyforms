import { useState } from 'react';
import { LayoutTemplate, Settings } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import {
  setLayoutMode,
  updateLayout,
  addStep,
  removeStep,
  updateStep,
  assignFieldsToStep,
  reorderSteps,
} from '../../store/builderSlice';
import LayoutConfigPanel from './LayoutConfigPanel';
import FormSettingsContent from './FormSettingsContent';
import { cn } from '../../lib/utils';

type SettingsTab = 'layout' | 'form';

const TABS: { id: SettingsTab; label: string; icon: typeof LayoutTemplate }[] = [
  { id: 'layout', label: 'Layout Settings', icon: LayoutTemplate },
  { id: 'form', label: 'Form Settings', icon: Settings },
];

/**
 * Full-page settings surface shown in place of the editor canvas. A sticky
 * header carries the title and a segmented section switch; content stretches
 * across the available width (single generous container, no side-by-side
 * card) so it reads as a real page rather than a stretched modal.
 */
export default function SettingsPanel({ formId }: { formId?: string }) {
  const dispatch = useAppDispatch();
  const builder = useAppSelector((state) => state.builder);
  const [tab, setTab] = useState<SettingsTab>('layout');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-workspace">
      {/* Sticky page header */}
      <header className="sticky top-0 z-10 shrink-0 border-b border-border/70 bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h1 className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg">Settings</h1>
            <p className="mt-0.5 text-[12px] font-medium text-muted-foreground sm:text-[13px]">
              Configure how your form is structured and how it behaves for respondents.
            </p>
          </div>

          <nav
            className="flex w-full shrink-0 items-center rounded-lg bg-ink-100 p-0.5 sm:w-auto"
            aria-label="Settings sections"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12px] font-semibold transition-colors sm:flex-none',
                  tab === id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {tab === 'layout' ? (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="p-5 sm:p-7 lg:p-8">
              <LayoutConfigPanel
                layout={builder.layout}
                fields={builder.schema.fields}
                onSetLayoutMode={(mode) => dispatch(setLayoutMode(mode))}
                onUpdateLayout={(updates) => dispatch(updateLayout(updates))}
                onAddStep={() => dispatch(addStep())}
                onRemoveStep={(id) => dispatch(removeStep(id))}
                onUpdateStep={(id, updates) => dispatch(updateStep({ id, updates }))}
                onAssignFieldsToStep={(stepId, fieldIds) => dispatch(assignFieldsToStep({ stepId, fieldIds }))}
                onReorderStep={(oldIndex, newIndex) => dispatch(reorderSteps({ oldIndex, newIndex }))}
              />
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <FormSettingsContent formId={formId} />
          </div>
        )}
      </div>
    </div>
  );
}
