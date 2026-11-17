import React from 'react';
import { BarChart2, BookOpen, DollarSign, Users } from 'lucide-react';
import type { DashboardKPIs, ExamResult, FeeLedger, Student } from '../types/sms';

interface ReportsViewProps {
  kpis: DashboardKPIs;
  students: Student[];
  exams: ExamResult[];
  fees: FeeLedger[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  kpis,
  students,
  exams,
  fees,
}) => {
  const shiftCounts = [
    {
      label: 'Morning Shift',
      count: students.filter((s) => s.shift === 'Morning Shift').length,
      color: 'bg-[#1E3A8A]',
    },
    {
      label: 'Afternoon Shift',
      count: students.filter((s) => s.shift === 'Afternoon Shift').length,
      color: 'bg-[#059669]',
    },
    {
      label: 'Evening Shift',
      count: students.filter((s) => s.shift === 'Evening Shift').length,
      color: 'bg-[#7C3AED]',
    },
  ];

  const courseStats = (['MS-Word', 'MS-Excel', 'MS-Access', 'MS-PowerPoint'] as const).map(
    (course) => {
      const items = exams.filter((e) => e.course === course);
      const avg =
        items.length > 0
          ? Math.round(items.reduce((s, e) => s + e.score, 0) / items.length)
          : 0;
      return { course, count: items.length, avg };
    }
  );

  const collected = fees
    .filter((f) => f.paid)
    .reduce((sum, f) => sum + f.amount, 0);
  const unpaid = fees
    .filter((f) => !f.paid)
    .reduce((sum, f) => sum + f.amount, 0);

  return (
    <div className="space-y-6 p-7">
      {/* Top Analytical Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-slate-500">
              Active Term Enrollment
            </span>
            <Users className="h-4 w-4 text-[#1D4ED8]" />
          </div>
          <div className="mt-2 text-[24px] font-bold text-[#0F172A] tabular-nums">
            {kpis.totalActiveStudents.toLocaleString()} Students
          </div>
          <div className="mt-1 text-[12px] text-[#059669] font-medium">
            +{kpis.newEnrollmentsThisMonth} admitted in November 2026
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-slate-500">
              Roster Ledger Reconciliation
            </span>
            <DollarSign className="h-4 w-4 text-[#059669]" />
          </div>
          <div className="mt-2 text-[24px] font-bold text-[#0F172A] tabular-nums">
            ${collected.toLocaleString()} Collected
          </div>
          <div className="mt-1 text-[12px] text-[#D97706] font-medium tabular-nums">
            ${unpaid.toLocaleString()} pending in active sample • $
            {kpis.pendingFeeBalance.toLocaleString()} total
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-slate-500">
              MS Office Exam Benchmark
            </span>
            <BookOpen className="h-4 w-4 text-[#7C3AED]" />
          </div>
          <div className="mt-2 text-[24px] font-bold text-[#0F172A] tabular-nums">
            {kpis.examAverage} / 100 Avg
          </div>
          <div className="mt-1 text-[12px] text-[#059669] font-medium tabular-nums">
            {kpis.examPassRate}% pass rate across computer lab exams
          </div>
        </div>
      </div>

      {/* Distribution & Gradebook Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[#1E3A8A]" />
            <h2 className="text-[14.5px] font-bold text-[#0F172A]">
              Shift Distribution (Active Roster Sample)
            </h2>
          </div>
          <div className="mt-5 space-y-4">
            {shiftCounts.map((item) => {
              const pct =
                students.length > 0
                  ? Math.round((item.count / students.length) * 100)
                  : 0;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="font-semibold text-slate-700">
                      {item.label}
                    </span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {item.count} students ({pct}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#7C3AED]" />
            <h2 className="text-[14.5px] font-bold text-[#0F172A]">
              Course Average Performance
            </h2>
          </div>
          <div className="mt-5 space-y-4">
            {courseStats.map((c) => (
              <div key={c.course}>
                <div className="flex justify-between text-[12.5px]">
                  <span className="font-semibold text-slate-700">
                    {c.course}{' '}
                    <span className="font-normal text-slate-400">
                      ({c.count} graded)
                    </span>
                  </span>
                  <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                    {c.avg} / 100
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#1D4ED8]"
                    style={{ width: `${c.avg}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
