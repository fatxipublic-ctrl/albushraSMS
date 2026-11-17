import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Download,
  FileDown,
  FolderOpen,
  Lock,
  Plus,
  UserCheck,
} from 'lucide-react';
import type {
  FeeLedger,
  PaymentMethod,
  Student,
} from '../types/sms';
import {
  buildStudentFeeProfiles,
  filterStudentFeeProfiles,
  type FeeProfileFilter,
} from '../utils/feeProfiles';
import { buildFeeExcelCsv, buildFeePdfBytes } from '../utils/feeReport';
import {
  formatStudentCoursesLabel,
  getStudentFeeCourseOptions,
} from '../utils/studentCourses';

interface FeesViewProps {
  students: Student[];
  ledgers: FeeLedger[];
  searchQuery: string;
  onTogglePayment: (ledgerId: string) => void;
  onUpdatePaymentMethod: (ledgerId: string, method: PaymentMethod) => void;
  onUpdateReceived: (ledgerId: string, receivedAmount: string) => void;
  onUpdateCashier: (ledgerId: string, cashier: string) => void;
  onCreateLedger: (payload: {
    studentId: string;
    courses: string;
    paymentMethod: PaymentMethod;
    receivedAmount: string;
    cashier: string;
    paid: boolean;
  }) => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['Ebirr', 'Kaafi', 'CBE', 'Cash'];

export const FeesView: React.FC<FeesViewProps> = ({
  students,
  ledgers,
  searchQuery,
  onTogglePayment,
  onUpdatePaymentMethod,
  onUpdateReceived,
  onUpdateCashier,
  onCreateLedger,
}) => {
  const initialStudent = students[0];
  const [studentId, setStudentId] = useState(
    initialStudent?.id ?? 'ABC-0001-2026'
  );
  const [selectedCourse, setSelectedCourse] = useState(() =>
    formatStudentCoursesLabel(initialStudent)
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Ebirr');
  const [feeAmount, setFeeAmount] = useState('');
  const [cashierName, setCashierName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid'>('Paid');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<FeeProfileFilter>('All');
  const [activeProfileStudentId, setActiveProfileStudentId] = useState<string>(
    ledgers[0]?.studentId ?? initialStudent?.id ?? 'ABC-0004-2026'
  );

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === studentId) ?? students[0],
    [students, studentId]
  );
  const effectiveStudentId = selectedStudent?.id ?? studentId;

  const courseOptions = useMemo(
    () => getStudentFeeCourseOptions(selectedStudent),
    [selectedStudent]
  );

  const effectiveCourse = courseOptions.includes(selectedCourse)
    ? selectedCourse
    : courseOptions[0];

  const handleStudentChange = (nextStudentId: string) => {
    setStudentId(nextStudentId);
    const nextStudent = students.find((s) => s.id === nextStudentId);
    setSelectedCourse(formatStudentCoursesLabel(nextStudent));
    if (formError) setFormError(null);
  };

  const handleEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentStatus === 'Paid' && !feeAmount.trim()) {
      setFormError('Please enter the Fee Amount before submitting a Paid fee.');
      return;
    }

    setFormError(null);
    onCreateLedger({
      studentId: effectiveStudentId,
      courses: effectiveCourse,
      paymentMethod,
      receivedAmount: feeAmount.trim(),
      cashier: cashierName.trim(),
      paid: paymentStatus === 'Paid',
    });
    setActiveProfileStudentId(effectiveStudentId);
    setFeeAmount('');
    const studentName = selectedStudent?.name ?? effectiveStudentId;
    setSubmitNotice(
      `Added ${effectiveCourse} (${paymentMethod} • ${paymentStatus}) to ${studentName}'s Fee Profile.`
    );
    setTimeout(() => setSubmitNotice(null), 3500);
  };

  const allProfiles = useMemo(
    () => buildStudentFeeProfiles(ledgers, students),
    [ledgers, students]
  );

  const filteredProfiles = useMemo(
    () => filterStudentFeeProfiles(allProfiles, searchQuery, statusFilter),
    [allProfiles, searchQuery, statusFilter]
  );

  const activeProfile = useMemo(
    () =>
      allProfiles.find((p) => p.studentId === activeProfileStudentId) ??
      filteredProfiles[0] ??
      allProfiles[0],
    [allProfiles, filteredProfiles, activeProfileStudentId]
  );

  const paidStudentCount = allProfiles.filter((p) => p.allPaid).length;
  const unpaidStudentCount = allProfiles.filter((p) => !p.allPaid).length;

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

  const handleExportExcel = () => {
    const csv = buildFeeExcelCsv(filteredProfiles);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(
      blob,
      `absms-student-fee-list-${statusFilter.toLowerCase()}.csv`,
      `Exported Excel CSV (${filteredProfiles.length} students).`
    );
  };

  const handleExportPdf = () => {
    const pdfBytes = buildFeePdfBytes(filteredProfiles, statusFilter);
    const blob = new Blob([pdfBytes.slice()], { type: 'application/pdf' });
    triggerDownload(
      blob,
      `absms-student-fee-list-${statusFilter.toLowerCase()}.pdf`,
      `Exported PDF (${filteredProfiles.length} students).`
    );
  };

  return (
    <div className="grid grid-cols-1 gap-5 p-6 xl:grid-cols-[276px_minmax(0,1fr)]">
      {/* Submit Student Fee Form */}
      <section>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7]/80 text-[#D97706]">
              <Banknote className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-[#0F172A]">
                Enroll Course &amp; Submit Fee
              </h2>
              <p className="text-[11px] text-slate-500">
                Submit fee details into student&apos;s fee profile
              </p>
            </div>
          </div>

          <form onSubmit={handleEnroll} className="mt-4 space-y-3.5">
            <div>
              <label
                htmlFor="fee-student"
                className="block text-[12px] font-semibold text-slate-700"
              >
                Student
              </label>
              <select
                id="fee-student"
                value={effectiveStudentId}
                onChange={(e) => handleStudentChange(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-slate-800 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.id} • {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="fee-package"
                className="block text-[12px] font-semibold text-slate-700"
              >
                Courses
              </label>
              <select
                id="fee-package"
                value={effectiveCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-slate-800 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              >
                {courseOptions.map((courseLabel) => (
                  <option key={courseLabel} value={courseLabel}>
                    {courseLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="fee-method"
                  className="block text-[12px] font-semibold text-slate-700"
                >
                  Payment Method
                </label>
                <select
                  id="fee-method"
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12.5px] text-slate-800 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="fee-status"
                  className="block text-[12px] font-semibold text-slate-700"
                >
                  Paid / Unpaid
                </label>
                <select
                  id="fee-status"
                  value={paymentStatus}
                  onChange={(e) => {
                    if (formError) setFormError(null);
                    setPaymentStatus(e.target.value as 'Paid' | 'Unpaid');
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12.5px] text-slate-800 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                >
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="fee-amount"
                  className="block text-[12px] font-semibold text-slate-700"
                >
                  Fee Amount
                </label>
                <input
                  id="fee-amount"
                  type="text"
                  value={feeAmount}
                  onChange={(e) => {
                    if (formError) setFormError(null);
                    setFeeAmount(e.target.value);
                  }}
                  placeholder="e.g. $45"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12.5px] text-slate-800 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="fee-cashier"
                  className="block text-[12px] font-semibold text-slate-700"
                >
                  Cashier
                </label>
                <input
                  id="fee-cashier"
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  placeholder="Cashier name..."
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12.5px] text-slate-800 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                />
              </div>
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] font-medium text-[#DC2626]"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {submitNotice && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3 py-2 text-[11.5px] font-medium text-[#059669]"
              >
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{submitNotice}</span>
              </div>
            )}

            <button
              type="submit"
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1E3A8A] text-[12.5px] font-semibold text-white transition-colors hover:bg-[#172E6E] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Submit Student Fee</span>
            </button>
          </form>
        </div>
      </section>

      {/* Ledgers Table + Read-Only Student Fee Profile */}
      <section className="min-w-0 space-y-5">
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
            <h2 className="text-[14.5px] font-bold text-[#0F172A]">
              Course Fee Ledgers ({filteredProfiles.length} Students)
            </h2>

            <div
              role="tablist"
              aria-label="Filter student fee ledgers"
              className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
            >
              {(
                [
                  { id: 'All', label: `All (${allProfiles.length})` },
                  { id: 'Paid', label: `Paid (${paidStudentCount})` },
                  { id: 'Unpaid', label: `Unpaid (${unpaidStudentCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-[#F8FAFC] text-[11px] font-semibold text-slate-500">
                  <th className="px-2.5 py-3">Student ID / Name</th>
                  <th className="px-2.5 py-3">Paid Courses</th>
                  <th className="px-2.5 py-3">Unpaid Courses</th>
                  <th className="px-2 py-3">Payment Method</th>
                  <th className="px-2 py-3">Fee Amount</th>
                  <th className="px-2 py-3">Cashier</th>
                  <th className="px-2 py-3">Paid / Unpaid</th>
                  <th className="px-2.5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11.5px]">
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-8 text-center text-[13px] text-slate-500"
                    >
                      No student fee ledgers match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((profile) => {
                    const entry = profile.latestEntry;
                    const isSelected =
                      activeProfile?.studentId === profile.studentId;
                    const isLocked = entry.paid || Boolean(entry.submitted);
                    const lockedAmountDisplay = entry.receivedAmount.trim()
                      ? entry.receivedAmount
                      : entry.amount > 0
                        ? `$${entry.amount}`
                        : '—';
                    return (
                      <tr
                        key={profile.studentId}
                        onClick={() =>
                          setActiveProfileStudentId(profile.studentId)
                        }
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#EFF6FF]/60'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="whitespace-nowrap px-2.5 py-2.5">
                          <div className="font-mono text-[10.5px] font-semibold text-[#1E3A8A] tabular-nums">
                            {profile.studentId}
                          </div>
                          <div className="text-[12px] font-semibold text-[#0F172A]">
                            {profile.studentName}
                          </div>
                          <div className="mt-0.5 text-[10px] font-medium text-slate-500 tabular-nums">
                            {profile.entries.length}{' '}
                            {profile.entries.length === 1
                              ? 'course in profile'
                              : 'courses in profile'}
                          </div>
                        </td>
                        <td className="max-w-[130px] px-2.5 py-2.5 leading-snug text-[#059669] font-medium">
                          {profile.paidCoursesSummary ? (
                            profile.paidCoursesSummary
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="max-w-[130px] px-2.5 py-2.5 leading-snug text-slate-600">
                          {profile.unpaidCoursesSummary ? (
                            profile.unpaidCoursesSummary
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td
                          className="whitespace-nowrap px-2 py-2"
                          onClick={
                            isLocked ? undefined : (e) => e.stopPropagation()
                          }
                        >
                          {isLocked ? (
                            <span className="font-medium text-slate-700">
                              {entry.paymentMethod}
                            </span>
                          ) : (
                            <select
                              aria-label={`Payment method for ${profile.studentName}`}
                              value={entry.paymentMethod}
                              onChange={(e) => {
                                setActiveProfileStudentId(profile.studentId);
                                onUpdatePaymentMethod(
                                  entry.id,
                                  e.target.value as PaymentMethod
                                );
                              }}
                              className="h-8 rounded-lg border border-slate-200 bg-white px-1.5 text-[11.5px] font-medium text-slate-700 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15 cursor-pointer"
                            >
                              {PAYMENT_METHODS.map((method) => (
                                <option key={method} value={method}>
                                  {method}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td
                          className="whitespace-nowrap px-2 py-2"
                          onClick={
                            isLocked ? undefined : (e) => e.stopPropagation()
                          }
                        >
                          {isLocked ? (
                            <span className="font-semibold text-[#0F172A] tabular-nums">
                              {lockedAmountDisplay}
                            </span>
                          ) : (
                            <input
                              type="text"
                              aria-label={`Fee amount for ${profile.studentName}`}
                              value={entry.receivedAmount}
                              onChange={(e) => {
                                setActiveProfileStudentId(profile.studentId);
                                onUpdateReceived(entry.id, e.target.value);
                              }}
                              placeholder="Amount..."
                              className="h-8 w-[72px] rounded-lg border border-slate-200 bg-[#F8FAFC] px-2 text-[11.5px] font-semibold text-[#0F172A] tabular-nums placeholder:font-normal placeholder:text-slate-400 focus:border-[#1E3A8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                            />
                          )}
                        </td>
                        <td
                          className="whitespace-nowrap px-2 py-2"
                          onClick={
                            isLocked ? undefined : (e) => e.stopPropagation()
                          }
                        >
                          {isLocked ? (
                            <span className="text-slate-600">
                              {entry.cashier?.trim() || '—'}
                            </span>
                          ) : (
                            <input
                              type="text"
                              aria-label={`Cashier for ${profile.studentName}`}
                              value={entry.cashier ?? ''}
                              onChange={(e) => {
                                setActiveProfileStudentId(profile.studentId);
                                onUpdateCashier(entry.id, e.target.value);
                              }}
                              placeholder="Cashier..."
                              className="h-8 w-[96px] rounded-lg border border-slate-200 bg-[#F8FAFC] px-2 text-[11.5px] font-medium text-slate-700 placeholder:font-normal placeholder:text-slate-400 focus:border-[#1E3A8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                            />
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5">
                          {profile.allPaid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10.5px] font-semibold text-[#059669]">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Paid</span>
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10.5px] font-semibold text-[#D97706]">
                                Unpaid
                              </span>
                              {profile.paidCount > 0 && (
                                <div className="mt-0.5 text-[10px] font-medium text-slate-500 tabular-nums">
                                  {profile.paidCount}/{profile.entries.length}{' '}
                                  Paid
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td
                          className="whitespace-nowrap px-2.5 py-2.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveProfileStudentId(profile.studentId);
                                onTogglePayment(entry.id);
                              }}
                              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                                entry.paid
                                  ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                  : 'bg-[#059669] text-white hover:bg-[#047857]'
                              }`}
                            >
                              {entry.paid ? 'Mark Unpaid' : 'Mark Paid'}
                            </button>
                            <button
                              type="button"
                              aria-label={`Open fee profile for ${profile.studentName}`}
                              onClick={() =>
                                setActiveProfileStudentId(profile.studentId)
                              }
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                                isSelected
                                  ? 'border-[#1E3A8A] bg-[#EFF6FF] text-[#1E3A8A]'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <FolderOpen className="h-3 w-3" />
                              <span>Profile</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Export Document Bar (Excel CSV & PDF of Student Payment List) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-[#F8FAFC] px-4 py-3">
            <div className="text-[12px] text-slate-600 tabular-nums">
              <span className="font-semibold text-[#0F172A]">
                {filteredProfiles.length} student fee{' '}
                {filteredProfiles.length === 1 ? 'record' : 'records'}
              </span>{' '}
              ({paidStudentCount} Paid • {unpaidStudentCount} Unpaid)
              {exportNotice && (
                <span className="ml-3 font-semibold text-[#059669]">
                  • {exportNotice}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={filteredProfiles.length === 0}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#059669]" />
                <span>Export Excel (.csv)</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={filteredProfiles.length === 0}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#172E6E] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Selected Student Fee Profile (Read-Only / Not Editable) */}
        {activeProfile && (
          <section
            aria-label="Student Fee Profile"
            className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-[#F8FAFC]/70 px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#1E3A8A]">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-[#0F172A]">
                    Student Fee Profile —{' '}
                    <span className="font-mono text-[#1E3A8A]">
                      {activeProfile.studentId}
                    </span>{' '}
                    • {activeProfile.studentName}
                  </h3>
                  <p className="mt-0.5 text-[11.5px] text-slate-500">
                    {activeProfile.shift ?? 'Morning Shift'} •{' '}
                    {activeProfile.program ?? 'Normal Program'} •{' '}
                    {activeProfile.paidCount} Paid /{' '}
                    {activeProfile.entries.length} Course{' '}
                    {activeProfile.entries.length === 1 ? 'Entry' : 'Entries'}{' '}
                    in Profile
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-[11.5px]">
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-500">
                  <Lock className="h-3 w-3" />
                  <span>Read-Only Profile</span>
                </span>
                <span className="rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3 py-1 font-semibold text-[#059669] tabular-nums">
                  Total Paid: ${activeProfile.totalPaidAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-[#F8FAFC] text-[11px] font-semibold text-slate-500">
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Payment Method</th>
                    <th className="px-4 py-3">Fee Amount</th>
                    <th className="px-4 py-3">Cashier</th>
                    <th className="px-4 py-3 text-right">Paid / Unpaid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[12px]">
                  {activeProfile.entries.map((item) => {
                    const displayAmount = item.receivedAmount.trim()
                      ? item.receivedAmount
                      : item.amount > 0
                        ? `$${item.amount}`
                        : '—';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="font-semibold text-[#0F172A]">
                            {activeProfile.studentName}
                          </div>
                          <div className="font-mono text-[10.5px] font-semibold text-[#1E3A8A] tabular-nums">
                            {item.studentId}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {item.courses}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500 tabular-nums">
                          {item.dueDate}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                          {item.paymentMethod}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0F172A] tabular-nums">
                          {displayAmount}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {item.cashier?.trim() || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {item.paid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#059669]">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Paid</span>
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-[11px] font-semibold text-[#D97706]">
                              Unpaid
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
    </div>
  );
};
