import { afterEach, describe, expect, it, vi } from 'vitest';
import { getClientDownloadLinks } from './clientDownloads';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getClientDownloadLinks', () => {
  it('uses platform-specific overrides for multi-platform clients', () => {
    vi.stubEnv(
      'VITE_CLIENT_DOWNLOAD_VPS_FLCLASH_WINDOWS_URL',
      'https://mirror.example.test/flclash/windows.exe',
    );
    vi.stubEnv(
      'VITE_CLIENT_DOWNLOAD_VPS_FLCLASH_ANDROID_URL',
      'https://mirror.example.test/flclash/android.apk',
    );

    expect(getClientDownloadLinks('flClash', 'windows')).toMatchObject({
      vps: 'https://mirror.example.test/flclash/windows.exe',
      vpsManaged: false,
    });
    expect(getClientDownloadLinks('flClash', 'android')).toMatchObject({
      vps: 'https://mirror.example.test/flclash/android.apk',
      vpsManaged: false,
    });
  });

  it('does not reuse deprecated client-wide overrides for multi-platform clients', () => {
    vi.stubEnv(
      'VITE_CLIENT_DOWNLOAD_VPS_FLCLASH_URL',
      'https://mirror.example.test/flclash/shared-installer.exe',
    );

    expect(getClientDownloadLinks('flClash', 'windows')).toMatchObject({
      vps: '',
      vpsManaged: false,
    });
    expect(getClientDownloadLinks('flClash', 'android')).toMatchObject({
      vps: '',
      vpsManaged: false,
    });
  });

  it('keeps client-wide overrides for single-platform clients', () => {
    vi.stubEnv(
      'VITE_CLIENT_DOWNLOAD_VPS_CLASH_META_URL',
      'https://mirror.example.test/clash-meta/universal.apk',
    );

    expect(getClientDownloadLinks('clashMeta', 'android')).toMatchObject({
      vps: 'https://mirror.example.test/clash-meta/universal.apk',
      vpsManaged: false,
    });
  });
});
