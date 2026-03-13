import React from 'react';
import { Link2 } from 'lucide-react';
import { cn } from '@/src/utils/cn';
import type { CommunityPlatform } from '@/src/types/communityLink';

interface CommunityPlatformIconProps {
  platform: CommunityPlatform;
  className?: string;
}

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

export function CommunityPlatformIcon({ platform, className }: CommunityPlatformIconProps) {
  if (platform === 'telegram') {
    return (
      <Wrapper className={cn('bg-[#27A7E7]', className)}>
        <svg viewBox="0 0 24 24" className="h-[74%] w-[74%]" fill="none">
          <path
            fill="#fff"
            d="M17.89 6.73 5.98 11.32c-.81.33-.8.78-.15.98l3.06.95 1.19 3.82c.15.44.07.61.54.61.35 0 .5-.16.7-.36.11-.12.84-.82 1.63-1.57l3.39 2.5c.63.35 1.08.17 1.23-.57l2.1-9.89c.23-.91-.34-1.31-.97-1.03Z"
          />
          <path fill="#27A7E7" d="m10.07 16.94.23-3.28 5.98-5.4-7.2 4.55-.95 4.13Z" />
        </svg>
      </Wrapper>
    );
  }

  if (platform === 'whatsapp') {
    return (
      <Wrapper className={cn('bg-[#25D366]', className)}>
        <svg viewBox="0 0 24 24" className="h-[74%] w-[74%]" fill="none">
          <path
            fill="#fff"
            d="M12.01 5.1a6.53 6.53 0 0 0-5.54 9.98L5.5 18.5l3.53-.93a6.52 6.52 0 0 0 2.98.72h.01a6.6 6.6 0 0 0 0-13.19Z"
          />
          <path
            fill="#25D366"
            d="M9.52 8.66c-.18 0-.36.08-.49.23-.21.22-.8.78-.8 1.9s.82 2.21.93 2.36c.11.14 1.57 2.4 3.82 3.28.54.21.96.34 1.29.43.54.14 1.03.12 1.42.07.43-.06 1.31-.53 1.49-1.04.18-.5.18-.94.13-1.03-.05-.1-.2-.15-.43-.26-.24-.11-1.4-.69-1.62-.77-.22-.08-.38-.11-.54.11-.15.22-.61.77-.75.92-.14.16-.28.17-.52.06-.24-.12-1.03-.38-1.96-1.22-.73-.65-1.23-1.47-1.37-1.71-.14-.25-.01-.38.11-.49.1-.1.24-.25.35-.37.12-.12.15-.22.23-.37.08-.14.04-.27-.02-.39-.06-.11-.54-1.3-.74-1.79-.2-.48-.4-.41-.55-.42h-.48Z"
          />
        </svg>
      </Wrapper>
    );
  }

  if (platform === 'discord') {
    return (
      <Wrapper className={cn('bg-[#5865F2]', className)}>
        <svg viewBox="0 0 24 24" className="h-[74%] w-[74%]" fill="none">
          <path
            fill="#fff"
            d="M20.32 4.37A19.8 19.8 0 0 0 15.88 3c-.19.33-.4.76-.55 1.1a18.27 18.27 0 0 0-5.33 0A11.42 11.42 0 0 0 9.45 3a19.74 19.74 0 0 0-4.44 1.37C2.22 8.55 1.45 12.63 1.77 16.66A19.9 19.9 0 0 0 7.22 19.4c.42-.57.78-1.18 1.09-1.81a12.96 12.96 0 0 1-1.71-.82c.14-.1.28-.22.42-.33a13.88 13.88 0 0 0 11.96 0c.14.11.28.22.42.33-.54.32-1.11.6-1.71.82.31.64.68 1.24 1.09 1.81a19.9 19.9 0 0 0 5.45-2.74c.38-4.66-.63-8.71-3.91-12.29ZM8.02 14.65c-1.18 0-2.16-1.09-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.17 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.09-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.17 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Z"
          />
        </svg>
      </Wrapper>
    );
  }

  if (platform === 'wechat') {
    return (
      <Wrapper className={cn('bg-[#1AAD19]', className)}>
        <svg viewBox="0 0 24 24" className="h-[74%] w-[74%]" fill="none">
          <path
            fill="#fff"
            d="M10.25 6.6c-3.34 0-6.05 2.17-6.05 4.85 0 1.56.92 2.95 2.34 3.84l-.52 2.02 2.25-1.12c.64.18 1.31.28 1.98.28 3.34 0 6.05-2.17 6.05-4.84S13.59 6.6 10.25 6.6Z"
          />
          <path
            fill="#1AAD19"
            d="M8.13 10.78a.76.76 0 1 0 0-1.52.76.76 0 0 0 0 1.52Zm4.24 0a.76.76 0 1 0 0-1.52.76.76 0 0 0 0 1.52Z"
          />
          <path
            fill="#fff"
            d="M14.79 10.22c-2.68 0-4.85 1.74-4.85 3.88 0 2.15 2.17 3.88 4.85 3.88.54 0 1.08-.07 1.58-.2l1.86.93-.43-1.67c1.18-.71 1.84-1.74 1.84-2.94 0-2.14-2.17-3.88-4.85-3.88Z"
          />
          <path
            fill="#1AAD19"
            d="M13.35 14.16a.62.62 0 1 0 0-1.24.62.62 0 0 0 0 1.24Zm2.88 0a.62.62 0 1 0 0-1.24.62.62 0 0 0 0 1.24Z"
          />
        </svg>
      </Wrapper>
    );
  }

  return (
    <Wrapper className={cn('bg-[var(--surface-strong)] text-[var(--text-secondary)]', className)}>
      <Link2 className="h-6 w-6" />
    </Wrapper>
  );
}
