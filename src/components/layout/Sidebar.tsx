import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Logo } from '../ui/Logo';
import OrgSwitcher from './OrgSwitcher';
import { usePermissions, ACTIONS } from '../../hooks/usePermissions';
import {
  LayoutDashboard,
  Settings,
  Plus,
  FolderOpen,
  LogOut,
  Users,
  User,
  ChevronsUpDown,
  ShieldCheck,
  Network,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { logout } from '../../store/authSlice';
import { resetOrg } from '../../store/orgSlice';
import { Button } from '../ui/button';

interface SidebarProps {
  onCreateForm: () => void;
}

export default function Sidebar({ onCreateForm }: SidebarProps) {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const { can } = usePermissions();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape, as a menu is expected to.
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

  const handleLogout = () => {
    dispatch(resetOrg());
    dispatch(logout());
  };

  // A destination the role cannot open is worse than no link at all - it
  // advertises a feature and then refuses it. Each entry names the permission
  // that its page requires.
  const navItems = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/dashboard',
      permission: null,
    },
    {
      label: 'Forms',
      icon: FolderOpen,
      href: '/forms',
      permission: ACTIONS.VIEW_FORM,
    },
    {
      label: 'Members',
      icon: Users,
      href: '/members',
      permission: ACTIONS.VIEW_MEMBERS,
    },
    {
      label: 'Teams',
      icon: Network,
      href: '/teams',
      permission: ACTIONS.VIEW_TEAM,
    },
    {
      label: 'Roles',
      icon: ShieldCheck,
      href: '/roles',
      permission: ACTIONS.VIEW_MEMBERS,
    },
    {
      label: 'Organization',
      icon: Settings,
      href: '/settings',
      permission: ACTIONS.MANAGE_ORG,
    },
  ].filter(item => !item.permission || can(item.permission));

  return (
    <div className="flex flex-col h-screen sticky top-0 w-64 shrink-0 bg-card border-r">
      {/* Logo */}
      <div className="px-4 py-5 border-b">
        <Link to="/dashboard" className="flex items-center">
          <Logo size="lg" />
        </Link>
      </div>

      {/* Organization switcher */}
      <OrgSwitcher />

      {/* Create Form Button */}
      {can(ACTIONS.CREATE_FORM) && (
        <div className="p-4">
          <Button onClick={onCreateForm} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Create Form
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/forms'
              ? location.pathname === '/forms' || location.pathname.startsWith('/forms/')
              : location.pathname === item.href;
          return (
            <div key={item.label}>
              <Link
                to={item.href}
                className={cn(
                  'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User - pinned to the bottom by the flex-1 nav above it */}
      <div ref={menuRef} className="relative mt-auto shrink-0 border-t">
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex w-full items-center gap-2 p-4 text-left transition-colors hover:bg-muted"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user?.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-full left-2 right-2 z-30 mb-1 overflow-hidden rounded-md border bg-popover py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate('/account');
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              View profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-muted"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
