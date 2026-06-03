import { useEffect, useState } from 'react';
import { getAdminMachineUsage, type MachineUsage } from '@/src/api/client';

/**
 * Fetch the unified machine-level traffic once. Returns null while loading or on error;
 * callers fall back to their own per-inbound client sums so a failed fetch degrades
 * gracefully instead of blanking the page.
 */
export function useMachineUsage(): { usage: MachineUsage | null; loading: boolean } {
  const [usage, setUsage] = useState<MachineUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    getAdminMachineUsage()
      .then((value) => {
        if (!disposed) setUsage(value);
      })
      .catch(() => {
        // Non-fatal — leave usage null; pages use their per-inbound fallback.
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  return { usage, loading };
}
