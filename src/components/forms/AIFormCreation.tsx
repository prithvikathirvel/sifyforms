import { useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ArrowLeft, Wand2, Loader2, Sparkles, FileText } from 'lucide-react';
import api from '../../lib/api';

interface AIFormCreationProps {
  onBack: () => void;
  onFormGenerated: (formData: any) => void;
  /** Team chosen before branching into a creation method. */
  teamId?: string | null;
}

export default function AIFormCreation({ onBack, onFormGenerated, teamId }: AIFormCreationProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedForm, setGeneratedForm] = useState<any>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const handleGenerateForm = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setGenerationError(null);
    try {
      const response = await api.post('/forms/ai-generate', { prompt });
      setGeneratedForm(response.data);
    } catch (error: any) {
      const msg = error?.response?.data?.error || error.message || 'Failed to generate form with AI';
      setGenerationError(msg);
      console.error('Failed to generate form:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateForm = async () => {
    if (!generatedForm) return;

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

      onFormGenerated(result.data);
    } catch (error) {
      console.error('Failed to create form:', error);
    }
  };

  const handleRegenerate = () => {
    setGeneratedForm(null);
    handleGenerateForm();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-brand-600" />
          <h3 className="text-lg font-semibold">AI Form Creation</h3>
        </div>
      </div>

      {!generatedForm ? (
        <>
          {/* Prompt Input */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">Describe your form in natural language</Label>
              <Textarea
                id="ai-prompt"
                placeholder="I need a registration form for a tech conference that collects attendee information including name, email, company, ticket type, dietary restrictions, and special accessibility needs..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Be as specific as possible about the fields you need and any special requirements.
              </p>
            </div>

            <Button 
              onClick={handleGenerateForm}
              disabled={!prompt.trim() || isGenerating}
              className="w-full bg-gradient-to-r from-plum-800 to-brand-500 hover:from-plum-900 hover:to-brand-600"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  AI is creating your form...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Form with AI
                </>
              )}
            </Button>
          </div>

          {/* Error State */}
          {generationError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold mb-1">AI generation failed</p>
              <p className="break-words">{generationError}</p>
              <p className="mt-2 text-red-500 text-xs">Check the backend server logs for more details.</p>
            </div>
          )}

          {/* AI Loading State */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-r from-plum-800 to-brand-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-16 h-16 bg-gradient-to-r from-plum-800 to-brand-500 rounded-full animate-ping opacity-20"></div>
                <Wand2 className="absolute inset-0 w-16 h-16 text-white flex items-center justify-center" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-medium text-brand-600">AI is working its magic...</p>
                <div className="flex items-center justify-center space-x-1">
                  <div className="w-2 h-2 bg-brand-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-brand-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-brand-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Analyzing your requirements and generating the perfect form structure
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Generated Form Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xl font-bold text-foreground">{generatedForm.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{generatedForm.description}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                <Wand2 className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            </div>

            {/* Form Fields Preview */}
            <div className="border rounded-lg p-4 bg-muted">
              <h5 className="font-semibold text-sm text-muted-foreground mb-3">Form Fields ({generatedForm.form?.fields?.length ?? 0})</h5>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {(generatedForm.form?.fields ?? []).map((field: any, index: number) => (
                  <div key={field.id || index} className="flex items-center justify-between p-3 bg-white rounded border border-border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{field.label}</span>
                        {field.required && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Required</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded capitalize">{field.type}</span>
                        {field.placeholder && (
                          <span className="text-xs text-muted-foreground truncate">{field.placeholder}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Settings Preview */}
            {generatedForm.settings && (
              <div className="border rounded-lg p-4 bg-muted">
                <h5 className="font-semibold text-sm text-muted-foreground mb-3">Form Settings</h5>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Thank You Message</span>
                    <span className="text-foreground">{generatedForm.settings.thankYouMessage}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">reCAPTCHA</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${generatedForm.settings.reCaptcha ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {generatedForm.settings.reCaptcha ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {generatedForm.settings.previewConfig && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Preview Config</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${generatedForm.settings.previewConfig.enabled ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {generatedForm.settings.previewConfig.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setGeneratedForm(null)} className="flex-1">
                Back to Edit
              </Button>
              <Button 
                onClick={handleCreateForm}
                className="flex-1 bg-gradient-to-r from-plum-800 to-brand-500 hover:from-plum-900 hover:to-brand-600"
              >
                <FileText className="h-4 w-4 mr-2" />
                Create Form
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
