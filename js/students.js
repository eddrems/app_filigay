import { getSupabase } from './supabase.js';
import { isSupabaseConfigured } from './supabase.js';

export async function fetchStudents() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, student_id, role, created_at')
    .eq('role', 'student')
    .order('full_name');

  if (error) throw error;
  return data ?? [];
}

export async function fetchEnrollments() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, student_id, course_id, status, enrolled_at')
    .eq('status', 'active');

  if (error) throw error;
  return data ?? [];
}

export async function fetchStudentEnrollmentsWithCourses(studentId) {
  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from('enrollments')
    .select('id, course_id, status, enrolled_at')
    .eq('student_id', studentId)
    .eq('status', 'active');

  if (error) throw error;
  if (!rows?.length) return [];

  const courseIds = rows.map((r) => r.course_id);
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id, title, cover_image_url, price, is_active')
    .in('id', courseIds);

  if (coursesError) throw coursesError;
  const byId = Object.fromEntries((courses ?? []).map((c) => [c.id, c]));

  return rows.map((row) => ({
    ...row,
    course: byId[row.course_id] ?? null,
  }));
}

export async function fetchMyEnrollments(studentId) {
  return fetchStudentEnrollmentsWithCourses(studentId);
}

export async function isStudentEnrolledInCourse(courseId, studentId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function createStudent({ email, fullName, phone, studentId }) {
  if (!isSupabaseConfigured()) {
    throw new Error('Configura Supabase para crear estudiantes.');
  }
  const phoneTrim = phone.trim();
  if (phoneTrim.length < 6) {
    throw new Error('El teléfono debe tener al menos 6 caracteres (será la clave inicial).');
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('admin_create_student_user', {
    p_email: email.trim(),
    p_full_name: fullName.trim(),
    p_phone: phoneTrim,
    p_student_id: studentId?.trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function syncStudentEnrollments(studentId, courseIds) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('admin_sync_student_enrollments', {
    p_student_id: studentId,
    p_course_ids: courseIds,
  });
  if (error) throw error;
  return data;
}

export function groupEnrollmentsByStudent(enrollments) {
  const map = {};
  for (const row of enrollments) {
    if (!map[row.student_id]) map[row.student_id] = [];
    map[row.student_id].push(row.course_id);
  }
  return map;
}

export function studentInitials(name) {
  return (name || '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
