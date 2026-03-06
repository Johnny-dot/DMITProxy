import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Dog, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { ThemeToggle } from '@/src/components/ui/ThemeToggle';
import { useI18n } from '@/src/context/I18nContext';

type ResetStatus = 'checking' | 'ready' | 'invalid' | 'success';

export function UserResetPasswordPage() {
  const { t, language, setLanguage } = useI18n();
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

    fetch(`/local/auth/password-reset/verify?token=${encodeURIComponent(token)}`, {
      credentials: 'include',
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
    <div
      className="relative flex min-h-screen items-center justify-center bg-zinc-950 p-5 md:p-8"
      data-testid="reset-password-page"
    >
      <div className="absolute top-5 right-5 flex items-center gap-2 md:top-6 md:right-6 xl:top-8 xl:right-8">
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 text-xs md:h-10 md:text-sm"
          onClick={() => setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN')}
          data-testid="public-language-toggle"
        >
          {language === 'zh-CN' ? t('common.en') : t('common.zh')}
        </Button>
        <ThemeToggle testId="public-theme-toggle" className="h-9 w-9 md:h-10 md:w-10" />
      </div>
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-zinc-950/70 px-6 py-8 shadow-sm backdrop-blur-md lg:max-w-lg lg:space-y-10 lg:px-8 lg:py-10">
        <div className="flex flex-col items-center gap-4 lg:gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-zinc-900 lg:h-20 lg:w-20">
            <Dog className="h-9 w-9 text-emerald-500 lg:h-10 lg:w-10" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
              {t('userAuth.resetTitle')}
            </h1>
            <p className="mt-2 text-sm text-zinc-500 lg:text-base">
              {status === 'ready' && username
                ? t('userAuth.resetForUser', { username })
                : t('userAuth.resetDesc')}
            </p>
          </div>
        </div>

        {status === 'checking' && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}

        {status === 'invalid' && (
          <div className="space-y-5" data-testid="reset-password-invalid">
            <p className="text-red-400 text-sm text-center">
              {error || t('userAuth.resetInvalid')}
            </p>
            <Link to="/login" data-testid="reset-password-back-login">
              <Button className="h-11 w-full lg:h-12">{t('userAuth.backToLogin')}</Button>
            </Link>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-5" data-testid="reset-password-success">
            <p className="text-emerald-400 text-sm text-center">{t('userAuth.resetSuccess')}</p>
            <Link to="/login" data-testid="reset-password-back-login">
              <Button className="h-11 w-full lg:h-12">{t('userAuth.signIn')}</Button>
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-5" data-testid="reset-password-form">
            {expiresAt && (
              <p className="text-xs text-zinc-500 text-center">
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
                  className="h-11 pr-10 lg:h-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('userAuth.confirmPassword')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-11 pr-10 lg:h-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <Button type="submit" className="h-11 w-full gap-2 lg:h-12" disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              {isSubmitting ? t('userAuth.resetting') : t('userAuth.resetNow')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
