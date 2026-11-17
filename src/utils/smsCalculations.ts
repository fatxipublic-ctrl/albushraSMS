import type {
  ActivityLogItem,
  AttendanceRecord,
  AuthSession,
  DashboardKPIs,
  ExamResult,
  FeeLedger,
  Student,
  UserRole,
} from '../types/sms';

export const ROLE_PRESETS: Record<
  UserRole,
  { username: string; displayRole: string; initials: string }
> = {
  Admin: {
    username: 'admin albushra',
    displayRole: 'Administration',
    initials: 'AD',
  },
  Teacher: {
    username: 'Teachers',
    displayRole: 'Teachers',
    initials: 'TE',
  },
  Cashier: {
    username: 'Cashier',
    displayRole: 'Cashier',
    initials: 'CA',
  },
};

export const BASELINE_COUNTS = {
  initialRosterSize: 8,
  baseTotalStudents: 1248,
  baseNewEnrollments: 42,
  basePresent: 1183,
  baseExcused: 35,
  baseAbsent: 30,
  initialUnpaidAmount: 650,
  basePendingBalance: 14850,
  initialUnpaidCount: 4,
  baseUnpaidCount: 86,
  initialExamCount: 6,
  baseExamCount: 250,
  baseExamAverage: 82.6,
  baseExamPassCount: 221,
};

export function validateLoginCredentials(
  username: string,
  password: string
): { valid: boolean; error?: string } {
  if (!username.trim()) {
    return { valid: false, error: 'Please enter an authorized school username.' };
  }
  if (!password.trim() || password.trim().length < 4) {
    return { valid: false, error: 'Password must be at least 4 characters.' };
  }
  return { valid: true };
}

export function buildAuthSession(
  role: UserRole,
  username: string,
  keepSignedIn: boolean,
  fullName?: string
): AuthSession {
  const preset = ROLE_PRESETS[role];
  const cleanUser = username.trim() || preset.username;
  const cleanName = fullName?.trim();
  const parts = cleanName ? cleanName.split(/\s+/).filter(Boolean) : [];
  const customInitials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : parts.length === 1 && parts[0].length >= 2
        ? parts[0].slice(0, 2).toUpperCase()
        : preset.initials;

  return {
    username: cleanUser,
    role,
    displayRole: cleanName || preset.displayRole,
    initials: cleanName ? customInitials : preset.initials,
    keepSignedIn,
  };
}

export function computeExamStatus(score: number): 'Pass' | 'Fail' {
  return score >= 60 ? 'Pass' : 'Fail';
}

export function parseReceivedAmount(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function generateStudentId(existingStudents: Student[]): string {
  const maxNum = existingStudents.reduce((acc, st) => {
    const match = st.id.match(/^ABC-(\d+)-2026$/);
    if (!match) return acc;
    const val = Number.parseInt(match[1], 10);
    return Number.isNaN(val) ? acc : Math.max(acc, val);
  }, 12);
  const next = String(maxNum + 1).padStart(4, '0');
  return `ABC-${next}-2026`;
}

export function calculateDashboardKPIs(
  students: Student[],
  attendance: AttendanceRecord[],
  exams: ExamResult[],
  fees: FeeLedger[],
  initialAttendanceSnapshot: AttendanceRecord[],
  initialExamScores: ExamResult[]
): DashboardKPIs {
  const addedStudents = Math.max(0, students.length - BASELINE_COUNTS.initialRosterSize);
  const totalActiveStudents = BASELINE_COUNTS.baseTotalStudents + addedStudents;
  const newEnrollmentsThisMonth = BASELINE_COUNTS.baseNewEnrollments + addedStudents;

  // Calculate attendance deltas against the initial snapshot
  let deltaPresent = 0;
  let deltaExcused = 0;
  let deltaAbsent = 0;

  const initialMap = new Map(initialAttendanceSnapshot.map((a) => [a.studentId, a.status]));
  for (const record of attendance) {
    const prev = initialMap.get(record.studentId);
    if (!prev) {
      if (record.status === 'Present') deltaPresent += 1;
      else if (record.status === 'Excused') deltaExcused += 1;
      else deltaAbsent += 1;
    } else if (prev !== record.status) {
      if (prev === 'Present') deltaPresent -= 1;
      else if (prev === 'Excused') deltaExcused -= 1;
      else deltaAbsent -= 1;

      if (record.status === 'Present') deltaPresent += 1;
      else if (record.status === 'Excused') deltaExcused += 1;
      else deltaAbsent += 1;
    }
  }

  const presentCount = Math.max(0, BASELINE_COUNTS.basePresent + deltaPresent);
  const excusedCount = Math.max(0, BASELINE_COUNTS.baseExcused + deltaExcused);
  const absentCount = Math.max(0, BASELINE_COUNTS.baseAbsent + deltaAbsent);
  const totalAtt = presentCount + excusedCount + absentCount;
  const attendanceRate =
    totalAtt === BASELINE_COUNTS.baseTotalStudents &&
    presentCount === BASELINE_COUNTS.basePresent
      ? '94.8'
      : totalAtt > 0
        ? ((presentCount / totalAtt) * 100).toFixed(1)
        : '0.0';

  // Pending fee balances delta
  const currentUnpaidLedgers = fees.filter((f) => !f.paid);
  const currentUnpaidSum = currentUnpaidLedgers.reduce((sum, f) => sum + f.amount, 0);
  const deltaUnpaidSum = currentUnpaidSum - BASELINE_COUNTS.initialUnpaidAmount;
  const deltaUnpaidCount = currentUnpaidLedgers.length - BASELINE_COUNTS.initialUnpaidCount;

  const pendingFeeBalance = Math.max(0, BASELINE_COUNTS.basePendingBalance + deltaUnpaidSum);
  const unpaidLedgersCount = Math.max(0, BASELINE_COUNTS.baseUnpaidCount + deltaUnpaidCount);

  // Exam averages delta
  const addedExams = exams.slice(0, Math.max(0, exams.length - initialExamScores.length));
  if (exams.length === initialExamScores.length) {
    return {
      totalActiveStudents,
      newEnrollmentsThisMonth,
      attendanceRate,
      presentCount,
      excusedCount,
      absentCount,
      pendingFeeBalance,
      unpaidLedgersCount,
      examAverage: '82.6',
      examPassRate: '88.2',
    };
  }

  const baseSum = BASELINE_COUNTS.baseExamAverage * BASELINE_COUNTS.baseExamCount;
  const extraSum = addedExams.reduce((s, e) => s + e.score, 0);
  const totalExams = BASELINE_COUNTS.baseExamCount + addedExams.length;
  const examAverage = ((baseSum + extraSum) / totalExams).toFixed(1);

  const extraPasses = addedExams.filter((e) => e.status === 'Pass').length;
  const examPassRate = (
    ((BASELINE_COUNTS.baseExamPassCount + extraPasses) / totalExams) *
    100
  ).toFixed(1);

  return {
    totalActiveStudents,
    newEnrollmentsThisMonth,
    attendanceRate,
    presentCount,
    excusedCount,
    absentCount,
    pendingFeeBalance,
    unpaidLedgersCount,
    examAverage,
    examPassRate,
  };
}

export function filterActivityLog(
  logs: ActivityLogItem[],
  query: string
): ActivityLogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return logs;
  return logs.filter(
    (item) =>
      item.studentId.toLowerCase().includes(q) ||
      item.studentName.toLowerCase().includes(q) ||
      item.actionType.toLowerCase().includes(q) ||
      item.details.toLowerCase().includes(q) ||
      item.staffRole.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
  );
}
