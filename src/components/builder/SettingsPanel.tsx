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
  { id: 'layout', label: 'Layout', icon: LayoutTemplate },
  { id: 'form', label: 'Form settings', icon: Settings },
];

/** Full-width settings workspace shown in place of the editor canvas. */
export default function SettingsPanel({ formId }: { formId?: string }) {
  const dispatch = useAppDispatch();
  const builder = useAppSelector((state) => state.builder);
  const [tab, setTab] = useState<SettingsTab>('layout');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-6 px-4 sm:px-6">
          <nav className="-mb-px flex items-center gap-6" role="tablist" aria-label="Settings workspace">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-2 border-b-2 py-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  tab === id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </nav>
          <p className="hidden truncate text-xs text-muted-foreground lg:block">
            {tab === 'layout' ? 'Structure, pages, and respondent navigation' : 'Behavior, access, appearance, and completion'}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-background">
        {tab === 'layout' ? (
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
        ) : (
          <FormSettingsContent formId={formId} />
        )}
      </div>
    </div>
  );
}
