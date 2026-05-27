import Alpine from './alpine-core.js';
import { fetchStaffUsers, createStaffUser, roleLabel } from './staff-users.js';
import { isDemoMode } from './session.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('staffManager', () => ({
    staff: [],
    loadingList: true,
    submitting: false,
    error: '',
    success: '',
    demoMode: isDemoMode(),
    form: {
      email: '',
      fullName: '',
      phone: '',
      password: '',
      role: 'teacher',
    },

    async initStaff() {
      if (this.demoMode) {
        this.staff = [
          {
            id: '1',
            email: 'admin@zao.edu',
            full_name: 'Administrador ZAO',
            phone: 'admin123',
            role: 'admin',
          },
          {
            id: '2',
            email: 'maestro@zao.edu',
            full_name: 'Prof. Carlos Mendoza',
            phone: 'prof123',
            role: 'teacher',
          },
        ];
        this.loadingList = false;
        return;
      }

      await this.loadStaff();
    },

    async loadStaff() {
      this.loadingList = true;
      this.error = '';
      try {
        this.staff = await fetchStaffUsers();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loadingList = false;
      }
    },

    async submitCreate() {
      this.error = '';
      this.success = '';
      this.submitting = true;

      try {
        if (this.demoMode) {
          throw new Error('En modo demo no se pueden crear usuarios. Configura Supabase.');
        }

        const result = await createStaffUser({
          email: this.form.email,
          password: this.form.password,
          fullName: this.form.fullName,
          phone: this.form.phone,
          role: this.form.role,
        });

        this.success = `Usuario creado: ${result.full_name || result.email} (${roleLabel(result.role)})`;
        this.form = { email: '', fullName: '', phone: '', password: '', role: 'teacher' };
        await this.loadStaff();
      } catch (err) {
        this.error = err.message || 'No se pudo crear el usuario.';
      } finally {
        this.submitting = false;
      }
    },

    roleLabel,
  }));
});
