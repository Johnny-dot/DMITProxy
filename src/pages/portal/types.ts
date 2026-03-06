import type { Monitor } from 'lucide-react';
import type { getClientDownloadLinks } from '@/src/utils/clientDownloads';

export interface UserInfo {
  id: number;
  username: string;
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
export type PortalTab = 'home' | 'subscription' | 'notifications' | 'management';
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
  protocol: string;
  up: number;
  down: number;
  total: number; // bytes, 0 = unlimited
  expiryTime: number; // ms, 0 = never expires
  enable: boolean;
}

export const COPY_RESET_DELAY_MS = 2000;

export function toMillis(value: number): number {
  return value > 1_000_000_000_000 ? value : value * 1000;
}

export function isPortalTab(value: string | null): value is PortalTab {
  return (
    value === 'home' ||
    value === 'subscription' ||
    value === 'notifications' ||
    value === 'management'
  );
}
