import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, LogIn } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { logout } from '../../store/authSlice';
import { onSessionEnded, SESSION_END_MESSAGE, type SessionEndReason } from '../../lib/session';
import { Button } from '../ui/button';

/**
 * Tells people when their session has ended, instead of silently dropping them
 * on the sign-in screen.
 *
 * A silent redirect is the single most alarming thing this application can do:
 * work disappears, the reason is invisible, and the natural conclusion is that
 * the product lost it. A dialog costs one click and replaces that with a fact.
 *
 * A dialog rather than a toast, deliberately. A toast is dismissible, easy to
 * miss, and can be scrolled past — none of which suit a message that explains
 * why the page in front of you has stopped working. This one blocks, because
 * the application behind it no longer does anything useful.
 */
const PUBLIC_PREFIXES = ['/auth/', '/payment/'];

export default function SessionExpiryWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const [reason, setReason] = useState<SessionEndReason | null>(null);

  // The listener must not be re-registered on every navigation, and it must
  // read the current path without depending on it. Writing the ref in an
  // effect rather than during render keeps it correct under concurrent
  // rendering, where a render can be thrown away before it commits.
  const pathRef = useRef(location.pathname);
  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => onSessionEnded(({ reason: ended }) => {
    if (ended === 'signed-out') return;
    const path = pathRef.current;
    // Public pages have no session to lose. A respondent filling in a form must
    // never be interrupted by somebody else's expiry.
    if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix)) || path === '/') return;
    setReason(ended);
  }), []);

  // Clearing Redux is a side effect of acknowledging, not of the event: the
  // dialog needs the app to stay put until the person has read it.
  const signInAgain = () => {
    setReason(null);
    if (token) void dispatch(logout());
    navigate('/auth/login', { replace: true, state: { from: pathRef.current } });
  };

  if (!reason) return null;

  const { title, description } = SESSION_END_MESSAGE[reason];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-ended-title"
        aria-describedby="session-ended-description"
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[0_24px_70px_rgba(15,23,42,0.25)]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
          <Clock className="h-5 w-5" />
        </span>
        <h2 id="session-ended-title" className="mt-4 font-display text-lg font-bold text-foreground">
          {title}
        </h2>
        <p id="session-ended-description" className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Anything you had already saved is safe. Unsaved edits on this page will need to be made again.
        </p>
        <Button type="button" onClick={signInAgain} className="mt-5 w-full" autoFocus>
          <LogIn className="mr-2 h-4 w-4" />
          Sign in again
        </Button>
      </div>
    </div>
  );
}
