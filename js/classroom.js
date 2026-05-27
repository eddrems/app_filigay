import { getSupabase } from './supabase.js';
import { getSession } from './auth.js';

export const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

export const ATTENDANCE_STATUSES = [
  { value: 'present', label: 'Presente', icon: 'check_circle', tone: 'success' },
  { value: 'late', label: 'Tarde', icon: 'schedule', tone: 'warn' },
  { value: 'excused', label: 'Justificado', icon: 'info', tone: 'neutral' },
  { value: 'absent', label: 'Ausente', icon: 'cancel', tone: 'danger' },
];

export function attendanceStatusMeta(status) {
  if (!status) {
    return { label: 'Sin registro', icon: 'help', tone: 'neutral' };
  }
  const found = ATTENDANCE_STATUSES.find((s) => s.value === status);
  return found || { label: status, icon: 'help', tone: 'neutral' };
}

/** Estado de una actividad para el portal del estudiante */
export function getStudentActivityStatus(activity, grade, hasSubmission) {
  if (grade !== null && grade !== undefined && grade !== '') {
    return {
      key: 'graded',
      label: 'Calificada',
      badge: 'success',
      score: Number(grade),
    };
  }
  if (activity.allow_online_submit) {
    if (hasSubmission) {
      return { key: 'submitted', label: 'Entregada', badge: 'success', score: null };
    }
    if (activity.due_at && new Date(activity.due_at) < new Date()) {
      return { key: 'overdue', label: 'Vencida', badge: 'danger', score: null };
    }
    return { key: 'pending', label: 'Pendiente', badge: 'pending', score: null };
  }
  return { key: 'info', label: 'Sin entrega en línea', badge: 'neutral', score: null };
}

export function formatShortDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

/** Genera fechas para un día de la semana entre dos fechas (inclusive) */
export function buildSessionsFromRange({
  weekday,
  startDate,
  endDate,
  startTime = '19:00',
  endTime = null,
  label = null,
}) {
  const sessions = [];
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end || start > end) return sessions;

  const cursor = new Date(start);
  while (cursor <= end) {
    if (cursor.getDay() === Number(weekday)) {
      sessions.push({
        session_date: formatDateYmd(cursor),
        start_time: normalizeTime(startTime),
        end_time: endTime ? normalizeTime(endTime) : null,
        label: label || null,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return sessions;
}

function parseLocalDate(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

function formatDateYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeTime(t) {
  if (!t) return '19:00:00';
  return t.length === 5 ? `${t}:00` : t;
}

export function formatSessionDateTime(session) {
  if (!session?.session_date) return '—';
  const d = parseLocalDate(session.session_date);
  const dateStr = d
    ? d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : session.session_date;
  const time = (session.start_time || '').slice(0, 5);
  const end = session.end_time ? ` – ${session.end_time.slice(0, 5)}` : '';
  return `${dateStr} · ${time}${end}`;
}

export function formatDueDate(iso) {
  if (!iso) return 'Sin fecha';
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function fetchCourseStudents(courseId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      `
      student_id,
      student:profiles!enrollments_student_id_fkey (
        id, full_name, email, student_id
      )
    `,
    )
    .eq('course_id', courseId)
    .eq('status', 'active')
    .order('student_id');

  if (error) {
    const { data: fallback, error: err2 } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('course_id', courseId)
      .eq('status', 'active');

    if (err2) throw err2;

    const ids = (fallback ?? []).map((r) => r.student_id);
    if (!ids.length) return [];

    const { data: profiles, error: err3 } = await supabase
      .from('profiles')
      .select('id, full_name, email, student_id')
      .in('id', ids);

    if (err3) throw err3;
    return (profiles ?? []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }

  return (data ?? [])
    .map((row) => row.student)
    .filter(Boolean)
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
}

export async function fetchCourseSessions(courseId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('course_sessions')
    .select('*')
    .eq('course_id', courseId)
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createSessionsBulk(courseId, sessions) {
  if (!sessions.length) return [];
  const supabase = getSupabase();
  const rows = sessions.map((s) => ({
    course_id: courseId,
    session_date: s.session_date,
    start_time: s.start_time,
    end_time: s.end_time,
    label: s.label,
  }));

  const { data, error } = await supabase
    .from('course_sessions')
    .upsert(rows, { onConflict: 'course_id,session_date,start_time', ignoreDuplicates: true })
    .select();

  if (error) throw error;
  return data ?? [];
}

export async function deleteSession(sessionId) {
  const supabase = getSupabase();
  const { error } = await supabase.from('course_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

export async function fetchAttendanceForSession(sessionId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('session_id', sessionId);

  if (error) throw error;
  return data ?? [];
}

/** Toda la asistencia del curso (todas las sesiones) */
export async function fetchAttendanceForCourse(courseId) {
  const sessions = await fetchCourseSessions(courseId);
  const sessionIds = sessions.map((s) => s.id);
  if (!sessionIds.length) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .in('session_id', sessionIds);

  if (error) throw error;
  return data ?? [];
}

const ATTENDED_STATUSES = new Set(['present', 'late', 'excused']);

export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value * 10) / 10}%`;
}

export function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return String(Math.round(value * 10) / 10);
}

/**
 * Estadísticas de asistencia y calificaciones del curso
 */
export function buildCourseStatistics(
  students,
  sessions,
  activities,
  grades,
  attendanceRecords,
  submissions = [],
) {
  const sessionIds = sessions.map((s) => s.id);
  const sessionSet = new Set(sessionIds);
  const activityIds = activities.map((a) => a.id);

  const recordsInCourse = attendanceRecords.filter((r) => sessionSet.has(r.session_id));
  const sessionsWithData = new Set(recordsInCourse.map((r) => r.session_id));
  const sessionsTakenCount = sessionsWithData.size;

  const bySessionStudent = new Map();
  for (const r of recordsInCourse) {
    bySessionStudent.set(`${r.session_id}:${r.student_id}`, r.status);
  }

  let coursePresentSlots = 0;
  let courseTotalSlots = 0;

  const attendanceByStudent = students.map((student) => {
    const counts = { present: 0, late: 0, excused: 0, absent: 0, unmarked: 0 };
    for (const sid of sessionsWithData) {
      const status = bySessionStudent.get(`${sid}:${student.id}`);
      if (!status) {
        counts.unmarked += 1;
        courseTotalSlots += 1;
        continue;
      }
      if (counts[status] !== undefined) counts[status] += 1;
      else counts.absent += 1;
      courseTotalSlots += 1;
      if (ATTENDED_STATUSES.has(status)) coursePresentSlots += 1;
    }
    const marked = counts.present + counts.late + counts.excused + counts.absent;
    const attended = counts.present + counts.late + counts.excused;
    const rate = marked > 0 ? (attended / marked) * 100 : null;

    return {
      studentId: student.id,
      fullName: student.full_name,
      studentCode: student.student_id,
      counts,
      markedSessions: marked,
      rate,
    };
  });

  const attendanceRates = attendanceByStudent
    .map((r) => r.rate)
    .filter((r) => r !== null);
  const courseAttendanceRate =
    courseTotalSlots > 0 ? (coursePresentSlots / courseTotalSlots) * 100 : null;
  const avgStudentAttendanceRate =
    attendanceRates.length > 0
      ? attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length
      : null;

  const gradesByStudent = students.map((student) => {
    const studentGrades = grades.filter(
      (g) => g.student_id === student.id && activityIds.includes(g.activity_id),
    );
    const scores = studentGrades.map((g) => Number(g.score));
    const average =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const min = scores.length ? Math.min(...scores) : null;
    const max = scores.length ? Math.max(...scores) : null;

    return {
      studentId: student.id,
      fullName: student.full_name,
      studentCode: student.student_id,
      gradedCount: scores.length,
      totalActivities: activities.length,
      average,
      min,
      max,
      scores,
    };
  });

  const activityStats = activities.map((activity) => {
    const actGrades = grades.filter((g) => g.activity_id === activity.id);
    const scores = actGrades.map((g) => Number(g.score));
    const average =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const submissionCount = submissions.filter((s) => s.activity_id === activity.id).length;

    return {
      activityId: activity.id,
      title: activity.title,
      gradedCount: scores.length,
      submissionCount,
      totalStudents: students.length,
      average,
      min: scores.length ? Math.min(...scores) : null,
      max: scores.length ? Math.max(...scores) : null,
    };
  });

  const allScores = grades
    .filter((g) => activityIds.includes(g.activity_id))
    .map((g) => Number(g.score));
  const courseGradeAverage =
    allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;

  const studentAverages = gradesByStudent
    .map((g) => g.average)
    .filter((a) => a !== null);
  const courseAverageOfStudentAverages =
    studentAverages.length > 0
      ? studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length
      : null;

  return {
    summary: {
      studentCount: students.length,
      sessionCount: sessions.length,
      sessionsWithAttendance: sessionsTakenCount,
      activityCount: activities.length,
      totalGradesEntered: allScores.length,
      courseAttendanceRate,
      avgStudentAttendanceRate,
      courseGradeAverage,
      courseAverageOfStudentAverages,
    },
    attendanceByStudent,
    gradesByStudent,
    activityStats,
  };
}

export async function saveAttendanceBatch(sessionId, entries) {
  const authSession = await getSession();
  const markedBy = authSession?.user?.id ?? null;
  const supabase = getSupabase();

  const rows = entries.map(({ studentId, status, notes }) => ({
    session_id: sessionId,
    student_id: studentId,
    status,
    notes: notes || null,
    marked_by: markedBy,
    marked_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('attendance_records')
    .upsert(rows, { onConflict: 'session_id,student_id' });

  if (error) throw error;
}

export async function fetchCourseActivities(courseId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('course_activities')
    .select('*')
    .eq('course_id', courseId)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createActivity(courseId, fields) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('course_activities')
    .insert({
      course_id: courseId,
      title: fields.title.trim(),
      description: fields.description?.trim() || null,
      due_at: fields.dueAt || null,
      allow_online_submit: Boolean(fields.allowOnlineSubmit),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteActivity(activityId) {
  const supabase = getSupabase();
  const { error } = await supabase.from('course_activities').delete().eq('id', activityId);
  if (error) throw error;
}

export async function fetchSubmissionsForCourse(courseId) {
  const supabase = getSupabase();
  const { data: activities, error: actErr } = await supabase
    .from('course_activities')
    .select('id')
    .eq('course_id', courseId);

  if (actErr) throw actErr;
  const ids = (activities ?? []).map((a) => a.id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('activity_submissions')
    .select('*')
    .in('activity_id', ids);

  if (error) throw error;
  return data ?? [];
}

export async function fetchGradesForCourse(courseId) {
  const supabase = getSupabase();
  const { data: activities, error: actErr } = await supabase
    .from('course_activities')
    .select('id')
    .eq('course_id', courseId);

  if (actErr) throw actErr;
  const ids = (activities ?? []).map((a) => a.id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('activity_grades')
    .select('*')
    .in('activity_id', ids);

  if (error) throw error;
  return data ?? [];
}

export async function saveActivityGrade(activityId, studentId, score, feedback = null) {
  const n = Number(score);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    throw new Error('La nota debe estar entre 0 y 100.');
  }

  const authSession = await getSession();
  const supabase = getSupabase();

  const { error } = await supabase.from('activity_grades').upsert(
    {
      activity_id: activityId,
      student_id: studentId,
      score: Math.round(n * 100) / 100,
      feedback: feedback || null,
      graded_by: authSession?.user?.id ?? null,
      graded_at: new Date().toISOString(),
    },
    { onConflict: 'activity_id,student_id' },
  );

  if (error) throw error;
}

export async function submitActivityLink(activityId, submissionUrl, notes = null) {
  const url = submissionUrl.trim();
  if (!url) throw new Error('Ingresa el enlace de tu entrega.');
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('El enlace debe comenzar con http:// o https://');
  }

  const authSession = await getSession();
  const studentId = authSession?.user?.id;
  if (!studentId) throw new Error('Debes iniciar sesión.');

  const supabase = getSupabase();
  const { error } = await supabase.from('activity_submissions').upsert(
    {
      activity_id: activityId,
      student_id: studentId,
      submission_url: url,
      notes: notes || null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'activity_id,student_id' },
  );

  if (error) throw error;
}

export async function fetchStudentCourseWorkspace(courseId, studentId) {
  const [activities, sessions, submissions, grades] = await Promise.all([
    fetchCourseActivities(courseId),
    fetchCourseSessions(courseId),
    fetchSubmissionsForStudent(courseId, studentId),
    fetchGradesForStudent(courseId, studentId),
  ]);

  return { activities, sessions, submissions, grades };
}

async function fetchSubmissionsForStudent(courseId, studentId) {
  const supabase = getSupabase();
  const { data: activities } = await supabase.from('course_activities').select('id').eq('course_id', courseId);
  const ids = (activities ?? []).map((a) => a.id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('activity_submissions')
    .select('*')
    .in('activity_id', ids)
    .eq('student_id', studentId);

  if (error) throw error;
  return data ?? [];
}

async function fetchGradesForStudent(courseId, studentId) {
  const supabase = getSupabase();
  const { data: activities } = await supabase.from('course_activities').select('id').eq('course_id', courseId);
  const ids = (activities ?? []).map((a) => a.id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('activity_grades')
    .select('*')
    .in('activity_id', ids)
    .eq('student_id', studentId);

  if (error) throw error;
  return data ?? [];
}

export function studentInitials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function canManageCourse(course, session) {
  if (!course || !session) return false;
  if (session.role === 'admin') return true;
  return course.teacher_id === session.user?.id;
}
