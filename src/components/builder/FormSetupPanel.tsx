import { BarChart2, Check, ChevronRight, ClipboardCheck, LayoutTemplate, Calculator, Settings, ListChecks, Shield, Users, Palette, KeyRound, CreditCard } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { updateSettings, updateField } from '../../store/builderSlice';
import type { FormField, FormSettings } from '../../types';
import { cn } from '../../lib/utils';
import { POLLABLE, SETTINGS_SECTIONS, countShowWhenLeaves, type SettingsSectionId } from './formSetup';

interface FormSetupPanelProps {
  /** Opens the data-calculations manager (rendered at page level). */
  onOpenVariables: () => void;
  /** Opens a settings section inside this panel (layout or a form section). */
  onOpenSection: (target: 'layout' | SettingsSectionId) => void;
}

const SECTION_ICONS: Record<SettingsSectionId, React.ElementType> = {
  general: Settings,
  'after-submit': ListChecks,
  access: Shield,
  team: Users,
  appearance: Palette,
  authentication: KeyRound,
  payment: CreditCard,
  assessment: ClipboardCheck,
  voting: BarChart2,
  survey: BarChart2,
};

type FormKind = 'collect' | 'voting' | 'assessment' | 'survey';

const KIND_CARDS: { id: FormKind; title: string; sub: string }[] = [
  { id: 'collect', title: 'Collect answers', sub: 'An ordinary form.' },
  { id: 'voting', title: 'Poll or vote', sub: 'Count answers to one question.' },
  { id: 'assessment', title: 'Quiz or assessment', sub: 'Score answers, set a pass mark.' },
  { id: 'survey', title: 'Survey', sub: 'NPS, CSAT, Likert and ranking.' },
];

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

export default function FormSetupPanel({ onOpenVariables, onOpenSection }: FormSetupPanelProps) {
  const dispatch = useAppDispatch();
  const builder = useAppSelector((state) => state.builder);
  const fields = builder.schema.fields;
  const variables = builder.schema.variables ?? [];
  const settings = builder.settings;
  const layout = builder.layout;

  const formType = settings.formType ?? 'collect';

  /** v2 §3.4 — the form's kind, asked once. Mutually exclusive by construction. */
  const setFormKind = (kind: FormKind) => {
    const updates: Partial<FormSettings> = {};
    if (kind === 'collect') {
      updates.formType = undefined;
    } else {
      updates.formType = kind;
      if (kind === 'voting' && !settings.voting) {
        updates.voting = { duplicatePrevention: 'none', showResultsAfterVoting: true, showResultsPublic: false };
      }
      if (kind === 'assessment' && !settings.assessment) {
        updates.assessment = { passThreshold: 60, showScoreAfterSubmit: true, showCorrectAnswers: false };
      }
      if (kind === 'survey' && !settings.survey) {
        updates.survey = { identityMode: 'anonymous', showQuestionNumbers: true, showProgress: true, saveIncomplete: true };
      }
    }
    dispatch(updateSettings(updates));
    // Leaving poll mode clears the counted flag — the poll no longer exists.
    if (kind !== 'voting') {
      fields.forEach((f) => {
        if (f.isPollQuestion) dispatch(updateField({ id: f.id, updates: { isPollQuestion: false } }));
      });
    }
  };

  /** The poll's counted question: one of the choice fields, exclusive. */
  const setPollQuestion = (field: FormField) => {
    fields.forEach((f) => {
      if (f.id !== field.id && f.isPollQuestion) dispatch(updateField({ id: f.id, updates: { isPollQuestion: false } }));
    });
    dispatch(updateField({ id: field.id, updates: { isPollQuestion: !field.isPollQuestion } }));
  };

  const pollChoices = fields.filter((f) => POLLABLE(f.type));

  const sections: SettingsSectionId[] = [
    'general', 'after-submit', 'access', 'team', 'appearance', 'authentication', 'payment',
    ...(settings.formType === 'assessment' ? ['assessment' as const] : []),
    ...(settings.formType === 'voting' ? ['voting' as const] : []),
    ...(settings.formType === 'survey' ? ['survey' as const] : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b border-border/70 px-3.5 py-3">
        <h2 className="text-[12px] font-semibold text-foreground">Form setup</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-3.5 py-3 pb-8 scrollbar-subtle">
        {/* v2 §3.4 — form type, asked once */}
        <section className="flex flex-col gap-2">
          <span className="text-[12px] font-bold text-foreground">What kind of form is this?</span>
          <div className="flex flex-col gap-1.5">
            {KIND_CARDS.map((card) => {
              const active = formType === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setFormKind(card.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
                    active
                      ? 'border-primary/50 bg-accent'
                      : 'border-border hover:border-ink-300 hover:bg-ink-50'
                  )}
                >
                  <span className={cn(
                    'relative mt-0.5 h-4 w-4 flex-none rounded-full border-[1.5px]',
                    active ? 'border-primary' : 'border-input'
                  )}>
                    {active && (
                      <span className="absolute left-1/2 top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold text-foreground">{card.title}</span>
                    <span className="mt-px block text-[10.5px] leading-snug text-muted-foreground">{card.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* The poll's counted question */}
        {formType === 'voting' && (
          <section className="rounded-xl border border-primary/25 bg-accent px-2.5 py-2.5">
            <h3 className="flex items-center gap-1.5 text-[11.5px] font-bold text-foreground">
              <BarChart2 className="h-3.5 w-3.5 text-primary" />
              Which question are people voting on?
            </h3>
            <p className="mb-2 mt-1 text-[10.5px] leading-snug text-accent-foreground">
              A poll counts answers to one question. Set it here or from a question&apos;s Advanced tab — both stay in sync.
            </p>
            <div className="flex flex-col gap-1.5">
              {pollChoices.length ? pollChoices.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPollQuestion(f)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-left text-[11.5px] transition-colors',
                    f.isPollQuestion
                      ? 'border-primary bg-primary/[0.05] font-semibold'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{f.label || 'Untitled question'}</span>
                  {f.isPollQuestion && <Check className="h-3.5 w-3.5 flex-none text-primary" />}
                </button>
              )) : (
                <p className="text-[10.5px] leading-snug text-muted-foreground">
                  Add a choice question first — a poll counts answers to one of them.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Form settings — every section, opened inside this panel */}
        <section className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-foreground">Settings</span>
          <nav className="flex flex-col gap-0.5">
            {sections.map((id) => {
              const Icon = SECTION_ICONS[id];
              const label = SETTINGS_SECTIONS.find((s) => s.id === id)?.label ?? id;
              return (
                <SectionRow
                  key={id}
                  icon={Icon}
                  label={label}
                  onClick={() => onOpenSection(id)}
                />
              );
            })}
          </nav>
        </section>

        {/* Structure */}
        <section className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-foreground">Form structure</span>
          <nav className="flex flex-col gap-0.5">
            <SectionRow
              icon={LayoutTemplate}
              label="Layout and steps"
              hint={layout.mode === 'multiStep' && (layout.steps ?? []).length ? `${(layout.steps ?? []).length} steps` : 'Single page'}
              onClick={() => onOpenSection('layout')}
            />
            <SectionRow
              icon={Calculator}
              label="Data calculations"
              hint={`${variables.length} variable${variables.length === 1 ? '' : 's'}`}
              onClick={onOpenVariables}
            />
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
