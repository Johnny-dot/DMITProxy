import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LogIn } from 'lucide-react';
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
      eyebrow={isZh ? '账号登录' : 'Account sign-in'}
      title={isZh ? '登录后，继续使用你的服务。' : 'Sign in and continue using your service.'}
      description={
        isZh
          ? '登录后可以查看订阅、使用教程和社区信息。'
          : 'After sign-in, you can open your subscription, setup guide, and community links.'
      }
    >
      <div className="space-y-8" data-testid="login-page">
        <div className="space-y-3">
          <p className="section-kicker">{isZh ? '登录' : 'Sign in'}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
            {isZh ? '欢迎回来' : 'Welcome back'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!hasConfiguredXui && (
            <p
              className="rounded-[20px] border border-[var(--warning-soft-strong)] bg-[var(--warning-soft)] px-4 py-3 text-sm leading-6 text-amber-500"
              data-testid="login-admin-unavailable"
            >
              {adminLoginUnavailableMessage}
            </p>
          )}

          <div className="space-y-3">
            <Input
              type="text"
              placeholder={t('login.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="h-12"
              required
              data-testid="login-username"
            />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('login.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-12 pr-12"
                required
                data-testid="login-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-[18px] border border-[var(--danger-soft-strong)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-red-500">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="h-12 w-full gap-2"
            disabled={isLoading}
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

        <div className="surface-panel flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-50">
              {isZh ? '有邀请码？' : 'Have an invite code?'}
            </p>
            <p className="text-sm leading-6 text-zinc-400">
              {isZh
                ? '先注册，再直接进入你的订阅页。'
                : 'Register first, then go straight to your subscription page.'}
            </p>
          </div>
          <Link to="/register" data-testid="login-register-link">
            <Button variant="ghost" size="sm" className="gap-1.5">
              {isZh ? '去注册' : 'Register'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <p className="text-xs leading-5 text-zinc-500">{t('login.footer')}</p>
      </div>
    </PublicAuthLayout>
  );
}
