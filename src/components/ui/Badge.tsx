import * as React from 'react';
import { cn } from '@/src/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'border-transparent bg-[var(--accent-soft)] text-[var(--accent)]',
      secondary: 'border-transparent bg-[var(--surface-strong)] text-[var(--text-secondary)]',
      destructive: 'border-transparent bg-[var(--danger-soft)] text-[var(--danger)]',
      outline: 'border-[color:var(--border-subtle)] bg-transparent text-[var(--text-secondary)]',
      success: 'border-transparent bg-[var(--success-soft)] text-[var(--success)]',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2',
          variants[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = 'Badge';

export { Badge };
