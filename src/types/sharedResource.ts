export type SharedResourceKind =
  | 'apple-id'
  | 'chatgpt-account'
  | '1password-family'
  | 'spotify-family'
  | 'google-one-family'
  | 'other';

export type SharedResourceAccess = 'credentials' | 'invite-link' | 'instructions';

export interface SharedResource {
  id: string;
  title: string;
  kind: SharedResourceKind;
  access: SharedResourceAccess;
  summary: string;
  content: string;
  active: boolean;
}

export const SHARED_RESOURCE_KIND_OPTIONS: Array<{
  value: SharedResourceKind;
  labelZh: string;
  labelEn: string;
}> = [
  { value: 'apple-id', labelZh: '美区 Apple ID', labelEn: 'US Apple ID' },
  { value: 'chatgpt-account', labelZh: 'ChatGPT 账号', labelEn: 'ChatGPT account' },
  { value: '1password-family', labelZh: '1Password 家庭组', labelEn: '1Password family' },
  { value: 'spotify-family', labelZh: 'Spotify 家庭组', labelEn: 'Spotify family' },
  { value: 'google-one-family', labelZh: 'Google One 家庭组', labelEn: 'Google One family' },
  { value: 'other', labelZh: '其他资源', labelEn: 'Other resource' },
];

export const SHARED_RESOURCE_ACCESS_OPTIONS: Array<{
  value: SharedResourceAccess;
  labelZh: string;
  labelEn: string;
}> = [
  { value: 'credentials', labelZh: '账号凭据', labelEn: 'Credentials' },
  { value: 'invite-link', labelZh: '邀请链接', labelEn: 'Invite link' },
  { value: 'instructions', labelZh: '说明文档', labelEn: 'Instructions' },
];

function getOptionLabel<T extends { value: string; labelZh: string; labelEn: string }>(
  options: T[],
  value: string,
  isZh: boolean,
) {
  const matched = options.find((option) => option.value === value);
  if (!matched) return value;
  return isZh ? matched.labelZh : matched.labelEn;
}

export function getSharedResourceKindLabel(kind: SharedResourceKind, isZh: boolean) {
  return getOptionLabel(SHARED_RESOURCE_KIND_OPTIONS, kind, isZh);
}

export function getSharedResourceAccessLabel(access: SharedResourceAccess, isZh: boolean) {
  return getOptionLabel(SHARED_RESOURCE_ACCESS_OPTIONS, access, isZh);
}
