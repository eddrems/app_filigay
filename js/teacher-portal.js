import Alpine from './alpine-core.js';
import { getCurrentSession, isDemoMode } from './session.js';
import { fetchCoursesForManager, formatPrice, teacherName } from './courses.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('teacherPortal', () => ({
    courses: [],
    loading: true,
    error: '',
    demoMode: isDemoMode(),
    session: null,

    async initTeacherPortal() {
      this.session = await getCurrentSession();
      if (this.demoMode) {
        this.courses = [
          {
            id: 'c1',
            title: 'Entendiendo a Dios',
            price: 149.99,
            is_active: true,
            teacher: { full_name: 'Prof. Carlos Mendoza' },
          },
        ];
        this.loading = false;
        return;
      }

      try {
        this.courses = await fetchCoursesForManager(this.session);
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    notebookUrl(courseId) {
      return `cuaderno-curso.html?id=${encodeURIComponent(courseId)}`;
    },

    formatPrice,
    teacherName,
  }));
});
