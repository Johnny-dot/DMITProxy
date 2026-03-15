import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { useI18n } from '@/src/context/I18nContext';
import { PublicAuthLayout } from '@/src/components/public/PublicAuthLayout';

type ResetStatus = 'checking' | 'ready' | 'invalid' | 'success';

export function UserResetPasswordPage() {
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';
  const [params] = useSearchParams();
  const token = useMemo(() => String(params.get('token') ?? '').trim(), [params]);
  const [status, setStatus] = useState<ResetStatus>('checking');
  const [username, setUsername] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    if (!token) {
      setStatus('invalid');
      setError(t('userAuth.resetTokenMissing'));
      return () => {
        active = false;
      };
    }

    setStatus('checking');
    setError('');

    fetch('/local/auth/password-reset/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) {
          setStatus('invalid');
          setError(data?.error ?? t('userAuth.resetInvalid'));
          return;
        }
        setUsername(String(data?.username ?? ''));
        setExpiresAt(Number(data?.expiresAt ?? 0) || null);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('invalid');
        setError(t('userAuth.resetInvalid'));
      });

    return () => {
      active = false;
    };
  }, [token, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.trim().length < 6) {
      setError(t('userAuth.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('userAuth.passwordMismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/local/auth/password-reset/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: password.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? t('userAuth.resetFailed'));
      }
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('userAuth.resetFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PublicAuthLayout
      eyebrow={isZh ? '找回访问' : 'Reset access'}
      title={isZh ? '改好密码，继续登录。' : 'Reset your password and sign back in.'}
      description={
        isZh
          ? '只要链接还有效，几步就能恢复访问。'
          : 'If the link is still valid, you can restore access in a few steps.'
      }
    >
      <div className="space-y-8" data-testid="reset-password-page">
        <div className="space-y-3">
          <p className="section-kicker">{t('userAuth.resetTitle')}</p>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
              {t('userAuth.resetTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {status === 'ready' && username
                ? t('userAuth.resetForUser', { username })
                : t('userAuth.resetDesc')}
            </p>
          </div>
        </div>

        {status === 'checking' && (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
          </div>
        )}

        {status === 'invalid' && (
          <div className="space-y-5" data-testid="reset-password-invalid">
            <p className="rounded-[18px] border border-[var(--danger-soft-strong)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-red-500">
              {error || t('userAuth.resetInvalid')}
            </p>
            <Link to="/login" data-testid="reset-password-back-login">
              <Button className="h-12 w-full">{t('userAuth.backToLogin')}</Button>
            </Link>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-5" data-testid="reset-password-success">
            <p className="rounded-[18px] border border-[var(--success-soft-strong)] bg-[var(--success-soft)] px-4 py-3 text-sm text-emerald-500">
              {t('userAuth.resetSuccess')}
            </p>
            <Link to="/login" data-testid="reset-password-back-login">
              <Button className="h-12 w-full">{t('userAuth.signIn')}</Button>
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-5" data-testid="reset-password-form">
            {expiresAt && (
              <p className="text-xs leading-5 text-zinc-500">
                {t('userAuth.resetExpiresAt', {
                  date: new Date(expiresAt * 1000).toLocaleString(),
                })}
              </p>
            )}
            <div className="space-y-3">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('userAuth.passwordHint')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-12 pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('userAuth.confirmPassword')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-12 pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-[18px] border border-[var(--danger-soft-strong)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-red-500">
                {error}
              </p>
            )}

            <Button type="submit" className="h-12 w-full gap-2" disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {isSubmitting ? t('userAuth.resetting') : t('userAuth.resetNow')}
            </Button>
          </form>
        )}
      </div>
    </PublicAuthLayout>
  );
}
