import React from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { SharedResourceKindIcon } from '@/src/components/icons/SharedResourceKindIcon';
import { cn } from '@/src/utils/cn';
import {
  formatCredentialContent,
  formatInviteContent,
  parseCredentialContent,
  parseInviteContent,
} from '@/src/utils/sharedResourceContent';
import {
  getSharedResourceAccessLabel,
  getSharedResourceKindLabel,
  SHARED_RESOURCE_ACCESS_OPTIONS,
  SHARED_RESOURCE_KIND_OPTIONS,
  type SharedResource,
} from '@/src/types/sharedResource';
import {
  getSharedResourceHeadline,
  getSharedResourcePreset,
  getSharedResourcePreview,
} from '@/src/utils/settingsHelpers';

const TEXTAREA_CLASS_NAME =
  'min-h-[150px] w-full rounded-[22px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2';

const SELECT_CLASS_NAME =
  'h-11 rounded-[18px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2';

interface SharedResourceEditorCopy {
  visible: string;
  hidden: string;
  show: string;
  hide: string;
  remove: string;
  titleField: string;
  resourceTypeField: string;
  deliveryTypeField: string;
  summaryField: string;
  accountField: string;
  passwordField: string;
  inviteValueField: string;
  noteField: string;
  detailField: string;
}

interface Props {
  key?: React.Key;
  resource: SharedResource;
  isZh: boolean;
  copy: SharedResourceEditorCopy;
  onUpdate: (id: string, patch: Partial<SharedResource>) => void;
  onRemove: (id: string) => void;
}

export function SharedResourceEditor({ resource, isZh, copy, onUpdate, onRemove }: Props) {
  const resourceHeadline = getSharedResourceHeadline(resource, isZh);
  const resourcePreview = getSharedResourcePreview(resource, isZh);
  const resourceKindLabel = getSharedResourceKindLabel(resource.kind, isZh);
  const resourceAccessLabel = getSharedResourceAccessLabel(resource.access, isZh);
  const resourcePreset = getSharedResourcePreset(resource.kind);
  const credentialFields = parseCredentialContent(resource.content);
  const inviteFields = parseInviteContent(resource.content);
  const showCustomTitleField = resource.kind === 'other';
  const showHeadline = showCustomTitleField && Boolean(resource.title.trim());

  return (
    <div
      className={cn(
        'rounded-[26px] border p-4 transition-[border-color,box-shadow] duration-200 md:p-5',
        resourcePreset.cardClassName,
      )}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="flex min-w-0 items-center gap-4">
          <SharedResourceKindIcon kind={resource.kind} />
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn('border-transparent', resourcePreset.badgeClassName)}
              >
                {resourceKindLabel}
              </Badge>
              <Badge variant="outline">{resourceAccessLabel}</Badge>
              <Badge variant={resource.active ? 'success' : 'secondary'}>
                {resource.active ? copy.visible : copy.hidden}
              </Badge>
            </div>
            {showHeadline ? (
              <p
                className="truncate text-base font-semibold text-[var(--text-primary)]"
                title={resourceHeadline}
              >
                {resourceHeadline}
              </p>
            ) : null}
            <p className="text-sm leading-6 text-zinc-400">{resourcePreview}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-self-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUpdate(resource.id, { active: !resource.active })}
          >
            {resource.active ? copy.hide : copy.show}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-red-500 hover:bg-[var(--danger-soft)] hover:text-red-500"
            onClick={() => onRemove(resource.id)}
          >
            <Trash2 className="h-4 w-4" />
            {copy.remove}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {showCustomTitleField ? (
          <div className="grid gap-2 md:col-span-2">
            <label className="text-sm font-medium">{copy.titleField}</label>
            <Input
              value={resource.title}
              placeholder={
                isZh ? '例如：共享 ChatGPT Plus 账号' : 'Example: Shared ChatGPT Plus account'
              }
              onChange={(event) => onUpdate(resource.id, { title: event.target.value })}
            />
          </div>
        ) : null}

        <div className="grid gap-2">
          <label className="text-sm font-medium">{copy.resourceTypeField}</label>
          <select
            className={SELECT_CLASS_NAME}
            value={resource.kind}
            onChange={(event) =>
              onUpdate(resource.id, { kind: event.target.value as SharedResource['kind'] })
            }
          >
            {SHARED_RESOURCE_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {isZh ? option.labelZh : option.labelEn}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">{copy.deliveryTypeField}</label>
          <select
            className={SELECT_CLASS_NAME}
            value={resource.access}
            onChange={(event) =>
              onUpdate(resource.id, { access: event.target.value as SharedResource['access'] })
            }
          >
            {SHARED_RESOURCE_ACCESS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {isZh ? option.labelZh : option.labelEn}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label className="text-sm font-medium">{copy.summaryField}</label>
          <Input
            value={resource.summary}
            placeholder={
              isZh
                ? '例如：仅用于安装应用，安装后请及时退出'
                : 'Example: Only for app install, please sign out after use'
            }
            onChange={(event) => onUpdate(resource.id, { summary: event.target.value })}
          />
        </div>

        {resource.access === 'credentials' ? (
          <>
            <div className="grid gap-2">
              <label className="text-sm font-medium">{copy.accountField}</label>
              <Input
                value={credentialFields.account}
                placeholder={isZh ? '例如：example@example.com' : 'Example: example@example.com'}
                onChange={(event) =>
                  onUpdate(resource.id, {
                    content: formatCredentialContent(
                      { ...credentialFields, account: event.target.value },
                      isZh,
                    ),
                  })
                }
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">{copy.passwordField}</label>
              <Input
                value={credentialFields.password}
                placeholder={
                  isZh ? '例如：登录密码或一次性验证码' : 'Example: login password or one-time code'
                }
                onChange={(event) =>
                  onUpdate(resource.id, {
                    content: formatCredentialContent(
                      { ...credentialFields, password: event.target.value },
                      isZh,
                    ),
                  })
                }
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <label className="text-sm font-medium">{copy.noteField}</label>
              <textarea
                className={cn(TEXTAREA_CLASS_NAME, 'min-h-[132px]')}
                placeholder={
                  isZh
                    ? '例如：仅用于 App Store 登录，不要开启 iCloud。'
                    : 'Example: Sign in only inside the App Store. Do not enable iCloud.'
                }
                value={credentialFields.note}
                onChange={(event) =>
                  onUpdate(resource.id, {
                    content: formatCredentialContent(
                      { ...credentialFields, note: event.target.value },
                      isZh,
                    ),
                  })
                }
              />
            </div>
          </>
        ) : null}

        {resource.access === 'invite-link' ? (
          <>
            <div className="grid gap-2 md:col-span-2">
              <label className="text-sm font-medium">{copy.inviteValueField}</label>
              <Input
                value={inviteFields.link}
                placeholder={isZh ? '例如：https://...' : 'Example: https://...'}
                onChange={(event) =>
                  onUpdate(resource.id, {
                    content: formatInviteContent(
                      { ...inviteFields, link: event.target.value },
                      isZh,
                    ),
                  })
                }
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <label className="text-sm font-medium">{copy.noteField}</label>
              <textarea
                className={cn(TEXTAREA_CLASS_NAME, 'min-h-[132px]')}
                placeholder={
                  isZh
                    ? '例如：加入后联系管理员确认。'
                    : 'Example: Contact the admin after joining.'
                }
                value={inviteFields.note}
                onChange={(event) =>
                  onUpdate(resource.id, {
                    content: formatInviteContent(
                      { ...inviteFields, note: event.target.value },
                      isZh,
                    ),
                  })
                }
              />
            </div>
          </>
        ) : null}

        {resource.access === 'instructions' ? (
          <div className="grid gap-2 md:col-span-2">
            <label className="text-sm font-medium">{copy.detailField}</label>
            <textarea
              className={cn(TEXTAREA_CLASS_NAME, 'min-h-[168px]')}
              placeholder={
                isZh
                  ? '例如：\n账号：example@example.com\n密码：******\n规则：仅在 App Store 登录，不要开启 iCloud。\n\n或：\n邀请链接：https://...\n说明：接受邀请后联系管理员确认。'
                  : 'Example:\nAccount: example@example.com\nPassword: ******\nRule: sign in only inside App Store, do not enable iCloud.\n\nOr:\nInvite link: https://...\nNote: confirm with the admin after joining.'
              }
              value={resource.content}
              onChange={(event) => onUpdate(resource.id, { content: event.target.value })}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
