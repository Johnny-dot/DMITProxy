import { localFetch } from './base';
import type { UserProfile, UserAvatarStyle } from '@/src/types/userProfile';

export interface RefreshCurrentNodeQualityResult {
  stats: {
    inboundId: number;
    inboundRemark: string;
    protocol: string;
    up: number;
    down: number;
    total: number;
    expiryTime: number;
    enable: boolean;
  } | null;
  nodeQuality: import('@/src/types/nodeQuality').NodeQualityProfile | null;
}

export function getUserProfile(): Promise<UserProfile> {
  return localFetch<UserProfile>('/local/auth/profile', {
    fallbackError: 'Failed to load user profile',
  });
}

export async function updateUserProfile(payload: {
  displayName: string;
  avatarStyle: UserAvatarStyle;
}): Promise<UserProfile> {
  const data = await localFetch<{ ok: boolean; profile: UserProfile }>('/local/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
    fallbackError: 'Failed to save user profile',
  });
  return data.profile;
}

export async function refreshCurrentNodeQuality(): Promise<RefreshCurrentNodeQualityResult> {
  return localFetch<RefreshCurrentNodeQualityResult>('/local/auth/portal/node-quality/refresh', {
    method: 'POST',
    fallbackError: 'Failed to refresh current node quality',
  });
}
