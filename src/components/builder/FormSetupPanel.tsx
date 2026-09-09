import { BarChart2, ChevronRight, ClipboardCheck, Copy, Download, LayoutTemplate, ListChecks, Calculator, Vote } from 'lucide-react';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { countShowWhenLeaves } from './formSetup';

interface FormSetupPanelProps {
  /** Opens the data-calculations manager (rendered at page level). */
  onOpenVariables: () => void;
  /** Opens the settings workspace on its Layout and steps section. */
  onOpenLayout: () => void;
  /** Form-level actions (also reachable from here, not the header). */
  onDuplicate: () => void;
  onSaveAsTemplate: () => void;
  onExportJson: () => void;
}

/** How each form type reads in the panel. The kind is chosen at creation. */
const KIND_LABEL: Record<string, { title: string; icon: React.ElementType }> = {
  collect: { title: 'Collect answers', icon: ListChecks },
  registration: { title: 'Collect answers', icon: ListChecks },
  application: { title: 'Collect answers', icon: ListChecks },
  voting: { title: 'Poll or vote', icon: Vote },
  assessment: { title: 'Quiz or assessment', icon: ClipboardCheck },
  survey: { title: 'Survey', icon: BarChart2 },
};

/** A polished jump-list row shared by Sections and Form structure. */
function SectionRow({ icon: Icon, label, hint, onClick }: {
  icon: React.ElementType;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/row flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border hover:bg-card"
    >
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-muted/70 text-muted-foreground transition-colors group-hover/row:bg-primary/[0.08] group-hover/row:text-primary">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-foreground">{label}</span>
        {hint && <span className="block truncate text-[10.5px] text-muted-foreground">{hint}</span>}
      </span>
      <ChevronRight className="h-3.5 w-3.5 flex-none text-ink-300 transition-transform group-hover/row:translate-x-0.5 group-hover/row:text-primary" />
    </button>
  );
}

export default function FormSetupPanel({ onOpenVariables, onOpenLayout, onDuplicate, onSaveAsTemplate, onExportJson }: FormSetupPanelProps) {
  const builder = useAppSelector((state) => state.builder);
  const fields = builder.schema.fields;
  const variables = builder.schema.variables ?? [];
  const settings = builder.settings;
  const layout = builder.layout;

  const formType = settings.formType ?? 'collect';

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b border-border/70 px-3.5 py-3">
        <h2 className="text-[12px] font-semibold text-foreground">Form setup</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-3.5 py-3 pb-8 scrollbar-subtle">
        {/*
          The form's type — stated, not switched. It was chosen when the form
          was created and decides what the editor offers (survey questions for
          surveys, the counted question for polls, scoring for assessments).
        */}
        <section className="flex items-center gap-2.5 rounded-xl border border-border bg-ink-50/60 px-2.5 py-2">
          {(() => {
            const kind = KIND_LABEL[formType] ?? KIND_LABEL.collect;
            const Icon = kind.icon;
            return (
              <>
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-primary/10 bg-primary/[0.06] text-primary">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Type of form</p>
                  <p className="truncate text-[12.5px] font-semibold text-foreground">{kind.title}</p>
                </div>
              </>
            );
          })()}
        </section>

        {/* Structure */}
        <section className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-foreground">Form structure</span>
          <nav className="flex flex-col gap-0.5">
            <SectionRow
              icon={LayoutTemplate}
              label="Layout and steps"
              hint={layout.mode === 'multiStep' && (layout.steps ?? []).length ? `${(layout.steps ?? []).length} steps` : 'Single page'}
              onClick={onOpenLayout}
            />
            <SectionRow
              icon={Calculator}
              label="Data calculations"
              hint={`${variables.length} variable${variables.length === 1 ? '' : 's'}`}
              onClick={onOpenVariables}
            />
          </nav>
        </section>

        {/*
          Form actions, moved out of the header's overflow menu: they belong
          with everything else about this form. Three quiet rows — no more,
          so the panel stays a summary, not a toolbar.
        */}
        <section className="flex flex-col gap-1.5 border-t border-border/70 pt-3">
          <span className="text-[12px] font-bold text-foreground">Actions</span>
          <nav className="flex flex-col gap-0.5">
            <SectionRow icon={Copy} label="Duplicate form" onClick={onDuplicate} />
            <SectionRow icon={LayoutTemplate} label="Save as template" onClick={onSaveAsTemplate} />
            <SectionRow icon={Download} label="Export JSON" onClick={onExportJson} />
          </nav>
        </section>

        {/* Quiet structural facts that help orientation */}
        <section className="flex flex-col gap-1.5 border-t border-border/70 pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
          <p>
            {fields.length} question{fields.length === 1 ? '' : 's'} ·{' '}
            {fields.filter((f) => f.required).length} required ·{' '}
            {fields.filter((f) => f.showWhen && countShowWhenLeaves(f.showWhen.conditions) > 0).length} conditional
          </p>
        </section>
      </div>
    </div>
  );
}
