import { getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  ActivityLogItem,
  AttendanceHistoryEntry,
  AttendanceRecord,
  AttendanceStatus,
  ExamResult,
  FeeLedger,
  NotificationItem,
  Student,
} from '../types/sms';
import { compareStudentIdsAsc } from './smsCalculations';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const BOOTSTRAPPED_ADMIN_EMAIL = 'fatxipublic@gmail.com';
export const LIVE_PORTAL_URL = 'https://gen-lang-client-0333670833.web.app';
export const SYSTEM_CLOCK_DOC_ID = 'school_clock';

export function isAuthorizedCloudAdmin(
  user: User | null | undefined
): boolean {
  return Boolean(
    user &&
      user.emailVerified &&
      (user.email ?? '').trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
  );
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}

let connectionProbePromise: Promise<boolean> | null = null;

export function testConnection(): Promise<boolean> {
  if (!connectionProbePromise) {
    connectionProbePromise = (async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        return true;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('the client is offline')
        ) {
          console.error(
            'Please check your Firebase configuration. Client appears offline.'
          );
          return false;
        }
        // Any server-acknowledged response (including permission-denied on test doc) confirms connectivity
        return true;
      }
    })();
  }
  return connectionProbePromise;
}

const cloudProvider = new GoogleAuthProvider();
cloudProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInCloudGoogleSession(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, cloudProvider);
    if (!isAuthorizedCloudAdmin(result.user)) {
      const pickedEmail = result.user.email ?? 'unverified Google account';
      await signOut(auth);
      throw new Error(
        `Account "${pickedEmail}" is not authorized for Cloud Sync. Please sign in with ${BOOTSTRAPPED_ADMIN_EMAIL}.`
      );
    }
    return result.user;
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'auth/unauthorized-domain') {
      const host =
        typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      try {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(firebaseConfig.apiKey)}`
        );
        if (res.ok) {
          const data = (await res.json()) as { authorizedDomains?: string[] };
          const domains = data.authorizedDomains ?? [];
          const matched = domains.some(
            (d) =>
              host.toLowerCase() === d.toLowerCase() ||
              host.toLowerCase().endsWith(`.${d.toLowerCase()}`)
          );
          if (matched) {
            throw new Error(
              `Domain "${host}" is authorized in Firebase, but this browser tab cached an earlier Auth state. Reload this browser tab (F5 / Refresh) and click "Connect Cloud Database" again.`
            );
          }
        }
      } catch (checkErr) {
        if (
          checkErr instanceof Error &&
          checkErr.message.includes('cached an earlier Auth state')
        ) {
          throw checkErr;
        }
      }
      throw new Error(
        `Domain "${host}" is not yet in Firebase Authorized Domains. Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains (project ${firebaseConfig.projectId}), or open the authorized portal URL.`
      );
    }
    if (code === 'auth/popup-blocked') {
      throw new Error(
        'Sign-in popup was blocked by your browser. Please allow popups for this site and click "Connect Cloud Database" again.'
      );
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error(
        'Google sign-in popup was closed before completing. Click "Connect Cloud Database" whenever you are ready.'
      );
    }
    throw err;
  }
}

export async function signOutCloudSession(): Promise<void> {
  await signOut(auth);
}

export function subscribeCloudAuth(
  callback: (user: User | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

function clampText(value: string, maxLen: number): string {
  const clean = value.trim();
  return clean.length <= maxLen ? clean : clean.slice(0, maxLen);
}

function getAuthorizedContext(): { uid: string; email: string } {
  const user = auth.currentUser;
  if (!user || !isAuthorizedCloudAdmin(user)) {
    throw new Error(
      `Authorized Google Admin session (${BOOTSTRAPPED_ADMIN_EMAIL}) required before syncing records to Firestore.`
    );
  }
  return { uid: user.uid, email: user.email ?? BOOTSTRAPPED_ADMIN_EMAIL };
}

function buildCollectionQuery(colName: string, uid: string, email: string) {
  const colRef = collection(db, colName);
  if (email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) {
    return colRef;
  }
  return query(colRef, where('authorizedUids', 'array-contains', uid));
}

export interface CloudSyncCallbacks {
  onStudentsChange: (students: Student[]) => void;
  onAttendanceChange: (records: AttendanceRecord[]) => void;
  onAttendanceHistoryChange: (entries: AttendanceHistoryEntry[]) => void;
  onExamsChange: (exams: ExamResult[]) => void;
  onFeesChange: (fees: FeeLedger[]) => void;
  onActivityLogsChange: (logs: ActivityLogItem[]) => void;
  onNotificationsChange: (notifications: NotificationItem[]) => void;
  onActiveRollCallDateChange: (activeDate: string | null) => void;
  onError: (err: Error) => void;
}

export function subscribeSchoolDatabase(
  uid: string,
  email: string,
  callbacks: CloudSyncCallbacks
): Unsubscribe {
  let coreStudents: Omit<Student, 'phone'>[] = [];
  let contactMap = new Map<string, string>();

  const emitMergedStudents = () => {
    const merged: Student[] = coreStudents.map((s) => ({
      ...s,
      phone: contactMap.get(s.id) ?? '',
    }));
    merged.sort((a, b) => compareStudentIdsAsc(a.id, b.id));
    callbacks.onStudentsChange(merged);
  };

  const reportSnapshotError = (op: OperationType, path: string, err: unknown) => {
    try {
      handleFirestoreError(err, op, path);
    } catch (wrapped) {
      callbacks.onError(
        wrapped instanceof Error ? wrapped : new Error(String(wrapped))
      );
    }
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      buildCollectionQuery('students', uid, email),
      (snap) => {
        coreStudents = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id ?? d.id),
            name: String(data.name ?? ''),
            shift: data.shift,
            program: data.program,
            courses: Array.isArray(data.courses) ? data.courses : [],
            enrolledDate: String(data.enrolledDate ?? ''),
            status: data.status === 'Completed' ? 'Completed' : 'Active',
          };
        });
        emitMergedStudents();
      },
      (err) => reportSnapshotError(OperationType.LIST, 'students', err)
    )
  );

  unsubs.push(
    onSnapshot(
      buildCollectionQuery('student_contacts', uid, email),
      (snap) => {
        const nextMap = new Map<string, string>();
        for (const d of snap.docs) {
          const data = d.data();
          nextMap.set(String(data.studentId ?? d.id), String(data.phone ?? ''));
        }
        contactMap = nextMap;
        emitMergedStudents();
      },
      (err) => reportSnapshotError(OperationType.LIST, 'student_contacts', err)
    )
  );

  unsubs.push(
    onSnapshot(
      buildCollectionQuery('attendance_current', uid, email),
      (snap) => {
        const rows: AttendanceRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              studentId: String(data.studentId ?? d.id),
              studentName: String(data.studentName ?? ''),
              shift: data.shift,
              program: data.program,
              status: data.status,
              note: String(data.note ?? ''),
              rollCallDate: String(data.rollCallDate ?? ''),
            };
          })
          .sort((a, b) => compareStudentIdsAsc(a.studentId, b.studentId));
        callbacks.onAttendanceChange(rows);
      },
      (err) => reportSnapshotError(OperationType.LIST, 'attendance_current', err)
    )
  );

  unsubs.push(
    onSnapshot(
      buildCollectionQuery('attendance_history', uid, email),
      (snap) => {
        const rows: AttendanceHistoryEntry[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id ?? d.id),
              date: String(data.date ?? ''),
              dateLabel: String(data.dateLabel ?? ''),
              studentId: String(data.studentId ?? ''),
              studentName: String(data.studentName ?? ''),
              shift: data.shift,
              program: data.program,
              status: data.status,
              excuseReason: data.excuseReason
                ? String(data.excuseReason)
                : undefined,
              recordedBy: String(data.recordedBy ?? ''),
            };
          })
          .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        callbacks.onAttendanceHistoryChange(rows);
      },
      (err) => reportSnapshotError(OperationType.LIST, 'attendance_history', err)
    )
  );

  unsubs.push(
    onSnapshot(
      buildCollectionQuery('exams', uid, email),
      (snap) => {
        const rows: ExamResult[] = snap.docs
          .map((d): ExamResult => {
            const data = d.data();
            return {
              id: String(data.id ?? d.id),
              studentId: String(data.studentId ?? ''),
              studentName: String(data.studentName ?? ''),
              course: data.course,
              score: Number(data.score ?? 0),
              status: data.status === 'Fail' ? 'Fail' : 'Pass',
              gradedBy: String(data.gradedBy ?? ''),
              date: String(data.date ?? ''),
            };
          })
          .sort((a, b) => b.id.localeCompare(a.id));
        callbacks.onExamsChange(rows);
      },
      (err) => reportSnapshotError(OperationType.LIST, 'exams', err)
    )
  );

  unsubs.push(
    onSnapshot(
      buildCollectionQuery('fees', uid, email),
      (snap) => {
        const rows: FeeLedger[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id ?? d.id),
              studentId: String(data.studentId ?? ''),
              studentName: String(data.studentName ?? ''),
              courses: String(data.courses ?? ''),
              amount: Number(data.amount ?? 0),
              paymentMethod: data.paymentMethod ?? 'Cash',
              receivedAmount: String(data.receivedAmount ?? ''),
              paid: Boolean(data.paid),
              submitted: Boolean(data.submitted ?? true),
              dueDate: String(data.dueDate ?? ''),
              cashier: data.cashier ? String(data.cashier) : undefined,
            };
          })
          .sort((a, b) => b.id.localeCompare(a.id));
        callbacks.onFeesChange(rows);
      },
      (err) => reportSnapshotError(OperationType.LIST, 'fees', err)
    )
  );

  unsubs.push(
    onSnapshot(
      buildCollectionQuery('activity_logs', uid, email),
      (snap) => {
        const rows: ActivityLogItem[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id ?? d.id),
              timestamp: String(data.timestamp ?? ''),
              date: String(data.date ?? ''),
              studentId: String(data.studentId ?? ''),
              studentName: String(data.studentName ?? ''),
              actionType: data.actionType,
              details: String(data.details ?? ''),
              staffRole: String(data.staffRole ?? ''),
              status: data.status,
            };
          })
          .sort((a, b) => b.id.localeCompare(a.id));
        callbacks.onActivityLogsChange(rows);
      },
      (err) => reportSnapshotError(OperationType.LIST, 'activity_logs', err)
    )
  );

  unsubs.push(
    onSnapshot(
      buildCollectionQuery('notifications', uid, email),
      (snap) => {
        const rows: NotificationItem[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id ?? d.id),
              title: String(data.title ?? ''),
              time: String(data.time ?? ''),
              date: String(data.date ?? ''),
              read: Boolean(data.read),
            };
          })
          .sort((a, b) => b.id.localeCompare(a.id));
        callbacks.onNotificationsChange(rows);
      },
      (err) => reportSnapshotError(OperationType.LIST, 'notifications', err)
    )
  );

  unsubs.push(
    onSnapshot(
      buildCollectionQuery('system_meta', uid, email),
      (snap) => {
        const clockDoc = snap.docs.find((d) => d.id === SYSTEM_CLOCK_DOC_ID) ?? snap.docs[0];
        if (!clockDoc) {
          callbacks.onActiveRollCallDateChange(null);
        } else {
          const data = clockDoc.data();
          callbacks.onActiveRollCallDateChange(
            data.activeRollCallDate ? String(data.activeRollCallDate) : null
          );
        }
      },
      (err) => reportSnapshotError(OperationType.LIST, 'system_meta', err)
    )
  );

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}

export async function saveStudentAdmissionToDb(params: {
  student: Student;
  attendanceRec: AttendanceRecord;
  logItem: ActivityLogItem;
  notifItem: NotificationItem;
  activeDateIso: string;
  hasSystemClock: boolean;
}): Promise<void> {
  const { uid } = getAuthorizedContext();
  const { student, attendanceRec, logItem, notifItem, activeDateIso, hasSystemClock } =
    params;

  const path = `students/${student.id}`;
  try {
    const batch = writeBatch(db);
    const nowTs = serverTimestamp();

    batch.set(doc(db, 'students', student.id), {
      id: student.id,
      name: clampText(student.name, 120),
      shift: student.shift,
      program: student.program,
      courses: student.courses.slice(0, 6),
      enrolledDate: student.enrolledDate,
      status: student.status,
      ownerUid: uid,
      authorizedUids: [uid],
      createdAt: nowTs,
      updatedAt: nowTs,
    });

    batch.set(doc(db, 'student_contacts', student.id), {
      studentId: student.id,
      phone: clampText(student.phone || 'Not provided', 40),
      ownerUid: uid,
      authorizedUids: [uid],
      createdAt: nowTs,
      updatedAt: nowTs,
    });

    batch.set(doc(db, 'attendance_current', student.id), {
      studentId: attendanceRec.studentId,
      studentName: clampText(attendanceRec.studentName, 120),
      shift: attendanceRec.shift,
      program: attendanceRec.program,
      status: attendanceRec.status,
      note: clampText(attendanceRec.note ?? '', 300),
      rollCallDate: activeDateIso,
      ownerUid: uid,
      authorizedUids: [uid],
      createdAt: nowTs,
      updatedAt: nowTs,
    });

    batch.set(doc(db, 'activity_logs', logItem.id), {
      id: logItem.id,
      timestamp: clampText(logItem.timestamp, 64),
      date: activeDateIso,
      studentId: logItem.studentId,
      studentName: clampText(logItem.studentName, 120),
      actionType: logItem.actionType,
      details: clampText(logItem.details, 320),
      staffRole: clampText(logItem.staffRole, 80),
      status: logItem.status,
      ownerUid: uid,
      authorizedUids: [uid],
      createdAt: nowTs,
    });

    batch.set(doc(db, 'notifications', notifItem.id), {
      id: notifItem.id,
      title: clampText(notifItem.title, 240),
      time: clampText(notifItem.time, 64),
      date: activeDateIso,
      read: notifItem.read,
      ownerUid: uid,
      authorizedUids: [uid],
      createdAt: nowTs,
      updatedAt: nowTs,
    });

    const clockSnap = await getDoc(doc(db, 'system_meta', SYSTEM_CLOCK_DOC_ID));
    if (!clockSnap.exists()) {
      batch.set(doc(db, 'system_meta', SYSTEM_CLOCK_DOC_ID), {
        id: SYSTEM_CLOCK_DOC_ID,
        activeRollCallDate: activeDateIso,
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    } else if (!hasSystemClock) {
      batch.update(doc(db, 'system_meta', SYSTEM_CLOCK_DOC_ID), {
        activeRollCallDate: activeDateIso,
        updatedAt: nowTs,
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteStudentCascadeFromDb(params: {
  studentId: string;
  examIds: string[];
  feeIds: string[];
}): Promise<void> {
  getAuthorizedContext();
  const { studentId, examIds, feeIds } = params;
  const path = `students/${studentId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'students', studentId));
    batch.delete(doc(db, 'student_contacts', studentId));
    batch.delete(doc(db, 'attendance_current', studentId));
    for (const exId of examIds) {
      batch.delete(doc(db, 'exams', exId));
    }
    for (const feeId of feeIds) {
      batch.delete(doc(db, 'fees', feeId));
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function updateAttendanceCurrentInDb(params: {
  studentId: string;
  status: AttendanceStatus;
  note: string;
  rollCallDate: string;
}): Promise<void> {
  getAuthorizedContext();
  const path = `attendance_current/${params.studentId}`;
  try {
    await updateDoc(doc(db, 'attendance_current', params.studentId), {
      status: params.status,
      note: clampText(params.note, 300),
      rollCallDate: params.rollCallDate,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function saveRollCallToHistoryInDb(params: {
  entries: AttendanceHistoryEntry[];
  existingHistoryIds?: Set<string>;
  logItem: ActivityLogItem;
  rollCallDate: string;
  hasSystemClock: boolean;
}): Promise<void> {
  const { uid } = getAuthorizedContext();
  const { entries, existingHistoryIds, logItem, rollCallDate } = params;
  const path = 'attendance_history';
  try {
    const batch = writeBatch(db);
    const nowTs = serverTimestamp();

    for (const entry of entries) {
      const ref = doc(db, 'attendance_history', entry.id);
      const alreadyExists =
        existingHistoryIds?.has(entry.id) ?? (await getDoc(ref)).exists();
      if (alreadyExists) {
        batch.update(ref, {
          status: entry.status,
          excuseReason: clampText(entry.excuseReason ?? '', 300),
          recordedBy: clampText(entry.recordedBy, 80),
        });
      } else {
        batch.set(ref, {
          id: entry.id,
          date: entry.date,
          dateLabel: clampText(entry.dateLabel, 80),
          studentId: entry.studentId,
          studentName: clampText(entry.studentName, 120),
          shift: entry.shift,
          program: entry.program,
          status: entry.status,
          excuseReason: clampText(entry.excuseReason ?? '', 300),
          recordedBy: clampText(entry.recordedBy, 80),
          ownerUid: uid,
          authorizedUids: [uid],
          createdAt: nowTs,
        });
      }
    }

    batch.set(doc(db, 'activity_logs', logItem.id), {
      id: logItem.id,
      timestamp: clampText(logItem.timestamp, 64),
      date: rollCallDate,
      studentId: logItem.studentId,
      studentName: clampText(logItem.studentName, 120),
      actionType: logItem.actionType,
      details: clampText(logItem.details, 320),
      staffRole: clampText(logItem.staffRole, 80),
      status: logItem.status,
      ownerUid: uid,
      authorizedUids: [uid],
      createdAt: nowTs,
    });

    const clockRef = doc(db, 'system_meta', SYSTEM_CLOCK_DOC_ID);
    const clockSnap = await getDoc(clockRef);
    if (clockSnap.exists()) {
      batch.update(clockRef, {
        activeRollCallDate: rollCallDate,
        updatedAt: nowTs,
      });
    } else {
      batch.set(clockRef, {
        id: SYSTEM_CLOCK_DOC_ID,
        activeRollCallDate: rollCallDate,
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function performMidnightRolloverInDb(params: {
  archivedEntries: AttendanceHistoryEntry[];
  attendanceStudentIds: string[];
  newDateIso: string;
  hasSystemClock: boolean;
}): Promise<void> {
  const { uid } = getAuthorizedContext();
  const { archivedEntries, attendanceStudentIds, newDateIso } = params;
  const path = `system_meta/${SYSTEM_CLOCK_DOC_ID}`;
  try {
    const batch = writeBatch(db);
    const nowTs = serverTimestamp();

    for (const entry of archivedEntries) {
      const ref = doc(db, 'attendance_history', entry.id);
      if (!(await getDoc(ref)).exists()) {
        batch.set(ref, {
          id: entry.id,
          date: entry.date,
          dateLabel: clampText(entry.dateLabel, 80),
          studentId: entry.studentId,
          studentName: clampText(entry.studentName, 120),
          shift: entry.shift,
          program: entry.program,
          status: entry.status,
          excuseReason: clampText(entry.excuseReason ?? '', 300),
          recordedBy: clampText(entry.recordedBy, 80),
          ownerUid: uid,
          authorizedUids: [uid],
          createdAt: nowTs,
        });
      }
    }

    for (const studentId of attendanceStudentIds) {
      batch.update(doc(db, 'attendance_current', studentId), {
        status: 'Present',
        note: '',
        rollCallDate: newDateIso,
        updatedAt: nowTs,
      });
    }

    const clockRef = doc(db, 'system_meta', SYSTEM_CLOCK_DOC_ID);
    const clockSnap = await getDoc(clockRef);
    if (clockSnap.exists()) {
      batch.update(clockRef, {
        activeRollCallDate: newDateIso,
        updatedAt: nowTs,
      });
    } else {
      batch.set(clockRef, {
        id: SYSTEM_CLOCK_DOC_ID,
        activeRollCallDate: newDateIso,
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function addExamResultToDb(params: {
  exam: ExamResult;
  logItem: ActivityLogItem;
}): Promise<void> {
  const { uid } = getAuthorizedContext();
  const { exam, logItem } = params;
  const path = `exams/${exam.id}`;
  try {
    const batch = writeBatch(db);
    const nowTs = serverTimestamp();

    batch.set(doc(db, 'exams', exam.id), {
      id: exam.id,
      studentId: exam.studentId,
      studentName: clampText(exam.studentName, 120),
      course: exam.course,
      score: Math.max(0, Math.min(100, Number(exam.score))),
      status: exam.status,
      gradedBy: clampText(exam.gradedBy, 80),
      date: exam.date,
      ownerUid: uid,
      authorizedUids: [uid],
      createdAt: nowTs,
    });

    batch.set(doc(db, 'activity_logs', logItem.id), {
      id: logItem.id,
      timestamp: clampText(logItem.timestamp, 64),
      date: exam.date,
      studentId: logItem.studentId,
      studentName: clampText(logItem.studentName, 120),
      actionType: logItem.actionType,
      details: clampText(logItem.details, 320),
      staffRole: clampText(logItem.staffRole, 80),
      status: logItem.status,
      ownerUid: uid,
      authorizedUids: [uid],
      createdAt: nowTs,
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function createFeeLedgerToDb(params: {
  ledger: FeeLedger;
  logItem?: ActivityLogItem;
}): Promise<void> {
  const { uid } = getAuthorizedContext();
  const { ledger, logItem } = params;
  const path = `fees/${ledger.id}`;
  try {
    const batch = writeBatch(db);
    const nowTs = serverTimestamp();

    batch.set(doc(db, 'fees', ledger.id), {
      id: ledger.id,
      studentId: ledger.studentId,
      studentName: clampText(ledger.studentName, 120),
      courses: clampText(ledger.courses, 240),
      amount: Math.max(0, Number(ledger.amount)),
      paymentMethod: ledger.paymentMethod,
      receivedAmount: clampText(ledger.receivedAmount, 40),
      paid: ledger.paid,
      submitted: Boolean(ledger.submitted ?? true),
      dueDate: ledger.dueDate,
      cashier: clampText(ledger.cashier ?? '', 80),
      ownerUid: uid,
      authorizedUids: [uid],
      createdAt: nowTs,
      updatedAt: nowTs,
    });

    if (logItem) {
      batch.set(doc(db, 'activity_logs', logItem.id), {
        id: logItem.id,
        timestamp: clampText(logItem.timestamp, 64),
        date: ledger.dueDate,
        studentId: logItem.studentId,
        studentName: clampText(logItem.studentName, 120),
        actionType: logItem.actionType,
        details: clampText(logItem.details, 320),
        staffRole: clampText(logItem.staffRole, 80),
        status: logItem.status,
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateFeeLedgerInDb(params: {
  ledgerId: string;
  patch: Partial<
    Pick<
      FeeLedger,
      'paid' | 'receivedAmount' | 'amount' | 'paymentMethod' | 'cashier'
    >
  >;
  logItem?: ActivityLogItem;
  logDate?: string;
}): Promise<void> {
  const { uid } = getAuthorizedContext();
  const { ledgerId, patch, logItem, logDate } = params;
  const path = `fees/${ledgerId}`;
  try {
    const batch = writeBatch(db);
    const nowTs = serverTimestamp();

    const updatePayload: Record<string, unknown> = { updatedAt: nowTs };
    if (patch.paid !== undefined) updatePayload.paid = patch.paid;
    if (patch.receivedAmount !== undefined) {
      updatePayload.receivedAmount = clampText(patch.receivedAmount, 40);
    }
    if (patch.amount !== undefined) {
      updatePayload.amount = Math.max(0, Number(patch.amount));
    }
    if (patch.paymentMethod !== undefined) {
      updatePayload.paymentMethod = patch.paymentMethod;
    }
    if (patch.cashier !== undefined) {
      updatePayload.cashier = clampText(patch.cashier, 80);
    }

    batch.update(doc(db, 'fees', ledgerId), updatePayload);

    if (logItem) {
      batch.set(doc(db, 'activity_logs', logItem.id), {
        id: logItem.id,
        timestamp: clampText(logItem.timestamp, 64),
        date: logDate ?? new Date().toISOString().slice(0, 10),
        studentId: logItem.studentId,
        studentName: clampText(logItem.studentName, 120),
        actionType: logItem.actionType,
        details: clampText(logItem.details, 320),
        staffRole: clampText(logItem.staffRole, 80),
        status: logItem.status,
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsReadInDb(
  notificationIds: string[]
): Promise<void> {
  if (notificationIds.length === 0) return;
  getAuthorizedContext();
  const path = 'notifications';
  try {
    const batch = writeBatch(db);
    const nowTs = serverTimestamp();
    for (const id of notificationIds) {
      batch.update(doc(db, 'notifications', id), {
        read: true,
        updatedAt: nowTs,
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

function clampBoundedText(
  value: string | undefined,
  fallback: string,
  maxLen: number
): string {
  const clean = (value ?? '').trim();
  const base = clean.length >= 2 ? clean : fallback;
  return base.length <= maxLen ? base : base.slice(0, maxLen);
}

function normalizeIsoDate(value: string | undefined, fallbackIso: string): string {
  const clean = (value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : fallbackIso;
}

export async function syncLocalWorkspaceToCloudIfEmpty(params: {
  students: Student[];
  attendance: AttendanceRecord[];
  attendanceHistory: AttendanceHistoryEntry[];
  exams: ExamResult[];
  fees: FeeLedger[];
  activityLogs: ActivityLogItem[];
  notifications: NotificationItem[];
  activeDateIso: string;
}): Promise<number> {
  const { uid, email } = getAuthorizedContext();
  const {
    students,
    attendance,
    attendanceHistory,
    exams,
    fees,
    activityLogs,
    notifications,
    activeDateIso,
  } = params;

  if (
    students.length === 0 &&
    attendanceHistory.length === 0 &&
    exams.length === 0 &&
    fees.length === 0
  ) {
    return 0;
  }

  try {
    const existingStudents = await getDocs(
      query(buildCollectionQuery('students', uid, email), limit(1))
    );
    if (!existingStudents.empty) {
      return 0;
    }

    const nowTs = serverTimestamp();
    const safeTodayIso = normalizeIsoDate(activeDateIso, '2026-11-21');
    let batch = writeBatch(db);
    let opsInBatch = 0;

    const flushIfNeeded = async (needed = 1) => {
      if (opsInBatch + needed > 450) {
        await batch.commit();
        batch = writeBatch(db);
        opsInBatch = 0;
      }
    };

    for (const student of students) {
      await flushIfNeeded(2);
      batch.set(doc(db, 'students', student.id), {
        id: student.id,
        name: clampBoundedText(student.name, 'Student', 120),
        shift: student.shift,
        program: student.program,
        courses:
          student.courses.length > 0
            ? student.courses.slice(0, 6)
            : ['MS-Word'],
        enrolledDate: normalizeIsoDate(student.enrolledDate, safeTodayIso),
        status: student.status === 'Completed' ? 'Completed' : 'Active',
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
        updatedAt: nowTs,
      });
      batch.set(doc(db, 'student_contacts', student.id), {
        studentId: student.id,
        phone: clampBoundedText(student.phone, 'Not provided', 40),
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
        updatedAt: nowTs,
      });
      opsInBatch += 2;
    }

    for (const rec of attendance) {
      await flushIfNeeded(1);
      batch.set(doc(db, 'attendance_current', rec.studentId), {
        studentId: rec.studentId,
        studentName: clampBoundedText(rec.studentName, 'Student', 120),
        shift: rec.shift,
        program: rec.program,
        status: rec.status,
        note: clampText(rec.note ?? '', 300),
        rollCallDate: normalizeIsoDate(rec.rollCallDate, safeTodayIso),
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
        updatedAt: nowTs,
      });
      opsInBatch += 1;
    }

    for (const entry of attendanceHistory) {
      await flushIfNeeded(1);
      batch.set(doc(db, 'attendance_history', entry.id), {
        id: entry.id,
        date: normalizeIsoDate(entry.date, safeTodayIso),
        dateLabel: clampBoundedText(entry.dateLabel, safeTodayIso, 80),
        studentId: entry.studentId,
        studentName: clampBoundedText(entry.studentName, 'Student', 120),
        shift: entry.shift,
        program: entry.program,
        status: entry.status,
        excuseReason: clampText(entry.excuseReason ?? '', 300),
        recordedBy: clampBoundedText(entry.recordedBy, 'Staff', 80),
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
      });
      opsInBatch += 1;
    }

    for (const ex of exams) {
      await flushIfNeeded(1);
      batch.set(doc(db, 'exams', ex.id), {
        id: ex.id,
        studentId: ex.studentId,
        studentName: clampBoundedText(ex.studentName, 'Student', 120),
        course: ex.course,
        score: Math.max(0, Math.min(100, Number(ex.score) || 0)),
        status: ex.status === 'Fail' ? 'Fail' : 'Pass',
        gradedBy: clampBoundedText(ex.gradedBy, 'Teacher', 80),
        date: normalizeIsoDate(ex.date, safeTodayIso),
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
      });
      opsInBatch += 1;
    }

    for (const fee of fees) {
      await flushIfNeeded(1);
      batch.set(doc(db, 'fees', fee.id), {
        id: fee.id,
        studentId: fee.studentId,
        studentName: clampBoundedText(fee.studentName, 'Student', 120),
        courses: clampBoundedText(fee.courses, 'Courses', 240),
        amount: Math.max(0, Math.min(1000000, Number(fee.amount) || 0)),
        paymentMethod: fee.paymentMethod,
        receivedAmount: clampText(fee.receivedAmount, 40),
        paid: Boolean(fee.paid),
        submitted: Boolean(fee.submitted ?? true),
        dueDate: normalizeIsoDate(fee.dueDate, safeTodayIso),
        cashier: clampText(fee.cashier ?? '', 80),
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
        updatedAt: nowTs,
      });
      opsInBatch += 1;
    }

    for (const logItem of activityLogs.slice(0, 40)) {
      await flushIfNeeded(1);
      batch.set(doc(db, 'activity_logs', logItem.id), {
        id: logItem.id,
        timestamp: clampBoundedText(logItem.timestamp, 'Synced', 64),
        date: normalizeIsoDate(logItem.date, safeTodayIso),
        studentId: logItem.studentId,
        studentName: clampBoundedText(logItem.studentName, 'Student', 120),
        actionType: logItem.actionType,
        details: clampBoundedText(logItem.details, 'Recorded activity', 320),
        staffRole: clampBoundedText(logItem.staffRole, 'Staff', 80),
        status: logItem.status,
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
      });
      opsInBatch += 1;
    }

    for (const notif of notifications.slice(0, 20)) {
      await flushIfNeeded(1);
      batch.set(doc(db, 'notifications', notif.id), {
        id: notif.id,
        title: clampBoundedText(notif.title, 'System Notification', 240),
        time: clampBoundedText(notif.time, 'Synced', 64),
        date: normalizeIsoDate(notif.date, safeTodayIso),
        read: Boolean(notif.read),
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
        updatedAt: nowTs,
      });
      opsInBatch += 1;
    }

    const clockRef = doc(db, 'system_meta', SYSTEM_CLOCK_DOC_ID);
    if (!(await getDoc(clockRef)).exists()) {
      await flushIfNeeded(1);
      batch.set(clockRef, {
        id: SYSTEM_CLOCK_DOC_ID,
        activeRollCallDate: safeTodayIso,
        ownerUid: uid,
        authorizedUids: [uid],
        createdAt: nowTs,
        updatedAt: nowTs,
      });
      opsInBatch += 1;
    }

    if (opsInBatch > 0) {
      await batch.commit();
    }
    return students.length;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'students');
  }
}
