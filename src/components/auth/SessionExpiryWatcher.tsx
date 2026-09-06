import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { logout } from '../../store/authSlice';
import { onSessionEnded, SESSION_END_MESSAGE } from '../../lib/session';
import { isApplicationPath, isAuthPath } from '../../lib/appRoutes';
import { toast } from '../ui/toast';

/**
 * Tells people when their session has ended, instead of silently dropping them
 * on the sign-in screen.
 *
 * A silent redirect is the single most alarming thing this application can do:
 * work disappears, the reason is invisible, and the natural conclusion is that
 * the product lost it. This restores the missing sentence.
 *
 * It says it with the same toast every other message in the product uses. The
 * earlier version put up its own full-screen dialog, which was both heavier
 * than the message warranted and visibly not part of the product — a one-off
 * card with one-off colours in an application that already has a house style
 * for "here is something you need to know". The reassurance that made that
 * dialog worth reading has moved into the message itself, so nothing was lost
 * by dropping the box around it.
 *
 * The redirect is immediate rather than gated behind a button. The application
 * behind the notice no longer works, so leaving someone parked on it only
 * invites clicks that fail; the toast outlives the navigation because the
 * provider sits above the router, so the sign-in screen arrives with its
 * explanation already attached.
 */
export default function SessionExpiryWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);

  // The listener must not be re-registered on every navigation, and it must
  // read the current path and token without depending on them. Writing the
  // refs in an effect rather than during render keeps them correct under
  // concurrent rendering, where a render can be thrown away before it commits.
  const pathRef = useRef(location.pathname);
  const tokenRef = useRef(token);
  useEffect(() => {
    pathRef.current = location.pathname;
    tokenRef.current = token;
  }, [location.pathname, token]);

  useEffect(() => onSessionEnded(({ reason }) => {
    if (reason === 'signed-out') return;
    const path = pathRef.current;
    // Only the signed-in application can lose a session. A respondent filling
    // in a published form is on a path made of two pieces of user-supplied
    // text, so the test has to be "is this one of ours" rather than a list of
    // public prefixes that could never name every form a customer publishes.
    // The sign-in screen is excluded too: it says so itself, on load.
    if (!isApplicationPath(path) || isAuthPath(path)) return;

    const { title, description } = SESSION_END_MESSAGE[reason];
    // Longer than a routine confirmation. This one has to be read, and it may
    // land while the person is looking somewhere other than the screen.
    toast.warning({ title, description, duration: 9000 });

    if (tokenRef.current) void dispatch(logout());
    navigate('/auth/login', { replace: true, state: { from: path } });
  }), [dispatch, navigate]);

  return null;
}
