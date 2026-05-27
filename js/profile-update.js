import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3/dist/module.esm.js';
import { requireAuth } from './guard.js';
import { getDemoSession, setDemoSession } from './session.js';
import { isSupabaseConfigured } from './supabase.js';
import { updateProfile, updateUserMetadata } from './profiles.js';
import { routeForRole } from './roles.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('profileUpdatePage', () => ({
    session: null,
    email: '',
    phone: '',
    loading: false,
    error: '',
    success: '',

    async init() {
      this.session = await requireAuth();
      if (!this.session) return;

      const force = new URLSearchParams(window.location.search).has('force');
      if (!this.session.needsProfileUpdate && !force) {
        window.location.replace(routeForRole(this.session.role));
        return;
      }

      this.email = this.session.email || '';
      this.phone = this.session.phone || '';
    },

    async submit() {
      this.error = '';
      this.success = '';
      this.loading = true;

      try {
        const email = this.email.trim();
        const phone = this.phone.trim();

        if (this.session.mode === 'demo' || !isSupabaseConfigured()) {
          const demo = getDemoSession();
          setDemoSession({
            ...demo,
            email,
            phone,
            needsProfileUpdate: false,
          });
        } else {
          const userId = this.session.user.id;
          await updateProfile(userId, {
            email,
            phone,
            full_name: this.session.name,
          });
          await updateUserMetadata({ email, phone, full_name: this.session.name });
        }

        this.success = 'Perfil actualizado correctamente.';
        setTimeout(() => {
          window.location.href = routeForRole(this.session.role);
        }, 600);
      } catch (err) {
        this.error = err.message || 'No se pudo guardar el perfil.';
      } finally {
        this.loading = false;
      }
    },
  }));
});

Alpine.start();
