import { getSupabase } from './supabase.js';
import { isSupabaseConfigured } from './supabase.js';

export async function fetchStaffUsers() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, created_at')
    .in('role', ['admin', 'teacher'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createStaffUser({ email, password, fullName, phone, role }) {
  if (!isSupabaseConfigured()) {
    throw new Error('Conecta Supabase en js/config.js para crear usuarios.');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('admin_create_staff_user', {
    p_email: email.trim(),
    p_password: password,
    p_full_name: fullName.trim(),
    p_phone: phone.trim(),
    p_role: role,
  });

  if (error) throw error;
  return data;
}

export function roleLabel(role) {
  if (role === 'admin') return 'Administrador';
  if (role === 'teacher') return 'Docente';
  return role;
}
