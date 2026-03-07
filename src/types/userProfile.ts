export const USER_AVATAR_STYLE_OPTIONS = [
  { value: 'emerald', labelZh: '翡翠', labelEn: 'Emerald' },
  { value: 'cobalt', labelZh: '钴蓝', labelEn: 'Cobalt' },
  { value: 'violet', labelZh: '紫晶', labelEn: 'Violet' },
  { value: 'rose', labelZh: '玫瑰', labelEn: 'Rose' },
  { value: 'amber', labelZh: '琥珀', labelEn: 'Amber' },
  { value: 'cyan', labelZh: '青蓝', labelEn: 'Cyan' },
  { value: 'slate', labelZh: '石板灰', labelEn: 'Slate' },
  { value: 'lime', labelZh: '青柠', labelEn: 'Lime' },
] as const;

export type UserAvatarStyle = (typeof USER_AVATAR_STYLE_OPTIONS)[number]['value'];

export const DEFAULT_USER_AVATAR_STYLE: UserAvatarStyle = 'emerald';

export interface UserProfile {
  username: string;
  displayName: string;
  resolvedDisplayName: string;
  avatarStyle: UserAvatarStyle;
}
