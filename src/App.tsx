import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './hooks/useAppDispatch';
import { useEffect, useState } from 'react';
import { fetchOrganizations } from './store/orgSlice';
import { getSession, logout, restoreSession } from './store/authSlice';
import { Loader2 } from 'lucide-react';
import { isCancelledPayload } from './lib/apiError';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import OrgSetupPage from './pages/OrgSetupPage';
import DashboardPage from './pages/DashboardPage';
import FormsListPage from './pages/FormsListPage';
import FormBuilderPage from './pages/FormBuilderPage';
import SubmissionsPage from './pages/SubmissionsPage';
import PublicFormPage from './pages/PublicFormPage';
import PaymentStatusPage from './pages/PaymentStatusPage';
import OrgSettingsPage from './pages/OrgSettingsPage';
import ProfilePage from './pages/ProfilePage';
import MembersPage from './pages/MembersPage';
import TeamsPage from './pages/TeamsPage';
import RolesPage from './pages/RolesPage';
import RequirePermission from './components/layout/RequirePermission';
import UpdateProfilePage from './pages/UpdateProfilePage';
import { ToastProvider } from './components/ui/toast';

/**
 * The access token lives in memory, so a reload starts with no session at all.
 * Exchange the refresh cookie once, up front. Public pages render immediately;
 * only the guarded routes wait for the result, otherwise a reload would bounce
 * a signed-in user to the login screen.
 */
function SessionBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  return <>{children}</>;
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// Token only � used for /org/setup
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, bootstrapped } = useAppSelector((state) => state.auth);
  if (!bootstrapped) return <FullPageSpinner />;
  if (!token) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}
// Token + org � used for all pages that need an org
function OrgRoute({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { token, user, bootstrapped } = useAppSelector((state) => state.auth);
  const { currentOrg, isLoading } = useAppSelector((state) => state.org);
  const [hasFetched, setHasFetched] = useState(false);
  const [sessionFailed, setSessionFailed] = useState(false);

  useEffect(() => {
    if (token && !user) {
      dispatch(getSession())
        .unwrap()
        // A cancelled request is not a failed session — treating it as one
        // would sign the user out for switching organizations too quickly.
        .catch((reason) => {
          if (!isCancelledPayload(reason)) setSessionFailed(true);
        });
    }
  }, [token, user, dispatch]);

  // A session that cannot be resolved — most notably an account that exists in
  // Keycloak but not in this system ("User not found") — must not be funnelled
  // into the create-workspace screen. Sign the person out so they land on
  // login instead of a misleading onboarding flow.
  useEffect(() => {
    if (sessionFailed && token) dispatch(logout());
  }, [sessionFailed, token, dispatch]);

  useEffect(() => {
    if (!token || sessionFailed) return;
    if (currentOrg) { setHasFetched(true); return; }
    // Fetch the list, but do not choose. Landing someone in whichever
    // organization happens to sort first is how people end up creating forms
    // in the wrong place. With none selected we fall through to the chooser.
    const fetchData = async () => {
      try {
        await dispatch(fetchOrganizations());
      } finally {
        setHasFetched(true);
      }
    };
    fetchData();
    // `currentOrg` belongs here: without it a switch that lands on this route
    // never re-evaluates, and `hasFetched` can stay false while the page shows
    // nothing but a spinner.
  }, [token, sessionFailed, currentOrg, dispatch]);

  if (!bootstrapped) return <FullPageSpinner />;
  if (!token) return <Navigate to="/auth/login" replace />;
  if (sessionFailed) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!hasFetched || isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!currentOrg) return <Navigate to="/org/setup" replace />;
  return <>{children}</>;
}
function App() {
  return (
    <Provider store={store}>
      <ToastProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <SessionBootstrap>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/signup" element={<SignupPage />} />

          {/* Protected routes � token only */}
          <Route path="/org/setup" element={<ProtectedRoute><OrgSetupPage /></ProtectedRoute>} />

          {/* Org routes � token + org required */}
          <Route path="/dashboard" element={<OrgRoute><DashboardPage /></OrgRoute>} />
          <Route path="/forms" element={<OrgRoute><FormsListPage /></OrgRoute>} />
          <Route path="/forms/:formId/edit" element={<OrgRoute><FormBuilderPage /></OrgRoute>} />
          <Route path="/forms/:formId/submissions" element={<OrgRoute><SubmissionsPage /></OrgRoute>} />
          <Route path="/members" element={<OrgRoute><RequirePermission action="VIEW_MEMBERS" label="Members"><MembersPage /></RequirePermission></OrgRoute>} />
          <Route path="/teams" element={<OrgRoute><RequirePermission action="VIEW_TEAM" label="Teams"><TeamsPage /></RequirePermission></OrgRoute>} />
          <Route path="/roles" element={<OrgRoute><RequirePermission action="VIEW_MEMBERS" label="Roles"><RolesPage /></RequirePermission></OrgRoute>} />
          {/* Organization settings: gated. Account settings: never gated,
              they belong to the person, not the organization. */}
          <Route path="/settings" element={<OrgRoute><RequirePermission action="MANAGE_ORG" label="Organization settings"><OrgSettingsPage /></RequirePermission></OrgRoute>} />
          <Route path="/account" element={<OrgRoute><ProfilePage /></OrgRoute>} />
          <Route path="/account/edit" element={<OrgRoute><UpdateProfilePage /></OrgRoute>} />
          {/* Old link, kept so bookmarks still land somewhere sensible. */}
          <Route path="/settings/profile" element={<Navigate to="/account" replace />} />

          {/* Payment status page */}
          <Route path="/payment/:formId/status" element={<PaymentStatusPage />} />

          {/* Public form submission */}
          <Route path="/:orgSlug/:formSlug" element={<PublicFormPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </SessionBootstrap>
      </BrowserRouter>
      </ToastProvider>
    </Provider>
  );
}

export default App;
