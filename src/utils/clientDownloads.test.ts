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
      vps: '/local/downloads/flClash?platform=windows',
      vpsManaged: true,
    });
    expect(getClientDownloadLinks('flClash', 'android')).toMatchObject({
      vps: '/local/downloads/flClash?platform=android',
      vpsManaged: true,
    });
  });

  it('falls back to managed mirrors for supported desktop clients', () => {
    expect(getClientDownloadLinks('v2rayN', 'windows')).toMatchObject({
      vps: '/local/downloads/v2rayN?platform=windows',
      vpsManaged: true,
    });
    expect(getClientDownloadLinks('v2rayN', 'linux')).toMatchObject({
      vps: '/local/downloads/v2rayN?platform=linux',
      vpsManaged: true,
    });
    expect(getClientDownloadLinks('clashVerge', 'windows')).toMatchObject({
      vps: '/local/downloads/clashVerge?platform=windows',
      vpsManaged: true,
    });
    expect(getClientDownloadLinks('clashVerge', 'macos')).toMatchObject({
      vps: '/local/downloads/clashVerge?platform=macos',
      vpsManaged: true,
    });
    expect(getClientDownloadLinks('flClash', 'linux')).toMatchObject({
      vps: '/local/downloads/flClash?platform=linux',
      vpsManaged: true,
    });
    expect(getClientDownloadLinks('sparkle', 'windows')).toMatchObject({
      vps: '/local/downloads/sparkle?platform=windows',
      vpsManaged: true,
    });
    expect(getClientDownloadLinks('sparkle', 'macos')).toMatchObject({
      vps: '/local/downloads/sparkle?platform=macos',
      vpsManaged: true,
    });
    expect(getClientDownloadLinks('sparkle', 'linux')).toMatchObject({
      vps: '/local/downloads/sparkle?platform=linux',
      vpsManaged: true,
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
