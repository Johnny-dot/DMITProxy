import React from 'react';
import { cn } from '@/src/utils/cn';
import type { UnlockServiceId } from '@/src/types/nodeQuality';

interface UnlockServiceIconProps {
  service: UnlockServiceId;
  className?: string;
}

function Wrapper({
  className,
  children,
  style,
}: {
  className: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

export function UnlockServiceIcon({ service, className }: UnlockServiceIconProps) {
  if (service === 'netflix') {
    return (
      <Wrapper className={cn('bg-[#e50914]/15 text-[#e50914]', className)}>
        <svg viewBox="0 0 24 24" className="h-[70%] w-[70%] fill-current">
          <rect x="4" y="3" width="4" height="18" rx="1" />
          <rect x="16" y="3" width="4" height="18" rx="1" />
          <polygon points="8,3 16,21 12.2,21 4.2,3" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'chatgpt') {
    return (
      <Wrapper className={cn('bg-[#10a37f]/15 text-[#10a37f]', className)}>
        <svg
          viewBox="0 0 24 24"
          className="h-[78%] w-[78%]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="12" cy="5.5" r="3" />
          <circle cx="17.2" cy="8.5" r="3" />
          <circle cx="17.2" cy="14.8" r="3" />
          <circle cx="12" cy="17.8" r="3" />
          <circle cx="6.8" cy="14.8" r="3" />
          <circle cx="6.8" cy="8.5" r="3" />
          <circle cx="12" cy="11.8" r="2.2" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'claude') {
    return (
      <Wrapper className={cn('bg-[#d97706]/15 text-[#f59e0b]', className)}>
        <span className="text-[11px] font-semibold tracking-[-0.02em]">Cl</span>
      </Wrapper>
    );
  }

  if (service === 'tiktok') {
    return (
      <Wrapper className={cn('bg-zinc-950 text-white', className)}>
        <svg
          viewBox="0 0 24 24"
          className="h-[76%] w-[76%]"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M14.3 5.2v8a3.7 3.7 0 1 1-2.8-3.6"
            stroke="#25f4ee"
            strokeWidth="2.2"
            transform="translate(0.45 0.45)"
          />
          <path
            d="M14.3 5.2c0 1.8 1.2 3.3 3 3.8"
            stroke="#fe2c55"
            strokeWidth="2.2"
            transform="translate(-0.45 -0.45)"
          />
          <path d="M14.3 5.2v8a3.7 3.7 0 1 1-2.8-3.6" stroke="currentColor" strokeWidth="2.2" />
          <path d="M14.3 5.2c0 1.8 1.2 3.3 3 3.8" stroke="currentColor" strokeWidth="2.2" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'instagram') {
    return (
      <Wrapper
        className={className ?? ''}
        style={{
          background:
            'radial-gradient(circle at 30% 110%, #fdf497 0%, #fdf497 8%, #fd5949 40%, #d6249f 68%, #285AEB 100%)',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[68%] w-[68%]"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
        >
          <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" />
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="17.4" cy="6.8" r="1.1" fill="#fff" stroke="none" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'youtube') {
    return (
      <Wrapper className={cn('bg-[#ff0033]/15 text-[#ff0033]', className)}>
        <svg viewBox="0 0 24 24" className="h-[76%] w-[76%]" fill="none">
          <rect x="4" y="6.2" width="16" height="11.6" rx="3.2" fill="currentColor" />
          <polygon points="10.2,9.2 15.6,12 10.2,14.8" fill="#fff" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'disneyplus') {
    return (
      <Wrapper className={cn('bg-[#113ccf]/15 text-[#7dd3fc]', className)}>
        <svg
          viewBox="0 0 24 24"
          className="h-[76%] w-[76%]"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5.6 10.8c1.9-3.5 5.3-5.3 10.3-5.3" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M7.1 15.6V9.8h2.3c1.8 0 2.9 1.1 2.9 2.9s-1.1 2.9-2.9 2.9z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M13.2 15.6V9.8h4.3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13.2 12.7h3.3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13.2 15.6h4.4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M18.2 7.3l.01 0" stroke="#fff" strokeWidth="2.2" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'primevideo') {
    return (
      <Wrapper className={cn('bg-[#00a8e1]/15 text-[#00a8e1]', className)}>
        <svg
          viewBox="0 0 24 24"
          className="h-[76%] w-[76%]"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M6.2 15.9c1.9 1.1 3.9 1.7 6.2 1.7 2 0 3.9-.5 5.6-1.5"
            stroke="currentColor"
            strokeWidth="1.9"
          />
          <path d="M15.6 16.3l2.8-.2-.8 2.6" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M8 13.2v-3.1h1.7c1.2 0 1.9.6 1.9 1.6 0 1-.7 1.5-1.9 1.5z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M13.1 13.2v-3.1h2.9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13.1 11.6h2.2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'x') {
    return (
      <Wrapper className={cn('bg-zinc-950 text-white', className)}>
        <svg viewBox="0 0 24 24" className="h-[72%] w-[72%]" fill="currentColor">
          <path d="M6.3 5h3.2l3 4.4L16.4 5H18l-4.7 5.5L18.9 19h-3.2l-3.4-5-4.2 5H6.5l5.1-6-5.3-8z" />
        </svg>
      </Wrapper>
    );
  }

  return (
    <Wrapper className={cn('bg-[#1ed760]/15 text-[#1ed760]', className)}>
      <svg
        viewBox="0 0 24 24"
        className="h-[74%] w-[74%]"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      >
        <circle cx="12" cy="12" r="8.2" />
        <path d="M7.4 9.3c2.7-0.7 5.9-0.6 8.9 0.5" />
        <path d="M8 12c2.3-0.5 5-0.4 7.6 0.4" />
        <path d="M8.7 14.8c1.9-0.3 4-0.2 6 0.4" />
      </svg>
    </Wrapper>
  );
}
