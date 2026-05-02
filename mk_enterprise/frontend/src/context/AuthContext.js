import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../utils/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // full user object from /me
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('shopbill_token');
    if (!token) { setLoading(false); return; }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      localStorage.removeItem('shopbill_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (username, password, secret_key) => {
    const res = await authApi.login({ username, password, secret_key });
    localStorage.setItem('shopbill_token', res.token);
    // Fetch full user object
    const me = await authApi.me();
    setUser(me);
    return res;
  };

  const logout = () => {
    localStorage.removeItem('shopbill_token');
    setUser(null);
    window.location.href = '/login';
  };

  // Derived helpers
  const isAdmin = user?.role === 'supervisor';
  const isManager = user?.role === 'manager';
  const isDriver = user?.role === 'driver';

  // Backward compat: components that used `admin` get `user` instead
  return (
    <AuthContext.Provider value={{
      user,
      admin: user,        // backward compat alias
      loading,
      login,
      logout,
      isAuthenticated: !!user,
      isAdmin,
      isManager,
      isDriver,
      role: user?.role || null,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
