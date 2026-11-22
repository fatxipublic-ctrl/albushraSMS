import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDashboardKPIs,
  compareStudentIdsAsc,
  computeExamStatus,
  filterActivityLog,
  generateStudentId,
  parseReceivedAmount,
  validateLoginCredentials,
} from './smsCalculations';
import {
  buildLiveDateSnapshot,
  computeMidnightRollover,
} from './liveDate';
import { DIRTY_DOZEN_PAYLOADS } from '../../firestore.rules.test';
import {
  INITIAL_ACTIVITY_LOGS,
  INITIAL_ATTENDANCE,
  INITIAL_ATTENDANCE_HISTORY,
  INITIAL_EXAMS,
  INITIAL_FEES,
  INITIAL_NOTIFICATIONS,
  INITIAL_STUDENTS,
} from '../data/seedData';
import {
  buildAttendanceCsv,
  buildAttendancePdfBytes,
  filterAttendanceHistory,
} from './attendanceReport';
import {
  buildStudentFeeProfiles,
  filterStudentFeeProfiles,
} from './feeProfiles';
import { buildFeeExcelCsv, buildFeePdfBytes } from './feeReport';
import {
  MS_OFFICE_COURSES,
  getStudentFeeCourseOptions,
  getStudentRegisteredCourses,
} from './studentCourses';
import {
  AUTHORIZED_STAFF_ACCOUNTS,
  authenticateUser,
  updateAccountPassword,
} from './authAccounts';
import {
  DEFAULT_RECOVERY_EMAIL,
  buildRecoveryEmailRaw,
  generateRecoveryCode,
  validateRecoveryReset,
} from './recoveryEmail';
import type {
  ActivityLogItem,
  AttendanceHistoryEntry,
  AttendanceRecord,
  ExamResult,
  FeeLedger,
  Student,
} from '../types/sms';

test('initial seed state starts all sections cleanly at 0', () => {
  assert.equal(INITIAL_STUDENTS.length, 0);
  assert.equal(INITIAL_ATTENDANCE.length, 0);
  assert.equal(INITIAL_ATTENDANCE_HISTORY.length, 0);
  assert.equal(INITIAL_EXAMS.length, 0);
  assert.equal(INITIAL_FEES.length, 0);
  assert.equal(INITIAL_ACTIVITY_LOGS.length, 0);
  assert.equal(INITIAL_NOTIFICATIONS.length, 0);

  const kpis = calculateDashboardKPIs(
    INITIAL_STUDENTS,
    INITIAL_ATTENDANCE,
    INITIAL_EXAMS,
    INITIAL_FEES
  );
  assert.equal(kpis.totalActiveStudents, 0);
  assert.equal(kpis.newEnrollmentsThisMonth, 0);
  assert.equal(kpis.attendanceRate, '0.0');
  assert.equal(kpis.presentCount, 0);
  assert.equal(kpis.excusedCount, 0);
  assert.equal(kpis.absentCount, 0);
  assert.equal(kpis.pendingFeeBalance, 0);
  assert.equal(kpis.unpaidLedgersCount, 0);
  assert.equal(kpis.examAverage, '0.0');
  assert.equal(kpis.examPassRate, '0.0');
});

test('KPIs calculate accurately from 0 as students, attendance, exams, and fees are added', () => {
  const firstStudent: Student = {
    id: 'ABC-0001-2026',
    name: 'Nadia Ali',
    shift: 'Morning Shift',
    program: 'Crush Program',
    courses: ['MS-Word', 'MS-Excel'],
    phone: '+252 61 500 0000',
    enrolledDate: '2026-11-17',
    status: 'Active',
  };
  const att: AttendanceRecord[] = [
    {
      studentId: 'ABC-0001-2026',
      studentName: 'Nadia Ali',
      shift: 'Morning Shift',
      program: 'Crush Program',
      status: 'Present',
    },
  ];
  const exams: ExamResult[] = [
    {
      id: 'EX-1',
      studentId: 'ABC-0001-2026',
      studentName: 'Nadia Ali',
      course: 'MS-Word',
      score: 90,
      status: 'Pass',
      gradedBy: 'Teacher',
      date: '2026-11-17',
    },
  ];
  const fees: FeeLedger[] = [
    {
      id: 'FEE-1',
      studentId: 'ABC-0001-2026',
      studentName: 'Nadia Ali',
      courses: 'MS-Word, MS-Excel',
      amount: 180,
      paymentMethod: 'Ebirr',
      receivedAmount: '$180',
      paid: false,
      submitted: true,
      dueDate: '2026-11-17',
    },
  ];

  const kpis = calculateDashboardKPIs(
    [firstStudent],
    att,
    exams,
    fees,
    new Date(2026, 10, 17, 12, 0, 0)
  );
  assert.equal(kpis.totalActiveStudents, 1);
  assert.equal(kpis.newEnrollmentsThisMonth, 1);
  assert.equal(kpis.attendanceRate, '100.0');
  assert.equal(kpis.presentCount, 1);
  assert.equal(kpis.pendingFeeBalance, 180);
  assert.equal(kpis.unpaidLedgersCount, 1);
  assert.equal(kpis.examAverage, '90.0');
  assert.equal(kpis.examPassRate, '100.0');

  const paidKpis = calculateDashboardKPIs(
    [firstStudent],
    att,
    exams,
    [{ ...fees[0], paid: true }],
    new Date(2026, 10, 17, 12, 0, 0)
  );
  assert.equal(paidKpis.pendingFeeBalance, 0);
  assert.equal(paidKpis.unpaidLedgersCount, 0);
});

test('generateStudentId starts at ABC-0001-2026 and increments sequentially', () => {
  assert.equal(generateStudentId([]), 'ABC-0001-2026');
  const first: Student = {
    id: 'ABC-0001-2026',
    name: 'First Student',
    shift: 'Morning Shift',
    program: 'Normal Program',
    courses: ['MS-Word'],
    phone: '+252 61 000 0001',
    enrolledDate: '2026-11-17',
    status: 'Active',
  };
  assert.equal(generateStudentId([first]), 'ABC-0002-2026');

  const third: Student = { ...first, id: 'ABC-0003-2026', name: 'Third Student' };
  const ordered = [third, first].sort((a, b) =>
    compareStudentIdsAsc(a.id, b.id)
  );
  assert.deepEqual(
    ordered.map((s) => s.id),
    ['ABC-0001-2026', 'ABC-0003-2026']
  );
});

test('computeExamStatus enforces 60-point pass threshold', () => {
  assert.equal(computeExamStatus(60), 'Pass');
  assert.equal(computeExamStatus(94), 'Pass');
  assert.equal(computeExamStatus(59), 'Fail');
});

test('filterActivityLog matches student ID, name, details, and staff', () => {
  const sampleLogs: ActivityLogItem[] = [
    {
      id: 'LOG-1',
      timestamp: 'Today, 09:00 AM',
      studentId: 'ABC-0001-2026',
      studentName: 'Fatima Zahra',
      actionType: 'New Admission',
      details: 'Morning Shift • Crush Program',
      staffRole: 'Administration',
      status: 'Active',
    },
    {
      id: 'LOG-2',
      timestamp: 'Today, 09:15 AM',
      studentId: 'ABC-0001-2026',
      studentName: 'Fatima Zahra',
      actionType: 'Fee Payment',
      details: 'MS-Word ($50 Paid)',
      staffRole: 'Cashier',
      status: 'Verified',
    },
  ];
  assert.equal(filterActivityLog(sampleLogs, 'Fatima').length, 2);
  assert.equal(filterActivityLog(sampleLogs, 'Cashier').length, 1);
  assert.equal(filterActivityLog(sampleLogs, 'nonexistent').length, 0);
});

test('validateLoginCredentials rejects empty username or short password', () => {
  assert.equal(validateLoginCredentials('', '123456').valid, false);
  assert.equal(validateLoginCredentials('Teacher', '12').valid, false);
  assert.equal(validateLoginCredentials('Teacher', '@albushra3326').valid, true);
});

test('filterAttendanceHistory filters today, yesterday and monthly records', () => {
  const history: AttendanceHistoryEntry[] = [
    {
      id: 'AH-1',
      date: '2026-11-16',
      dateLabel: 'Yesterday, Nov 16, 2026',
      studentId: 'ABC-0001-2026',
      studentName: 'Fatima Zahra',
      shift: 'Morning Shift',
      program: 'Normal Program',
      status: 'Excused',
      excuseReason: 'Medical appointment slip verified',
      recordedBy: 'Teacher',
    },
    {
      id: 'AH-2',
      date: '2026-11-14',
      dateLabel: 'Sat, Nov 14, 2026',
      studentId: 'ABC-0002-2026',
      studentName: 'Bilal Nour',
      shift: 'Afternoon Shift',
      program: 'Normal Program',
      status: 'Present',
      recordedBy: 'Teacher',
    },
  ];

  const refNov17 = new Date(2026, 10, 17, 12, 0, 0);
  const yesterday = filterAttendanceHistory(
    history,
    'yesterday',
    '',
    'All',
    refNov17
  );
  assert.equal(yesterday.length, 1);
  assert.equal(yesterday[0].date, '2026-11-16');

  const monthly = filterAttendanceHistory(
    history,
    'monthly',
    '',
    'All',
    refNov17
  );
  assert.equal(monthly.length, 2);

  const csv = buildAttendanceCsv(yesterday);
  assert.match(csv, /Medical appointment slip verified/);

  const pdfBytes = buildAttendancePdfBytes(
    yesterday,
    'Attendance Report: Yesterday (Nov 16)',
    'Yesterday - Monday, Nov 16, 2026'
  );
  const pdfString = new TextDecoder().decode(pdfBytes);
  assert.equal(pdfString.startsWith('%PDF-1.4'), true);
  assert.match(pdfString, /Medical appointment slip verified/);
});

test('parseReceivedAmount extracts numeric amounts from fee text', () => {
  assert.equal(parseReceivedAmount('140'), 140);
  assert.equal(parseReceivedAmount('$180'), 180);
  assert.equal(parseReceivedAmount('125.50 USD'), 125.5);
  assert.equal(parseReceivedAmount(''), 0);
  assert.equal(parseReceivedAmount('pending'), 0);
});

test('buildStudentFeeProfiles groups multiple course payments into one student profile and exports CSV/PDF', () => {
  const sampleStudents: Student[] = [
    {
      id: 'ABC-0001-2026',
      name: 'Tariq Yassin',
      shift: 'Morning Shift',
      program: 'Normal Program',
      courses: ['MS-Word', 'MS-Excel', 'MS-Publisher'],
      phone: '+252 61 533 9804',
      enrolledDate: '2026-11-17',
      status: 'Active',
    },
  ];
  const sampleFees: FeeLedger[] = [
    {
      id: 'FEE-1',
      studentId: 'ABC-0001-2026',
      studentName: 'Tariq Yassin',
      courses: 'MS-Excel',
      amount: 45,
      paymentMethod: 'Ebirr',
      receivedAmount: '$45',
      paid: true,
      submitted: true,
      dueDate: '2026-11-17',
      cashier: 'Cashier',
    },
    {
      id: 'FEE-2',
      studentId: 'ABC-0001-2026',
      studentName: 'Tariq Yassin',
      courses: 'MS-Word, MS-Publisher',
      amount: 80,
      paymentMethod: 'Cash',
      receivedAmount: '$80',
      paid: false,
      submitted: true,
      dueDate: '2026-11-17',
    },
  ];

  const profiles = buildStudentFeeProfiles(sampleFees, sampleStudents);
  assert.equal(profiles.length, 1);
  const tariq = profiles[0];
  assert.equal(tariq.entries.length, 2);
  assert.equal(tariq.paidCount, 1);
  assert.equal(tariq.unpaidCount, 1);
  assert.equal(tariq.allPaid, false);
  assert.equal(tariq.paidCoursesSummary, 'MS-Excel');
  assert.equal(tariq.unpaidCoursesSummary, 'MS-Word, MS-Publisher');

  const paidOnly = filterStudentFeeProfiles(profiles, '', 'Paid');
  assert.equal(paidOnly.length, 0);

  const csv = buildFeeExcelCsv(profiles);
  assert.match(
    csv,
    /Paid Courses,Unpaid Courses,Payment Method,Fee Amount,Cashier,Paid \/ Unpaid/
  );
  assert.match(csv, /Tariq Yassin/);

  const pdfBytes = buildFeePdfBytes(profiles, 'All');
  const pdfString = new TextDecoder().decode(pdfBytes);
  assert.equal(pdfString.startsWith('%PDF-1.4'), true);
  assert.match(pdfString, /Tariq Yassin/);
});

test('getStudentRegisteredCourses and getStudentFeeCourseOptions mirror student registration courses', () => {
  const partialStudent: Student = {
    id: 'ABC-0001-2026',
    name: 'Tariq Yassin',
    shift: 'Morning Shift',
    program: 'Normal Program',
    courses: ['MS-Word', 'MS-Publisher'],
    phone: '+252 61 533 9804',
    enrolledDate: '2026-11-17',
    status: 'Active',
  };
  assert.deepEqual(getStudentRegisteredCourses(partialStudent), [
    'MS-Word',
    'MS-Publisher',
  ]);
  assert.deepEqual(getStudentFeeCourseOptions(partialStudent), [
    'MS-Word, MS-Publisher',
    'MS-Word',
    'MS-Publisher',
  ]);

  const fullStudent: Student = {
    ...partialStudent,
    courses: MS_OFFICE_COURSES,
  };
  assert.deepEqual(getStudentRegisteredCourses(fullStudent), MS_OFFICE_COURSES);
  assert.deepEqual(getStudentFeeCourseOptions(fullStudent), [
    'All MS Office Courses',
    ...MS_OFFICE_COURSES,
  ]);
});

test('authenticateUser verifies exact Administration, Teacher, and Cashier credentials only', () => {
  const adminOk = authenticateUser(
    AUTHORIZED_STAFF_ACCOUNTS,
    'admin albushra',
    '@Fate3326#'
  );
  assert.equal(adminOk.ok, true);
  if (adminOk.ok) {
    assert.equal(adminOk.user.role, 'Admin');
    assert.equal(adminOk.user.fullName, 'Administration');
  }

  const teacherOk = authenticateUser(
    AUTHORIZED_STAFF_ACCOUNTS,
    'Teacher',
    '@albushra3326'
  );
  assert.equal(teacherOk.ok, true);
  if (teacherOk.ok) {
    assert.equal(teacherOk.user.role, 'Teacher');
    assert.equal(teacherOk.user.fullName, 'Teacher');
  }

  assert.equal(
    authenticateUser(AUTHORIZED_STAFF_ACCOUNTS, 'Teachers', '@albushra3326').ok,
    false
  );

  const cashierOk = authenticateUser(
    AUTHORIZED_STAFF_ACCOUNTS,
    'Cashier',
    '@albushracash3326'
  );
  assert.equal(cashierOk.ok, true);
  if (cashierOk.ok) {
    assert.equal(cashierOk.user.role, 'Cashier');
    assert.equal(cashierOk.user.fullName, 'Cashier');
  }

  assert.equal(
    authenticateUser(AUTHORIZED_STAFF_ACCOUNTS, 'Teacher', 'wrongpass').ok,
    false
  );
});

test('recovery verification email builds valid MIME payload for fatxipublic@gmail.com and resets password', () => {
  assert.equal(DEFAULT_RECOVERY_EMAIL, 'fatxipublic@gmail.com');
  const code = generateRecoveryCode();
  assert.match(code, /^\d{6}$/);

  const raw = buildRecoveryEmailRaw({
    to: DEFAULT_RECOVERY_EMAIL,
    roleLabel: 'Administration',
    username: 'admin albushra',
    code,
  });
  const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = Buffer.from(base64, 'base64').toString('utf8');
  assert.match(decoded, /To: fatxipublic@gmail\.com/);
  assert.match(decoded, new RegExp(`ABSMS Verification Code: ${code}`));

  assert.equal(
    validateRecoveryReset({
      enteredCode: '000000',
      expectedCode: code,
      newPassword: 'newPass@2026',
      confirmPassword: 'newPass@2026',
    }).ok,
    false
  );

  assert.equal(
    validateRecoveryReset({
      enteredCode: code,
      expectedCode: code,
      newPassword: 'newPass@2026',
      confirmPassword: 'newPass@2026',
    }).ok,
    true
  );

  const updated = updateAccountPassword(
    AUTHORIZED_STAFF_ACCOUNTS,
    'Admin',
    'newPass@2026'
  );
  assert.equal(
    authenticateUser(updated, 'admin albushra', 'newPass@2026').ok,
    true
  );
});

test('liveDate advances automatically from 21 Nov 2026 to 22 Nov 2026 and archives roll call cleanly', () => {
  const nov21 = buildLiveDateSnapshot(new Date(2026, 10, 21, 23, 59, 0));
  assert.equal(nov21.todayIso, '2026-11-21');
  assert.equal(nov21.yesterdayIso, '2026-11-20');
  assert.equal(nov21.fullDateLabel, 'Saturday, Nov 21, 2026');
  assert.equal(nov21.longMonthLabel, 'November 2026');

  const nov22 = buildLiveDateSnapshot(new Date(2026, 10, 22, 0, 1, 0));
  assert.equal(nov22.todayIso, '2026-11-22');
  assert.equal(nov22.yesterdayIso, '2026-11-21');
  assert.equal(nov22.fullDateLabel, 'Sunday, Nov 22, 2026');

  const dec01 = buildLiveDateSnapshot(new Date(2026, 11, 1, 8, 0, 0));
  assert.equal(dec01.todayIso, '2026-12-01');
  assert.equal(dec01.yesterdayIso, '2026-11-30');
  assert.equal(dec01.currentMonthIso, '2026-12');
  assert.equal(dec01.longMonthLabel, 'December 2026');

  const rollCallNov21: AttendanceRecord[] = [
    {
      studentId: 'ABC-0001-2026',
      studentName: 'Nadia Ali',
      shift: 'Morning Shift',
      program: 'Crush Program',
      status: 'Excused',
      note: 'Family appointment',
      rollCallDate: '2026-11-21',
    },
    {
      studentId: 'ABC-0002-2026',
      studentName: 'Omar Hassan',
      shift: 'Evening Shift',
      program: 'Normal Program',
      status: 'Present',
      note: '',
      rollCallDate: '2026-11-21',
    },
  ];

  // Assume ABC-0002-2026 was already submitted earlier on Nov 21
  const existingHistory: AttendanceHistoryEntry[] = [
    {
      id: 'AH-20261121-ABC-0002-2026',
      date: '2026-11-21',
      dateLabel: 'Saturday, Nov 21, 2026',
      studentId: 'ABC-0002-2026',
      studentName: 'Omar Hassan',
      shift: 'Evening Shift',
      program: 'Normal Program',
      status: 'Present',
      recordedBy: 'Teacher',
    },
  ];

  const rollover = computeMidnightRollover({
    attendance: rollCallNov21,
    attendanceHistory: existingHistory,
    activeRollCallDate: '2026-11-21',
    newDateIso: '2026-11-22',
    staffLabel: 'Administration',
  });

  assert.equal(rollover.rolledOver, true);
  // Only un-archived ABC-0001-2026 gets appended without duplicating ABC-0002-2026
  assert.equal(rollover.archivedEntries.length, 1);
  assert.equal(rollover.archivedEntries[0].studentId, 'ABC-0001-2026');
  assert.equal(rollover.archivedEntries[0].date, '2026-11-21');
  assert.equal(rollover.archivedEntries[0].excuseReason, 'Family appointment');
  assert.equal(rollover.nextHistory.length, 2);

  // Today's roll call sheet on Nov 22 starts fresh for all active students
  assert.equal(rollover.nextAttendance.length, 2);
  assert.equal(rollover.nextAttendance[0].rollCallDate, '2026-11-22');
  assert.equal(rollover.nextAttendance[0].status, 'Present');
  assert.equal(rollover.nextAttendance[0].note, '');

  // Filter Yesterday relative to Nov 22 finds both archived Nov 21 records
  const yestFromNov22 = filterAttendanceHistory(
    rollover.nextHistory,
    'yesterday',
    '',
    'All',
    new Date(2026, 10, 22, 9, 0, 0)
  );
  assert.equal(yestFromNov22.length, 2);
});

test('security specification Dirty Dozen payloads cover all 12 adversarial invariants', () => {
  assert.equal(DIRTY_DOZEN_PAYLOADS.length, 12);
  assert.equal(
    DIRTY_DOZEN_PAYLOADS.every((c) => c.expectedOutcome === 'PERMISSION_DENIED'),
    true
  );
});

