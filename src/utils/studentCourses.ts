import type { CourseName, Student } from '../types/sms';

export const MS_OFFICE_COURSES: CourseName[] = [
  'MS-Word',
  'MS-Excel',
  'MS-Access',
  'MS-PowerPoint',
  'Introduction to Windows',
  'MS-Publisher',
];

export function getStudentRegisteredCourses(student?: Student): CourseName[] {
  const raw = student?.courses ?? [];
  const valid = raw.filter((course): course is CourseName =>
    MS_OFFICE_COURSES.includes(course)
  );
  const unique = Array.from(new Set(valid));
  return unique.length > 0 ? unique : [...MS_OFFICE_COURSES];
}

export function formatStudentCoursesLabel(student?: Student): string {
  const courses = getStudentRegisteredCourses(student);
  if (courses.length === MS_OFFICE_COURSES.length) {
    return 'All MS Office Courses';
  }
  return courses.join(', ');
}

export function getStudentFeeCourseOptions(student?: Student): string[] {
  const registered = getStudentRegisteredCourses(student);
  if (registered.length === MS_OFFICE_COURSES.length) {
    return ['All MS Office Courses', ...registered];
  }
  if (registered.length > 1) {
    return [registered.join(', '), ...registered];
  }
  return [...registered];
}
