import { useEffect, useState } from 'react';
import type { AttendanceHistoryEntry, AttendanceRecord } from '../types/sms';

export interface LiveDateSnapshot {
  year: number;
  todayIso: string;
  yesterdayIso: string;
  currentMonthIso: string;
  fullDateLabel: string;
  shortTodayLabel: string;
  shortYesterdayLabel: string;
  fullYesterdayLabel: string;
  shortMonthLabel: string;
  longMonthLabel: string;
  academicYearLabel: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toLocalIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

export function parseLocalIsoDate(isoDate: string): Date {
  const parts = isoDate.split('-').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return new Date();
  }
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
}

export function getYesterdayDate(date: Date = new Date()): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - 1,
    12,
    0,
    0,
    0
  );
}

export function getYesterdayIsoDate(date: Date = new Date()): string {
  return toLocalIsoDate(getYesterdayDate(date));
}

export function getCurrentMonthIso(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function formatFullDisplayDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatIsoAsFullDisplayDate(isoDate: string): string {
  return formatFullDisplayDate(parseLocalIsoDate(isoDate));
}

export function formatShortMonthDay(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatShortMonthYear(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

export function formatLongMonthYear(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatActivityTimestamp(date: Date = new Date()): string {
  const datePart = formatShortMonthDay(date);
  const timePart = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart}, ${timePart}`;
}

export function buildLiveDateSnapshot(now: Date = new Date()): LiveDateSnapshot {
  const year = now.getFullYear();
  const yesterday = getYesterdayDate(now);
  return {
    year,
    todayIso: toLocalIsoDate(now),
    yesterdayIso: toLocalIsoDate(yesterday),
    currentMonthIso: getCurrentMonthIso(now),
    fullDateLabel: formatFullDisplayDate(now),
    shortTodayLabel: formatShortMonthDay(now),
    shortYesterdayLabel: formatShortMonthDay(yesterday),
    fullYesterdayLabel: formatFullDisplayDate(yesterday),
    shortMonthLabel: formatShortMonthYear(now),
    longMonthLabel: formatLongMonthYear(now),
    academicYearLabel: `${year} / ${year + 1}`,
  };
}

export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    250
  );
  return Math.max(1000, nextMidnight.getTime() - now.getTime());
}

export interface MidnightRolloverResult {
  rolledOver: boolean;
  previousDate: string | null;
  newDate: string;
  archivedEntries: AttendanceHistoryEntry[];
  nextAttendance: AttendanceRecord[];
  nextHistory: AttendanceHistoryEntry[];
}

export function computeMidnightRollover(params: {
  attendance: AttendanceRecord[];
  attendanceHistory: AttendanceHistoryEntry[];
  activeRollCallDate: string | null;
  newDateIso: string;
  staffLabel: string;
}): MidnightRolloverResult {
  const {
    attendance,
    attendanceHistory,
    activeRollCallDate,
    newDateIso,
    staffLabel,
  } = params;

  if (!activeRollCallDate || activeRollCallDate === newDateIso) {
    return {
      rolledOver: false,
      previousDate: activeRollCallDate,
      newDate: newDateIso,
      archivedEntries: [],
      nextAttendance: attendance.map((rec) => ({
        ...rec,
        rollCallDate: rec.rollCallDate ?? newDateIso,
      })),
      nextHistory: attendanceHistory,
    };
  }

  const compactPrev = activeRollCallDate.replace(/-/g, '');
  const prevDateLabel = formatIsoAsFullDisplayDate(activeRollCallDate);

  const existingKeysForPrevDay = new Set(
    attendanceHistory
      .filter((entry) => entry.date === activeRollCallDate)
      .map((entry) => entry.studentId)
  );

  const archivedEntries: AttendanceHistoryEntry[] = attendance
    .filter((rec) => !existingKeysForPrevDay.has(rec.studentId))
    .map((rec) => ({
      id: `AH-${compactPrev}-${rec.studentId}`,
      date: activeRollCallDate,
      dateLabel: prevDateLabel,
      studentId: rec.studentId,
      studentName: rec.studentName,
      shift: rec.shift,
      program: rec.program,
      status: rec.status,
      excuseReason: rec.note?.trim() ? rec.note.trim() : undefined,
      recordedBy: staffLabel || 'System Daily Rollover',
    }));

  const nextAttendance: AttendanceRecord[] = attendance.map((rec) => ({
    studentId: rec.studentId,
    studentName: rec.studentName,
    shift: rec.shift,
    program: rec.program,
    status: 'Present',
    note: '',
    rollCallDate: newDateIso,
  }));

  const nextHistory =
    archivedEntries.length > 0
      ? [...archivedEntries, ...attendanceHistory]
      : attendanceHistory;

  return {
    rolledOver: true,
    previousDate: activeRollCallDate,
    newDate: newDateIso,
    archivedEntries,
    nextAttendance,
    nextHistory,
  };
}

export function useLiveDate(): LiveDateSnapshot {
  const [snapshot, setSnapshot] = useState<LiveDateSnapshot>(() =>
    buildLiveDateSnapshot()
  );

  useEffect(() => {
    let timerId: number | undefined;

    const refresh = () => {
      const next = buildLiveDateSnapshot(new Date());
      setSnapshot((prev) => (prev.todayIso === next.todayIso ? prev : next));
    };

    const scheduleMidnight = () => {
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
      const delay = msUntilNextLocalMidnight(new Date());
      timerId = window.setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, delay);
    };

    scheduleMidnight();

    const intervalId = window.setInterval(refresh, 30000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    const onFocus = () => refresh();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return snapshot;
}
