import React from 'react';
import {
  Banknote,
  BarChart2,
  CalendarCheck,
  ClipboardCheck,
  LayoutGrid,
  LogOut,
  UserPlus,
} from 'lucide-react';
import type { AuthSession, ModuleTab } from '../types/sms';

interface SidebarProps {
  activeTab: ModuleTab;
  onSelectTab: (tab: ModuleTab) => void;
  session: AuthSession;
  onLogout: () => void;
}

const NAV_ITEMS: {
  id: ModuleTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'registration', label: 'Student Registration', icon: UserPlus },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'exams', label: 'Exam Result Registration', icon: ClipboardCheck },
  { id: 'fees', label: 'Fees', icon: Banknote },
  { id: 'reports', label: 'Reports', icon: BarChart2 },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  session,
  onLogout,
}) => {
  return (
    <aside className="flex w-[224px] shrink-0 flex-col border-r border-slate-200/80 bg-white">
      {/* Brand Lockup */}
      <div className="flex flex-col items-center border-b border-slate-100 px-3.5 py-3.5">
        <div className="flex w-full items-center justify-center rounded-xl border border-slate-200/70 bg-white px-2.5 py-2 shadow-2xs">
          <img
            src="/assets/al-bushra-logo.png"
            alt="Al-Bushra Printing & SMS"
            className="h-[68px] w-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[12.5px] font-bold leading-tight text-[#0F172A]">
            ABSMS
          </span>
          <span className="text-[9.5px] font-bold uppercase tracking-wide text-[#DC2626] leading-tight">
            • PRINTING &amp; SMS
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Main Navigation" className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-[12.5px] font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
              />
              <span className="leading-snug">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Logged-In User Card */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 px-2.5 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1E3A8A] text-[11px] font-bold text-white">
            {session.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#1E3A8A] leading-none">
              LOGGED IN AS:
            </div>
            <div className="mt-1 truncate text-[11.5px] font-semibold text-slate-800 leading-none">
              {session.displayRole}
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
