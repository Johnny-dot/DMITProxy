import React, { useState } from 'react';
import { Database } from 'lucide-react';
import { cn } from '@/src/utils/cn';
import type { SharedResourceKind } from '@/src/types/sharedResource';

interface SharedResourceKindIconProps {
  kind: SharedResourceKind;
  className?: string;
}

const OFFICIAL_FAVICONS: Partial<Record<SharedResourceKind, string>> = {
  'apple-id': 'https://www.apple.com/favicon.ico',
  'chatgpt-account': 'https://chatgpt.com/favicon.ico',
};

function Wrapper({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-white/10 shadow-[0_12px_30px_rgba(15,23,42,0.16)]',
        className,
      )}
    >
      {children}
    </span>
  );
}

function FallbackIcon({ kind, className }: SharedResourceKindIconProps) {
  switch (kind) {
    case 'apple-id':
      return (
        <Wrapper className={cn('bg-black text-white', className)}>
          <svg viewBox="0 0 24 24" className="h-[72%] w-[72%]" fill="none">
            <path
              fill="currentColor"
              d="M15.28 6.22c.8-.97 1.33-2.3 1.18-3.64-1.15.08-2.5.76-3.27 1.69-.71.82-1.34 2.16-1.16 3.42 1.29.1 2.46-.63 3.25-1.47ZM18.28 12.44c.03-2.54 2.08-3.75 2.18-3.81-1.19-1.74-3.05-1.98-3.7-2.01-1.57-.17-3.08.93-3.88.93-.81 0-2.04-.9-3.36-.87-1.73.03-3.32 1.01-4.21 2.56-1.8 3.12-.46 7.72 1.29 10.24.85 1.23 1.86 2.6 3.18 2.55 1.27-.05 1.75-.82 3.29-.82 1.54 0 1.97.82 3.32.79 1.37-.02 2.24-1.24 3.08-2.48.98-1.43 1.38-2.82 1.4-2.89-.03-.01-2.68-1.03-2.69-4.19Z"
            />
          </svg>
        </Wrapper>
      );
    case 'chatgpt-account':
      return (
        <Wrapper className={cn('bg-[#111827] text-white', className)}>
          <svg
            viewBox="0 0 24 24"
            className="h-[74%] w-[74%]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <circle cx="12" cy="5.5" r="3" />
            <circle cx="17.2" cy="8.5" r="3" />
            <circle cx="17.2" cy="14.8" r="3" />
            <circle cx="12" cy="17.8" r="3" />
            <circle cx="6.8" cy="14.8" r="3" />
            <circle cx="6.8" cy="8.5" r="3" />
            <circle cx="12" cy="11.8" r="2.1" />
          </svg>
        </Wrapper>
      );
    case '1password-family':
      return (
        <Wrapper className={cn('bg-[#0A6CFF]', className)}>
          <svg viewBox="0 0 24 24" className="h-[74%] w-[74%]" fill="none">
            <circle cx="12" cy="12" r="8.2" stroke="#fff" strokeWidth="2.2" />
            <circle cx="12" cy="10" r="2" fill="#fff" />
            <rect x="11.05" y="12" width="1.9" height="5" rx="0.95" fill="#fff" />
          </svg>
        </Wrapper>
      );
    case 'spotify-family':
      return (
        <Wrapper className={cn('bg-[#1ED760]', className)}>
          <svg
            viewBox="0 0 24 24"
            className="h-[74%] w-[74%]"
            fill="none"
            stroke="#121212"
            strokeLinecap="round"
            strokeWidth="2"
          >
            <path d="M6.6 9.4c3.3-1 7-0.8 10 0.6" />
            <path d="M7.4 12.2c2.6-.6 5.4-.4 7.7.5" />
            <path d="M8.2 15c1.8-.3 3.7-.1 5.4.5" />
          </svg>
        </Wrapper>
      );
    case 'google-one-family':
      return (
        <Wrapper className={cn('bg-white', className)}>
          <svg
            viewBox="0 0 24 24"
            className="h-[74%] w-[74%]"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
          >
            <path
              d="M8.1 17h7.7a3.55 3.55 0 0 0 .2-7.1A4.9 4.9 0 0 0 7.6 10 3.2 3.2 0 0 0 8.1 17Z"
              stroke="#4285F4"
            />
            <path d="M7 12.8a3.2 3.2 0 0 0 1.1 4.2" stroke="#EA4335" />
            <path d="M8.1 17h2.6" stroke="#34A853" />
            <path d="M10.7 17h5.1" stroke="#FBBC05" />
          </svg>
        </Wrapper>
      );
    default:
      return (
        <Wrapper
          className={cn('bg-[var(--surface-strong)] text-[var(--text-secondary)]', className)}
        >
          <Database className="h-6 w-6" />
        </Wrapper>
      );
  }
}

export function SharedResourceKindIcon({ kind, className }: SharedResourceKindIconProps) {
  const [useFallback, setUseFallback] = useState(false);
  const src = OFFICIAL_FAVICONS[kind];

  if (!useFallback && src) {
    return (
      <Wrapper className={cn('bg-white/95', className)}>
        <img
          key={kind}
          src={src}
          alt=""
          className="h-9 w-9 rounded-[10px] object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setUseFallback(true)}
        />
      </Wrapper>
    );
  }

  return <FallbackIcon kind={kind} className={className} />;
}
