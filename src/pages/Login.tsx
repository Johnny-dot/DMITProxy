import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dog, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { ThemeToggle } from '@/src/components/ui/ThemeToggle';
import { useI18n } from '@/src/context/I18nContext';

export function LoginPage() {
  const { login: adminLogin, isAuthenticated, isChecking, role, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const { t, language, setLanguage } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
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
            <p className="text-zinc-500 text-sm mt-1">
              {t('login.adminPanel')} / {t('userAuth.portal')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Input
              type="text"
              placeholder={t('login.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('login.password')}
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
            {isLoading ? t('login.signingIn') : t('login.signIn')}
          </Button>
        </form>

        <p className="text-center text-xs text-zinc-600">
          {t('userAuth.haveResetLink')}{' '}
          <Link
            to="/reset-password"
            className="text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            {t('userAuth.resetNow')}
          </Link>
        </p>
        <p className="text-center text-xs text-zinc-600">{t('login.footer')}</p>
      </div>
    </div>
  );
}
