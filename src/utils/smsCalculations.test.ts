import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDashboardKPIs,
  computeExamStatus,
  filterActivityLog,
  generateStudentId,
  parseReceivedAmount,
  validateLoginCredentials,
} from './smsCalculations';
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

  const kpis = calculateDashboardKPIs([firstStudent], att, exams, fees);
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
    [{ ...fees[0], paid: true }]
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

  const yesterday = filterAttendanceHistory(history, 'yesterday', '', 'All');
  assert.equal(yesterday.length, 1);
  assert.equal(yesterday[0].date, '2026-11-16');

  const monthly = filterAttendanceHistory(history, 'monthly', '', 'All');
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
