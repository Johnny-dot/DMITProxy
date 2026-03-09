import type { Monitor } from 'lucide-react';
import type { getClientDownloadLinks } from '@/src/utils/clientDownloads';
import type { CommunityLink } from '@/src/types/communityLink';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import type { SharedResource } from '@/src/types/sharedResource';
import type { UserAvatarStyle } from '@/src/types/userProfile';

export interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  avatarStyle: UserAvatarStyle;
  role: string;
  subId: string | null;
  createdAt: number;
}

export interface PortalSettings {
  siteName: string;
  publicUrl: string;
  supportTelegram: string;
  announcementText: string;
  announcementActive: boolean;
  sharedResources: SharedResource[];
  communityLinks: CommunityLink[];
}

export interface PortalNotification {
  id: string;
  level: 'info' | 'success' | 'warning';
  title: string;
  message: string;
  createdAt: number;
}

export interface PortalContextResponse {
  user: UserInfo;
  settings: PortalSettings;
  notifications: PortalNotification[];
}

export type SubscriptionFormat = 'universal' | 'clash' | 'v2ray' | 'singbox' | 'surge' | 'quanx';
export type PlatformKey = 'all' | 'windows' | 'macos' | 'android' | 'ios';
export type PortalTab = 'home' | 'market' | 'setup' | 'community' | 'notifications' | 'management';
export type UserPortalTab = 'home' | 'market' | 'setup' | 'community';
export type SetupFocus = 'overview' | 'downloads' | 'support';
export type ViewerRole = 'user' | 'admin';

export interface ClientCard {
  id: 'v2rayN' | 'v2rayNG' | 'shadowrocket' | 'clashVerge' | 'hiddify';
  name: string;
  os: string;
  icon: typeof Monitor;
  platforms: Array<Exclude<PlatformKey, 'all'>>;
  recommendedFor: Array<Exclude<PlatformKey, 'all'>>;
  desc: string;
  links: ReturnType<typeof getClientDownloadLinks>;
}

export interface ClientStats {
  inboundId: number;
  inboundRemark: string;
  protocol: string;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
  enable: boolean;
}

export interface PortalStatsResponse {
  stats: ClientStats | null;
  nodeQuality: NodeQualityProfile | null;
}

export const COPY_RESET_DELAY_MS = 2000;

export function toMillis(value: number): number {
  return value > 1_000_000_000_000 ? value : value * 1000;
}

export function getUserPortalSectionParam(tab: PortalTab): UserPortalTab {
  if (tab === 'market' || tab === 'setup' || tab === 'community') return tab;
  return 'home';
}

export function resolveUserPortalSection(value: string | null): {
  tab: UserPortalTab;
  setupFocus: SetupFocus;
} {
  if (value === 'market') return { tab: 'market', setupFocus: 'overview' };
  if (value === 'community') return { tab: 'community', setupFocus: 'overview' };
  if (value === 'clients') return { tab: 'setup', setupFocus: 'downloads' };
  if (value === 'help') return { tab: 'setup', setupFocus: 'support' };
  if (value === 'setup' || value === 'subscription') {
    return { tab: 'setup', setupFocus: 'overview' };
  }

  return { tab: 'home', setupFocus: 'overview' };
}

export function isPortalTab(value: string | null): value is PortalTab {
  return (
    value === 'home' ||
    value === 'market' ||
    value === 'setup' ||
    value === 'community' ||
    value === 'notifications' ||
    value === 'management'
  );
}
