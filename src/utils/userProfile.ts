import {
  DEFAULT_USER_AVATAR_STYLE,
  USER_AVATAR_STYLE_OPTIONS,
  type UserAvatarStyle,
} from '@/src/types/userProfile';

const AVATAR_STYLE_CLASSNAMES: Record<UserAvatarStyle, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  cobalt: 'border-blue-500/30 bg-blue-500/15 text-blue-300',
  violet: 'border-violet-500/30 bg-violet-500/15 text-violet-300',
  rose: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
  amber: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  cyan: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
  slate: 'border-slate-500/30 bg-slate-500/20 text-slate-200',
  lime: 'border-lime-500/30 bg-lime-500/15 text-lime-300',
};

const VALID_AVATAR_STYLES = new Set<UserAvatarStyle>(
  USER_AVATAR_STYLE_OPTIONS.map((option) => option.value),
);

export function normalizeAvatarStyle(value: string | null | undefined): UserAvatarStyle {
  if (!value) return DEFAULT_USER_AVATAR_STYLE;
  return VALID_AVATAR_STYLES.has(value as UserAvatarStyle)
    ? (value as UserAvatarStyle)
    : DEFAULT_USER_AVATAR_STYLE;
}

export function resolveDisplayName(
  displayName: string | null | undefined,
  username: string | null,
) {
  const normalized = String(displayName ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 32);
  return normalized || username || 'Prism';
}

export function getAvatarInitials(name: string | null | undefined) {
  const normalized = String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!normalized) return 'P';

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }

  return normalized.slice(0, 2).toUpperCase();
}

export function getAvatarToneClasses(style: string | null | undefined) {
  return AVATAR_STYLE_CLASSNAMES[normalizeAvatarStyle(style)];
}

export function getAvatarStyleLabel(style: UserAvatarStyle, isZh: boolean) {
  const option = USER_AVATAR_STYLE_OPTIONS.find((item) => item.value === style);
  if (!option) return style;
  return isZh ? option.labelZh : option.labelEn;
}
