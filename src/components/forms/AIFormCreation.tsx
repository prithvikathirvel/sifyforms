import { useState } from 'react';
import { FileText, Loader2, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import api from '../../lib/api';
import type { FormField, FormSettings } from '../../types';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-prompt">Describe your form in natural language</Label>
                <Textarea
                  id="ai-prompt"
                  autoFocus
                  placeholder="I need a registration form for a tech conference that collects attendee name, email, company, ticket type, dietary restrictions, and accessibility needs…"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="min-h-[11rem] resize-y leading-5 sm:min-h-[16rem]"
                />
                <p className="text-[11px] font-medium text-muted-foreground">
                  Be specific about the fields you need and any important requirements.
                </p>
              </div>

              {generationError && (
                <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-xs text-destructive">
                  <p className="font-semibold">AI generation failed</p>
                  <p className="mt-1 break-words font-medium">{generationError}</p>
                </div>
              )}

              {isGenerating && (
                <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-ink-50/60 px-4 py-5">
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
                      <span className="rounded-full border border-primary/10 bg-primary/[0.05] px-2 py-0.5 text-[9px] font-semibold text-primary">Turnstile always on</span>
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
