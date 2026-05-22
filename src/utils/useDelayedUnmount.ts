import { useEffect, useRef, useState } from 'react';

/**
 * Track open/closed lifecycle for components that need to play a CSS exit
 * animation before unmounting.
 *
 * - `open: true`  → mount immediately, set animState to 'open'
 * - `open: false` → set animState to 'closed' so the exit animation plays,
 *                   then unmount after `exitMs` ms
 *
 * Pair with a `data-anim-state={animState}` attribute on the element and
 * matching CSS keyframes — see `.anim-*` rules in `src/index.css`.
 *
 * Replaces motion/react's AnimatePresence for cases where we control the
 * open state ourselves.
 */
export function useDelayedUnmount(open: boolean, exitMs = 200) {
  const [mounted, setMounted] = useState(open);
  const [animState, setAnimState] = useState<'open' | 'closed'>(open ? 'open' : 'closed');
  const exitTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (open) {
      if (exitTimerRef.current !== undefined) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = undefined;
      }
      setMounted(true);
      setAnimState('open');
      return;
    }
    if (mounted) {
      setAnimState('closed');
      exitTimerRef.current = window.setTimeout(() => {
        setMounted(false);
        exitTimerRef.current = undefined;
      }, exitMs);
    }
    return () => {
      if (exitTimerRef.current !== undefined) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = undefined;
      }
    };
  }, [open, mounted, exitMs]);

  return { mounted, animState };
}
