import { resolveApiBaseUrl } from '../src/api/client';

describe('resolveApiBaseUrl', () => {
  it('falls back to the LAN dev address when no env value is set', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('http://192.168.1.125:3000');
  });

  it('uses the provided env value when set', () => {
    expect(resolveApiBaseUrl('https://api.example.com')).toBe('https://api.example.com');
  });

  it('falls back when the env value is an empty string', () => {
    expect(resolveApiBaseUrl('')).toBe('http://192.168.1.125:3000');
  });
});
