export function normalizeClientIpRecords(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || /^no ip record$/i.test(trimmed)) return [];

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return normalizeClientIpRecords(JSON.parse(trimmed));
      } catch {
        return [trimmed];
      }
    }

    return trimmed
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('ips' in record) {
      return normalizeClientIpRecords(record.ips);
    }

    return Object.entries(record)
      .map(([ip, hits]) => {
        const normalizedIp = ip.trim();
        if (!normalizedIp) return '';
        if (typeof hits === 'number' && Number.isFinite(hits) && hits > 0) {
          return `${normalizedIp} (${hits})`;
        }
        return normalizedIp;
      })
      .filter(Boolean);
  }

  return [];
}
