export const USER_AVATAR_STYLES = [
  'emerald',
  'cobalt',
  'violet',
  'rose',
  'amber',
  'cyan',
  'slate',
  'lime',
] as const;

export type UserAvatarStyle = (typeof USER_AVATAR_STYLES)[number];

export const DEFAULT_USER_AVATAR_STYLE: UserAvatarStyle = 'emerald';

const VALID_USER_AVATAR_STYLES = new Set<UserAvatarStyle>(USER_AVATAR_STYLES);

export function normalizeUserAvatarStyle(value: unknown): UserAvatarStyle {
  if (typeof value !== 'string') return DEFAULT_USER_AVATAR_STYLE;
  return VALID_USER_AVATAR_STYLES.has(value as UserAvatarStyle)
    ? (value as UserAvatarStyle)
    : DEFAULT_USER_AVATAR_STYLE;
}

export function sanitizeUserDisplayName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, 32);
}

export function resolveUserDisplayName(displayName: string | null | undefined, username: string) {
  const normalized = sanitizeUserDisplayName(displayName);
  return normalized || username;
}
