import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldSkipXuiTlsVerification } from './xui.js';

describe('shouldSkipXuiTlsVerification', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('honors explicit XUI_TLS_INSECURE_SKIP_VERIFY=true in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('XUI_TLS_INSECURE_SKIP_VERIFY', 'true');

    expect(shouldSkipXuiTlsVerification()).toBe(true);
  });

  it('defaults to false when unset', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(shouldSkipXuiTlsVerification()).toBe(false);
  });
});
