import { useState } from 'react';
import { Check, AlertTriangle, Globe, Undo2 } from 'lucide-react';
import type { FormField, FormLayout, FormSettings, FormVariable } from '../../types';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { isBotProtectionEnabled } from '../../lib/formPolicy';
import { cn } from '../../lib/utils';
import { HAS_OPTIONS, firstShowWhenLeaf, paymentAmountResolved } from './formSetup';

interface PreflightCheck {
  /** Stable id, so a skipped row stays skipped across re-renders. */
  id: string;
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
 * guarantees a broken form; everything else is a warning. Each row can be
 * skipped individually — “I know, publish anyway” — and a skipped row stops
 * counting toward the headline.
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
    out.push({ id: 'no-questions', level: 'err', text: 'This form has no questions yet.' });
  }
  const blank = fields.filter((f) => !f.label?.trim()).length;
  if (blank > 0) {
    out.push({ id: 'blank-labels', level: 'warn', text: `${blank} question${blank === 1 ? ' has' : 's have'} no text yet.` });
  }

  if (formType === 'voting' && !fields.some((f) => f.isPollQuestion)) {
    out.push({
      id: 'poll-empty',
      level: 'err',
      text: 'This poll doesn\u2019t count any questions yet.',
      fix: { label: 'Fix this', onClick: () => onFix('poll') },
    });
  }
  if (formType === 'assessment' && !fields.some((f) => f.correctAnswer != null)) {
    out.push({
      id: 'scoring-empty',
      level: 'err',
      text: 'This quiz has no correct answers set, so nothing can be scored.',
      fix: { label: 'Fix this', onClick: () => onFix('scoring') },
    });
  }
  if (settings.payment?.enabled && !paymentAmountResolved(settings.payment, fields, variables)) {
    out.push({
      id: 'payment-amount',
      level: 'err',
      text: 'Payment is on but no amount is set.',
      fix: { label: 'Fix this', onClick: () => onFix('payment') },
    });
  }
  if (settings.voting?.duplicatePrevention === 'email' && !fields.some((f) => f.type === 'email')) {
    out.push({ id: 'vote-email', level: 'warn', text: 'One vote per email is on, but the form has no email question.' });
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
        id: `vis-${f.id}`,
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
        id: 'step-orphans',
        level: 'warn',
        text: `${orphan} question${orphan === 1 ? ' is' : 's are'} not on any step, so ${orphan === 1 ? 'it' : 'they'} will not be shown.`,
      });
    }
  }
  if (settings.isFormActive === false) {
    out.push({ id: 'form-inactive', level: 'warn', text: 'The form is set to not accept responses.' });
  }

  const required = fields.filter((f) => f.required).length;
  out.push({ id: 'summary-questions', level: 'ok', text: `${fields.length} question${fields.length === 1 ? '' : 's'}, ${required} required` });
  if (isBotProtectionEnabled(settings)) {
    out.push({ id: 'ok-bot', level: 'ok', text: 'Bot protection is on' });
  }
  if (layout.mode === 'multiStep' && (layout.steps ?? []).length > 0) {
    out.push({ id: 'ok-steps', level: 'ok', text: `${(layout.steps ?? []).length} steps` });
  }

  return out;
}

export default function PreflightDialog({
  open, onOpenChange, fields, settings, layout, variables, isPublishing, onPublish, onFix,
}: PreflightDialogProps) {
  const checks = runPreflight(fields, settings, layout, variables, onFix);
  /** Ids the person chose to publish despite. */
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  // Reset the skips each time the dialog opens (render-phase adjustment —
  // the documented pattern for state that follows a prop transition).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSkipped(new Set());
  }

  const problems = checks.filter((c) => c.level !== 'ok' && !skipped.has(c.id));
  const hardErrors = problems.filter((c) => c.level === 'err').length;
  const oks = checks.filter((c) => c.level === 'ok');

  const toggleSkip = (id: string) => {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            {problems.length === 0 ? 'Ready to publish' : `Ready to publish — ${problems.length} thing${problems.length === 1 ? '' : 's'} to look at`}
          </DialogTitle>
          <DialogDescription>
            {problems.length === 0
              ? 'Everything checks out.'
              : 'Fix anything that matters, or skip what you already know about — then publish.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {/* Things to look at — errors first, each skippable */}
          {problems.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border">
              {problems.map((check, i) => (
                <div
                  key={check.id}
                  className={cn(
                    'flex items-start gap-2.5 px-3 py-2.5',
                    i > 0 && 'border-t border-border/70',
                    check.level === 'err' ? 'bg-destructive/[0.03]' : 'bg-card'
                  )}
                >
                  <span className={cn(
                    'mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full',
                    check.level === 'err'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-warning/10 text-warning'
                  )}>
                    <AlertTriangle className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-foreground">
                    {check.text}
                    {check.level === 'err' && (
                      <span className="ml-1.5 rounded bg-destructive/10 px-1 py-px text-[9.5px] font-bold uppercase tracking-wide text-destructive">
                        Blocking
                      </span>
                    )}
                  </span>
                  <span className="flex flex-none items-center gap-1">
                    {check.fix && (
                      <button
                        type="button"
                        className="rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-primary hover:bg-primary/[0.07]"
                        onClick={() => { onOpenChange(false); check.fix?.onClick(); }}
                      >
                        {check.fix.label}
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-md px-1.5 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => toggleSkip(check.id)}
                      title="Publish without changing this"
                    >
                      Skip
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Skipped rows — quiet, undoable */}
          {[...skipped].length > 0 && (
            <div className="flex flex-col gap-1">
              {[...skipped].map((id) => {
                const check = checks.find((c) => c.id === id);
                if (!check || check.level === 'ok') return null;
                return (
                  <div key={id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[12px] text-muted-foreground">
                    <span className="rounded bg-ink-200 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-ink-500">Skipped</span>
                    <span className="min-w-0 flex-1 truncate line-through decoration-ink-300">{check.text}</span>
                    <button
                      type="button"
                      className="inline-flex flex-none items-center gap-1 font-medium text-foreground/70 hover:text-primary"
                      onClick={() => toggleSkip(id)}
                    >
                      <Undo2 className="h-3 w-3" />
                      Undo
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Looking good */}
          {oks.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-xl bg-muted/30 px-3 py-2.5">
              {oks.map((check) => (
                <div key={check.id} className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                  <Check className="h-3.5 w-3.5 flex-none text-success" />
                  {check.text}
                </div>
              ))}
            </div>
          )}
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
