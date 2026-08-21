import React, { createContext, useContext, useEffect, useState } from 'react';
import { login as apiLogin, register as apiRegister, getMe as apiGetMe, UserRole } from '../api/auth';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';
import { getStoredToken, setStoredToken, deleteStoredToken } from '../utils/tokenStorage';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getStoredToken();
        if (stored) {
          setAuthToken(stored);
          setToken(stored);
          try {
            const me = await apiGetMe();
            setUser(me);
          } catch {
            // getMe() can fail for reasons other than an expired/invalid token
            // (network unreachable, timeout, 500, ...) — the 401 interceptor's
            // unauthorizedHandler only fires on an actual 401 response, so it
            // won't rescue us here. Clear the restored session locally so the
            // app falls through to the Login screen instead of getting stuck
            // on the (token && !user) loading guard in AppNavigator forever.
            await deleteStoredToken();
            setAuthToken(null);
            setToken(null);
          }
        }
      } catch (err) {
        // A broken/unavailable storage backend must never leave the app stuck
        // on AppNavigator's loading spinner — fall through to the Login screen.
        console.warn('[auth] could not restore the stored session', err);
        setAuthToken(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await apiLogin(email, password);
    await setStoredToken(res.token);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function register(email: string, password: string, name: string, role: UserRole = 'patient') {
    const res = await apiRegister(email, password, name, role);
    await setStoredToken(res.token);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function logout() {
    await deleteStoredToken();
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
