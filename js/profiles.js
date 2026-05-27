import { getSupabase } from './supabase.js';

export async function fetchProfile(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, student_id, needs_profile_update')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateProfile(userId, fields) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .update({
      email: fields.email,
      phone: fields.phone,
      full_name: fields.full_name,
      needs_profile_update: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Primer acceso: nueva contraseña + perfil + metadata en una sola operación Auth */
export async function completeFirstLogin({ userId, password, email, phone, fullName }) {
  const supabase = getSupabase();

  const { error: authError } = await supabase.auth.updateUser({
    password,
    data: {
      phone,
      full_name: fullName,
      needs_profile_update: false,
    },
  });
  if (authError) throw authError;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      email,
      phone,
      full_name: fullName,
      needs_profile_update: false,
    })
    .eq('id', userId);

  if (profileError) throw profileError;
}

export async function updateUserMetadata(fields) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.updateUser({
    data: {
      phone: fields.phone,
      full_name: fields.full_name,
      needs_profile_update: false,
    },
  });
  if (error) throw error;
  return data;
}
