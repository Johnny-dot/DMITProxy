import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { Button } from '../ui/Button';

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="relative h-svh min-h-screen overflow-hidden text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-9rem] top-[-7rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.74)_0%,_rgba(255,255,255,0)_68%)] blur-2xl" />
        <div className="absolute right-[-10rem] top-[4rem] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(111,154,255,0.32)_0%,_rgba(111,154,255,0)_68%)] blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[18%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(76,205,186,0.24)_0%,_rgba(76,205,186,0)_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full overflow-hidden">
        <div className="hidden p-4 pr-0 md:block">
          <Sidebar />
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 z-[60] bg-[color:var(--overlay)] backdrop-blur-sm md:hidden"
              />
              <motion.div
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="fixed inset-y-4 left-4 z-[70] w-[300px] md:hidden"
              >
                <Sidebar onNavigate={() => setIsMobileMenuOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col pb-4">
          <main
            className="min-h-0 flex-1 overflow-y-auto py-4 md:py-6"
            style={{ scrollbarGutter: 'stable' }}
          >
            <div className="content-shell-wide sticky top-0 z-10 px-4 pb-4 md:px-6 md:pb-6 xl:px-8">
              <header className="surface-card flex h-16 items-center px-4 md:px-6">
                <div className="flex w-full items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
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

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
