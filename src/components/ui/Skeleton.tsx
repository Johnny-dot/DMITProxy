import * as React from 'react';
import { cn } from '@/src/utils/cn';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-2xl bg-[var(--surface-strong)]', className)}
      {...props}
    />
  );
}

export { Skeleton };
