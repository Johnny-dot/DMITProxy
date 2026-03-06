import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

const Layout = lazy(() =>
  import('./components/layout/Layout').then((m) => ({ default: m.Layout })),
);
const InboundsPage = lazy(() =>
  import('./pages/Inbounds').then((m) => ({ default: m.InboundsPage })),
);
const NodesPage = lazy(() => import('./pages/Nodes').then((m) => ({ default: m.NodesPage })));
const TrafficPage = lazy(() => import('./pages/Traffic').then((m) => ({ default: m.TrafficPage })));
const SubscriptionsPage = lazy(() =>
  import('./pages/Subscriptions').then((m) => ({ default: m.SubscriptionsPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/Settings').then((m) => ({ default: m.SettingsPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })),
);
const UsersCenterPage = lazy(() =>
  import('./pages/UsersCenter').then((m) => ({ default: m.UsersCenterPage })),
);
const LoginPage = lazy(() => import('./pages/Login').then((m) => ({ default: m.LoginPage })));
const MySubscriptionPage = lazy(() =>
  import('./pages/MySubscription').then((m) => ({ default: m.MySubscriptionPage })),
);
const ProfilePage = lazy(() => import('./pages/Profile').then((m) => ({ default: m.ProfilePage })));
const UserRegisterPage = lazy(() =>
  import('./pages/user/UserRegister').then((m) => ({ default: m.UserRegisterPage })),
);
const UserResetPasswordPage = lazy(() =>
  import('./pages/user/UserResetPassword').then((m) => ({ default: m.UserResetPasswordPage })),
);

function RouteLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );
}

const ADMIN_ONLY_PATHS = ['/inbounds', '/users', '/nodes', '/traffic', '/subscriptions'];

function ProtectedRoutes() {
  const { isAuthenticated, isChecking, role } = useAuth();
  const location = useLocation();

  if (isChecking) {
    return <RouteLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect regular users away from admin-only routes
  if (role === 'user') {
    const isAdminPath = ADMIN_ONLY_PATHS.some((p) => location.pathname.startsWith(p));
    if (isAdminPath || location.pathname === '/') {
      return <Navigate to="/my-subscription" replace />;
    }
  }

  return <Layout />;
}

export default function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/user/login" element={<Navigate to="/login" replace />} />
                <Route path="/register" element={<UserRegisterPage />} />
                <Route path="/reset-password" element={<UserResetPasswordPage />} />
                {/* Legacy portal redirect */}
                <Route path="/portal" element={<Navigate to="/my-subscription" replace />} />
                {/* Main layout (admin + user) */}
                <Route path="/" element={<ProtectedRoutes />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="inbounds" element={<InboundsPage />} />
                  <Route path="users" element={<UsersCenterPage />} />
                  <Route path="nodes" element={<NodesPage />} />
                  <Route path="traffic" element={<TrafficPage />} />
                  <Route path="subscriptions" element={<SubscriptionsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="my-subscription" element={<MySubscriptionPage />} />
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ToastProvider>
  );
}
