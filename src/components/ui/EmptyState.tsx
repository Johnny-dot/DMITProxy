import React from 'react';
import { SearchX } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: string;
}

export function EmptyState({
  icon: Icon = SearchX,
  title,
  description,
  actionLabel,
  onAction,
  illustration,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      {illustration ? (
        <img
          src={`/illustrations/${illustration}`}
          alt=""
          className="mx-auto mb-5 h-30 w-40 opacity-70"
          loading="lazy"
        />
      ) : (
        <div className="surface-panel mb-5 flex h-16 w-16 items-center justify-center">
          <Icon className="h-8 w-8 text-zinc-500" />
        </div>
      )}
      <h3 className="mb-2 text-lg font-semibold text-zinc-50">{title}</h3>
      <p className="mb-6 max-w-sm text-sm leading-6 text-zinc-400">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
