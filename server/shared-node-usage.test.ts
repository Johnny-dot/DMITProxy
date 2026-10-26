import { describe, expect, it } from 'vitest';
import {
  findSharedNodeUsageLabel,
  formatSharedNodeUsageLabel,
  parseSharedNodeUsage,
} from './shared-node-usage.js';

describe('parseSharedNodeUsage', () => {
  it('reads the canonical nodes array', () => {
    expect(
      parseSharedNodeUsage(
        JSON.stringify({
          nodes: [{ name: '日本 IEPL 01', usedBytes: 10, totalBytes: 100 }],
        }),
      ),
    ).toEqual([
      {
        name: '日本 IEPL 01',
        index: 0,
        usedBytes: 10,
        totalBytes: 100,
        remainingBytes: null,
        label: null,
      },
    ]);
  });

  it('reads a name map and up/down byte fields', () => {
    const [entry] = parseSharedNodeUsage(
      JSON.stringify({
        '日本 IEPL 01': { up: 1, down: 2, total: 10 },
      }),
    );
    expect(entry).toMatchObject({ name: '日本 IEPL 01', usedBytes: 3, totalBytes: 10 });
  });

  it('returns an empty list for blank or invalid JSON', () => {
    expect(parseSharedNodeUsage('')).toEqual([]);
    expect(parseSharedNodeUsage('not-json')).toEqual([]);
  });
});

describe('formatSharedNodeUsageLabel', () => {
  it('prefers an explicit label, then remaining traffic', () => {
    expect(
      formatSharedNodeUsageLabel({
        name: '节点',
        index: 0,
        usedBytes: null,
        totalBytes: null,
        remainingBytes: null,
        label: '剩 12G',
      }),
    ).toBe('剩 12G');
    expect(
      formatSharedNodeUsageLabel({
        name: '节点',
        index: 0,
        usedBytes: 20 * 1024 ** 3,
        totalBytes: 100 * 1024 ** 3,
        remainingBytes: null,
        label: null,
      }),
    ).toBe('剩80/100G');
  });
});

describe('findSharedNodeUsageLabel', () => {
  it('matches a sanitized node name ahead of index', () => {
    const entries = parseSharedNodeUsage(
      JSON.stringify({
        nodes: [
          { name: '🇯🇵 日本 IEPL 01', usedBytes: 0, totalBytes: 100 * 1024 ** 3 },
          { index: 1, label: '维护中' },
        ],
      }),
    );
    expect(findSharedNodeUsageLabel(entries, { name: '日本 IEPL 01', index: 1 })).toBe(
      '剩100/100G',
    );
    expect(findSharedNodeUsageLabel(entries, { name: '', index: 1 })).toBe('维护中');
  });
});
