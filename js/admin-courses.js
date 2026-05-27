import Alpine from './alpine-core.js';
import { isDemoMode } from './session.js';
import {
  fetchCourses,
  fetchTeachers,
  createCourse,
  updateCourse,
  deleteCourse,
  uploadCourseCover,
  formatPrice,
  teacherName,
} from './courses.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('coursesManager', () => ({
    courses: [],
    teachers: [],
    loading: true,
    submitting: false,
    error: '',
    success: '',
    demoMode: isDemoMode(),
    editingId: null,
    coverPreview: null,
    coverFile: null,
    form: {
      title: '',
      price: '',
      teacherId: '',
      isActive: true,
    },

    async initCourses() {
      if (this.demoMode) {
        this.teachers = [{ id: 't1', full_name: 'Prof. Carlos Mendoza', email: 'maestro@zao.edu' }];
        this.courses = [
          {
            id: 'c1',
            title: 'Entendiendo a Dios',
            cover_image_url: null,
            price: 149.99,
            is_active: true,
            teacher: { full_name: 'Prof. Carlos Mendoza' },
          },
        ];
        this.loading = false;
        return;
      }
      await Promise.all([this.loadCourses(), this.loadTeachers()]);
    },

    async loadTeachers() {
      try {
        this.teachers = await fetchTeachers();
      } catch (err) {
        this.error = err.message;
      }
    },

    async loadCourses() {
      this.loading = true;
      this.error = '';
      try {
        this.courses = await fetchCourses();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    onCoverChange(event) {
      const file = event.target.files?.[0];
      this.coverFile = file || null;
      if (this.coverPreview) URL.revokeObjectURL(this.coverPreview);
      this.coverPreview = file ? URL.createObjectURL(file) : null;
    },

    resetForm() {
      this.editingId = null;
      this.form = { title: '', price: '', teacherId: '', isActive: true };
      this.coverFile = null;
      if (this.coverPreview) URL.revokeObjectURL(this.coverPreview);
      this.coverPreview = null;
      const input = document.getElementById('course-cover-input');
      if (input) input.value = '';
    },

    editCourse(course) {
      this.editingId = course.id;
      this.form = {
        title: course.title,
        price: String(course.price),
        teacherId: course.teacher_id || '',
        isActive: course.is_active,
      };
      this.coverFile = null;
      if (this.coverPreview) URL.revokeObjectURL(this.coverPreview);
      this.coverPreview = course.cover_image_url || null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async submitCourse() {
      this.error = '';
      this.success = '';
      this.submitting = true;

      try {
        if (this.demoMode) {
          throw new Error('Ejecuta supabase/05-courses.sql y usa Supabase para gestionar cursos.');
        }

        if (!this.form.title.trim()) throw new Error('El título es obligatorio.');
        if (!this.form.teacherId) throw new Error('Selecciona un docente.');
        const priceNum = Number(this.form.price);
        if (Number.isNaN(priceNum) || priceNum <= 0) {
          throw new Error('El valor en USD debe ser mayor a 0.');
        }

        let course;

        if (this.editingId) {
          course = await updateCourse(this.editingId, {
            title: this.form.title,
            price: this.form.price,
            teacherId: this.form.teacherId,
            isActive: this.form.isActive,
          });
        } else {
          course = await createCourse({
            title: this.form.title,
            price: this.form.price,
            teacherId: this.form.teacherId,
            isActive: this.form.isActive,
          });
        }

        if (this.coverFile) {
          const url = await uploadCourseCover(course.id, this.coverFile);
          course = await updateCourse(course.id, { coverImageUrl: url });
        }

        this.success = this.editingId
          ? 'Curso actualizado correctamente.'
          : 'Curso creado correctamente.';
        this.resetForm();
        await this.loadCourses();
      } catch (err) {
        this.error = err.message || 'No se pudo guardar el curso.';
      } finally {
        this.submitting = false;
      }
    },

    async removeCourse(course) {
      if (!confirm(`¿Eliminar el curso "${course.title}"?`)) return;
      this.error = '';
      try {
        if (this.demoMode) throw new Error('No disponible en modo demo.');
        await deleteCourse(course.id);
        this.success = 'Curso eliminado.';
        if (this.editingId === course.id) this.resetForm();
        await this.loadCourses();
      } catch (err) {
        this.error = err.message;
      }
    },

    formatPrice,
    teacherName,
  }));
});
