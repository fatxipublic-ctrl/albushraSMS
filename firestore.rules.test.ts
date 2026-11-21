/**
 * Payload-First Security Test Specification ("Dirty Dozen")
 * Validates invariants enforced by firestore.rules.
 */

export interface DirtyDozenCase {
  id: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 'P01_UNAUTH_STUDENT_GET',
    collection: 'students/ABC-0001-2026',
    operation: 'get',
    auth: null,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'P02_UNVERIFIED_ADMIN_EMAIL_SPOOF',
    collection: 'students/ABC-0001-2026',
    operation: 'get',
    auth: {
      uid: 'attacker-uid',
      email: 'fatxipublic@gmail.com',
      email_verified: false,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'P03_OWNER_SPOOFING_ON_CREATE',
    collection: 'students/ABC-0001-2026',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@school.org', email_verified: true },
    payload: {
      id: 'ABC-0001-2026',
      name: 'Nadia Ali',
      shift: 'Morning Shift',
      program: 'Crush Program',
      courses: ['MS-Word'],
      enrolledDate: '2026-11-21',
      status: 'Active',
      ownerUid: 'victim-uid',
      authorizedUids: ['victim-uid'],
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'P04_SHADOW_FIELD_INJECTION',
    collection: 'students/ABC-0001-2026',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@school.org', email_verified: true },
    payload: {
      id: 'ABC-0001-2026',
      name: 'Nadia Ali',
      shift: 'Morning Shift',
      program: 'Crush Program',
      courses: ['MS-Word'],
      enrolledDate: '2026-11-21',
      status: 'Active',
      ownerUid: 'user-a',
      authorizedUids: ['user-a'],
      isSuperAdminOverride: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'P05_LONG_ID_POISONING',
    collection: `students/${'A'.repeat(200)}`,
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@school.org', email_verified: true },
    payload: {
      id: 'A'.repeat(200),
      name: 'Long Id Test',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'P06_ORPHANED_EXAM_RECORD',
    collection: 'exams/EX-9999',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@school.org', email_verified: true },
    payload: {
      id: 'EX-9999',
      studentId: 'ABC-9999-2026',
      studentName: 'Ghost Student',
      course: 'MS-Word',
      score: 88,
      status: 'Pass',
      gradedBy: 'Teacher',
      date: '2026-11-21',
      ownerUid: 'user-a',
      authorizedUids: ['user-a'],
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'P07_ORPHANED_FEE_RECORD',
    collection: 'fees/FEE-9999',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@school.org', email_verified: true },
    payload: {
      id: 'FEE-9999',
      studentId: 'ABC-9999-2026',
      studentName: 'Ghost Student',
      courses: 'MS-Word',
      amount: 50,
      paymentMethod: 'Cash',
      receivedAmount: '$50',
      paid: true,
      submitted: true,
      dueDate: '2026-11-21',
      cashier: 'Cashier',
      ownerUid: 'user-a',
      authorizedUids: ['user-a'],
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'P08_OUT_OF_RANGE_SCORE',
    collection: 'exams/EX-1001',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@school.org', email_verified: true },
    payload: {
      id: 'EX-1001',
      studentId: 'ABC-0001-2026',
      studentName: 'Nadia Ali',
      course: 'MS-Word',
      score: 150,
      status: 'Pass',
      gradedBy: 'Teacher',
      date: '2026-11-21',
      ownerUid: 'user-a',
      authorizedUids: ['user-a'],
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'P09_FORGED_CLIENT_TIMESTAMP',
    collection: 'activity_logs/LOG-1',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@school.org', email_verified: true },
    payload: {
      id: 'LOG-1',
      timestamp: 'Today, 10:00 AM',
      date: '2026-11-21',
      studentId: 'ABC-0001-2026',
      studentName: 'Nadia Ali',
      actionType: 'New Admission',
      details: 'Morning Shift',
      staffRole: 'Administration',
      status: 'Active',
      ownerUid: 'user-a',
      authorizedUids: ['user-a'],
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'P10_IMMUTABLE_HISTORY_UPDATE',
    collection: 'attendance_history/AH-20261121-ABC-0001-2026',
    operation: 'update',
    auth: { uid: 'user-a', email: 'a@school.org', email_verified: true },
    payload: {
      status: 'Present',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'P11_UNAUTHORIZED_PII_CONTACT_READ',
    collection: 'student_contacts/ABC-0001-2026',
    operation: 'get',
    auth: { uid: 'stranger-uid', email: 'stranger@other.org', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'P12_ADMIN_SELF_PROMOTION',
    collection: 'admins/user-a',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@school.org', email_verified: true },
    payload: {
      uid: 'user-a',
      email: 'a@school.org',
      role: 'Admin',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
