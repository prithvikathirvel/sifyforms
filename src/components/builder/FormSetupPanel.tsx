import { BarChart2, Check, ChevronRight, ClipboardCheck, LayoutTemplate, Calculator, AlertTriangle, Users, Shield, Palette, KeyRound, CreditCard, Settings, ListChecks } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { updateSettings, updateField } from '../../store/builderSlice';
import type { FormField, FormSettings } from '../../types';
import { cn } from '../../lib/utils';
import { POLLABLE, SETTINGS_SECTIONS, countShowWhenLeaves, getSetupRows, type SetupTarget, type SettingsSectionId } from './formSetup';

interface FormSetupPanelProps {
  /** Opens the data-calculations manager (rendered at page level). */
  onOpenVariables: () => void;
  /** Jumps to the settings workspace, landing on the given section. */
  onGoToSettings: (target: 'layout' | 'canvas' | SettingsSectionId) => void;
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

export default function FormSetupPanel({ onOpenVariables, onGoToSettings }: FormSetupPanelProps) {
  const dispatch = useAppDispatch();
  const builder = useAppSelector((state) => state.builder);
  const fields = builder.schema.fields;
  const variables = builder.schema.variables ?? [];
  const settings = builder.settings;
  const layout = builder.layout;

  const formType = settings.formType ?? 'collect';
  const setupRows = getSetupRows(fields, settings, layout, variables);

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

  const goTo = (target: Exclude<SetupTarget, null>) => {
    if (target === 'variables') onOpenVariables();
    else onGoToSettings(target as 'layout' | 'canvas' | SettingsSectionId);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b border-border/70 px-3.5 py-3">
        <div className="flex-1">
          <h2 className="text-[12px] font-semibold text-foreground">Form setup</h2>
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
            Settings for the whole form. This panel stays the same no matter which question is selected.
          </p>
        </div>
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
                    'mt-0.5 h-4 w-4 flex-none rounded-full border-[1.5px]',
                    active ? 'border-primary' : 'border-input'
                  )}>
                    {active && <span className="m-[2.5px] block h-[7px] w-[7px] rounded-full bg-primary" />}
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

        {/* The follow-up that closes the §1.1 gap: which question counts? */}
        {formType === 'voting' && (
          <section className="rounded-xl border border-primary/25 bg-accent px-2.5 py-2.5">
            <h3 className="flex items-center gap-1.5 text-[11.5px] font-bold text-foreground">
              <BarChart2 className="h-3.5 w-3.5 text-primary" />
              Which question are people voting on?
            </h3>
            <p className="mb-2 mt-1 text-[10.5px] leading-snug text-accent-foreground">
              A poll counts answers to one question. Set it here or from a question's ⋮ menu — both stay in sync.
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

        {/* v2 §3.4 — the map of what is switched on */}
        <section className="flex flex-col gap-2">
          <span className="text-[12px] font-bold text-foreground">What&apos;s set up</span>
          <p className="-mt-1 text-[10.5px] leading-snug text-muted-foreground">
            Everything switched on, in one list. Each entry opens the control that switched it on.
          </p>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-ink-50 px-2.5 py-2 text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-500">
              On for this form
            </div>
            <div>
              {setupRows.map((row, i) => {
                const content = (
                  <>
                    <span className={cn('flex flex-none', row.warn ? 'text-warning' : 'text-success')}>
                      {row.warn ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">{row.text}</span>
                    {row.target && <ChevronRight className="h-3.5 w-3.5 flex-none text-ink-300" />}
                  </>
                );
                const rowClass = cn(
                  'flex w-full items-center gap-2 border-b border-border px-2.5 py-1.5 text-left text-[11.5px] last:border-b-0',
                  row.target && 'cursor-pointer hover:bg-accent'
                );
                return row.target ? (
                  <button key={i} type="button" className={rowClass} onClick={() => goTo(row.target as Exclude<SetupTarget, null>)}>
                    {content}
                  </button>
                ) : (
                  <div key={i} className={rowClass}>{content}</div>
                );
              })}
              {setupRows.length === 0 && (
                <p className="px-2.5 py-3 text-[11px] text-muted-foreground">
                  Nothing is switched on yet — this is a plain form.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Jump list into the settings workspace */}
        <section className="flex flex-col gap-2">
          <span className="text-[12px] font-bold text-foreground">Sections</span>
          <nav className="flex flex-col gap-0.5">
            {sections.map((id) => {
              const Icon = SECTION_ICONS[id];
              const label = SETTINGS_SECTIONS.find((s) => s.id === id)?.label ?? id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onGoToSettings(id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-ink-50 hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </nav>
        </section>

        {/* Structure */}
        <section className="flex flex-col gap-2">
          <span className="text-[12px] font-bold text-foreground">Form structure</span>
          <p className="-mt-1 text-[10.5px] leading-snug text-muted-foreground">Single page or split into steps.</p>
          <nav className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onGoToSettings('layout')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-ink-50 hover:text-foreground"
            >
              <LayoutTemplate className="h-3.5 w-3.5" />
              Layout and steps
              <span className="ml-auto text-[10px] text-ink-400">
                {layout.mode === 'multiStep' && (layout.steps ?? []).length ? `${(layout.steps ?? []).length} steps` : 'Single page'}
              </span>
            </button>
            <button
              type="button"
              onClick={onOpenVariables}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-ink-50 hover:text-foreground"
            >
              <Calculator className="h-3.5 w-3.5" />
              Data calculations
              <span className="ml-auto text-[10px] text-ink-400">
                {variables.length} variable{variables.length === 1 ? '' : 's'}
              </span>
            </button>
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
