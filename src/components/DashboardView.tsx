import React from 'react';
import {
  ArrowRight,
  Banknote,
  BarChart2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  FileText,
  GraduationCap,
  MinusCircle,
  Star,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type { ActivityLogItem, DashboardKPIs, ModuleTab } from '../types/sms';
import { filterActivityLog } from '../utils/smsCalculations';

interface DashboardViewProps {
  kpis: DashboardKPIs;
  activityLogs: ActivityLogItem[];
  searchQuery: string;
  onNavigate: (tab: ModuleTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  kpis,
  activityLogs,
  searchQuery,
  onNavigate,
}) => {
  const filteredLogs = filterActivityLog(activityLogs, searchQuery);

  const actionPillStyle = (action: ActivityLogItem['actionType']) => {
    switch (action) {
      case 'Exam Scored':
        return {
          classes: 'bg-[#EFF6FF] text-[#1D4ED8]',
          icon: GraduationCap,
        };
      case 'Fee Payment':
        return {
          classes: 'bg-[#ECFDF5] text-[#059669]',
          icon: DollarSign,
        };
      case 'New Admission':
        return {
          classes: 'bg-[#F3E8FF] text-[#7C3AED]',
          icon: UserPlus,
        };
      case 'Attendance':
        return {
          classes: 'bg-[#FEF3C7] text-[#D97706]',
          icon: Calendar,
        };
    }
  };

  const statusPillClass = (status: ActivityLogItem['status']) => {
    if (status === 'Excused') {
      return 'bg-[#FEF3C7] text-[#D97706]';
    }
    return 'bg-[#ECFDF5] text-[#059669]';
  };

  return (
    <div className="space-y-6 p-7">
      {/* Row 1: 4 KPI Stat Cards */}
      <section
        aria-label="Key Performance Metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* KPI 1: Total Active Students */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[12px] font-medium text-slate-500">
              Total Active Students
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#1D4ED8]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-[26px] font-bold tracking-tight text-[#0F172A] tabular-nums">
            {kpis.totalActiveStudents.toLocaleString()}
          </div>
          <div className="mt-2 flex items-start gap-1.5 text-[11.5px] font-semibold text-[#059669]">
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>+{kpis.newEnrollmentsThisMonth} new enrollments this month</span>
          </div>
        </div>

        {/* KPI 2: Today's Attendance Rate */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[12px] font-medium text-slate-500">
              Today&apos;s Attendance Rate
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#059669]">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-[26px] font-bold tracking-tight text-[#059669] tabular-nums">
            {kpis.attendanceRate}%
          </div>
          <div className="mt-2 flex items-start gap-1.5 text-[11.5px] font-medium text-slate-600 tabular-nums">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#059669]" />
            <span>
              {kpis.presentCount.toLocaleString()} Present • {kpis.excusedCount} Excused •{' '}
              {kpis.absentCount} Absent
            </span>
          </div>
        </div>

        {/* KPI 3: Pending Fee Balances */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[12px] font-medium text-slate-500">
              Pending Fee Balances
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7]/80 text-[#D97706]">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-[26px] font-bold tracking-tight text-[#D97706] tabular-nums">
            ${kpis.pendingFeeBalance.toLocaleString()}
          </div>
          <div className="mt-2 flex items-start gap-1.5 text-[11.5px] font-medium text-slate-600 tabular-nums">
            <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D97706]" />
            <span>{kpis.unpaidLedgersCount} Unpaid Course Ledgers</span>
          </div>
        </div>

        {/* KPI 4: Recent Exam Averages */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[12px] font-medium text-slate-500">
              Recent Exam Averages
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#1D4ED8]">
              <Star className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-[26px] font-bold tracking-tight text-[#0F172A] tabular-nums">
            {kpis.examAverage} / 100
          </div>
          <div className="mt-2 flex items-start gap-1.5 text-[11.5px] font-semibold text-[#059669] tabular-nums">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{kpis.examPassRate}% Passing Rate (MS Office Exams)</span>
          </div>
        </div>
      </section>

      {/* Row 2: Core Module Quick Actions */}
      <section aria-label="Core Module Quick Actions">
        <div>
          <h2 className="text-[14.5px] font-bold text-[#0F172A]">
            Core Module Quick Actions
          </h2>
          <p className="mt-0.5 text-[11.5px] text-slate-500">
            Direct shortcuts to register, mark attendance, enter grades, or collect fees
          </p>
        </div>

        <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card 1: Student Registration */}
          <button
            type="button"
            onClick={() => onNavigate('registration')}
            className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-[#1D4ED8]/35 hover:shadow-sm cursor-pointer"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#1D4ED8]">
                <UserPlus className="h-4 w-4" />
              </div>
              <h3 className="mt-3.5 text-[13.5px] font-bold text-[#0F172A]">
                Student Registration
              </h3>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                Admit students, assign shifts &amp; programs.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[12px] font-semibold text-[#1D4ED8]">
              <span>Open Module</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>

          {/* Card 2: Attendance */}
          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-[#059669]/35 hover:shadow-sm cursor-pointer"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#059669]">
                <CalendarCheck className="h-4 w-4" />
              </div>
              <h3 className="mt-3.5 text-[13.5px] font-bold text-[#0F172A]">
                Attendance
              </h3>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                Take daily roll call by shift &amp; program.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[12px] font-semibold text-[#059669]">
              <span>Mark Roll Call</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>

          {/* Card 3: Exam Results */}
          <button
            type="button"
            onClick={() => onNavigate('exams')}
            className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-[#1D4ED8]/35 hover:shadow-sm cursor-pointer"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#1D4ED8]">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <h3 className="mt-3.5 text-[13.5px] font-bold text-[#0F172A]">
                Exam Results
              </h3>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                Record course grades and pass/fail marks.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[12px] font-semibold text-[#1D4ED8]">
              <span>Enter Marks</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>

          {/* Card 4: Fees & Enrollment */}
          <button
            type="button"
            onClick={() => onNavigate('fees')}
            className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-[#D97706]/35 hover:shadow-sm cursor-pointer"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FEF3C7]/80 text-[#D97706]">
                <Banknote className="h-4 w-4" />
              </div>
              <h3 className="mt-3.5 text-[13.5px] font-bold text-[#0F172A]">
                Fees &amp; Enrollment
              </h3>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                Enroll MS Office courses &amp; toggle payments.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[12px] font-semibold text-[#D97706]">
              <span>Manage Fees</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>

          {/* Card 5: Reports & Analytics */}
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-[#7C3AED]/35 hover:shadow-sm cursor-pointer"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3E8FF] text-[#7C3AED]">
                <BarChart2 className="h-4 w-4" />
              </div>
              <h3 className="mt-3.5 text-[13.5px] font-bold text-[#0F172A]">
                Reports &amp; Analytics
              </h3>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                Enrollment, financial, &amp; gradebook charts.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[12px] font-semibold text-[#7C3AED]">
              <span>View Analytics</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        </div>
      </section>

      {/* Row 3: Recent Activity Log */}
      <section
        aria-label="Recent Activity Log"
        className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[14.5px] font-bold text-[#0F172A]">
              Recent Activity Log
            </h2>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              Real-time audit trail of administrative, cashier, and teacher operations
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7F3D0]/70 bg-[#ECFDF5] px-3 py-1 text-[11.5px] font-semibold text-[#059669]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" aria-hidden="true" />
            <span>Live Sync</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-[#F8FAFC] text-[11px] font-semibold text-slate-500">
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Student ID / Name</th>
                <th className="px-5 py-3">Module Action</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3">Staff Role</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[12px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-[13px] text-slate-500"
                  >
                    No audit records match &ldquo;{searchQuery}&rdquo;.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const pill = actionPillStyle(log.actionType);
                  const PillIcon = pill.icon;
                  return (
                    <tr
                      key={log.id}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-500 tabular-nums">
                        {log.timestamp}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className="font-semibold text-[#0F172A] tabular-nums">
                          {log.studentId}
                        </span>
                        <span className="mx-1.5 text-slate-400">•</span>
                        <span className="text-slate-600">{log.studentName}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pill.classes}`}
                        >
                          <PillIcon className="h-3 w-3 shrink-0" />
                          <span>{log.actionType}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{log.details}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-700">
                        {log.staffRole}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusPillClass(
                            log.status
                          )}`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
