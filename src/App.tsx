/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { Cloud, Menu, RefreshCw, X } from 'lucide-react';
import { AttendanceView } from './components/AttendanceView';
import { DashboardView } from './components/DashboardView';
import { ExamResultsView } from './components/ExamResultsView';
import { FeesView } from './components/FeesView';
import { LoginScreen } from './components/LoginScreen';
import { LivePortalBanner } from './components/LivePortalBanner';
import { OfflineIndicator } from './components/PWAInstallButton';
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
  addExamResultToDb,
  createFeeLedgerToDb,
  deleteStudentCascadeFromDb,
  isAuthorizedCloudAdmin,
  markAllNotificationsReadInDb,
  performMidnightRolloverInDb,
  saveRollCallToHistoryInDb,
  saveStudentAdmissionToDb,
  signInCloudGoogleSession,
  subscribeCloudAuth,
  subscribeSchoolDatabase,
  syncLocalWorkspaceToCloudIfEmpty,
  testConnection,
  updateAttendanceCurrentInDb,
  updateFeeLedgerInDb,
} from './utils/firebaseDb';
import {
  computeMidnightRollover,
  formatActivityTimestamp,
  parseLocalIsoDate,
  toLocalIsoDate,
  useLiveDate,
} from './utils/liveDate';
import {
  buildAuthSession,
  calculateDashboardKPIs,
  compareStudentIdsAsc,
  computeExamStatus,
  generateStudentId,
  parseReceivedAmount,
} from './utils/smsCalculations';

const LEGACY_STORAGE_KEY = 'absms_state_v1';
const STORAGE_KEY = 'absms_state_v2';

interface PersistedState {
  session: AuthSession | null;
  authorizedUsers: RegisteredUser[];
  activeTab: ModuleTab;
  activeRollCallDate: string | null;
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
  const todayIso = toLocalIsoDate();

  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
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
        activeRollCallDate: parsed.activeRollCallDate ?? todayIso,
        students: (parsed.students ?? INITIAL_STUDENTS)
          .map((s) => ({
            ...s,
            program: (s.program === 'Crush Program'
              ? 'Crush Program'
              : 'Normal Program') as ProgramType,
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
          }))
          .sort((a, b) => compareStudentIdsAsc(a.id, b.id)),
        attendance: (parsed.attendance ?? INITIAL_ATTENDANCE)
          .map((a) => ({
            ...a,
            program: (a.program === 'Crush Program'
              ? 'Crush Program'
              : 'Normal Program') as ProgramType,
          }))
          .sort((a, b) => compareStudentIdsAsc(a.studentId, b.studentId)),
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
    // Fallback to clean empty state
  }

  return {
    session: autostart
      ? buildAuthSession('Admin', 'admin albushra', true)
      : null,
    authorizedUsers: AUTHORIZED_STAFF_ACCOUNTS,
    activeTab: 'dashboard',
    activeRollCallDate: todayIso,
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
  const liveDate = useLiveDate();
  const [initialState] = useState<PersistedState>(() => loadInitialState());
  const [session, setSession] = useState<AuthSession | null>(initialState.session);
  const [authorizedUsers, setAuthorizedUsers] = useState<RegisteredUser[]>(
    initialState.authorizedUsers
  );
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialState.activeTab);
  const [activeRollCallDate, setActiveRollCallDate] = useState<string | null>(
    initialState.activeRollCallDate
  );
  const [hasCloudClockDoc, setHasCloudClockDoc] = useState(false);

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

  const [cloudUser, setCloudUser] = useState<FirebaseUser | null>(null);
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const [rolloverNotice, setRolloverNotice] = useState<string | null>(null);
  const [fatalFirestoreError, setFatalFirestoreError] = useState<Error | null>(
    null
  );

  const rolloverInFlightRef = useRef<string | null>(null);

  if (fatalFirestoreError) {
    throw fatalFirestoreError;
  }

  // Startup connection check & Firebase auth subscription
  useEffect(() => {
    void testConnection();
    const unsubAuth = subscribeCloudAuth((user) => {
      setCloudUser(user);
    });
    return () => unsubAuth();
  }, []);

  const localMirrorRef = useRef({
    students,
    attendance,
    attendanceHistory,
    exams,
    fees,
    activityLogs,
    notifications,
    todayIso: liveDate.todayIso,
  });
  localMirrorRef.current = {
    students,
    attendance,
    attendanceHistory,
    exams,
    fees,
    activityLogs,
    notifications,
    todayIso: liveDate.todayIso,
  };

  // Attach real-time Firestore listeners once authorized admin account (fatxipublic@gmail.com) is signed in
  useEffect(() => {
    if (!cloudUser || !isAuthorizedCloudAdmin(cloudUser)) {
      setHasCloudClockDoc(false);
      return;
    }

    let cancelled = false;
    let unsubDb: (() => void) | null = null;

    const initCloudSync = async () => {
      try {
        const snapshot = localMirrorRef.current;
        const migratedCount = await syncLocalWorkspaceToCloudIfEmpty({
          students: snapshot.students,
          attendance: snapshot.attendance,
          attendanceHistory: snapshot.attendanceHistory,
          exams: snapshot.exams,
          fees: snapshot.fees,
          activityLogs: snapshot.activityLogs,
          notifications: snapshot.notifications,
          activeDateIso: snapshot.todayIso,
        });
        if (migratedCount > 0 && !cancelled) {
          setCloudNotice(
            `Uploaded ${migratedCount} local student record(s) to Cloud Firestore (${cloudUser.email ?? 'authorized account'}).`
          );
        }
      } catch (err) {
        if (!cancelled) {
          setFatalFirestoreError(
            err instanceof Error ? err : new Error(String(err))
          );
          return;
        }
      }

      if (cancelled) return;
      unsubDb = subscribeSchoolDatabase(
        cloudUser.uid,
        cloudUser.email ?? '',
        {
          onStudentsChange: (rows) => setStudents(rows),
          onAttendanceChange: (rows) => setAttendance(rows),
          onAttendanceHistoryChange: (rows) => setAttendanceHistory(rows),
          onExamsChange: (rows) => setExams(rows),
          onFeesChange: (rows) => setFees(rows),
          onActivityLogsChange: (rows) => setActivityLogs(rows),
          onNotificationsChange: (rows) => setNotifications(rows),
          onActiveRollCallDateChange: (cloudDate) => {
            setHasCloudClockDoc(cloudDate !== null);
            if (cloudDate) {
              setActiveRollCallDate(cloudDate);
            }
          },
          onError: (err) => setFatalFirestoreError(err),
        }
      );
    };

    void initCloudSync();

    return () => {
      cancelled = true;
      unsubDb?.();
    };
  }, [cloudUser]);

  // Automatic daily / midnight attendance rollover whenever live calendar date advances
  useEffect(() => {
    if (!activeRollCallDate) {
      setActiveRollCallDate(liveDate.todayIso);
      return;
    }
    if (activeRollCallDate === liveDate.todayIso) {
      rolloverInFlightRef.current = null;
      return;
    }

    const transitionKey = `${activeRollCallDate}->${liveDate.todayIso}`;
    if (rolloverInFlightRef.current === transitionKey) {
      return;
    }
    rolloverInFlightRef.current = transitionKey;

    const result = computeMidnightRollover({
      attendance,
      attendanceHistory,
      activeRollCallDate,
      newDateIso: liveDate.todayIso,
      staffLabel: session?.displayRole ?? 'System Daily Rollover',
    });

    if (!result.rolledOver) {
      return;
    }

    setAttendance(result.nextAttendance);
    setAttendanceHistory(result.nextHistory);
    setActiveRollCallDate(liveDate.todayIso);
    setRolloverNotice(
      `New calendar day (${liveDate.fullDateLabel}): ${
        result.archivedEntries.length > 0
          ? `archived ${result.archivedEntries.length} roll call record(s) from ${activeRollCallDate} and `
          : ''
      }prepared a fresh daily attendance roll call.`
    );

    if (cloudUser?.emailVerified) {
      void performMidnightRolloverInDb({
        archivedEntries: result.archivedEntries,
        attendanceStudentIds: attendance.map((a) => a.studentId),
        newDateIso: liveDate.todayIso,
        hasSystemClock: hasCloudClockDoc,
      }).catch((err) => {
        setFatalFirestoreError(
          err instanceof Error ? err : new Error(String(err))
        );
      });
    }
  }, [
    liveDate.todayIso,
    liveDate.fullDateLabel,
    activeRollCallDate,
    attendance,
    attendanceHistory,
    session?.displayRole,
    cloudUser,
    hasCloudClockDoc,
  ]);

  // Persist local mirror cache
  useEffect(() => {
    try {
      const toSave: PersistedState = {
        session: session?.keepSignedIn ? session : null,
        authorizedUsers,
        activeTab,
        activeRollCallDate,
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
    activeRollCallDate,
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
        parseLocalIsoDate(liveDate.todayIso)
      ),
    [students, attendance, exams, fees, liveDate.todayIso]
  );

  const isCloudSynced = isAuthorizedCloudAdmin(cloudUser);

  const handleConnectCloud = async () => {
    setIsConnectingCloud(true);
    setCloudNotice(null);
    try {
      const user = await signInCloudGoogleSession();
      setCloudNotice(
        `Cloud Firestore connected (${user.email ?? 'authorized account'}). Records sync across devices automatically.`
      );
      setTimeout(() => setCloudNotice(null), 5000);
    } catch (err) {
      setCloudNotice(
        err instanceof Error
          ? err.message
          : 'Google sign-in was cancelled before connecting Cloud Database.'
      );
    } finally {
      setIsConnectingCloud(false);
    }
  };

  const nowTimeLabel = () => formatActivityTimestamp(new Date());

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
    const id = generateStudentId(students, liveDate.year);
    const created: Student = {
      id,
      name: payload.name,
      shift: payload.shift,
      program: payload.program,
      courses: payload.courses,
      phone: payload.phone,
      enrolledDate: liveDate.todayIso,
      status: 'Active',
    };
    const attendanceRec: AttendanceRecord = {
      studentId: created.id,
      studentName: created.name,
      shift: created.shift,
      program: created.program,
      status: 'Present',
      note: '',
      rollCallDate: liveDate.todayIso,
    };
    const stamp = Date.now();
    const newLog: ActivityLogItem = {
      id: `LOG-${stamp}`,
      timestamp: nowTimeLabel(),
      date: liveDate.todayIso,
      studentId: created.id,
      studentName: created.name,
      actionType: 'New Admission',
      details: `${created.shift} • ${created.program} (${created.courses.join(', ')})`,
      staffRole: session?.displayRole ?? 'Administration',
      status: 'Active',
    };
    const newNotif: NotificationItem = {
      id: `N-${stamp}`,
      title: `New admission ${created.id} (${created.name}) enrolled`,
      time: nowTimeLabel(),
      date: liveDate.todayIso,
      read: false,
    };

    setStudents((prev) => [...prev, created]);
    setAttendance((prev) => [...prev, attendanceRec]);
    setActivityLogs((prev) => [newLog, ...prev]);
    setNotifications((prev) => [newNotif, ...prev]);

    if (isCloudSynced) {
      void saveStudentAdmissionToDb({
        student: created,
        attendanceRec,
        logItem: newLog,
        notifItem: newNotif,
        activeDateIso: liveDate.todayIso,
        hasSystemClock: hasCloudClockDoc,
      }).catch((err) => {
        setFatalFirestoreError(
          err instanceof Error ? err : new Error(String(err))
        );
      });
    }

    return created;
  };

  const handleDeleteStudent = (studentId: string) => {
    const examIds = exams
      .filter((ex) => ex.studentId === studentId)
      .map((ex) => ex.id);
    const feeIds = fees
      .filter((f) => f.studentId === studentId)
      .map((f) => f.id);

    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setAttendance((prev) => prev.filter((a) => a.studentId !== studentId));
    setFees((prev) => prev.filter((f) => f.studentId !== studentId));
    setExams((prev) => prev.filter((ex) => ex.studentId !== studentId));

    if (isCloudSynced) {
      void deleteStudentCascadeFromDb({
        studentId,
        examIds,
        feeIds,
      }).catch((err) => {
        setFatalFirestoreError(
          err instanceof Error ? err : new Error(String(err))
        );
      });
    }
  };

  const handleUpdateAttendance = (
    studentId: string,
    status: AttendanceStatus,
    note?: string
  ) => {
    const existingRec = attendance.find((r) => r.studentId === studentId);
    const nextNote = note !== undefined ? note : existingRec?.note ?? '';

    setAttendance((prev) =>
      prev.map((rec) => {
        if (rec.studentId !== studentId) return rec;
        return {
          ...rec,
          status,
          note: nextNote,
          rollCallDate: liveDate.todayIso,
        };
      })
    );

    if (isCloudSynced && existingRec) {
      void updateAttendanceCurrentInDb({
        studentId,
        status,
        note: nextNote,
        rollCallDate: liveDate.todayIso,
      }).catch((err) => {
        setFatalFirestoreError(
          err instanceof Error ? err : new Error(String(err))
        );
      });
    }
  };

  const handleSaveRollCall = () => {
    const first = attendance[0];
    if (!first) return;
    const staffLabel = session?.displayRole ?? 'Administration';
    const compactDate = liveDate.todayIso.replace(/-/g, '');
    const todayEntries: AttendanceHistoryEntry[] = attendance.map((rec) => ({
      id: `AH-${compactDate}-${rec.studentId}`,
      date: liveDate.todayIso,
      dateLabel: liveDate.fullDateLabel,
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
      ...prev.filter((entry) => entry.date !== liveDate.todayIso),
    ]);
    setActiveRollCallDate(liveDate.todayIso);

    const excusedCount = attendance.filter((a) => a.status === 'Excused').length;
    const absentCount = attendance.filter((a) => a.status === 'Absent').length;
    const presentCount = attendance.filter((a) => a.status === 'Present').length;
    const newLog: ActivityLogItem = {
      id: `LOG-${Date.now()}`,
      timestamp: nowTimeLabel(),
      date: liveDate.todayIso,
      studentId: first.studentId,
      studentName: first.studentName,
      actionType: 'Attendance',
      details: `Roll Call Synced: ${presentCount} Present, ${excusedCount} Excused, ${absentCount} Absent`,
      staffRole: staffLabel,
      status: 'Completed',
    };
    setActivityLogs((prev) => [newLog, ...prev]);

    if (isCloudSynced) {
      const existingHistoryIds = new Set(attendanceHistory.map((h) => h.id));
      void saveRollCallToHistoryInDb({
        entries: todayEntries,
        existingHistoryIds,
        logItem: newLog,
        rollCallDate: liveDate.todayIso,
        hasSystemClock: hasCloudClockDoc,
      }).catch((err) => {
        setFatalFirestoreError(
          err instanceof Error ? err : new Error(String(err))
        );
      });
    }
  };

  const handleAddExamResult = (payload: {
    studentId: string;
    course: CourseName;
    score: number;
  }): ExamResult => {
    const student = students.find((s) => s.id === payload.studentId);
    const studentName = student?.name ?? 'Student';
    const status = computeExamStatus(payload.score);
    const stamp = Date.now();
    const created: ExamResult = {
      id: `EX-${stamp}`,
      studentId: payload.studentId,
      studentName,
      course: payload.course,
      score: payload.score,
      status,
      gradedBy: session?.displayRole ?? 'Teacher',
      date: liveDate.todayIso,
    };
    const newLog: ActivityLogItem = {
      id: `LOG-${stamp}`,
      timestamp: nowTimeLabel(),
      date: liveDate.todayIso,
      studentId: created.studentId,
      studentName: created.studentName,
      actionType: 'Exam Scored',
      details: `${created.course}: Grade ${created.score} (${created.status})`,
      staffRole: session?.displayRole ?? 'Teacher',
      status: 'Completed',
    };

    setExams((prev) => [created, ...prev]);
    setActivityLogs((prev) => [newLog, ...prev]);

    if (isCloudSynced) {
      void addExamResultToDb({ exam: created, logItem: newLog }).catch((err) => {
        setFatalFirestoreError(
          err instanceof Error ? err : new Error(String(err))
        );
      });
    }

    return created;
  };

  const handleToggleFeePayment = (ledgerId: string) => {
    const target = fees.find((f) => f.id === ledgerId);
    if (!target) return;
    const nextPaid = !target.paid;
    const fallbackReceived =
      target.receivedAmount.trim() ||
      (target.amount > 0 ? `$${target.amount}` : '');
    const nextCashier = nextPaid ? session?.displayRole ?? 'Cashier' : '';

    setFees((prev) =>
      prev.map((f) =>
        f.id === ledgerId
          ? {
              ...f,
              paid: nextPaid,
              receivedAmount: nextPaid ? fallbackReceived : f.receivedAmount,
              cashier: nextCashier || undefined,
            }
          : f
      )
    );

    let newLog: ActivityLogItem | undefined;
    if (nextPaid) {
      const displayReceived = fallbackReceived || '$0';
      newLog = {
        id: `LOG-${Date.now()}`,
        timestamp: nowTimeLabel(),
        date: liveDate.todayIso,
        studentId: target.studentId,
        studentName: target.studentName,
        actionType: 'Fee Payment',
        details: `${target.courses} (${target.paymentMethod} • ${displayReceived} Paid)`,
        staffRole: session?.displayRole ?? 'Cashier',
        status: 'Verified',
      };
      setActivityLogs((prev) => [newLog!, ...prev]);
    }

    if (isCloudSynced) {
      void updateFeeLedgerInDb({
        ledgerId,
        patch: {
          paid: nextPaid,
          receivedAmount: nextPaid ? fallbackReceived : target.receivedAmount,
          cashier: nextCashier,
        },
        logItem: newLog,
        logDate: liveDate.todayIso,
      }).catch((err) => {
        setFatalFirestoreError(
          err instanceof Error ? err : new Error(String(err))
        );
      });
    }
  };

  const handleUpdateFeePaymentMethod = (
    ledgerId: string,
    paymentMethod: PaymentMethod
  ) => {
    setFees((prev) =>
      prev.map((f) => (f.id === ledgerId ? { ...f, paymentMethod } : f))
    );
    if (isCloudSynced) {
      void updateFeeLedgerInDb({
        ledgerId,
        patch: { paymentMethod },
      }).catch((err) => {
        setFatalFirestoreError(
          err instanceof Error ? err : new Error(String(err))
        );
      });
    }
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
    if (isCloudSynced) {
      void updateFeeLedgerInDb({
        ledgerId,
        patch: { receivedAmount, amount: numericAmount },
      }).catch((err) => {
        setFatalFirestoreError(
          err instanceof Error ? err : new Error(String(err))
        );
      });
    }
  };

  const handleUpdateFeeCashier = (ledgerId: string, cashier: string) => {
    setFees((prev) =>
      prev.map((f) => (f.id === ledgerId ? { ...f, cashier } : f))
    );
    if (isCloudSynced) {
      void updateFeeLedgerInDb({
        ledgerId,
        patch: { cashier },
      }).catch((err) => {
        setFatalFirestoreError(
          err instanceof Error ? err : new Error(String(err))
        );
      });
    }
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
      (payload.paid ? session?.displayRole ?? 'Cashier' : '');
    const stamp = Date.now();
    const created: FeeLedger = {
      id: `FEE-${stamp}`,
      studentId: payload.studentId,
      studentName: student?.name ?? 'Student',
      courses: payload.courses,
      amount: numericAmount,
      paymentMethod: payload.paymentMethod,
      receivedAmount: cleanReceived,
      paid: payload.paid,
      submitted: true,
      dueDate: liveDate.todayIso,
      cashier: cleanCashier || undefined,
    };

    let newLog: ActivityLogItem | undefined;
    if (payload.paid) {
      const displayReceived = cleanReceived || `$${numericAmount}`;
      newLog = {
        id: `LOG-${stamp}`,
        timestamp: nowTimeLabel(),
        date: liveDate.todayIso,
        studentId: created.studentId,
        studentName: created.studentName,
        actionType: 'Fee Payment',
        details: `${created.courses} (${created.paymentMethod} • ${displayReceived} Paid)`,
        staffRole: cleanCashier || session?.displayRole || 'Cashier',
        status: 'Verified',
      };
      setActivityLogs((prev) => [newLog!, ...prev]);
    }

    setFees((prev) => [created, ...prev]);

    if (isCloudSynced) {
      void createFeeLedgerToDb({ ledger: created, logItem: newLog }).catch(
        (err) => {
          setFatalFirestoreError(
            err instanceof Error ? err : new Error(String(err))
          );
        }
      );
    }
  };

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (isCloudSynced && unreadIds.length > 0) {
      void markAllNotificationsReadInDb(unreadIds).catch((err) => {
        setFatalFirestoreError(
          err instanceof Error ? err : new Error(String(err))
        );
      });
    }
  };

  if (!session) {
    return (
      <>
        <LoginScreen
          authorizedUsers={authorizedUsers}
          onLogin={handleLogin}
          onResetPassword={handleResetPassword}
          cloudConnected={isCloudSynced}
          cloudEmail={cloudUser?.email}
          isConnectingCloud={isConnectingCloud}
          onConnectCloud={() => {
            void handleConnectCloud();
          }}
          cloudNotice={cloudNotice}
        />
        <OfflineIndicator />
      </>
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
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/src/assets/images/al_bushra_logo_hq_1795190276932.jpg"
              alt="Al-Bushra Management System Logo"
              className="h-11 w-24 shrink-0 rounded-md border border-slate-200/70 bg-white object-contain p-0.5"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold text-[#0F172A]">
                Al-Bushra Management System
              </div>
              <div className="text-[10.5px] font-medium text-slate-500 tabular-nums">
                {liveDate.fullDateLabel}
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setMobileMenuOpen(true)}
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        <TopBar
          activeTab={activeTab}
          liveDate={liveDate}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
          cloudConnected={isCloudSynced}
          cloudEmail={cloudUser?.email}
          isConnectingCloud={isConnectingCloud}
          onConnectCloud={() => {
            void handleConnectCloud();
          }}
        />

        <LivePortalBanner
          cloudConnected={isCloudSynced}
          cloudEmail={cloudUser?.email}
        />

        {/* Cloud Session Prompt (when Firebase Google auth is not yet linked) */}
        {!isCloudSynced && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200/80 bg-[#EFF6FF] px-7 py-2.5 text-[12px] text-[#1E3A8A]">
            <div className="flex items-center gap-2 font-medium">
              <Cloud className="h-4 w-4 shrink-0 text-[#1D4ED8]" />
              <span>
                Connect your authorized Google account to save and synchronize every student, roll call, exam, and fee ledger in the Cloud Firestore database across devices.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleConnectCloud();
              }}
              disabled={isConnectingCloud}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-3.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#172E6E] disabled:opacity-55 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>
                {isConnectingCloud ? 'Connecting Google...' : 'Connect Cloud Database'}
              </span>
            </button>
          </div>
        )}

        {cloudNotice && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-7 py-2 text-[12px] font-medium text-slate-700"
          >
            <span>{cloudNotice}</span>
            <button
              type="button"
              onClick={() => setCloudNotice(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Dismiss cloud message"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {rolloverNotice && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 border-b border-emerald-200 bg-[#ECFDF5] px-7 py-2.5 text-[12px] font-semibold text-[#059669]"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              <span>{rolloverNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setRolloverNotice(null)}
              className="text-[#059669]/75 hover:text-[#059669] cursor-pointer"
              aria-label="Dismiss daily rollover notice"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

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
              liveDate={liveDate}
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
              liveDate={liveDate}
              students={students}
              exams={exams}
              fees={fees}
            />
          )}
        </main>
      </div>
      <OfflineIndicator />
    </div>
  );
}
