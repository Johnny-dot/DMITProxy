import { localFetch } from './base';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import type { SharedResource } from '@/src/types/sharedResource';
import type { CommunityLink } from '@/src/types/communityLink';

export interface AdminSettings {
  siteName: string;
  publicUrl: string;
  supportTelegram: string;
  announcementText: string;
  announcementActive: boolean;
  sharedResources: SharedResource[];
  communityLinks: CommunityLink[];
}

export interface AdminAnnouncement {
  id: string;
  message: string;
  createdAt: number;
  isActive: boolean;
}

export function getAdminSettings(): Promise<AdminSettings> {
  return localFetch<AdminSettings>('/local/admin/settings', {
    fallbackError: 'Failed to load settings',
  });
}

export async function saveAdminSettings(payload: Partial<AdminSettings>): Promise<AdminSettings> {
  const data = await localFetch<{ ok: boolean; settings: AdminSettings }>('/local/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
    fallbackError: 'Failed to save settings',
  });
  return data.settings;
}

export async function getAdminAnnouncements(): Promise<AdminAnnouncement[]> {
  const data = await localFetch<{ announcements?: AdminAnnouncement[] }>(
    '/local/admin/announcements',
    {
      fallbackError: 'Failed to load announcements',
    },
  );
  return Array.isArray(data.announcements) ? data.announcements : [];
}

export async function createAdminAnnouncement(message: string): Promise<AdminAnnouncement[]> {
  const data = await localFetch<{ announcements?: AdminAnnouncement[] }>(
    '/local/admin/announcements',
    {
      method: 'POST',
      body: JSON.stringify({ message }),
      fallbackError: 'Failed to send announcement',
    },
  );
  return Array.isArray(data.announcements) ? data.announcements : [];
}

export async function deleteAdminAnnouncement(id: string): Promise<AdminAnnouncement[]> {
  const data = await localFetch<{ announcements?: AdminAnnouncement[] }>(
    `/local/admin/announcements/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      fallbackError: 'Failed to delete announcement',
    },
  );
  return Array.isArray(data.announcements) ? data.announcements : [];
}

export async function clearPortalSessions(): Promise<number> {
  const data = await localFetch<{ cleared?: number }>('/local/admin/security/clear-sessions', {
    method: 'POST',
    fallbackError: 'Failed to clear sessions',
  });
  return Number(data.cleared ?? 0);
}

export async function getNodeQualityProfiles(): Promise<NodeQualityProfile[]> {
  const data = await localFetch<{ profiles?: NodeQualityProfile[] }>('/local/admin/node-quality', {
    fallbackError: 'Failed to load node quality profiles',
  });
  return Array.isArray(data.profiles) ? data.profiles : [];
}

export async function refreshNodeQualityProfile(inboundId: number): Promise<NodeQualityProfile> {
  const data = await localFetch<{ profile: NodeQualityProfile }>(
    `/local/admin/node-quality/${inboundId}/refresh`,
    {
      method: 'POST',
      fallbackError: 'Failed to refresh node quality profile',
    },
  );
  return data.profile;
}

export async function backupDatabase(): Promise<string> {
  const data = await localFetch<{ file?: string }>('/local/admin/maintenance/backup', {
    method: 'POST',
    fallbackError: 'Failed to backup database',
  });
  return String(data.file ?? '');
}

export async function clearTrafficLogs(): Promise<void> {
  await localFetch<{ ok: boolean }>('/local/admin/maintenance/clear-traffic', {
    method: 'POST',
    fallbackError: 'Failed to clear traffic logs',
  });
}

export interface InboundBillingConfig {
  inboundId: number;
  billingDay: number;
  lastResetDate: string | null;
}

export async function getInboundBillingConfigs(): Promise<InboundBillingConfig[]> {
  const data = await localFetch<{ configs?: InboundBillingConfig[] }>(
    '/local/admin/xui-inbounds-billing',
    { fallbackError: 'Failed to load billing configs' },
  );
  return Array.isArray(data.configs) ? data.configs : [];
}

export async function setInboundBillingDay(
  inboundId: number,
  billingDay: number | null,
): Promise<void> {
  await localFetch<{ ok: boolean }>(`/local/admin/xui-inbounds/${inboundId}/billing-day`, {
    method: 'PUT',
    body: JSON.stringify({ billingDay }),
    fallbackError: 'Failed to update billing day',
  });
}
