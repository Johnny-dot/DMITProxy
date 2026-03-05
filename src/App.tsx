import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { InboundsPage } from './pages/Inbounds';
import { UsersCenterPage } from './pages/UsersCenter';
import { NodesPage } from './pages/Nodes';
import { TrafficPage } from './pages/Traffic';
import { SubscriptionsPage } from './pages/Subscriptions';
import { SettingsPage } from './pages/Settings';
import { LoginPage } from './pages/Login';
import { UserPortalPage } from './pages/UserPortal';
import { ProfilePage } from './pages/Profile';
import { UserRegisterPage } from './pages/user/UserRegister';
import { UserResetPasswordPage } from './pages/user/UserResetPassword';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

function ProtectedRoutes() {
  const { isAuthenticated, isChecking } = useAuth();

  if (isChecking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
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
                <Route index element={<Dashboard />} />
                <Route path="inbounds" element={<InboundsPage />} />
                <Route path="users" element={<UsersCenterPage />} />
                <Route path="nodes" element={<NodesPage />} />
                <Route path="online" element={<Navigate to="/users?tab=online" replace />} />
                <Route path="traffic" element={<TrafficPage />} />
                <Route path="subscriptions" element={<SubscriptionsPage />} />
                <Route
                  path="user-accounts"
                  element={<Navigate to="/users?tab=accounts" replace />}
                />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ToastProvider>
  );
}
