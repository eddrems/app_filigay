import Alpine from './alpine-core.js';
import { isDemoMode } from './session.js';
import { fetchCourses } from './courses.js';
import { formatPrice } from './courses.js';
import {
  fetchStudents,
  fetchEnrollments,
  createStudent,
  syncStudentEnrollments,
  groupEnrollmentsByStudent,
  studentInitials,
} from './students.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('studentsManager', () => ({
    students: [],
    courses: [],
    enrollmentsByStudent: {},
    loading: true,
    submitting: false,
    enrolling: false,
    error: '',
    success: '',
    demoMode: isDemoMode(),
    search: '',
    showCreate: false,
    showEnroll: false,
    selectedStudent: null,
    selectedCourseIds: [],
    form: {
      email: '',
      fullName: '',
      phone: '',
      studentId: '',
    },

    get filteredStudents() {
      const q = this.search.trim().toLowerCase();
      if (!q) return this.students;
      return this.students.filter(
        (s) =>
          s.full_name?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.student_id?.toLowerCase().includes(q),
      );
    },

    courseCount(studentId) {
      return (this.enrollmentsByStudent[studentId] || []).length;
    },

    isCourseSelected(courseId) {
      return this.selectedCourseIds.includes(courseId);
    },

    toggleCourse(courseId) {
      if (this.selectedCourseIds.includes(courseId)) {
        this.selectedCourseIds = this.selectedCourseIds.filter((id) => id !== courseId);
      } else {
        this.selectedCourseIds = [...this.selectedCourseIds, courseId];
      }
    },

    async initStudents() {
      if (this.demoMode) {
        this.students = [
          {
            id: 's1',
            full_name: 'Alejandro Martínez',
            email: 'estudiante@zao.edu',
            phone: '3001234567',
            student_id: 'ZAO-2023-459',
          },
        ];
        this.courses = [
          { id: 'c1', title: 'Entendiendo a Dios', price: 149.99, is_active: true },
        ];
        this.enrollmentsByStudent = { s1: ['c1'] };
        this.loading = false;
        return;
      }
      await this.reload();
    },

    async reload() {
      this.loading = true;
      this.error = '';
      try {
        const [students, enrollments, courses] = await Promise.all([
          fetchStudents(),
          fetchEnrollments(),
          fetchCourses(),
        ]);
        this.students = students;
        this.courses = courses.filter((c) => c.is_active);
        this.enrollmentsByStudent = groupEnrollmentsByStudent(enrollments);
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    openCreate() {
      this.showEnroll = false;
      this.showCreate = true;
      this.form = { email: '', fullName: '', phone: '', studentId: '' };
    },

    openEnroll(student) {
      this.showCreate = false;
      this.showEnroll = true;
      this.selectedStudent = student;
      this.selectedCourseIds = [...(this.enrollmentsByStudent[student.id] || [])];
    },

    closePanels() {
      this.showCreate = false;
      this.showEnroll = false;
      this.selectedStudent = null;
    },

    async submitCreate() {
      this.error = '';
      this.success = '';
      this.submitting = true;
      try {
        if (this.demoMode) throw new Error('Ejecuta supabase/06-students-enrollments.sql');
        const result = await createStudent({
          email: this.form.email,
          fullName: this.form.fullName,
          phone: this.form.phone,
          studentId: this.form.studentId || null,
        });
        this.success = `Estudiante creado: ${result.full_name} (${result.student_id}). Primera clave: su teléfono. Deberá cambiarla al ingresar.`;
        this.showCreate = false;
        await this.reload();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.submitting = false;
      }
    },

    async saveEnrollments() {
      if (!this.selectedStudent) return;
      this.error = '';
      this.success = '';
      this.enrolling = true;
      try {
        if (this.demoMode) throw new Error('No disponible en modo demo.');
        const result = await syncStudentEnrollments(
          this.selectedStudent.id,
          this.selectedCourseIds,
        );
        this.success = `Matrícula actualizada: ${result.active_enrollments} curso(s) para ${this.selectedStudent.full_name}.`;
        this.showEnroll = false;
        await this.reload();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.enrolling = false;
      }
    },

    studentInitials,
    formatPrice,
  }));
});
