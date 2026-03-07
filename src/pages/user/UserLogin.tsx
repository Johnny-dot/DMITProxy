import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dog, Eye, EyeOff, LogIn } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { ThemeToggle } from '@/src/components/ui/ThemeToggle';
import { useI18n } from '@/src/context/I18nContext';
import { useAuth } from '@/src/context/AuthContext';

export function UserLoginPage() {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const { t, language, setLanguage } = useI18n();
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
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-950 p-5 md:p-8">
      <div className="absolute top-5 right-5 flex items-center gap-2 md:top-6 md:right-6 xl:top-8 xl:right-8">
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 text-xs md:h-10 md:text-sm"
          onClick={() => setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN')}
        >
          {language === 'zh-CN' ? t('common.en') : t('common.zh')}
        </Button>
        <ThemeToggle className="h-9 w-9 md:h-10 md:w-10" />
      </div>
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-zinc-950/70 px-6 py-8 shadow-sm backdrop-blur-md lg:max-w-lg lg:space-y-10 lg:px-8 lg:py-10">
        <div className="flex flex-col items-center gap-4 lg:gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-zinc-900 lg:h-20 lg:w-20">
            <Dog className="h-9 w-9 text-emerald-500 lg:h-10 lg:w-10" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">ProxyDog</h1>
            <p className="mt-2 text-sm text-zinc-500 lg:text-base">{t('userAuth.portal')}</p>
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
              className="h-11 lg:h-12"
              required
            />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('userAuth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <Button type="submit" className="h-11 w-full gap-2 lg:h-12" disabled={isLoading}>
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {isLoading ? t('userAuth.signingIn') : t('userAuth.signIn')}
          </Button>
        </form>

        <p className="pt-1 text-center text-sm text-zinc-500 lg:text-base">
          {t('userAuth.noAccount')}{' '}
          <Link
            to="/register"
            className="text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            {t('userAuth.registerWithInvite')}
          </Link>
        </p>
      </div>
    </div>
  );
}
