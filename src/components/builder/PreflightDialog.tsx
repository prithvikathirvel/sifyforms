import { Check, AlertTriangle, Globe } from 'lucide-react';
import type { FormField, FormLayout, FormSettings, FormVariable } from '../../types';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { isBotProtectionEnabled } from '../../lib/formPolicy';
import { cn } from '../../lib/utils';
import { HAS_OPTIONS, firstShowWhenLeaf, paymentAmountResolved } from './formSetup';

interface PreflightCheck {
  level: 'ok' | 'warn' | 'err';
  text: string;
  /** Optional “Fix this” action shown on the row. */
  fix?: { label: string; onClick: () => void };
}

interface PreflightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FormField[];
  settings: FormSettings;
  layout: FormLayout;
  variables: FormVariable[];
  isPublishing: boolean;
  onPublish: () => void;
  onFix: (action: 'poll' | 'payment' | 'scoring') => void;
}

/**
 * v2 §3.6 — publishing runs a pre-flight check first.
 *
 * Derived from the schema, so it cannot go stale. Blocking (err) only for what
 * guarantees a broken form; everything else is a warning.
 */
function runPreflight(
  fields: FormField[],
  settings: FormSettings,
  layout: FormLayout,
  variables: FormVariable[],
  onFix: (action: 'poll' | 'payment' | 'scoring') => void
): PreflightCheck[] {
  const out: PreflightCheck[] = [];
  const formType = settings.formType;

  if (fields.length === 0) {
    out.push({ level: 'err', text: 'This form has no questions yet.' });
  }
  const blank = fields.filter((f) => !f.label?.trim()).length;
  if (blank > 0) {
    out.push({ level: 'warn', text: `${blank} question${blank === 1 ? ' has' : 's have'} no text yet.` });
  }

  if (formType === 'voting' && !fields.some((f) => f.isPollQuestion)) {
    out.push({
      level: 'err',
      text: 'This poll doesn\u2019t count any questions yet.',
      fix: { label: 'Fix this', onClick: () => onFix('poll') },
    });
  }
  if (formType === 'assessment' && !fields.some((f) => f.correctAnswer != null)) {
    out.push({
      level: 'err',
      text: 'This quiz has no correct answers set, so nothing can be scored.',
      fix: { label: 'Fix this', onClick: () => onFix('scoring') },
    });
  }
  if (settings.payment?.enabled && !paymentAmountResolved(settings.payment, fields, variables)) {
    out.push({
      level: 'err',
      text: 'Payment is on but no amount is set.',
      fix: { label: 'Fix this', onClick: () => onFix('payment') },
    });
  }
  if (settings.voting?.duplicatePrevention === 'email' && !fields.some((f) => f.type === 'email')) {
    out.push({ level: 'warn', text: 'One vote per email is on, but the form has no email question.' });
  }

  /* A required question whose visibility condition can never be satisfied. */
  fields.forEach((f) => {
    if (!f.required || !f.showWhen) return;
    const leaf = firstShowWhenLeaf(f.showWhen.conditions);
    if (!leaf || !leaf.value) return;
    const source = fields.find((x) => x.id === leaf.fieldId);
    if (!source || !HAS_OPTIONS(source.type)) return;
    const value = String(leaf.value).toLowerCase();
    const matches = (source.options ?? []).some(
      (o) => o.value.toLowerCase() === value || o.label.toLowerCase() === value
    );
    if (!matches) {
      out.push({
        level: 'err',
        text: `\u201C${f.label || 'Untitled question'}\u201D is required but only shows when \u201C${source.label}\u201D is \u201C${leaf.value}\u201D, which is not one of its options.`,
      });
    }
  });

  if (layout.mode === 'multiStep' && (layout.steps ?? []).length > 0) {
    const assigned = new Set((layout.steps ?? []).flatMap((s) => s.fieldIds));
    const orphan = fields.filter((f) => !assigned.has(f.id)).length;
    if (orphan > 0) {
      out.push({
        level: 'warn',
        text: `${orphan} question${orphan === 1 ? ' is' : 's are'} not on any step, so ${orphan === 1 ? 'it' : 'they'} will not be shown.`,
      });
    }
  }
  if (settings.isFormActive === false) {
    out.push({ level: 'warn', text: 'The form is set to not accept responses.' });
  }

  const required = fields.filter((f) => f.required).length;
  out.push({ level: 'ok', text: `${fields.length} question${fields.length === 1 ? '' : 's'}, ${required} required` });
  if (isBotProtectionEnabled(settings)) {
    out.push({ level: 'ok', text: 'Bot protection is on' });
  }
  if (layout.mode === 'multiStep' && (layout.steps ?? []).length > 0) {
    out.push({ level: 'ok', text: `${(layout.steps ?? []).length} steps` });
  }

  return out;
}

export default function PreflightDialog({
  open, onOpenChange, fields, settings, layout, variables, isPublishing, onPublish, onFix,
}: PreflightDialogProps) {
  const checks = runPreflight(fields, settings, layout, variables, onFix);
  const problems = checks.filter((c) => c.level !== 'ok').length;
  const hardErrors = checks.filter((c) => c.level === 'err').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            {problems === 0 ? 'Ready to publish' : `Ready to publish — ${problems} thing${problems === 1 ? '' : 's'} to look at`}
          </DialogTitle>
          <DialogDescription>
            {problems === 0
              ? 'Everything checks out.'
              : 'Blocking issues are things that guarantee a broken form. You can still publish.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5 py-1">
          {checks.map((check, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
              <span className={cn(
                'mt-0.5 flex h-4 w-4 flex-none items-center justify-center',
                check.level === 'ok' && 'text-success',
                check.level === 'warn' && 'text-warning',
                check.level === 'err' && 'text-destructive'
              )}>
                {check.level === 'ok' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </span>
              <span className="flex-1">
                {check.text}
                {check.fix && (
                  <button
                    type="button"
                    className="ml-1.5 font-semibold text-primary hover:underline"
                    onClick={() => { onOpenChange(false); check.fix?.onClick(); }}
                  >
                    {check.fix.label}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Back to editing
          </Button>
          <Button onClick={onPublish} disabled={isPublishing}>
            {isPublishing ? 'Publishing…' : hardErrors > 0 ? 'Publish anyway' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
