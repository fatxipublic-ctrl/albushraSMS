export type UserRole = 'Admin' | 'Teacher' | 'Cashier';

export type ModuleTab =
  | 'dashboard'
  | 'registration'
  | 'attendance'
  | 'exams'
  | 'fees'
  | 'reports';

export interface AuthSession {
  username: string;
  role: UserRole;
  displayRole: string;
  initials: string;
  keepSignedIn: boolean;
}

export interface RegisteredUser {
  id: string;
  fullName: string;
  username: string;
  password: string;
  role: UserRole;
  createdAt: string;
}

export type ShiftType = 'Morning Shift' | 'Afternoon Shift' | 'Evening Shift';
export type ProgramType = 'Crush Program' | 'Normal Program';

export type CourseName =
  | 'MS-Word'
  | 'MS-Excel'
  | 'MS-Access'
  | 'MS-PowerPoint'
  | 'Introduction to Windows'
  | 'MS-Publisher';

export interface Student {
  id: string;
  name: string;
  shift: ShiftType;
  program: ProgramType;
  courses: CourseName[];
  phone: string;
  enrolledDate: string;
  status: 'Active' | 'Completed';
}

export type AttendanceStatus = 'Present' | 'Excused' | 'Absent';

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  shift: ShiftType;
  program: ProgramType;
  status: AttendanceStatus;
  note?: string;
}

export interface AttendanceHistoryEntry {
  id: string;
  date: string;
  dateLabel: string;
  studentId: string;
  studentName: string;
  shift: ShiftType;
  program: ProgramType;
  status: AttendanceStatus;
  excuseReason?: string;
  recordedBy: string;
}

export interface ExamResult {
  id: string;
  studentId: string;
  studentName: string;
  course: CourseName;
  score: number;
  status: 'Pass' | 'Fail';
  gradedBy: string;
  date: string;
}

export type PaymentMethod = 'Ebirr' | 'Kaafi' | 'CBE' | 'Cash';

export interface FeeLedger {
  id: string;
  studentId: string;
  studentName: string;
  courses: string;
  amount: number;
  paymentMethod: PaymentMethod;
  receivedAmount: string;
  paid: boolean;
  submitted?: boolean;
  dueDate: string;
  cashier?: string;
}

export type ActivityActionType =
  | 'Exam Scored'
  | 'Fee Payment'
  | 'New Admission'
  | 'Attendance';

export type ActivityStatusType = 'Completed' | 'Verified' | 'Active' | 'Excused';

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  studentId: string;
  studentName: string;
  actionType: ActivityActionType;
  details: string;
  staffRole: string;
  status: ActivityStatusType;
}

export interface NotificationItem {
  id: string;
  title: string;
  time: string;
  read: boolean;
}

export interface DashboardKPIs {
  totalActiveStudents: number;
  newEnrollmentsThisMonth: number;
  attendanceRate: string;
  presentCount: number;
  excusedCount: number;
  absentCount: number;
  pendingFeeBalance: number;
  unpaidLedgersCount: number;
  examAverage: string;
  examPassRate: string;
}
