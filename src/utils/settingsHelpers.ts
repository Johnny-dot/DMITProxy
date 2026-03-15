import type { AdminSettings } from '@/src/api/client';
import { getSharedResourceKindLabel, type SharedResource } from '@/src/types/sharedResource';
import { getCommunityPlatformLabel, type CommunityLink } from '@/src/types/communityLink';

const DEFAULT_SETTINGS: AdminSettings = {
  siteName: 'Prism Admin',
  publicUrl: '',
  supportTelegram: '',
  announcementText: '',
  announcementActive: false,
  sharedResources: [],
  communityLinks: [],
};

export function createEmptySharedResource(): SharedResource {
  const id =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `resource-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    title: '',
    kind: 'other',
    access: 'instructions',
    summary: '',
    content: '',
    active: true,
  };
}

export function createEmptyCommunityLink(): CommunityLink {
  const id =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `community-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    title: '',
    platform: 'telegram',
    url: '',
    summary: '',
    rules: '',
    notes: '',
    qrContent: '',
    active: true,
  };
}

export function normalizeSettings(data: AdminSettings): AdminSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    sharedResources: Array.isArray(data.sharedResources) ? data.sharedResources : [],
    communityLinks: Array.isArray(data.communityLinks) ? data.communityLinks : [],
  };
}

export function visibleItemCount(items: Array<{ active: boolean }>) {
  return items.filter((item) => item.active).length;
}

export function getSharedResourcePreset(kind: SharedResource['kind']) {
  switch (kind) {
    case 'apple-id':
      return {
        badgeClassName: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
        cardClassName:
          'border-sky-500/18 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0.02))]',
      };
    case 'chatgpt-account':
      return {
        badgeClassName: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
        cardClassName:
          'border-emerald-500/18 bg-[linear-gradient(135deg,rgba(34,197,94,0.08),rgba(255,255,255,0.02))]',
      };
    case '1password-family':
      return {
        badgeClassName: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
        cardClassName:
          'border-amber-500/18 bg-[linear-gradient(135deg,rgba(245,158,11,0.08),rgba(255,255,255,0.02))]',
      };
    case 'spotify-family':
      return {
        badgeClassName: 'border-green-500/25 bg-green-500/10 text-green-300',
        cardClassName:
          'border-green-500/18 bg-[linear-gradient(135deg,rgba(34,197,94,0.08),rgba(255,255,255,0.02))]',
      };
    case 'google-one-family':
      return {
        badgeClassName: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
        cardClassName:
          'border-blue-500/18 bg-[linear-gradient(135deg,rgba(59,130,246,0.08),rgba(255,255,255,0.02))]',
      };
    default:
      return {
        badgeClassName: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-300',
        cardClassName:
          'border-[color:var(--border-subtle)] bg-[linear-gradient(135deg,rgba(113,113,122,0.08),rgba(255,255,255,0.02))]',
      };
  }
}

export function getSharedResourceHeadline(resource: SharedResource, isZh: boolean) {
  const title = resource.title.trim();
  if (title) return title;
  return getSharedResourceKindLabel(resource.kind, isZh);
}

export function getSharedResourcePreview(resource: SharedResource, isZh: boolean) {
  const summary = resource.summary.trim();
  if (summary) return summary;

  switch (resource.access) {
    case 'credentials':
      return isZh
        ? '保留账号、密码和使用限制说明。'
        : 'Keep the credentials and the usage limits together.';
    case 'invite-link':
      return isZh
        ? '保留邀请链接和加入后的补充说明。'
        : 'Keep the invite link and the after-join note together.';
    default:
      return isZh
        ? '保留操作说明和必要的补充信息。'
        : 'Keep the usage steps and the supporting details together.';
  }
}

export function getCommunityPlatformPreset(platform: CommunityLink['platform']) {
  switch (platform) {
    case 'telegram':
      return {
        badgeClassName: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
        cardClassName:
          'border-sky-500/18 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0.02))]',
      };
    case 'whatsapp':
      return {
        badgeClassName: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
        cardClassName:
          'border-emerald-500/18 bg-[linear-gradient(135deg,rgba(34,197,94,0.08),rgba(255,255,255,0.02))]',
      };
    case 'discord':
      return {
        badgeClassName: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300',
        cardClassName:
          'border-indigo-500/18 bg-[linear-gradient(135deg,rgba(99,102,241,0.08),rgba(255,255,255,0.02))]',
      };
    case 'wechat':
      return {
        badgeClassName: 'border-lime-500/25 bg-lime-500/10 text-lime-300',
        cardClassName:
          'border-lime-500/18 bg-[linear-gradient(135deg,rgba(132,204,22,0.08),rgba(255,255,255,0.02))]',
      };
    default:
      return {
        badgeClassName: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-300',
        cardClassName:
          'border-[color:var(--border-subtle)] bg-[linear-gradient(135deg,rgba(113,113,122,0.08),rgba(255,255,255,0.02))]',
      };
  }
}

export function formatCommunityLinkPreview(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const { hostname, pathname, search } = new URL(normalized);
      const compactPath = pathname === '/' ? '' : pathname;
      const compactSearch = search && search.length <= 18 ? search : '';
      const preview = `${hostname.replace(/^www\./i, '')}${compactPath}${compactSearch}`;
      return preview.length > 52 ? `${preview.slice(0, 49)}...` : preview;
    } catch {
      return normalized.length > 52 ? `${normalized.slice(0, 49)}...` : normalized;
    }
  }

  return normalized.length > 52 ? `${normalized.slice(0, 49)}...` : normalized;
}

export function getCommunityEntryHeadline(entry: CommunityLink, isZh: boolean): string {
  const title = entry.title.trim();
  if (title) return title;
  return getCommunityPlatformLabel(entry.platform, isZh);
}

export function getCommunityEntryPreview(
  entry: CommunityLink,
  isZh: boolean,
  hasQrImage: boolean,
): string {
  const urlPreview = formatCommunityLinkPreview(entry.url);
  if (urlPreview) return urlPreview;

  const summary = entry.summary.trim();
  if (summary) return summary;

  if (hasQrImage) {
    return isZh ? '已附带二维码图片' : 'QR image attached';
  }

  if (entry.qrContent.trim()) {
    return isZh ? '使用自定义二维码内容' : 'Using custom QR content';
  }

  return isZh ? '尚未填写加入方式' : 'Join path not filled yet';
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Invalid file reader result'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
