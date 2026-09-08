import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useI18n } from '@/src/context/I18nContext';

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { language } = useI18n();
  const isZh = language === 'zh-CN';
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setIsMobileMenuOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <div className="relative h-dvh min-h-dvh overflow-hidden text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0 opacity-35">
        <div className="absolute left-[-9rem] top-[-7rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.74)_0%,_rgba(255,255,255,0)_68%)] blur-2xl" />
        <div className="absolute right-[-10rem] top-[4rem] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(111,154,255,0.32)_0%,_rgba(111,154,255,0)_68%)] blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[18%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(76,205,186,0.24)_0%,_rgba(76,205,186,0)_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full overflow-hidden">
        <div className="hidden p-4 pr-0 md:block">
          <Sidebar />
        </div>

        <Modal
          open={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          ariaLabel={isZh ? '导航菜单' : 'Navigation menu'}
          panelClassName="fixed inset-y-4 left-4 w-[min(280px,calc(100vw-2rem))] md:hidden"
        >
          <Sidebar
            onNavigate={() => setIsMobileMenuOpen(false)}
            onClose={() => setIsMobileMenuOpen(false)}
          />
        </Modal>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden pb-4">
          <div className="content-shell-wide shrink-0 px-4 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6 xl:px-8">
            <header className="surface-card flex h-16 items-center px-4 md:px-6">
              <div className="flex w-full items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label={isZh ? '打开导航菜单' : 'Open navigation menu'}
                  aria-expanded={isMobileMenuOpen}
                  onClick={() => setIsMobileMenuOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="min-w-0 flex-1">
                  <Navbar />
                </div>
              </div>
            </header>
          </div>

          {import.meta.env.VITE_DEMO_MODE === true && (
            <div
              className="content-shell-wide shrink-0 px-4 pb-3 text-xs text-[var(--accent)] md:px-6 xl:px-8"
              data-testid="demo-mode-badge"
            >
              {isZh
                ? '演示环境 · 节点、用量与账号均为示例数据'
                : 'Demo environment · nodes, usage and accounts are sample data'}
            </div>
          )}
          <main
            className="min-h-0 flex-1 overflow-x-clip overflow-y-auto"
            style={{ scrollbarGutter: 'stable' }}
          >
            {/* Route key remounts the wrapper so the enter animation plays on
                each navigation. We drop the exit animation that AnimatePresence
                used to provide — the new route renders immediately. */}
            <div
              key={location.pathname + location.search}
              className="anim-route-enter overflow-x-clip"
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
