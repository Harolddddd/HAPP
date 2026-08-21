import {
  createWebTokenStorage,
  resolveStorageBackend,
  TOKEN_KEY,
  WebStorageLike,
} from '../src/utils/tokenStorage';

function fakeWebStorage(): WebStorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('resolveStorageBackend', () => {
  it('uses localStorage on web, where expo-secure-store is only an empty stub', () => {
    expect(resolveStorageBackend('web')).toBe('web');
  });

  it('uses the OS secure store on the native platforms', () => {
    expect(resolveStorageBackend('ios')).toBe('native');
    expect(resolveStorageBackend('android')).toBe('native');
  });

  it('defaults unknown platforms to the native secure store', () => {
    expect(resolveStorageBackend('macos')).toBe('native');
  });
});

describe('createWebTokenStorage', () => {
  it('round-trips a token through the underlying storage', async () => {
    const storage = fakeWebStorage();
    const tokenStorage = createWebTokenStorage(storage);

    expect(await tokenStorage.getToken()).toBeNull();

    await tokenStorage.setToken('jwt-abc');
    expect(storage.data[TOKEN_KEY]).toBe('jwt-abc');
    expect(await tokenStorage.getToken()).toBe('jwt-abc');

    await tokenStorage.deleteToken();
    expect(await tokenStorage.getToken()).toBeNull();
  });

  it('degrades quietly when no DOM storage exists instead of throwing', async () => {
    const tokenStorage = createWebTokenStorage(undefined);

    await expect(tokenStorage.getToken()).resolves.toBeNull();
    await expect(tokenStorage.setToken('jwt-abc')).resolves.toBeUndefined();
    await expect(tokenStorage.deleteToken()).resolves.toBeUndefined();
  });
});
