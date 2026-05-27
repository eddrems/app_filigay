import Alpine from './alpine-core.js';
import { getCurrentSession } from './session.js';
import { getDemoSession, setDemoSession } from './session.js';
import { isSupabaseConfigured } from './supabase.js';
import { completeFirstLogin } from './profiles.js';
import { getSession } from './auth.js';
import { routeForRole } from './roles.js';

function translateAuthError(message = '') {
  const m = message.toLowerCase();
  if (m.includes('same') || m.includes('different')) {
    return 'La nueva contraseña debe ser distinta a la actual (no uses tu teléfono).';
  }
  if (m.includes('at least') || m.includes('characters')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (m.includes('session') || m.includes('jwt')) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  }
  return message || 'No se pudo completar la actualización.';
}

document.addEventListener('alpine:init', () => {
  Alpine.data('profileUpdatePage', () => ({
    session: null,
    email: '',
    phone: '',
    newPassword: '',
    confirmPassword: '',
    loading: false,
    ready: false,
    error: '',
    success: '',

    async init() {
      const session = await getCurrentSession();
      if (!session) {
        window.location.replace('index.html');
        return;
      }

      const force = new URLSearchParams(window.location.search).has('force');
      if (!session.needsProfileUpdate && !force) {
        window.location.replace(routeForRole(session.role));
        return;
      }

      this.session = session;
      this.email = session.email || '';
      this.phone = session.phone || '';
      this.ready = true;
    },

    async submit() {
      this.error = '';
      this.success = '';
      this.loading = true;

      try {
        const email = this.email.trim();
        const phone = this.phone.trim();
        const pwd = this.newPassword;
        const pwd2 = this.confirmPassword;

        if (!email) {
          throw new Error('El correo electrónico es obligatorio.');
        }
        if (!phone) {
          throw new Error('El teléfono es obligatorio.');
        }
        if (pwd.length < 6) {
          throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
        }
        if (pwd !== pwd2) {
          throw new Error('Las contraseñas no coinciden.');
        }
        if (pwd === phone) {
          throw new Error('La nueva contraseña no puede ser igual a tu teléfono.');
        }

        if (this.session.mode === 'demo' || !isSupabaseConfigured()) {
          const demo = getDemoSession();
          setDemoSession({
            ...demo,
            email,
            phone,
            needsProfileUpdate: false,
          });
        } else {
          const authSession = await getSession();
          const userId = this.session.user?.id ?? authSession?.user?.id;
          if (!userId) {
            throw new Error('No se encontró la sesión. Inicia sesión de nuevo.');
          }

          await completeFirstLogin({
            userId,
            password: pwd,
            email,
            phone,
            fullName: this.session.name,
          });
        }

        this.success = 'Contraseña y perfil actualizados. Redirigiendo…';
        setTimeout(() => {
          window.location.href = routeForRole(this.session.role);
        }, 800);
      } catch (err) {
        this.error = translateAuthError(err.message);
      } finally {
        this.loading = false;
      }
    },
  }));
});

