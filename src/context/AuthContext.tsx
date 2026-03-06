import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  getServerStatus,
  ApiError,
} from '@/src/api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  isChecking: boolean;
  role: 'admin' | 'user' | null;
  username: string | null;
  subId: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<'admin' | 'user' | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Persists across refreshes within the same browser tab session.
// Prevents re-authentication via a lingering 3X-UI cookie after an explicit logout.
const LOGGED_OUT_KEY = 'pd:logged_out';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);

  const checkAuth = useCallback(async (): Promise<'admin' | 'user' | null> => {
    // Try local user session first
    try {
      const res = await fetch('/local/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // Successful local session → clear any previous logout flag
        sessionStorage.removeItem(LOGGED_OUT_KEY);
        setRole(data.role);
        setUsername(data.username);
        setSubId(data.subId ?? null);
        setIsAuthenticated(true);
        return data.role as 'admin' | 'user';
      }
    } catch {}

    // If the user explicitly logged out this session, don't re-auth via 3X-UI cookie.
    // (The 3X-UI cookie may still be present in the browser even after logout.)
    if (sessionStorage.getItem(LOGGED_OUT_KEY) === '1') {
      setIsAuthenticated(false);
      setRole(null);
      setUsername(null);
      setSubId(null);
      return null;
    }

    // Fall back to 3X-UI admin session
    try {
      await getServerStatus();
      setRole('admin');
      setUsername(null);
      setSubId(null);
      setIsAuthenticated(true);
      return 'admin';
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setIsAuthenticated(false);
        setRole(null);
        setUsername(null);
        setSubId(null);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    checkAuth().finally(() => setIsChecking(false));
  }, [checkAuth]);

  const login = useCallback(
    async (u: string, p: string) => {
      // Clear the logout flag before logging in so checkAuth works normally.
      sessionStorage.removeItem(LOGGED_OUT_KEY);
      await apiLogin(u, p);
      await checkAuth();
    },
    [checkAuth],
  );

  const logout = useCallback(async () => {
    try {
      if (role === 'user') {
        await fetch('/local/auth/logout', { method: 'POST', credentials: 'include' });
      } else {
        await apiLogout();
      }
    } finally {
      // Mark as explicitly logged out.  checkAuth will return null on the next
      // refresh instead of re-authenticating via the lingering 3X-UI cookie.
      sessionStorage.setItem(LOGGED_OUT_KEY, '1');
      setIsAuthenticated(false);
      setRole(null);
      setUsername(null);
      setSubId(null);
    }
  }, [role]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isChecking,
        role,
        username,
        subId,
        login,
        logout,
        refreshAuth: checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
