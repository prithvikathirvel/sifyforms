import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { setCurrentOrg, fetchOrganizations } from '../../store/orgSlice';
import { resetTeams } from '../../store/teamsSlice';
import { resetMembers } from '../../store/membersSlice';
import { roleLabel } from '../../hooks/usePermissions';
import type { Organization } from '../../types';
import { Building2, Check, ChevronsUpDown, Plus, ArrowLeftRight } from 'lucide-react';

/**
 * Organization switcher in the sidebar masthead.
 *
 * Someone can belong to several organizations, so the current one has to be
 * visible and changeable from anywhere - not only at sign-in. Switching resets
 * the org-scoped slices, otherwise the next screen briefly renders the previous
 * organization's teams and members.
 */
export default function OrgSwitcher() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentOrg, organizations } = useAppSelector((state) => state.org);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (organizations.length === 0) dispatch(fetchOrganizations());
  }, [dispatch, organizations.length]);

  // Dismiss on an outside click or Escape, the way a menu is expected to behave.
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
    if (org.id === currentOrg?.id) return;
    dispatch(resetTeams());
    dispatch(resetMembers());
    dispatch(setCurrentOrg(org));
    navigate('/dashboard');
  };

  if (!currentOrg) return null;

  return (
    <div ref={containerRef} className="relative border-b">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted transition-colors"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium leading-tight">{currentOrg.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            You are {roleLabel(currentOrg.role)}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-2 right-2 top-full z-30 mt-1 overflow-hidden rounded-md border bg-popover shadow-lg"
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {organizations.map((org) => {
              const isCurrent = org.id === currentOrg.id;
              return (
                <button
                  key={org.id}
                  type="button"
                  role="menuitem"
                  onClick={() => switchTo(org)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                >
                  <Check
                    className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-primary' : 'text-transparent'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{org.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {roleLabel(org.role)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/org/setup?create=1');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
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
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              All organizations &amp; invitations
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
