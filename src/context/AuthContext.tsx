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
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Verify session on mount by pinging a protected endpoint
  useEffect(() => {
    getServerStatus()
      .then(() => setIsAuthenticated(true))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setIsAuthenticated(false);
        }
      })
      .finally(() => setIsChecking(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    await apiLogin(username, password);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setIsAuthenticated(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isChecking, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
