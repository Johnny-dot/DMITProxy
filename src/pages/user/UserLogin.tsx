import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LogIn } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { useI18n } from '@/src/context/I18nContext';
import { useAuth } from '@/src/context/AuthContext';
import { PublicAuthLayout } from '@/src/components/public/PublicAuthLayout';

export function UserLoginPage() {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/local/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error(t('userAuth.adminUseLogin'));
        }
        throw new Error(data.error ?? t('userAuth.loginFailed'));
      }
      await refreshAuth();
      navigate('/my-subscription', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('userAuth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PublicAuthLayout
      eyebrow={isZh ? '个人入口' : 'Personal sign-in'}
      title={isZh ? '回到你的页面，继续就好。' : 'A simple way back to your own page.'}
      description={
        isZh
          ? '登录后会直接回到常用的订阅、下载和帮助页面。'
          : 'Sign in and go straight back to your usual links, downloads, and help.'
      }
    >
      <div className="space-y-8">
        <div className="space-y-3">
          <p className="section-kicker">{t('userAuth.portal')}</p>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
              {t('userAuth.signIn')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {isZh
                ? '登录后可以查看订阅、下载客户端和社区入口。'
                : 'Sign in to access your subscription, downloads, and community links.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <Input
              type="text"
              placeholder={t('userAuth.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="h-12"
              required
            />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('userAuth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
          </div>

          {error && (
            <p className="rounded-[18px] border border-[var(--danger-soft-strong)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-red-500">
              {error}
            </p>
          )}

          <Button type="submit" className="h-12 w-full gap-2" disabled={isLoading}>
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {isLoading ? t('userAuth.signingIn') : t('userAuth.signIn')}
          </Button>
        </form>

        <div className="surface-panel flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-50">{t('userAuth.noAccount')}</p>
            <p className="text-sm leading-6 text-zinc-400">
              {isZh
                ? '如果已经拿到邀请码，先注册，再回来登录。'
                : 'If you already have an invite, register first and then come back here.'}
            </p>
          </div>
          <Link to="/register">
            <Button variant="ghost" size="sm" className="gap-1.5">
              {t('userAuth.registerWithInvite')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </PublicAuthLayout>
  );
}
