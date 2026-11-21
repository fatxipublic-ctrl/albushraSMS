import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Globe } from 'lucide-react';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  LIVE_PORTAL_URL,
} from '../utils/firebaseDb';
import { useOnlineStatus } from '../utils/usePWAInstall';

interface LivePortalBannerProps {
  cloudConnected: boolean;
  cloudEmail?: string | null;
  compact?: boolean;
}

export const LivePortalBanner: React.FC<LivePortalBannerProps> = ({
  cloudConnected,
  cloudEmail,
  compact = false,
}) => {
  const isOnline = useOnlineStatus();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(LIVE_PORTAL_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (compact) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Globe className="h-3.5 w-3.5 shrink-0 text-[#1E3A8A]" />
            <span className="text-[11.5px] font-semibold text-slate-700 whitespace-nowrap shrink-0">
              Live Portal Link
            </span>
          </div>
          <span
            className={`text-[11px] font-medium ${
              isOnline ? 'text-[#059669]' : 'text-[#D97706]'
            } whitespace-nowrap shrink-0`}
          >
            {isOnline
              ? cloudConnected
                ? `Synced · ${cloudEmail ?? BOOTSTRAPPED_ADMIN_EMAIL}`
                : `Online · Admin Sync (${BOOTSTRAPPED_ADMIN_EMAIL})`
              : 'Offline Cache'}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-[#F8FAFC] px-2.5 py-1.5">
          <span className="truncate font-mono text-[11px] text-slate-700 select-all">
            {LIVE_PORTAL_URL}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                void handleCopyLink();
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? (
                <Check className="h-3 w-3 text-[#059669]" />
              ) : (
                <Copy className="h-3 w-3 text-slate-500" />
              )}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </button>
            <a
              href={LIVE_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center gap-1 rounded-md bg-[#1E3A8A] px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#172E6E] whitespace-nowrap shrink-0"
            >
              <span>Open</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/90 bg-white px-7 py-2 text-[12px]">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-slate-600">
        <Globe className="h-3.5 w-3.5 shrink-0 text-[#1E3A8A]" />
        <span className="font-semibold text-[#0F172A] whitespace-nowrap shrink-0">
          Live Web URL:
        </span>
        <span className="truncate font-mono text-[11.5px] text-slate-700 select-all">
          {LIVE_PORTAL_URL}
        </span>
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <span
          className={`font-medium whitespace-nowrap shrink-0 ${
            isOnline ? 'text-[#059669]' : 'text-[#D97706]'
          }`}
        >
          {isOnline
            ? cloudConnected
              ? `Cloud Active (${cloudEmail ?? BOOTSTRAPPED_ADMIN_EMAIL})`
              : `Online · Ready for ${BOOTSTRAPPED_ADMIN_EMAIL}`
            : 'Offline Mode'}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            void handleCopyLink();
          }}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F8FAFC] px-2.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {copied ? (
            <Check className="h-3 w-3 text-[#059669]" />
          ) : (
            <Copy className="h-3 w-3 text-slate-500" />
          )}
          <span>{copied ? 'Copied' : 'Copy Link'}</span>
        </button>
        <a
          href={LIVE_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[#1E3A8A]/25 bg-[#EFF6FF] px-2.5 text-[11px] font-semibold text-[#1E3A8A] transition-colors hover:bg-[#DBEAFE] whitespace-nowrap shrink-0"
        >
          <span>Open Live Portal</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
};
