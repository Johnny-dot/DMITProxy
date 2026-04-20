import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  getServerStatus,
  getAuthSessionHint,
  ApiError,
  isXuiConfigured,
} from '@/src/api/client';
import type { UserAvatarStyle } from '@/src/types/userProfile';

interface AuthContextType {
  isAuthenticated: boolean;
  isChecking: boolean;
  role: 'admin' | 'user' | null;
  username: string | null;
  displayName: string | null;
  avatarStyle: UserAvatarStyle | null;
  subId: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<'admin' | 'user' | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Persists across refreshes within the same browser tab session.
// Prevents re-authentication via a lingering 3X-UI cookie after an explicit logout.
export const LOGGED_OUT_KEY = 'pd:logged_out';
const HAS_CONFIGURED_XUI = isXuiConfigured();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarStyle, setAvatarStyle] = useState<UserAvatarStyle | null>(null);
  const [subId, setSubId] = useState<string | null>(null);

  const clearAuthState = useCallback(() => {
    setIsAuthenticated(false);
    setRole(null);
    setUsername(null);
    setDisplayName(null);
    setAvatarStyle(null);
    setSubId(null);
  }, []);

  const checkAuth = useCallback(async (): Promise<'admin' | 'user' | null> => {
    // If the user explicitly logged out this session, don't re-auth via 3X-UI cookie.
    if (sessionStorage.getItem(LOGGED_OUT_KEY) === '1') {
      clearAuthState();
      return null;
    }

    let sessionHint: { hasAdminCookie: boolean; hasUserSessionCookie: boolean } | null = null;
    try {
      sessionHint = await getAuthSessionHint();
    } catch {
      sessionHint = null;
    }

    // Try local user session first, but skip the request unless the cookie
    // is actually present. The session-hint endpoint reports cookie presence
    // without dereferencing the session, so a failed hint means we keep silent
    // (avoids browser console noise from expected 401s on logged-out devices).
    if (sessionHint?.hasUserSessionCookie === true) {
      try {
        const res = await fetch('/local/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          sessionStorage.removeItem(LOGGED_OUT_KEY);
          setRole(data.role);
          setUsername(data.username);
          setDisplayName(data.displayName ?? data.username ?? null);
          setAvatarStyle(data.avatarStyle ?? null);
          setSubId(data.subId ?? null);
          setIsAuthenticated(true);
          return data.role as 'admin' | 'user';
        }
      } catch {}
    }

    if (!HAS_CONFIGURED_XUI) {
      clearAuthState();
      return null;
    }

    const shouldProbeAdminSession = sessionHint?.hasAdminCookie === true;

    if (!shouldProbeAdminSession) {
      clearAuthState();
      return null;
    }

    // Fall back to 3X-UI admin session.
    try {
      await getServerStatus();
      setRole('admin');
      setUsername(null);
      setDisplayName(null);
      setAvatarStyle(null);
      setSubId(null);
      setIsAuthenticated(true);
      return 'admin';
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 503)) {
        clearAuthState();
      }
      return null;
    }
  }, [clearAuthState]);

  useEffect(() => {
    checkAuth().finally(() => setIsChecking(false));
  }, [checkAuth]);

  const login = useCallback(
    async (u: string, p: string) => {
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
      sessionStorage.setItem(LOGGED_OUT_KEY, '1');
      clearAuthState();
    }
  }, [clearAuthState, role]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isChecking,
        role,
        username,
        displayName,
        avatarStyle,
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
