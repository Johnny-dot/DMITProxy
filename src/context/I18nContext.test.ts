import { describe, expect, it } from 'vitest';
import { resolveInitialLanguage } from './I18nContext';

describe('resolveInitialLanguage', () => {
  it('defaults to Chinese and keeps a stored choice', () => {
    expect(resolveInitialLanguage(null)).toBe('zh-CN');
    expect(resolveInitialLanguage('en-US')).toBe('en-US');
    expect(resolveInitialLanguage('zh-CN')).toBe('zh-CN');
    expect(resolveInitialLanguage('fr-FR')).toBe('zh-CN');
  });
});
