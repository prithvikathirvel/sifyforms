import { useState } from 'react';
import {
  ClipboardCheck,
  FileText,
  Info,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from 'lucide-react';
import api from '../../lib/api';
import type { FormField, FormSettings } from '../../types';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { isBotProtectionEnabled } from '../../lib/formPolicy';

interface AIFormCreationProps {
  onBack: () => void;
  onFormGenerated: (formData: { id: string }) => void;
  teamId?: string | null;
}

interface GeneratedForm {
  title: string;
  description?: string;
  form: { fields: FormField[] };
  settings?: FormSettings;
}

function errorMessage(error: unknown) {
  const apiError = error as { response?: { data?: { error?: string } }; message?: string };
  return apiError.response?.data?.error || apiError.message || 'Failed to generate the form with AI.';
}

const cancelButtonClass = 'border-ink-200 bg-ink-100 text-ink-700 hover:bg-ink-200 hover:text-ink-800';
const modalFieldFocusClass = 'border-ink-200 focus-visible:border-ink-400 focus-visible:ring-4 focus-visible:ring-primary/[0.06] focus-visible:ring-offset-0';
const AI_PROMPT_MAX_LENGTH = 1000;

/** Development-branch AI flow with a responsive body and fixed action footer. */
export default function AIFormCreation({ onBack, onFormGenerated, teamId }: AIFormCreationProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedForm, setGeneratedForm] = useState<GeneratedForm | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const handleGenerateForm = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const response = await api.post('/forms/ai-generate', { prompt: prompt.trim() });
      setGeneratedForm(response.data as GeneratedForm);
    } catch (error) {
      setGenerationError(errorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateForm = async () => {
    if (!generatedForm) return;
    setIsCreating(true);
    setGenerationError(null);
    try {
      const result = await api.post('/forms', {
        name: generatedForm.title,
        description: generatedForm.description,
        teamId,
        schema: {
          fields: generatedForm.form.fields,
          layout: { mode: 'singlePage', steps: [] },
        },
        settings: generatedForm.settings,
      });
      onFormGenerated(result.data as { id: string });
    } catch (error) {
      setGenerationError(errorMessage(error));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRegenerate = () => {
    setGeneratedForm(null);
    void handleGenerateForm();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto max-w-4xl">
          {!generatedForm ? (
            <div className="space-y-4 sm:space-y-5">
              <div>
                <Label htmlFor="ai-prompt" className="font-display text-base font-bold leading-6 text-foreground">
                  Describe your form in natural language
                </Label>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Tell us what information you want to collect and any rules or conditions.
                </p>
              </div>

              <div className="relative">
                <Textarea
                  id="ai-prompt"
                  autoFocus
                  maxLength={AI_PROMPT_MAX_LENGTH}
                  aria-describedby="ai-prompt-guidance ai-prompt-count"
                  placeholder="Example: I need a registration form for a tech conference that collects attendee name, email, company, ticket type, dietary restrictions, and accessibility needs..."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className={`min-h-[12rem] resize-none rounded-xl px-4 pb-9 pt-3.5 text-[13px] leading-5 placeholder:text-ink-400 sm:min-h-[15rem] ${modalFieldFocusClass}`}
                />
                <span id="ai-prompt-count" className="pointer-events-none absolute bottom-3 right-3 rounded bg-card/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {prompt.length}/{AI_PROMPT_MAX_LENGTH}
                </span>
              </div>

              <div id="ai-prompt-guidance" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {[
                  { icon: ClipboardCheck, title: 'Be specific', description: 'Mention all the fields you need' },
                  { icon: FileText, title: 'Add context', description: 'Include the purpose and audience' },
                  { icon: SlidersHorizontal, title: 'Set requirements', description: 'Add validation rules or conditions' },
                  { icon: Sparkles, title: 'Better results', description: 'Clear input = better form output' },
                ].map(({ icon: Icon, title, description }) => (
                  <div key={title} className="rounded-lg border border-primary/[0.08] bg-primary/[0.025] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
                      <p className="text-[11px] font-semibold text-foreground">{title}</p>
                    </div>
                    <p className="mt-1 text-[10px] font-medium leading-4 text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-[11px] font-medium leading-4 text-ink-600">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" strokeWidth={1.8} />
                <p>The more details you provide, the more accurate and relevant your form will be.</p>
              </div>

              {generationError && (
                <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-xs text-destructive">
                  <p className="font-semibold">AI generation failed</p>
                  <p className="mt-1 break-words font-medium">{generationError}</p>
                </div>
              )}

              {isGenerating && (
                <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-ink-50/60 px-4 py-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/10 bg-card text-primary">
                    <Wand2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Building your form structure</p>
                    <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">Analyzing fields, requirements, and settings…</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h4 className="font-display text-lg font-bold text-foreground">{generatedForm.title}</h4>
                  {generatedForm.description && (
                    <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">{generatedForm.description}</p>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleRegenerate} disabled={isGenerating} className="shrink-0">
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  Regenerate
                </Button>
              </div>

              <section className="rounded-xl border border-border bg-ink-50/55 p-4">
                <h5 className="mb-3 text-xs font-semibold text-muted-foreground">Form fields ({generatedForm.form.fields.length})</h5>
                <div className="scrollbar-compact max-h-60 space-y-2 overflow-y-auto pr-1">
                  {generatedForm.form.fields.map((field, index) => (
                    <div key={field.id || index} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-xs font-semibold text-foreground">{field.label}</span>
                          {field.required && <span className="rounded-full border border-border bg-ink-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">Required</span>}
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold capitalize text-muted-foreground">{field.type}</span>
                          {field.placeholder && <span className="truncate text-[10px] text-muted-foreground">{field.placeholder}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {generatedForm.settings && (
                <section className="rounded-xl border border-border bg-ink-50/55 p-4">
                  <h5 className="mb-3 text-xs font-semibold text-muted-foreground">Form settings</h5>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span className="text-muted-foreground">Thank-you message</span>
                      <span className="text-foreground sm:text-right">{generatedForm.settings.thankYouMessage || 'Thank you for your submission!'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Bot protection</span>
                      <span className="rounded-full border border-primary/10 bg-primary/[0.05] px-2 py-0.5 text-[9px] font-semibold text-primary">
                        {isBotProtectionEnabled(generatedForm.settings) ? 'On (Turnstile)' : 'Off'}
                      </span>
                    </div>
                    {generatedForm.settings.previewConfig && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Preview configuration</span>
                        <span className="text-foreground">{generatedForm.settings.previewConfig.enabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {generationError && (
                <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-xs font-medium text-destructive">{generationError}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/70 bg-ink-50/55 px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
        {!generatedForm ? (
          <>
            <Button type="button" variant="outline" onClick={onBack} className={`w-full sm:w-auto ${cancelButtonClass}`}>Cancel</Button>
            <Button type="button" onClick={() => void handleGenerateForm()} disabled={!prompt.trim() || isGenerating} className="w-full min-w-44 sm:w-auto">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {isGenerating ? 'Generating…' : 'Generate form with AI'}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={() => setGeneratedForm(null)} className={`w-full sm:w-auto ${cancelButtonClass}`}>Edit prompt</Button>
            <Button type="button" onClick={() => void handleCreateForm()} disabled={isCreating} className="w-full min-w-36 sm:w-auto">
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              {isCreating ? 'Creating…' : 'Create form'}
            </Button>
          </>
        )}
      </footer>
    </div>
  );
}
