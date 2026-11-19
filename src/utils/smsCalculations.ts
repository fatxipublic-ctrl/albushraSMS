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
    username: 'Teacher',
    displayRole: 'Teacher',
    initials: 'TE',
  },
  Cashier: {
    username: 'Cashier',
    displayRole: 'Cashier',
    initials: 'CA',
  },
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
  }, 0);
  const next = String(maxNum + 1).padStart(4, '0');
  return `ABC-${next}-2026`;
}

export function calculateDashboardKPIs(
  students: Student[],
  attendance: AttendanceRecord[],
  exams: ExamResult[],
  fees: FeeLedger[]
): DashboardKPIs {
  const totalActiveStudents = students.length;
  const newEnrollmentsThisMonth = students.length;

  const presentCount = attendance.filter((a) => a.status === 'Present').length;
  const excusedCount = attendance.filter((a) => a.status === 'Excused').length;
  const absentCount = attendance.filter((a) => a.status === 'Absent').length;
  const totalAtt = presentCount + excusedCount + absentCount;
  const attendanceRate =
    totalAtt > 0 ? ((presentCount / totalAtt) * 100).toFixed(1) : '0.0';

  const currentUnpaidLedgers = fees.filter((f) => !f.paid);
  const pendingFeeBalance = currentUnpaidLedgers.reduce(
    (sum, f) => sum + f.amount,
    0
  );
  const unpaidLedgersCount = currentUnpaidLedgers.length;

  const totalExams = exams.length;
  const examAverage =
    totalExams > 0
      ? (exams.reduce((s, e) => s + e.score, 0) / totalExams).toFixed(1)
      : '0.0';
  const examPassRate =
    totalExams > 0
      ? (
          (exams.filter((e) => e.status === 'Pass').length / totalExams) *
          100
        ).toFixed(1)
      : '0.0';

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
