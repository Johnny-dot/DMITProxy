import React from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { useI18n } from '@/src/context/I18nContext';

const CLIENT_COMMIT: string = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : 'unknown';
const CLIENT_BUILD_TIME: string = typeof __APP_BUILD_TIME__ === 'string' ? __APP_BUILD_TIME__ : '';

function formatBuildTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function AppVersionFooter() {
  const { role } = useAuth();
  const { language } = useI18n();
  const isZh = language === 'zh-CN';
  const [serverCommit, setServerCommit] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (role !== 'admin') {
      setServerCommit(null);
      return;
    }
    let cancelled = false;
    fetch('/local/admin/system', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { serverCommit?: string } | null) => {
        if (cancelled) return;
        setServerCommit(typeof data?.serverCommit === 'string' ? data.serverCommit : null);
      })
      .catch(() => {
        if (!cancelled) setServerCommit(null);
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const buildDate = formatBuildTime(CLIENT_BUILD_TIME);
  const mismatch = Boolean(serverCommit && serverCommit !== CLIENT_COMMIT);

  const label = isZh ? '版本' : 'Version';
  const serverLabel = isZh ? '服务端' : 'server';
  const mismatchHint = isZh
    ? '前端与服务端不一致，可能其中一端未重启或浏览器缓存未刷新。'
    : 'Frontend and server commits differ — one side may not be restarted, or the browser cache is stale.';

  return (
    <div
      className="pt-4 text-center text-xs text-[var(--text-secondary)]/70"
      data-testid="app-version-footer"
    >
      <span className="font-mono">
        {label} {CLIENT_COMMIT}
        {buildDate ? ` · ${buildDate}` : ''}
        {mismatch ? ` · ${serverLabel} ${serverCommit}` : ''}
      </span>
      {mismatch && (
        <span className="mt-1 block text-[color:var(--warning,#d97706)]">{mismatchHint}</span>
      )}
    </div>
  );
}
