import { buildClientImportUrl } from '@/src/utils/clientImport';
import { buildClashInstallConfigUrl } from '@/src/utils/subscription';

export type ImportDevice = 'ios' | 'android' | 'desktop';

export const IMPORT_DEVICES: ImportDevice[] = ['ios', 'android', 'desktop'];

export interface SubscriptionImportAction {
  device: ImportDevice;
  /** Deep link for the recommended client. Copy stays on the raw subscription URL. */
  openUrl: string;
  copyUrl: string;
  client: 'shadowrocket' | 'flclash';
}

export function detectImportDevice(userAgent: string): ImportDevice {
  const ua = userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
  if (ua.includes('android') || ua.includes('harmonyos') || ua.includes('openharmony')) {
    return 'android';
  }
  return 'desktop';
}

export function resolveImportAction(
  device: ImportDevice,
  universalUrl: string,
): SubscriptionImportAction | null {
  const copyUrl = universalUrl.trim();
  if (!copyUrl) return null;

  if (device === 'ios') {
    const openUrl = buildClientImportUrl({
      clientId: 'shadowrocket',
      platform: 'ios',
      subscriptionUrl: copyUrl,
      subscriptionName: 'Prism',
      format: 'universal',
    });
    if (!openUrl) return null;
    return { device, openUrl, copyUrl, client: 'shadowrocket' };
  }

  const openUrl = buildClashInstallConfigUrl(copyUrl);
  if (!openUrl) return null;
  return { device, openUrl, copyUrl, client: 'flclash' };
}

export function importDeviceLabel(device: ImportDevice, isZh: boolean): string {
  if (device === 'ios') return 'iPhone';
  if (device === 'android') return 'Android';
  return isZh ? '电脑' : 'Computer';
}

export function importPrimaryLabel(device: ImportDevice, isZh: boolean): string {
  if (device === 'ios') return isZh ? '用 Shadowrocket 打开' : 'Open in Shadowrocket';
  return isZh ? '用 FlClash 打开' : 'Open in FlClash';
}

export function importHint(device: ImportDevice, isZh: boolean): string {
  if (device === 'ios') {
    return isZh
      ? '点上面用 Shadowrocket 导入，然后选一个节点。'
      : 'Tap above to import in Shadowrocket, then choose a node.';
  }
  if (device === 'android') {
    return isZh ? '点上面用 FlClash 导入。' : 'Tap above to import in FlClash.';
  }
  return isZh
    ? 'FlClash 点上面直接打开。v2rayN 复制原始链接，更新后选节点。'
    : 'FlClash opens from the button above. For v2rayN, copy the raw link, update, then choose a node.';
}
