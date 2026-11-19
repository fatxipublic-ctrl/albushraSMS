import React, { useState } from 'react';
import { Bell, Calendar, CheckCheck, Search, X } from 'lucide-react';
import type { ModuleTab, NotificationItem } from '../types/sms';

interface TopBarProps {
  activeTab: ModuleTab;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
}

const TAB_TITLES: Record<ModuleTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Main Administrative Dashboard',
    subtitle: 'System Overview • Academic Term 2026',
  },
  registration: {
    title: 'Student Registration & Admissions',
    subtitle: 'Enroll New Students • Shift & Program Assignment',
  },
  attendance: {
    title: 'Daily Attendance Roll Call',
    subtitle: 'Shift & Program Attendance • Academic Term 2026',
  },
  exams: {
    title: 'Exam Result Registration',
    subtitle: 'MS Office Course Grading & Pass/Fail Records',
  },
  fees: {
    title: 'Fees & Course Enrollment Ledgers',
    subtitle: 'Tuition Reconciliation & Payment Verification',
  },
  reports: {
    title: 'Reports & Institutional Analytics',
    subtitle: 'Enrollment, Financial & Gradebook Performance',
  },
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  searchQuery,
  onSearchChange,
  notifications,
  onMarkAllRead,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const headerInfo = TAB_TITLES[activeTab];

  return (
    <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-7 py-3.5">
      <div>
        <h1 className="text-[18px] font-bold leading-tight tracking-tight text-[#0F172A]">
          {headerInfo.title}
        </h1>
        <p className="mt-0.5 text-[11.5px] font-medium text-slate-500">
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
            className={`h-9 w-[268px] rounded-lg border border-slate-200 bg-[#F8FAFC] pl-8 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/10 ${
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

        {/* Date Display */}
        <div className="hidden sm:flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 whitespace-nowrap shrink-0">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>Tuesday, Nov 17, 2026</span>
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
