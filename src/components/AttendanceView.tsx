import React, { useState } from 'react';
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Download,
  FileDown,
  History,
  Search,
  X,
} from 'lucide-react';
import type {
  AttendanceHistoryEntry,
  AttendanceRecord,
  AttendanceStatus,
  ShiftType,
} from '../types/sms';
import {
  buildAttendanceCsv,
  buildAttendancePdfBytes,
  filterAttendanceHistory,
  type AttendanceReportPeriod,
} from '../utils/attendanceReport';

interface AttendanceViewProps {
  records: AttendanceRecord[];
  history: AttendanceHistoryEntry[];
  searchQuery: string;
  onUpdateAttendance: (
    studentId: string,
    status: AttendanceStatus,
    note?: string
  ) => void;
  onSaveRollCall: () => void;
}

const SHIFTS: ('All' | ShiftType)[] = [
  'All',
  'Morning Shift',
  'Afternoon Shift',
  'Evening Shift',
];

const PERIOD_OPTIONS: {
  id: AttendanceReportPeriod;
  label: string;
  subtitle: string;
  filenameSlug: string;
}[] = [
  {
    id: 'yesterday',
    label: 'Yesterday (Nov 16)',
    subtitle: 'Yesterday — Monday, Nov 16, 2026',
    filenameSlug: 'yesterday-2026-11-16',
  },
  {
    id: 'monthly',
    label: 'Monthly (Nov 2026)',
    subtitle: 'Monthly Attendance Report — November 2026',
    filenameSlug: 'monthly-2026-11',
  },
  {
    id: 'today',
    label: 'Today (Nov 17)',
    subtitle: 'Today — Tuesday, Nov 17, 2026',
    filenameSlug: 'today-2026-11-17',
  },
];

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  records,
  history,
  searchQuery,
  onUpdateAttendance,
  onSaveRollCall,
}) => {
  const [shiftFilter, setShiftFilter] = useState<'All' | ShiftType>('All');
  const [studentSearch, setStudentSearch] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [reportPeriod, setReportPeriod] =
    useState<AttendanceReportPeriod>('yesterday');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const combinedSearch = (studentSearch || searchQuery).trim().toLowerCase();
  const filtered = records.filter((r) => {
    const matchShift = shiftFilter === 'All' || r.shift === shiftFilter;
    const matchQuery =
      !combinedSearch ||
      r.studentId.toLowerCase().includes(combinedSearch) ||
      r.studentName.toLowerCase().includes(combinedSearch) ||
      r.program.toLowerCase().includes(combinedSearch) ||
      (r.note ?? '').toLowerCase().includes(combinedSearch);
    return matchShift && matchQuery;
  });

  const presentTotal = records.filter((r) => r.status === 'Present').length;
  const excusedTotal = records.filter((r) => r.status === 'Excused').length;
  const absentTotal = records.filter((r) => r.status === 'Absent').length;

  const handleSave = () => {
    const missingExcuse = records.find(
      (r) => r.status === 'Excused' && !r.note?.trim()
    );
    if (missingExcuse) {
      setValidationError(
        `Please enter the excused reason for ${missingExcuse.studentName} (${missingExcuse.studentId}) before submitting.`
      );
      setSavedNotice(false);
      return;
    }

    setValidationError(null);
    onSaveRollCall();
    setReportPeriod('today');
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3500);
  };

  const filteredHistory = filterAttendanceHistory(
    history,
    reportPeriod,
    studentSearch || searchQuery,
    shiftFilter
  );

  const activePeriodMeta =
    PERIOD_OPTIONS.find((p) => p.id === reportPeriod) ?? PERIOD_OPTIONS[0];

  const historyPresent = filteredHistory.filter(
    (h) => h.status === 'Present'
  ).length;
  const historyExcused = filteredHistory.filter(
    (h) => h.status === 'Excused'
  ).length;
  const historyAbsent = filteredHistory.filter(
    (h) => h.status === 'Absent'
  ).length;

  const triggerDownload = (blob: Blob, filename: string, message: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportNotice(message);
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleExportCsv = () => {
    const csv = buildAttendanceCsv(filteredHistory);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(
      blob,
      `absms-attendance-${activePeriodMeta.filenameSlug}.csv`,
      `Exported CSV (${filteredHistory.length} records) for ${activePeriodMeta.label}.`
    );
  };

  const handleGeneratePdf = () => {
    const pdfBytes = buildAttendancePdfBytes(
      filteredHistory,
      `Attendance Report: ${activePeriodMeta.label}`,
      activePeriodMeta.subtitle
    );
    const blob = new Blob([pdfBytes.slice()], { type: 'application/pdf' });
    triggerDownload(
      blob,
      `absms-attendance-${activePeriodMeta.filenameSlug}.pdf`,
      `Generated PDF report for ${activePeriodMeta.label} (${filteredHistory.length} student records).`
    );
  };

  const statusBadgeClass = (status: AttendanceStatus) => {
    if (status === 'Present') return 'bg-[#ECFDF5] text-[#059669]';
    if (status === 'Excused') return 'bg-[#FEF3C7] text-[#D97706]';
    return 'bg-red-50 text-[#DC2626]';
  };

  const reasonPlaceholder = (status: AttendanceStatus) => {
    if (status === 'Excused') return 'Enter excused reason (required)...';
    if (status === 'Absent') return 'Enter absent reason / note...';
    return 'Enter present note / remark...';
  };

  const reasonInputBorder = (status: AttendanceStatus) => {
    if (status === 'Excused') {
      return 'border-amber-300 bg-amber-50/40 focus:border-[#D97706] focus:ring-[#D97706]/15';
    }
    if (status === 'Absent') {
      return 'border-red-200 bg-red-50/30 focus:border-[#DC2626] focus:ring-[#DC2626]/15';
    }
    return 'border-slate-200 bg-[#F8FAFC] focus:border-[#1E3A8A] focus:ring-[#1E3A8A]/15';
  };

  return (
    <div className="space-y-6 p-7">
      {/* Summary & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#059669]">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#0F172A]">
              Roll Call Sheet — Tuesday, Nov 17, 2026
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500 tabular-nums">
              Active Roster: {presentTotal} Present • {excusedTotal} Excused •{' '}
              {absentTotal} Absent
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Student Name / ID Search Bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              aria-label="Search student by name or ID"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search student name or ID..."
              className={`h-9 w-[230px] rounded-lg border border-slate-200 bg-[#F8FAFC] pl-8 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/10 ${
                studentSearch ? 'pr-7' : 'pr-3'
              }`}
            />
            {studentSearch && (
              <button
                type="button"
                aria-label="Clear student search"
                onClick={() => setStudentSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {SHIFTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setShiftFilter(s)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                  shiftFilter === s
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'All' ? 'All Shifts' : s.replace(' Shift', '')}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={records.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1E3A8A] px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#172E6E] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Submit Roll Call</span>
          </button>
        </div>
      </div>

      {validationError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] font-semibold text-[#DC2626]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {savedNotice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-[#ECFDF5] px-4 py-3 text-[12.5px] font-semibold text-[#059669]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Attendance submitted! Today&apos;s per-student attendance report and
            Dashboard metrics have been updated.
          </span>
        </div>
      )}

      {/* Roll Call Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-[#F8FAFC] text-[11px] font-semibold text-slate-500">
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Absent / Present / Excused Reason</th>
                <th className="px-4 py-3 text-right">Mark Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[12.5px]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-[13px] text-slate-500"
                  >
                    {records.length === 0
                      ? 'No students registered for roll call yet. Admit a student first.'
                      : `No students match \u201C${studentSearch || searchQuery}\u201D.`}
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => (
                  <tr key={rec.studentId} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[12px] font-semibold text-[#1E3A8A] tabular-nums">
                      {rec.studentId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-[#0F172A]">
                      {rec.studentName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                      {rec.shift}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                      {rec.program}
                    </td>
                    <td className="min-w-[240px] px-4 py-2.5">
                      <input
                        type="text"
                        aria-label={`${rec.status} reason for ${rec.studentName}`}
                        value={rec.note ?? ''}
                        onChange={(e) => {
                          if (validationError) setValidationError(null);
                          onUpdateAttendance(
                            rec.studentId,
                            rec.status,
                            e.target.value
                          );
                        }}
                        placeholder={reasonPlaceholder(rec.status)}
                        className={`h-8 w-full rounded-lg border px-2.5 text-[12px] text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 ${reasonInputBorder(
                          rec.status
                        )}`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                        {(
                          ['Present', 'Excused', 'Absent'] as AttendanceStatus[]
                        ).map((status) => {
                          const active = rec.status === status;
                          const activeStyle =
                            status === 'Present'
                              ? 'bg-[#059669] text-white'
                              : status === 'Excused'
                                ? 'bg-[#D97706] text-white'
                                : 'bg-[#DC2626] text-white';
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() => {
                                if (validationError) setValidationError(null);
                                onUpdateAttendance(rec.studentId, status);
                              }}
                              aria-pressed={active}
                              className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors cursor-pointer ${
                                active
                                  ? activeStyle
                                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
                              }`}
                            >
                              {status}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Previous Attendance Report (Per Student) + Export / PDF Footer */}
      <section
        aria-label="Previous Attendance Report"
        className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#1D4ED8]">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[14.5px] font-bold text-[#0F172A]">
                Previous Attendance Report (Per Student)
              </h3>
              <p className="mt-0.5 text-[11.5px] text-slate-500">
                {activePeriodMeta.subtitle} • Includes Present, Absent &amp; Excused
                reasons
              </p>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Attendance Report Period"
            className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={reportPeriod === opt.id}
                onClick={() => setReportPeriod(opt.id)}
                className={`rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition-colors cursor-pointer ${
                  reportPeriod === opt.id
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-[#F8FAFC] text-[11px] font-semibold text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Absent / Present / Excused Reason</th>
                <th className="px-4 py-3 text-right">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[12px]">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-[13px] text-slate-500"
                  >
                    {history.length === 0
                      ? 'No submitted attendance records yet. Submit a roll call above to generate attendance history.'
                      : `No submitted attendance records match the current filter for ${activePeriodMeta.label}.`}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500 tabular-nums">
                      {entry.date}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11.5px] font-semibold text-[#1E3A8A] tabular-nums">
                      {entry.studentId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0F172A]">
                      {entry.studentName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {entry.shift.replace(' Shift', '')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                          entry.status
                        )}`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {entry.excuseReason ? (
                        <span
                          className={
                            entry.status === 'Excused'
                              ? 'font-medium text-amber-800'
                              : entry.status === 'Absent'
                                ? 'font-medium text-red-700'
                                : 'text-slate-700'
                          }
                        >
                          {entry.excuseReason}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-600">
                      {entry.recordedBy}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Export & PDF Generation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-[#F8FAFC] px-5 py-3.5">
          <div className="text-[12px] text-slate-600 tabular-nums">
            <span className="font-semibold text-[#0F172A]">
              {filteredHistory.length} records
            </span>{' '}
            ({historyPresent} Present • {historyExcused} Excused • {historyAbsent}{' '}
            Absent)
            {exportNotice && (
              <span className="ml-3 font-semibold text-[#059669]">
                • {exportNotice}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredHistory.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export CSV ({activePeriodMeta.label})</span>
            </button>

            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={filteredHistory.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1E3A8A] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#172E6E] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Generate PDF ({activePeriodMeta.label})</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
