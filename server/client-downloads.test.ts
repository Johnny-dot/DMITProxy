import { describe, expect, it } from 'vitest';
import {
  selectGitHubReleaseAsset,
  supportsManagedClientMirror,
  type ClientDownloadId,
  type ClientDownloadPlatform,
  type GitHubReleasePayload,
} from './client-downloads.js';

describe('client download mirror selection', () => {
  const release: GitHubReleasePayload = {
    tag_name: 'v-test',
    assets: [
      {
        name: 'v2rayN-windows-64-desktop.zip',
        browser_download_url: 'https://example.test/v2rayN-desktop.zip',
      },
      {
        name: 'v2rayN-windows-64.zip',
        browser_download_url: 'https://example.test/v2rayN.zip',
      },
      {
        name: 'v2rayN-linux-64.zip',
        browser_download_url: 'https://example.test/v2rayN-linux.zip',
      },
      {
        name: 'v2rayNG_2.0.13_universal.apk',
        browser_download_url: 'https://example.test/v2rayNG.apk',
      },
      {
        name: 'FlClash-0.8.92-windows-amd64-setup.exe',
        browser_download_url: 'https://example.test/flclash-windows.exe',
      },
      {
        name: 'FlClash-0.8.92-windows-amd64-setup.exe.sha256',
        browser_download_url: 'https://example.test/flclash-windows.exe.sha256',
      },
      {
        name: 'FlClash-0.8.92-macos-amd64.dmg',
        browser_download_url: 'https://example.test/flclash-macos.dmg',
      },
      {
        name: 'FlClash-0.8.92-linux-amd64.AppImage',
        browser_download_url: 'https://example.test/flclash-linux.AppImage',
      },
      {
        name: 'FlClash-0.8.92-android-arm64-v8a.apk',
        browser_download_url: 'https://example.test/flclash-android.apk',
      },
      {
        name: 'Clash.Verge_2.4.6_x64-setup.exe',
        browser_download_url: 'https://example.test/clash-verge.exe',
      },
      {
        name: 'Clash.Verge_2.4.6_x64.dmg',
        browser_download_url: 'https://example.test/clash-verge.dmg',
      },
      {
        name: 'Clash.Verge_x64.app.tar.gz',
        browser_download_url: 'https://example.test/clash-verge-linux.tar.gz',
      },
      {
        name: 'sparkle-windows-1.26.2-x64-setup.exe',
        browser_download_url: 'https://example.test/sparkle-windows.exe',
      },
      {
        name: 'sparkle-macos-1.26.2-x64.pkg',
        browser_download_url: 'https://example.test/sparkle-macos.pkg',
      },
      {
        name: 'sparkle-linux-1.26.2-amd64.deb',
        browser_download_url: 'https://example.test/sparkle-linux.deb',
      },
      {
        name: 'cmfa-2.11.24-meta-universal-release.apk',
        browser_download_url: 'https://example.test/clash-meta.apk',
      },
      {
        name: 'ClashNEXT-LTS-1.5.1.hap',
        browser_download_url: 'https://example.test/clashbox.hap',
      },
      {
        name: 'SFA-1.13.2-universal.apk',
        browser_download_url: 'https://example.test/singbox-android.apk',
      },
      {
        name: 'SFM-1.13.2-Universal.pkg',
        browser_download_url: 'https://example.test/singbox-macos.pkg',
      },
    ],
  };

  it('marks only supported client/platform pairs as mirrorable', () => {
    expect(supportsManagedClientMirror('v2rayN', 'windows')).toBe(true);
    expect(supportsManagedClientMirror('v2rayN', 'linux')).toBe(true);
    expect(supportsManagedClientMirror('flClash', 'windows')).toBe(true);
    expect(supportsManagedClientMirror('flClash', 'android')).toBe(true);
    expect(supportsManagedClientMirror('clashMeta', 'android')).toBe(true);
    expect(supportsManagedClientMirror('clashBox', 'harmonyos')).toBe(true);
    expect(supportsManagedClientMirror('sparkle', 'windows')).toBe(true);
    expect(supportsManagedClientMirror('sparkle', 'macos')).toBe(true);
    expect(supportsManagedClientMirror('sparkle', 'linux')).toBe(true);
    expect(supportsManagedClientMirror('clashVerge', 'windows')).toBe(true);
    expect(supportsManagedClientMirror('clashVerge', 'macos')).toBe(true);
    expect(supportsManagedClientMirror('clashVerge', 'linux')).toBe(true);
    expect(supportsManagedClientMirror('singBox', 'linux')).toBe(false);
    expect(supportsManagedClientMirror('singBox', 'macos')).toBe(true);
    expect(supportsManagedClientMirror('exclave', 'android')).toBe(false);
    expect(supportsManagedClientMirror('surge', 'ios')).toBe(false);
    expect(supportsManagedClientMirror('shadowrocket', 'ios')).toBe(false);
  });

  it('selects the expected latest release asset for each supported platform', () => {
    const cases: Array<{
      clientId: ClientDownloadId;
      platform: ClientDownloadPlatform;
      expected: string;
    }> = [
      { clientId: 'v2rayN', platform: 'windows', expected: 'v2rayN-windows-64-desktop.zip' },
      { clientId: 'v2rayN', platform: 'linux', expected: 'v2rayN-linux-64.zip' },
      { clientId: 'v2rayNG', platform: 'android', expected: 'v2rayNG_2.0.13_universal.apk' },
      {
        clientId: 'flClash',
        platform: 'windows',
        expected: 'FlClash-0.8.92-windows-amd64-setup.exe',
      },
      {
        clientId: 'flClash',
        platform: 'macos',
        expected: 'FlClash-0.8.92-macos-amd64.dmg',
      },
      {
        clientId: 'flClash',
        platform: 'linux',
        expected: 'FlClash-0.8.92-linux-amd64.AppImage',
      },
      {
        clientId: 'flClash',
        platform: 'android',
        expected: 'FlClash-0.8.92-android-arm64-v8a.apk',
      },
      {
        clientId: 'clashVerge',
        platform: 'windows',
        expected: 'Clash.Verge_2.4.6_x64-setup.exe',
      },
      {
        clientId: 'clashVerge',
        platform: 'macos',
        expected: 'Clash.Verge_2.4.6_x64.dmg',
      },
      {
        clientId: 'clashVerge',
        platform: 'linux',
        expected: 'Clash.Verge_x64.app.tar.gz',
      },
      {
        clientId: 'clashMeta',
        platform: 'android',
        expected: 'cmfa-2.11.24-meta-universal-release.apk',
      },
      {
        clientId: 'clashBox',
        platform: 'harmonyos',
        expected: 'ClashNEXT-LTS-1.5.1.hap',
      },
      {
        clientId: 'singBox',
        platform: 'android',
        expected: 'SFA-1.13.2-universal.apk',
      },
      {
        clientId: 'singBox',
        platform: 'macos',
        expected: 'SFM-1.13.2-Universal.pkg',
      },
      {
        clientId: 'sparkle',
        platform: 'windows',
        expected: 'sparkle-windows-1.26.2-x64-setup.exe',
      },
      {
        clientId: 'sparkle',
        platform: 'macos',
        expected: 'sparkle-macos-1.26.2-x64.pkg',
      },
      {
        clientId: 'sparkle',
        platform: 'linux',
        expected: 'sparkle-linux-1.26.2-amd64.deb',
      },
    ];

    for (const testCase of cases) {
      expect(selectGitHubReleaseAsset(release, testCase.clientId, testCase.platform)?.name).toBe(
        testCase.expected,
      );
    }
  });

  it('returns null when a platform has no managed mirror asset', () => {
    expect(selectGitHubReleaseAsset(release, 'v2rayN', 'macos')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'v2rayN', 'android')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'surge', 'ios')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'shadowrocket', 'ios')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'singBox', 'ios')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'singBox', 'linux')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'clashMeta', 'windows')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'sparkle', 'android')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'flClash', 'ios')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'clashVerge', 'android')).toBeNull();
  });
});
