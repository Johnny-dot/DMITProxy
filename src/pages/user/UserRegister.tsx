import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, UserPlus } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { LOGGED_OUT_KEY } from '@/src/context/AuthContext';
import { useI18n } from '@/src/context/I18nContext';
import { PublicAuthLayout } from '@/src/components/public/PublicAuthLayout';

export function UserRegisterPage() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';
  const [params] = useSearchParams();
  const [inviteCode, setInviteCode] = useState(params.get('invite') ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const redirectToUserPortal = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(LOGGED_OUT_KEY);
      window.location.replace('/my-subscription');
      return;
    }
    navigate('/my-subscription', { replace: true });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/local/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('userAuth.registerFailed'));

      const loginRes = await fetch('/local/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (loginRes.ok) {
        redirectToUserPortal();
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('userAuth.registerFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PublicAuthLayout
      eyebrow={isZh ? '邀请码注册' : 'Invite registration'}
      title={isZh ? '先完成注册，再开始使用。' : 'Create your account and get started.'}
      description={
        isZh
          ? '准备好邀请码、用户名和密码，注册后会直接进入你的页面。'
          : 'Use your invite code, username, and password, then continue straight to your page.'
      }
    >
      <div className="space-y-8" data-testid="register-page">
        <div className="space-y-3">
          <p className="section-kicker">{t('userAuth.createAccount')}</p>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
              {t('userAuth.createAccount')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{t('userAuth.createDesc')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <label htmlFor="register-invite" className="sr-only">
              {t('userAuth.inviteCode')}
            </label>
            <Input
              id="register-invite"
              type="text"
              placeholder={t('userAuth.inviteCode')}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              className="h-12 font-mono"
              data-testid="register-invite"
            />
            <label htmlFor="register-username" className="sr-only">
              {t('userAuth.usernameHint')}
            </label>
            <Input
              id="register-username"
              type="text"
              placeholder={t('userAuth.usernameHint')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="h-12"
              required
              minLength={3}
              data-testid="register-username"
            />
            <label htmlFor="register-password" className="sr-only">
              {t('userAuth.passwordHint')}
            </label>
            <div className="relative">
              <Input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('userAuth.passwordHint')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="h-12 pr-12"
                required
                minLength={6}
                data-testid="register-password"
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
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
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
            className="h-12 w-full gap-2"
            disabled={
              isLoading ||
              inviteCode.trim().length === 0 ||
              username.trim().length < 3 ||
              password.length < 6
            }
            data-testid="register-submit"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {isLoading ? t('userAuth.creating') : t('userAuth.create')}
          </Button>
        </form>

        <div className="surface-panel flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-50">{t('userAuth.alreadyHave')}</p>
            <p className="text-sm leading-6 text-zinc-400">
              {isZh
                ? '如果之前已经注册过，直接回到登录页即可。'
                : 'If you already registered before, just head back to sign-in.'}
            </p>
          </div>
          <Link to="/login" data-testid="register-login-link">
            <Button variant="ghost" size="sm" className="gap-1.5">
              {t('userAuth.signIn')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </PublicAuthLayout>
  );
}
