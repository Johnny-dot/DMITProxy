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
            <h1 className="text-2xl font-bold tracking-tight">ProxyDog</h1>
            <p className="text-zinc-500 text-sm mt-1">{t('userAuth.portal')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Input
              type="text"
              placeholder={t('userAuth.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('userAuth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <Button type="submit" className="w-full gap-2" disabled={isLoading}>
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {isLoading ? t('userAuth.signingIn') : t('userAuth.signIn')}
          </Button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          {t('userAuth.noAccount')}{' '}
          <Link
            to="/register"
            className="text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            {t('userAuth.registerWithInvite')}
          </Link>
        </p>
        <p className="text-center text-xs text-zinc-600">
          {t('userAuth.haveResetLink')}{' '}
          <Link
            to="/reset-password"
            className="text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            {t('userAuth.resetNow')}
          </Link>
        </p>
      </div>
    </div>
  );
}
