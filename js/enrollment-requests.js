import { getSupabase } from './supabase.js';
import { isSupabaseConfigured } from './supabase.js';
import { fetchTeachers } from './courses.js';

export const REQUEST_STATUS_LABELS = {
  pending: { label: 'Pendiente', tone: 'pending' },
  approved: { label: 'Aprobada', tone: 'success' },
  rejected: { label: 'Rechazada', tone: 'danger' },
};

export async function fetchActiveCourses() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, cover_image_url, price, teacher_id, is_active')
    .eq('is_active', true)
    .order('title');

  if (error) throw error;
  const teachers = await fetchTeachers();
  const byId = Object.fromEntries(teachers.map((t) => [t.id, t]));
  return (data ?? []).map((c) => ({
    ...c,
    teacher: c.teacher_id ? byId[c.teacher_id] ?? null : null,
  }));
}

export async function fetchMyEnrollmentRequests(studentId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('enrollment_requests')
    .select('id, course_id, status, message, admin_notes, created_at, reviewed_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function submitEnrollmentRequest(courseId, message = '') {
  if (!isSupabaseConfigured()) {
    throw new Error('Configura Supabase para solicitar matrícula.');
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('student_submit_enrollment_request', {
    p_course_id: courseId,
    p_message: message?.trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function fetchEnrollmentRequestsForAdmin(statusFilter = 'pending') {
  const supabase = getSupabase();
  let query = supabase
    .from('enrollment_requests')
    .select('id, student_id, course_id, status, message, admin_notes, created_at, reviewed_at')
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: requests, error } = await query;
  if (error) throw error;
  if (!requests?.length) return [];

  const studentIds = [...new Set(requests.map((r) => r.student_id))];
  const courseIds = [...new Set(requests.map((r) => r.course_id))];

  const [{ data: students }, { data: courses }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, student_id')
      .in('id', studentIds),
    supabase.from('courses').select('id, title, price, cover_image_url').in('id', courseIds),
  ]);

  const studentById = Object.fromEntries((students ?? []).map((s) => [s.id, s]));
  const courseById = Object.fromEntries((courses ?? []).map((c) => [c.id, c]));

  return requests.map((r) => ({
    ...r,
    student: studentById[r.student_id] ?? null,
    course: courseById[r.course_id] ?? null,
  }));
}

export async function reviewEnrollmentRequest(requestId, approve, adminNotes = '') {
  if (!isSupabaseConfigured()) {
    throw new Error('Configura Supabase para revisar solicitudes.');
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('admin_review_enrollment_request', {
    p_request_id: requestId,
    p_approve: approve,
    p_admin_notes: adminNotes?.trim() || null,
  });
  if (error) throw error;
  return data;
}

export function requestStatusLabel(status) {
  return REQUEST_STATUS_LABELS[status] || { label: status, tone: 'neutral' };
}
