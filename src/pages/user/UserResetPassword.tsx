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
    <div className="relative min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-2 text-xs"
          onClick={() => setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN')}
        >
          {language === 'zh-CN' ? t('common.en') : t('common.zh')}
        </Button>
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center">
            <Dog className="w-8 h-8 text-emerald-500" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">{t('userAuth.resetTitle')}</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {status === 'ready' && username
                ? t('userAuth.resetForUser', { username })
                : t('userAuth.resetDesc')}
            </p>
          </div>
        </div>

        {status === 'checking' && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}

        {status === 'invalid' && (
          <div className="space-y-4">
            <p className="text-red-400 text-sm text-center">
              {error || t('userAuth.resetInvalid')}
            </p>
            <Link to="/login">
              <Button className="w-full">{t('userAuth.backToLogin')}</Button>
            </Link>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <p className="text-emerald-400 text-sm text-center">{t('userAuth.resetSuccess')}</p>
            <Link to="/login">
              <Button className="w-full">{t('userAuth.signIn')}</Button>
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
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
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
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

            <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
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
