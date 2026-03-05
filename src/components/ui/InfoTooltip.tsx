import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';
import { cn } from '@/src/utils/cn';

interface InfoTooltipProps {
  content: string;
  className?: string;
}

export function InfoTooltip({ content, className }: InfoTooltipProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const tooltipWidth = 224;
    const margin = 12;
    const centerX = rect.left + rect.width / 2;
    const minCenter = margin + tooltipWidth / 2;
    const maxCenter = window.innerWidth - margin - tooltipWidth / 2;
    setPosition({
      top: rect.top - 8,
      left: Math.min(maxCenter, Math.max(minCenter, centerX)),
    });
  }, []);

  const open = useCallback(() => {
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => updatePosition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <span className={cn('inline-flex items-center', className)}>
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label={content}
          aria-describedby={isOpen ? tooltipId : undefined}
          onMouseEnter={open}
          onMouseLeave={close}
          onFocus={open}
          onBlur={close}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </span>
      {isMounted &&
        isOpen &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none fixed left-0 top-0 z-[1000] w-56 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-md border border-white/10 bg-zinc-900 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-200 shadow-lg"
            style={{ top: position.top, left: position.left }}
          >
            {content}
          </span>,
          document.body,
        )}
    </>
  );
}
