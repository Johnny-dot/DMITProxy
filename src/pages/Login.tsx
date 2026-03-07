import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { useI18n } from '@/src/context/I18nContext';
import { isXuiConfigured } from '@/src/api/client';
import { PublicAuthLayout } from '@/src/components/public/PublicAuthLayout';

export function LoginPage() {
  const { login: adminLogin, isAuthenticated, isChecking, role, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const hasConfiguredXui = isXuiConfigured();
  const adminLoginUnavailableMessage = isZh
    ? '面板登录还没配置好，请先在服务器 .env 里补上 3X-UI 参数。'
    : t('login.adminLoginUnavailable');

  useEffect(() => {
    if (isChecking) return;
    if (!isAuthenticated) return;
    navigate(role === 'user' ? '/my-subscription' : '/', { replace: true });
  }, [isAuthenticated, isChecking, navigate, role]);

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
        await refreshAuth();
        navigate('/my-subscription', { replace: true });
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
      eyebrow={isZh ? '共用入口' : 'Shared sign-in'}
      title={
        isZh
          ? '把登录、订阅和说明放在一个轻松一点的入口里。'
          : 'A calmer shared entry for the people using this together.'
      }
      description={
        isZh
          ? '登录后会直接去到你当前能用的页面，不需要记太多路径。'
          : 'Sign in once and go straight to the page that makes sense for you.'
      }
    >
      <div className="space-y-8" data-testid="login-page">
        <div className="space-y-3">
          <p className="section-kicker">{isZh ? '登录' : 'Sign in'}</p>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
              {isZh
                ? '登录后直接进入你现在要用的页面'
                : 'Sign in once and go straight to the page you need'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {isZh
                ? '系统会自动带你进入对应页面，不用自己再判断该去哪里。'
                : 'The app routes you automatically, so you do not have to think about where to go next.'}
            </p>
          </div>
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
              {isZh
                ? '已经拿到邀请码？可以直接创建自己的账号。'
                : 'Have an invite code? Create your own account.'}
            </p>
            <p className="text-sm leading-6 text-zinc-400">
              {isZh
                ? '注册完成后，就能直接看到自己的订阅、客户端和帮助说明。'
                : 'Once registration is done, you will land on your own links, clients, and help pages.'}
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
