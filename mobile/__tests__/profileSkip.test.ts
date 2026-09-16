import { createWebSkipFlagStorage, PROFILE_SKIP_KEY } from '../src/utils/profileSkip';
import type { WebStorageLike } from '../src/utils/tokenStorage';

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

describe('createWebSkipFlagStorage', () => {
  it('defaults to not skipped', async () => {
    const storage = createWebSkipFlagStorage(fakeWebStorage());
    expect(await storage.getSkipped()).toBe(false);
  });

  it('remembers the skip choice', async () => {
    const backing = fakeWebStorage();
    const storage = createWebSkipFlagStorage(backing);

    await storage.setSkipped();

    expect(backing.data[PROFILE_SKIP_KEY]).toBe('1');
    expect(await storage.getSkipped()).toBe(true);
  });

  it('degrades quietly when no DOM storage exists', async () => {
    const storage = createWebSkipFlagStorage(undefined);
    await expect(storage.getSkipped()).resolves.toBe(false);
    await expect(storage.setSkipped()).resolves.toBeUndefined();
  });
});
