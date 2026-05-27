import Alpine from './alpine-core.js';
import { getCurrentSession, isDemoMode } from './session.js';
import { fetchCourseById } from './courses.js';
import {
  WEEKDAYS,
  ATTENDANCE_STATUSES,
  buildSessionsFromRange,
  formatSessionDateTime,
  formatDueDate,
  fetchCourseStudents,
  fetchCourseSessions,
  createSessionsBulk,
  deleteSession,
  fetchAttendanceForSession,
  saveAttendanceBatch,
  fetchCourseActivities,
  createActivity,
  deleteActivity,
  fetchSubmissionsForCourse,
  fetchGradesForCourse,
  fetchAttendanceForCourse,
  saveActivityGrade,
  canManageCourse,
  studentInitials,
  buildCourseStatistics,
  formatPercent,
  formatScore,
} from './classroom.js';

function courseIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id');
}

document.addEventListener('alpine:init', () => {
  Alpine.data('courseNotebook', () => ({
    courseId: null,
    course: null,
    students: [],
    sessions: [],
    activities: [],
    submissions: [],
    grades: [],
    allAttendance: [],
    session: null,
    tab: 'horario',
    loading: true,
    saving: false,
    error: '',
    success: '',
    demoMode: isDemoMode(),

    // Horario por rango
    rangeForm: {
      weekday: 4,
      startDate: '',
      endDate: '',
      startTime: '19:00',
      endTime: '',
      label: '',
    },
    rangePreview: [],

    // Asistencia
    attendanceSessionId: '',
    attendanceMap: {},

    // Actividad nueva
    activityForm: {
      title: '',
      description: '',
      dueAt: '',
      allowOnlineSubmit: true,
    },
    gradingActivityId: '',

    get gradingActivity() {
      return this.activities.find((a) => a.id === this.gradingActivityId) || null;
    },

    get upcomingSessions() {
      const today = new Date().toISOString().slice(0, 10);
      return this.sessions.filter((s) => s.session_date >= today).slice(0, 5);
    },

    get stats() {
      return buildCourseStatistics(
        this.students,
        this.sessions,
        this.activities,
        this.grades,
        this.allAttendance,
        this.submissions,
      );
    },

    get statsSummary() {
      return this.stats.summary;
    },

    attendanceBarWidth(rate) {
      if (rate === null) return '0%';
      return `${Math.min(100, Math.max(0, rate))}%`;
    },

    gradeBarWidth(score) {
      if (score === null) return '0%';
      return `${Math.min(100, Math.max(0, score))}%`;
    },

    gradeTone(score) {
      if (score === null) return 'neutral';
      if (score >= 90) return 'high';
      if (score >= 70) return 'mid';
      return 'low';
    },

    async initNotebook() {
      this.courseId = courseIdFromUrl();
      if (!this.courseId) {
        window.location.replace('docente.html');
        return;
      }

      this.session = await getCurrentSession();
      if (!this.session) {
        window.location.replace('index.html');
        return;
      }

      if (this.demoMode) {
        this.course = {
          id: this.courseId,
          title: 'Entendiendo a Dios (demo)',
          teacher_id: null,
        };
        this.students = [
          { id: 's1', full_name: 'Alejandro Martínez', student_id: 'ZAO-2023-459' },
        ];
        this.loading = false;
        return;
      }

      try {
        await this.reload();
        if (!canManageCourse(this.course, this.session)) {
          window.location.replace('docente.html');
          return;
        }
        if (this.sessions.length && !this.attendanceSessionId) {
          this.attendanceSessionId = this.sessions[0].id;
          await this.loadAttendance();
        }
        if (this.activities.length && !this.gradingActivityId) {
          this.gradingActivityId = this.activities[0].id;
        }
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async reload() {
      const [course, students, sessions, activities, submissions, grades, allAttendance] =
        await Promise.all([
          fetchCourseById(this.courseId),
          fetchCourseStudents(this.courseId),
          fetchCourseSessions(this.courseId),
          fetchCourseActivities(this.courseId),
          fetchSubmissionsForCourse(this.courseId),
          fetchGradesForCourse(this.courseId),
          fetchAttendanceForCourse(this.courseId),
        ]);

      if (!course) throw new Error('Curso no encontrado.');
      this.course = course;
      this.students = students;
      this.sessions = sessions;
      this.activities = activities;
      this.submissions = submissions;
      this.grades = grades;
      this.allAttendance = allAttendance;
    },

    previewRange() {
      this.rangePreview = buildSessionsFromRange({
        weekday: Number(this.rangeForm.weekday),
        startDate: this.rangeForm.startDate,
        endDate: this.rangeForm.endDate,
        startTime: this.rangeForm.startTime,
        endTime: this.rangeForm.endTime || null,
        label: this.rangeForm.label || null,
      });
    },

    async applyRange() {
      this.error = '';
      this.success = '';
      this.previewRange();
      if (!this.rangePreview.length) {
        this.error = 'No hay fechas en ese rango para el día elegido.';
        return;
      }
      if (this.demoMode) {
        this.error = 'Ejecuta supabase/07-course-classroom.sql en Supabase.';
        return;
      }

      this.saving = true;
      try {
        await createSessionsBulk(this.courseId, this.rangePreview);
        this.success = `Se crearon ${this.rangePreview.length} sesión(es) en el horario.`;
        await this.reload();
        if (this.sessions.length) {
          this.attendanceSessionId = this.sessions[this.sessions.length - 1].id;
          await this.loadAttendance();
        }
        this.rangePreview = [];
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    async removeSession(sessionId) {
      if (!confirm('¿Eliminar esta fecha de clase? También se borrará su asistencia.')) return;
      this.saving = true;
      this.error = '';
      try {
        await deleteSession(sessionId);
        await this.reload();
        if (this.attendanceSessionId === sessionId) {
          this.attendanceSessionId = this.sessions[0]?.id || '';
          await this.loadAttendance();
        }
        this.success = 'Sesión eliminada.';
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    async loadAttendance() {
      if (!this.attendanceSessionId || this.demoMode) {
        this.attendanceMap = {};
        for (const s of this.students) {
          this.attendanceMap[s.id] = 'absent';
        }
        return;
      }

      const records = await fetchAttendanceForSession(this.attendanceSessionId);
      const map = {};
      for (const s of this.students) {
        map[s.id] = 'absent';
      }
      for (const r of records) {
        map[r.student_id] = r.status;
      }
      this.attendanceMap = map;
    },

    setAttendance(studentId, status) {
      this.attendanceMap = { ...this.attendanceMap, [studentId]: status };
    },

    async saveAttendance() {
      if (!this.attendanceSessionId) {
        this.error = 'Elige una fecha de clase.';
        return;
      }
      this.saving = true;
      this.error = '';
      try {
        const entries = this.students.map((s) => ({
          studentId: s.id,
          status: this.attendanceMap[s.id] || 'absent',
        }));
        await saveAttendanceBatch(this.attendanceSessionId, entries);
        this.allAttendance = await fetchAttendanceForCourse(this.courseId);
        this.success = 'Asistencia guardada.';
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    async addActivity() {
      if (!this.activityForm.title.trim()) {
        this.error = 'El título de la actividad es obligatorio.';
        return;
      }
      this.saving = true;
      this.error = '';
      try {
        const dueAt = this.activityForm.dueAt
          ? new Date(this.activityForm.dueAt).toISOString()
          : null;
        await createActivity(this.courseId, {
          title: this.activityForm.title,
          description: this.activityForm.description,
          dueAt,
          allowOnlineSubmit: this.activityForm.allowOnlineSubmit,
        });
        this.activityForm = {
          title: '',
          description: '',
          dueAt: '',
          allowOnlineSubmit: true,
        };
        await this.reload();
        this.gradingActivityId = this.activities[this.activities.length - 1]?.id || '';
        this.success = 'Actividad creada.';
        this.tab = 'actividades';
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    async removeActivity(activityId) {
      if (!confirm('¿Eliminar esta actividad y sus entregas/notas?')) return;
      this.saving = true;
      try {
        await deleteActivity(activityId);
        await this.reload();
        this.gradingActivityId = this.activities[0]?.id || '';
        this.success = 'Actividad eliminada.';
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    gradeFor(activityId, studentId) {
      const g = this.grades.find(
        (row) => row.activity_id === activityId && row.student_id === studentId,
      );
      return g?.score ?? '';
    },

    submissionFor(activityId, studentId) {
      return this.submissions.find(
        (row) => row.activity_id === activityId && row.student_id === studentId,
      );
    },

    async saveGrade(studentId, rawScore) {
      if (!this.gradingActivityId) return;
      const score = rawScore === '' || rawScore === null ? null : Number(rawScore);
      if (score === null) return;

      this.saving = true;
      this.error = '';
      try {
        await saveActivityGrade(this.gradingActivityId, studentId, score);
        this.grades = await fetchGradesForCourse(this.courseId);
        this.success = 'Nota guardada.';
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    averageForStudent(studentId) {
      const row = this.stats.gradesByStudent.find((g) => g.studentId === studentId);
      return row?.average ?? null;
    },

    attendanceRateForStudent(studentId) {
      const row = this.stats.attendanceByStudent.find((a) => a.studentId === studentId);
      return row?.rate ?? null;
    },

    studentGradeRow(studentId) {
      return this.stats.gradesByStudent.find((g) => g.studentId === studentId);
    },

    studentAttendanceRow(studentId) {
      return this.stats.attendanceByStudent.find((a) => a.studentId === studentId);
    },

    formatSessionDateTime,
    formatDueDate,
    formatPercent,
    formatScore,
    studentInitials,
    weekdays: WEEKDAYS,
    attendanceStatuses: ATTENDANCE_STATUSES,
  }));
});
