import { isSupabaseConfigured } from './supabase.js';
import { getSession } from './auth.js';
import { fetchProfile } from './profiles.js';
import { DEMO_USERS, resolveRole } from './roles.js';

const STORAGE_KEY = 'zao_demo_session';

export function isDemoMode() {
  return !isSupabaseConfigured();
}

export function getDemoSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setDemoSession(payload) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearDemoSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function mapSupabaseSession(user, profile) {
  const meta = user.user_metadata || {};
  const email = profile?.email || user.email;
  const role = profile?.role || resolveRole(email, meta);

  return {
    mode: 'supabase',
    user,
    email,
    name: profile?.full_name || meta.full_name || meta.name || email,
    role,
    phone: profile?.phone || meta.phone || '',
    studentId: profile?.student_id || meta.student_id || null,
    needsProfileUpdate:
      profile?.needs_profile_update ?? meta.needs_profile_update === true,
  };
}

export async function getCurrentSession() {
  if (isSupabaseConfigured()) {
    const session = await getSession();
    if (session) {
      clearDemoSession();
      try {
        const profile = await fetchProfile(session.user.id);
        return mapSupabaseSession(session.user, profile);
      } catch {
        return mapSupabaseSession(session.user, null);
      }
    }
    return null;
  }

  const demo = getDemoSession();
  if (demo) return { mode: 'demo', ...demo };
  return null;
}

export function loginDemo(email, password) {
  const key = email.trim().toLowerCase();
  const account = DEMO_USERS[key];
  if (!account || account.password !== password) {
    throw new Error('Credenciales incorrectas. Usa las credenciales de prueba.');
  }
  const payload = {
    email: key,
    name: account.name,
    role: account.role,
    phone: account.phone,
    studentId: account.studentId || null,
    needsProfileUpdate: false,
  };
  setDemoSession(payload);
  return payload;
}
