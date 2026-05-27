import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3/dist/module.esm.js';
import { isSupabaseConfigured } from './supabase.js';
import { signIn } from './auth.js';
import { loginDemo, getCurrentSession } from './session.js';
import { routeForRole } from './roles.js';
import { DEMO_USERS } from './roles.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('loginPage', () => ({
    email: '',
    password: '',
    loading: false,
    error: '',
    demoMode: !isSupabaseConfigured(),

    async init() {
      const existing = await getCurrentSession();
      if (existing) {
        window.location.replace(
          existing.needsProfileUpdate ? 'actualizar-perfil.html' : routeForRole(existing.role),
        );
      }
    },

    fillCredentials(email, password) {
      this.email = email;
      this.password = password;
    },

    async submit() {
      this.error = '';
      this.loading = true;
      try {
        if (this.demoMode) {
          const session = loginDemo(this.email, this.password);
          const dest = session.needsProfileUpdate
            ? 'actualizar-perfil.html'
            : routeForRole(session.role);
          window.location.href = dest;
          return;
        }
        await signIn(this.email, this.password);
        const session = await getCurrentSession();
        window.location.href = session?.needsProfileUpdate
          ? 'actualizar-perfil.html'
          : routeForRole(session?.role);
      } catch (err) {
        this.error = err.message || 'No se pudo iniciar sesión.';
      } finally {
        this.loading = false;
      }
    },

    get demoAccounts() {
      return Object.entries(DEMO_USERS).map(([email, data]) => ({
        email,
        password: data.password,
        role: data.role,
        label:
          data.role === 'admin' ? 'Admin' : data.role === 'teacher' ? 'Docente' : 'Estudiante',
        icon:
          data.role === 'admin'
            ? 'admin_panel_settings'
            : data.role === 'teacher'
              ? 'history_edu'
              : 'person_book',
      }));
    },
  }));
});

Alpine.start();
