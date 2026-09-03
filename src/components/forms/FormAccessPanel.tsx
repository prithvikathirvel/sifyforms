import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import {
  fetchFormAccess,
  fetchFormShares,
  shareForm,
  revokeFormShare,
  setResponsePolicy,
  moveFormToTeam,
} from '../../store/formSharingSlice';
import { fetchTeams } from '../../store/teamsSlice';
import { fetchMembers } from '../../store/membersSlice';
import {
  RESPONSE_POLICY_OPTIONS,
  RESPONSE_LEVEL_LABEL,
  policyLabel,
} from '../../hooks/usePermissions';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import type { Team } from '../../types';
import { Loader2, Lock, ShieldCheck, Trash2, Users, UserPlus } from 'lucide-react';

/**
 * Who can reach this form, and how much of its responses they see.
 *
 * Three controls, in the order they take effect: the team that owns the form,
 * the response-visibility policy that caps everyone, and the individual shares
 * that grant exceptions.
 */

interface Props {
  formId: string;
}

/** Map the flat team list into options for a picker. */
function flattenTeams(teams: Team[]): { value: string; label: string }[] {
  return teams.map((team) => ({ value: team.id, label: team.name }));
}

export default function FormAccessPanel({ formId }: Props) {
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  const access = useAppSelector((state) => state.formSharing.access[formId]);
  const shares = useAppSelector((state) => state.formSharing.shares[formId] ?? []);
  const error = useAppSelector((state) => state.formSharing.error);
  const teams = useAppSelector((state) => state.teams.teams);
  const members = useAppSelector((state) => state.members.members);

  const [principalType, setPrincipalType] = useState<'USER' | 'TEAM'>('USER');
  const [principalId, setPrincipalId] = useState('');
  const [level, setLevel] = useState('REDACTED');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);

  const orgId = currentOrg?.id;

  useEffect(() => {
    dispatch(fetchFormAccess(formId));
    if (orgId) dispatch(fetchTeams(orgId));
  }, [dispatch, formId, orgId]);

  useEffect(() => {
    if (!access?.canShare || !orgId) return;
    dispatch(fetchFormShares(formId));
    dispatch(fetchMembers(orgId));
  }, [access?.canShare, dispatch, formId, orgId]);

  const teamOptions = flattenTeams(teams);
  const policyLocked = access?.policy !== undefined && shares !== undefined;

  const onShare = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!principalId) return;
    setBusy(true);
    const result = await dispatch(
      shareForm({
        formId,
        principalType,
        principalId,
        level,
        expiresAt: expiresAt || null,
      })
    );
    setBusy(false);
    if (shareForm.fulfilled.match(result)) {
      setPrincipalId('');
      setExpiresAt('');
    }
  };

  if (!access) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const principalLabel = (share: { principalType: string; principalId: string }) => {
    if (share.principalType === 'TEAM') {
      return teamOptions.find((t) => t.value === share.principalId)?.label.replace(/^(— )+/, '') ??
        'A team';
    }
    const member = members.find((m) => m.id === share.principalId);
    return member
      ? [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email
      : 'A member';
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* --- owning team ------------------------------------------------- */}
      <section className="space-y-2">
        <Label htmlFor="form-team">Owned by team</Label>
        <Select
          id="form-team"
          options={teamOptions}
          placeholder="Select a team"
          disabled={!access.canMove}
          onChange={(e) => dispatch(moveFormToTeam({ formId, teamId: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          The team groups this form. Who can edit or read it comes from org roles and shares.
        </p>
      </section>

      {/* --- response policy ---------------------------------------------- */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="form-policy">Who can read responses</Label>
          {policyLocked && access.policy !== 'STANDARD' && (
            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              <ShieldCheck className="h-3 w-3" />
              {policyLabel(access.policy)}
            </span>
          )}
        </div>
        <Select
          id="form-policy"
          value={access.policy}
          options={RESPONSE_POLICY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(e) => dispatch(setResponsePolicy({ formId, policy: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {RESPONSE_POLICY_OPTIONS.find((o) => o.value === access.policy)?.hint}
        </p>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
          Locked once the first response arrives — people answer under the terms shown at the time.
        </p>
      </section>

      {/* --- your own access ---------------------------------------------- */}
      <section className="rounded-md border p-3 text-sm">
        <p className="font-medium">Your access: {RESPONSE_LEVEL_LABEL[access.level]}</p>
        {access.reasons.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {access.reasons.map((reason, i) => (
              <li key={i}>· {reason}</li>
            ))}
          </ul>
        )}
      </section>

      {/* --- shares --------------------------------------------------------- */}
      {access.canShare && (
        <section className="space-y-3">
          <Label>Shared with</Label>

          {shares.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not shared with anyone yet.
            </p>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      {share.principalType === 'TEAM' ? (
                        <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      {principalLabel(share)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {RESPONSE_LEVEL_LABEL[share.level]}
                      {share.expiresAt &&
                        ` · ${share.isExpired ? 'expired' : 'expires'} ${new Date(
                          share.expiresAt
                        ).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dispatch(revokeFormShare({ formId, shareId: share.id }))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={onShare} className="space-y-3 rounded-md border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="share-type">Share with</Label>
                <Select
                  id="share-type"
                  value={principalType}
                  options={[
                    { value: 'USER', label: 'A person' },
                    { value: 'TEAM', label: 'A team' },
                  ]}
                  onChange={(e) => {
                    setPrincipalType(e.target.value as 'USER' | 'TEAM');
                    setPrincipalId('');
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-principal">
                  {principalType === 'USER' ? 'Person' : 'Team'}
                </Label>
                <Select
                  id="share-principal"
                  value={principalId}
                  placeholder="Select"
                  options={
                    principalType === 'TEAM'
                      ? teamOptions
                      : members.map((m) => ({
                          value: m.id,
                          label:
                            [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
                        }))
                  }
                  onChange={(e) => setPrincipalId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-level">Access</Label>
                <Select
                  id="share-level"
                  value={level}
                  options={['AGGREGATE', 'REDACTED', 'FULL', 'EXPORT'].map((l) => ({
                    value: l,
                    label: RESPONSE_LEVEL_LABEL[l],
                  }))}
                  onChange={(e) => setLevel(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-expiry">Expires (optional)</Label>
                <Input
                  id="share-expiry"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={busy || !principalId}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Grant access
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
