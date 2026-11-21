import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../utils/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'inline';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'inline',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          void install();
        }}
        className={
          variant === 'sidebar'
            ? 'flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E3A8A]/25 bg-[#EFF6FF] px-3.5 py-2 text-[12px] font-semibold text-[#1E3A8A] transition-colors hover:bg-[#DBEAFE] whitespace-nowrap shrink-0 cursor-pointer'
            : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#1E3A8A]/25 bg-[#EFF6FF] px-3 text-[11.5px] font-semibold text-[#1E3A8A] transition-colors hover:bg-[#DBEAFE] whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'sidebar'
              ? 'flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer'
              : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer'
          }
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <h3
                  id="ios-install-title"
                  className="text-[16px] font-bold text-[#0F172A]"
                >
                  Install ABSMS on iPhone / iPad
                </h3>
                <button
                  type="button"
                  aria-label="Close install instructions"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-slate-600">
                <li>
                  1. Tap the <strong className="text-[#0F172A]">Share</strong>{' '}
                  icon in Safari toolbar.
                </li>
                <li>
                  2. Scroll down and tap{' '}
                  <strong className="text-[#0F172A]">Add to Home Screen</strong>
                  .
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 h-9 w-full rounded-lg bg-[#1E3A8A] text-[12.5px] font-semibold text-white transition-colors hover:bg-[#172E6E] cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-300 bg-[#D97706] px-3.5 py-2 text-[12px] font-semibold text-white shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Offline Mode — Using cached app workspace</span>
    </div>
  );
};
