export const COMMUNITY_PLATFORM_OPTIONS = [
  { value: 'telegram', labelZh: 'Telegram', labelEn: 'Telegram' },
  { value: 'whatsapp', labelZh: 'WhatsApp', labelEn: 'WhatsApp' },
  { value: 'discord', labelZh: 'Discord', labelEn: 'Discord' },
  { value: 'wechat', labelZh: '微信 / WeChat', labelEn: 'WeChat' },
  { value: 'custom', labelZh: '自定义', labelEn: 'Custom' },
] as const;

export type CommunityPlatform = (typeof COMMUNITY_PLATFORM_OPTIONS)[number]['value'];

export interface CommunityLink {
  id: string;
  title: string;
  platform: CommunityPlatform;
  url: string;
  summary: string;
  rules: string;
  notes: string;
  qrContent: string;
  active: boolean;
}

export function getCommunityPlatformLabel(platform: CommunityPlatform, isZh: boolean) {
  const option = COMMUNITY_PLATFORM_OPTIONS.find((item) => item.value === platform);
  if (!option) return platform;
  return isZh ? option.labelZh : option.labelEn;
}
