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
      <header className="flex h-11 shrink-0 items-center border-b border-border bg-card px-3 sm:px-4">
        <div className="mr-4 hidden min-w-0 sm:block">
          <h1 className="text-[13px] font-semibold text-foreground">Settings</h1>
        </div>
        <nav className="flex h-full items-center gap-5" aria-label="Settings workspace">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={cn(
                'relative flex h-full items-center gap-1.5 px-0.5 text-[12px] font-semibold transition-colors',
                tab === id ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </nav>
        <p className="ml-auto hidden text-[11px] text-muted-foreground lg:block">
          {tab === 'layout' ? 'Structure, pages, and respondent navigation' : 'Behavior, access, appearance, and completion'}
        </p>
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
