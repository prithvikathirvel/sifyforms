import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Logo } from '../ui/Logo';
import OrgSwitcher from './OrgSwitcher';
import { usePermissions, ACTIONS } from '../../hooks/usePermissions';
import {
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  ShieldCheck,
  User,
  Users,
  ChevronsUpDown,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { logout } from '../../store/authSlice';
import { resetOrg } from '../../store/orgSlice';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import CreateFormModal from '../forms/CreateFormModal';

interface SidebarProps {
  /**
   * Optional. When a page has its own create-form flow it can pass a handler;
   * otherwise the sidebar opens the modal itself, so the button works from
   * every screen rather than only the two that used to wire it up.
   */
  onCreateForm?: () => void;
}

const SIDEBAR_COLLAPSED_KEY = 'sifyforms.sidebar.collapsed';
const COLLAPSED_WIDTH = 'w-[4.25rem]';
/** Items promoted to the compact bottom bar; the rest live behind "More". */
const BOTTOM_BAR_LIMIT = 3;

function initialCollapsedState(): boolean {
  const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  return saved === 'true';
}

export default function Sidebar({ onCreateForm }: SidebarProps) {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { can } = usePermissions();

  const [collapsed, setCollapsed] = useState(initialCollapsedState);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  const updateCollapsed = (next: boolean) => {
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    if (next) setMenuOpen(false);
  };

  const handleLogout = () => {
    dispatch(resetOrg());
    dispatch(logout());
  };

  /**
   * Create a form from anywhere. Pages that keep their own modal pass a
   * handler; everyone else gets the sidebar's, which is why this now works on
   * Members, Teams, Roles and the settings screens.
   */
  const handleCreateForm = () => {
    setMoreOpen(false);
    if (onCreateForm) onCreateForm();
    else setCreateOpen(true);
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', permission: null },
    { label: 'Forms', icon: FolderOpen, href: '/forms', permission: ACTIONS.VIEW_FORM },
    { label: 'Members', icon: Users, href: '/members', permission: ACTIONS.VIEW_MEMBERS },
    { label: 'Teams', icon: Network, href: '/teams', permission: ACTIONS.VIEW_TEAM },
    { label: 'Roles', icon: ShieldCheck, href: '/roles', permission: ACTIONS.VIEW_MEMBERS },
    { label: 'Organization', icon: Settings, href: '/settings', permission: ACTIONS.MANAGE_ORG },
  ].filter((item) => !item.permission || can(item.permission));

  const isItemActive = (href: string) =>
    href === '/forms'
      ? location.pathname === '/forms' || location.pathname.startsWith('/forms/')
      : location.pathname === href;

  const userInitial = user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';
  const canCreateForm = can(ACTIONS.CREATE_FORM);

  const primaryItems = navItems.slice(0, BOTTOM_BAR_LIMIT);
  const overflowItems = navItems.slice(BOTTOM_BAR_LIMIT);
  const overflowActive = overflowItems.some((item) => isItemActive(item.href));

  return (
    <>
      {/* ---------------------------------------------------------------- rail */}
      <div
        className={cn(
          'relative hidden h-screen shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block',
          collapsed ? 'lg:w-[4.25rem]' : 'lg:w-60'
        )}
      >
        <aside
          aria-label="Application sidebar"
          className={cn(
            'sticky top-0 flex h-screen flex-col border-r border-border/70 bg-card transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            collapsed ? COLLAPSED_WIDTH : 'w-60'
          )}
        >
          <div className={cn('flex h-14 shrink-0 items-center border-b border-border/70', collapsed ? 'justify-center px-2' : 'px-4')}>
            <Link
              to="/dashboard"
              aria-label="SifyForms dashboard"
              title={collapsed ? 'SifyForms dashboard' : undefined}
              className={cn('flex min-w-0 items-center rounded-lg', collapsed ? 'flex-none justify-center' : 'flex-1')}
            >
              <Logo variant={collapsed ? 'icon' : 'lockup'} size="sm" />
            </Link>
          </div>

          <OrgSwitcher collapsed={collapsed} />

          {canCreateForm && (
            <div className={cn('flex shrink-0 justify-center', collapsed ? 'px-2 py-2.5' : 'p-3')}>
              <Tooltip content="Create form" side="right" delay="short" disabled={!collapsed}>
                <Button
                  onClick={handleCreateForm}
                  variant="ghost"
                  size={collapsed ? 'icon' : 'default'}
                  aria-label={collapsed ? 'Create form' : undefined}
                  className={cn(
                    'rounded-lg border border-primary/10 bg-primary/[0.055] text-primary shadow-none hover:bg-primary/[0.09] hover:text-primary',
                    collapsed ? 'h-10 w-10 p-0' : 'w-full'
                  )}
                >
                  <Plus className={cn('h-4 w-4 shrink-0', !collapsed && 'mr-2')} strokeWidth={1.8} />
                  {!collapsed && <span>Create form</span>}
                </Button>
              </Tooltip>
            </div>
          )}

          <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2" aria-label="Primary navigation">
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Workspace
              </p>
            )}
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = isItemActive(item.href);
                return (
                  <Tooltip key={item.label} content={item.label} side="right" delay="short" disabled={!collapsed} className="w-full">
                    <Link
                      to={item.href}
                      aria-label={collapsed ? item.label : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group relative flex h-9 w-full items-center rounded-lg text-[13px] font-medium transition-colors duration-200',
                        collapsed ? 'justify-center px-0' : 'gap-3 px-2.5',
                        isActive
                          ? 'bg-primary/[0.055] text-primary'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      )}
                    >
                      <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </Tooltip>
                );
              })}
            </div>
          </nav>

          <div ref={menuRef} className={cn('relative mt-auto shrink-0 border-t border-border/70', collapsed ? 'p-2' : 'p-2.5')}>
            <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={collapsed ? 'Account menu' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 items-center rounded-xl text-left transition-colors hover:bg-muted/70',
                  collapsed ? 'h-9 w-full flex-none justify-center px-0' : 'gap-2.5 p-2'
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.09] text-xs font-bold text-primary">
                  {userInitial}
                </span>
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground">{user?.name || 'Your account'}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">{user?.email}</span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  </>
                )}
              </button>

              <Tooltip content="Expand sidebar" side="right" delay="short" disabled={!collapsed}>
                <button
                  type="button"
                  onClick={() => updateCollapsed(!collapsed)}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    collapsed ? 'h-8 w-10' : 'h-9 w-9'
                  )}
                >
                  {collapsed ? <PanelLeftOpen className="h-4 w-4" strokeWidth={1.8} /> : <PanelLeftClose className="h-4 w-4" strokeWidth={1.8} />}
                </button>
              </Tooltip>
            </div>

            {menuOpen && (
              <div
                role="menu"
                className={cn(
                  'absolute z-50 overflow-hidden rounded-xl border border-border bg-popover py-1.5 shadow-xl shadow-foreground/10',
                  collapsed ? 'bottom-0 left-full ml-2 w-52' : 'bottom-full left-0 right-0 mb-2'
                )}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/account');
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-muted"
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  View profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/[0.06]"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ---------------------------------------------------- compact top bar */}
      <header
        data-app-navbar="top"
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border/70 bg-card px-3 lg:hidden"
      >
        <Link to="/dashboard" aria-label="SifyForms dashboard" className="flex min-w-0 shrink-0 items-center">
          <Logo variant="lockup" size="sm" />
        </Link>
        <div className="flex min-w-0 flex-1 justify-end">
          <OrgSwitcher variant="compact" />
        </div>
      </header>

      {/* ------------------------------------------------- compact bottom bar */}
      <nav
        data-app-navbar="bottom"
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto flex h-16 max-w-2xl items-stretch justify-around gap-0.5 px-1.5">
          {primaryItems.map((item) => {
            const isActive = isItemActive(item.href);
            return (
              <Link
                key={item.label}
                to={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground active:bg-muted/70'
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    isActive && 'bg-primary/[0.09]'
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}

          {canCreateForm && (
            <button
              type="button"
              onClick={handleCreateForm}
              aria-label="Create form"
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold text-primary transition-colors active:bg-primary/[0.08]"
            >
              <span className="flex h-7 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/25">
                <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>
              <span className="max-w-full truncate">Create</span>
            </button>
          )}

          <div ref={moreRef} className="relative flex min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-label="More navigation"
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors',
                overflowActive || moreOpen ? 'text-primary' : 'text-muted-foreground active:bg-muted/70'
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                  (overflowActive || moreOpen) && 'bg-primary/[0.09]'
                )}
              >
                <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </span>
              <span className="max-w-full truncate">More</span>
            </button>

            {moreOpen && (
              <div
                role="menu"
                className="absolute bottom-[calc(100%+0.5rem)] right-0 w-56 overflow-hidden rounded-xl border border-border bg-popover py-1.5 shadow-xl shadow-foreground/10"
              >
                {overflowItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.href}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-muted',
                      isItemActive(item.href) ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                    {item.label}
                  </Link>
                ))}

                <div className="my-1.5 border-t border-border/70" />

                <div className="flex items-center gap-2.5 px-3 pb-1.5 pt-0.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.09] text-xs font-bold text-primary">
                    {userInitial}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-foreground">{user?.name || 'Your account'}</span>
                    <span className="block truncate text-[11px] font-medium text-muted-foreground">{user?.email}</span>
                  </span>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    navigate('/account');
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-muted"
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  View profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/[0.06]"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Only mounted for pages that did not supply their own create flow. */}
      {!onCreateForm && createOpen && (
        <CreateFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      )}
    </>
  );
}
