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

interface SidebarProps {
  onCreateForm: () => void;
}

const SIDEBAR_COLLAPSED_KEY = 'sifyforms.sidebar.collapsed';
const COLLAPSED_WIDTH = 'w-[4.5rem]';

function initialCollapsedState(): boolean {
  // Compact screens always start as an icon rail so page content keeps its width.
  if (window.matchMedia('(max-width: 1023px)').matches) return true;
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
  const menuRef = useRef<HTMLDivElement>(null);

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

  const updateCollapsed = (next: boolean) => {
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    if (next) setMenuOpen(false);
  };

  const collapseAfterCompactNavigation = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) updateCollapsed(true);
  };

  const handleLogout = () => {
    dispatch(resetOrg());
    dispatch(logout());
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

  return (
    <>
      {!collapsed && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => updateCollapsed(true)}
          className="fixed inset-0 z-40 hidden bg-ink-950/20 backdrop-blur-[1px] max-lg:block"
        />
      )}

      <div
        aria-hidden="true"
        className={cn(
          'relative h-screen w-[4.5rem] shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64'
        )}
      >
        <aside
          aria-label="Application sidebar"
          className={cn(
            'fixed left-0 top-0 z-50 flex h-[100dvh] flex-col border-r border-border/80 bg-card shadow-[4px_0_18px_-14px_hsl(var(--foreground)/0.2)] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:sticky lg:h-screen',
            collapsed ? COLLAPSED_WIDTH : 'w-64'
          )}
        >
          <div className={cn('flex h-16 shrink-0 items-center border-b border-border/70', collapsed ? 'justify-center px-2' : 'px-4')}>
            <Link
              to="/dashboard"
              aria-label="SifyForms dashboard"
              title={collapsed ? 'SifyForms dashboard' : undefined}
              className={cn('flex min-w-0 items-center rounded-lg', collapsed ? 'flex-none justify-center' : 'flex-1')}
              onClick={collapseAfterCompactNavigation}
            >
              <Logo variant={collapsed ? 'icon' : 'lockup'} size="sm" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => updateCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="absolute -right-3 top-[1.125rem] z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-[color,background-color,transform] duration-200 hover:bg-muted hover:text-foreground active:scale-95"
          >
            {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>

          <OrgSwitcher collapsed={collapsed} onCompactNavigate={collapseAfterCompactNavigation} />

          {can(ACTIONS.CREATE_FORM) && (
            <div className={cn('flex shrink-0 justify-center', collapsed ? 'px-2 py-2.5' : 'p-3')}>
              <Button
                onClick={() => {
                  onCreateForm();
                  collapseAfterCompactNavigation();
                }}
                size={collapsed ? 'icon' : 'default'}
                title={collapsed ? 'Create form' : undefined}
                aria-label={collapsed ? 'Create form' : undefined}
                className={cn('rounded-lg shadow-sm shadow-primary/10', collapsed ? 'h-10 w-10 p-0' : 'w-full')}
              >
                <Plus className={cn('h-4 w-4 shrink-0', !collapsed && 'mr-2')} strokeWidth={2.25} />
                {!collapsed && <span>Create form</span>}
              </Button>
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
                  <Link
                    key={item.label}
                    to={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={collapseAfterCompactNavigation}
                    className={cn(
                      'group relative flex h-10 items-center rounded-lg text-[13px] font-semibold transition-colors duration-200',
                      collapsed ? 'justify-center px-0' : 'gap-3 px-2.5',
                      isActive
                        ? 'bg-primary/[0.075] text-primary'
                        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                    )}
                  >
                    {isActive && <span className="absolute left-0 h-5 w-0.5 rounded-r-full bg-primary" aria-hidden="true" />}
                    <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2.25 : 2} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div ref={menuRef} className={cn('relative mt-auto shrink-0 border-t border-border/70', collapsed ? 'p-2' : 'p-2.5')}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title={collapsed ? 'Account menu' : undefined}
              className={cn(
                'flex w-full items-center rounded-xl text-left transition-colors hover:bg-muted/80',
                collapsed ? 'h-11 justify-center px-0' : 'gap-2.5 p-2'
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                {userInitial}
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">{user?.name || 'Your account'}</span>
                    <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">{user?.email}</span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>

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
                    collapseAfterCompactNavigation();
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
    </>
  );
}
