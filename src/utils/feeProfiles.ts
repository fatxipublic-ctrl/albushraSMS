import type { FeeLedger, Student } from '../types/sms';

export type FeeProfileFilter = 'All' | 'Paid' | 'Unpaid';

export interface StudentFeeProfile {
  studentId: string;
  studentName: string;
  shift?: Student['shift'];
  program?: Student['program'];
  entries: FeeLedger[];
  coursesSummary: string;
  paidCoursesSummary: string;
  unpaidCoursesSummary: string;
  paidCount: number;
  unpaidCount: number;
  allPaid: boolean;
  totalPaidAmount: number;
  latestEntry: FeeLedger;
}

export function buildStudentFeeProfiles(
  ledgers: FeeLedger[],
  students: Student[]
): StudentFeeProfile[] {
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const grouped = new Map<string, FeeLedger[]>();

  for (const ledger of ledgers) {
    const existing = grouped.get(ledger.studentId);
    if (existing) {
      existing.push(ledger);
    } else {
      grouped.set(ledger.studentId, [ledger]);
    }
  }

  const profiles: StudentFeeProfile[] = [];

  for (const [studentId, entries] of grouped.entries()) {
    const latestEntry = entries[0];
    const student = studentMap.get(studentId);
    const uniqueCourses: string[] = [];
    for (const entry of entries) {
      const course = entry.courses.trim();
      if (course && !uniqueCourses.includes(course)) {
        uniqueCourses.push(course);
      }
    }

    const paidEntries = entries.filter((e) => e.paid);
    const unpaidEntries = entries.filter((e) => !e.paid);
    const paidCourses: string[] = [];
    for (const entry of paidEntries) {
      const course = entry.courses.trim();
      if (course && !paidCourses.includes(course)) {
        paidCourses.push(course);
      }
    }
    const unpaidCourses: string[] = [];
    for (const entry of unpaidEntries) {
      const course = entry.courses.trim();
      if (course && !unpaidCourses.includes(course)) {
        unpaidCourses.push(course);
      }
    }
    const totalPaidAmount = paidEntries.reduce((sum, e) => sum + e.amount, 0);

    profiles.push({
      studentId,
      studentName: student?.name ?? latestEntry.studentName,
      shift: student?.shift,
      program: student?.program,
      entries,
      coursesSummary: uniqueCourses.join(', '),
      paidCoursesSummary: paidCourses.join(', '),
      unpaidCoursesSummary: unpaidCourses.join(', '),
      paidCount: paidEntries.length,
      unpaidCount: unpaidEntries.length,
      allPaid: paidEntries.length > 0 && unpaidEntries.length === 0,
      totalPaidAmount,
      latestEntry,
    });
  }

  return profiles;
}

export function filterStudentFeeProfiles(
  profiles: StudentFeeProfile[],
  searchQuery: string,
  statusFilter: FeeProfileFilter
): StudentFeeProfile[] {
  const q = searchQuery.trim().toLowerCase();
  return profiles.filter((profile) => {
    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Paid' ? profile.allPaid : !profile.allPaid);
    const matchesQuery =
      !q ||
      profile.studentId.toLowerCase().includes(q) ||
      profile.studentName.toLowerCase().includes(q) ||
      profile.coursesSummary.toLowerCase().includes(q) ||
      profile.entries.some(
        (e) =>
          e.paymentMethod.toLowerCase().includes(q) ||
          e.receivedAmount.toLowerCase().includes(q) ||
          (e.cashier ?? '').toLowerCase().includes(q)
      );
    return matchesStatus && matchesQuery;
  });
}
