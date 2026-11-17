import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDashboardKPIs,
  computeExamStatus,
  filterActivityLog,
  generateStudentId,
  validateLoginCredentials,
} from './smsCalculations';
import {
  INITIAL_ACTIVITY_LOGS,
  INITIAL_ATTENDANCE,
  INITIAL_EXAMS,
  INITIAL_FEES,
  INITIAL_STUDENTS,
} from '../data/seedData';

test('baseline KPIs match exact institutional overview values', () => {
  const kpis = calculateDashboardKPIs(
    INITIAL_STUDENTS,
    INITIAL_ATTENDANCE,
    INITIAL_EXAMS,
    INITIAL_FEES,
    INITIAL_ATTENDANCE,
    INITIAL_EXAMS
  );
  assert.equal(kpis.totalActiveStudents, 1248);
  assert.equal(kpis.newEnrollmentsThisMonth, 42);
  assert.equal(kpis.attendanceRate, '94.8');
  assert.equal(kpis.presentCount, 1183);
  assert.equal(kpis.excusedCount, 35);
  assert.equal(kpis.absentCount, 30);
  assert.equal(kpis.pendingFeeBalance, 14850);
  assert.equal(kpis.unpaidLedgersCount, 86);
  assert.equal(kpis.examAverage, '82.6');
  assert.equal(kpis.examPassRate, '88.2');
});

test('KPIs update accurately when adding a student and paying a fee', () => {
  const newStudent = {
    id: 'ABC-0017-2026',
    name: 'Nadia Ali',
    shift: 'Morning Shift' as const,
    program: 'Crush Program' as const,
    courses: ['MS-Word' as const, 'MS-Excel' as const],
    phone: '+252 61 500 0000',
    enrolledDate: '2026-11-17',
    status: 'Active' as const,
  };
  const updatedFees = INITIAL_FEES.map((f) =>
    f.id === 'FEE-303' ? { ...f, paid: true } : f
  );

  const kpis = calculateDashboardKPIs(
    [newStudent, ...INITIAL_STUDENTS],
    INITIAL_ATTENDANCE,
    INITIAL_EXAMS,
    updatedFees,
    INITIAL_ATTENDANCE,
    INITIAL_EXAMS
  );

  assert.equal(kpis.totalActiveStudents, 1249);
  assert.equal(kpis.newEnrollmentsThisMonth, 43);
  assert.equal(kpis.pendingFeeBalance, 14850 - 180);
  assert.equal(kpis.unpaidLedgersCount, 85);
});

test('generateStudentId increments sequential IDs', () => {
  assert.equal(generateStudentId(INITIAL_STUDENTS), 'ABC-0017-2026');
});

test('computeExamStatus enforces 60-point pass threshold', () => {
  assert.equal(computeExamStatus(60), 'Pass');
  assert.equal(computeExamStatus(94), 'Pass');
  assert.equal(computeExamStatus(59), 'Fail');
});

test('filterActivityLog matches student ID, name, course, and staff', () => {
  assert.equal(filterActivityLog(INITIAL_ACTIVITY_LOGS, 'Fatima').length, 1);
  assert.equal(filterActivityLog(INITIAL_ACTIVITY_LOGS, 'Mariam').length, 1);
  assert.equal(filterActivityLog(INITIAL_ACTIVITY_LOGS, 'nonexistent').length, 0);
});

test('validateLoginCredentials rejects empty username or short password', () => {
  assert.equal(validateLoginCredentials('', '123456').valid, false);
  assert.equal(validateLoginCredentials('admin.bushra', '12').valid, false);
  assert.equal(validateLoginCredentials('admin.bushra', 'admin2026').valid, true);
});

import {
  buildAttendanceCsv,
  buildAttendancePdfBytes,
  filterAttendanceHistory,
} from './attendanceReport';
import { INITIAL_ATTENDANCE_HISTORY } from '../data/seedData';
import { parseReceivedAmount } from './smsCalculations';

test('filterAttendanceHistory filters yesterday and monthly records', () => {
  const yesterday = filterAttendanceHistory(
    INITIAL_ATTENDANCE_HISTORY,
    'yesterday',
    '',
    'All'
  );
  assert.equal(yesterday.length, 8);
  assert.equal(
    yesterday.every((entry) => entry.date === '2026-11-16'),
    true
  );

  const monthly = filterAttendanceHistory(
    INITIAL_ATTENDANCE_HISTORY,
    'monthly',
    '',
    'All'
  );
  assert.equal(monthly.length, 12);
});

test('buildAttendanceCsv and buildAttendancePdfBytes include excused reasons', () => {
  const yesterday = filterAttendanceHistory(
    INITIAL_ATTENDANCE_HISTORY,
    'yesterday',
    '',
    'All'
  );
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

test('parseReceivedAmount extracts numeric amounts from editable fee text', () => {
  assert.equal(parseReceivedAmount('140'), 140);
  assert.equal(parseReceivedAmount('$180'), 180);
  assert.equal(parseReceivedAmount('125.50 USD'), 125.5);
  assert.equal(parseReceivedAmount(''), 0);
  assert.equal(parseReceivedAmount('pending'), 0);
});

import {
  buildStudentFeeProfiles,
  filterStudentFeeProfiles,
} from './feeProfiles';

test('buildStudentFeeProfiles groups multiple course payments into one student profile list', () => {
  const secondCourseForTariq = {
    id: 'FEE-999',
    studentId: 'ABC-0012-2026',
    studentName: 'Tariq Yassin',
    courses: 'MS-Excel',
    amount: 45,
    paymentMethod: 'Ebirr' as const,
    receivedAmount: '$45',
    paid: true,
    dueDate: '2026-11-17',
  };
  const profiles = buildStudentFeeProfiles(
    [secondCourseForTariq, ...INITIAL_FEES],
    INITIAL_STUDENTS
  );
  assert.equal(profiles.length, 6);
  const tariq = profiles.find((p) => p.studentId === 'ABC-0012-2026');
  assert.ok(tariq);
  assert.equal(tariq.entries.length, 2);
  assert.equal(tariq.paidCount, 1);
  assert.equal(tariq.unpaidCount, 1);
  assert.equal(tariq.allPaid, false);
  assert.equal(tariq.paidCoursesSummary, 'MS-Excel');
  assert.equal(tariq.unpaidCoursesSummary, 'MS-Word, MS-Publisher');
  assert.match(tariq.coursesSummary, /MS-Excel/);
  assert.match(tariq.coursesSummary, /MS-Word, MS-Publisher/);

  const zeinab = profiles.find((p) => p.studentId === 'ABC-0009-2026');
  assert.ok(zeinab);
  assert.equal(zeinab.paidCoursesSummary, '');
  assert.equal(zeinab.unpaidCoursesSummary, 'All MS Office Courses');

  const paidOnly = filterStudentFeeProfiles(profiles, '', 'Paid');
  assert.equal(paidOnly.every((p) => p.allPaid), true);
  assert.equal(paidOnly.length, 2);
});

import { buildFeeExcelCsv, buildFeePdfBytes } from './feeReport';

test('buildFeeExcelCsv and buildFeePdfBytes include student fee list, paid/unpaid courses, and cashier', () => {
  const profiles = buildStudentFeeProfiles(INITIAL_FEES, INITIAL_STUDENTS);
  const csv = buildFeeExcelCsv(profiles);
  assert.match(csv, /Paid Courses,Unpaid Courses,Payment Method,Fee Amount,Cashier,Paid \/ Unpaid/);
  assert.match(csv, /Cashier \(Mariam\)/);
  assert.match(csv, /Bilal Nour/);

  const pdfBytes = buildFeePdfBytes(profiles, 'All');
  const pdfString = new TextDecoder().decode(pdfBytes);
  assert.equal(pdfString.startsWith('%PDF-1.4'), true);
  assert.match(pdfString, /Cashier \\\(Mariam\\\)/);
  assert.match(pdfString, /Bilal Nour/);
});

import {
  MS_OFFICE_COURSES,
  getStudentFeeCourseOptions,
  getStudentRegisteredCourses,
} from './studentCourses';

test('getStudentRegisteredCourses and getStudentFeeCourseOptions mirror student registration courses', () => {
  const tariq = INITIAL_STUDENTS.find((s) => s.id === 'ABC-0012-2026');
  assert.deepEqual(getStudentRegisteredCourses(tariq), [
    'MS-Word',
    'MS-Publisher',
  ]);
  assert.deepEqual(getStudentFeeCourseOptions(tariq), [
    'MS-Word, MS-Publisher',
    'MS-Word',
    'MS-Publisher',
  ]);

  const amina = INITIAL_STUDENTS.find((s) => s.id === 'ABC-0013-2026');
  assert.deepEqual(getStudentRegisteredCourses(amina), [
    'MS-Word',
    'MS-Excel',
    'Introduction to Windows',
  ]);

  const fatima = INITIAL_STUDENTS.find((s) => s.id === 'ABC-0001-2026');
  assert.deepEqual(getStudentRegisteredCourses(fatima), MS_OFFICE_COURSES);
  assert.deepEqual(getStudentFeeCourseOptions(fatima), [
    'All MS Office Courses',
    ...MS_OFFICE_COURSES,
  ]);
});

import {
  AUTHORIZED_STAFF_ACCOUNTS,
  authenticateUser,
} from './authAccounts';

test('authenticateUser verifies exact Administration, Teachers, and Cashier credentials only', () => {
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
    'Teachers',
    '@albushra3326'
  );
  assert.equal(teacherOk.ok, true);
  if (teacherOk.ok) {
    assert.equal(teacherOk.user.role, 'Teacher');
    assert.equal(teacherOk.user.fullName, 'Teachers');
  }

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
    authenticateUser(AUTHORIZED_STAFF_ACCOUNTS, 'admin.bushra', 'absms@2026admin')
      .ok,
    false
  );
  assert.equal(
    authenticateUser(AUTHORIZED_STAFF_ACCOUNTS, 'Teachers', 'wrongpass').ok,
    false
  );
});

import {
  DEFAULT_RECOVERY_EMAIL,
  buildRecoveryEmailRaw,
  generateRecoveryCode,
  validateRecoveryReset,
} from './recoveryEmail';
import { updateAccountPassword } from './authAccounts';

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



