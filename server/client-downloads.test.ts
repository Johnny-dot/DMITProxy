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
        name: 'v2rayN-windows-64.zip',
        browser_download_url: 'https://example.test/v2rayN.zip',
      },
      {
        name: 'v2rayNG_2.0.13_universal.apk',
        browser_download_url: 'https://example.test/v2rayNG.apk',
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
    expect(supportsManagedClientMirror('v2rayN', 'windows')).toBe(false);
    expect(supportsManagedClientMirror('v2rayN', 'linux')).toBe(false);
    expect(supportsManagedClientMirror('flClash', 'windows')).toBe(false);
    expect(supportsManagedClientMirror('flClash', 'android')).toBe(false);
    expect(supportsManagedClientMirror('clashMeta', 'android')).toBe(true);
    expect(supportsManagedClientMirror('clashBox', 'harmonyos')).toBe(true);
    expect(supportsManagedClientMirror('sparkle', 'macos')).toBe(false);
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
      { clientId: 'v2rayNG', platform: 'android', expected: 'v2rayNG_2.0.13_universal.apk' },
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
    ];

    for (const testCase of cases) {
      expect(selectGitHubReleaseAsset(release, testCase.clientId, testCase.platform)?.name).toBe(
        testCase.expected,
      );
    }
  });

  it('returns null when a platform has no managed mirror asset', () => {
    expect(selectGitHubReleaseAsset(release, 'v2rayN', 'macos')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'v2rayN', 'windows')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'surge', 'ios')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'shadowrocket', 'ios')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'singBox', 'ios')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'singBox', 'linux')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'clashMeta', 'windows')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'sparkle', 'windows')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'flClash', 'android')).toBeNull();
  });
});
