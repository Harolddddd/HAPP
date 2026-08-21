import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const TOKEN_KEY = 'happ_token';

export type StorageBackend = 'web' | 'native';

/**
 * Pure decision: which storage backend a given platform must use.
 *
 * `expo-secure-store` ships an empty stub on web (every `*ItemAsync` call
 * throws), so the browser build — including the public PWA — has to fall back
 * to `localStorage`. Native platforms keep using the OS keychain/keystore.
 *
 * Storing the JWT in `localStorage` puts it within reach of XSS; that is an
 * accepted v1 trade-off for the web build.
 */
export function resolveStorageBackend(platformOS: string): StorageBackend {
  return platformOS === 'web' ? 'web' : 'native';
}

export interface TokenStorage {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  deleteToken(): Promise<void>;
}

/** The slice of the DOM Storage API this module needs. */
export interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Web backend. `storage` is undefined in JS environments without a DOM
 * (SSR/prerender, node test runners); there the token simply isn't persisted,
 * which degrades to a session that ends on reload rather than a thrown error.
 */
export function createWebTokenStorage(storage: WebStorageLike | undefined): TokenStorage {
  return {
    async getToken() {
      return storage ? storage.getItem(TOKEN_KEY) : null;
    },
    async setToken(token: string) {
      storage?.setItem(TOKEN_KEY, token);
    },
    async deleteToken() {
      storage?.removeItem(TOKEN_KEY);
    },
  };
}

/** Native backend, backed by the OS secure store. */
export function createSecureTokenStorage(): TokenStorage {
  return {
    getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
    setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
    deleteToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),
  };
}

function activeStorage(): TokenStorage {
  if (resolveStorageBackend(Platform.OS) === 'web') {
    return createWebTokenStorage(typeof localStorage !== 'undefined' ? localStorage : undefined);
  }
  return createSecureTokenStorage();
}

export function getStoredToken(): Promise<string | null> {
  return activeStorage().getToken();
}

export function setStoredToken(token: string): Promise<void> {
  return activeStorage().setToken(token);
}

export function deleteStoredToken(): Promise<void> {
  return activeStorage().deleteToken();
}
