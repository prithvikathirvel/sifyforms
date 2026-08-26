import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './hooks/useAppDispatch';
import { useEffect, useState } from 'react';
import { fetchOrganizations } from './store/orgSlice';
import { getSession } from './store/authSlice';
import { Loader2 } from 'lucide-react';
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

// Token only — used for /org/setup
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAppSelector((state) => state.auth);
  if (!token) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

// Token + org — used for all pages that need an org
function OrgRoute({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);
  const { currentOrg, isLoading } = useAppSelector((state) => state.org);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (token && !user) dispatch(getSession());
  }, [token]);

  useEffect(() => {
    if (!token) return;
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
  }, [token]);

  if (!token) return <Navigate to="/auth/login" replace />;
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
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/signup" element={<SignupPage />} />

          {/* Protected routes — token only */}
          <Route path="/org/setup" element={<ProtectedRoute><OrgSetupPage /></ProtectedRoute>} />

          {/* Org routes — token + org required */}
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
      </BrowserRouter>
    </Provider>
  );
}

export default App;
