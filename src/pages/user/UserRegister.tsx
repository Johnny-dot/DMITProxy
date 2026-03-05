import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Dog, Eye, EyeOff, UserPlus } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { ThemeToggle } from '@/src/components/ui/ThemeToggle';
import { useI18n } from '@/src/context/I18nContext';

export function UserRegisterPage() {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useI18n();
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
      // Auto-login after register
      const loginRes = await fetch('/local/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (loginRes.ok) {
        navigate('/portal', { replace: true });
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
            <h1 className="text-2xl font-bold tracking-tight">{t('userAuth.createAccount')}</h1>
            <p className="text-zinc-500 text-sm mt-1">{t('userAuth.createDesc')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Input
              type="text"
              placeholder={t('userAuth.inviteCode')}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              className="font-mono"
            />
            <Input
              type="text"
              placeholder={t('userAuth.usernameHint')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
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
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <Button type="submit" className="w-full gap-2" disabled={isLoading}>
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {isLoading ? t('userAuth.creating') : t('userAuth.create')}
          </Button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          {t('userAuth.alreadyHave')}{' '}
          <Link to="/login" className="text-emerald-500 hover:text-emerald-400 transition-colors">
            {t('userAuth.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
