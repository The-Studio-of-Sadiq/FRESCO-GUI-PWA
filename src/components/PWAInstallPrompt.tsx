import React, { useEffect, useState } from 'react';
import { MonitorDown, WifiOff } from 'lucide-react';
import { Button } from './ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** "Install app" when the browser offers it, and an indicator while offline. */
export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferredPrompt(null);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <>
      {!isOnline && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-amber-800 bg-amber-950/60 px-2 py-0.5 text-xs text-amber-200"
          title="You are offline. Calculations still run in this browser."
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Offline</span>
        </span>
      )}
      {deferredPrompt && (
        <Button variant="ghost" onClick={install} title="Install FRESCO as an app that also works offline" className="px-2">
          <MonitorDown className="w-4 h-4" />
          <span className="hidden sm:inline">Install app</span>
        </Button>
      )}
    </>
  );
};
