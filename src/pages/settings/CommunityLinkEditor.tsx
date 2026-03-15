import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { CommunityPlatformIcon } from '@/src/components/icons/CommunityPlatformIcon';
import { cn } from '@/src/utils/cn';
import { isCommunityQrImageSource } from '@/src/utils/communityQr';
import {
  formatCommunityLinkPreview,
  getCommunityPlatformPreset,
  readFileAsDataUrl,
} from '@/src/utils/settingsHelpers';
import {
  COMMUNITY_PLATFORM_OPTIONS,
  getCommunityPlatformLabel,
  type CommunityLink,
} from '@/src/types/communityLink';
import { useToast } from '@/src/components/ui/Toast';

const TEXTAREA_CLASS_NAME =
  'min-h-[150px] w-full rounded-[22px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2';

const SELECT_CLASS_NAME =
  'h-11 rounded-[18px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2';

const MAX_PASTED_QR_IMAGE_BYTES = 2 * 1024 * 1024;

interface CommunityLinkEditorCopy {
  visible: string;
  hidden: string;
  show: string;
  hide: string;
  remove: string;
  titleField: string;
  joinLinkField: string;
  summaryField: string;
  qrContentField: string;
  rulesField: string;
  notesField: string;
}

interface Props {
  entry: CommunityLink;
  isZh: boolean;
  copy: CommunityLinkEditorCopy;
  onUpdate: (id: string, patch: Partial<CommunityLink>) => void;
  onRemove: (id: string) => void;
}

export function CommunityLinkEditor({ entry, isZh, copy, onUpdate, onRemove }: Props) {
  const { toast } = useToast();
  const [isProcessingQrImage, setIsProcessingQrImage] = useState(false);

  const hasQrImage = isCommunityQrImageSource(entry.qrContent);
  const platformLabel = getCommunityPlatformLabel(entry.platform, isZh);
  const platformPreset = getCommunityPlatformPreset(entry.platform);
  const headerNote =
    formatCommunityLinkPreview(entry.url) ||
    (hasQrImage
      ? isZh
        ? '二维码已就绪'
        : 'QR image ready'
      : isZh
        ? '保留标题、链接、二维码和简短说明'
        : 'Keep title, link, QR, and short summary only');

  const handleQrPaste = async (event: React.ClipboardEvent<HTMLInputElement>) => {
    const clipboardItems: DataTransferItem[] = [];
    for (let index = 0; index < event.clipboardData.items.length; index += 1) {
      const item = event.clipboardData.items[index];
      if (item) clipboardItems.push(item);
    }

    const imageItem = clipboardItems.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) {
      toast(isZh ? '无法读取剪贴板里的图片' : 'Unable to read the pasted image', 'error');
      return;
    }

    if (file.size > MAX_PASTED_QR_IMAGE_BYTES) {
      toast(
        isZh ? '二维码图片请控制在 2 MB 以内' : 'Please keep the QR image within 2 MB',
        'error',
      );
      return;
    }

    setIsProcessingQrImage(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onUpdate(entry.id, { qrContent: dataUrl });
      toast(isZh ? '二维码图片已粘贴' : 'QR image pasted', 'success');
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : isZh
            ? '二维码图片处理失败'
            : 'Failed to process the QR image';
      toast(message, 'error');
    } finally {
      setIsProcessingQrImage(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-[26px] border p-4 transition-[border-color,box-shadow] duration-200 md:p-5',
        platformPreset.cardClassName,
      )}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="flex min-w-0 items-center gap-4">
          <CommunityPlatformIcon platform={entry.platform} />
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn('border-transparent', platformPreset.badgeClassName)}
              >
                {platformLabel}
              </Badge>
              <Badge variant={entry.active ? 'success' : 'secondary'}>
                {entry.active ? copy.visible : copy.hidden}
              </Badge>
              {hasQrImage ? (
                <Badge variant="outline">{isZh ? '二维码图片' : 'QR image'}</Badge>
              ) : null}
            </div>
            <p className="truncate text-sm text-zinc-400" title={headerNote}>
              {headerNote}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-self-end">
          <select
            className={cn(SELECT_CLASS_NAME, 'h-9 min-w-[128px] rounded-full px-3 text-[13px]')}
            value={entry.platform}
            onChange={(event) =>
              onUpdate(entry.id, { platform: event.target.value as CommunityLink['platform'] })
            }
          >
            {COMMUNITY_PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {isZh ? option.labelZh : option.labelEn}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUpdate(entry.id, { active: !entry.active })}
          >
            {entry.active ? copy.hide : copy.show}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-red-500 hover:bg-[var(--danger-soft)] hover:text-red-500"
            onClick={() => onRemove(entry.id)}
          >
            <Trash2 className="h-4 w-4" />
            {copy.remove}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2 md:col-span-2">
          <label className="text-sm font-medium">{copy.titleField}</label>
          <Input
            value={entry.title}
            placeholder={isZh ? '例如：交流群入口' : 'Example: Community entry'}
            onChange={(event) => onUpdate(entry.id, { title: event.target.value })}
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label className="text-sm font-medium">{copy.joinLinkField}</label>
          <Input
            value={entry.url}
            placeholder={
              isZh
                ? '例如：https://t.me/... 或 https://chat.whatsapp.com/...'
                : 'Example: https://t.me/... or https://chat.whatsapp.com/...'
            }
            onChange={(event) => onUpdate(entry.id, { url: event.target.value })}
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label className="text-sm font-medium">{copy.summaryField}</label>
          <Input
            value={entry.summary}
            placeholder={
              isZh
                ? '例如：主要聊产品、市场和日常交流'
                : 'Example: For product, market, and everyday chat'
            }
            onChange={(event) => onUpdate(entry.id, { summary: event.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">{copy.qrContentField}</label>
          <Input
            value={hasQrImage ? '' : entry.qrContent}
            placeholder={isZh ? '留空则默认使用加入链接' : 'Leave empty to reuse the join link'}
            onChange={(event) => onUpdate(entry.id, { qrContent: event.target.value })}
            onPaste={(event) => {
              void handleQrPaste(event);
            }}
          />
          <p className="text-xs leading-6 text-zinc-500">
            {isProcessingQrImage
              ? isZh
                ? '正在处理剪贴板图片...'
                : 'Processing pasted image...'
              : hasQrImage
                ? isZh
                  ? '当前已保存一张二维码图片。输入文字会覆盖它。'
                  : 'A QR image is currently saved. Typing text will replace it.'
                : isZh
                  ? '支持直接在这个输入框里粘贴二维码图片。'
                  : 'You can paste a QR image directly into this field.'}
          </p>
          {hasQrImage ? (
            <div className="surface-panel flex flex-wrap items-center justify-between gap-3 rounded-[18px] px-3 py-3">
              <img
                src={entry.qrContent}
                alt={entry.title ? `${entry.title} QR` : 'QR code'}
                className="h-16 w-16 rounded-[14px] bg-white p-2 object-contain"
                loading="lazy"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdate(entry.id, { qrContent: '' })}
                >
                  {isZh ? '清除图片' : 'Clear image'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="hidden">
        <div className="grid gap-2">
          <label className="text-sm font-medium">{copy.rulesField}</label>
          <textarea
            className={cn(TEXTAREA_CLASS_NAME, 'min-h-[150px]')}
            value={entry.rules}
            placeholder={
              isZh
                ? '例如：\n1. 先查看置顶说明\n2. 不讨论违规内容\n3. 不刷屏'
                : 'Example:\n1. Read the pinned note first\n2. No illegal content\n3. No spam'
            }
            onChange={(event) => onUpdate(entry.id, { rules: event.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">{copy.notesField}</label>
          <textarea
            className={cn(TEXTAREA_CLASS_NAME, 'min-h-[150px]')}
            value={entry.notes}
            placeholder={
              isZh
                ? '例如：\n工作日白天回复更快\n新成员先做自我介绍'
                : 'Example:\nReplies are faster on weekdays\nNew members should introduce themselves first'
            }
            onChange={(event) => onUpdate(entry.id, { notes: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
