import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  CircleAlert,
  Download,
  FilePlus2,
  FileText,
  Info,
  LayoutTemplate,
  Loader2,
  UsersRound,
  Wand2,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { createForm, duplicateTemplate } from '../../store/formsSlice';
import { resetBuilder, setFormName } from '../../store/builderSlice';
import { fetchTeams } from '../../store/teamsSlice';
import type { FormField, FormLayout, FormSettings, FormVariable, TeamNode } from '../../types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import AIFormCreation from './AIFormCreation';
import TeamTreeSelect from './TeamTreeSelect';
import { TemplateSelectionContent, type TemplateSummary } from './TemplateSelectionModal';

interface CreateFormModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'choose' | 'scratch' | 'template' | 'json' | 'ai';

type JsonObject = Record<string, unknown>;

const STEP_DESCRIPTION: Record<Step, string> = {
  choose: 'Choose the best starting point for your form.',
  scratch: 'Name your form and continue with a clean builder canvas.',
  template: 'Start quickly with a reusable, preconfigured form.',
  json: 'Create a form from an existing SifyForms JSON schema.',
  ai: 'Describe what you need and review the generated structure.',
};

function flattenTeams(roots: TeamNode[]): TeamNode[] {
  const result: TeamNode[] = [];
  const stack = [...roots].reverse();
  while (stack.length > 0) {
    const team = stack.pop();
    if (!team) break;
    result.push(team);
    for (let index = team.children.length - 1; index >= 0; index -= 1) {
      stack.push(team.children[index]);
    }
  }
  return result;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default function CreateFormModal({ open, onClose }: CreateFormModalProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  const { tree: teamTree, isLoading: teamsLoading } = useAppSelector((state) => state.teams);

  const [step, setStep] = useState<Step>('choose');
  const [formName, setFormNameLocal] = useState('');
  const [formDescription, setFormDescriptionLocal] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && currentOrg?.id) dispatch(fetchTeams(currentOrg.id));
  }, [open, currentOrg?.id, dispatch]);

  const flatTeams = useMemo(() => flattenTeams(teamTree), [teamTree]);
  const defaultTeam = flatTeams.find((team) => team.isDefault || team.slug === 'general') ?? flatTeams[0];
  const effectiveTeamId = flatTeams.some((team) => team.id === teamId) ? teamId : defaultTeam?.id ?? null;
  const selectedTeam = flatTeams.find((team) => team.id === effectiveTeamId);

  const resetAndClose = () => {
    setStep('choose');
    setFormNameLocal('');
    setFormDescriptionLocal('');
    setJsonInput('');
    setJsonError('');
    setActionError('');
    setIsLoading(false);
    onClose();
  };

  const goTo = (nextStep: Step) => {
    setActionError('');
    setJsonError('');
    setStep(nextStep);
  };

  const handleCreateFromScratch = async () => {
    if (!formName.trim()) return;
    setIsLoading(true);
    setActionError('');
    try {
      const result = await dispatch(createForm({
        name: formName.trim(),
        description: formDescription.trim(),
        teamId: effectiveTeamId,
        schema: {
          fields: [],
          layout: { mode: 'singlePage', steps: [] },
        },
        settings: { thankYouMessage: 'Thank you for your submission!' },
      })).unwrap();

      dispatch(resetBuilder());
      dispatch(setFormName(formName.trim()));
      resetAndClose();
      navigate(`/forms/${result.id}/edit`);
    } catch (error) {
      setActionError(typeof error === 'string' ? error : 'Unable to create the form. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = async (template: TemplateSummary) => {
    setIsLoading(true);
    setActionError('');
    try {
      const response = await dispatch(duplicateTemplate({
        templateId: template.id,
        name: template.name,
        teamId: effectiveTeamId,
      })).unwrap();
      resetAndClose();
      navigate(`/forms/${response.id}/edit`);
    } catch (error) {
      setActionError(typeof error === 'string' ? error : 'Unable to create a form from this template.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportJson = async () => {
    setJsonError('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonInput);
    } catch {
      setJsonError('Invalid JSON format — check for missing commas, brackets, or quotes.');
      return;
    }

    if (!isObject(parsed) || !Array.isArray(parsed.fields)) {
      setJsonError('Invalid schema: include a “fields” array at the top level.');
      return;
    }
    if (parsed.fields.length === 0) {
      setJsonError('The “fields” array is empty — add at least one field.');
      return;
    }
    for (const field of parsed.fields) {
      if (!isObject(field) || !field.id || !field.type || !field.label) {
        setJsonError('Every field must include “id”, “type”, and “label”.');
        return;
      }
    }

    const layout = isObject(parsed.layout)
      ? parsed.layout as unknown as FormLayout
      : { mode: 'singlePage' as const, steps: [] };
    const variables = Array.isArray(parsed.variables)
      ? parsed.variables as FormVariable[]
      : [];
    const settings = isObject(parsed.settings)
      ? parsed.settings as FormSettings
      : { thankYouMessage: 'Thank you for your submission!' };

    setIsLoading(true);
    try {
      const result = await dispatch(createForm({
        name: formName.trim() || 'Imported Form',
        description: formDescription.trim(),
        teamId: effectiveTeamId,
        schema: {
          fields: parsed.fields as FormField[],
          layout,
          variables,
        },
        settings,
      })).unwrap();

      resetAndClose();
      navigate(`/forms/${result.id}/edit`);
    } catch (error) {
      setJsonError(
        typeof error === 'string'
          ? error
          : error instanceof Error
            ? error.message
            : 'Failed to import the form. Check the schema and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = {
      fields: [
        {
          id: 'country',
          type: 'select',
          label: 'Country',
          required: true,
          options: [
            { label: 'India', value: 'IND' },
            { label: 'China', value: 'CHN' },
            { label: 'USA', value: 'USA' },
          ],
        },
        {
          id: 'ind_specific',
          type: 'text',
          label: 'India-specific field',
          placeholder: 'Only shown when India is selected',
          required: false,
          showWhen: {
            id: 'show_ind',
            logic: 'and',
            conditions: [{ id: 'c1', fieldId: 'country', operator: 'equals', value: 'IND' }],
          },
        },
        {
          id: 'chn_specific',
          type: 'text',
          label: 'China-specific field',
          placeholder: 'Only shown when China is selected',
          required: false,
          showWhen: {
            id: 'show_chn',
            logic: 'and',
            conditions: [{ id: 'c2', fieldId: 'country', operator: 'equals', value: 'CHN' }],
          },
        },
        {
          id: 'name',
          type: 'text',
          label: 'Full Name',
          placeholder: 'Enter your full name',
          required: true,
          validation: { minLength: 2, maxLength: 50 },
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email Address',
          required: true,
        },
      ],
      layout: { mode: 'singlePage', steps: [], allowBackNavigation: true },
      settings: {
        thankYouMessage: 'Thank you for your submission!',
        collectTimestamp: true,
        reCaptcha: false,
      },
    };
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(template, null, 2))}`;
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', 'form-template.json');
    link.click();
  };

  const renderTeamPicker = () => (
    <section className="rounded-xl border border-border/80 bg-ink-50/55 p-3.5 sm:p-4" aria-labelledby="form-team-label">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1.2fr)] lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-card text-primary ring-1 ring-border">
              <UsersRound className="h-3.5 w-3.5" strokeWidth={1.8} />
            </span>
            <Label id="form-team-label" htmlFor="formTeam">Owning team</Label>
          </div>
          <p className="mt-1.5 max-w-md text-[11px] font-medium leading-4 text-muted-foreground">
            This team and its parent teams inherit access to the form and responses.
          </p>
        </div>
        <TeamTreeSelect
          teams={teamTree}
          value={effectiveTeamId}
          onChange={setTeamId}
          isLoading={teamsLoading}
        />
      </div>
    </section>
  );

  const renderChooseStep = () => (
    <div className="space-y-5">
      {renderTeamPicker()}

      <section aria-labelledby="creation-method-title">
        <div className="mb-3">
          <h3 id="creation-method-title" className="font-display text-[13px] font-bold text-foreground">Choose a creation method</h3>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Every option opens the same form builder when complete.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MethodCard
            icon={<Wand2 className="h-5 w-5" strokeWidth={1.8} />}
            title="Create with AI"
            description="Describe the form and generate a structured starting point."
            badge="Recommended"
            emphasized
            onClick={() => goTo('ai')}
          />
          <MethodCard
            icon={<FilePlus2 className="h-5 w-5" strokeWidth={1.8} />}
            title="Start from scratch"
            description="Open a clean canvas and build each field yourself."
            onClick={() => goTo('scratch')}
          />
          <MethodCard
            icon={<LayoutTemplate className="h-5 w-5" strokeWidth={1.8} />}
            title="Use a template"
            description="Reuse a system or organization form as your base."
            onClick={() => goTo('template')}
          />
          <MethodCard
            icon={<Braces className="h-5 w-5" strokeWidth={1.8} />}
            title="Import JSON"
            description="Bring in an existing schema and continue in the builder."
            onClick={() => goTo('json')}
          />
        </div>
      </section>

      <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-[11px] font-medium leading-4 text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <p>
          Not sure where to begin? Use AI for a guided draft, or start from scratch when you already know the exact structure.
        </p>
      </div>
    </div>
  );

  const renderScratchStep = () => (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleCreateFromScratch();
      }}
    >
      <StepBack onClick={() => goTo('choose')} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="font-display text-sm font-bold text-foreground">Form details</h3>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">You can change these details later in the builder.</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="formName">Form name</Label>
              <Input
                id="formName"
                autoFocus
                required
                placeholder="e.g. Event registration"
                value={formName}
                onChange={(event) => setFormNameLocal(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="formDescription">Description <span className="font-medium text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="formDescription"
                rows={4}
                placeholder="What will this form be used for?"
                value={formDescription}
                onChange={(event) => setFormDescriptionLocal(event.target.value)}
                className="resize-none"
              />
            </div>
          </div>
        </section>

        <aside className="rounded-xl border border-border bg-ink-50/55 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-primary">
            <FileText className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <h3 className="mt-3 font-display text-[13px] font-bold text-foreground">Clean starting canvas</h3>
          <p className="mt-1.5 text-[11px] font-medium leading-5 text-muted-foreground">
            The builder opens with an empty single-page layout. Add fields, rules, branding, and publishing settings there.
          </p>
          <div className="mt-4 border-t border-border/70 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Owning team</p>
            <p className="mt-1 text-xs font-semibold text-foreground">{selectedTeam?.name || 'Default team'}</p>
          </div>
        </aside>
      </div>
      <InlineError message={actionError} />
      <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
        <Button type="button" variant="outline" onClick={() => goTo('choose')}>Cancel</Button>
        <Button type="submit" disabled={!formName.trim() || isLoading} className="min-w-32">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
          {isLoading ? 'Creating…' : 'Create form'}
        </Button>
      </div>
    </form>
  );

  const renderTemplateStep = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepBack onClick={() => goTo('choose')} />
        <p className="rounded-md border border-border bg-ink-50 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">
          New form owner: <span className="font-semibold text-foreground">{selectedTeam?.name || 'Default team'}</span>
        </p>
      </div>
      <TemplateSelectionContent
        onSelectTemplate={(template) => void handleSelectTemplate(template)}
        isSelecting={isLoading}
      />
      <InlineError message={actionError} />
    </div>
  );

  const renderJsonStep = () => (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleImportJson();
      }}
    >
      <StepBack onClick={() => goTo('choose')} />
      <div className="grid gap-4 lg:grid-cols-[minmax(15rem,0.68fr)_minmax(0,1.32fr)]">
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div>
            <h3 className="font-display text-sm font-bold text-foreground">Import details</h3>
            <p className="mt-1 text-[11px] font-medium leading-4 text-muted-foreground">Give the imported form a clear workspace name.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jsonFormName">Form name</Label>
            <Input
              id="jsonFormName"
              placeholder="Imported form"
              value={formName}
              onChange={(event) => setFormNameLocal(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jsonFormDescription">Description <span className="font-medium text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="jsonFormDescription"
              rows={3}
              placeholder="Purpose of this form"
              value={formDescription}
              onChange={(event) => setFormDescriptionLocal(event.target.value)}
              className="resize-none"
            />
          </div>
          <div className="rounded-lg border border-border/70 bg-ink-50/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Owning team</p>
            <p className="mt-1 text-xs font-semibold text-foreground">{selectedTeam?.name || 'Default team'}</p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label htmlFor="jsonInput">JSON schema</Label>
              <p className="mt-1 text-[10px] font-medium text-muted-foreground">Requires a top-level fields array.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} className="h-8 text-[11px]">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download example
            </Button>
          </div>
          <Textarea
            id="jsonInput"
            autoFocus
            spellCheck={false}
            placeholder={'{\n  "fields": [\n    { "id": "name", "type": "text", "label": "Full name" }\n  ]\n}'}
            value={jsonInput}
            onChange={(event) => {
              setJsonInput(event.target.value);
              setJsonError('');
            }}
            className="min-h-[18rem] resize-y bg-ink-50/80 font-mono text-[12px] leading-5 text-ink-800 placeholder:text-ink-400 focus-visible:ring-primary/20"
          />
          {jsonError && <InlineError message={jsonError} />}
        </section>
      </div>
      <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
        <Button type="button" variant="outline" onClick={() => goTo('choose')}>Cancel</Button>
        <Button type="submit" disabled={!jsonInput.trim() || isLoading} className="min-w-40">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Braces className="mr-2 h-4 w-4" />}
          {isLoading ? 'Importing…' : 'Import and create'}
        </Button>
      </div>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && resetAndClose()}>
      <DialogContent
        className="flex max-h-[92dvh] max-w-5xl flex-col overflow-visible rounded-2xl border-border bg-card p-0 shadow-[0_24px_70px_rgba(15,23,42,0.2)]"
        onClose={resetAndClose}
      >
        <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4 pr-14 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/[0.06] text-primary">
              {step === 'template' ? <LayoutTemplate className="h-[18px] w-[18px]" /> : step === 'json' ? <Braces className="h-[18px] w-[18px]" /> : <FilePlus2 className="h-[18px] w-[18px]" />}
            </span>
            <div>
              <DialogTitle className="font-display text-lg font-bold">Create new form</DialogTitle>
              <DialogDescription className="mt-1 text-xs font-medium">{STEP_DESCRIPTION[step]}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-5">
          {step === 'choose' && renderChooseStep()}
          {step === 'scratch' && renderScratchStep()}
          {step === 'template' && renderTemplateStep()}
          {step === 'json' && renderJsonStep()}
          {step === 'ai' && (
            <AIFormCreation
              teamId={effectiveTeamId}
              teamName={selectedTeam?.name}
              onBack={() => goTo('choose')}
              onFormGenerated={(formData) => {
                resetAndClose();
                navigate(`/forms/${formData.id}/edit`);
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MethodCard({
  icon,
  title,
  description,
  badge,
  emphasized = false,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  emphasized?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-44 flex-col rounded-xl border bg-card p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.025)] transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-primary/25 hover:shadow-[0_5px_18px_rgba(15,23,42,0.05)] ${emphasized ? 'border-primary/20' : 'border-border'}`}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${emphasized ? 'border-primary/10 bg-primary/[0.065] text-primary' : 'border-border bg-ink-50 text-ink-600'}`}>
          {icon}
        </span>
        {badge && (
          <span className="rounded-full border border-primary/15 bg-primary/[0.05] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
            {badge}
          </span>
        )}
      </div>
      <h4 className="mt-4 font-display text-[13px] font-bold text-foreground">{title}</h4>
      <p className="mt-1.5 text-[11px] font-medium leading-4 text-muted-foreground">{description}</p>
      <span className="mt-auto flex items-center pt-4 text-[10px] font-semibold text-primary">
        Continue <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function StepBack({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} className="h-8 -ml-2 px-2 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
      Back to creation methods
    </Button>
  );
}

function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3 py-2.5 text-xs font-medium text-destructive">
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
