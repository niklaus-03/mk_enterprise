import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { authApi } from '../utils/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // full user object from /me
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

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

  // Connect socket when user is logged in
  useEffect(() => {
    if (user) {
      const newSocket = io(window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin, {
        withCredentials: true,
      });
      newSocket.on('connect', () => {
        newSocket.emit('join', user);
      });
      newSocket.on('force_logout', () => {
        // If server says force logout, we log them out and redirect to login
        toast.error('Your session was terminated by an administrator.', { duration: 5000 });
        logout();
      });
      newSocket.on('force_hold', () => {
        setUser(u => u ? { ...u, is_on_hold: true } : null);
        toast.error('Your account has been put on hold by an administrator.', { duration: 5000 });
      });
      newSocket.on('lift_hold', () => {
        setUser(u => u ? { ...u, is_on_hold: false } : null);
        toast.success('Your account hold has been lifted.', { duration: 5000 });
      });
      setSocket(newSocket);
      return () => {
        newSocket.disconnect();
      };
    } else if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  }, [user]);

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

  const logout = async () => {
    try { await authApi.logout(); } catch (e) { console.error('Logout error', e); }
    localStorage.removeItem('shopbill_token');
    // Clear auto drafts on logout so they don't persist across sessions
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('invoice_auto_draft_')) {
        localStorage.removeItem(key);
      }
    }
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
      socket,
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
