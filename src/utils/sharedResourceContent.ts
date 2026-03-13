import type { SharedResourceAccess } from '@/src/types/sharedResource';

export interface SharedResourceCredentialFields {
  account: string;
  password: string;
  note: string;
}

export interface SharedResourceInviteFields {
  link: string;
  note: string;
}

const ACCOUNT_LABEL_PATTERN =
  /^(?:account|email|username|login|账号|帳號|邮箱|郵箱)\s*[:：]\s*(.*)$/i;
const PASSWORD_LABEL_PATTERN = /^(?:password|passcode|code|密码|密碼|口令)\s*[:：]\s*(.*)$/i;
const NOTE_LABEL_PATTERN =
  /^(?:note|notes|rule|rules|remark|remarks|说明|說明|备注|備註|规则|規則)\s*[:：]\s*(.*)$/i;
const LINK_LABEL_PATTERN =
  /^(?:invite\s*link|invitation\s*link|join\s*link|link|邀请链接|邀請連結|加入链接|加入連結|链接|連結)\s*[:：]\s*(.*)$/i;

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseCredentialContent(content: string): SharedResourceCredentialFields {
  const fields: SharedResourceCredentialFields = {
    account: '',
    password: '',
    note: '',
  };
  const noteLines: string[] = [];

  for (const line of splitLines(content)) {
    const accountMatch = line.match(ACCOUNT_LABEL_PATTERN);
    if (accountMatch) {
      fields.account = accountMatch[1]?.trim() ?? '';
      continue;
    }

    const passwordMatch = line.match(PASSWORD_LABEL_PATTERN);
    if (passwordMatch) {
      fields.password = passwordMatch[1]?.trim() ?? '';
      continue;
    }

    const noteMatch = line.match(NOTE_LABEL_PATTERN);
    if (noteMatch) {
      const value = noteMatch[1]?.trim() ?? '';
      if (value) noteLines.push(value);
      continue;
    }

    noteLines.push(line);
  }

  fields.note = noteLines.join('\n').trim();
  return fields;
}

export function formatCredentialContent(
  fields: SharedResourceCredentialFields,
  isZh: boolean,
): string {
  const lines: string[] = [];

  if (fields.account.trim()) {
    lines.push(`${isZh ? '账号' : 'Account'}: ${fields.account.trim()}`);
  }

  if (fields.password.trim()) {
    lines.push(`${isZh ? '密码' : 'Password'}: ${fields.password.trim()}`);
  }

  if (fields.note.trim()) {
    if (lines.length > 0) lines.push('');
    lines.push(`${isZh ? '说明' : 'Note'}: ${fields.note.trim()}`);
  }

  return lines.join('\n').trim();
}

export function parseInviteContent(content: string): SharedResourceInviteFields {
  const fields: SharedResourceInviteFields = {
    link: '',
    note: '',
  };
  const noteLines: string[] = [];

  for (const line of splitLines(content)) {
    const linkMatch = line.match(LINK_LABEL_PATTERN);
    if (linkMatch) {
      fields.link = linkMatch[1]?.trim() ?? '';
      continue;
    }

    const noteMatch = line.match(NOTE_LABEL_PATTERN);
    if (noteMatch) {
      const value = noteMatch[1]?.trim() ?? '';
      if (value) noteLines.push(value);
      continue;
    }

    noteLines.push(line);
  }

  fields.note = noteLines.join('\n').trim();
  return fields;
}

export function formatInviteContent(fields: SharedResourceInviteFields, isZh: boolean): string {
  const lines: string[] = [];

  if (fields.link.trim()) {
    lines.push(`${isZh ? '邀请链接' : 'Invite link'}: ${fields.link.trim()}`);
  }

  if (fields.note.trim()) {
    if (lines.length > 0) lines.push('');
    lines.push(`${isZh ? '说明' : 'Note'}: ${fields.note.trim()}`);
  }

  return lines.join('\n').trim();
}

export function shouldUseStructuredSharedResourceFields(access: SharedResourceAccess) {
  return access === 'credentials' || access === 'invite-link';
}
