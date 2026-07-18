import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { login as apiLogin, register as apiRegister, getMe as apiGetMe, UserRole } from '../api/auth';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';

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

const TOKEN_KEY = 'happ_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY).then(async (stored) => {
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
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          setAuthToken(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    const res = await apiLogin(email, password);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function register(email: string, password: string, name: string, role: UserRole = 'patient') {
    const res = await apiRegister(email, password, name, role);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
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
