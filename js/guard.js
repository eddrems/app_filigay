import { getCurrentSession, clearDemoSession } from './session.js';
import { signOut } from './auth.js';
import { isSupabaseConfigured } from './supabase.js';
import { routeForRole } from './roles.js';

export async function requireAuth(allowedRoles = null) {
  const session = await getCurrentSession();
  if (!session) {
    window.location.replace('index.html');
    return null;
  }

  if (session.needsProfileUpdate && !window.location.pathname.includes('actualizar-perfil')) {
    window.location.replace('actualizar-perfil.html');
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    window.location.replace(routeForRole(session.role));
    return null;
  }

  return session;
}

export async function logout() {
  clearDemoSession();
  if (isSupabaseConfigured()) {
    try {
      await signOut();
    } catch {
      /* ignore */
    }
  }
  window.location.replace('index.html');
}
