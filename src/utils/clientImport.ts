import type { ClientDownloadId, ClientDownloadPlatform } from './clientDownloads';

export type ClientImportFormat = 'universal' | 'clash' | 'v2ray' | 'singbox' | 'surge';

export interface BuildClientImportUrlOptions {
  clientId: ClientDownloadId;
  platform: ClientDownloadPlatform;
  subscriptionUrl: string;
  subscriptionName?: string;
  format: ClientImportFormat;
}

export function isClientImportFormat(value: string): value is ClientImportFormat {
  return (
    value === 'universal' ||
    value === 'clash' ||
    value === 'v2ray' ||
    value === 'singbox' ||
    value === 'surge'
  );
}

function appendFragment(url: string, name?: string) {
  const normalizedName = name?.trim();
  return normalizedName ? `${url}#${encodeURIComponent(normalizedName)}` : url;
}

function encodeBase64Url(value: string): string {
  if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(value);
    let binary = '';

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  throw new Error('No base64 encoder available');
}

export function buildClientImportUrl({
  clientId,
  platform,
  subscriptionUrl,
  subscriptionName,
  format,
}: BuildClientImportUrlOptions): string | null {
  const normalizedUrl = subscriptionUrl.trim();
  if (!normalizedUrl) return null;

  const encodedUrl = encodeURIComponent(normalizedUrl);
  const encodedName = subscriptionName?.trim() ? encodeURIComponent(subscriptionName.trim()) : '';

  if (clientId === 'surge') {
    if (platform !== 'ios' || format !== 'surge') return null;
    return `surge:///install-config?url=${encodedUrl}`;
  }

  if (clientId === 'singBox') {
    if (format !== 'singbox') return null;
    return appendFragment(`sing-box://import-remote-profile?url=${encodedUrl}`, subscriptionName);
  }

  if (clientId === 'clashMeta') {
    if (platform !== 'android' || format !== 'clash') return null;
    return `clashmeta://install-config?url=${encodedUrl}`;
  }

  if (clientId === 'v2rayNG') {
    if (platform !== 'android' || (format !== 'universal' && format !== 'v2ray')) return null;
    return encodedName
      ? `v2rayng://install-sub?url=${encodedUrl}&name=${encodedName}`
      : `v2rayng://install-sub?url=${encodedUrl}`;
  }

  if (clientId === 'shadowrocket') {
    if (
      (platform !== 'ios' && platform !== 'macos') ||
      (format !== 'universal' && format !== 'v2ray')
    ) {
      return null;
    }

    const base64Url = encodeBase64Url(normalizedUrl);

    return encodedName
      ? `shadowrocket://add/sub://${base64Url}?remark=${encodedName}`
      : `shadowrocket://add/sub://${base64Url}`;
  }

  return null;
}
