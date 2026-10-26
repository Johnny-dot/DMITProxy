import type { ReactNode } from 'react';
import { cn } from '@/src/utils/cn';

export type UsageTone = 'neutral' | 'warn' | 'danger';

/** Neutral until 80%, amber from 80%, red from 95%. Missing values stay neutral. */
export function usageTone(percent: number | null | undefined): UsageTone {
  if (percent == null || !Number.isFinite(percent)) return 'neutral';
  if (percent >= 95) return 'danger';
  if (percent >= 80) return 'warn';
  return 'neutral';
}

/** Width of a relative rank, as a percent of the largest value in the list. */
export function shareWidth(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function UsageMeter({
  percent,
  widthPercent,
  value,
  label,
  className,
}: {
  /** Cap usage. Colors the fill at 80% and 95%. Omit for relative ranks. */
  percent?: number | null;
  /** Fill width. Defaults to `percent`. */
  widthPercent?: number;
  value?: ReactNode;
  label?: ReactNode;
  className?: string;
}) {
  const tone = percent == null ? 'neutral' : usageTone(percent);
  const width = clampPercent(widthPercent ?? percent ?? 0);
  const ariaNow = Math.round(clampPercent(percent ?? width));

  return (
    <div className={cn('usage-meter', className)}>
      {label != null && label !== '' ? <p className="usage-meter-label">{label}</p> : null}
      <div className="usage-meter-row">
        <div
          className="usage-meter-track"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ariaNow}
        >
          <span
            className={cn(
              'usage-meter-fill',
              tone === 'warn' && 'is-warn',
              tone === 'danger' && 'is-danger',
            )}
            style={{ width: `${width}%` }}
          />
        </div>
        {value != null && value !== '' ? <span className="usage-meter-value">{value}</span> : null}
      </div>
    </div>
  );
}

export function QuietStat({
  label,
  value,
  hint,
  extra,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="quiet-stat">
      <p className="quiet-stat-value">{value}</p>
      <p className="quiet-stat-label">
        <span>{label}</span>
        {hint}
      </p>
      {extra ? <p className="quiet-stat-extra">{extra}</p> : null}
    </div>
  );
}
