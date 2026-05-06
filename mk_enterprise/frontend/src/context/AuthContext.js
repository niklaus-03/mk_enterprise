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

  // Step 1: Validate credentials. Returns { requires_secret, username } for supervisors,
  // or completes login for managers/drivers.
  const login = async (username, password) => {
    const res = await authApi.login({ username, password });
    // If supervisor, backend returns requires_secret flag — don't set token yet
    if (res.requires_secret) {
      return res; // caller (Login.js) will show secret key step
    }
    // Non-supervisor: token received, complete login
    localStorage.setItem('shopbill_token', res.token);
    const me = await authApi.me();
    setUser(me);
    return res;
  };

  // Step 2: Supervisor secret key verification
  const verifySecret = async (username, secret_key) => {
    const res = await authApi.verifySecret({ username, secret_key });
    localStorage.setItem('shopbill_token', res.token);
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
      verifySecret,
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
