import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { createForm } from '../../store/formsSlice';
import { resetBuilder, setFormName } from '../../store/builderSlice';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select } from '../ui/select';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { FileText, Layout, Code, Loader2, ArrowLeft, Wand2, Sparkles } from 'lucide-react';
import AIFormCreation from './AIFormCreation';
import { TemplateSelectionContent } from './TemplateSelectionModal';
import { duplicateTemplate } from '../../store/formsSlice';
import { fetchTeams } from '../../store/teamsSlice';
import type { TeamNode } from '../../types';
interface CreateFormModalProps {
  open: boolean;
  onClose: () => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'static' | 'organization';
  createdAt?: string;
  createdBy?: string;
}

type Step = 'choose' | 'scratch' | 'template' | 'json' | 'ai';

export default function CreateFormModal({ open, onClose }: CreateFormModalProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('choose');
  const [formName, setFormNameLocal] = useState('');
  const [formDescription, setFormDescriptionLocal] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (!open) {
      setStep('choose');
      setFormNameLocal('');
      setFormDescriptionLocal('');
      setJsonInput('');
      setJsonError('');
    }
  }, [open]);

  // The owning team decides who can edit the form and who can read its responses,
  // so it is chosen at creation rather than corrected afterwards.
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  const teamTree = useAppSelector((state) => state.teams.tree);

  useEffect(() => {
    if (open && currentOrg?.id) dispatch(fetchTeams(currentOrg.id));
  }, [open, currentOrg?.id, dispatch]);

  // Indented so nesting is visible in a flat <select>.
  const teamOptions = (function flatten(nodes: TeamNode[], depth = 0): { value: string; label: string }[] {
    return nodes.flatMap((team) => [
      { value: team.id, label: `${'  '.repeat(depth)}${depth ? '└ ' : ''}${team.name}` },
      ...flatten(team.children, depth + 1),
    ]);
  })(teamTree);

  useEffect(() => {
    if (teamId || teamOptions.length === 0) return;
    const general = teamTree.find((t) => t.slug === 'general');
    setTeamId(general?.id ?? teamOptions[0].value);
  }, [teamOptions, teamTree, teamId]);


  const handleCreateFromScratch = async () => {
    if (!formName.trim()) return;

    setIsLoading(true);
    try {
      const result = await dispatch(createForm({
        name: formName,
        description: formDescription,
        teamId,
        schema: {
          fields: [],
          layout: { mode: 'singlePage', steps: [] },
        },
        settings: { thankYouMessage: 'Thank you for your submission!' },
      })).unwrap();

      dispatch(resetBuilder());
      dispatch(setFormName(formName));
      onClose();
      navigate(`/forms/${result.id}/edit`);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  // when creating from template we need to prefix static ids so backend recognizes them
  const handleSelectTemplate = async (template: Template) => {
    try {
      const response = await dispatch(duplicateTemplate({ templateId: template.id, name: template.name, teamId })).unwrap();

      onClose();
      navigate(`/forms/${response.id}/edit`);
    } catch (error) {
      console.error('Failed to create form from template:', error);
    }
  };

  const handleImportJson = async () => {
    setJsonError('');

    // Step 1: parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(jsonInput);
    } catch {
      setJsonError('Invalid JSON format — check for missing commas, brackets, or quotes.');
      return;
    }

    // Step 2: basic structure check
    if (!parsed.fields || !Array.isArray(parsed.fields)) {
      setJsonError('Invalid schema: must contain a "fields" array at the top level.');
      return;
    }
    if (parsed.fields.length === 0) {
      setJsonError('The "fields" array is empty — add at least one field.');
      return;
    }
    for (const f of parsed.fields) {
      if (!f.id || !f.type || !f.label) {
        setJsonError(`Each field must have "id", "type", and "label". Check field: ${JSON.stringify(f).slice(0, 80)}`);
        return;
      }
    }

    // Step 3: send to backend
    setIsLoading(true);
    try {
      const result = await dispatch(createForm({
        name: formName.trim() || 'Imported Form',
        description: formDescription,
        teamId,
        schema: {
          fields: parsed.fields,
          layout: parsed.layout || { mode: 'singlePage', steps: [] },
          variables: parsed.variables || [],
        },
        settings: parsed.settings || { thankYouMessage: 'Thank you for your submission!' },
      })).unwrap();

      onClose();
      navigate(`/forms/${result.id}/edit`);
    } catch (error) {
      setJsonError(
        typeof error === 'string'
          ? error
          : error instanceof Error
          ? error.message
          : 'Failed to import form. Please check your schema and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderTeamPicker = () =>
    teamOptions.length > 1 ? (
      <div className="space-y-2">
        <Label htmlFor="formTeam">Team</Label>
        <Select
          id="formTeam"
          value={teamId ?? ''}
          options={teamOptions}
          onChange={(e) => setTeamId(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          This team, and the teams above it, can edit the form and see its responses.
        </p>
      </div>
    ) : null;

  const renderChooseStep = () => (
    <div className="space-y-6">
      {renderTeamPicker()}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        className="cursor-pointer hover:border-brand-500 transition-colors bg-gradient-to-br from-brand-50 to-brand-50 border-brand-200"
        onClick={() => setStep('ai')}
      >
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Wand2 className="h-12 w-12 text-brand-600" />
            <Sparkles className="h-4 w-4 text-brand-500 -ml-2 -mt-2" />
          </div>
          <CardTitle className="text-lg bg-gradient-to-r from-plum-800 to-brand-500 bg-clip-text text-transparent">AI Creation</CardTitle>
          <CardDescription>Describe and generate instantly</CardDescription>
        </CardHeader>
      </Card>
      <Card
        className="cursor-pointer hover:border-brand-500 transition-colors"
        onClick={() => setStep('scratch')}
      >
        <CardHeader className="text-center">
          <FileText className="h-12 w-12 mx-auto text-brand-600 mb-2" />
          <CardTitle className="text-lg">From Scratch</CardTitle>
          <CardDescription>Start with a blank canvas</CardDescription>
        </CardHeader>
      </Card>
      <Card
        className="cursor-pointer hover:border-brand-500 transition-colors"
        onClick={() => setStep('template')}
      >
        <CardHeader className="text-center">
          <Layout className="h-12 w-12 mx-auto text-brand-600 mb-2" />
          <CardTitle className="text-lg">Use Template</CardTitle>
          <CardDescription>Choose from static and organization templates</CardDescription>
        </CardHeader>
      </Card>
      <Card
        className="cursor-pointer hover:border-brand-500 transition-colors"
        onClick={() => setStep('json')}
      >
        <CardHeader className="text-center">
          <Code className="h-12 w-12 mx-auto text-brand-600 mb-2" />
          <CardTitle className="text-lg">Import JSON</CardTitle>
          <CardDescription>Paste your form schema</CardDescription>
        </CardHeader>
      </Card>
      </div>
    </div>
  );

  const renderScratchStep = () => (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => setStep('choose')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="formName">Form Name</Label>
          <Input
            id="formName"
            placeholder="My Registration Form"
            value={formName}
            onChange={(e) => setFormNameLocal(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="formDescription">Description (Optional)</Label>
          <Textarea
            id="formDescription"
            placeholder="A brief description of your form"
            value={formDescription}
            onChange={(e) => setFormDescriptionLocal(e.target.value)}
          />
        </div>

        <Button
          className="w-full"
          onClick={handleCreateFromScratch}
          disabled={!formName.trim() || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Form'
          )}
        </Button>
      </div>
    </div>
  );

  const renderTemplateStep = () => (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => {
        setStep('choose');
      }}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <div className="max-h-[60vh] overflow-y-auto pr-2">
        <TemplateSelectionContent
          onSelectTemplate={(template) => handleSelectTemplate(template)}
        />
      </div>
    </div>
  );

  const downloadTemplate = () => {
    const template = {
      fields: [
        {
          id: "country",
          type: "select",
          label: "Country",
          required: true,
          options: [
            { label: "India", value: "IND" },
            { label: "China", value: "CHN" },
            { label: "USA", value: "USA" }
          ]
        },
        {
          id: "ind_specific",
          type: "text",
          label: "India-specific field",
          placeholder: "Only shown when India is selected",
          required: false,
          showWhen: {
            id: "show_ind",
            logic: "and",
            conditions: [{ id: "c1", fieldId: "country", operator: "equals", value: "IND" }]
          }
        },
        {
          id: "chn_specific",
          type: "text",
          label: "China-specific field",
          placeholder: "Only shown when China is selected",
          required: false,
          showWhen: {
            id: "show_chn",
            logic: "and",
            conditions: [{ id: "c2", fieldId: "country", operator: "equals", value: "CHN" }]
          }
        },
        {
          id: "name",
          type: "text",
          label: "Full Name",
          placeholder: "Enter your full name",
          required: true,
          validation: { minLength: 2, maxLength: 50 }
        },
        {
          id: "email",
          type: "email",
          label: "Email Address",
          required: true
        }
      ],
      layout: { mode: "singlePage", steps: [], allowBackNavigation: true },
      settings: {
        thankYouMessage: "Thank you for your submission!",
        collectTimestamp: true,
        reCaptcha: false
      }
    };

    const dataStr = JSON.stringify(template, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = 'form-template.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const renderJsonStep = () => (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => setStep('choose')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="jsonFormName">Form Name</Label>
          <Input
            id="jsonFormName"
            placeholder="Imported Form"
            value={formName}
            onChange={(e) => setFormNameLocal(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="jsonInput">JSON Schema</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="text-xs"
            >
              <FileText className="h-3 w-3 mr-1" />
              Download Template
            </Button>
          </div>
          <Textarea
            id="jsonInput"
            placeholder='{"fields": [...]}'
            value={jsonInput}
            onChange={(e) => {
              setJsonInput(e.target.value);
              setJsonError('');
            }}
            className="font-mono text-sm min-h-[200px]"
          />
          {jsonError && (
            <p className="text-sm text-destructive">{jsonError}</p>
          )}
        </div>
        <Button
          className="w-full"
          onClick={handleImportJson}
          disabled={!jsonInput.trim() || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            'Import & Create Form'
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${step === 'ai' ? 'max-w-4xl' : 'max-w-2xl'}`} onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Create New Form</DialogTitle>
          <DialogDescription>
            {step === 'choose' && 'Choose how you want to create your form'}
            {step === 'scratch' && 'Start with a blank form'}
            {step === 'template' && 'Choose a template to get started quickly'}
            {step === 'json' && 'Import a form from JSON schema'}
            {step === 'ai' && 'Create a form using AI - just describe what you need'}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {step === 'choose' && renderChooseStep()}
          {step === 'scratch' && renderScratchStep()}
          {step === 'template' && renderTemplateStep()}
          {step === 'json' && renderJsonStep()}
          {step === 'ai' && (
            <AIFormCreation
              teamId={teamId}
              onBack={() => setStep('choose')}
              onFormGenerated={(formData) => {
                onClose();
                navigate(`/forms/${formData.id}/edit`);
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
