import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, UserPlus } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { useI18n } from '@/src/context/I18nContext';
import { useAuth } from '@/src/context/AuthContext';
import { PublicAuthLayout } from '@/src/components/public/PublicAuthLayout';

export function UserRegisterPage() {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';
  const [params] = useSearchParams();
  const [inviteCode, setInviteCode] = useState(params.get('invite') ?? '');
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
        await refreshAuth();
        navigate('/my-subscription', { replace: true });
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
      eyebrow={isZh ? '邀请码注册' : 'Invite-based registration'}
      title={
        isZh
          ? '创建用户账户，然后直接进入订阅工作区。'
          : 'Create an account and enter the subscription workspace.'
      }
      description={
        isZh
          ? '当你已经拿到邀请码时，注册流程应该足够直接，不需要额外的学习成本。'
          : 'Registration stays deliberately simple: invite code, credentials, and immediate access.'
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
            <Input
              type="text"
              placeholder={t('userAuth.inviteCode')}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              className="h-12 font-mono"
              data-testid="register-invite"
            />
            <Input
              type="text"
              placeholder={t('userAuth.usernameHint')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="h-12"
              required
              data-testid="register-username"
            />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('userAuth.passwordHint')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="h-12 pr-12"
                required
                data-testid="register-password"
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
                ? '如果你已经创建过账户，直接返回登录页即可。'
                : 'If the account already exists, go back to the shared sign-in entry.'}
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
