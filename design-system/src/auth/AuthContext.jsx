import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth as authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const user = await authApi.me();
      setMe(user);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = {
    me,
    loading,
    refresh,
    async login(identifier, password) {
      const res = await authApi.login(identifier, password);
      setMe(res.user);
      return res.user;
    },
    async register(payload) {
      const res = await authApi.register(payload);
      setMe(res.user);
      return res.user;
    },
    async logout() {
      try { await authApi.logout(); } catch {}
      setMe(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
