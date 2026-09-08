import { expect, it } from 'vitest';
import { TtlCache } from './ttl-cache.js';

it('expires values, caps cardinality and preserves recently read values', () => {
  let now = 0;
  const cache = new TtlCache<boolean>(2, 100, () => now);
  cache.set('a', true);
  cache.set('b', false);
  expect(cache.get('a')).toBe(true);
  cache.set('c', true);
  expect(cache.get('b')).toBeUndefined();
  expect(cache.size).toBe(2);
  now = 101;
  expect(cache.get('a')).toBeUndefined();
  cache.set('d', false);
  expect(cache.size).toBe(1);
  expect(cache.get('d')).toBe(false);
});
