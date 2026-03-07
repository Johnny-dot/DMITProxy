import { describe, expect, it } from 'vitest';
import {
  selectGitHubReleaseAsset,
  supportsManagedClientMirror,
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
        name: 'Hiddify-Windows-Setup-x64.exe',
        browser_download_url: 'https://example.test/hiddify.exe',
      },
      {
        name: 'Hiddify-Android-universal.apk',
        browser_download_url: 'https://example.test/hiddify.apk',
      },
    ],
  };

  it('marks only supported client/platform pairs as mirrorable', () => {
    expect(supportsManagedClientMirror('v2rayN', 'windows')).toBe(true);
    expect(supportsManagedClientMirror('shadowrocket', 'ios')).toBe(false);
    expect(supportsManagedClientMirror('hiddify', 'android')).toBe(true);
  });

  it('selects the expected latest release asset for each supported platform', () => {
    expect(selectGitHubReleaseAsset(release, 'v2rayN', 'windows')?.name).toBe(
      'v2rayN-windows-64.zip',
    );
    expect(selectGitHubReleaseAsset(release, 'v2rayNG', 'android')?.name).toBe(
      'v2rayNG_2.0.13_universal.apk',
    );
    expect(selectGitHubReleaseAsset(release, 'clashVerge', 'windows')?.name).toBe(
      'Clash.Verge_2.4.6_x64-setup.exe',
    );
    expect(selectGitHubReleaseAsset(release, 'clashVerge', 'macos')?.name).toBe(
      'Clash.Verge_2.4.6_x64.dmg',
    );
    expect(selectGitHubReleaseAsset(release, 'hiddify', 'android')?.name).toBe(
      'Hiddify-Android-universal.apk',
    );
  });

  it('returns null when a platform has no managed mirror asset', () => {
    expect(selectGitHubReleaseAsset(release, 'shadowrocket', 'ios')).toBeNull();
    expect(selectGitHubReleaseAsset(release, 'hiddify', 'ios')).toBeNull();
  });
});
