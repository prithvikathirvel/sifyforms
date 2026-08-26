import { usePermissions } from '../../hooks/usePermissions';
import { Loader2, ShieldOff } from 'lucide-react';
import Sidebar from './Sidebar';

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
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!can(action)) {
    return (
      <div className="flex min-h-screen">
        <Sidebar onCreateForm={() => {}} />
        <main className="flex flex-1 items-center justify-center p-6">
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
