import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogIn, UserRound } from 'lucide-react';
import { LOGGED_OUT_KEY, useAuth } from '@/src/context/AuthContext';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { useI18n } from '@/src/context/I18nContext';
import { isXuiConfigured } from '@/src/api/client';
import { PublicAuthLayout } from '@/src/components/public/PublicAuthLayout';

export function LoginPage() {
  const { login: adminLogin, isAuthenticated, isChecking, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const hasConfiguredXui = isXuiConfigured();
  const redirectToUserPortal = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(LOGGED_OUT_KEY);
      window.location.replace('/my-subscription');
      return;
    }
    navigate('/my-subscription', { replace: true });
  };
  const adminLoginUnavailableMessage = t('login.adminLoginUnavailable');

  useEffect(() => {
    if (isChecking || !isAuthenticated) return;

    let cancelled = false;
    void (async () => {
      const nextRole = await refreshAuth();
      if (cancelled || !nextRole) return;
      navigate(nextRole === 'user' ? '/my-subscription' : '/', { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isChecking, navigate, refreshAuth]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    let userLoginError = '';
    try {
      const localRes = await fetch('/local/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const localData = await localRes.json().catch(() => null);
      if (localRes.ok) {
        redirectToUserPortal();
        return;
      }

      userLoginError =
        typeof localData?.error === 'string' ? localData.error : t('userAuth.loginFailed');

      if (!hasConfiguredXui) {
        setError(userLoginError || t('login.loginFailed'));
        return;
      }

      await adminLogin(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      const adminError = err instanceof Error ? err.message : t('login.loginFailed');
      setError(adminError || userLoginError || t('login.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
      </div>
    );
  }

  return (
    <PublicAuthLayout
      eyebrow={isZh ? '登录' : 'Sign in'}
      title={isZh ? '登录,继续使用。' : 'Sign in to continue.'}
      description={isZh ? '订阅、教程、社群。' : 'Subscriptions, guides, community.'}
      compactMobile
    >
      <div className="space-y-5 sm:space-y-8" data-testid="login-page">
        <div className="space-y-5 sm:space-y-8">
          <div className="space-y-1.5 sm:space-y-3">
            <p className="section-kicker">{isZh ? '登录' : 'Sign in'}</p>
            <h2 className="text-xl font-semibold tracking-normal text-zinc-50 sm:text-2xl">
              {isZh ? '欢迎回来' : 'Welcome back'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {!hasConfiguredXui && (
              <p
                className="rounded-[20px] border border-[var(--warning-soft-strong)] bg-[var(--warning-soft)] px-4 py-3 text-sm leading-6 text-amber-500"
                data-testid="login-admin-unavailable"
              >
                {adminLoginUnavailableMessage}
              </p>
            )}

            <div className="space-y-2.5 sm:space-y-3">
              <label htmlFor="login-username" className="sr-only">
                {t('login.username')}
              </label>
              <div className="relative">
                <UserRound
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <Input
                  id="login-username"
                  type="text"
                  placeholder={t('login.username')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-11 pl-11 sm:h-12"
                  required
                  minLength={3}
                  data-testid="login-username"
                />
              </div>
              <label htmlFor="login-password" className="sr-only">
                {t('login.password')}
              </label>
              <div className="relative">
                <LockKeyhole
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('login.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11 pl-11 pr-12 sm:h-12"
                  required
                  minLength={6}
                  data-testid="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword
                      ? isZh
                        ? '隐藏密码'
                        : 'Hide password'
                      : isZh
                        ? '显示密码'
                        : 'Show password'
                  }
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-[18px] border border-[var(--danger-soft-strong)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-red-500"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-11 w-full gap-2 sm:h-12"
              disabled={isLoading || username.trim().length < 3 || password.length < 6}
              data-testid="login-submit"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {isLoading ? t('login.signingIn') : t('login.signIn')}
            </Button>
          </form>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[color:var(--border-subtle)] pt-5 sm:surface-panel sm:border-t-0 sm:px-5 sm:py-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-50">
              {isZh ? '有邀请码？' : 'Have an invite code?'}
            </p>
            <p className="hidden text-sm leading-6 text-zinc-400 min-[380px]:block">
              {isZh ? '注册后直接进订阅页。' : 'Register, then jump to your subscriptions.'}
            </p>
          </div>
          <Link to="/register" data-testid="login-register-link">
            <Button variant="ghost" size="sm" className="gap-1.5">
              {isZh ? '去注册' : 'Register'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <p className="hidden text-xs leading-5 text-zinc-500 sm:block">{t('login.footer')}</p>
      </div>
    </PublicAuthLayout>
  );
}
