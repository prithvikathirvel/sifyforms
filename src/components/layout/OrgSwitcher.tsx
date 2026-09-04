import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { setCurrentOrg, fetchOrganizations } from '../../store/orgSlice';
import { resetTeams } from '../../store/teamsSlice';
import { resetMembers } from '../../store/membersSlice';
import { resetForms } from '../../store/formsSlice';
import { clearSubmissions } from '../../store/submissionsSlice';
import { resetSharing } from '../../store/formSharingSlice';
import { resetRoles } from '../../store/rolesSlice';
import { resetBuilder } from '../../store/builderSlice';
import { roleLabel } from '../../hooks/usePermissions';
import { rotateOrganizationRequestScope } from '../../lib/api';
import type { Organization } from '../../types';
import { cn } from '../../lib/utils';
import { ArrowLeftRight, Building2, Check, ChevronsUpDown, Plus } from 'lucide-react';

interface OrgSwitcherProps {
  collapsed?: boolean;
  onCompactNavigate?: () => void;
  /**
   * `sidebar` is the bordered block in the desktop rail. `compact` is the
   * inline control used by the mobile top bar, where the switcher sits beside
   * the logo instead of stacked under it.
   */
  variant?: 'sidebar' | 'compact';
}

/** Organization switcher that adapts to the full sidebar, icon rail, and mobile bar. */
export default function OrgSwitcher({ collapsed = false, onCompactNavigate, variant = 'sidebar' }: OrgSwitcherProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentOrg, organizations } = useAppSelector((state) => state.org);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (organizations.length === 0) dispatch(fetchOrganizations());
  }, [dispatch, organizations.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const switchTo = (org: Organization) => {
    setOpen(false);
    if (org.id === currentOrg?.id) {
      onCompactNavigate?.();
      return;
    }
    rotateOrganizationRequestScope();
    // Organization-scoped entities must never survive a workspace switch. In
    // particular, stale forms from the previous organization produced links
    // that correctly returned “Form not found” under the new x-org-id header.
    dispatch(resetTeams());
    dispatch(resetMembers());
    dispatch(resetForms());
    dispatch(clearSubmissions());
    dispatch(resetSharing());
    dispatch(resetRoles());
    dispatch(resetBuilder());
    dispatch(setCurrentOrg(org));
    navigate('/dashboard');
    onCompactNavigate?.();
  };

  if (!currentOrg) return null;

  const isCompact = variant === 'compact';

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative shrink-0',
        isCompact ? 'min-w-0 max-w-[60%]' : cn('border-b border-border/70', collapsed ? 'p-2' : 'p-2.5')
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={collapsed || isCompact ? `Switch organization. Current: ${currentOrg.name}` : undefined}
        title={collapsed || isCompact ? currentOrg.name : undefined}
        className={cn(
          'flex w-full items-center rounded-xl text-left transition-colors hover:bg-muted/80',
          isCompact
            ? 'h-9 gap-2 border border-border/70 px-2'
            : collapsed
              ? 'h-10 justify-center px-0'
              : 'gap-2.5 px-2 py-1.5'
        )}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/[0.065] text-primary',
            isCompact ? 'h-6 w-6' : 'h-8 w-8'
          )}
        >
          <Building2 className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={1.8} />
        </span>
        {isCompact ? (
          <>
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">{currentOrg.name}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        ) : (
          !collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-tight text-foreground">{currentOrg.name}</span>
                <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">
                  {roleLabel(currentOrg.role)}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </>
          )
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 overflow-hidden rounded-xl border border-border bg-popover shadow-xl shadow-foreground/10',
            isCompact
              ? 'right-0 top-full mt-1.5 w-64'
              : collapsed
                ? 'left-full top-0 ml-2 w-64'
                : 'left-2 right-2 top-full mt-1'
          )}
        >
          <div className="border-b border-border/70 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Switch workspace</p>
          </div>
          <div className="max-h-64 overflow-y-auto py-1.5">
            {organizations.map((org) => {
              const isCurrent = org.id === currentOrg.id;
              return (
                <button
                  key={org.id}
                  type="button"
                  role="menuitem"
                  onClick={() => switchTo(org)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted"
                >
                  <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', isCurrent ? 'bg-primary/[0.08] text-primary' : 'text-transparent')}>
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">{org.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">{roleLabel(org.role)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-border/70 py-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/org/setup?create=1');
                onCompactNavigate?.();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
              Create organization
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/org/setup');
                onCompactNavigate?.();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-muted"
            >
              <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              All organizations
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
