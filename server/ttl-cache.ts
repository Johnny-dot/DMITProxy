/** Bounded TTL cache; expired entries and oldest entries are removed on insertion. */
export class TtlCache<T> {
  private entries = new Map<string, { value: T; expiresAt: number }>();
  constructor(
    private maxEntries: number,
    private ttlMs: number,
    private now = Date.now,
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1 || !Number.isFinite(ttlMs) || ttlMs <= 0)
      throw new RangeError('Invalid cache capacity or TTL');
  }
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: T): void {
    const now = this.now();
    for (const [k, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(k);
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
    while (this.entries.size > this.maxEntries)
      this.entries.delete(this.entries.keys().next().value!);
  }
  get size(): number {
    return this.entries.size;
  }
}
