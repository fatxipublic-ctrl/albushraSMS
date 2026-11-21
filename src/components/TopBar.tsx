import React, { useState } from 'react';
import {
  Bell,
  Calendar,
  CheckCheck,
  Cloud,
  CloudOff,
  Search,
  X,
} from 'lucide-react';
import type { ModuleTab, NotificationItem } from '../types/sms';
import type { LiveDateSnapshot } from '../utils/liveDate';

interface TopBarProps {
  activeTab: ModuleTab;
  liveDate: LiveDateSnapshot;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  cloudConnected: boolean;
  cloudEmail?: string | null;
  isConnectingCloud?: boolean;
  onConnectCloud: () => void;
}

function getTabTitles(year: number): Record<ModuleTab, { title: string; subtitle: string }> {
  return {
    dashboard: {
      title: 'Main Administrative Dashboard',
      subtitle: `Al-Bushra Management System · System Overview · Term ${year}`,
    },
    registration: {
      title: 'Student Registration & Admissions',
      subtitle: 'Al-Bushra Management System · Enroll Students, Shifts & Courses',
    },
    attendance: {
      title: 'Daily Attendance Roll Call',
      subtitle: 'Al-Bushra Management System · Shift Attendance & History',
    },
    exams: {
      title: 'Exam Result Registration',
      subtitle: 'Al-Bushra Management System · MS Office Course Grading',
    },
    fees: {
      title: 'Fees & Course Enrollment Ledgers',
      subtitle: 'Al-Bushra Management System · Tuition Reconciliation & Profiles',
    },
    reports: {
      title: 'Reports & Institutional Analytics',
      subtitle: 'Al-Bushra Management System · Enrollment, Finance & Gradebook',
    },
  };
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  liveDate,
  searchQuery,
  onSearchChange,
  notifications,
  onMarkAllRead,
  cloudConnected,
  cloudEmail,
  isConnectingCloud = false,
  onConnectCloud,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const headerInfo = getTabTitles(liveDate.year)[activeTab];

  return (
    <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/90 bg-white px-7 py-4">
      <div>
        <h1 className="text-[19px] font-bold leading-tight tracking-tight text-[#0F172A]">
          {headerInfo.title}
        </h1>
        <p className="mt-0.5 text-[12px] font-medium text-slate-500">
          {headerInfo.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Global Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Search student ID, staff, course"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search student ID, staff, course..."
            className={`h-9 w-[240px] lg:w-[268px] rounded-lg border border-slate-200 bg-[#F8FAFC] pl-8 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/10 ${
              searchQuery ? 'pr-7' : 'pr-3'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Cloud Database Sync Button */}
        {cloudConnected ? (
          <div
            title={cloudEmail ? `Firestore synced as ${cloudEmail}` : 'Cloud database active'}
            className="hidden xl:flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3 text-[11.5px] font-semibold text-[#059669] whitespace-nowrap shrink-0"
          >
            <Cloud className="h-3.5 w-3.5 shrink-0" />
            <span>Cloud DB Synced</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConnectCloud}
            disabled={isConnectingCloud}
            className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#1E3A8A]/25 bg-[#EFF6FF] px-3 text-[11.5px] font-semibold text-[#1E3A8A] transition-colors hover:bg-[#DBEAFE] disabled:opacity-55 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CloudOff className="h-3.5 w-3.5 shrink-0" />
            <span>{isConnectingCloud ? 'Connecting...' : 'Connect Cloud DB'}</span>
          </button>
        )}

        {/* Live Date Display */}
        <div
          data-testid="topbar-live-date"
          className="hidden sm:flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 whitespace-nowrap shrink-0 tabular-nums"
        >
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{liveDate.fullDateLabel}</span>
        </div>

        {/* Notifications Button */}
        <div className="relative">
          <button
            type="button"
            aria-label="Notifications"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} unread notifications`}
                className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#DC2626]"
              />
            )}
          </button>

          {notifOpen && (
            <div
              role="region"
              aria-label="System Notifications"
              className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[12.5px] font-bold text-[#0F172A]">
                  Recent Alerts ({unreadCount} unread)
                </span>
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  disabled={unreadCount === 0}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E3A8A] hover:underline disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                >
                  <CheckCheck className="h-3 w-3" />
                  <span>Mark all read</span>
                </button>
              </div>
              {notifications.length === 0 ? (
                <p className="py-5 text-center text-[12px] text-slate-400">
                  No notifications yet.
                </p>
              ) : (
                <ul className="mt-2 max-h-60 divide-y divide-slate-100 overflow-y-auto">
                  {notifications.map((n) => (
                    <li key={n.id} className="py-2 text-[12px]">
                      <div
                        className={
                          n.read
                            ? 'text-slate-500'
                            : 'font-semibold text-slate-800'
                        }
                      >
                        {n.title}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-slate-400">
                        {n.time}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
