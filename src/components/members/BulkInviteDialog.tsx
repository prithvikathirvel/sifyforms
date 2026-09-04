import { useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp, Loader2, MinusCircle, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { DropdownSelect } from '../ui/dropdown-select';
import { BULK_INVITE_LIMIT, parseInviteList, type ParsedInviteRow } from '../../lib/inviteList';
import type { BulkInviteResult } from '../../store/membersSlice';

/**
 * Invite a lot of people at once.
 *
 * The shape of this dialog follows from one observation: the person doing this
 * has a list somewhere else, and the whole job is getting it in here without
 * retyping it. So the primary control is a big textarea that accepts a paste in
 * any of the formats a list actually arrives in, with a file picker beside it
 * for the case where the list is a downloaded CSV.
 *
 * The second decision is that problems are shown *before* anything is sent.
 * Parsing runs as you type, so a mistyped address is a line highlighted under
 * the box rather than a failure report after a round-trip. That is the entire
 * reason the parsing rules are duplicated on the client — the server still
 * re-checks every one of them, because a check that only runs in a browser is
 * not a check.
 *
 * The third is that a partial success is a success. Six bad lines out of eighty
 * must not stop the other seventy-four, and the result screen therefore
 * separates what was invited, what was skipped because it was already done, and
 * what genuinely failed — three different things that a single error count
 * would flatten into noise.
 */

export interface BulkInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleOptions: Array<{ value: string; label: string }>;
  defaultRole: string;
  submitting: boolean;
  onSubmit: (invites: Array<{ email: string; role?: string }>, defaultRole: string) => Promise<BulkInviteResult | null>;
}

export default function BulkInviteDialog({
  open,
  onOpenChange,
  roleOptions,
  defaultRole,
  submitting,
  onSubmit,
}: BulkInviteDialogProps) {
  const [text, setText] = useState('');
  const [role, setRole] = useState(defaultRole);
  const [result, setResult] = useState<BulkInviteResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const assignableRoles = useMemo(() => roleOptions.map((option) => option.value), [roleOptions]);

  // Parsing an invite list is a few hundred regex tests at worst, so it can run
  // on every keystroke — but only when the text has actually changed, which is
  // what this memo buys. Re-parsing because the role dropdown moved would be
  // wasted work on every render.
  const parsed = useMemo(() => parseInviteList(text, assignableRoles), [text, assignableRoles]);

  const overLimit = parsed.valid.length > BULK_INVITE_LIMIT;
  const canSubmit = parsed.valid.length > 0 && !overLimit && !submitting;

  const reset = () => {
    setText('');
    setResult(null);
    setRole(defaultRole);
  };

  const close = () => {
    onOpenChange(false);
    // Deferred so the closing animation is not interrupted by the content
    // vanishing underneath it.
    window.setTimeout(reset, 200);
  };

  const readFile = async (file: File) => {
    const contents = await file.text();
    // Appended, not replaced: picking a second file should add to the list, and
    // a file picked after a paste should not silently discard the paste.
    setText((previous) => (previous.trim() ? `${previous.trim()}\n${contents}` : contents));
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    const outcome = await onSubmit(
      parsed.valid.map((entry) => ({ email: entry.email, role: entry.role })),
      role,
    );
    if (outcome) setResult(outcome);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent onClose={close} className="max-w-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle>{result ? 'Invitations sent' : 'Invite several people'}</DialogTitle>
          <DialogDescription>
            {result
              ? 'Here is what happened to each address.'
              : 'Paste a list of email addresses, or upload a CSV. Everyone gets the same role unless a line says otherwise.'}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <ResultReport result={result} onDone={close} onAgain={reset} />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <Label htmlFor="bulk-invite-list">Email addresses</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  className="h-8 rounded-lg px-2.5 text-xs"
                >
                  <FileUp className="mr-1.5 h-3.5 w-3.5" />
                  Upload a CSV
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void readFile(file);
                  }}
                />
              </div>
              <textarea
                id="bulk-invite-list"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={8}
                spellCheck={false}
                placeholder={'jane@example.com\njohn@example.com, Analyst\n"Sam Patel" <sam@example.com>'}
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-[13px] leading-6 text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                One person per line. To give someone a different role, put it after a comma on their
                line. Up to {BULK_INVITE_LIMIT} people at a time.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Role for everyone else</Label>
              <DropdownSelect
                value={role}
                options={roleOptions}
                onValueChange={setRole}
                ariaLabel="Role for invited members"
                size="default"
              />
            </div>

            <ParseSummary parsed={parsed} overLimit={overLimit} />

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="button" onClick={submit} disabled={!canSubmit}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Upload className="mr-2 h-4 w-4" />
                {parsed.valid.length > 0
                  ? `Invite ${parsed.valid.length} ${parsed.valid.length === 1 ? 'person' : 'people'}`
                  : 'Invite'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * What the list currently contains, updated as it is typed.
 *
 * A count of what will be sent is the reassurance; the list of problems is the
 * actionable part. Problems name the line number, because that is the only way
 * to find a bad address in eighty lines of pasted text.
 */
function ParseSummary({
  parsed,
  overLimit,
}: {
  parsed: { valid: ParsedInviteRow[]; invalid: ParsedInviteRow[]; duplicates: ParsedInviteRow[] };
  overLimit: boolean;
}) {
  const problems = [...parsed.invalid, ...parsed.duplicates].sort((a, b) => a.row - b.row);
  if (parsed.valid.length === 0 && problems.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-ink-50/50 p-3.5">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {parsed.valid.length} ready to invite
        </span>
        {problems.length > 0 && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            {problems.length} line{problems.length === 1 ? '' : 's'} skipped
          </span>
        )}
      </p>

      {overLimit && (
        <p role="alert" className="text-[13px] font-medium text-destructive">
          That is more than {BULK_INVITE_LIMIT} people. Remove some lines and send the rest afterwards.
        </p>
      )}

      {problems.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-xs leading-5">
          {problems.map((problem) => (
            <li key={`${problem.row}-${problem.email}`} className="flex gap-2">
              <span className="shrink-0 font-mono text-muted-foreground">Line {problem.row}</span>
              <span className="min-w-0 break-all text-ink-700">
                {problem.email && <span className="font-medium">{problem.email} — </span>}
                {problem.error}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The server's report.
 *
 * Three categories, not two. "Skipped" — already a member, already invited — is
 * neither a success nor a failure and must not be counted as either: it is the
 * expected outcome of re-pasting a list that overlaps with last month's, and
 * calling it an error is how people learn to ignore error counts.
 */
function ResultReport({
  result,
  onDone,
  onAgain,
}: {
  result: BulkInviteResult;
  onDone: () => void;
  onAgain: () => void;
}) {
  const notInvited = result.results.filter((entry) => entry.status !== 'invited');

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Tally icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} value={result.invited} label="Invited" />
        <Tally icon={<MinusCircle className="h-4 w-4 text-ink-400" />} value={result.skipped} label="Already there" />
        <Tally icon={<AlertCircle className="h-4 w-4 text-destructive" />} value={result.failed} label="Failed" />
      </div>

      {notInvited.length > 0 && (
        <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-ink-50/50 p-3.5">
          {notInvited.map((entry) => (
            <p key={`${entry.row}-${entry.email}`} className="flex gap-2 text-xs leading-5">
              <span
                className={`shrink-0 font-semibold ${entry.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {entry.status === 'failed' ? 'Failed' : 'Skipped'}
              </span>
              <span className="min-w-0 break-all text-ink-700">
                <span className="font-medium">{entry.email || `line ${entry.row}`}</span>
                {entry.reason ? ` — ${entry.reason}` : ''}
              </span>
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onAgain}>Invite more people</Button>
        <Button type="button" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

function Tally({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}{label}
      </p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
