import { describeAuthError } from '../src/utils/authErrors';

describe('describeAuthError', () => {
  it('maps a known server error to a Chinese message', () => {
    const err = { response: { data: { error: 'Email already registered' } } };
    expect(describeAuthError(err, 'fallback')).toBe('该邮箱或手机号已被注册');
  });

  it('maps a password-length server error', () => {
    const err = { response: { data: { error: 'password must be 4-15 characters' } } };
    expect(describeAuthError(err, 'fallback')).toBe('密码长度需为4-15位');
  });

  it('falls back for an unrecognized server error', () => {
    const err = { response: { data: { error: 'something unexpected' } } };
    expect(describeAuthError(err, 'fallback')).toBe('fallback');
  });

  it('falls back for a network error with no response', () => {
    expect(describeAuthError(new Error('Network Error'), 'fallback')).toBe('fallback');
  });

  it('falls back for a non-error value', () => {
    expect(describeAuthError(null, 'fallback')).toBe('fallback');
  });
});
