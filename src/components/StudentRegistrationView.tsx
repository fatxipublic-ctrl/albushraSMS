import React, { useState } from 'react';
import { CheckCircle2, Trash2, UserPlus, Users } from 'lucide-react';
import type { CourseName, ProgramType, ShiftType, Student } from '../types/sms';

interface StudentRegistrationViewProps {
  students: Student[];
  searchQuery: string;
  onRegisterStudent: (payload: {
    name: string;
    shift: ShiftType;
    program: ProgramType;
    courses: CourseName[];
    phone: string;
  }) => Student;
  onDeleteStudent: (studentId: string) => void;
}

const SHIFTS: ShiftType[] = ['Morning Shift', 'Afternoon Shift', 'Evening Shift'];
const PROGRAMS: ProgramType[] = ['Crush Program', 'Normal Program'];
const MS_OFFICE_COURSES: CourseName[] = [
  'MS-Word',
  'MS-Excel',
  'MS-Access',
  'MS-PowerPoint',
  'Introduction to Windows',
  'MS-Publisher',
];

export const StudentRegistrationView: React.FC<StudentRegistrationViewProps> = ({
  students,
  searchQuery,
  onRegisterStudent,
  onDeleteStudent,
}) => {
  const [name, setName] = useState('');
  const [shift, setShift] = useState<ShiftType>('Morning Shift');
  const [program, setProgram] = useState<ProgramType>('Crush Program');
  const [selectedCourses, setSelectedCourses] = useState<CourseName[]>(
    MS_OFFICE_COURSES
  );
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<Student | null>(null);
  const [deletedNotice, setDeletedNotice] = useState<string | null>(null);
  const [shiftFilter, setShiftFilter] = useState<'All' | ShiftType>('All');

  const allSelected = selectedCourses.length === MS_OFFICE_COURSES.length;

  const toggleCourse = (course: CourseName) => {
    setSelectedCourses((prev) =>
      prev.includes(course)
        ? prev.filter((c) => c !== course)
        : [...prev, course]
    );
  };

  const handleToggleAllCourses = () => {
    setSelectedCourses(allSelected ? [] : [...MS_OFFICE_COURSES]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Student full name is required.');
      return;
    }
    if (selectedCourses.length === 0) {
      setError('Please select at least one MS Office course.');
      return;
    }
    if (!phone.trim()) {
      setError('Contact phone number is required.');
      return;
    }
    setError(null);
    const created = onRegisterStudent({
      name: name.trim(),
      shift,
      program,
      courses: selectedCourses,
      phone: phone.trim(),
    });
    setLastCreated(created);
    setName('');
    setPhone('');
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredStudents = students.filter((s) => {
    const coursesList = s.courses ?? [];
    const matchesShift = shiftFilter === 'All' || s.shift === shiftFilter;
    const matchesQuery =
      !q ||
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.program.toLowerCase().includes(q) ||
      s.shift.toLowerCase().includes(q) ||
      coursesList.some((c) => c.toLowerCase().includes(q));
    return matchesShift && matchesQuery;
  });

  const formatCoursesDisplay = (courses: CourseName[] = []) => {
    if (courses.length === MS_OFFICE_COURSES.length) {
      return 'All MS Office Courses';
    }
    return courses.join(', ');
  };

  const handleDelete = (st: Student) => {
    onDeleteStudent(st.id);
    if (lastCreated?.id === st.id) {
      setLastCreated(null);
    }
    setDeletedNotice(`Deleted ${st.name} (${st.id}) from roster.`);
    setTimeout(() => setDeletedNotice(null), 3500);
  };

  return (
    <div className="grid grid-cols-1 gap-5 p-6 xl:grid-cols-[310px_minmax(0,1fr)]">
      {/* Admission Form */}
      <section>
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#1D4ED8]">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[14.5px] font-bold text-[#0F172A]">
                Admit New Student
              </h2>
              <p className="text-[11.5px] text-slate-500">
                Assign shift, program &amp; generate student ID
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            <div>
              <label
                htmlFor="reg-name"
                className="block text-[12px] font-semibold text-slate-700"
              >
                Student Full Name
              </label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nadia Abdi"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              />
            </div>

            <div>
              <label
                htmlFor="reg-shift"
                className="block text-[12px] font-semibold text-slate-700"
              >
                Study Shift
              </label>
              <select
                id="reg-shift"
                value={shift}
                onChange={(e) => setShift(e.target.value as ShiftType)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              >
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="reg-program"
                className="block text-[12px] font-semibold text-slate-700"
              >
                Academic Program
              </label>
              <select
                id="reg-program"
                value={program}
                onChange={(e) => setProgram(e.target.value as ProgramType)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              >
                {PROGRAMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Courses (All MS Office Courses) */}
            <div>
              <div className="flex items-center justify-between">
                <span className="block text-[12px] font-semibold text-slate-700">
                  Courses (MS Office)
                </span>
                <button
                  type="button"
                  onClick={handleToggleAllCourses}
                  className="text-[11.5px] font-semibold text-[#1E3A8A] hover:underline cursor-pointer"
                >
                  {allSelected ? 'Clear All' : 'All MS Office Courses'}
                </button>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-[#F8FAFC] p-2.5">
                {MS_OFFICE_COURSES.map((course) => {
                  const checked = selectedCourses.includes(course);
                  return (
                    <label
                      key={course}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors select-none ${
                        checked
                          ? 'border-[#1E3A8A]/30 bg-[#EFF6FF] text-[#1E3A8A]'
                          : 'border-slate-200/80 bg-white text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCourse(course)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
                      />
                      <span className="leading-tight">{course}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-phone"
                className="block text-[12px] font-semibold text-slate-700"
              >
                Contact Phone
              </label>
              <input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+252 61 500 1234"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700"
              >
                {error}
              </div>
            )}

            {lastCreated && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3 py-2.5 text-[12px] text-[#059669]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  Enrolled <span className="font-bold">{lastCreated.name}</span> (
                  <span className="font-mono font-semibold">{lastCreated.id}</span>)
                </div>
              </div>
            )}

            <button
              type="submit"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] text-[13px] font-semibold text-white transition-colors hover:bg-[#172E6E] cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Register Student</span>
            </button>
          </form>
        </div>
      </section>

      {/* Roster Table */}
      <section className="min-w-0">
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <Users className="h-4 w-4 text-[#1E3A8A]" />
              <h2 className="text-[14.5px] font-bold text-[#0F172A]">
                Registered Student Roster ({filteredStudents.length})
              </h2>
              {deletedNotice && (
                <span
                  role="status"
                  className="ml-2 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#DC2626]"
                >
                  {deletedNotice}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['All', ...SHIFTS] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShiftFilter(s)}
                  className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors cursor-pointer ${
                    shiftFilter === s
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s === 'All' ? 'All Shifts' : s.replace(' Shift', '')}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-[#F8FAFC] text-[11px] font-semibold text-slate-500">
                  <th className="px-2.5 py-3">Student ID</th>
                  <th className="px-2.5 py-3">Full Name</th>
                  <th className="px-2.5 py-3">Shift</th>
                  <th className="px-2.5 py-3">Program</th>
                  <th className="px-2.5 py-3">Courses</th>
                  <th className="px-2.5 py-3">Phone</th>
                  <th className="px-2.5 py-3">Status</th>
                  <th className="px-2.5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11.5px]">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-8 text-center text-[13px] text-slate-500"
                    >
                      No registered students match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-2.5 py-3 font-mono text-[11px] font-semibold text-[#1E3A8A] tabular-nums">
                        {st.id}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3 text-[12px] font-semibold text-[#0F172A]">
                        {st.name}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3 text-slate-600">
                        {st.shift.replace(' Shift', '')}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3 font-medium text-slate-700">
                        {st.program}
                      </td>
                      <td className="max-w-[145px] px-2.5 py-3 leading-snug text-slate-600">
                        {formatCoursesDisplay(st.courses)}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3 text-slate-500 tabular-nums">
                        {st.phone}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3">
                        <span className="inline-flex rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10.5px] font-semibold text-[#059669]">
                          {st.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3 text-right">
                        <button
                          type="button"
                          aria-label={`Delete ${st.name}`}
                          onClick={() => handleDelete(st)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200/80 bg-white px-2 py-1 text-[11px] font-semibold text-[#DC2626] transition-colors hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
