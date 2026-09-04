import { usePermissions } from '../../hooks/usePermissions';
import { Loader2, RefreshCw, ShieldOff, WifiOff } from 'lucide-react';
import Sidebar from './Sidebar';
import { Button } from '../ui/button';

/**
 * Route-level gate.
 *
 * The sidebar already hides links a role cannot use, but a bookmark or a pasted
 * URL bypasses that. This explains the refusal instead of letting the page load
 * and fail on its first request.
 *
 * Presentation only - the API enforces the same rule on every call.
 */
export default function RequirePermission({
  action,
  label,
  children,
}: {
  action: string;
  /** What the person was trying to reach, named the way they would name it. */
  label: string;
  children: React.ReactNode;
}) {
  const { can, isLoading, error, retry } = usePermissions();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // A permission lookup that failed is not the same as a permission that was
  // refused, and must never be shown as one. Say what happened and offer the
  // way out, rather than spinning until the tab is reloaded.
  if (error) {
    return (
      <div className="app-shell flex h-screen bg-workspace">
        <Sidebar />
        <main className="flex min-w-0 flex-1 items-center justify-center overflow-y-auto p-6">
          <div className="max-w-md space-y-3 text-center">
            <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Could not check your access</h1>
            <p className="text-sm text-muted-foreground">
              We could not confirm what you are allowed to do in this organization, so {label} stayed
              closed. This is usually a connection hiccup.
            </p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button type="button" onClick={retry} className="mt-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!can(action)) {
    return (
      <div className="app-shell flex h-screen bg-workspace">
        <Sidebar />
        <main className="flex min-w-0 flex-1 items-center justify-center overflow-y-auto p-6">
          <div className="max-w-md text-center space-y-3">
            <ShieldOff className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-semibold">{label} is not available to your role</h1>
            <p className="text-sm text-muted-foreground">
              Ask an organization administrator if you need access.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
