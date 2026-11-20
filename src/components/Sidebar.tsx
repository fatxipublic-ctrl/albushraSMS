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
    <aside className="flex w-[264px] shrink-0 flex-col border-r border-slate-200/90 bg-white">
      {/* Wide Brand Photo Logo & Lower System Name Layer */}
      <div className="border-b border-slate-200/80 p-3.5">
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-center bg-white px-3 pt-3 pb-2.5">
            <img
              src="/src/assets/images/al_bushra_logo_hq_1795190276932.jpg"
              alt="Al-Bushra Management System Logo"
              className="h-[118px] w-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="border-t border-slate-100 bg-[#F8FAFC] px-3 py-2.5 text-center">
            <div className="text-[13px] font-bold leading-snug tracking-tight text-[#0F172A]">
              Al-Bushra Management System
            </div>
            <div className="mt-0.5 text-[10.5px] font-semibold tracking-wide text-[#1E3A8A]">
              ABSMS · Academic &amp; Finance Portal
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Main Navigation" className="flex-1 space-y-1 px-3.5 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-[#0F172A]'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
              />
              <span className="truncate leading-snug">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Logged-In User Card */}
      <div className="border-t border-slate-200/80 p-3.5">
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-[#F8FAFC] px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E3A8A] text-[11px] font-bold text-white">
            {session.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold text-slate-400 leading-none">
              Signed in as
            </div>
            <div className="mt-1 truncate text-[12.5px] font-bold text-[#0F172A] leading-none">
              {session.displayRole}
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-[#DC2626] cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
