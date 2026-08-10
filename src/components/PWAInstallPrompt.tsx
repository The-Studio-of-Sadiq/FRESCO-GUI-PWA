import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, Smartphone, ShieldCheck, Wifi, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [showBanner, setShowBanner] = useState<boolean>(true);
  const [installedNotification, setInstalledNotification] = useState<boolean>(false);

  useEffect(() => {
    // Check standalone mode
    const checkIsStandalone = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsInstalled(!!isStandalone);
    };

    checkIsStandalone();

    // Listen to beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen to appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setInstalledNotification(true);
      setTimeout(() => setInstalledNotification(false), 5000);
    };

    // Listen to network status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === 'accepted') {
      console.log('[PWA] User accepted the installation prompt');
    } else {
      console.log('[PWA] User dismissed the installation prompt');
    }
    setDeferredPrompt(null);
  };

  return (
    <>
      {/* Top Header / Nav PWA Button */}
      <div className="flex items-center gap-2">
        {/* Offline / Online Network Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
            isOnline
              ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-950/80 border-amber-500/40 text-amber-300 animate-pulse'
          }`}
          title={isOnline ? 'Online — PWA Active' : 'Offline — Serving from Service Worker Cache'}
        >
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="hidden lg:inline">{isOnline ? 'ONLINE' : 'OFFLINE MODE'}</span>
        </div>

        {/* PWA Installed Status or Install Button */}
        {isInstalled ? (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-mono font-medium"
            title="FRESCO is running as an installed Progressive Web App"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">PWA INSTALLED</span>
          </div>
        ) : deferredPrompt ? (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold px-3 py-1 rounded-lg shadow-md shadow-cyan-950/50 border border-cyan-300/40 transition cursor-pointer active:scale-95 animate-pulse"
            id="install-pwa-nav-btn"
          >
            <Download className="w-3.5 h-3.5" />
            <span>INSTALL PWA</span>
          </button>
        ) : (
          <button
            onClick={() => {
              alert(
                'To install FRESCO as a desktop/mobile app:\n\n1. In Chrome/Edge: Click the Install icon in the address bar or browser menu.\n2. In Safari (iOS/macOS): Tap Share -> "Add to Home Screen".'
              );
            }}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono px-2.5 py-1 rounded-lg border border-slate-700 transition cursor-pointer"
            title="Install as Progressive Web App"
            id="pwa-info-btn"
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">PWA READY</span>
          </button>
        )}
      </div>

      {/* Floating PWA Install Bottom Banner (if prompt available and not dismissed) */}
      {deferredPrompt && showBanner && !isInstalled && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 rounded-xl p-4 shadow-2xl text-slate-100 ring-1 ring-cyan-500/20 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <img src="/favicon.svg" alt="FRESCO" className="w-10 h-10 rounded-lg bg-[#0B132B] p-1 border border-cyan-500/30 object-contain" />
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                  Install FRESCO App <span className="text-[10px] text-cyan-400 font-mono font-normal">v4.2</span>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Install for offline reaction simulations, desktop shortcut, and standalone window execution.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-slate-400 hover:text-white p-1 rounded-md transition cursor-pointer"
              title="Close banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-800">
            <button
              onClick={() => setShowBanner(false)}
              className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              Not now
            </button>
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-md shadow-cyan-950 transition cursor-pointer active:scale-95"
            >
              <Download className="w-3 h-3" />
              <span>Install Now</span>
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification when Installed */}
      {installedNotification && (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md font-mono text-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold text-emerald-100">FRESCO PWA Installed!</p>
            <p className="text-[11px] text-emerald-300">You can now launch FRESCO directly from your home screen or desktop.</p>
          </div>
        </div>
      )}
    </>
  );
};
