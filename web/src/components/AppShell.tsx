'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import ModernHeader from '@/components/ModernHeader';
import OnboardingFlow from '@/components/OnboardingFlow';
import AppLogo from '@/components/AppLogo';
import FloatingExpertWidget from '@/components/FloatingExpertWidget';
import { useFarmerProfile } from '@/context/FarmerProfileContext';
import { Leaf } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { profile, isHydrated } = useFarmerProfile();
  const { t } = useLanguage();
  const isMarketing = pathname === '/';
  const showChrome = isHydrated && profile.onboardingCompleted;
  const isAssistant = pathname === '/assistant';
  const hideNav = pathname === '/admin' || pathname === '/scanner' || isAssistant;
  const hideWidget = pathname.startsWith('/community') || pathname === '/scanner' || pathname.startsWith('/marketplace') || pathname === '/profile';

  const showHeader = showChrome && !isAssistant && pathname !== '/scanner';

  if (isMarketing) {
    return <div className="relative min-h-screen">{children}</div>;
  }

  return (
    <div className="mobile-frame-container">
      <div className="mobile-frame">
        {/* Physical Device Elements */}
        {/* Status Bar space removed to resolve notch overlap */}
        <div className="phone-status-bar hidden lg:flex h-6" />

        <div className="absolute inset-0 z-0 pointer-events-none">
          {/* Base light gradient with Soft Peachy Delight & Pastel Bliss undertones */}
          <div
            className="absolute inset-0 dark:hidden"
            style={{
              background:
                'radial-gradient(ellipse 85% 65% at 90% 2%, rgba(254, 215, 170, 0.65) 0%, transparent 68%), radial-gradient(ellipse 75% 55% at 8% 30%, rgba(209, 250, 229, 0.58) 0%, transparent 68%), radial-gradient(ellipse 80% 60% at 88% 72%, rgba(254, 205, 211, 0.52) 0%, transparent 68%), radial-gradient(ellipse 65% 50% at 15% 85%, rgba(233, 213, 255, 0.48) 0%, transparent 68%), linear-gradient(170deg, #fdf6f0 0%, #fbf6ff 38%, #f0fdf4 75%, #f8fafc 100%)',
            }}
          />

          {/* Base dark gradient - rich slate obsidian with glowing ambient mesh */}
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background:
                'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16, 185, 129, 0.16) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 90% 40%, rgba(14, 165, 233, 0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 10% 80%, rgba(245, 158, 11, 0.1) 0%, transparent 60%), linear-gradient(180deg, #0b1322 0%, #080e1a 50%, #050a14 100%)',
            }}
          />

          {/* Noise texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '128px',
            }}
          />
        </div>

        <div className="mobile-content hide-scrollbar">
          {/* ── TOP HEADER ── */}
          {showHeader && <ModernHeader />}

        {/* ── MAIN CONTENT ── */}
        <main className={`relative z-10 flex-1 min-h-0 flex flex-col ${isAssistant ? 'overflow-hidden' : 'overflow-y-auto hide-scrollbar'} ${showChrome && !hideNav && !isAssistant ? 'pb-[110px]' : ''}`}>
          {children}

          {showChrome && !hideNav && (
            <div className="mt-6 flex justify-center items-center gap-2 py-10 opacity-70">
              <Leaf size={12} className="text-emerald-500/80" />
              <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-slate-400">
                {t('pd_suite')}
              </p>
            </div>
          )}
        </main>

        {showChrome && !hideNav && !hideWidget && <FloatingExpertWidget />}
        {showChrome && !hideNav && <BottomNav />}

        {/* ── SPLASH SCREEN ── */}
        {!isHydrated && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="absolute inset-0 z-[120] flex flex-col items-center justify-center bg-white"
          >
            {/* Ambient glow */}
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(16,185,129,0.08) 0%, transparent 60%)',
              }}
            />

            <div className="relative z-10 flex flex-col items-center gap-6">
              {/* Logo with glow ring */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                className="relative"
              >
                <div
                  className="absolute inset-0 rounded-full opacity-40"
                  style={{
                    background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)',
                    filter: 'blur(20px)',
                    transform: 'scale(1.5)',
                  }}
                />
                <AppLogo size={88} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-center"
              >
                <p className="text-3xl font-bold tracking-tight text-slate-900">Plant Doctor</p>
                <p className="mt-2 text-sm font-medium text-slate-400 tracking-wider uppercase">
                  Smart Crop Care Studio
                </p>
              </motion.div>

              {/* Loading bar */}
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="w-48 h-0.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(0,0,0,0.05)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #34d399, #10b981, #059669)',
                    animation: 'progress-bar 1.4s ease-in-out infinite',
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        )}

        {isHydrated && !profile.onboardingCompleted && <OnboardingFlow />}
        </div>
      </div>
    </div>
  );
}
