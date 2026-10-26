import { describe, expect, it } from 'vitest';
import { detectImportDevice, importHint, resolveImportAction } from './subscriptionImport';

const universal = 'https://example.com/sub/demo-token';

describe('detectImportDevice', () => {
  it('maps phones and computers without using the browser language', () => {
    expect(detectImportDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(
      'ios',
    );
    expect(detectImportDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('ios');
    expect(detectImportDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android');
    expect(detectImportDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
    expect(detectImportDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe('desktop');
  });
});

describe('resolveImportAction', () => {
  it('opens Shadowrocket with the raw subscription on iPhone', () => {
    const action = resolveImportAction('ios', universal);
    expect(action?.client).toBe('shadowrocket');
    expect(action?.copyUrl).toBe(universal);
    expect(action?.openUrl ?? '').toContain('shadowrocket://add/sub://');
    expect(action?.openUrl ?? '').not.toContain('flag=');
    expect(importHint('ios', true)).toContain('Shadowrocket');
  });

  it('opens FlClash with a clash flag on Android and desktop, and keeps v2rayN on the raw link', () => {
    for (const device of ['android', 'desktop'] as const) {
      const action = resolveImportAction(device, universal);
      expect(action?.client).toBe('flclash');
      expect(action?.copyUrl).toBe(universal);
      expect(action?.openUrl.startsWith('clash://install-config?url=')).toBe(true);
      expect(decodeURIComponent(action?.openUrl ?? '')).toContain(`${universal}?flag=clash`);
    }
    expect(importHint('desktop', true)).toContain('v2rayN');
    expect(importHint('android', true)).not.toContain('v2rayN');
  });
});
