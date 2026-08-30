import { useState } from 'react';
import { Layout, Settings } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import LayoutConfigPanel from './LayoutConfigPanel';
import FormSettingsContent from './FormSettingsContent';

/**
 * Full-page settings surface shown in place of the editor canvas. Consolidates
 * Layout settings and Form settings into a single tabbed page (replaces the
 * previous Layout/Settings modals).
 */
export default function SettingsPanel({ formId }: { formId?: string }) {
  const dispatch = useAppDispatch();
  const builder = useAppSelector((state) => state.builder);
  const [activeTab, setActiveTab] = useState<'layout' | 'form'>('layout');

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-workspace">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6">
          <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Settings</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Configure how your form is structured and how it behaves for respondents.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'layout' | 'form')} className="w-full">
          <TabsList className="mb-6 inline-flex h-11 w-full justify-start rounded-xl border border-border bg-card p-1 sm:w-auto">
            <TabsTrigger
              value="layout"
              className="flex-1 justify-center gap-1.5 px-4 text-[13px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:flex-none"
            >
              <Layout className="h-3.5 w-3.5" strokeWidth={1.8} />
              Layout Settings
            </TabsTrigger>
            <TabsTrigger
              value="form"
              className="flex-1 justify-center gap-1.5 px-4 text-[13px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:flex-none"
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={1.8} />
              Form Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="layout" className="mt-0">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
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
          </TabsContent>

          <TabsContent value="form" className="mt-0">
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <FormSettingsContent formId={formId} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
