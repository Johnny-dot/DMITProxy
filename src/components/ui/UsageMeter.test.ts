import { describe, expect, it } from 'vitest';
import { shareWidth, usageTone } from './UsageMeter';

describe('usageTone', () => {
  it('stays neutral below 80%', () => {
    expect(usageTone(0)).toBe('neutral');
    expect(usageTone(79.9)).toBe('neutral');
  });

  it('turns amber at 80% and red at 95%', () => {
    expect(usageTone(80)).toBe('warn');
    expect(usageTone(94.9)).toBe('warn');
    expect(usageTone(95)).toBe('danger');
    expect(usageTone(120)).toBe('danger');
  });

  it('ignores missing values', () => {
    expect(usageTone(null)).toBe('neutral');
    expect(usageTone(undefined)).toBe('neutral');
    expect(usageTone(Number.NaN)).toBe('neutral');
  });
});

describe('shareWidth', () => {
  it('scales a value against the list maximum', () => {
    expect(shareWidth(5, 10)).toBe(50);
    expect(shareWidth(10, 10)).toBe(100);
    expect(shareWidth(0, 10)).toBe(0);
    expect(shareWidth(4, 0)).toBe(0);
  });
});
