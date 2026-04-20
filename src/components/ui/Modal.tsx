import React, { useCallback, useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/src/utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Element id used for aria-labelledby. Pair this with the title element's id. */
  labelledBy?: string;
  /** Element id used for aria-describedby. Pair with the description element's id. */
  describedBy?: string;
  /** Inline aria-label fallback when there is no title element to reference. */
  ariaLabel?: string;
  /** Click on the backdrop closes the modal. Defaults to true. */
  closeOnBackdrop?: boolean;
  /** Wrapper for the panel. Use it for max-width / shape tweaks. */
  panelClassName?: string;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
  );
}

export function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  ariaLabel,
  closeOnBackdrop = true,
  panelClassName,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const fallbackLabelId = useId();

  // Lock body scroll while open, restore on close.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Save previous focus, move focus into modal, restore on close.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const focusables = getFocusable(panelRef.current);
    const target = focusables[0] ?? panelRef.current;
    target?.focus({ preventScroll: true });
    return () => {
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  // ESC + focus-trap Tab cycling.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = getFocusable(panelRef.current);
      if (focusables.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!closeOnBackdrop) return;
      if (event.target === event.currentTarget) onClose();
    },
    [closeOnBackdrop, onClose],
  );

  const motionProps = reducedMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0, transition: { duration: 0.15 } },
      };

  const panelMotion = reducedMotion
    ? { initial: false, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1 } }
    : {
        initial: { opacity: 0, scale: 0.97, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: 0.15 } },
      };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          {...motionProps}
          className="fixed inset-0 z-[105] flex items-center justify-center bg-[var(--overlay)] p-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            {...panelMotion}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            aria-label={!labelledBy ? (ariaLabel ?? undefined) : undefined}
            id={!labelledBy && !ariaLabel ? fallbackLabelId : undefined}
            tabIndex={-1}
            className={cn('focus:outline-none', panelClassName)}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
