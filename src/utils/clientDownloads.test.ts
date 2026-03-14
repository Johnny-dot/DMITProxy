import { afterEach, describe, expect, it, vi } from 'vitest';
import { getClientDownloadLinks } from './clientDownloads';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getClientDownloadLinks', () => {
  it('uses platform-specific overrides for multi-platform clients', () => {
    vi.stubEnv(
      'VITE_CLIENT_DOWNLOAD_VPS_FLCLASH_URL',
      'https://mirror.example.test/flclash/legacy-shared-installer.exe',
    );
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

  it('falls back to legacy shared overrides for multi-platform clients', () => {
    vi.stubEnv(
      'VITE_CLIENT_DOWNLOAD_VPS_FLCLASH_URL',
      'https://mirror.example.test/flclash/shared-installer.exe',
    );

    expect(getClientDownloadLinks('flClash', 'windows')).toMatchObject({
      vps: 'https://mirror.example.test/flclash/shared-installer.exe',
      vpsManaged: false,
    });
    expect(getClientDownloadLinks('flClash', 'android')).toMatchObject({
      vps: 'https://mirror.example.test/flclash/shared-installer.exe',
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

  it('keeps legacy base-url filenames for older hosted mirrors', () => {
    vi.stubEnv('VITE_CLIENT_DOWNLOAD_VPS_BASE_URL', 'https://mirror.example.test/downloads');

    expect(getClientDownloadLinks('v2rayN', 'windows')).toMatchObject({
      vps: 'https://mirror.example.test/downloads/v2rayN-windows-64.zip',
      vpsManaged: false,
    });
    expect(getClientDownloadLinks('clashVerge', 'macos')).toMatchObject({
      vps: 'https://mirror.example.test/downloads/clash-verge-x64.dmg',
      vpsManaged: false,
    });
  });
});
