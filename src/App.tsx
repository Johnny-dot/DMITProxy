import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
const LoginPage = lazy(() => import('./pages/Login').then((m) => ({ default: m.LoginPage })));
const UserPortalPage = lazy(() =>
  import('./pages/UserPortal').then((m) => ({ default: m.UserPortalPage })),
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

function ProtectedRoutes() {
  const { isAuthenticated, isChecking } = useAuth();

  if (isChecking) {
    return <RouteLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
                {/* Admin auth */}
                <Route path="/login" element={<LoginPage />} />
                {/* User auth & portal */}
                <Route path="/user/login" element={<Navigate to="/login" replace />} />
                <Route path="/register" element={<UserRegisterPage />} />
                <Route path="/reset-password" element={<UserResetPasswordPage />} />
                <Route path="/portal" element={<UserPortalPage />} />
                {/* Admin panel */}
                <Route path="/" element={<ProtectedRoutes />}>
                  <Route index element={<Navigate to="/portal?section=management" replace />} />
                  <Route path="inbounds" element={<InboundsPage />} />
                  <Route
                    path="users"
                    element={<Navigate to="/portal?section=management" replace />}
                  />
                  <Route path="nodes" element={<NodesPage />} />
                  <Route
                    path="online"
                    element={<Navigate to="/portal?section=management&tab=online" replace />}
                  />
                  <Route path="traffic" element={<TrafficPage />} />
                  <Route path="subscriptions" element={<SubscriptionsPage />} />
                  <Route
                    path="user-accounts"
                    element={<Navigate to="/portal?section=management&tab=accounts" replace />}
                  />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ToastProvider>
  );
}
