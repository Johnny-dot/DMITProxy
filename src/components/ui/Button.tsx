import * as React from 'react';
import { cn } from '@/src/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default:
        'border-[color:var(--accent-border)] bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-strong)]',
      destructive:
        'border-[color:var(--danger-soft-strong)] bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger-soft-strong)]',
      outline:
        'border-[color:var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[var(--surface-strong)]',
      secondary:
        'border-[color:var(--border-subtle)] bg-[var(--surface-strong)] text-[var(--text-primary)] hover:bg-[var(--surface-contrast)]',
      ghost:
        'border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]',
      link: 'border-transparent bg-transparent px-0 text-[var(--accent)] hover:text-[var(--accent-strong)] hover:underline',
    };

    const sizes = {
      default: 'h-11 px-4 py-2',
      sm: 'h-9 px-3.5 text-[13px]',
      lg: 'h-12 px-6 text-base',
      icon: 'h-11 w-11',
    };

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-full border text-sm font-medium tracking-[-0.01em] backdrop-blur-xl ring-offset-zinc-950 transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 hover:-translate-y-px active:translate-y-0 disabled:pointer-events-none disabled:opacity-45',
          variants[variant],
          sizes[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
