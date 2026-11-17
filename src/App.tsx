/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AttendanceView } from './components/AttendanceView';
import { DashboardView } from './components/DashboardView';
import { ExamResultsView } from './components/ExamResultsView';
import { FeesView } from './components/FeesView';
import { LoginScreen } from './components/LoginScreen';
import { ReportsView } from './components/ReportsView';
import { Sidebar } from './components/Sidebar';
import { StudentRegistrationView } from './components/StudentRegistrationView';
import { TopBar } from './components/TopBar';
import {
  INITIAL_ACTIVITY_LOGS,
  INITIAL_ATTENDANCE,
  INITIAL_ATTENDANCE_HISTORY,
  INITIAL_EXAMS,
  INITIAL_FEES,
  INITIAL_NOTIFICATIONS,
  INITIAL_STUDENTS,
} from './data/seedData';
import type {
  ActivityLogItem,
  AttendanceHistoryEntry,
  AttendanceRecord,
  AttendanceStatus,
  AuthSession,
  CourseName,
  ExamResult,
  FeeLedger,
  ModuleTab,
  NotificationItem,
  PaymentMethod,
  ProgramType,
  RegisteredUser,
  ShiftType,
  Student,
  UserRole,
} from './types/sms';
import {
  AUTHORIZED_STAFF_ACCOUNTS,
  updateAccountPassword,
} from './utils/authAccounts';
import {
  buildAuthSession,
  calculateDashboardKPIs,
  computeExamStatus,
  generateStudentId,
  parseReceivedAmount,
} from './utils/smsCalculations';

const STORAGE_KEY = 'absms_state_v1';

interface PersistedState {
  session: AuthSession | null;
  authorizedUsers: RegisteredUser[];
  activeTab: ModuleTab;
  students: Student[];
  attendance: AttendanceRecord[];
  attendanceHistory: AttendanceHistoryEntry[];
  exams: ExamResult[];
  fees: FeeLedger[];
  activityLogs: ActivityLogItem[];
  notifications: NotificationItem[];
}

function loadInitialState(): PersistedState {
  const params = new URLSearchParams(window.location.search);
  const autostart = params.get('autostart') === '1';

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const session =
        parsed.session ??
        (autostart ? buildAuthSession('Admin', 'admin albushra', true) : null);
      return {
        session:
          autostart && !session
            ? buildAuthSession('Admin', 'admin albushra', true)
            : session,
        authorizedUsers:
          parsed.authorizedUsers && parsed.authorizedUsers.length === 3
            ? parsed.authorizedUsers
            : AUTHORIZED_STAFF_ACCOUNTS,
        activeTab: parsed.activeTab ?? 'dashboard',
        students: (parsed.students ?? INITIAL_STUDENTS).map((s) => ({
          ...s,
          program: s.program === 'Crush Program' ? 'Crush Program' : 'Normal Program',
          courses: (s.courses ?? [
            'MS-Word',
            'MS-Excel',
            'MS-Access',
            'MS-PowerPoint',
            'Introduction to Windows',
            'MS-Publisher',
          ]).map((c) =>
            (c as string) === 'MS-Outlook' ? 'Introduction to Windows' : c
          ),
        })),
        attendance: (parsed.attendance ?? INITIAL_ATTENDANCE).map((a) => ({
          ...a,
          program: a.program === 'Crush Program' ? 'Crush Program' : 'Normal Program',
        })),
        attendanceHistory: parsed.attendanceHistory ?? INITIAL_ATTENDANCE_HISTORY,
        exams: parsed.exams ?? INITIAL_EXAMS,
        fees: (parsed.fees ?? INITIAL_FEES).map((f) => ({
          ...f,
          paymentMethod: f.paymentMethod ?? 'Cash',
          receivedAmount:
            f.receivedAmount !== undefined
              ? f.receivedAmount
              : f.paid && f.amount > 0
                ? `$${f.amount}`
                : '',
        })),
        activityLogs: parsed.activityLogs ?? INITIAL_ACTIVITY_LOGS,
        notifications: parsed.notifications ?? INITIAL_NOTIFICATIONS,
      };
    }
  } catch {
    // Fallback to deterministic seed state
  }

  return {
    session: autostart
      ? buildAuthSession('Admin', 'admin albushra', true)
      : null,
    authorizedUsers: AUTHORIZED_STAFF_ACCOUNTS,
    activeTab: 'dashboard',
    students: INITIAL_STUDENTS,
    attendance: INITIAL_ATTENDANCE,
    attendanceHistory: INITIAL_ATTENDANCE_HISTORY,
    exams: INITIAL_EXAMS,
    fees: INITIAL_FEES,
    activityLogs: INITIAL_ACTIVITY_LOGS,
    notifications: INITIAL_NOTIFICATIONS,
  };
}

export default function App() {
  const [initialState] = useState<PersistedState>(() => loadInitialState());
  const [session, setSession] = useState<AuthSession | null>(initialState.session);
  const [authorizedUsers, setAuthorizedUsers] = useState<RegisteredUser[]>(
    initialState.authorizedUsers
  );
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialState.activeTab);
  const [students, setStudents] = useState<Student[]>(initialState.students);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(
    initialState.attendance
  );
  const [attendanceHistory, setAttendanceHistory] = useState<
    AttendanceHistoryEntry[]
  >(initialState.attendanceHistory);
  const [exams, setExams] = useState<ExamResult[]>(initialState.exams);
  const [fees, setFees] = useState<FeeLedger[]>(initialState.fees);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>(
    initialState.activityLogs
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    initialState.notifications
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const toSave: PersistedState = {
        session: session?.keepSignedIn ? session : null,
        authorizedUsers,
        activeTab,
        students,
        attendance,
        attendanceHistory,
        exams,
        fees,
        activityLogs,
        notifications,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    session,
    authorizedUsers,
    activeTab,
    students,
    attendance,
    attendanceHistory,
    exams,
    fees,
    activityLogs,
    notifications,
  ]);

  const kpis = useMemo(
    () =>
      calculateDashboardKPIs(
        students,
        attendance,
        exams,
        fees,
        INITIAL_ATTENDANCE,
        INITIAL_EXAMS
      ),
    [students, attendance, exams, fees]
  );

  const nowTimeLabel = () => {
    const now = new Date();
    return `Today, ${now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  const handleLogin = (
    role: UserRole,
    username: string,
    keepSignedIn: boolean,
    fullName?: string
  ) => {
    const newSession = buildAuthSession(role, username, keepSignedIn, fullName);
    setSession(newSession);
    setActiveTab('dashboard');
  };

  const handleResetPassword = (role: UserRole, newPassword: string) => {
    setAuthorizedUsers((prev) => updateAccountPassword(prev, role, newPassword));
  };

  const handleLogout = () => {
    setSession(null);
    setSearchQuery('');
    setMobileMenuOpen(false);
  };

  const handleRegisterStudent = (payload: {
    name: string;
    shift: ShiftType;
    program: ProgramType;
    courses: CourseName[];
    phone: string;
  }): Student => {
    const id = generateStudentId(students);
    const created: Student = {
      id,
      name: payload.name,
      shift: payload.shift,
      program: payload.program,
      courses: payload.courses,
      phone: payload.phone,
      enrolledDate: '2026-11-17',
      status: 'Active',
    };
    setStudents((prev) => [created, ...prev]);
    setAttendance((prev) => [
      {
        studentId: created.id,
        studentName: created.name,
        shift: created.shift,
        program: created.program,
        status: 'Present',
      },
      ...prev,
    ]);
    const newLog: ActivityLogItem = {
      id: `LOG-${Date.now()}`,
      timestamp: nowTimeLabel(),
      studentId: created.id,
      studentName: created.name,
      actionType: 'New Admission',
      details: `${created.shift} • ${created.program} (${created.courses.join(', ')})`,
      staffRole: session?.displayRole ?? 'Administration',
      status: 'Active',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
    setNotifications((prev) => [
      {
        id: `N-${Date.now()}`,
        title: `New admission ${created.id} (${created.name}) enrolled`,
        time: 'Just now',
        read: false,
      },
      ...prev,
    ]);
    return created;
  };

  const handleDeleteStudent = (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setAttendance((prev) => prev.filter((a) => a.studentId !== studentId));
    setFees((prev) => prev.filter((f) => f.studentId !== studentId));
    setExams((prev) => prev.filter((ex) => ex.studentId !== studentId));
  };

  const handleUpdateAttendance = (
    studentId: string,
    status: AttendanceStatus,
    note?: string
  ) => {
    setAttendance((prev) =>
      prev.map((rec) => {
        if (rec.studentId !== studentId) return rec;
        return {
          ...rec,
          status,
          note: note !== undefined ? note : rec.note ?? '',
        };
      })
    );
  };

  const handleSaveRollCall = () => {
    const first = attendance[0];
    if (!first) return;
    const staffLabel = session?.displayRole ?? 'Administration';
    const todayEntries: AttendanceHistoryEntry[] = attendance.map((rec) => ({
      id: `AH-1117-${rec.studentId}`,
      date: '2026-11-17',
      dateLabel: 'Today, Nov 17, 2026',
      studentId: rec.studentId,
      studentName: rec.studentName,
      shift: rec.shift,
      program: rec.program,
      status: rec.status,
      excuseReason: rec.note?.trim() ? rec.note.trim() : undefined,
      recordedBy: staffLabel,
    }));

    setAttendanceHistory((prev) => [
      ...todayEntries,
      ...prev.filter((entry) => entry.date !== '2026-11-17'),
    ]);

    const excusedCount = attendance.filter((a) => a.status === 'Excused').length;
    const absentCount = attendance.filter((a) => a.status === 'Absent').length;
    const presentCount = attendance.filter((a) => a.status === 'Present').length;
    const newLog: ActivityLogItem = {
      id: `LOG-${Date.now()}`,
      timestamp: nowTimeLabel(),
      studentId: first.studentId,
      studentName: first.studentName,
      actionType: 'Attendance',
      details: `Roll Call Synced: ${presentCount} Present, ${excusedCount} Excused, ${absentCount} Absent`,
      staffRole: staffLabel,
      status: 'Completed',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  const handleAddExamResult = (payload: {
    studentId: string;
    course: CourseName;
    score: number;
  }): ExamResult => {
    const student = students.find((s) => s.id === payload.studentId);
    const studentName = student?.name ?? 'Student';
    const status = computeExamStatus(payload.score);
    const created: ExamResult = {
      id: `EX-${Date.now()}`,
      studentId: payload.studentId,
      studentName,
      course: payload.course,
      score: payload.score,
      status,
      gradedBy: session?.displayRole ?? 'Teacher (Hassan)',
      date: '2026-11-17',
    };
    setExams((prev) => [created, ...prev]);
    const newLog: ActivityLogItem = {
      id: `LOG-${Date.now()}`,
      timestamp: nowTimeLabel(),
      studentId: created.studentId,
      studentName: created.studentName,
      actionType: 'Exam Scored',
      details: `${created.course}: Grade ${created.score} (${created.status})`,
      staffRole: session?.displayRole ?? 'Teacher (Hassan)',
      status: 'Completed',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
    return created;
  };

  const handleToggleFeePayment = (ledgerId: string) => {
    const target = fees.find((f) => f.id === ledgerId);
    if (!target) return;
    const nextPaid = !target.paid;
    const fallbackReceived =
      target.receivedAmount.trim() ||
      (target.amount > 0 ? `$${target.amount}` : '');
    setFees((prev) =>
      prev.map((f) =>
        f.id === ledgerId
          ? {
              ...f,
              paid: nextPaid,
              receivedAmount: nextPaid ? fallbackReceived : f.receivedAmount,
              cashier: nextPaid ? session?.displayRole ?? 'Cashier (Mariam)' : undefined,
            }
          : f
      )
    );
    if (nextPaid) {
      const displayReceived = fallbackReceived || '$0';
      const newLog: ActivityLogItem = {
        id: `LOG-${Date.now()}`,
        timestamp: nowTimeLabel(),
        studentId: target.studentId,
        studentName: target.studentName,
        actionType: 'Fee Payment',
        details: `${target.courses} (${target.paymentMethod} • ${displayReceived} Paid)`,
        staffRole: session?.displayRole ?? 'Cashier (Mariam)',
        status: 'Verified',
      };
      setActivityLogs((prev) => [newLog, ...prev]);
    }
  };

  const handleUpdateFeePaymentMethod = (
    ledgerId: string,
    paymentMethod: PaymentMethod
  ) => {
    setFees((prev) =>
      prev.map((f) => (f.id === ledgerId ? { ...f, paymentMethod } : f))
    );
  };

  const handleUpdateFeeReceived = (ledgerId: string, receivedAmount: string) => {
    const numericAmount = parseReceivedAmount(receivedAmount);
    setFees((prev) =>
      prev.map((f) =>
        f.id === ledgerId
          ? { ...f, receivedAmount, amount: numericAmount }
          : f
      )
    );
  };

  const handleUpdateFeeCashier = (ledgerId: string, cashier: string) => {
    setFees((prev) =>
      prev.map((f) => (f.id === ledgerId ? { ...f, cashier } : f))
    );
  };

  const handleCreateLedger = (payload: {
    studentId: string;
    courses: string;
    paymentMethod: PaymentMethod;
    receivedAmount: string;
    cashier: string;
    paid: boolean;
  }) => {
    const student = students.find((s) => s.id === payload.studentId);
    const numericAmount = parseReceivedAmount(payload.receivedAmount);
    const cleanReceived = payload.receivedAmount.trim();
    const cleanCashier =
      payload.cashier.trim() ||
      (payload.paid ? session?.displayRole ?? 'Cashier (Mariam)' : '');
    const created: FeeLedger = {
      id: `FEE-${Date.now()}`,
      studentId: payload.studentId,
      studentName: student?.name ?? 'Student',
      courses: payload.courses,
      amount: numericAmount,
      paymentMethod: payload.paymentMethod,
      receivedAmount: cleanReceived,
      paid: payload.paid,
      submitted: true,
      dueDate: '2026-11-17',
      cashier: cleanCashier || undefined,
    };
    setFees((prev) => [created, ...prev]);
    if (payload.paid) {
      const displayReceived = cleanReceived || `$${numericAmount}`;
      const newLog: ActivityLogItem = {
        id: `LOG-${Date.now()}`,
        timestamp: nowTimeLabel(),
        studentId: created.studentId,
        studentName: created.studentName,
        actionType: 'Fee Payment',
        details: `${created.courses} (${created.paymentMethod} • ${displayReceived} Paid)`,
        staffRole: cleanCashier || session?.displayRole || 'Cashier (Mariam)',
        status: 'Verified',
      };
      setActivityLogs((prev) => [newLog, ...prev]);
    }
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (!session) {
    return (
      <LoginScreen
        authorizedUsers={authorizedUsers}
        onLogin={handleLogin}
        onResetPassword={handleResetPassword}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Desktop Left Sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          session={session}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex h-full">
            <Sidebar
              activeTab={activeTab}
              onSelectTab={(tab) => {
                setActiveTab(tab);
                setMobileMenuOpen(false);
              }}
              session={session}
              onLogout={handleLogout}
            />
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setMobileMenuOpen(false)}
              className="ml-2 mt-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 shadow-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Nav Toggle Strip */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 md:hidden">
          <div className="flex items-center gap-2">
            <img
              src="/assets/al-bushra-logo.png"
              alt="Al-Bushra"
              className="h-10 w-28 object-contain"
            />
            <span className="text-[13px] font-bold text-[#0F172A]">ABSMS</span>
          </div>
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        <TopBar
          activeTab={activeTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
        />

        <main className="flex-1">
          {activeTab === 'dashboard' && (
            <DashboardView
              kpis={kpis}
              activityLogs={activityLogs}
              searchQuery={searchQuery}
              onNavigate={setActiveTab}
            />
          )}
          {activeTab === 'registration' && (
            <StudentRegistrationView
              students={students}
              searchQuery={searchQuery}
              onRegisterStudent={handleRegisterStudent}
              onDeleteStudent={handleDeleteStudent}
            />
          )}
          {activeTab === 'attendance' && (
            <AttendanceView
              records={attendance}
              history={attendanceHistory}
              searchQuery={searchQuery}
              onUpdateAttendance={handleUpdateAttendance}
              onSaveRollCall={handleSaveRollCall}
            />
          )}
          {activeTab === 'exams' && (
            <ExamResultsView
              students={students}
              exams={exams}
              searchQuery={searchQuery}
              onAddExamResult={handleAddExamResult}
            />
          )}
          {activeTab === 'fees' && (
            <FeesView
              students={students}
              ledgers={fees}
              searchQuery={searchQuery}
              onTogglePayment={handleToggleFeePayment}
              onUpdatePaymentMethod={handleUpdateFeePaymentMethod}
              onUpdateReceived={handleUpdateFeeReceived}
              onUpdateCashier={handleUpdateFeeCashier}
              onCreateLedger={handleCreateLedger}
            />
          )}
          {activeTab === 'reports' && (
            <ReportsView
              kpis={kpis}
              students={students}
              exams={exams}
              fees={fees}
            />
          )}
        </main>
      </div>
    </div>
  );
}
