import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '@credit-core/api-client';
import type { AuthUser } from '@credit-core/shared';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  setUser: (u: AuthUser) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((u) => setUser(u))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (loginName: string, password: string) => {
    const res = await api.login(loginName, password);
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const refresh = async () => {
    if (!getToken()) return;
    const u = await api.me();
    setUser(u);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, setUser, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
