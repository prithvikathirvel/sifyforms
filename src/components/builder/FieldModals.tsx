import { useState } from 'react';
import { X } from 'lucide-react';
import type { FormField, FormVariable } from '../../types';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox as UICheckbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { AdvancedLinkingModal } from './AdvancedLinkingModal';
import { ConditionalVisibilityModal } from './ConditionalVisibilityModal';
import { ValidationModal } from './ValidationModal';
import { ExternalValidationModal } from './ExternalValidationModal';
import { CustomAlertModal } from './CustomAlertModal';
import { SupportDocumentsModal } from './SupportDocumentsModal';
import { TableConfigModal } from './TableConfigModal';
import CSVImportModal from './CSVImportModal';
import VariableManager from './VariableManager';
import { DisplayFieldConfig } from './DisplayField';
import type { FieldModalKind } from './QuestionCard';
import { POLLABLE, SHOW_OPERATORS } from './formSetup';

const FILE_ACCEPT_TYPES = ['image/*', '.pdf', '.doc,.docx', '.xls,.xlsx', '.txt'] as const;

interface FieldModalsProps {
  field: FormField;
  allFields: FormField[];
  variables: FormVariable[];
  formId?: string;
  activeModal: FieldModalKind | null;
  onClose: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
}

/* ---------------------------------------------------------------------------
 * Score this question (assessment) — a compact dialog, v2 §3.3
 * ------------------------------------------------------------------------- */
function ScoringDialog({ field, open, onClose, onUpdate }: {
  field: FormField;
  open: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const isMulti = ['checkbox', 'multiselect'].includes(field.type);
  const options = field.options ?? [];
  const [points, setPoints] = useState<number>(field.points ?? 1);
  const [section, setSection] = useState<string>(field.section ?? '');

  const toggleAnswer = (value: string) => {
    const current = Array.isArray(field.correctAnswer) ? field.correctAnswer : field.correctAnswer ? [field.correctAnswer] : [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onUpdate({ correctAnswer: isMulti ? (next.length ? next : undefined) : (next[0] ?? undefined) });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Score this question</DialogTitle>
          <DialogDescription>
            Mark the answer{isMulti ? 's' : ''} that count{isMulti ? '' : 's'} as correct and how much it is worth.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1">
          {options.length === 0 ? (
            <p className="text-sm text-amber-600">Add options to this question first.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Correct answer{isMulti ? 's' : ''}</Label>
              {options.map((opt) => {
                const selected = Array.isArray(field.correctAnswer)
                  ? field.correctAnswer.includes(opt.value)
                  : field.correctAnswer === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleAnswer(opt.value)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${selected ? 'border-green-500 bg-green-50 text-green-800' : 'border-input hover:bg-muted'}`}
                  >
                    <span className={`h-3.5 w-3.5 flex-shrink-0 border-2 ${isMulti ? 'rounded-sm' : 'rounded-full'} ${selected ? 'border-green-500 bg-green-500' : 'border-muted-foreground'}`} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Label className="w-20">Points</Label>
            <Input
              type="number"
              min={0}
              value={points}
              onChange={(e) => setPoints(Math.max(0, Number(e.target.value)))}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="w-20">Section</Label>
            <Input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. Part A (optional)"
              className="flex-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => { onUpdate({ correctAnswer: undefined, points: undefined, section: undefined }); onClose(); }}
          >
            Remove scoring
          </Button>
          <Button onClick={() => { onUpdate({ points, section: section || undefined }); onClose(); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------------
 * File types and size — the per-question upload policy, v2 §3.3
 * ------------------------------------------------------------------------- */
function FileConfigDialog({ field, open, onClose, onUpdate }: {
  field: FormField;
  open: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const accept = field.fileConfig?.accept ?? [];
  const [maxSize, setMaxSize] = useState<number>(Math.round((field.fileConfig?.maxSize ?? 5242880) / 1048576));
  const [minSize, setMinSize] = useState<number>(Math.round((field.fileConfig?.minSize ?? 0) / 1048576));
  const [multiple, setMultiple] = useState<boolean>(!!field.fileConfig?.multiple);

  const toggleAccept = (type: string, checked: boolean) => {
    const next = checked ? [...accept, type] : accept.filter((t) => t !== type);
    onUpdate({ fileConfig: { ...field.fileConfig, accept: next.length ? next : undefined } });
  };

  const save = () => {
    onUpdate({
      fileConfig: {
        ...field.fileConfig,
        minSize: minSize * 1024 * 1024,
        maxSize: Math.max(1, maxSize) * 1024 * 1024,
        multiple,
      },
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>File types and size</DialogTitle>
          <DialogDescription>Narrows what this specific question accepts.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-2">
            <Label>Allowed file types</Label>
            <p className="text-xs text-muted-foreground">Leave all unchecked to accept every type the form allows.</p>
            {FILE_ACCEPT_TYPES.map((type) => (
              <label key={type} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <UICheckbox
                  checked={accept.includes(type)}
                  onCheckedChange={(checked: boolean) => toggleAccept(type, !!checked)}
                />
                {type}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Minimum size (MB)</Label>
              <Input type="number" min={0} value={minSize} onChange={(e) => setMinSize(Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Maximum size (MB)</Label>
              <Input type="number" min={1} value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))} />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <UICheckbox checked={multiple} onCheckedChange={(checked: boolean) => setMultiple(!!checked)} />
            Allow multiple files
          </label>
          <div className="rounded-lg border border-plum-200 bg-plum-50 p-3 text-[11px] leading-relaxed text-plum-800">
            The form-level policy in <b>Access &amp; Security</b> is the ceiling; this can only narrow it.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onUpdate({ fileConfig: undefined }); onClose(); }}>
            Remove limits
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------------
 * Data calculations (VariableManager) — used at page level
 * ------------------------------------------------------------------------- */
export function VariablesModal({ variables, fields, onClose, onUpdateVariables }: {
  variables: FormVariable[];
  fields: FormField[];
  onClose: () => void;
  onUpdateVariables: (variables: FormVariable[]) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex h-[min(46rem,90dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Data calculations</h2>
            <p className="mt-0.5 text-xs font-medium leading-5 text-muted-foreground">
              Create variables to perform calculations or store values, usable in display fields and conditions.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close data calculations"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-5 py-4 scrollbar-subtle">
          <VariableManager
            variables={variables}
            fields={fields}
            onUpdateVariables={onUpdateVariables}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * The modal host: one of each, launched from the ⋮ menu (v2 §3.3)
 * ------------------------------------------------------------------------- */
export default function FieldModals({
  field, allFields, variables, formId, activeModal, onClose, onUpdate,
}: FieldModalsProps) {
  const orgId = useAppSelector((state) => state.org.currentOrg?.id);
  const otherFields = allFields.filter((f) => f.id !== field.id);
  const isOpen = (kind: FieldModalKind) => activeModal === kind;

  return (
    <>
      <ValidationModal
        field={field}
        otherFields={otherFields}
        isOpen={isOpen('validation')}
        onClose={onClose}
        onUpdate={onUpdate}
      />
      <ConditionalVisibilityModal
        field={field}
        otherFields={otherFields}
        isOpen={isOpen('visibility')}
        onClose={onClose}
        onUpdate={onUpdate}
        operators={SHOW_OPERATORS}
      />
      <AdvancedLinkingModal
        field={field}
        otherFields={otherFields}
        variables={variables}
        isOpen={isOpen('linking')}
        onClose={onClose}
        onUpdate={onUpdate}
      />
      <ExternalValidationModal
        isOpen={isOpen('external')}
        onClose={onClose}
        field={field}
        onUpdate={onUpdate}
      />
      <CustomAlertModal
        isOpen={isOpen('alerts')}
        onClose={onClose}
        field={field}
        otherFields={otherFields}
        onUpdate={onUpdate}
        operators={SHOW_OPERATORS}
      />
      <SupportDocumentsModal
        isOpen={isOpen('documents')}
        onClose={onClose}
        field={field}
        onUpdate={onUpdate}
        orgId={orgId}
        formId={formId}
        dmsEnabled
      />
      <TableConfigModal
        isOpen={isOpen('table')}
        onClose={onClose}
        field={field}
        onUpdate={onUpdate}
        allFields={allFields}
        variables={variables}
      />
      <CSVImportModal
        open={isOpen('csv')}
        onClose={onClose}
        onImport={(newOptions) => {
          onUpdate({ options: [...(field.options || []), ...newOptions] });
          onClose();
        }}
      />
      <ScoringDialog
        field={field}
        open={isOpen('scoring') && POLLABLE(field.type)}
        onClose={onClose}
        onUpdate={onUpdate}
      />
      <FileConfigDialog
        field={field}
        open={isOpen('file') && field.type === 'file'}
        onClose={onClose}
        onUpdate={onUpdate}
      />

      {/* Display value configuration, in a dialog instead of a side panel */}
      <Dialog open={isOpen('display')} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose what to display</DialogTitle>
            <DialogDescription>Show a calculated value or a stored answer on the form.</DialogDescription>
          </DialogHeader>
          <DisplayFieldConfig field={field} variables={variables} onUpdate={onUpdate} />
          <DialogFooter>
            <Button onClick={onClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
