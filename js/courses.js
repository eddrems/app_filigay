import { getSupabase } from './supabase.js';
import { isSupabaseConfigured } from './supabase.js';

const BUCKET = 'course-covers';

export async function fetchTeachers() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'teacher')
    .order('full_name');

  if (error) throw error;
  return data ?? [];
}

function attachTeachers(courses, teachers) {
  const byId = Object.fromEntries(teachers.map((t) => [t.id, t]));
  return courses.map((c) => ({
    ...c,
    teacher: c.teacher_id ? byId[c.teacher_id] ?? null : null,
  }));
}

export async function fetchCourseById(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const teachers = await fetchTeachers();
  return attachTeachers([data], teachers)[0];
}

export async function fetchCoursesForManager(session) {
  const all = await fetchCourses();
  if (session?.role === 'admin') return all;
  const uid = session?.user?.id;
  return all.filter((c) => c.teacher_id === uid);
}

export async function fetchCourses() {
  const supabase = getSupabase();
  const [coursesRes, teachers] = await Promise.all([
    supabase.from('courses').select('*').order('created_at', { ascending: false }),
    fetchTeachers(),
  ]);

  if (coursesRes.error) throw coursesRes.error;
  return attachTeachers(coursesRes.data ?? [], teachers);
}

function parsePrice(value) {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) {
    throw new Error('El valor debe ser mayor a 0 (USD).');
  }
  return Math.round(n * 100) / 100;
}

export async function createCourse({ title, price, teacherId, isActive = true }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('courses')
    .insert({
      title: title.trim(),
      price: parsePrice(price),
      teacher_id: teacherId || null,
      is_active: isActive,
    })
    .select('*')
    .single();

  if (error) throw error;
  const teachers = await fetchTeachers();
  return attachTeachers([data], teachers)[0];
}

export async function updateCourse(id, fields) {
  const supabase = getSupabase();
  const payload = {};
  if (fields.title !== undefined) payload.title = fields.title.trim();
  if (fields.price !== undefined) payload.price = parsePrice(fields.price);
  if (fields.teacherId !== undefined) payload.teacher_id = fields.teacherId || null;
  if (fields.coverImageUrl !== undefined) payload.cover_image_url = fields.coverImageUrl;
  if (fields.isActive !== undefined) payload.is_active = fields.isActive;

  const { data, error } = await supabase
    .from('courses')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  const teachers = await fetchTeachers();
  return attachTeachers([data], teachers)[0];
}

export async function deleteCourse(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from('courses').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadCourseCover(courseId, file) {
  if (!file) return null;
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no configurado.');
  }

  const supabase = getSupabase();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${courseId}/cover-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function formatPrice(value) {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function teacherName(course) {
  return course?.teacher?.full_name || 'Sin asignar';
}
