import { describe, expect, it } from 'vitest';
import { resolveInitialLanguage } from './I18nContext';

describe('resolveInitialLanguage', () => {
  it('defaults to Chinese unless the user explicitly chose a language', () => {
    expect(resolveInitialLanguage(null, null)).toBe('zh-CN');
    expect(resolveInitialLanguage('en-US', null)).toBe('zh-CN');
    expect(resolveInitialLanguage('en-US', '0')).toBe('zh-CN');
    expect(resolveInitialLanguage('fr-FR', '1')).toBe('zh-CN');
    expect(resolveInitialLanguage('en-US', '1')).toBe('en-US');
    expect(resolveInitialLanguage('zh-CN', '1')).toBe('zh-CN');
  });
});
