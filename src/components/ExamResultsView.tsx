import React, { useState } from 'react';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import type { CourseName, ExamResult, Student } from '../types/sms';
import { computeExamStatus } from '../utils/smsCalculations';
import { getStudentRegisteredCourses } from '../utils/studentCourses';

interface ExamResultsViewProps {
  students: Student[];
  exams: ExamResult[];
  searchQuery: string;
  onAddExamResult: (payload: {
    studentId: string;
    course: CourseName;
    score: number;
  }) => ExamResult;
}

export const ExamResultsView: React.FC<ExamResultsViewProps> = ({
  students,
  exams,
  searchQuery,
  onAddExamResult,
}) => {
  const initialStudent = students[0];
  const [studentId, setStudentId] = useState(initialStudent?.id ?? '');
  const [course, setCourse] = useState<CourseName>(
    () => getStudentRegisteredCourses(initialStudent)[0]
  );
  const [scoreText, setScoreText] = useState('88');
  const [error, setError] = useState<string | null>(null);
  const [savedExam, setSavedExam] = useState<ExamResult | null>(null);

  const selectedStudent =
    students.find((s) => s.id === studentId) ?? students[0];
  const effectiveStudentId = selectedStudent?.id ?? '';
  const availableCourses = getStudentRegisteredCourses(selectedStudent);
  const effectiveCourse = availableCourses.includes(course)
    ? course
    : availableCourses[0];

  const handleStudentChange = (nextStudentId: string) => {
    setStudentId(nextStudentId);
    const nextStudent = students.find((s) => s.id === nextStudentId);
    const nextCourses = getStudentRegisteredCourses(nextStudent);
    if (!nextCourses.includes(course)) {
      setCourse(nextCourses[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveStudentId) {
      setError('Please register a student first before recording exam marks.');
      return;
    }
    const numeric = Number(scoreText);
    if (Number.isNaN(numeric) || numeric < 0 || numeric > 100) {
      setError('Score must be a valid number between 0 and 100.');
      return;
    }
    setError(null);
    const created = onAddExamResult({
      studentId: effectiveStudentId,
      course: effectiveCourse,
      score: Math.round(numeric),
    });
    setSavedExam(created);
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredExams = exams.filter(
    (ex) =>
      !q ||
      ex.studentId.toLowerCase().includes(q) ||
      ex.studentName.toLowerCase().includes(q) ||
      ex.course.toLowerCase().includes(q)
  );

  const previewScore = Number(scoreText);
  const previewValid = !Number.isNaN(previewScore) && previewScore >= 0 && previewScore <= 100;

  return (
    <div className="grid grid-cols-1 gap-6 p-7 lg:grid-cols-12">
      {/* Grade Entry Card */}
      <section className="lg:col-span-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#1D4ED8]">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[14.5px] font-bold text-[#0F172A]">
                Record Exam Marks
              </h2>
              <p className="text-[11.5px] text-slate-500">
                Passing threshold is 60 / 100
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            <div>
              <label
                htmlFor="exam-student"
                className="block text-[12px] font-semibold text-slate-700"
              >
                Student
              </label>
              <select
                id="exam-student"
                value={effectiveStudentId}
                disabled={students.length === 0}
                onChange={(e) => handleStudentChange(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              >
                {students.length === 0 ? (
                  <option value="">No registered students yet</option>
                ) : (
                  students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.id} • {st.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="exam-course"
                className="block text-[12px] font-semibold text-slate-700"
              >
                Courses
              </label>
              <select
                id="exam-course"
                value={effectiveCourse}
                disabled={students.length === 0}
                onChange={(e) => setCourse(e.target.value as CourseName)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              >
                {availableCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="exam-score"
                  className="block text-[12px] font-semibold text-slate-700"
                >
                  Score (0–100)
                </label>
                {previewValid && (
                  <span
                    className={`text-[11px] font-bold ${
                      computeExamStatus(previewScore) === 'Pass'
                        ? 'text-[#059669]'
                        : 'text-[#DC2626]'
                    }`}
                  >
                    Mark: {computeExamStatus(previewScore)}
                  </span>
                )}
              </div>
              <input
                id="exam-score"
                type="number"
                min={0}
                max={100}
                value={scoreText}
                onChange={(e) => setScoreText(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 tabular-nums focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
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

            {savedExam && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3 py-2.5 text-[12px] text-[#059669]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  Recorded <span className="font-bold">{savedExam.course}</span>:{' '}
                  {savedExam.score}/100 ({savedExam.status}) for{' '}
                  {savedExam.studentName}.
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={students.length === 0}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] text-[13px] font-semibold text-white transition-colors hover:bg-[#172E6E] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <ClipboardCheck className="h-4 w-4" />
              <span>Save Exam Result</span>
            </button>
          </form>
        </div>
      </section>

      {/* Gradebook Table */}
      <section className="lg:col-span-8">
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-[14.5px] font-bold text-[#0F172A]">
              MS Office Gradebook ({filteredExams.length} Entries)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-[#F8FAFC] text-[11px] font-semibold text-slate-500">
                  <th className="px-5 py-3">Student ID / Name</th>
                  <th className="px-5 py-3">Course</th>
                  <th className="px-5 py-3">Score</th>
                  <th className="px-5 py-3">Graded By</th>
                  <th className="px-5 py-3 text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[12.5px]">
                {filteredExams.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-[13px] text-slate-500"
                    >
                      {exams.length === 0
                        ? 'No exam results recorded yet. Register a student first, then enter course marks.'
                        : `No exam entries match \u201C${searchQuery}\u201D.`}
                    </td>
                  </tr>
                ) : (
                  filteredExams.map((ex) => (
                    <tr key={ex.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className="font-semibold text-[#0F172A] tabular-nums">
                          {ex.studentId}
                        </span>
                        <span className="mx-1.5 text-slate-400">•</span>
                        <span className="text-slate-600">{ex.studentName}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-medium text-[#1D4ED8]">
                        {ex.course}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-bold text-[#0F172A] tabular-nums">
                        {ex.score} / 100
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                        {ex.gradedBy}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            ex.status === 'Pass'
                              ? 'bg-[#ECFDF5] text-[#059669]'
                              : 'bg-red-50 text-[#DC2626]'
                          }`}
                        >
                          {ex.status}
                        </span>
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
