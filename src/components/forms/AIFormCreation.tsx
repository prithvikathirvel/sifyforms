import { useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Loader2,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import api from '../../lib/api';
import type { FormField, FormSettings } from '../../types';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

interface AIFormCreationProps {
  onBack: () => void;
  onFormGenerated: (formData: { id: string }) => void;
  teamId?: string | null;
  teamName?: string;
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

export default function AIFormCreation({ onBack, onFormGenerated, teamId, teamName }: AIFormCreationProps) {
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
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="h-8 -ml-2 px-2 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back to creation methods
      </Button>

      {!generatedForm ? (
        <section className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/[0.06] text-primary">
              <Wand2 className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div>
              <h3 className="font-display text-sm font-bold text-foreground">Describe the form</h3>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">Include the audience, fields, and important rules in one clear request.</p>
            </div>
          </div>
          <Label htmlFor="ai-prompt">Form requirements</Label>
          <Textarea
            id="ai-prompt"
            autoFocus
            placeholder="Create an event registration form that collects attendee name, work email, company, ticket type, dietary requirements, and accessibility needs…"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="mt-1.5 min-h-[9rem] resize-y leading-5"
          />
          <div className="mt-4 flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-medium text-muted-foreground">
              Form owner: <span className="font-semibold text-foreground">{teamName || 'Default team'}</span>
            </p>
            <Button type="button" onClick={() => void handleGenerateForm()} disabled={!prompt.trim() || isGenerating} className="min-w-40">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {isGenerating ? 'Generating…' : 'Generate form'}
            </Button>
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/[0.06] text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <h3 className="truncate font-display text-sm font-bold text-foreground">{generatedForm.title}</h3>
                </div>
                {generatedForm.description && (
                  <p className="mt-2 max-w-2xl text-[11px] font-medium leading-4 text-muted-foreground">{generatedForm.description}</p>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleRegenerate} disabled={isGenerating} className="h-8 shrink-0 text-[11px]">
                {isGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
                Regenerate
              </Button>
            </div>

            <div className="p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground">Generated fields</h4>
                <span className="rounded-full border border-border bg-ink-50 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
                  {generatedForm.form.fields.length} field{generatedForm.form.fields.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="scrollbar-compact max-h-72 overflow-y-auto rounded-lg border border-border">
                {generatedForm.form.fields.map((field, index) => (
                  <div key={field.id || index} className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-50 text-[10px] font-bold tabular-nums text-ink-500">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">{field.label}</p>
                      <p className="mt-0.5 text-[10px] font-medium capitalize text-muted-foreground">{field.type}</p>
                    </div>
                    {field.required && (
                      <span className="rounded-full border border-border bg-card px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">Required</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-ink-50/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">Ready to continue in the builder?</p>
              <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">You can edit every generated field before publishing.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setGeneratedForm(null)}>Edit prompt</Button>
              <Button type="button" onClick={() => void handleCreateForm()} disabled={isCreating} className="min-w-32">
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                {isCreating ? 'Creating…' : 'Create form'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {generationError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3 py-2.5 text-xs font-medium text-destructive">
          <span>{generationError}</span>
        </div>
      )}
    </div>
  );
}
