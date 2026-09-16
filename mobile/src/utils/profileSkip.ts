import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { resolveStorageBackend, WebStorageLike } from './tokenStorage';

export const PROFILE_SKIP_KEY = 'happ_profile_setup_skipped';

export interface SkipFlagStorage {
  getSkipped(): Promise<boolean>;
  setSkipped(): Promise<void>;
}

export function createWebSkipFlagStorage(storage: WebStorageLike | undefined): SkipFlagStorage {
  return {
    async getSkipped() {
      return storage ? storage.getItem(PROFILE_SKIP_KEY) === '1' : false;
    },
    async setSkipped() {
      storage?.setItem(PROFILE_SKIP_KEY, '1');
    },
  };
}

export function createSecureSkipFlagStorage(): SkipFlagStorage {
  return {
    getSkipped: async () => (await SecureStore.getItemAsync(PROFILE_SKIP_KEY)) === '1',
    setSkipped: () => SecureStore.setItemAsync(PROFILE_SKIP_KEY, '1'),
  };
}

function activeStorage(): SkipFlagStorage {
  if (resolveStorageBackend(Platform.OS) === 'web') {
    return createWebSkipFlagStorage(typeof localStorage !== 'undefined' ? localStorage : undefined);
  }
  return createSecureSkipFlagStorage();
}

export function getProfileSetupSkipped(): Promise<boolean> {
  return activeStorage().getSkipped();
}

export function setProfileSetupSkipped(): Promise<void> {
  return activeStorage().setSkipped();
}
