import React, { useState } from 'react';
import { cn } from '@/src/utils/cn';
import { getAvatarInitials } from './news-visuals';

interface NewsSourceAvatarProps {
  sourceDomain: string;
  authorName: string;
  sizeClassName: string;
  fallbackClassName: string;
}

export function NewsSourceAvatar({
  sourceDomain,
  authorName,
  sizeClassName,
  fallbackClassName,
}: NewsSourceAvatarProps) {
  const [failed, setFailed] = useState(false);

  if (sourceDomain && !failed) {
    return (
      <div className={cn('shrink-0 overflow-hidden rounded-full bg-white', sizeClassName)}>
        <img
          src={`https://www.google.com/s2/favicons?domain=${sourceDomain}&sz=64`}
          alt={sourceDomain}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-[3px]"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold sm:text-xs',
        sizeClassName,
        fallbackClassName,
      )}
    >
      {getAvatarInitials(authorName)}
    </div>
  );
}
